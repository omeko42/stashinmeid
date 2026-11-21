#!/usr/bin/env bash
#
# Push perubahan ke GitHub (otomatis memicu deploy Vercel).
#
# Sandbox tempat Claude bekerja tidak punya kredensial GitHub, jadi jalankan
# script ini dari komputer lu sendiri. It'll pakai credential helper / SSH
# key yang sudah ada di mesin lu.
#
# Pakai:  bash scripts/push.sh
#
set -euo pipefail

cd "$(dirname "$0")/.."

echo "==> Cek status"
git status --short
echo

echo "==> Commit (kalau ada perubahan)"
if ! git diff --quiet || ! git diff --cached --quiet; then
  git add -A
  git commit -m "fix: perbarui dashboard dan koneksi database"
else
  echo "   tidak ada perubahan, lewati"
fi
echo

echo "==> Push ke origin/main"
git push origin main
echo

echo "==> Selesai. Vercel akan otomatis deploy."
echo "   Setelah selesai, cek https://stashinmeid.vercel.app"
echo
echo "PENTING: pastikan env Vercel menunjuk project Supabase yang benar."
echo "  Setting > Environment Variables >Production:"
echo "    NEXT_PUBLIC_SUPABASE_URL        = https://<project>.supabase.co"
echo "    NEXT_PUBLIC_SUPABASE_ANON_KEY   = <anon key project itu>"
echo "    SUPABASE_SERVICE_ROLE_KEY        = <service role key project itu>"
echo "  Perubahan env butuh redeploy: Settings > Deployments > Redeploy"
