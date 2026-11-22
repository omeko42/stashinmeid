# Panduan Handoff Koneksi API Pihak Ketiga — stashinmeid

Semua pengaturan API pihak ketiga dikelola langsung dari dalam aplikasi:
**Login sebagai Admin (`agungkrisdianto98@gmail.com` atau Superadmin) → Pengaturan → Koneksi API**.

Perubahan yang disimpan oleh Admin otomatis sinkron secara global ke seluruh aplikasi (termasuk checkout Membership & Webhook pembayaran).

---

## 1. Pembayaran Membership (Payment Gateway)

Pilih **salah satu** provider sesuai target pasarmu di **Pengaturan → Koneksi API → Pembayaran (Payment)**:

### A. Midtrans (Rekomendasi Indonesia: QRIS, VA, GoPay, ShopeePay — Rp 0/bln)
1. Daftar akun di [dashboard.midtrans.com](https://dashboard.midtrans.com) (bisa mulai dari mode **Sandbox** gratis).
2. Masuk ke **Settings → Access Keys**, salin:
   - **Client Key** → tempel ke kolom **Public / Client Key** di stashinmeid.
   - **Server Key** → tempel ke kolom **Secret / Server Key** di stashinmeid.
3. Masuk ke **Settings → Configuration → Payment Notification URL**, tempel:
   ```text
   https://stashinmeid.vercel.app/api/membership/webhook
   ```
4. Di stashinmeid, pilih Provider **Midtrans**, pilih Mode (**Sandbox** untuk tes / **Production** saat live), centang **Aktif**, lalu klik **Simpan**.
5. **Hasil**: Saat user klik Upgrade, link Snap Midtrans otomatis terbuat. Begitu lunas, webhook Midtrans otomatis mengaktifkan paket user & mengirim notifikasi ke Admin + User.

### B. Xendit (QRIS, Virtual Account, OVO, DANA — Rp 0/bln)
1. Daftar di [dashboard.xendit.co](https://dashboard.xendit.co).
2. Masuk ke **Settings → API Keys → Generate Secret Key** (beri izin `Invoices: Write`) → tempel ke **Secret / Server Key**.
3. Masuk ke **Settings → Webhooks → Invoices Paid**:
   - URL: `https://stashinmeid.vercel.app/api/membership/webhook`
   - Salin **Callback Verification Token** → tempel ke kolom **Webhook Secret** di stashinmeid.
4. Pilih Provider **Xendit**, centang **Aktif**, klik **Simpan**.

### C. Stripe (Rekomendasi Global USD: Kartu Kredit/Debit, Apple Pay, Google Pay)
1. Daftar di [dashboard.stripe.com](https://dashboard.stripe.com).
2. Masuk ke **Developers → API keys**:
   - **Publishable key** (`pk_test_...` / `pk_live_...`) → tempel ke **Public / Client Key**.
   - **Secret key** (`sk_test_...` / `sk_live_...`) → tempel ke **Secret / Server Key**.
3. Masuk ke **Developers → Webhooks → Add endpoint**:
   - Endpoint URL: `https://stashinmeid.vercel.app/api/membership/webhook`
   - Event: `checkout.session.completed`
   - Salin **Signing secret** (`whsec_...`) → tempel ke **Webhook Secret**.
4. Pilih Provider **Stripe Checkout (Global USD)**, centang **Aktif**, klik **Simpan**.

> **Catatan**: Sebelum kamu mengisi Secret Key di atas, checkout Membership tetap berjalan dalam mode **Konfirmasi Manual** — user bisa submit bukti transfer/referensi, pesanan masuk ke **Pengaturan → Membership → Pembayaran Masuk (Admin)**, dan kamu tinggal klik **Aktifkan Paket**.

---

## 2. Verifikasi Identitas (KYC)

Masuk ke **Pengaturan → Koneksi API → Verifikasi KYC**:

- **Didit.me (Gratis 500 verifikasi/bulan — rekomendasi tahap awal)**
  1. Daftar di [business.didit.me](https://business.didit.me).
  2. Buat aplikasi baru → salin **API Key** ke kolom **Secret Key** dan **Webhook Secret** ke kolom **Webhook Secret**.
  3. Klik **Tes Koneksi** → **Simpan**.
- **Verihubs (e-KTP Indonesia)**
  1. Daftar sandbox di [verihubs.com](https://verihubs.com).
  2. Salin **App ID** ke **Public Key** dan **API Key** ke **Secret Key**.

---

## 3. AI Pindai Struk & Notifikasi

Masuk ke **Pengaturan → Koneksi API → AI Struk & Notifikasi**:

- **Google Gemini (Pindai Struk AI — Free Tier)**
  1. Buka [aistudio.google.com/apikey](https://aistudio.google.com/apikey) → klik **Create API key**.
  2. Simpan key ke **Vercel → Project Settings → Environment Variables** dengan nama `GEMINI_API_KEY`, lalu redeploy (atau simpan juga di Koneksi API untuk pencatatan).
- **Telegram Bot (100% Gratis)**
  1. Chat `@BotFather` di Telegram → `/newbot` → salin **Bot Token** ke kolom **Secret Key**.
- **Resend Email (Gratis 3.000 email/bulan)**
  1. Daftar di [resend.com](https://resend.com) → buat API Key → tempel ke **Secret Key**.

---

## 4. Berita Pasar & Kurs Live

- **Sudah aktif otomatis 100% gratis tanpa API Key** menggunakan **CoinGecko Public API** (crypto), **Frankfurter FX API** (kurs valas), **CNBC Indonesia RSS**, **Antara News RSS**, dan **CoinTelegraph RSS**.
- Jika suatu saat ingin upgrade kuota tinggi, kamu bisa ganti preset ke **GNews.io** atau **Finnhub** di **Pengaturan → Koneksi API → Berita & Kurs Pasar**.

---

## Checklist Cepat Saat Mau Go-Live Berbayar
1. Pilih gateway pembayaran (Midtrans / Xendit untuk IDR atau Stripe untuk USD).
2. Tempel API Key & aktifkan di **Pengaturan → Koneksi API → Pembayaran**.
3. Daftarkan Webhook URL `https://stashinmeid.vercel.app/api/membership/webhook` di dashboard payment gateway.
4. Uji 1 kali di mode **Sandbox** (pastikan notifikasi & paket otomatis aktif), lalu ubah Mode ke **Production (Live)**.
