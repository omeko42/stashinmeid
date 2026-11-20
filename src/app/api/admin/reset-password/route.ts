import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifySuperadminToken } from '@/lib/jwt';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const token = cookieStore.get('stashinme_session')?.value;
  const session = await verifySuperadminToken(token);

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json(
      { error: 'SUPABASE_SERVICE_ROLE_KEY belum diset di Vercel.' },
      { status: 400 }
    );
  }

  const { email } = await req.json();
  if (!email) {
    return NextResponse.json({ error: 'Email user wajib diisi.' }, { status: 400 });
  }

  const origin = req.headers.get('origin') || 'https://stashinmeid.vercel.app';
  const { error } = await admin.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/reset-password`,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, message: `Link reset password dikirim ke ${email}` });
}
