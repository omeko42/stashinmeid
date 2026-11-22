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

Ada dua kondisi, dan bedanya penting:

| Kondisi | Yang terjadi |
|---------|--------------|
| **Dua-duanya belum diset** | Aplikasi jalan normal, captcha dilewati. Praktis untuk localhost. |
| **Site key diset, secret key belum** | **Semua login gagal** dengan pesan "Verifikasi captcha gagal." |

Jadi kalau captcha tiba-tiba tidak bisa dipakai, cek dulu apakah
`TURNSTILE_SECRET_KEY` ikut ter-set. Keduanya harus diisi bareng.

> Jangan commit nilai aslinya ke repo. Site key aman untuk ditulis di
> dokumentasi, tapi **secret key tidak boleh** - simpan di Vercel saja.

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
| `SUPERADMIN_USERNAME` | Username untuk login superadmin |
| `SUPERADMIN_PASSWORD_HASH` | Hash password superadmin (lihat catatan di bawah) |

Opsional:

| Nama | Keterangan |
|------|------------|
| `SUPERADMIN_PASSWORD` | Password polos - **hanya kalau** hash tidak dipakai |
| `SUPERADMIN_EMAIL` | Email superadmin, default dari username |
| `GEMINI_API_KEY` | Fitur pindai struk AI |
| `NEXT_PUBLIC_SITE_URL` | Default `https://stashinmeid.vercel.app` |

### Cara paling cepat: pakai `npm run push`

Kalau `VERCEL_TOKEN` ada di `.env.local`, satu perintah ini commit,
push, **dan** menyalin semua env di atas ke Vercel sekaligus:

```powershell
npm run push
```

Token dibuat di **Vercel > Settings > Account > Tokens**. Tanpa token,
script hanya commit dan push - env Vercel harus diset manual.

> **Penting:** `NEXT_PUBLIC_*` di-inline saat build. Jadi kalau env
> berubah, project Vercel harus di-**redeploy** (Deployments > Redeploy)
> supaya nilainya terpakai. `npm run push` tidak otomatis redeploy.

> `SUPERADMIN_PASSWORD_HASH` lebih aman daripada password polos.
> Generate dengan `npm run hash-password -- "passwordmu"`.
>
> **Hash itu opsional.** Pilih salah satu:
>
> | Cara | Env var | Catatan |
> |------|---------|---------|
> | Hash (disarankan) | `SUPERADMIN_PASSWORD_HASH` | Nilai dari `npm run hash-password` |
> | Password polos | `SUPERADMIN_PASSWORD` | Langsung isi, tanpa hashing |
>
> Kalau keduanya ter-set, **hash yang dipakai** dan `_PASSWORD` diabaikan.
>
> `npm run hash-password` mensyaratkan password **minimal 12 karakter**.
> Kalau password lu lebih pendek, pakai saja mode password polos - itu
> tetap jalan, hanya perlu diisi di Vercel.
>
> Password ini terpisah dari password akun user di aplikasi. Login
> superadmin lewat form login dengan **username** (tanpa `@`), bukan
> email.

---

## 4. Melupa password

Sudah ada di kode - tombol **"Lupa Password?"** di halaman login, dan
halaman `reset-password` untuk membuat password baru. Yang perlu
dikonfigurasi di sisi Supabase:

### 4.1 URL Configuration

**Supabase > Authentication > URL Configuration**:

- **Site URL**: `https://stashinmeid.vercel.app`
- **Redirect URLs** - tambahkan satu per baris:
  - `https://stashinmeid.vercel.app/reset-password`
  - `http://localhost:3000/reset-password`

Kalau mau otomatis mencakup semua path preview deployment, pakai wildcard:
`https://stashinmeid-*.vercel.app/reset-password`.

### 4.2 Template email

**Supabase > Authentication > Emails > Templates > Reset password**.

> **Jangan edit template ini.** Template bawaan Supabase sudah pakai
> `{{ .ConfirmationURL }}`, yang otomatis membawa `redirectTo` dari
> aplikasi. Mengeditnya butuh custom SMTP, dan kalau salah, link resetnya
> mengarah ke domain yang salah sehingga user lihat halaman error.

Kalau nanti mau customize tampilan email (misal bahasa Indonesia), barulah
set up custom SMTP di tab **SMTP Settings**, lalu template bisa diedit.

### 4.3 Tes

1. Di halaman login, isi email lalu klik **Lupa Password?**
2. Cek inbox (dan folder spam) - email titled "Reset your password"
3. Klik linknya - harus mendarat di halaman **Buat Password Baru**
4. Kalau muncul "redirect URL not allowed", berarti URL di 4.1 belum lengkap

---

## 5. Menjalankan migrasi di production

### Kalau cuma punya satu database (kasus lu)

Kalau project Supabase lu cuma satu, tidak ada "migrasi production" yang
perlu dijalankan terpisah. **Migrasi = copy-paste file SQL ke SQL Editor
project itu sendiri**, sekali saja.

Artinya:

- SQL Editor > New query > isi isi file > Run
- Ulangi untuk file berikutnya, sesuai urutan di bagian 1

Kalau file `2026-11-21_bootstrap_new_project.sql` dan
`2026-11-23_fix_missing_grants.sql` sudah pernah dijalankan, database
production lu **sudah siap**. Yang tersisa cuma:

1. `2026-11-22_connections_notifications.sql` - tabel kolega & notifikasi
2. `2026-11-22_oauth_profile_trigger.sql` - trigger profil untuk Google OAuth
3. `2026-11-22_social_feed_chat.sql` - feed & chat (kalau belum)

Cek pakai query di bagian 1.1 - kalau 5 baris keluar, sudah beres.

### Kalau punya beberapa database

Biasanya ada **development**, **staging**, dan **production**. Kalau memang
punya, jalankan file SQL yang sama di semuanya, urutan
**Development -> Staging -> Production**, supaya bisa dicek dulu sebelum
kena data asli.

Semua file migrasi di repo ini ditulis idempotent (aman diulang), jadi
kena error di tengah tidak merusak apa yang sudah jadi - tinggal jalankan
ulang.

### Kalau nanti nambah file baru

Setiap kali ada file baru di `supabase/migrations/`, salin ke SQL Editor
project yang dipakai aplikasi, lalu jalankan. Kalau lupa, fitur baru bakal
error dengan "relation does not exist" atau "permission denied".

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
