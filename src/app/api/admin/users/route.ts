import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifySuperadminToken } from '@/lib/jwt';
import { createAdminClient } from '@/lib/supabase/admin';

async function requireSuperadmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get('stashinme_session')?.value;
  return verifySuperadminToken(token);
}

export async function GET() {
  const session = await requireSuperadmin();
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
    .select('id, email, client_name, role, created_at')
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message, users: [] }, { status: 500 });
  }

  return NextResponse.json({ users: data || [] });
}

const VALID_ROLES = ['admin', 'user'];

export async function PATCH(req: NextRequest) {
  const session = await requireSuperadmin();
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

  const { userId, role, email, client_name } = await req.json();
  if (!userId) {
    return NextResponse.json({ error: 'userId wajib diisi.' }, { status: 400 });
  }

  if (email) {
    const { error: authErr } = await admin.auth.admin.updateUserById(userId, {
      email,
      email_confirm: true,
    });
    if (authErr) {
      return NextResponse.json({ error: authErr.message }, { status: 500 });
    }
  }

  // Hanya kolom yang boleh diubah. `id` dan `created_at` sengaja tidak ada di
  // daftar - kalau ikut berubah, primary key bisa diganti dan baris lama
  // kehilangan kepemilikan.
  const profileUpdates: Record<string, string> = {};
  if (role && VALID_ROLES.includes(role)) profileUpdates.role = role;
  if (email) profileUpdates.email = email;
  if (client_name) profileUpdates.client_name = client_name;

  if (Object.keys(profileUpdates).length > 0) {
    const { error } = await admin.from('profiles').update(profileUpdates).eq('id', userId);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const session = await requireSuperadmin();
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
