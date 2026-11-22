import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getCallerUserId } from '@/lib/currentUser';
import {
  DEFAULT_API_INTEGRATIONS,
  mergeIntegrations,
  type SingleIntegrationConfig,
} from '@/lib/integrations';

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

  const { data, error } = await admin.auth.admin.getUserById(userId);
  if (error || !data?.user) {
    return NextResponse.json({
      integrations: DEFAULT_API_INTEGRATIONS,
      updatedAt: null,
    });
  }

  const meta = (data.user.user_metadata ?? {}) as Record<string, unknown>;
  return NextResponse.json({
    integrations: mergeIntegrations(meta.api_integrations),
    updatedAt:
      typeof meta.api_integrations_updated_at === 'string'
        ? meta.api_integrations_updated_at
        : null,
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

  return NextResponse.json({
    ok: true,
    integrations: merged,
    updatedAt: now,
  });
}
