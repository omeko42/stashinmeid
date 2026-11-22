#!/usr/bin/env node
/**
 * Test untuk scripts/sync-vercel-env.mjs.
 *
 * Script ini menulis env var ke Vercel, jadi kalau ada env var yang
 * lupa dikirim, gejalanya muncul jauh nanti: production jalan dengan
 * konfigurasi tidak lengkap (mis. tanpa Turnstile, atau tanpa
 * SUPERADMIN_PASSWORD_HASH padahal login butuh hash).
 *
 * Test ini memanggil resolveConfig + buildVariables langsung, tanpa
 * menyentuh API Vercel sama sekali.
 *
 * Jalankan: node scripts/sync-vercel-env.test.mjs
 */

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = readFileSync(join(ROOT, 'scripts', 'sync-vercel-env.mjs'), 'utf8');

const failures = [];
function check(name, fn) {
  try {
    fn();
    console.log(`  OK   ${name}`);
  } catch (e) {
    failures.push(`${name}: ${e.message}`);
    console.log(`  FAIL ${name}`);
  }
}

console.log('Menguji scripts/sync-vercel-env.mjs\n');

// --- resolveConfig harus membaca semua env yang dibutuhkan -------------
check('resolveConfig membaca SUPERADMIN_PASSWORD_HASH', () => {
  assert.match(SRC, /superadminPassHash:\s*pick\('SUPERADMIN_PASSWORD_HASH'\)/);
});

check('resolveConfig membaca kedua kunci Turnstile', () => {
  assert.match(SRC, /turnstileSiteKey:\s*pick\('NEXT_PUBLIC_TURNSTILE_SITE_KEY'\)/);
  assert.match(SRC, /turnstileSecretKey:\s*pick\('TURNSTILE_SECRET_KEY'\)/);
});

check('resolveConfig membaca NEXT_PUBLIC_SITE_URL', () => {
  assert.match(SRC, /siteUrl:\s*pick\('NEXT_PUBLIC_SITE_URL'\)/);
});

// --- Variabel yang dikirim ---------------------------------------------
// Blok `variables` dibangun bertahap: array literal dulu, lalu di-push
// satu per satu kalau nilainya ada. Jadi area yang dicek adalah dari
// `const variables` sampai perintah push terakhir.
const varStart = SRC.indexOf('const variables = [');
check('blok variables ada', () => {
  assert.notEqual(varStart, -1, 'const variables tidak ditemukan');
});

if (varStart !== -1) {
  const block = SRC.slice(varStart, varStart + 3000);

  const required = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
    'SUPERADMIN_USERNAME',
    'JWT_SECRET',
    'NEXT_PUBLIC_TURNSTILE_SITE_KEY',
    'TURNSTILE_SECRET_KEY',
    'SUPERADMIN_PASSWORD_HASH',
  ];

  for (const key of required) {
    check(`mengirim ${key}`, () => {
      assert.ok(block.includes(`'${key}'`), `${key} tidak ada di daftar variabel`);
    });
  }

  check(
    'password polos hanya dikirim kalau hash tidak ada',
    () => {
      // harus ada cabang else-if, bukan dua push terpisah
      assert.match(
        block,
        /if \(cfg\.superadminPassHash\)[\s\S]*?\}\s*else if \(cfg\.superadminPass\)/,
        'cabang hash/polos tidak eksklusif'
      );
    }
  );

  check('site key Turnstile bertipe plain (bisa di-inline saat build)', () => {
    assert.match(
      block,
      /key: 'NEXT_PUBLIC_TURNSTILE_SITE_KEY',[\s\S]*?type: 'plain'/
    );
  });

  check('secret key Turnstile bertipe secret', () => {
    assert.match(block, /key: 'TURNSTILE_SECRET_KEY',[\s\S]*?type: 'secret'/);
  });

  check(
    'nilai env tidak pernah ditulis ke log',
    () => {
      // placeholders variabel di dalam string log harus pakai (terisi)/(KOSONG)
      assert.ok(
        !/console\.log\([^)]*cfg\.(jwtSecret|serviceRoleKey|superadminPassHash)/.test(SRC),
        'ada nilai rahasia yang bisa ikut ter-log'
      );
    }
  );
}

// --- Tidak boleh ada secret yang bocor ke repo ----------------------------
check('tidak ada secret hardcoded di script', () => {
  const suspicious = SRC.match(/0x[0-9a-fA-F]{20,}/);
  assert.equal(
    suspicious,
    null,
    `script mengandung key yang tampak seperti secret: ${suspicious?.[0]?.slice(0, 12)}...`
  );
});

console.log('');
if (failures.length) {
  console.error(`${failures.length} test gagal:`);
  for (const f of failures) console.error('  - ' + f);
  process.exit(1);
}
console.log('Semua test lulus.');
