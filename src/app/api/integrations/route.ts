import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createAdminClient } from '@/lib/supabase/admin';
import { getCallerUserId } from '@/lib/currentUser';
import { verifySuperadminToken } from '@/lib/jwt';
import { getOrCreateSuperadminUserId } from '@/lib/superadminUser';
import {
  DEFAULT_API_INTEGRATIONS,
  mergeIntegrations,
  type SingleIntegrationConfig,
} from '@/lib/integrations';

async function isCallerAdmin(
  admin: NonNullable<ReturnType<typeof createAdminClient>>,
  userId: string
): Promise<boolean> {
  const cookieStore = await cookies();
  const token = cookieStore.get('stashinme_session')?.value;
  if (await verifySuperadminToken(token)) return true;

  const { data } = await admin
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .maybeSingle();
  return data?.role === 'admin';
}

export async function GET() {
  const userId = await getCallerUserId();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({
      integrations: DEFAULT_API_INTEGRATIONS,
      updatedAt: null,
    });
  }

  const callerIsAdmin = await isCallerAdmin(admin, userId);
  const superId = callerIsAdmin ? await getOrCreateSuperadminUserId() : null;

  // Admin membaca konfigurasi global dari akun admin utama (fallback ke akun sendiri)
  const [{ data: selfData }, globalRes] = await Promise.all([
    admin.auth.admin.getUserById(userId),
    superId && superId !== userId
      ? admin.auth.admin.getUserById(superId)
      : Promise.resolve({ data: null }),
  ]);

  const selfMeta = (selfData?.user?.user_metadata ?? {}) as Record<
    string,
    unknown
  >;
  const globalMeta = (globalRes?.data?.user?.user_metadata ?? {}) as Record<
    string,
    unknown
  >;

  const rawConfig =
    (callerIsAdmin && globalMeta.api_integrations) || selfMeta.api_integrations;
  const updatedAt =
    (callerIsAdmin &&
      typeof globalMeta.api_integrations_updated_at === 'string' &&
      globalMeta.api_integrations_updated_at) ||
    (typeof selfMeta.api_integrations_updated_at === 'string'
      ? selfMeta.api_integrations_updated_at
      : null);

  return NextResponse.json({
    integrations: mergeIntegrations(rawConfig),
    updatedAt,
    isAdmin: callerIsAdmin,
  });
}

export async function POST(req: NextRequest) {
  const userId = await getCallerUserId();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const action = body.action || 'save';

  if (action === 'test') {
    const category = String(body.category || '');
    const config = body.config as Partial<SingleIntegrationConfig> | undefined;
    const baseUrl = String(config?.baseUrl || '').trim();

    if (!baseUrl || !/^https?:\/\//i.test(baseUrl)) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Endpoint Base URL wajib diawali https:// atau http://',
        },
        { status: 400 }
      );
    }

    const start = Date.now();
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4500);
      const headers: Record<string, string> = {
        Accept: 'application/json',
      };
      if (config?.publicKey) {
        headers['X-API-Key'] = config.publicKey;
      }
      const res = await fetch(baseUrl, {
        method: 'GET',
        headers,
        signal: controller.signal,
      }).catch(() => null);
      clearTimeout(timeout);

      const latencyMs = Math.max(18, Date.now() - start);
      const reachable = res !== null;

      return NextResponse.json({
        ok: reachable,
        category,
        latencyMs,
        httpStatus: res?.status ?? 0,
        message: reachable
          ? `Endpoint ${config?.provider || category} merespons (${latencyMs} ms, HTTP ${res?.status}).`
          : `Endpoint tidak dapat dijangkau atau timeout setelah ${latencyMs} ms.`,
      });
    } catch (e) {
      return NextResponse.json(
        {
          ok: false,
          error:
            e instanceof Error ? e.message : 'Gagal menghubungi endpoint API.',
        },
        { status: 500 }
      );
    }
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json(
      { error: 'SUPABASE_SERVICE_ROLE_KEY belum dikonfigurasi.' },
      { status: 400 }
    );
  }

  const callerIsAdmin = await isCallerAdmin(admin, userId);
  const { data: current } = await admin.auth.admin.getUserById(userId);
  const existingMeta = (current?.user?.user_metadata ?? {}) as Record<
    string,
    unknown
  >;

  const merged = mergeIntegrations(body.integrations);
  const now = new Date().toISOString();

  const { error: updateErr } = await admin.auth.admin.updateUserById(userId, {
    user_metadata: {
      ...existingMeta,
      api_integrations: merged,
      api_integrations_updated_at: now,
    },
  });

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  // Sinkronkan juga ke akun global primaryAdmin supaya pembayaran membership & KYC
  // yang diatur oleh Admin (mis. agungkrisdianto98@gmail.com) langsung aktif app-wide!
  if (callerIsAdmin) {
    const superId = await getOrCreateSuperadminUserId();
    if (superId && superId !== userId) {
      const { data: superAuth } = await admin.auth.admin.getUserById(superId);
      const superMeta = (superAuth?.user?.user_metadata ?? {}) as Record<
        string,
        unknown
      >;
      await admin.auth.admin.updateUserById(superId, {
        user_metadata: {
          ...superMeta,
          api_integrations: merged,
          api_integrations_updated_at: now,
        },
      });
    }
  }

  return NextResponse.json({
    ok: true,
    integrations: merged,
    updatedAt: now,
  });
}
