#!/usr/bin/env node
/**
 * Sinkronkan environment variable Vercel dari project Supabase.
 *
 * Kenapa perlu
 * ------------
 * Ganti project Supabase = ganti URL, anon key, DAN service role key.
 * Kalau tiga-tiganya harus diset manual di dashboard Vercel, satu
 * penggantian project jadi pekerjaan berulang yang rawan salah.
 *
 * Script ini mengambil ketiga nilai dari Supabase lalu menuliskannya ke
 * Vercel, jadi satu perintah sudah cukup.
 *
 * Yang dibutuhkan
 * ----------------
 *   - SUPABASE_ACCESS_TOKEN  : token personal Vercel
 *                             (Vercel > Settings > Account > Tokens)
 *   - SUPABASE_PROJECT_REF   : ref project Supabase (mis. zykqeucsrldzvzxmyplq)
 *   - SUPABASE_SERVICE_ROLE_KEY : service role key project tersebut
 *
 * Cara pakai
 * ----------
 *   node scripts/sync-vercel-env.mjs
 *   node scripts/sync-vercel-env.mjs --project stashinmeid --yes
 *
 * Tanpa --yes, script hanya menampilkan rencana dan tidak mengubah apa pun.
 */

import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

function parseArgs(argv) {
  const args = { yes: false, project: null, env: 'production' };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--yes' || a === '-y') args.yes = true;
    else if (a === '--project') args.project = argv[++i];
    else if (a === '--env') args.env = argv[++i];
  }
  return args;
}

/** Ambil nilai dari environment, atau dari file .env/.env.local. */
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

function resolveConfig(args) {
  const fileEnv = {
    ...loadEnvFile(join(ROOT, '.env')),
    ...loadEnvFile(join(ROOT, '.env.local')),
  };
  const pick = (key) => process.env[key] || fileEnv[key] || '';

  const projectRef = pick('SUPABASE_PROJECT_REF') || pick('NEXT_PUBLIC_SUPABASE_URL')
    .replace(/^https?:\/\//, '')
    .split('.')[0];

  return {
    vercelToken: pick('VERCEL_TOKEN') || pick('SUPABASE_ACCESS_TOKEN'),
    projectRef,
    serviceRoleKey: pick('SUPABASE_SERVICE_ROLE_KEY'),
    anonKey: pick('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
    url: pick('NEXT_PUBLIC_SUPABASE_URL') || (projectRef ? `https://${projectRef}.supabase.co` : ''),
    superadminUser: pick('SUPERADMIN_USERNAME'),
    superadminPass: pick('SUPERADMIN_PASSWORD'),
    jwtSecret: pick('JWT_SECRET'),
    project: args.project,
    env: args.env,
    yes: args.yes,
  };
}

async function vercelApi(token, path, method = 'GET') {
  const res = await fetch(`https://api.vercel.com${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }
  if (!res.ok) {
    const detail = json?.error?.message || json?.raw || res.statusText;
    throw new Error(`Vercel API ${res.status} pada ${path}: ${detail}`);
  }
  return json;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const cfg = resolveConfig(args);

  const missing = [];
  if (!cfg.vercelToken) missing.push('VERCEL_TOKEN (atau SUPABASE_ACCESS_TOKEN)');
  if (!cfg.projectRef) missing.push('SUPABASE_PROJECT_REF');
  if (!cfg.serviceRoleKey) missing.push('SUPABASE_SERVICE_ROLE_KEY');

  if (missing.length) {
    console.error('Config belum lengkap. Yang kurang:');
    for (const m of missing) console.error('  - ' + m);
    console.error('\nIsi di .env.local (jangan di-commit) atau pass sebagai env var.');
    process.exit(1);
  }

  console.log('Supabase project :', cfg.projectRef);
  console.log('Supabase URL     :', cfg.url);
  console.log('Vercel env      :', cfg.env);
  console.log('');

  // Cari project Vercel.
  const projects = await vercelApi(
    cfg.vercelToken,
    `/v9/projects?limit=100&teamId=${encodeURIComponent(process.env.VERCEL_TEAM_ID || '')}`
  );
  const list = Array.isArray(projects?.projects) ? projects.projects : [];
  const wanted = cfg.project
    ? list.filter((p) => p.name === cfg.project)
    : list.filter((p) => p.name === 'stashinmeid');

  if (wanted.length === 0) {
    console.error(
      `Project Vercel tidak ditemukan${cfg.project ? `: ${cfg.project}` : ': stashinmeid'}.`
    );
    console.error('Project yang tersedia:', list.map((p) => p.name).join(', ') || '(kosong)');
    process.exit(1);
  }

  const project = wanted[0];
  console.log('Project Vercel   :', project.name, `(${project.id})`);
  console.log('');

  const variables = [
    { key: 'NEXT_PUBLIC_SUPABASE_URL', value: cfg.url, type: 'plain' },
    { key: 'NEXT_PUBLIC_SUPABASE_ANON_KEY', value: cfg.anonKey, type: 'plain' },
    { key: 'SUPABASE_SERVICE_ROLE_KEY', value: cfg.serviceRoleKey, type: 'secret' },
  ];
  if (cfg.superadminUser) {
    variables.push({ key: 'SUPERADMIN_USERNAME', value: cfg.superadminUser, type: 'secret' });
  }
  if (cfg.superadminPass) {
    variables.push({ key: 'SUPERADMIN_PASSWORD', value: cfg.superadminPass, type: 'secret' });
  }
  if (cfg.jwtSecret) {
    variables.push({ key: 'JWT_SECRET', value: cfg.jwtSecret, type: 'secret' });
  }

  console.log('Variable yang akan ditulis:');
  for (const v of variables) {
    console.log(`  ${v.key.padEnd(30)} type=${v.type.padEnd(7)} ${v.value ? '(terisi)' : '(KOSONG - skip)'}`);
  }
  console.log('');

  if (!cfg.yes) {
    console.log('Mode dry-run. Jalankan ulang dengan --yes untuk benar-benar menulis.');
    process.exit(0);
  }

  // Tulis per variable: hapus yang lama (biar tipe secret/plain ikut baru),
  // lalu create ulang.
  const existing = await vercelApi(
    cfg.vercelToken,
    `/v10/projects/${project.id}/env?decrypt=false`
  );
  const existingVars = Array.isArray(existing?.envs) ? existing.envs : [];

  for (const v of variables) {
    if (!v.value) continue;

    const same = existingVars.find((e) => e.key === v.key);
    if (same) {
      await vercelApi(
        cfg.vercelToken,
        `/v9/projects/${project.id}/env/${same.id}`,
        'DELETE'
      );
    }

    await vercelApi(
      cfg.vercelToken,
      `/v10/projects/${project.id}/env`,
      'POST',
      {
        key: v.key,
        value: v.value,
        type: v.type,
        target: [cfg.env],
      }
    );
    console.log('  ditulis:', v.key);
  }

  console.log('');
  console.log('Selesai. Redeploy project di Vercel agar env baru dipakai.');
}

main().catch((err) => {
  console.error('Gagal:', err.message);
  process.exit(1);
});
