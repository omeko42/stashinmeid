/**
 * Konfigurasi Supabase publik - aman di-commit.
 *
 * Kenapa constant, bukan env var?
 * ------------------------------
 * `NEXT_PUBLIC_SUPABASE_URL` dan `NEXT_PUBLIC_SUPABASE_ANON_KEY` sama
 * sekali bukan rahasia - keduanya memang dikirim ke browser. Menaruhnya
 * di repo membuat konfigurasi ikut ter-deploy otomatis tanpa harus
 * menyetel environment variable di hosting tiap kali project Supabase
 * diganti.
 *
 * Yang tetap WAJIB ada di environment variable (tidak boleh di-commit):
 *   - SUPABASE_SERVICE_ROLE_KEY  : bypass RLS dan pengingat JWT. Jangan
 *                                   pernah masuk repo.
 *   - SUPERADMIN_PASSWORD(_HASH) : kredensial login superadmin.
 *   - JWT_SECRET                : kunci tanda tangan session.
 */

/** URL project Supabase. */
export const SUPABASE_URL = 'https://zykqeucsrldzvzxmyplq.supabase.co';

/**
 * Anon / publishable key.
 *
 * Aman dipublikasikan: key ini dibatasi oleh RLS, jadi user hanya bisa
 * membaca baris miliknya sendiri.
 */
export const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp5a3FldWNzcmxkenZ6eG15cGxxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTUyNDIxODAsImV4cCI6MjExMDgxODE4MH0.zlH9Inwq0x6n1VQP4Trplg6bSf2pnp214E1xMsjndnc';
