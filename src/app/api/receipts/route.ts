import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getCallerUserId } from '@/lib/currentUser';
import {
  getDailyAiScanLimitForTier,
  getStorageQuotaBytesForTier,
  getStorageQuotaMbForTier,
  resolveMembershipStatus,
} from '@/lib/membership';

const BUCKET = 'receipts';
const MAX_UPLOAD_BYTES = 2 * 1024 * 1024; // Setelah kompresi di client, 2 MB sudah sangat lega

export interface StoredReceiptMeta {
  id: string;
  path: string;
  transactionId: string | null;
  sizeBytes: number;
  mime: string;
  label: string;
  createdAt: string;
}

async function ensureBucket(admin: NonNullable<ReturnType<typeof createAdminClient>>) {
  const { data: buckets } = await admin.storage.listBuckets();
  if (buckets?.some((b) => b.id === BUCKET || b.name === BUCKET)) return;
  await admin.storage.createBucket(BUCKET, {
    public: false,
    fileSizeLimit: MAX_UPLOAD_BYTES,
    allowedMimeTypes: ['image/webp', 'image/jpeg', 'image/png', 'application/pdf'],
  });
}

function readReceiptsFromMeta(meta: Record<string, unknown>): StoredReceiptMeta[] {
  const raw = meta.receipts;
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (r): r is StoredReceiptMeta =>
      Boolean(r && typeof r === 'object' && typeof (r as StoredReceiptMeta).id === 'string')
  );
}

function todayKeyWib(): string {
  const now = new Date(Date.now() + 7 * 60 * 60 * 1000);
  return now.toISOString().slice(0, 10);
}

async function getUserQuotaContext(
  admin: NonNullable<ReturnType<typeof createAdminClient>>,
  userId: string
) {
  const [{ data: authRes }, { data: profile }] = await Promise.all([
    admin.auth.admin.getUserById(userId),
    admin.from('profiles').select('role').eq('id', userId).maybeSingle(),
  ]);
  const userMeta = (authRes?.user?.user_metadata ?? {}) as Record<string, unknown>;
  const isAdmin = profile?.role === 'admin';
  const status = resolveMembershipStatus(userMeta);
  const tier = isAdmin ? 'business' : status.effectiveTier;
  const quotaMb = getStorageQuotaMbForTier(tier);
  const quotaBytes = getStorageQuotaBytesForTier(tier);
  const aiDailyLimit = getDailyAiScanLimitForTier(tier);

  const receipts = readReceiptsFromMeta(userMeta);
  const usedBytes = receipts.reduce((s, r) => s + Math.max(0, Number(r.sizeBytes) || 0), 0);

  const dailyRaw = userMeta.ai_scan_daily as { date?: string; count?: number } | undefined;
  const aiUsedToday =
    dailyRaw && dailyRaw.date === todayKeyWib() ? Number(dailyRaw.count) || 0 : 0;

  return {
    userMeta,
    tier,
    isAdmin,
    receipts,
    usedBytes,
    quotaMb,
    quotaBytes,
    unlimited: quotaBytes === null,
    aiUsedToday,
    aiDailyLimit,
  };
}

/**
 * GET /api/receipts
 * - Tanpa param: daftar struk tersimpan + statistik kuota storage & AI harian.
 * - `?id=<receiptId>`: menghasilkan signed URL 1 jam untuk pratinjau / unduh struk.
 */
export async function GET(req: NextRequest) {
  const userId = await getCallerUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: 'Server config' }, { status: 500 });

  const ctx = await getUserQuotaContext(admin, userId);
  const receiptId = req.nextUrl.searchParams.get('id');

  if (receiptId) {
    const target = ctx.receipts.find((r) => r.id === receiptId);
    if (!target) {
      return NextResponse.json({ error: 'Struk tidak ditemukan.' }, { status: 404 });
    }
    const { data, error } = await admin.storage
      .from(BUCKET)
      .createSignedUrl(target.path, 3600);
    if (error || !data?.signedUrl) {
      return NextResponse.json(
        { error: error?.message || 'Gagal membuka struk.' },
        { status: 400 }
      );
    }
    return NextResponse.json({ receipt: target, signedUrl: data.signedUrl });
  }

  return NextResponse.json({
    items: ctx.receipts,
    usedBytes: ctx.usedBytes,
    quotaBytes: ctx.quotaBytes,
    quotaMb: ctx.quotaMb,
    unlimited: ctx.unlimited,
    tier: ctx.tier,
    aiUsedToday: ctx.aiUsedToday,
    aiDailyLimit: ctx.aiDailyLimit,
  });
}

/**
 * POST /api/receipts
 * Upload file struk (sudah dikompresi di client) ke Supabase Storage privat,
 * dengan pengecekan kuota storage sesuai tier (`maxGroups + 2 MB`, business = Unlimited).
 */
export async function POST(req: NextRequest) {
  const userId = await getCallerUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: 'Server config' }, { status: 500 });

  const formData = await req.formData().catch(() => null);
  if (!formData) return NextResponse.json({ error: 'FormData tidak valid.' }, { status: 400 });

  const file = formData.get('file') as File | null;
  const transactionIdRaw = formData.get('transactionId');
  const labelRaw = formData.get('label');
  const transactionId =
    typeof transactionIdRaw === 'string' && transactionIdRaw.trim()
      ? transactionIdRaw.trim()
      : null;
  const label =
    typeof labelRaw === 'string' && labelRaw.trim()
      ? labelRaw.trim().slice(0, 100)
      : file?.name?.slice(0, 100) || 'Struk';

  if (!file || file.size === 0) {
    return NextResponse.json({ error: 'File struk kosong.' }, { status: 400 });
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json(
      { error: 'Ukuran file terlalu besar setelah kompresi (maks. 2 MB per file).' },
      { status: 413 }
    );
  }

  const ctx = await getUserQuotaContext(admin, userId);
  if (ctx.quotaBytes !== null && ctx.usedBytes + file.size > ctx.quotaBytes) {
    const usedMb = (ctx.usedBytes / (1024 * 1024)).toFixed(2);
    return NextResponse.json(
      {
        error: `Kuota penyimpanan struk penuh (${usedMb} MB / ${ctx.quotaMb} MB). Hapus struk lama atau upgrade paket untuk ruang lebih besar.`,
        code: 'STORAGE_QUOTA_EXCEEDED',
        usedBytes: ctx.usedBytes,
        quotaBytes: ctx.quotaBytes,
        quotaMb: ctx.quotaMb,
      },
      { status: 403 }
    );
  }

  await ensureBucket(admin);

  const receiptId = crypto.randomUUID();
  const ext = file.type.includes('webp')
    ? 'webp'
    : file.type.includes('png')
      ? 'png'
      : file.type.includes('pdf')
        ? 'pdf'
        : 'jpg';
  const storagePath = `${userId}/${receiptId}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: uploadErr } = await admin.storage
    .from(BUCKET)
    .upload(storagePath, buffer, {
      contentType: file.type || 'image/webp',
      upsert: false,
    });
  if (uploadErr) {
    return NextResponse.json({ error: uploadErr.message }, { status: 400 });
  }

  const newMeta: StoredReceiptMeta = {
    id: receiptId,
    path: storagePath,
    transactionId,
    sizeBytes: buffer.length,
    mime: file.type || 'image/webp',
    label,
    createdAt: new Date().toISOString(),
  };

  const nextReceipts = [newMeta, ...ctx.receipts];
  const { error: metaErr } = await admin.auth.admin.updateUserById(userId, {
    user_metadata: {
      ...ctx.userMeta,
      receipts: nextReceipts,
    },
  });
  if (metaErr) {
    await admin.storage.from(BUCKET).remove([storagePath]);
    return NextResponse.json({ error: metaErr.message }, { status: 400 });
  }

  return NextResponse.json({
    receipt: newMeta,
    usedBytes: ctx.usedBytes + buffer.length,
    quotaBytes: ctx.quotaBytes,
    quotaMb: ctx.quotaMb,
  });
}

/**
 * PATCH /api/receipts
 * Menautkan struk yang baru diupload (mis. dari AI Scan) ke `transactionId` yang baru disimpan.
 */
export async function PATCH(req: NextRequest) {
  const userId = await getCallerUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: 'Server config' }, { status: 500 });

  const body = await req.json().catch(() => null);
  const receiptId = typeof body?.receiptId === 'string' ? body.receiptId : '';
  const transactionId = typeof body?.transactionId === 'string' ? body.transactionId : '';
  const label = typeof body?.label === 'string' ? body.label.trim().slice(0, 100) : '';

  if (!receiptId || !transactionId) {
    return NextResponse.json({ error: 'receiptId dan transactionId wajib diisi.' }, { status: 400 });
  }

  const ctx = await getUserQuotaContext(admin, userId);
  let found = false;
  const nextReceipts = ctx.receipts.map((r) => {
    if (r.id !== receiptId) return r;
    found = true;
    return { ...r, transactionId, label: label || r.label };
  });

  if (!found) {
    return NextResponse.json({ error: 'Struk tidak ditemukan.' }, { status: 404 });
  }

  const { error } = await admin.auth.admin.updateUserById(userId, {
    user_metadata: {
      ...ctx.userMeta,
      receipts: nextReceipts,
    },
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}

/**
 * DELETE /api/receipts
 * Hapus struk dari Supabase Storage & metadata user agar kuota storage langsung berkurang.
 */
export async function DELETE(req: NextRequest) {
  const userId = await getCallerUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: 'Server config' }, { status: 500 });

  const body = await req.json().catch(() => null);
  const receiptId = typeof body?.receiptId === 'string' ? body.receiptId : '';
  if (!receiptId) {
    return NextResponse.json({ error: 'receiptId wajib diisi.' }, { status: 400 });
  }

  const ctx = await getUserQuotaContext(admin, userId);
  const target = ctx.receipts.find((r) => r.id === receiptId);
  if (!target) {
    return NextResponse.json({ error: 'Struk tidak ditemukan.' }, { status: 404 });
  }

  await admin.storage.from(BUCKET).remove([target.path]);

  const nextReceipts = ctx.receipts.filter((r) => r.id !== receiptId);
  const { error } = await admin.auth.admin.updateUserById(userId, {
    user_metadata: {
      ...ctx.userMeta,
      receipts: nextReceipts,
    },
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const nextUsedBytes = nextReceipts.reduce((s, r) => s + Math.max(0, Number(r.sizeBytes) || 0), 0);
  return NextResponse.json({
    ok: true,
    usedBytes: nextUsedBytes,
    quotaBytes: ctx.quotaBytes,
  });
}
