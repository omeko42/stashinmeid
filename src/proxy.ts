import createMiddleware from 'next-intl/middleware';
import { routing } from '@/i18n/routing';

export default createMiddleware(routing);

export const config = {
  // Skip path internal Next.js, API routes, auth callback, dan file statis.
  // API & auth wajib di-skip: kalau tidak, /api/scan-receipt atau /auth/callback
  // akan di-redirect ke /id/... dan route-nya tidak ketemu.
  matcher: ['/((?!_next|_vercel|api|auth|.*\\..*).*)'],
};
