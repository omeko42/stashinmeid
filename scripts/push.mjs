#!/usr/bin/env node
/**
 * Deploy lengkap dalam satu perintah:
 *   1. commit perubahan
 *   2. push ke GitHub (memicu auto-deploy Vercel)
 *   3. sinkronkan environment variable Vercel dari .env.local
 *
 * Jalankan dari komputer lu:
 *   node scripts/push.mjs
 *
 * Butuh VERCEL_TOKEN di .env.local (Vercel > Settings > Account > Tokens).
 * Kalau tokennya belum ada, langkah 3 dilewati dan env harus diset manual
 * (template nilainya ada di .env.vercel.example).
 */

import { spawnSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/** Jalankan perintah, stream output ke terminal. Return exit code. */
function run(cmd, args, opts = {}) {
  console.log(`$ ${cmd} ${args.join(' ')}`);
  const res = spawnSync(cmd, args, {
    cwd: ROOT,
    stdio: 'inherit',
    shell: process.platform === 'win32',
    ...opts,
  });
  return res.status === null ? 1 : res.status;
}

/** Baca file .env / .env.local jadi objek. */
function loadEnvFile(file) {
  if (!existsSync(file)) return {};
  const out = {};
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

function hasChanges() {
  const res = spawnSync('git', ['status', '--porcelain'], {
    cwd: ROOT,
    encoding: 'utf8',
    shell: process.platform === 'win32',
  });
  return (res.stdout || '').trim().length > 0;
}

/**
 * Pastikan tidak ada file rahasia yang ikut ter-commit.
 *
 * `git add -A` akan mengambil apa pun yang belum di-ignore. Kalau
 * `.gitignore` somehow rusak, `.env.local` (isi service role key dan
 * password superadmin) bisa ikut ter-commit dan bocor ke repo publik.
 * File yang offending dilepas dari index lalu commit tetap jalan - lebih
 * berguna daripada menggantung, dan rahasianya tetap tidak masuk commit.
 */
function unstageSecrets() {
  const res = spawnSync('git', ['diff', '--cached', '--name-only'], {
    cwd: ROOT,
    encoding: 'utf8',
    shell: process.platform === 'win32',
  });
  const staged = (res.stdout || '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  const forbidden = staged.filter(
    (f) =>
      /^\.env/.test(f) &&
      f !== '.env.example' &&
      f !== '.env.vercel.example'
  );

  if (!forbidden.length) return;

  console.log('   PERINGATAN: file ini tidak boleh di-commit, dilepas dari commit:');
  for (const f of forbidden) console.log('     - ' + f);
  console.log('   Isi .env.local memuat service role key dan password superadmin.');
  console.log('   Perbaiki .gitignore kalau ini terjadi terus-menerus.');
  console.log('');

  for (const f of forbidden) {
    const r = spawnSync('git', ['rm', '--cached', '-f', '--', f], {
      cwd: ROOT,
      encoding: 'utf8',
      shell: process.platform === 'win32',
    });
    if (r.status !== 0) {
      // Fallback untuk versi git lama.
      spawnSync('git', ['reset', '-q', 'HEAD', '--', f], {
        cwd: ROOT,
        encoding: 'utf8',
        shell: process.platform === 'win32',
      });
    }
  }
}

console.log('==> 1/3. Commit perubahan');
if (hasChanges()) {
  if (run('git', ['add', '-A']) !== 0) process.exit(1);
  unstageSecrets();
  if (run('git', ['commit', '-m', 'fix: perbarui dashboard dan koneksi database']) !== 0) {
    console.log('   commit dilewati (kemungkinan tidak ada yang bisa di-commit)');
  }
} else {
  console.log('   tidak ada perubahan, lewati');
}

console.log('');
console.log('==> 2/3. Push ke origin/main');
if (run('git', ['push', 'origin', 'main']) !== 0) {
  console.error('');
  console.error('Push gagal. Kalau diminta kredensial, masukkan username + token GitHub.');
  console.error('Token dibuat di: GitHub > Settings > Developer settings > Personal access tokens');
  console.error('Scopes yang cukup: repo');
  process.exit(1);
}

console.log('');
console.log('==> 3/3. Sinkronkan env Vercel');
const env = {
  ...loadEnvFile(join(ROOT, '.env')),
  ...loadEnvFile(join(ROOT, '.env.local')),
};
const token = process.env.VERCEL_TOKEN || env.VERCEL_TOKEN;

if (!token) {
  console.log('   VERCEL_TOKEN belum ada - env Vercel harus diset manual.');
  console.log('   Template nilainya ada di .env.vercel.example');
} else {
  const res = spawnSync('node', [join(ROOT, 'scripts', 'sync-vercel-env.mjs'), '--yes'], {
    cwd: ROOT,
    stdio: 'inherit',
    env: { ...process.env, VERCEL_TOKEN: token },
  });
  if (res.status !== 0) {
    console.log('');
    console.log('   Sync env gagal. Set manual di Vercel > Settings > Environment Variables:');
    console.log('     NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,');
    console.log('     SUPABASE_SERVICE_ROLE_KEY, SUPERADMIN_USERNAME,');
    console.log('     SUPERADMIN_PASSWORD_HASH (atau SUPERADMIN_PASSWORD), JWT_SECRET,');
    console.log('     NEXT_PUBLIC_TURNSTILE_SITE_KEY, TURNSTILE_SECRET_KEY');
  }
}

console.log('');
console.log('==> Selesai.');
console.log('   Kode sudah otomatis ter-deploy oleh push.');
console.log('   Redeploy sekali di Vercel (Deployments > Redeploy) supaya env baru dipakai.');
console.log('   Setelah itu buka https://stashinmeid.vercel.app');
