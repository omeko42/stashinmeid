import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { GoogleGenAI, Type } from '@google/genai';
import { verifySuperadminToken } from '@/lib/jwt';
import { createAdminClient } from '@/lib/supabase/admin';
import { checkRateLimit, clientIp, rateLimitHeaders } from '@/lib/rateLimit';
import {
  getDailyAiScanLimitForTier,
  resolveMembershipStatus,
} from '@/lib/membership';

function todayKeyWib(): string {
  const now = new Date(Date.now() + 7 * 60 * 60 * 1000);
  return now.toISOString().slice(0, 10);
}

// Batas: 20 scan per jam per IP. Scan struk memanggil Gemini API berbayar,
// jadi endpoint ini tidak boleh bisa dibakar oleh siapa pun yang menemukan URL-nya.
const SCAN_LIMIT = 20;
const SCAN_WINDOW_MS = 60 * 60 * 1000;

// Batas ukuran upload: 8 MB. Melewati ini = data besar yang sia-sia dikirim.
const MAX_FILE_BYTES = 8 * 1024 * 1024;

const ALLOWED_MIME = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic']);

/**
 * Endpoint scan struk bisa dipakai oleh dua jenis caller:
 * 1. Superadmin (lewat cookie session)
 * 2. Pengguna yang login lewat Supabase (lewat cookie session Supabase)
 *
 * Kalau keduanya tidak ada, tolak. Endpoint ini memakai kuota API berbayar,
 * jadi tidak boleh terbuka untuk publik.
 */
async function getAuthorizedUserId(req: NextRequest): Promise<string | null> {
  // Jalur 1: cookie superadmin. Kalau sedang impersonasi, hormati role target.
  const cookieStore = await cookies();
  const token = cookieStore.get('stashinme_session')?.value;
  const session = await verifySuperadminToken(token);
  if (session) {
    const targetId = session.impersonateUserId ?? `superadmin:${session.sub}`;
    if (!session.impersonateUserId) return targetId;

    const admin = createAdminClient();
    if (!admin) return null;
    const { data: profile, error } = await admin
      .from('profiles')
      .select('id, role')
      .eq('id', session.impersonateUserId)
      .single();
    if (error || !profile) return null;
    return `superadmin:${session.sub}:${profile.id}`;
  }

  // Jalur 2: session Supabase. @supabase/ssr menyimpan session di cookie,
  // jadi client browser otomatis membawa cookie-nya ke route ini.
  const { createClient } = await import('@/lib/supabase/server');
  const supabase = await createClient();
  if (supabase) {
    const { data, error } = await supabase.auth.getUser();
    if (!error && data.user) return data.user.id;
  }

  // Jalur 3: token Bearer (dipakai oleh integrasi non-browser)
  const authorization = req.headers.get('authorization');
  if (authorization?.startsWith('Bearer ')) {
    const { createClient: createSupabaseClient } = await import('@supabase/supabase-js');
    const { resolveSupabaseAnonKey, resolveSupabaseUrl } = await import('@/lib/supabase/project');
    const url = resolveSupabaseUrl();
    const anonKey = resolveSupabaseAnonKey();

    if (url && anonKey) {
      const bearerClient = createSupabaseClient(url, anonKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
      const { data, error } = await bearerClient.auth.getUser(authorization.slice(7));
      if (!error && data.user) return data.user.id;
    }
  }

  return null;
}


export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  const userId = await getAuthorizedUserId(req);
  if (!userId) {
    return NextResponse.json(
      { error: 'Kamu harus masuk dulu untuk memakai scan struk.' },
      { status: 401 }
    );
  }

  // Batas: 20 scan per jam per user, 60 per jam per IP.
  // Dicek sebelum request menyentuh Gemini (API berbayar).
  const userLimit = checkRateLimit(`scan-user:${userId}`, SCAN_LIMIT, SCAN_WINDOW_MS);
  const ipLimit = checkRateLimit(`scan-ip:${ip}`, SCAN_LIMIT * 3, SCAN_WINDOW_MS);
  const limit = !userLimit.allowed ? userLimit : ipLimit;

  if (!limit.allowed) {
    return NextResponse.json(
      {
        error: `Batas scan tercapai. Coba lagi dalam ${limit.retryAfterSeconds} detik.`,
      },
      { status: 429, headers: rateLimitHeaders(limit) }
    );
  }

  // Cek kuota harian AI per tier (`maxGroups - 1` / hari, khusus Business/Admin Unlimited)
  const admin = createAdminClient();
  const realUid = userId.startsWith('superadmin:')
    ? userId.split(':')[2] || null
    : userId;
  let aiDailyLimit: number | null = null;
  let aiUsedToday = 0;
  let aiUserMeta: Record<string, unknown> | null = null;
  const todayKey = todayKeyWib();

  if (admin && realUid && !userId.startsWith('superadmin:')) {
    const [{ data: authRes }, { data: profile }] = await Promise.all([
      admin.auth.admin.getUserById(realUid),
      admin.from('profiles').select('role').eq('id', realUid).maybeSingle(),
    ]);
    const isAdmin = profile?.role === 'admin';
    if (!isAdmin && authRes?.user) {
      aiUserMeta = (authRes.user.user_metadata ?? {}) as Record<string, unknown>;
      const status = resolveMembershipStatus(aiUserMeta);
      aiDailyLimit = getDailyAiScanLimitForTier(status.effectiveTier);
      const dailyRaw = aiUserMeta.ai_scan_daily as { date?: string; count?: number } | undefined;
      aiUsedToday =
        dailyRaw && dailyRaw.date === todayKey ? Number(dailyRaw.count) || 0 : 0;

      if (aiDailyLimit !== null && aiUsedToday >= aiDailyLimit) {
        return NextResponse.json(
          {
            error: `Batas AI Scan harian tercapai (${aiUsedToday}/${aiDailyLimit} scan hari ini). Coba lagi besok atau upgrade paket untuk kuota lebih besar.`,
            code: 'AI_DAILY_LIMIT_EXCEEDED',
            aiUsedToday,
            aiDailyLimit,
          },
          { status: 429 }
        );
      }
    }
  }

  try {
    // Batas total body sebelum parsing multipart.
    const contentLength = Number(req.headers.get('content-length') ?? 0);
    if (contentLength > MAX_FILE_BYTES + 256 * 1024) {
      return NextResponse.json(
        { error: 'Ukuran upload melebihi batas 8 MB.' },
        { status: 413 }
      );
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'GEMINI_API_KEY belum diset di environment variables.' },
        { status: 500 }
      );
    }

    const formData = await req.formData();
    const file = formData.get('image') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'Gambar tidak ditemukan.' }, { status: 400 });
    }

    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json(
        { error: 'Ukuran gambar melebihi 8 MB. Coba foto dengan resolusi lebih rendah.' },
        { status: 413 }
      );
    }

    const mimeType = file.type || 'image/jpeg';
    if (!ALLOWED_MIME.has(mimeType.toLowerCase())) {
      return NextResponse.json(
        { error: 'Format gambar tidak didukung. Gunakan JPG, PNG, WEBP, atau HEIC.' },
        { status: 415 }
      );
    }

    const bytes = await file.arrayBuffer();
    const base64Data = Buffer.from(bytes).toString('base64');

    const ai = new GoogleGenAI({ apiKey });

    const today = new Date().toISOString().split('T')[0];

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        {
          role: 'user',
          parts: [
            {
              inlineData: {
                mimeType,
                data: base64Data,
              },
            },
            {
              text: `Kamu adalah asisten pencatat keuangan pribadi di Indonesia.
Baca gambar struk belanja, invoice, atau screenshot bukti transfer (QRIS, BCA, Mandiri, BRI, GoPay, ShopeePay, dll) ini.
Ekstrak informasi berikut dalam format JSON:
- type: "inflow" jika uang masuk (transfer masuk, gaji, refund, terima dana), atau "outflow" jika uang keluar (belanja, bayar tagihan, transfer keluar, makan, cicilan). Default "outflow" jika ragu.
- amount: nominal angka bulat (tanpa Rp, titik, atau koma). Contoh: 50000.
- category: pilih satu kategori singkat yang paling cocok, misal: "Makan & Minum", "Belanja", "Transport", "Tagihan & Cicilan", "Gaji", "Transfer", "Lainnya".
- description: ringkasan singkat nama merchant/toko/pengirim/keperluan (maksimal 60 karakter).
- transaction_date: tanggal transaksi format YYYY-MM-DD. Jika tidak terlihat di gambar, gunakan "${today}".`,
            },
          ],
        },
      ],
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            type: { type: Type.STRING, enum: ['inflow', 'outflow'] },
            amount: { type: Type.NUMBER },
            category: { type: Type.STRING },
            description: { type: Type.STRING },
            transaction_date: { type: Type.STRING },
          },
          required: ['type', 'amount', 'category', 'description', 'transaction_date'],
        },
      },
    });

    const text = response.text;
    if (!text) {
      return NextResponse.json(
        { error: 'AI tidak mengembalikan hasil.' },
        { status: 500 }
      );
    }

    const parsed = JSON.parse(text);

    // Catat pemakaian AI harian setelah scan berhasil
    if (admin && realUid && aiUserMeta !== null) {
      const nextCount = aiUsedToday + 1;
      await admin.auth.admin
        .updateUserById(realUid, {
          user_metadata: {
            ...aiUserMeta,
            ai_scan_daily: { date: todayKey, count: nextCount },
          },
        })
        .catch(() => {
          // Non-blocking
        });
      aiUsedToday = nextCount;
    }

    return NextResponse.json(
      { data: parsed, aiUsedToday, aiDailyLimit },
      { headers: rateLimitHeaders(limit) }
    );
  } catch (error) {
    console.error('Scan receipt error:', error);
    return NextResponse.json(
      { error: 'Gagal memproses gambar dengan AI.' },
      { status: 500 }
    );
  }
}
