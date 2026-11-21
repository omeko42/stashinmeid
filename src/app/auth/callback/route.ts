import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/';

  if (code) {
    const supabase = await createClient();
    if (supabase) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error) {
        // `next` datang dari query string yang bisa dimanipulasi user.
        // Hanya izinkan path internal - kalau tidak, attacker bisa
        // mengarahkan user ke domain lain lewat ?next=https://jahat.com
        const safeNext = next.startsWith('/') && !next.startsWith('//')
          ? next
          : '/';
        return NextResponse.redirect(`${origin}${safeNext}`);
      }
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
}
