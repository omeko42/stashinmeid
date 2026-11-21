import { toast } from 'sonner';

/**
 * Ambil pesan error dari Supabase.
 *
 * Supabase tidak melempar exception saat query gagal - ia mengembalikan
 * `{ error }`. Kalau `{ error }` diabaikan, UI menampilkan "berhasil disimpan"
 * padahal data tidak pernah masuk database. Semua operasi tulis harus lewat
 * helper ini supaya kegagalan selalu kelihatan oleh user.
 */
export function dbErrorMessage(error: unknown, fallback: string): string {
  if (!error) return fallback;
  if (typeof error === 'string') return error;
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const msg = (error as { message?: unknown }).message;
    if (typeof msg === 'string' && msg.trim()) return msg;
  }
  return fallback;
}

/**
 * Tampilkan error database ke user.
 *
 * `fallback` dipakai kalau errornya kosong - supaya user tetap dapat
 * informasi actionable, bukan sekadar "unknown error".
 */
export function reportDbError(error: unknown, fallback: string): string {
  const message = dbErrorMessage(error, fallback);
  toast.error(message);
  return message;
}

/**
 * True kalau objek hasil query Supabase menunjukkan kegagalan.
 *
 * Menulis `if (error)` langsung itu rapuh: ada kalanya `error` bertipe
 * `null` falsy tapi `data` juga kosong, dan ada kalanya Result kosong tanpa
 * error karena operasi memang tidak mengubah baris. Helper ini menyamakan
 * cara pengecekan di seluruh aplikasi.
 */
export function isDbFailure(result: { error?: unknown } | null | undefined): boolean {
  return Boolean(result && result.error);
}
