# Setup Google Sign-In & Passkey

Dokumen ini berisi langkah setting Supabase yang perlu dilakukan **sekali**
oleh whoever punya akses ke dashboard Supabase project
`zykqeucsrldzvzxmyplq`.

Kode sudah terpasang di aplikasi. Yang belum adalah sisi dashboard Supabase
dan Google Cloud Console - dua-duanya butuh login ke akun yang punya.

---

## 1. Google Sign-In

### 1.1 Buat credentials di Google Cloud Console

1. Buka <https://console.cloud.google.com/>.
2. Pastikan project Google yang benar aktif (pojok kiri atas).
3. Menu **APIs & Services** > **OAuth consent screen**.
   - Pilih tipe **External** (pakai **Internal** kalau ini hanya untuk
     tim internal).
   - Isi nama aplikasi (mis. `stashinmeid`), email support, dan developer
     contact email.
   - **Tambahkan scope**: minimal `email` dan `profile`. Kalau tidak ada
     scope, tombol Google akan menolak login dengan error
     `access_denied`.
4. Menu **APIs & Services** > **Credentials**.
   - Klik **Create Credentials** > **OAuth client ID**.
   - Application type: **Web application**.
   - Name: `stashinmeid web`.
   - **Authorized JavaScript origins**:
     - `https://stashinmeid.vercel.app`
     - `http://localhost:3000` (untuk pengembangan)
   - **Authorized redirect URIs**:
     - `https://stashinmeid.vercel.app/auth/callback`
     - `http://localhost:3000/auth/callback`
   - Klik **Create**. Catat **Client ID** dan **Client Secret**.

> Penting: domain redirect harus **persis sama** dengan yang diisi di
> Supabase, termasuk `https://` dan tanpa slash di akhir.

### 1.2 Hubungkan ke Supabase

1. Supabase Dashboard > **Authentication** > **Providers** > **Google**.
2. Isi:
   - **Google Client ID**: Client ID dari langkah 1.1
   - **Google Client Secret**: Client Secret dari langkah 1.1
3. Klik **Save**.
4. Di bagian **Redirect URLs**, pastikan ada:
   - `https://stashinmeid.vercel.app/auth/callback`
   - `http://localhost:3000/auth/callback`
5. Buka **URL Configuration** > **Site URL**: `https://stashinmeid.vercel.app`.

### 1.3 Soal daftar lewat Google

Tombol **Daftar dengan Google** di halaman signup memakai
`signInWithOAuth` yang sama dengan tombol login. Supabase otomatis
membuat akun kalau email-nya belum terdaftar, lalu trigger
`handle_new_user()` membuat baris `profiles` seperti pendaftaran biasa.

Jadi **tidak perlu** konfigurasi tambahan untuk signup via Google. Yang
perlu dijaga: di Supabase, opsi **"Allow users to sign up"** harus aktif
(itu default-nya).

Kalau user menolak share email ke aplikasi, Google akan mengembalikan
email `null`. Supabase menanganinya dengan membuat email sintetis -
akun tetap bisa dipakai, tapi tidak bisa pakai fitur lupa password.

---

## 2. Passkey (WebAuthn)

### 2.1 Aktifkan di Supabase

1. Supabase Dashboard > **Authentication** > **Providers** > **WebAuthn**.
2. Centang **Enable WebAuthn**.
3. Biarkan **RP ID** kosong - Supabase akan memakai domain project
   (`zykqeucsrldzvzxmyplq.supabase.co`) sebagai default.

   > Kalau nanti deploy di domain sendiri (bukan `*.vercel.app`), isi RP ID
   > dengan domain itu sendiri (tanpa `https://`, tanpa path).
   > RP ID harus cocok dengan domain tempat halaman diakses, kalau tidak
   > browser akan menolak dengan error `SecurityError`.
4. Centang **Enable Passkey Enrollment** kalau tersedia di versi dashboard
   yang dipakai.

### 2.2 Syarat di sisi aplikasi

Semua sudah terpenuhi di kode:

- `src/app/[locale]/login/page.tsx` memanggil `supabase.auth.signInWithPasskey()`.
- `src/components/profile/PasskeyManager.tsx` memanggil
  `supabase.auth.registerPasskey()` dan
  `supabase.auth.passkey.delete({ passkeyId })`.
- `@supabase/supabase-js` sudah di versi `2.119.2`, yang punya API passkey.

### 2.3 Syarat di sisi browser

- Browser harus mendukung WebAuthn: Chrome 67+, Edge 79+, Safari 16+,
  Firefox 60+.
- Halaman harus diakses lewat **HTTPS**, atau `http://localhost` saat
  pengembangan.
- Passkey disimpan di platform password manager (iCloud Keychain,
  Google Password Manager, Windows Hello, 1Password, Bitwarden).

### 2.4 Kalau passkey tidak bisa dipakai

| Gejala | Penyebab | Solusi |
|---|---|---|
| "Browser ini belum mendukung passkey" | `window.PublicKeyCredential` tidak ada | Browser terlalu tua, atau tidak di HTTPS |
| `SecurityError` saat daftar | RP ID tidak cocok domain | Set RP ID di Supabase = domain akses |
| `NotAllowedError` | Ceremony dibatalkan / timeout | Ulangi, dan pastikan tidak ada dialog lain yang terbuka |
| Passkey tidak muncul di daftar | Enrollment gagal diam-diam | Cek console browser untuk pesan Supabase |

---

## 3. Checklist cepat

- [ ] OAuth consent screen di Google Cloud Console sudah diisi dan scope
      `email` + `profile` sudah ditambahkan
- [ ] Authorized JavaScript origins + redirect URIs sudah diisi, persis
      sama dengan domain produksi
- [ ] Provider Google di Supabase sudah diisi Client ID + Secret
- [ ] Redirect URL `/auth/callback` terdaftar di Supabase
- [ ] Provider WebAuthn di Supabase sudah diaktifkan
- [ ] Sudah diuji signup via Google dengan email baru
- [ ] Sudah diuji login passkey di perangkat kedua (mis. HP)

---

## 4. Kalau deployed di domain lain

Semua URL di atas perlu diganti. Daftar tempat yang menyebut domain:

- `src/app/[locale]/login/page.tsx` - `redirectTo` memakai
  `window.location.origin`, jadi otomatis ikut.
- `src/app/auth/callback/route.ts` - cek redirect di dalam file ini.
- Supabase Dashboard > Authentication > URL Configuration > Site URL dan
  Redirect URLs.
- Google Cloud Console > OAuth client > origins dan redirect URIs.
- Supabase > WebAuthn > RP ID.
