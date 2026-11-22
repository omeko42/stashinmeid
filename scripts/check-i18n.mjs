#!/usr/bin/env node
/**
 * Cek key terjemahan.
 *
 * Dua-duanya penting karena keduanya bisa bikin halaman crash total:
 *
 * 1. Paritas id/en - key yang ada di satu bahasa tapi tidak di yang lain
 *    bikin `t()` melempar error saat render.
 * 2. Key dinamis - pola `t('prefix.' + nilai)`ZE means key-nya cuma
 *   ketahuan saat runtime. Kalau salah satu nilainya belum punya
 *   terjemahan, next-intl melempar error dan seluruh halaman jadi
 *    "This page couldn't load".
 *
 * Jalankan: node scripts/check-i18n.mjs
 * Exit code 0 kalau aman, 1 kalau ada masalah.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const LOCALES = ['id', 'en'];

/** Semua file .ts/.tsx di src/. */
function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(tsx?|mjs)$/.test(entry)) out.push(full);
  }
  return out;
}

/** Ambil nilai di path titik. Null kalau tidak ada. */
function get(obj, path) {
  let cur = obj;
  for (const part of path.split('.')) {
    if (cur === null || typeof cur !== 'object' || !(part in cur)) return null;
    cur = cur[part];
  }
  return cur;
}

/** Semua path daun (key) dari sebuah objek pesan. */
function leafPaths(obj, prefix = '') {
  const out = [];
  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      out.push(...leafPaths(value, path));
    } else {
      out.push(path);
    }
  }
  return out;
}

const messages = {};
for (const locale of LOCALES) {
  messages[locale] = JSON.parse(
    readFileSync(join(ROOT, 'src', 'messages', `${locale}.json`), 'utf8')
  );
}

const problems = [];

// --- 1. Paritas antar bahasa -------------------------------------------
const idKeys = new Set(leafPaths(messages.id));
const enKeys = new Set(leafPaths(messages.en));

for (const key of idKeys) {
  if (!enKeys.has(key)) problems.push(`[paritas] key ada di id tapi tidak di en: ${key}`);
}
for (const key of enKeys) {
  if (!idKeys.has(key)) problems.push(`[paritas] key ada di en tapi tidak di id: ${key}`);
}

// --- 2. Key dinamis ------------------------------------------------------
// Pola: t('prefix.' + x) atau t(`prefix.${x}`)
const dynamicRe = /\bt\(\s*(['"`])([^'"`]*?)\1\s*\+/g;
const templateRe = /\bt\(\s*`([^`]*?)\$\{[^}]*\}([^`]*?)`/g;
// Namespace aktif: `const t = useTranslations('some.ns')`
const nsAssignRe = /\bt\s*=\s*useTranslations\(\s*(['"])([^'"]+)\1/g;

/**
 * Namespace yang dipakai oleh panggilan `t` di baris tertentu.
 *
 * `useTranslations` biasanya dipanggil sekali per komponen, jadi
 * namespace terakhir yang muncul sebelum baris itu adalah yang dipakai.
 */
function namespaceAt(src, index) {
  let last = null;
  for (const m of src.matchAll(nsAssignRe)) {
    if (m.index === undefined || m.index > index) break;
    last = m[2];
  }
  return last;
}

const files = walk(join(ROOT, 'src'));
for (const file of files) {
  const rel = file.slice(ROOT.length + 1);
  const src = readFileSync(file, 'utf8');

  const dynamicCalls = [
    ...[...src.matchAll(dynamicRe)].map((m) => ({
      index: m.index,
      prefix: m[2],
      suffix: '',
    })),
    ...[...src.matchAll(templateRe)].map((m) => ({
      index: m.index,
      prefix: m[1],
      suffix: m[2] ?? '',
    })),
  ];

  for (const call of dynamicCalls) {
    if (!call.prefix) continue;
    const ns = namespaceAt(src, call.index);

    for (const locale of LOCALES) {
      // Path lengkap: namespace + prefix
      const base = ns ? `${ns}.${call.prefix}` : call.prefix;
      const parentPath = base.replace(/\.$/, '');

      const parent = get(messages[locale], parentPath);
      if (!parent || typeof parent !== 'object') {
        problems.push(
          `[dinamis] ${rel}: prefix "${parentPath}" tidak ada di ${locale}.json`
        );
        continue;
      }

      for (const child of Object.keys(parent)) {
        const path = `${base}${child}${call.suffix}`;
        for (const l of LOCALES) {
          if (get(messages[l], path) === null) {
            problems.push(`[dinamis] ${rel}: "${path}" hilang di ${l}.json`);
          }
        }
      }
    }
  }
}

// --- Laporan -------------------------------------------------------------
if (problems.length) {
  console.error(`Ditemukan ${problems.length} masalah i18n:\n`);
  for (const p of problems) console.error('  - ' + p);
  process.exit(1);
}

console.log(
  `OK - ${idKeys.size} key, paritas id/en bersih, semua key dinamis ada.`
);
