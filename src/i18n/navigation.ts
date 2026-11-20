import { createNavigation } from 'next-intl/navigation';
import { routing } from './routing';

/**
 * Navigasi yang sadar locale. Selalu pakai ini alih-alih `next/navigation`
 * supaya perpindahan tab tetap mempertahankan bahasa yang aktif.
 */
export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
