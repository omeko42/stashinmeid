# Setup Supabase & Cloudflare untuk Stashinmeid

Semua kode sisi aplikasi sudah selesai. Yang masih perlu dilakukan adalah
setting di dashboard Supabase dan Cloudflare. Ada **3 hal** yang harus
diset di dashboard sebelum fitur baru aktif di production:

| # | Fitur | Perlu diset di | Selesai? |
|---|-------|-----------------|----------|
| 1 | Skema database (tabel baru) | Supabase > SQL Editor | [ ] |
| 2 | Cloudflare Turnstile (captcha) | Cloudflare + Vercel env | [ ] |
| 3 | Google Sign-In & passkey | Google Cloud + Supabase | [ ] |

Instruksi Google & passkey ada di
[`SETUP_GOOGLE_PASSKEY.md`](./SETUP_GOOGLE_PASSKEY.md).

---

## 1. Jalankan migrasi SQL

Buka **Supabase Dashboard > SQL Editor > New query**, lalu jalankan file-file
berikut **sesuai urutan**. Semuanya ditulis idempotent (aman diulang), jadi
kalau salah urutan atau gagal di tengah, tinggal jalankan ulang.

Urutan penting: file yang lebih baru bisa bergantung pada tabel dari file
yang lebih lama.

```
supabase/migrations/2026-11-21_bootstrap_new_project.sql   <- fondasi
supabase/migrations/2026-11-22_connections_notifications.sql <- kolega + notifikasi
supabase/migrations/2026-11-22_oauth_profile_trigger.sql     <- trigger profil OAuth
supabase/migrations/2026-11-22_social_feed_chat.sql         <- feed + chat
supabase/migrations/2026-11-23_fix_missing_grants.sql       <- GRANT yang hilang
```

Atau, kalau project masih fresh, cukup jalankan dua file ini saja:

```
supabase/migrations/2026-11-21_bootstrap_new_project.sql
supabase/migrations/2026-11-23_fix_missing_grants.sql
```

Bootstrap sudah memuat tabel `user_connections`, `notifications`,
`notification_preferences`, `announcements`, dan
`account_deletion_audit`, beserta RLS, policy, GRANT, dan helper
`create_notification()`.

### Cara cek berhasil

Jalankan query ini di SQL Editor:

```sql
select
  table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in (
    'user_connections', 'notifications', 'notification_preferences',
    'announcements', 'account_deletion_audit'
  )
order by table_name;
```

Harus mengembalikan 5 baris.

Lalu cek helper notifikasi:

```sql
select proname
from pg_proc
where proname = 'create_notification';
```

Kalau ada 1 baris, berarti helper-nya ada dan preferensi notifikasi akan
dihormati.

---

## 2. Cloudflare Turnstile (captcha login)

Captcha "klik sekali" - satu klik buat user, tapi bot harus lewat
Cloudflare dulu.

### 2.1 Buat widget di Cloudflare

1. Buka <https://dash.cloudflare.com/> > **Turnstile** > **Add widget**.
2. **Widget name**: `stashinmeid`.
3. **Widget mode**: pilih **Managed** (otomatis).
4. **Hostname**: tambahkan domain produksi dan preview:
   - `stashinmeid.vercel.app`
   - `localhost`
5. Klik **Create**. Muncul dua nilai:
   - **Site Key** (publik, aman ditaruh di kode)
   - **Secret Key** (rahasia, hanya di env server)

### 2.2 Masukkan ke Vercel

**Vercel > Project > Settings > Environment Variables**, tambahkan untuk
Production, Preview, dan Development:

| Nama | Nilai |
|------|-------|
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Site Key dari Cloudflare |
| `TURNSTILE_SECRET_KEY` | Secret Key dari Cloudflare |

Lalu **Deploy ulang** - `NEXT_PUBLIC_*` di-inline saat build, jadi
perubahan env tidak terpakai kalau tidak rebuild.

### 2.3 Kalau env-nya belum diset

Aplikasi tetap jalan normal, captcha dilewati. Ini praktis untuk
localhost. Di production sebaiknya selalu diset - tanpa itu, login
superadmin tidak punya lapisan kedua.

### 2.4 Yang dilindungi

| Jalur | Cara verifikasi captcha |
|-------|--------------------------|
| Login Supabase (email/password) | Token dikirim ke GoTrue via `options.captchaToken` |
| Signup Supabase | Idem |
| Login superadmin (username) | `POST /api/auth/captcha` dulu, baru `/api/auth/superadmin` |

Login superadmin dicek captcha-nya manual karena jalur ini tidak lewat
Supabase Auth.

---

## 3. Environment variables yang perlu ada di Vercel

Cek daftar lengkap di `.env.vercel.example`. Yang wajib:

| Nama | Keterangan |
|------|------------|
| `NEXT_PUBLIC_SUPABASE_URL` | URL project Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Anon key (publik) |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key - **rahasia**, bypass RLS |
| `JWT_SECRET` | Minimal 32 karakter, untuk token superadmin |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Dari Cloudflare (lihat di atas) |
| `TURNSTILE_SECRET_KEY` | Dari Cloudflare (lihat di atas) |

Opsional:

| Nama | Keterangan |
|------|------------|
| `SUPERADMIN_USERNAME` | Username untuk login superadmin |
| `SUPERADMIN_PASSWORD` | Password-nya (atau pakai `SUPERADMIN_PASSWORD_HASH`) |
| `SUPERADMIN_EMAIL` | Email superadmin, default dari username |
| `GEMINI_API_KEY` | Fitur pindai struk AI |
| `NEXT_PUBLIC_SITE_URL` | Default `https://stashinmeid.vercel.app` |

> `SUPERADMIN_PASSWORD_HASH` lebih aman daripada password polos.
> Generate dengan `npm run hash-password -- "passwordmu"`.

---

## 4. Melupa password

Sudah ada di kode - tombol **"Lupa Password?"** di halaman login, dan
halaman `reset-password` untuk membuat password baru. Yang perlu
dikonfigurasi di sisi Supabase:

**Supabase > Authentication > Email Templates > Reset Password**:

```
Redirect URL: {{ .SiteURL }}/reset-password
```

Dan pastikan di **Authentication > URL Configuration > Redirect URLs** ada:

```
https://stashinmeid.vercel.app/reset-password
http://localhost:3000/reset-password
```

Kalau `SiteURL` di template tidak diisi, link resetnya akan mengarah ke
domain yang salah dan user akan melihat halaman error.

---

## 5. Menjalankan migrasi di production

Kalau ada environment database lain (mis. development), migrasi yang sama
harus dijalankan di sana juga - SQL di repo ini memang idempotent, jadi
aman untuk development, staging, dan production.

Urutan yang aman: ** Development -> Staging -> Production**, supaya
kamu bisa cek dulu sebelum kena data asli.

---

## 6. Verifikasi akhir

Checklist sebelum production:

- [ ] Kelima tabel baru ada (query di bagian 1.1)
- [ ] `create_notification()` ada (query di bagian 1.2)
- [ ] Captcha muncul di halaman login (kalau env Turnstile sudah diset)
- [ ] "Daftar dengan Google" dan "Login dengan Passkey" berfungsi
- [ ] Tombol "Lupa Password?" mengirim email
- [ ] Pita pengumuman bisa diterbitkan dari Pengaturan (login sebagai superadmin)
- [ ] Notifikasi muncul setelah ada yang kirim permintaan koneksi
- [ ] Zona Berbahaya bisa mengunduh data
- [ ] Pengaturan > Notifikasi bisa mematikan satu jenis notifikasi

---

## 7. Kalau ada masalah

**Captcha tidak muncul di production**
`NEXT_PUBLIC_TURNSTILE_SITE_KEY` diset tapi tidak di-rebuild. Deploy ulang.

**"Invalid domain" dari Turnstile**
Domain di widget Cloudflare tidak cocok dengan domain yang diakses. Tambahkan
domain preview juga kalau Vercel preview deploy dipakai.

**Google login: `redirect_uri_mismatch`**
URL di Google Cloud Console harus persis sama dengan yang di Supabase,
termasuk `https://` dan tanpa slash di akhir.

**Google login: `access_denied`**
Scope `email` dan `profile` belum ditambahkan di OAuth consent screen.

**Passkey: `SecurityError`**
RP ID di Supabase harus sama dengan domain tempat halaman diakses.

**Notifikasi tidak muncul**
Cek dua hal:
1. `create_notification()` ada di database (query di 1.2)
2. Preferensi tipe notifikasi itu tidak dimatikan di Pengaturan

**Tidak bisa login superadmin**
Cek `JWT_SECRET` minimal 32 karakter dan `SUPERADMIN_USERNAME` +
`SUPERADMIN_PASSWORD` (atau `_HASH`) sudah di-set.
