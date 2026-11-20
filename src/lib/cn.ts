import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Gabungkan class Tailwind dengan benar: class terakhir yang bertentangan
 * menang. Tanpa ini, override warna di prop caller selalu kalah oleh default.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
