import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  Document,
  Packer,
  Paragraph,
  Table,
  TableRow,
  TableCell,
  TextRun,
  WidthType,
  HeadingLevel,
} from 'docx';
import { Transaction, Debt } from '@/types/finance';

const formatRp = (amount: number) =>
  new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(amount);

export function exportToPDF(
  transactions: Transaction[],
  debts: Debt[],
  clientName: string
) {
  const doc = new jsPDF();
  const totalInflow = transactions
    .filter((t) => t.type === 'inflow')
    .reduce((s, t) => s + Number(t.amount), 0);
  const totalOutflow = transactions
    .filter((t) => t.type === 'outflow')
    .reduce((s, t) => s + Number(t.amount), 0);
  const totalDebt = debts
    .filter((d) => d.status === 'active')
    .reduce((s, d) => s + Number(d.remaining_balance), 0);

  doc.setFontSize(16);
  doc.text(`Stashinme - Laporan Keuangan (${clientName})`, 14, 18);

  doc.setFontSize(10);
  doc.text(`Saldo: ${formatRp(totalInflow - totalOutflow)}`, 14, 28);
  doc.text(`Total Inflow: ${formatRp(totalInflow)}`, 14, 34);
  doc.text(`Total Outflow: ${formatRp(totalOutflow)}`, 14, 40);
  doc.text(`Total Sisa Pinjaman: ${formatRp(totalDebt)}`, 14, 46);

  autoTable(doc, {
    startY: 54,
    head: [['Tanggal', 'Tipe', 'Kategori', 'Catatan', 'Nominal']],
    body: transactions.map((t) => [
      t.transaction_date,
      t.type.toUpperCase(),
      t.category,
      t.description || '-',
      formatRp(t.amount),
    ]),
  });

  const finalY = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY || 90;

  autoTable(doc, {
    startY: finalY + 10,
    head: [['Platform', 'Tenor Sisa', 'Jatuh Tempo', 'Cicilan/bln', 'Sisa Tagihan', 'Status']],
    body: debts.map((d) => [
      d.platform,
      d.remaining_tenor ? `${d.remaining_tenor} bln` : '-',
      d.due_day ? `Tgl ${d.due_day}` : '-',
      d.monthly_installment ? formatRp(d.monthly_installment) : '-',
      formatRp(d.remaining_balance),
      d.status === 'paid_off' ? 'Lunas' : 'Aktif',
    ]),
  });

  doc.save(`Stashinme-${clientName.replace(/\s+/g, '_')}.pdf`);
}

export async function exportToWord(
  transactions: Transaction[],
  debts: Debt[],
  clientName: string
) {
  const totalInflow = transactions
    .filter((t) => t.type === 'inflow')
    .reduce((s, t) => s + Number(t.amount), 0);
  const totalOutflow = transactions
    .filter((t) => t.type === 'outflow')
    .reduce((s, t) => s + Number(t.amount), 0);
  const totalDebt = debts
    .filter((d) => d.status === 'active')
    .reduce((s, d) => s + Number(d.remaining_balance), 0);

  const txRows = [
    new TableRow({
      children: ['Tanggal', 'Tipe', 'Kategori', 'Catatan', 'Nominal'].map(
        (h) =>
          new TableCell({
            children: [new Paragraph({ children: [new TextRun({ text: h, bold: true })] })],
          })
      ),
    }),
    ...transactions.map(
      (t) =>
        new TableRow({
          children: [
            t.transaction_date,
            t.type.toUpperCase(),
            t.category,
            t.description || '-',
            formatRp(t.amount),
          ].map((val) => new TableCell({ children: [new Paragraph(val)] }))
        })
    ),
  ];

  const debtRows = [
    new TableRow({
      children: ['Platform', 'Sisa Tenor', 'Cicilan/bln', 'Sisa Tagihan', 'Status'].map(
        (h) =>
          new TableCell({
            children: [new Paragraph({ children: [new TextRun({ text: h, bold: true })] })],
          })
      ),
    }),
    ...debts.map(
      (d) =>
        new TableRow({
          children: [
            d.platform,
            d.remaining_tenor ? `${d.remaining_tenor} bln` : '-',
            d.monthly_installment ? formatRp(d.monthly_installment) : '-',
            formatRp(d.remaining_balance),
            d.status === 'paid_off' ? 'Lunas' : 'Aktif',
          ].map((val) => new TableCell({ children: [new Paragraph(val)] }))
        })
    ),
  ];

  const doc = new Document({
    sections: [
      {
        children: [
          new Paragraph({
            text: `Stashinme - Laporan Keuangan (${clientName})`,
            heading: HeadingLevel.HEADING_1,
          }),
          new Paragraph(`Saldo: ${formatRp(totalInflow - totalOutflow)}`),
          new Paragraph(`Total Inflow: ${formatRp(totalInflow)}`),
          new Paragraph(`Total Outflow: ${formatRp(totalOutflow)}`),
          new Paragraph(`Total Sisa Pinjaman: ${formatRp(totalDebt)}`),
          new Paragraph({ text: 'Riwayat Transaksi', heading: HeadingLevel.HEADING_2 }),
          new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: txRows }),
          new Paragraph({ text: 'Daftar Pinjaman & Cicilan', heading: HeadingLevel.HEADING_2 }),
          new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: debtRows }),
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(blobFromDoc(doc));
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Stashinme-${clientName.replace(/\s+/g, '_')}.docx`;
  a.click();
  URL.revokeObjectURL(url);
}

function blobFromDoc(doc: Document) {
  return doc;
}

/**
 * Pecah satu baris CSV menjadi kolom-kolomnya.
 *
 * Ini parser yang hormati tanda kutip, bukan `split(',')` biasa. Tanpa itu,
 * keterangan yang mengandung koma ("Kopi, 2 cup") akan pecah jadi dua kolom
 * dan merusak data saat impor.
 */
function splitCsvLine(line: string): string[] {
  const cols: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (inQuotes) {
      if (char === '"') {
        // Dua tanda kutip berturut-turut = satu tanda kutip literal.
        if (line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      cols.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  cols.push(current.trim());
  return cols;
}

/**
 * Parse CSV transaksi.
 *
 * Format yang dikenali:
 * - baris diawali `#` diabaikan (komentar / metadata)
 * - baris pertama yang bukan komentar adalah header dan dilewati
 * - setelah baris header tabel pinjaman (`platform,...`), parsing berhenti
 *
 * Aturan terakhir itu yang bikin hasil `exportToCSV` bisa diimpor balik tanpa
 * baris pinjaman ikut jadi transaksi.
 */
export function parseCSVTransactions(csvText: string): Omit<Transaction, 'id'>[] {
  const lines = csvText.split(/\r?\n/);

  const today = new Date().toISOString().split('T')[0];
  const results: Omit<Transaction, 'id'>[] = [];

  let headerSkipped = false;
  let debtSection = false;

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith('#')) continue;

    // Awal bagian tabel pinjaman - berhenti di sini.
    if (/^platform\s*,/i.test(line)) {
      debtSection = true;
      continue;
    }
    if (debtSection) continue;

    // Header kolom transaksi - dilewati sekali.
    if (!headerSkipped) {
      headerSkipped = true;
      continue;
    }

    const cols = splitCsvLine(line);
    if (cols.length < 2) continue;

    const rawType = cols[0]?.toLowerCase();
    const type = rawType === 'inflow' ? 'inflow' : 'outflow';
    const amount = Number(cols[1]?.replace(/[^0-9.-]/g, ''));
    if (!amount || amount <= 0) continue;

    results.push({
      type,
      amount,
      category: cols[2] || 'Lainnya',
      description: cols[3] || null,
      transaction_date: cols[4] || today,
      source: 'import',
    });
  }

  return results;
}

/**
 * Escape satu sel CSV.
 *
 * Koma dan baris baru di dalam nilai harus diapit tanda kutip, dan tanda kutip
 * sendiri digandakan. Tanpa ini, keterangan seperti "Kopi, 2 cup" merusak
 * kolom saat file dibuka di Excel.
 */
function csvCell(value: string | number | null | undefined): string {
  const raw = value === null || value === undefined ? '' : String(value);
  if (/[",\n\r]/.test(raw)) {
    return `"${raw.replace(/"/g, '""')}"`;
  }
  return raw;
}

/**
 * Ekspor transaksi dan pinjaman ke CSV.
 *
 * Format kolom dibuat kompatibel dengan `parseCSVTransactions`, jadi file
 * hasil ekspor bisa diimpor balik tanpa ubah format.
 */
export function exportToCSV(
  transactions: Transaction[],
  debts: Debt[],
  clientName: string
) {
  const header = ['type', 'amount', 'category', 'description', 'transaction_date'];

  const txRows = transactions.map((t) =>
    [
      csvCell(t.type),
      csvCell(Number(t.amount)),
      csvCell(t.category),
      csvCell(t.description),
      csvCell(t.transaction_date),
    ].join(',')
  );

  const debtHeader = [
    'platform',
    'contract_no',
    'remaining_balance',
    'monthly_installment',
    'remaining_tenor',
    'due_day',
    'status',
  ];
  const debtRows = debts.map((d) =>
    [
      csvCell(d.platform),
      csvCell(d.contract_no),
      csvCell(Number(d.remaining_balance)),
      csvCell(Number(d.monthly_installment)),
      csvCell(d.remaining_tenor),
      csvCell(d.due_day),
      csvCell(d.status),
    ].join(',')
  );

  const lines = [
    `# stashinmeid - ${clientName}`,
    `# dibuat ${new Date().toISOString().slice(0, 10)}`,
    '',
    header.join(','),
    ...txRows,
    '',
    '# Pinjaman',
    debtHeader.join(','),
    ...debtRows,
  ];

  // BOM (U+FEFF) supaya Excel di Windows baca UTF-8 dengan benar (karakter
  // Indonesia seperti "P battled" dan tanda hubung tidak jadi rusak).
  const blob = new Blob(['﻿' + lines.join('\r\n')], {
    type: 'text/csv;charset=utf-8;',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `stashinmeid-${clientName.replace(/\s+/g, '_') || 'laporan'}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
