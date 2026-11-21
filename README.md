# stashinmeid

Aplikasi manajemen keuangan pribadi - Next.js, TypeScript, Supabase.

## Setup dari nol

### 1. Database

Buat project Supabase baru, lalu jalankan **satu file** ini di SQL Editor
(Supabase > SQL Editor > New query):

```
supabase/migrations/2026-11-21_bootstrap_new_project.sql
```

File itu sudah berisi seluruh skema (profil, transaksi, pinjaman, pagu
anggaran, dompet, kurs, KYC, kolega, storage, sosial), RLS + policy, role
`admin`/`user`, dan semua GRANT yang dibutuhkan.

Aman dijalankan ulang: setiap `CREATE POLICY` didahului `DROP POLICY IF
EXISTS`, jadi kalau gagal di tengah dan dijalankan lagi, sisanya tetap
terisi.

Kalau tabelnya sudah ada dan cuma hak akses yang hilang, jalankan yang lebih
kecil:

```
supabase/migrations/2026-11-23_fix_missing_grants.sql
```

Untuk memastikan semuanya beres, jalankan query read-only:

```
supabase/verify_grants.sql
```

### 2. Environment variable

Salin `.env.example` jadi `.env.local` dan isi. Yang wajib:

| Variable | Keterangan |
| --- | --- |
| `SUPABASE_SERVICE_ROLE_KEY` | Bypass RLS. **Jangan pernah di-commit.** |
| `SUPERADMIN_USERNAME` | Username login superadmin (tanpa `@`). |
| `SUPERADMIN_PASSWORD` | Password superadmin (atau pakai `_HASH`). |
| `JWT_SECRET` | Kunci session, minimal 32 karakter. |
| `VERCEL_TOKEN` | Token personal Vercel, untuk auto-sync env. |

`NEXT_PUBLIC_SUPABASE_URL` dan `NEXT_PUBLIC_SUPABASE_ANON_KEY` **tidak perlu
diset** - nilainya sudah ada di `src/lib/supabase/project.ts`. Keduanya bukan
rahasia (memang dikirim ke browser), jadi aman di-commit dan otomatis ikut
deploy. Env var tetap dipakai sebagai override kalau lu punya project lain.

### 3. Deploy

```bash
bash scripts/push.sh
```

Script itu commit, push ke GitHub (Vercel auto-deploy), lalu menyinkronkan
environment variable Vercel dari `.env.local`. Setelah itu redeploy sekali di
Vercel supaya env baru terpakai.

Kalau `VERCEL_TOKEN` belum diisi, langkah sync env dilewati dan env harus diset
manual. Template nilainya ada di `.env.vercel.example`.

## Command

```bash
npm run dev              # server pengembangan
npm run build            # build production
npm run lint             # eslint
npm run typecheck        # tsc --noEmit
npm run hash-password -- "password"   # hash untuk SUPERADMIN_PASSWORD_HASH
npm run sync:vercel-env  # sinkron env Vercel (dry-run tanpa --yes)
```

## Catatan arsitektur

Tiga aturan yang dijaga di codebase ini:

**Semua operasi tulis ke database mengecek error.** Supabase tidak melempar
exception, ia mengembalikan `{ error }`. Kalau tidak dicek, baris hilang dari
database tapi user tetap melihat toast "berhasil disimpan". Semua titik tulis
sudah diaudit dan dicek.

**Superadmin punya jalur data sendiri.** Superadmin (dan mode impersonate)
tidak punya sesi Supabase milik user target, jadi datanya dibaca dan ditulis
lewat `/api/superadmin/finance` yang memakai service role. Hook `useAssets` dan
`useBudgets` otomatis memakai jalur itu kalau `isSuperadmin` aktif.

**Tanggal dikunci ke zona waktu aplikasi** (`Asia/Jakarta`). Server berjalan di
UTC, browser pengguna di WIB. Kalau render memakai zona waktu lokal mesin,
HTML server dan browser berbeda dan memicu hydration mismatch (React #418).
Semua tanggal lewat `Intl.DateTimeFormat` dengan `timeZone` eksplisit.
