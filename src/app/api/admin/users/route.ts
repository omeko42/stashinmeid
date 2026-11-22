import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifySuperadminToken } from '@/lib/jwt';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

const VALID_ROLES = ['admin', 'user'] as const;

async function requireAdminOrSuperadmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get('stashinme_session')?.value;
  const superadmin = await verifySuperadminToken(token);
  if (superadmin) return { ok: true as const };

  const supabase = await createClient();
  if (!supabase) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const admin = createAdminClient();
  if (!admin) return null;
  const { data: profile } = await admin
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  if (profile?.role === 'admin') {
    return { ok: true as const };
  }
  return null;
}

export async function GET() {
  const session = await requireAdminOrSuperadmin();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json(
      {
        error: 'SUPABASE_SERVICE_ROLE_KEY belum diset di Environment Variables.',
        users: [],
      },
      { status: 200 }
    );
  }

  const { data, error } = await admin
    .from('profiles')
    .select('id, email, client_name, bio, role, created_at')
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message, users: [] }, { status: 500 });
  }

  return NextResponse.json({ users: data || [] });
}

export async function POST(req: NextRequest) {
  const session = await requireAdminOrSuperadmin();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json(
      { error: 'SUPABASE_SERVICE_ROLE_KEY belum diset.' },
      { status: 400 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const email = String(body.email || '').trim().toLowerCase();
  const password = String(body.password || '').trim();
  const client_name = String(body.client_name || '').trim() || email.split('@')[0] || 'Pengguna Baru';
  const bio = String(body.bio || '').trim();
  const role = VALID_ROLES.includes(body.role) ? body.role : 'user';

  if (!email || !email.includes('@')) {
    return NextResponse.json({ error: 'Alamat email tidak valid.' }, { status: 400 });
  }
  if (!password || password.length < 6) {
    return NextResponse.json(
      { error: 'Password awal minimal 6 karakter.' },
      { status: 400 }
    );
  }

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: client_name,
      client_name,
      bio,
      role,
    },
  });

  if (createErr || !created.user) {
    return NextResponse.json(
      { error: createErr?.message || 'Gagal membuat pengguna.' },
      { status: 500 }
    );
  }

  const userId = created.user.id;
  const { data: profile, error: profileErr } = await admin
    .from('profiles')
    .upsert(
      {
        id: userId,
        email,
        client_name,
        bio: bio || null,
        role,
      },
      { onConflict: 'id' }
    )
    .select('id, email, client_name, bio, role, created_at')
    .single();

  if (profileErr) {
    return NextResponse.json({ error: profileErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, user: profile });
}

export async function PATCH(req: NextRequest) {
  const session = await requireAdminOrSuperadmin();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json(
      { error: 'SUPABASE_SERVICE_ROLE_KEY belum diset.' },
      { status: 400 }
    );
  }

  const { userId, role, email, client_name, bio, password } = await req.json();
  if (!userId) {
    return NextResponse.json({ error: 'userId wajib diisi.' }, { status: 400 });
  }

  const authUpdates: { email?: string; email_confirm?: boolean; password?: string } = {};
  if (email) {
    authUpdates.email = email;
    authUpdates.email_confirm = true;
  }
  if (password && String(password).trim().length >= 6) {
    authUpdates.password = String(password).trim();
  }

  if (Object.keys(authUpdates).length > 0) {
    const { error: authErr } = await admin.auth.admin.updateUserById(userId, authUpdates);
    if (authErr) {
      return NextResponse.json({ error: authErr.message }, { status: 500 });
    }
  }

  const profileUpdates: Record<string, string | null> = {};
  if (role && VALID_ROLES.includes(role)) profileUpdates.role = role;
  if (email) profileUpdates.email = email;
  if (client_name) profileUpdates.client_name = client_name;
  if (typeof bio === 'string') profileUpdates.bio = bio.trim() || null;

  if (Object.keys(profileUpdates).length > 0) {
    const { error } = await admin.from('profiles').update(profileUpdates).eq('id', userId);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const session = await requireAdminOrSuperadmin();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json(
      { error: 'SUPABASE_SERVICE_ROLE_KEY belum diset.' },
      { status: 400 }
    );
  }

  const { userId } = await req.json();
  if (!userId) {
    return NextResponse.json({ error: 'userId wajib diisi.' }, { status: 400 });
  }

  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
