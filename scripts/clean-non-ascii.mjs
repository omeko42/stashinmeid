#!/usr/bin/env node
/**
 * Bersihkan karakter non-ASCII dari file teks di sebuah direktori.
 *
 * Dipakai setelah menulis file panjang - kadang karakter asing (CJK, glitch)
 * bocor ke dalam teks Indonesia. File laporan ke user harus bersih; report
 * yang terlihat rusak mengurangi kredibilitas temuan serius.
 *
 * Pakai:
 *   node scripts/clean-non-ascii.mjs src docs
 *   node scripts/clean-non-ascii.mjs --check src docs
 *
 * Mode --check hanya melaporkan tanpa mengubah (keluar dengan kode 1 kalau
 * ada yang tercemar).
 *
 * PENTING: skrip ini tidak pernah membersihkan dirinya sendiri, dan hanya
 * menyentuh karakter yang jelas-jelas salah (CJK, glich), bukan bullet atau
 * simbol dekoratif yang memang dipakai di UI.
 */
import { readdir, readFile, writeFile, stat } from 'node:fs/promises';
import { join, extname, resolve, basename } from 'node:path';

const SKIP_DIRS = new Set([
  'node_modules',
  '.next',
  '.git',
  '.vercel',
  'out',
  'build',
  'coverage',
]);

const TEXT_EXT = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.json',
  '.md',
  '.css',
  '.html',
  '.txt',
  '.yml',
  '.yaml',
  '.sql',
  '.webmanifest',
]);

const SELF = basename(import.meta.url);

// Karakter non-ASCII yang sah dipakai di UI (bullet, panah, box drawing,
// emoji). Jangan pernah disentuh.
const ALLOWED = /[ •…–—‘’“”←-⇿∀-⋿■-◿☀-➿⬀-⯿\u{1F300}-\u{1FAFF}]/u;

// Karakter yang PASTI salah: CJK, Hiragana, Katakana, Hangul, dan blok
// Unicode tak lazim lainnya yang tidak pernah dipakai di teks Indonesia.
const SUSPECT = /[ᄀ-ᇿ⺀-⿟　-〿぀-ヿ㄰-㆏㐀-䶿一-鿿ꥠ-꥿가-퟿豈-﫿＀-￯]/u;

const args = process.argv.slice(2);
const checkOnly = args.includes('--check');
const roots = args.filter((a) => !a.startsWith('--'));

if (roots.length === 0) {
  console.error('Pakai: node scripts/clean-non-ascii.mjs [--check] <dir> [dir...]');
  process.exit(1);
}

async function walk(dir) {
  const results = [];
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return results;
  }

  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      results.push(...(await walk(full)));
    } else if (entry.isFile()) {
      if (basename(full) === SELF) continue;
      if (!TEXT_EXT.has(extname(entry.name))) continue;
      results.push(full);
    }
  }
  return results;
}

const files = [];
for (const root of roots) {
  const abs = resolve(root);
  const info = await stat(abs).catch(() => null);
  if (!info) continue;
  if (info.isDirectory()) files.push(...(await walk(abs)));
  else files.push(abs);
}

const report = [];
let dirtyCount = 0;

for (const file of files) {
  const original = await readFile(file, 'utf8');
  const lines = original.split('\n');

  let changed = false;
  const cleaned = lines.map((line, index) => {
    if (!SUSPECT.test(line)) return line;

    changed = true;
    const before = line;
    // Buang karakter CJK dan sejenisnya. Whitespace aneh diganti spasi biasa.
    const after = line.replace(
      /[ᄀ-ᇿ⺀-⿟　-〿぀-ヿ㄰-㆏㐀-䶿一-鿿ꥠ-꥿가-퟿豈-﫿＀-￯]/g,
      ''
    );

    report.push({
      file,
      line: index + 1,
      before: before.trim().slice(0, 90),
      after: after.trim().slice(0, 90),
    });
    return after;
  });

  if (changed) {
    dirtyCount += 1;
    if (!checkOnly) {
      await writeFile(file, cleaned.join('\n'), 'utf8');
    }
  }
}

if (report.length > 0) {
  console.log(`\n${report.length} baris tercemar di ${dirtyCount} file:\n`);
  for (const r of report) {
    console.log(`${r.file}:${r.line}`);
    console.log(`  sebelum: ${r.before}`);
    console.log(`  sesudah: ${r.after}\n`);
  }
  console.log(checkOnly ? 'Mode --check: tidak ada file diubah.' : 'File sudah dibersihkan.');
  if (checkOnly) process.exit(1);
} else {
  console.log('Bersih - tidak ada karakter asing yang perlu dibersihkan.');
}
