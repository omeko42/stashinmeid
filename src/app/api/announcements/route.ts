import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createAdminClient } from '@/lib/supabase/admin';
import { verifySuperadminToken } from '@/lib/jwt';
import { getOrCreateSuperadminUserId } from '@/lib/superadminUser';

/**
 * Pita pengumuman.
 *
 * GET    : pengumuman aktif (semua user login).
 * POST   : buat / ubah pengumuman (superadmin saja).
 * PATCH  : aktifkan / nonaktifkan (superadmin saja).
 * DELETE : hapus pengumuman (superadmin saja).
 *
 * Teksnya disimpan di database, jadi superadmin bisa mengubahnya tanpa
 * deploy ulang - itu sebabnya banner ini tidak lagi hardcoded di file
 * terjemahan.
 */

async function requireSuperadmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get('stashinme_session')?.value;
  return verifySuperadminToken(token);
}

export async function GET() {
  try {
    const admin = createAdminClient();
    if (!admin) {
      return NextResponse.json({ error: 'Server config' }, { status: 500 });
    }

    const { data, error } = await admin
      .from('announcements')
      .select('id, text, active, created_at')
      .eq('active', true)
      .order('created_at', { ascending: false })
      .limit(1);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    const latest = data?.[0] ?? null;
    return NextResponse.json({
      announcement: latest
        ? { id: latest.id, text: latest.text }
        : null,
    });
  } catch (err) {
    console.error('[stashinmeid] announcements GET error:', err);
    return NextResponse.json({ announcement: null }, { status: 200 });
  }
}

/** Buat pengumuman baru. Menggantikan yang aktif sebelumnya. */
export async function POST(req: NextRequest) {
  const session = await requireSuperadmin();
  if (!session) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: 'Server config' }, { status: 500 });
  }

  const body = await req.json().catch(() => null);
  const text = typeof body?.text === 'string' ? body.text.trim() : '';

  if (!text) {
    return NextResponse.json({ error: 'Teks pengumuman wajib diisi.' }, { status: 400 });
  }
  if (text.length > 500) {
    return NextResponse.json(
      { error: 'Maksimal 500 karakter.' },
      { status: 400 }
    );
  }

  // Hanya boleh ada satu pengumuman aktif. Nonaktifkan yang lama dulu.
  await admin
    .from('announcements')
    .update({ active: false, updated_at: new Date().toISOString() })
    .eq('active', true);

  const { data, error } = await admin
    .from('announcements')
    .insert({
      text,
      created_by: await getOrCreateSuperadminUserId(),
      active: true,
    })
    .select('id, text, active, created_at')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ announcement: data });
}

/** Aktifkan / nonaktifkan pengumuman berdasarkan id. */
export async function PATCH(req: NextRequest) {
  const session = await requireSuperadmin();
  if (!session) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: 'Server config' }, { status: 500 });
  }

  const body = await req.json().catch(() => null);
  const id = typeof body?.id === 'string' ? body.id : '';
  const active = body?.active === true;

  if (!id) {
    return NextResponse.json({ error: 'ID wajib diisi.' }, { status: 400 });
  }

  const { error } = await admin
    .from('announcements')
    .update({ active, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const session = await requireSuperadmin();
  if (!session) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: 'Server config' }, { status: 500 });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'ID wajib diisi.' }, { status: 400 });
  }

  const { error } = await admin.from('announcements').delete().eq('id', id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
