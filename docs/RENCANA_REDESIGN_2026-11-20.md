# Rencana Redesign stashinmeid

Tanggal: 2026-11-20
Status: MENUNGGU PERSETUJUAN - belum ada kode diubah.
Rujukan: `docs/AUDIT_UI_2026-11-20.md`

---

## 1. Keputusan user (2026-11-20)

- Tema: **dua tema, light dan dark**, bisa dipilih user.
- Scope: **full rewrite struktur** (pecah monolit + redesign semua tab).
- Fitur baru: PWA installable, Command palette (Ctrl+K), Budget per kategori, Toggle gelap/terang, plus rekomendasi dari PM.
- Dependensi: boleh tambah, **wajib diaudit keamanan repo dulu**.

---

## 2. Arah desain: "Buku Kas Presisi"

Subjeknya bukan startup generik - ini pencatat uang pribadi berbahasa Indonesia:
saldo, masuk, keluar, cicilan, jatuh tempo. Referensi visualnya buku kas /
passbook: baris beraturan, kolom angka rata kanan, tanggal dicap, saldo berjalan.

Yang diambil: **disiplin ledger** (garis pemisah, angka tabular, alignment ketat).
Yang ditolak: kartu rounded seragam, label ALL-CAPS ber-tracking lebar, gradien
sebagai dekorasi - ini persis pola yang bikin app terasa template.

### Prinsip

1. Angka adalah pahlawan. Semua rupiah pakai monospace, tabular, rata kanan.
2. Garis, bukan kotak. Kartu hanya untuk benda yang benar-benar terpisah
   (modal, sheet AI scan, PIN). Sisanya dipisah garis 1px.
3. Dua tema, satu token. Tidak ada hex hardcoded di komponen - semua lewat
   variabel CSS.
4. Motion menjawab aksi. Count-up saat data berubah, baris masuk, toast.
   Tidak ada animasi ambien yang jalan sendiri.
5. Kosong = ajakan. Setiap empty state punya tombol aksi utama.

### Warna

DARK (ink)

| Token | Nilai | Pakai |
|---|---|---|
| `--bg` | `#0C1013` | latar halaman (bukan hitam murni, bukan zinc) |
| `--surface-1` | `#12171B` | panel utama |
| `--surface-2` | `#171E23` | baris alternatif, input |
| `--line` | `#26313A` | garis pemisah |
| `--text` | `#E8EEF1` | teks utama |
| `--text-muted` | `#8A9AA5` | teks sekunder |
| `--brand` | `#22C58B` | jade - tombol utama, nav aktif, inflow |
| `--out` | `#F0656B` | coral lembut - outflow |
| `--due` | `#E8A33D` | amber - jatuh tempo dekat |
| `--info` | `#5B8DEF` | fitur AI scan, dipakai hemat |

LIGHT (paper)

| Token | Nilai | Pakai |
|---|---|---|
| `--bg` | `#F5F7F6` | latar halaman (putih kehijauan tipis, bukan krem) |
| `--surface-1` | `#FFFFFF` | panel |
| `--surface-2` | `#EDF1EF` | baris alternatif, input |
| `--line` | `#DDE4E1` | garis pemisah |
| `--text` | `#101614` | teks utama |
| `--text-muted` | `#5E6B66` | teks sekunder |
| `--brand` | `#0E9F6E` | jade lebih pekat agar kontras AA di light |
| `--out` | `#D64550` | outflow |
| `--due` | `#B4740B` | jatuh tempo |
| `--info` | `#2563EB` | AI scan |

### Tipografi

Dua keluarga saja, keduanya sudah ada di repo (tidak tambah dependensi):

- **Geist Sans** - UI, judul, label. Ini yang selama ini mati karena
  `globals.css` memaksa Arial (P0-1).
- **Geist Mono** - SEMUA angka: saldo, rupiah, tanggal, nomor kontrak,
  persentase. `font-variant-numeric: tabular-nums`.

Skala: 11 / 13 / 15 / 18 / 24 / 34 / 56. Hero saldo memakai 56px mono,
`letter-spacing: -0.03em`. Tidak ada label ALL-CAPS ber-tracking lebar -
label memakai berat 500, ukuran 11-13px, warna muted.

### Layout desktop

```
+----------+-----------------------------------------------------+
| logo     | Periode [Minggu|Bulan|Tahun]            [+ Catat]    |
|          |                                                     |
| Overview |  SALDO BERJALAN                        ~sparkline~  |
| Cashflow |  Rp 12.480.000                                       |
| Debt     |  -------------------------------------------        |
| Tools    |  Masuk            Keluar            Sisa            |
| Users    |  +10.000.000      -3.520.000        6.480.000        |
|          |  -------------------------------------------        |
|          |  [ tren masuk/keluar - 8 kolom ]  [ jatuh tempo ]   |
|          |  -------------------------------------------        |
|          |  LEDGER                                              |
|          |  tgl | keterangan | kategori |    masuk  |  keluar  |
| profile  |  ...                                                |
+----------+-----------------------------------------------------+
```

Hero balance bukan kartu gradien - ia pita full-width dengan garis bawah,
dua kolom debit/kredit dipisah garis vertikal tipis. Ini yang bikin
"angka adalah pahlawan" kelihatan, bukan sekadar teks besar di kartu.

### Layout mobile

Bottom nav 5 item + FAB di tengah, tab Profile masuk nav (sekarang tersembunyi
di header). Hero menumpuk: saldo dulu, lalu dua kolom masuk/keluar.

---

## 3. Audit dependensi (KAMUS_AMAN bagian 6)

Diverifikasi 2026-11-20 lewat `registry.npmjs.org/<pkg>/latest` + GitHub API.

| Paket | Versi | Lisensi | Bintang | Fork | Archived | Push terakhir | Lifecycle script | Putusan |
|---|---|---|---|---|---|---|---|---|
| `sonner` | 2.0.8 | MIT | 13.241 | 474 | tidak | 2026-08-10 | tidak ada pre/postinstall | AMAN |
| `next-themes` | 0.4.6 | MIT | 6.353 | 254 | tidak | 2026-02-25 | tidak ada pre/postinstall | AMAN |
| `clsx` | 2.1.1 | MIT | 9.847 | 190 | tidak | 2024-06-10 | tidak ada pre/postinstall | AMAN |
| `tailwind-merge` | 3.7.1 | MIT | 5.707 | 116 | tidak | 2026-11-20 | tidak ada pre/postinstall | AMAN, ada attestasi SLSA provenance |

Pemeriksaan merah yang tidak ditemukan pada keempatnya: fork tanpa perubahan,
repo umur < 30 hari, `curl|bash` di installer, `postinstall` menarik skrip
remote, binary di dalam repo, README hanya berisi link.

Catatan `tailwind-merge` 3.7.1: publish via trusted publisher GitHub Actions
dengan provenance SLSA - justru lebih baik dari publish manual.

Command palette ditulis sendiri (bukan `cmdk`) supaya tidak menambah paket
lagi. Toast dan token tema memakai `sonner` dan `next-themes`.

---

## 4. Struktur file hasil rewrite

```
src/
  app/
    layout.tsx              # lang="id", metadata, ThemeProvider, Toaster
    globals.css             # token warna light+dark, focus-visible, reduced-motion
    manifest.ts             # PWA
    page.tsx                # tetap loader server-side, tidak berubah logic
  components/
    ui/                     # Card, Panel, Rule, Stat, Button, Field, Modal,
                            # EmptyState, Skeleton, Toast, Segmented
    shell/                  # Sidebar, MobileHeader, BottomNav, CommandPalette,
                            # ThemeToggle, QuickAddSheet, PinLockOverlay
    tabs/                   # Overview, Cashflow, Debts, Tools, Profile, Users
    charts/                 # CashflowChart (periode), DebtDonut (persen), Sparkline
  hooks/                    # useDashboardData, useCountUp, useHotkey
  lib/                      # format.ts, categories.ts, budget.ts (baru)
  types/finance.ts          # + Budget
```

`DashboardClient.tsx` 2.253 baris dilepas perannya jadi pemilik state saja,
atau dipecah sepenuhnya. Logic data-fetch di `page.tsx` tidak disentuh.

---

## 5. Batch eksekusi

### Batch 0 - Fondasi (P0)
`.gitattributes`, `lang="id"`, token warna + perbaikan font Arial,
`focus-visible`, `prefers-reduced-motion`, `manifest` + `theme-color`,
metadata OG, hilangkan FOUC.

### Batch 1 - Sistem desain + shell
`next-themes` (gelap/terang), `sonner` (toast), `clsx` + `tailwind-merge`,
primitives `ui/`, pecah shell, skeleton loading, `focus-visible` per komponen.

### Batch 2 - Redesign enam tab
Overview (hero ledger + sparkline + jatuh tempo), Cashflow (tabel ledger,
filter periode/kategori, sort), Debts (progress tenor, simulasi), Tools,
Profile, Users. Empty state + CTA di tiap tab.

### Batch 3 - Fitur baru
PWA installable, Command palette (Ctrl+K), Budget per kategori (butuh tabel
baru di Supabase), Export CSV, Undo hapus 5 detik, kontrol periode chart.

### Batch 4 - Verifikasi
`npm run lint`, `npm run build`, cek kedua tema di mobile + desktop.

---

## 6. Rekomendasi tambahan dari PM

Masuk Batch 3 karena murah dan langsung terasa:

- **Export CSV** - import CSV sudah ada, export belum. Celah janggal.
- **Undo hapus 5 detik** - sekarang hapus transaksi langsung hilang tanpa konfirmasi.
- **Skeleton loading** - sekarang hanya logo memantul.
- **Kontrol periode chart** (Minggu/Bulan/Tahun) - sekarang semua transaksi
  dicampur jadi satu grafik, tidak bisa dibaca.

Tunda ke batch terpisah (butuh keputusan + migrasi DB):
- **Transaksi berulang** (gaji/tagihan tetap tiap bulan).

---

## 7. Peringatan di luar UI

Banner Supabase di dashboard: organisasi melebihi kuota pada siklus tagihan
sebelumnya, dan **project akan dibatasi mulai 27 November 2026** kalau kuota
belum lunas. Itu 7 hari dari sekarang. Kalau kena, seluruh data transaksi dan
debt tidak bisa diakses - redesign sekalipun tidak akan menolong.
Perlu dicek di billing Supabase.

---

## 8. Status

- [x] Audit UI
- [x] Audit keamanan dependensi
- [x] Rencana desain disusun
- [x] Persetujuan user
- [x] Batch 0
- [x] Batch 1
- [x] Batch 2
- [x] Batch 3
- [x] Batch 4 verifikasi (2026-11-21: lint 0 error, build sukses, push ke origin/main)

Sisa manual: cek visual kedua tema di mobile + desktop. Catatan: migrasi
`supabase/migrations/2026-11-20_profiles-bio_update-policy_budgets.sql`
perlu dijalankan di Supabase, dan cek billing Supabase (lihat bagian 7).
