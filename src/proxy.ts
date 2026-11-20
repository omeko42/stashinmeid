import createMiddleware from 'next-intl/middleware';
import { routing } from '@/i18n/routing';

export default createMiddleware(routing);

export const config = {
  // Skip path internal Next.js, API routes, dan file statis.
  // API wajib di-skip: kalau tidak, /api/scan-receipt akan di-redirect ke
  // /id/api/scan-receipt dan route-nya tidak ketemu.
  matcher: ['/((?!_next|_vercel|api|.*\\..*).*)'],
};
