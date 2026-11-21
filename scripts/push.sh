#!/usr/bin/env bash
#
# Satu perintah untuk deploy lengkap:
#   1. commit perubahan
#   2. push ke GitHub (memicu Vercel auto-deploy)
#   3. sinkronkan environment variable Vercel dari .env.local
#
# Jalankan dari komputer lu:
#   bash scripts/push.sh
#
# Butuh VERCEL_TOKEN di .env.local (Vercel > Settings > Account > Tokens).
# Kalau tokennya belum ada, script tetap jalan untuk commit + push, dan
# melewati langkah sync env.
#
set -euo pipefail

cd "$(dirname "$0")/.."

echo "==> 1/3. Commit perubahan"
if ! git diff --quiet || ! git diff --cached --quiet; then
  git add -A
  git commit -m "fix: perbarui dashboard dan koneksi database"
  echo "   commit dibuat"
else
  echo "   tidak ada perubahan, lewati"
fi

echo
echo "==> 2/3. Push ke origin/main"
git push origin main

echo
echo "==> 3/3. Sinkronkan env Vercel"
if node scripts/sync-vercel-env.mjs --yes; then
  echo
  echo "==> Selesai."
  echo "   Env Vercel sudah diperbarui. Redeploy di Vercel (Deployments > Redeploy)"
  echo "   supaya env baru dipakai. Kode sudah otomatis ter-deploy oleh push."
else
  echo
  echo "==> Env Vercel BELUM tersinkron (lihat pesan di atas)."
  echo "   Set manual di Vercel > Settings > Environment Variables:"
  echo "     NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,"
  echo "     SUPABASE_SERVICE_ROLE_KEY, SUPERADMIN_USERNAME,"
  echo "     SUPERADMIN_PASSWORD, JWT_SECRET"
  echo "   Template lengkap ada di .env.vercel.example"
fi
