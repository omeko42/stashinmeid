import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import {
  AlignmentType,
  BorderStyle,
  Document,
  ImageRun,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from 'docx';
import type { Budget, Debt, Transaction } from '@/types/finance';
import { budgetStatuses } from '@/lib/budget';

export interface ExportReportOptions {
  periodLabel?: string;
  scopeLabel?: string;
  walletMap?: Record<string, string>;
  walletKindMap?: Record<string, string>;
  totalBalance?: number;
  cashBalance?: number;
  nonCashBalance?: number;
  budgets?: Budget[];
}

const formatRp = (amount: number) =>
  new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(amount);

const formatNum = (amount: number) =>
  new Intl.NumberFormat('id-ID', {
    maximumFractionDigits: 0,
  }).format(amount);

function formatShortDateId(iso: string): string {
  const parts = iso.split('-');
  if (parts.length !== 3) return iso;
  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
    'Jul', 'Ags', 'Sep', 'Okt', 'Nov', 'Des',
  ];
  const mIdx = Math.max(0, Math.min(11, Number(parts[1]) - 1));
  return `${parts[2]} ${months[mIdx]} ${parts[0]}`;
}

function formatTimeHms(isoTimestamp?: string | null): string {
  if (!isoTimestamp) return '00:00:00';
  const d = new Date(isoTimestamp);
  if (Number.isNaN(d.getTime())) return '00:00:00';
  return d.toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).replace(/\./g, ':');
}

function formatPrintedDateTime(): string {
  const now = new Date();
  const datePart = formatShortDateId(now.toISOString().slice(0, 10));
  const timePart = formatTimeHms(now.toISOString());
  return `${datePart}, ${timePart} WIB`;
}

function isNonCashTx(tx: Transaction, walletKindMap?: Record<string, string>): boolean {
  if (tx.account_id) {
    const kind = walletKindMap?.[tx.account_id];
    if (kind === 'cash' || kind === 'other') return false;
    return true;
  }
  return tx.source === 'manual_non_physical';
}

interface EnrichedStatementRow {
  tx: Transaction;
  isNonCash: boolean;
  dateLabel: string;
  timeLabel: string;
  walletName: string;
  runningTotal: number;
  runningCash: number;
  runningNonCash: number;
}

/**
 * Urutkan transaksi terbaru -> terlama dan hitung saldo akhir per baris
 * (Total, Tunai, Non-Tunai) mundur dari saldo aktual saat ini agar 100% klop.
 */
function buildEnrichedRows(
  transactions: Transaction[],
  options?: ExportReportOptions
): EnrichedStatementRow[] {
  const sorted = [...transactions].sort((a, b) => {
    const dCmp = b.transaction_date.localeCompare(a.transaction_date);
    if (dCmp !== 0) return dCmp;
    return (b.created_at || '').localeCompare(a.created_at || '');
  });

  const fallbackNet = sorted.reduce(
    (s, t) => s + (t.type === 'inflow' ? Number(t.amount) : -Number(t.amount)),
    0
  );
  let curCash =
    typeof options?.cashBalance === 'number' ? options.cashBalance : 0;
  let curNonCash =
    typeof options?.nonCashBalance === 'number'
      ? options.nonCashBalance
      : typeof options?.totalBalance === 'number'
        ? options.totalBalance - curCash
        : fallbackNet;

  return sorted.map((tx) => {
    const nonCash = isNonCashTx(tx, options?.walletKindMap);
    const row: EnrichedStatementRow = {
      tx,
      isNonCash: nonCash,
      dateLabel: formatShortDateId(tx.transaction_date),
      timeLabel: formatTimeHms(tx.created_at),
      walletName: resolveWalletName(tx, options?.walletMap),
      runningTotal: curCash + curNonCash,
      runningCash: curCash,
      runningNonCash: curNonCash,
    };

    // Mundurkan saldo ke posisi sebelum transaksi ini terjadi
    const amt = Number(tx.amount);
    const delta = tx.type === 'inflow' ? -amt : amt;
    if (nonCash) {
      curNonCash += delta;
    } else {
      curCash += delta;
    }
    return row;
  });
}

/**
 * Gambar mini-icon vektor tajam di jsPDF (bebas pecah & kompatibel semua PDF viewer):
 * - 'total'   : Ikon Dompet (emerald)
 * - 'cash'    : Ikon Uang Kertas (hijau)
 * - 'noncash' : Ikon Kartu Bank (biru)
 */
function drawPdfSaldoIcon(
  doc: jsPDF,
  kind: 'total' | 'cash' | 'noncash',
  x: number,
  y: number
) {
  const w = 3.2;
  const h = 2.2;
  doc.setLineWidth(0.28);

  if (kind === 'total') {
    // Ikon Dompet (Wallet) emerald
    doc.setDrawColor(14, 159, 110);
    doc.setFillColor(14, 159, 110);
    doc.roundedRect(x, y, w, h, 0.45, 0.45, 'S');
    // Flap / kancing dompet kanan
    doc.roundedRect(x + w - 1.15, y + 0.6, 1.15, 1.0, 0.25, 0.25, 'FD');
    return;
  }

  if (kind === 'cash') {
    // Ikon Uang Kertas (Banknote) hijau
    doc.setDrawColor(22, 163, 74);
    doc.setFillColor(22, 163, 74);
    doc.rect(x, y, w, h, 'S');
    doc.circle(x + w / 2, y + h / 2, 0.45, 'F');
    return;
  }

  // Ikon Kartu Bank (CreditCard) biru
  doc.setDrawColor(37, 99, 235);
  doc.setFillColor(37, 99, 235);
  doc.roundedRect(x, y, w, h, 0.4, 0.4, 'S');
  // Strip magnetik atas
  doc.rect(x, y + 0.45, w, 0.45, 'F');
  // Chip kecil kiri bawah
  doc.rect(x + 0.45, y + 1.35, 0.75, 0.45, 'F');
}

function makeDocRef(): string {
  const now = new Date();
  const ymd = now.toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `STM-${ymd}-${rand}`;
}

function resolveWalletName(
  tx: Transaction,
  walletMap?: Record<string, string>
): string {
  if (tx.account_id && walletMap?.[tx.account_id]) {
    return walletMap[tx.account_id];
  }
  return tx.source === 'manual_non_physical' ? 'Non-Tunai' : 'Tunai';
}

let cachedLogoDataUrl: string | null = null;
let cachedLogoBytes: Uint8Array | null = null;

async function loadBrandLogo(): Promise<{
  dataUrl: string | null;
  bytes: Uint8Array | null;
}> {
  if (cachedLogoDataUrl && cachedLogoBytes) {
    return { dataUrl: cachedLogoDataUrl, bytes: cachedLogoBytes };
  }
  if (typeof window === 'undefined') return { dataUrl: null, bytes: null };
  try {
    const res = await fetch('/logo-icon.png', { cache: 'force-cache' });
    if (!res.ok) return { dataUrl: null, bytes: null };
    const buf = await res.arrayBuffer();
    const bytes = new Uint8Array(buf);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    cachedLogoBytes = bytes;
    cachedLogoDataUrl = `data:image/png;base64,${btoa(binary)}`;
    return { dataUrl: cachedLogoDataUrl, bytes: cachedLogoBytes };
  } catch {
    return { dataUrl: null, bytes: null };
  }
}

/**
 * Ekspor PDF bergaya E-Statement / Rekening Koran Bank Resmi (terinspirasi BRI & SeaBank)
 * lengkap dengan Logo StashinMe, kop surat, kotak ringkasan rekening, mutasi Debit/Kredit,
 * ringkasan pinjaman, anggaran (termasuk Qty & Satuan SBM), dan nomor halaman otomatis.
 */
export async function exportToPDF(
  transactions: Transaction[],
  debts: Debt[],
  clientName: string,
  options?: ExportReportOptions
) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  const contentW = pageWidth - margin * 2;

  const { dataUrl: logoDataUrl } = await loadBrandLogo();
  const docRef = makeDocRef();
  const printedDate = formatPrintedDateTime();

  const enrichedRows = buildEnrichedRows(transactions, options);
  const sortedTxs = enrichedRows.map((r) => r.tx);
  const totalInflow = sortedTxs
    .filter((t) => t.type === 'inflow')
    .reduce((s, t) => s + Number(t.amount), 0);
  const totalOutflow = sortedTxs
    .filter((t) => t.type === 'outflow')
    .reduce((s, t) => s + Number(t.amount), 0);
  const netFlow = totalInflow - totalOutflow;
  const activeDebts = debts.filter((d) => d.status === 'active');
  const totalDebt = activeDebts.reduce(
    (s, d) => s + Number(d.remaining_balance),
    0
  );
  const monthlyDebt = activeDebts.reduce(
    (s, d) => s + Number(d.monthly_installment),
    0
  );

  // 1. KOP SURAT RESMI BANK (Header Bar Gelap + Aksen Emerald)
  doc.setFillColor(12, 16, 19);
  doc.rect(0, 0, pageWidth, 34, 'F');
  doc.setFillColor(14, 159, 110);
  doc.rect(0, 34, pageWidth, 1.5, 'F');

  if (logoDataUrl) {
    doc.addImage(logoDataUrl, 'PNG', margin, 8, 16, 16);
  }

  const brandX = logoDataUrl ? margin + 20 : margin;
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text('StashinMe', brandX, 15.5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(156, 175, 184);
  doc.text('Laporan Rekening & Arus Kas Elektronik', brandX, 21);
  doc.text('https://stashinme.biz.id · support@stashinme.biz.id', brandX, 26);

  // Kanan Kop: Judul Dokumen + S/N + Tanggal Cetak
  doc.setTextColor(34, 197, 139);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('E-STATEMENT', pageWidth - margin, 14.5, { align: 'right' });
  doc.setTextColor(210, 220, 226);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(`S/N ${docRef}`, pageWidth - margin, 20.5, { align: 'right' });
  doc.text(`Dicetak: ${printedDate}`, pageWidth - margin, 25.5, {
    align: 'right',
  });

  // 2. BLOK INFORMASI PEMILIK & PERIODE
  let cursorY = 43;
  doc.setTextColor(16, 22, 20);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text((clientName || 'Pengguna StashinMe').toUpperCase(), margin, cursorY);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(90, 102, 98);
  doc.text(
    `Ruang Keuangan: ${options?.scopeLabel || 'Semua Ruang'}`,
    margin,
    cursorY + 5.5
  );
  doc.text(
    `Periode Laporan: ${options?.periodLabel || 'Semua Periode'} · ${sortedTxs.length.toLocaleString('id-ID')} transaksi`,
    margin,
    cursorY + 10.5
  );

  if (typeof options?.totalBalance === 'number') {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(90, 102, 98);
    doc.text('TOTAL SALDO DOMPET', pageWidth - margin, cursorY, {
      align: 'right',
    });
    doc.setFontSize(13);
    doc.setTextColor(14, 159, 110);
    doc.text(formatRp(options.totalBalance), pageWidth - margin, cursorY + 7, {
      align: 'right',
    });
  }

  // 3. KOTAK RINGKASAN REKENING (4 Kolom ala E-Statement)
  cursorY += 17;
  const boxH = 18;
  const colW = contentW / 4;
  doc.setFillColor(244, 247, 246);
  doc.setDrawColor(216, 225, 221);
  doc.roundedRect(margin, cursorY, contentW, boxH, 2, 2, 'FD');

  const kpis = [
    {
      label: 'TRANSAKSI MASUK',
      val: formatRp(totalInflow),
      rgb: [14, 159, 110] as [number, number, number],
    },
    {
      label: 'TRANSAKSI KELUAR',
      val: formatRp(totalOutflow),
      rgb: [214, 69, 80] as [number, number, number],
    },
    {
      label: 'ARUS BERSIH (NET)',
      val: `${netFlow >= 0 ? '+' : ''}${formatRp(netFlow)}`,
      rgb:
        netFlow >= 0
          ? ([14, 159, 110] as [number, number, number])
          : ([214, 69, 80] as [number, number, number]),
    },
    {
      label: `PINJAMAN (${activeDebts.length} AKTIF)`,
      val: formatRp(totalDebt),
      rgb: [180, 116, 11] as [number, number, number],
    },
  ];

  kpis.forEach((k, idx) => {
    const x = margin + idx * colW;
    if (idx > 0) {
      doc.setDrawColor(220, 228, 224);
      doc.line(x, cursorY + 3, x, cursorY + boxH - 3);
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(105, 117, 112);
    doc.text(k.label, x + 3.5, cursorY + 6.5);
    doc.setFontSize(9.5);
    doc.setTextColor(k.rgb[0], k.rgb[1], k.rgb[2]);
    doc.text(k.val, x + 3.5, cursorY + 13.5);
  });

  // 4. TABEL RINCIAN TRANSAKSI (6 Kolom: Tanggal | Uraian | Ikon Saldo | Keluar | Masuk | Saldo Akhir)
  cursorY += boxH + 7;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(16, 22, 20);
  doc.text('RINCIAN MUTASI ARUS KAS', margin, cursorY);

  // Legenda Mini-Icon Vektor di sisi kanan judul tabel
  const legendY = cursorY - 2.1;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.2);
  doc.setTextColor(90, 102, 98);
  const lx3 = pageWidth - margin - 14.5;
  drawPdfSaldoIcon(doc, 'noncash', lx3 - 4.2, legendY);
  doc.text('Non-Tunai', lx3, cursorY);

  const lx2 = lx3 - 19;
  drawPdfSaldoIcon(doc, 'cash', lx2 - 4.2, legendY);
  doc.text('Tunai', lx2, cursorY);

  const lx1 = lx2 - 18.5;
  drawPdfSaldoIcon(doc, 'total', lx1 - 4.2, legendY);
  doc.text('Total', lx1, cursorY);

  autoTable(doc, {
    startY: cursorY + 3,
    margin: { left: margin, right: margin, bottom: 18 },
    head: [
      [
        'TANGGAL & WAKTU',
        'URAIAN TRANSAKSI',
        'SALDO',
        'KELUAR (IDR)',
        'MASUK (IDR)',
        'SALDO AKHIR (IDR)',
      ],
    ],
    body: enrichedRows.map((r) => {
      const amtStr = formatNum(Number(r.tx.amount));
      const isOut = r.tx.type === 'outflow';
      const isIn = r.tx.type === 'inflow';
      const outCol = isOut
        ? `${amtStr}\n${r.isNonCash ? '-' : amtStr}\n${r.isNonCash ? amtStr : '-'}`
        : '-\n-\n-';
      const inCol = isIn
        ? `${amtStr}\n${r.isNonCash ? '-' : amtStr}\n${r.isNonCash ? amtStr : '-'}`
        : '-\n-\n-';
      const balCol = `${formatNum(r.runningTotal)}\n${formatNum(r.runningCash)}\n${formatNum(r.runningNonCash)}`;

      return [
        `${r.dateLabel}\n${r.timeLabel}`,
        `${(r.tx.description || r.tx.category || '-').slice(0, 68)}\n${r.tx.category} · ${r.walletName}`,
        ' \n \n ',
        outCol,
        inCol,
        balCol,
      ];
    }),
    theme: 'grid',
    styles: {
      fontSize: 7,
      cellPadding: { top: 2.2, right: 2.2, bottom: 2.2, left: 2.2 },
      lineColor: [226, 232, 230],
      lineWidth: 0.2,
      textColor: [24, 32, 30],
      valign: 'middle',
    },
    headStyles: {
      fillColor: [18, 25, 30],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 7,
    },
    alternateRowStyles: {
      fillColor: [249, 251, 250],
    },
    columnStyles: {
      0: { cellWidth: 24, fontStyle: 'bold', textColor: [75, 85, 82], fontSize: 6.7 },
      1: { cellWidth: 66 },
      2: { cellWidth: 10, halign: 'center' },
      3: { cellWidth: 26, halign: 'right', textColor: [200, 55, 68], fontStyle: 'bold' },
      4: { cellWidth: 26, halign: 'right', textColor: [14, 145, 100], fontStyle: 'bold' },
      5: { cellWidth: 30, halign: 'right', fontStyle: 'bold', textColor: [24, 32, 30] },
    },
    didDrawCell: (data) => {
      if (data.section === 'body' && data.column.index === 2) {
        const cx = data.cell.x + (data.cell.width - 3.2) / 2;
        const innerH = data.cell.height - 4.4;
        const step = innerH / 3;
        const baseY = data.cell.y + 2.2 + (step - 2.2) / 2;
        drawPdfSaldoIcon(doc, 'total', cx, baseY);
        drawPdfSaldoIcon(doc, 'cash', cx, baseY + step);
        drawPdfSaldoIcon(doc, 'noncash', cx, baseY + step * 2);
      }
    },
  });

  // 5. TABEL PINJAMAN AKTIF (jika ada)
  const docWithAutoTable = doc as unknown as {
    lastAutoTable?: { finalY: number };
  };
  let nextY = (docWithAutoTable.lastAutoTable?.finalY ?? cursorY + 20) + 8;

  if (debts.length > 0) {
    if (nextY > pageHeight - 42) {
      doc.addPage();
      nextY = 18;
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(16, 22, 20);
    doc.text(
      `RINGKASAN PINJAMAN & CICILAN (Estimasi ${formatRp(monthlyDebt)}/bln)`,
      margin,
      nextY
    );

    autoTable(doc, {
      startY: nextY + 3,
      margin: { left: margin, right: margin, bottom: 18 },
      head: [['PLATFORM / KREDITUR', 'SISA TENOR', 'JATUH TEMPO', 'CICILAN / BLN', 'SISA PINJAMAN']],
      body: debts.map((d) => [
        d.platform + (d.status === 'paid_off' ? ' (Lunas)' : ''),
        d.remaining_tenor ? `${d.remaining_tenor} bln` : '-',
        d.due_day ? `Tgl ${d.due_day}` : '-',
        formatRp(Number(d.monthly_installment)),
        formatRp(Number(d.remaining_balance)),
      ]),
      theme: 'grid',
      styles: {
        fontSize: 7.5,
        cellPadding: 2.3,
        lineColor: [226, 232, 230],
        lineWidth: 0.2,
      },
      headStyles: {
        fillColor: [180, 116, 11],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
      },
      columnStyles: {
        3: { halign: 'right' },
        4: { halign: 'right', fontStyle: 'bold' },
      },
    });
    nextY = (docWithAutoTable.lastAutoTable?.finalY ?? nextY + 20) + 8;
  }

  // 6. TABEL ANGGARAN (jika ada)
  const bStatuses =
    options?.budgets && options.budgets.length > 0
      ? budgetStatuses(options.budgets, transactions)
      : [];
  if (bStatuses.length > 0) {
    if (nextY > pageHeight - 42) {
      doc.addPage();
      nextY = 18;
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(16, 22, 20);
    doc.text('RINGKASAN ANGGARAN (PAGU & REALISASI)', margin, nextY);

    autoTable(doc, {
      startY: nextY + 3,
      margin: { left: margin, right: margin, bottom: 18 },
      head: [['KATEGORI', 'QTY & SATUAN', 'PAGU (IDR)', 'TERPAKAI (IDR)', 'SISA (IDR)']],
      body: bStatuses.map((s) => [
        s.parsed.label,
        s.parsed.qty && s.parsed.unit
          ? `${s.parsed.qty} ${s.parsed.unit}`
          : s.budget.period,
        formatNum(Number(s.budget.amount)),
        formatNum(s.spent),
        formatNum(s.remaining),
      ]),
      theme: 'grid',
      styles: {
        fontSize: 7.5,
        cellPadding: 2.3,
        lineColor: [226, 232, 230],
        lineWidth: 0.2,
      },
      headStyles: {
        fillColor: [14, 159, 110],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
      },
      columnStyles: {
        2: { halign: 'right' },
        3: { halign: 'right' },
        4: { halign: 'right', fontStyle: 'bold' },
      },
    });
  }

  // 7. FOOTER RESMI PADA SETIAP HALAMAN ("Halaman X dari Y")
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setDrawColor(218, 226, 222);
    doc.line(margin, pageHeight - 12, pageWidth - margin, pageHeight - 12);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(120, 132, 127);
    doc.text(
      `Dokumen elektronik ini diterbitkan otomatis oleh StashinMe (stashinme.biz.id) · Ref ${docRef}`,
      margin,
      pageHeight - 7.5
    );
    doc.setFont('helvetica', 'bold');
    doc.text(
      `Halaman ${p} dari ${totalPages}`,
      pageWidth - margin,
      pageHeight - 7.5,
      { align: 'right' }
    );
  }

  const safeClient = (clientName || 'Laporan').replace(/\s+/g, '_');
  doc.save(`StashinMe-EStatement-${safeClient}.pdf`);
}

/**
 * Ekspor Excel asli multi-sheet (`.xlsx`):
 * Sheet 1: Ringkasan | Sheet 2: Arus Kas | Sheet 3: Pinjaman | Sheet 4: Anggaran
 */
export function exportToExcel(
  transactions: Transaction[],
  debts: Debt[],
  clientName: string,
  options?: ExportReportOptions
) {
  const wb = XLSX.utils.book_new();
  const enrichedRows = buildEnrichedRows(transactions, options);
  const sortedTxs = enrichedRows.map((r) => r.tx);
  const totalInflow = sortedTxs
    .filter((t) => t.type === 'inflow')
    .reduce((s, t) => s + Number(t.amount), 0);
  const totalOutflow = sortedTxs
    .filter((t) => t.type === 'outflow')
    .reduce((s, t) => s + Number(t.amount), 0);
  const totalDebt = debts
    .filter((d) => d.status === 'active')
    .reduce((s, d) => s + Number(d.remaining_balance), 0);

  // Sheet 1: Ringkasan
  const summaryRows = [
    ['STASHINME - E-STATEMENT LAPORAN KEUANGAN'],
    ['Pemilik Akun', clientName || 'Pengguna StashinMe'],
    ['Ruang Keuangan', options?.scopeLabel || 'Semua Ruang'],
    ['Periode Laporan', options?.periodLabel || 'Semua Periode'],
    ['Tanggal & Waktu Cetak', formatPrintedDateTime()],
    ['Nomor Referensi', makeDocRef()],
    [],
    ['RINGKASAN REKENING', 'NOMINAL (IDR)'],
    ['Total Transaksi Masuk', totalInflow],
    ['Total Transaksi Keluar', totalOutflow],
    ['Arus Bersih (Net)', totalInflow - totalOutflow],
    ...(typeof options?.totalBalance === 'number'
      ? [['Total Saldo Akhir', options.totalBalance]]
      : []),
    ...(typeof options?.cashBalance === 'number'
      ? [['Saldo Akhir Tunai', options.cashBalance]]
      : []),
    ...(typeof options?.nonCashBalance === 'number'
      ? [['Saldo Akhir Non-Tunai', options.nonCashBalance]]
      : []),
    ['Total Sisa Pinjaman Aktif', totalDebt],
  ];
  const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
  wsSummary['!cols'] = [{ wch: 28 }, { wch: 28 }];
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Ringkasan');

  // Sheet 2: Arus Kas (dengan waktu HH:mm:ss & saldo akhir Total/Tunai/Non-Tunai)
  const txSheetRows = [
    [
      'Tanggal',
      'Waktu (WIB)',
      'Uraian Transaksi & Kategori · Dompet',
      'Keluar (IDR)',
      'Masuk (IDR)',
      'Saldo Akhir Total (IDR)',
      'Saldo Akhir Tunai (IDR)',
      'Saldo Akhir Non-Tunai (IDR)',
    ],
    ...enrichedRows.map((r) => [
      r.tx.transaction_date,
      r.timeLabel,
      `${r.tx.description || r.tx.category} (${r.tx.category} · ${r.walletName})`,
      r.tx.type === 'outflow' ? Number(r.tx.amount) : 0,
      r.tx.type === 'inflow' ? Number(r.tx.amount) : 0,
      r.runningTotal,
      r.runningCash,
      r.runningNonCash,
    ]),
  ];
  const wsTx = XLSX.utils.aoa_to_sheet(txSheetRows);
  wsTx['!cols'] = [
    { wch: 13 },
    { wch: 12 },
    { wch: 48 },
    { wch: 16 },
    { wch: 16 },
    { wch: 20 },
    { wch: 20 },
    { wch: 22 },
  ];
  XLSX.utils.book_append_sheet(wb, wsTx, 'Arus Kas');

  // Sheet 3: Pinjaman
  const debtSheetRows = [
    ['Platform', 'No. Kontrak', 'Sisa Tenor (Bln)', 'Jatuh Tempo', 'Cicilan/Bln (IDR)', 'Sisa Pinjaman (IDR)', 'Status'],
    ...debts.map((d) => [
      d.platform,
      d.contract_no || '-',
      d.remaining_tenor ?? 0,
      d.due_day ? `Tgl ${d.due_day}` : '-',
      Number(d.monthly_installment),
      Number(d.remaining_balance),
      d.status === 'active' ? 'Aktif' : 'Lunas',
    ]),
  ];
  const wsDebt = XLSX.utils.aoa_to_sheet(debtSheetRows);
  wsDebt['!cols'] = [
    { wch: 26 },
    { wch: 18 },
    { wch: 16 },
    { wch: 12 },
    { wch: 18 },
    { wch: 20 },
    { wch: 10 },
  ];
  XLSX.utils.book_append_sheet(wb, wsDebt, 'Pinjaman');

  // Sheet 4: Anggaran (termasuk Qty & Satuan SBM)
  const bStatuses =
    options?.budgets && options.budgets.length > 0
      ? budgetStatuses(options.budgets, transactions)
      : [];
  if (bStatuses.length > 0) {
    const budgetRows = [
      ['Kategori', 'Periode', 'Qty', 'Satuan', 'Harga/Satuan (IDR)', 'Total Pagu (IDR)', 'Terpakai (IDR)', 'Sisa (IDR)'],
      ...bStatuses.map((s) => [
        s.parsed.label,
        s.parsed.isCustom && s.parsed.startIso && s.parsed.endIso
          ? `${s.parsed.startIso} s/d ${s.parsed.endIso}`
          : s.budget.period,
        s.parsed.qty ?? '',
        s.parsed.unit ?? '',
        s.unitPrice ? Math.round(s.unitPrice) : '',
        Number(s.budget.amount),
        s.spent,
        s.remaining,
      ]),
    ];
    const wsBudget = XLSX.utils.aoa_to_sheet(budgetRows);
    wsBudget['!cols'] = [
      { wch: 24 },
      { wch: 22 },
      { wch: 8 },
      { wch: 12 },
      { wch: 18 },
      { wch: 18 },
      { wch: 18 },
      { wch: 18 },
    ];
    XLSX.utils.book_append_sheet(wb, wsBudget, 'Anggaran');
  }

  const safeClient = (clientName || 'Laporan').replace(/\s+/g, '_');
  XLSX.writeFile(wb, `StashinMe-EStatement-${safeClient}.xlsx`);
}

/**
 * Ekspor Word (`.docx`) bergaya Laporan Bank Resmi dengan Logo StashinMe.
 */
export async function exportToWord(
  transactions: Transaction[],
  debts: Debt[],
  clientName: string,
  options?: ExportReportOptions
) {
  const { bytes: logoBytes } = await loadBrandLogo();
  const docRef = makeDocRef();
  const printedDate = formatPrintedDateTime();

  const enrichedRows = buildEnrichedRows(transactions, options);
  const sortedTxs = enrichedRows.map((r) => r.tx);
  const totalInflow = sortedTxs
    .filter((t) => t.type === 'inflow')
    .reduce((s, t) => s + Number(t.amount), 0);
  const totalOutflow = sortedTxs
    .filter((t) => t.type === 'outflow')
    .reduce((s, t) => s + Number(t.amount), 0);
  const totalDebt = debts
    .filter((d) => d.status === 'active')
    .reduce((s, d) => s + Number(d.remaining_balance), 0);

  const cellBorder = {
    top: { style: BorderStyle.SINGLE, size: 4, color: 'DDE4E1' },
    bottom: { style: BorderStyle.SINGLE, size: 4, color: 'DDE4E1' },
    left: { style: BorderStyle.SINGLE, size: 4, color: 'DDE4E1' },
    right: { style: BorderStyle.SINGLE, size: 4, color: 'DDE4E1' },
  };

  type DocxAlign = (typeof AlignmentType)[keyof typeof AlignmentType];

  const makeHeaderCell = (text: string, align: DocxAlign = AlignmentType.LEFT) =>
    new TableCell({
      shading: { type: ShadingType.CLEAR, fill: '12191E' },
      borders: cellBorder,
      children: [
        new Paragraph({
          alignment: align,
          children: [
            new TextRun({ text, bold: true, color: 'FFFFFF', size: 17 }),
          ],
        }),
      ],
    });

  const makeCell = (text: string, align: DocxAlign = AlignmentType.LEFT, color = '101614') =>
    new TableCell({
      borders: cellBorder,
      children: [
        new Paragraph({
          alignment: align,
          children: [new TextRun({ text, color, size: 17 })],
        }),
      ],
    });

  const headerRuns: (ImageRun | TextRun)[] = [];
  if (logoBytes) {
    headerRuns.push(
      new ImageRun({
        type: 'png',
        data: logoBytes,
        transformation: { width: 32, height: 32 },
      }),
      new TextRun({ text: '  ' })
    );
  }
  headerRuns.push(
    new TextRun({ text: 'StashinMe', bold: true, size: 32, color: '0E9F6E' }),
    new TextRun({
      text: '   |   E-STATEMENT LAPORAN KEUANGAN',
      bold: true,
      size: 20,
      color: '5E6B66',
    })
  );

  const doc = new Document({
    sections: [
      {
        children: [
          new Paragraph({
            spacing: { after: 120 },
            children: headerRuns,
          }),
          new Paragraph({
            spacing: { after: 60 },
            children: [
              new TextRun({
                text: `Pemilik Akun: ${clientName || 'Pengguna StashinMe'}   ·   Ruang: ${options?.scopeLabel || 'Semua Ruang'}`,
                bold: true,
                size: 20,
              }),
            ],
          }),
          new Paragraph({
            spacing: { after: 200 },
            children: [
              new TextRun({
                text: `Periode: ${options?.periodLabel || 'Semua Periode'}   ·   Dicetak: ${printedDate}   ·   Ref: ${docRef}`,
                color: '5E6B66',
                size: 18,
              }),
            ],
          }),

          // Ringkasan Rekening (4 kolom)
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  makeHeaderCell('TRANSAKSI MASUK'),
                  makeHeaderCell('TRANSAKSI KELUAR'),
                  makeHeaderCell('ARUS BERSIH (NET)'),
                  makeHeaderCell('TOTAL PINJAMAN AKTIF'),
                ],
              }),
              new TableRow({
                children: [
                  makeCell(formatRp(totalInflow), AlignmentType.LEFT, '0E9F6E'),
                  makeCell(formatRp(totalOutflow), AlignmentType.LEFT, 'D64550'),
                  makeCell(
                    formatRp(totalInflow - totalOutflow),
                    AlignmentType.LEFT,
                    totalInflow - totalOutflow >= 0 ? '0E9F6E' : 'D64550'
                  ),
                  makeCell(formatRp(totalDebt), AlignmentType.LEFT, 'B4740B'),
                ],
              }),
            ],
          }),

          new Paragraph({
            spacing: { before: 280, after: 100 },
            children: [
              new TextRun({
                text: `RINCIAN MUTASI ARUS KAS (${sortedTxs.length.toLocaleString('id-ID')} transaksi)`,
                bold: true,
                size: 20,
              }),
            ],
          }),

          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                tableHeader: true,
                children: [
                  makeHeaderCell('TANGGAL & WAKTU'),
                  makeHeaderCell('URAIAN TRANSAKSI'),
                  makeHeaderCell('SALDO', AlignmentType.CENTER),
                  makeHeaderCell('KELUAR (IDR)', AlignmentType.RIGHT),
                  makeHeaderCell('MASUK (IDR)', AlignmentType.RIGHT),
                  makeHeaderCell('SALDO AKHIR (IDR)', AlignmentType.RIGHT),
                ],
              }),
              ...enrichedRows.map((r) => {
                const amtStr = formatNum(Number(r.tx.amount));
                const isOut = r.tx.type === 'outflow';
                const isIn = r.tx.type === 'inflow';
                const outLines = isOut
                  ? [amtStr, r.isNonCash ? '-' : amtStr, r.isNonCash ? amtStr : '-']
                  : ['-', '-', '-'];
                const inLines = isIn
                  ? [amtStr, r.isNonCash ? '-' : amtStr, r.isNonCash ? amtStr : '-']
                  : ['-', '-', '-'];
                const balLines = [
                  formatNum(r.runningTotal),
                  formatNum(r.runningCash),
                  formatNum(r.runningNonCash),
                ];

                const make3LineNumCell = (lines: string[], primaryColor: string) =>
                  new TableCell({
                    borders: cellBorder,
                    children: lines.map(
                      (val, idx) =>
                        new Paragraph({
                          alignment: AlignmentType.RIGHT,
                          children: [
                            new TextRun({
                              text: val,
                              bold: idx === 0,
                              color: idx === 0 ? primaryColor : '5E6B66',
                              size: idx === 0 ? 15 : 14,
                            }),
                          ],
                        })
                    ),
                  });

                return new TableRow({
                  children: [
                    new TableCell({
                      borders: cellBorder,
                      children: [
                        new Paragraph({
                          children: [
                            new TextRun({ text: r.dateLabel, bold: true, size: 15 }),
                          ],
                        }),
                        new Paragraph({
                          children: [
                            new TextRun({ text: r.timeLabel, color: '5E6B66', size: 14 }),
                          ],
                        }),
                      ],
                    }),
                    new TableCell({
                      borders: cellBorder,
                      children: [
                        new Paragraph({
                          children: [
                            new TextRun({
                              text: (r.tx.description || r.tx.category).slice(0, 68),
                              bold: true,
                              size: 15,
                            }),
                          ],
                        }),
                        new Paragraph({
                          children: [
                            new TextRun({
                              text: `${r.tx.category} · ${r.walletName}`,
                              color: '5E6B66',
                              size: 14,
                            }),
                          ],
                        }),
                      ],
                    }),
                    new TableCell({
                      borders: cellBorder,
                      children: [
                        new Paragraph({
                          alignment: AlignmentType.CENTER,
                          children: [
                            new TextRun({ text: 'Total', bold: true, color: '0E9F6E', size: 14 }),
                          ],
                        }),
                        new Paragraph({
                          alignment: AlignmentType.CENTER,
                          children: [
                            new TextRun({ text: 'Tunai', color: '16A34A', size: 13 }),
                          ],
                        }),
                        new Paragraph({
                          alignment: AlignmentType.CENTER,
                          children: [
                            new TextRun({ text: 'Non-Tunai', color: '2563EB', size: 13 }),
                          ],
                        }),
                      ],
                    }),
                    make3LineNumCell(outLines, 'D64550'),
                    make3LineNumCell(inLines, '0E9F6E'),
                    make3LineNumCell(balLines, '101614'),
                  ],
                });
              }),
            ],
          }),

          ...(debts.length > 0
            ? [
                new Paragraph({
                  spacing: { before: 280, after: 100 },
                  children: [
                    new TextRun({
                      text: 'RINGKASAN PINJAMAN & CICILAN',
                      bold: true,
                      size: 20,
                    }),
                  ],
                }),
                new Table({
                  width: { size: 100, type: WidthType.PERCENTAGE },
                  rows: [
                    new TableRow({
                      tableHeader: true,
                      children: [
                        makeHeaderCell('PLATFORM'),
                        makeHeaderCell('SISA TENOR'),
                        makeHeaderCell('CICILAN / BLN', AlignmentType.RIGHT),
                        makeHeaderCell('SISA PINJAMAN', AlignmentType.RIGHT),
                      ],
                    }),
                    ...debts.map(
                      (d) =>
                        new TableRow({
                          children: [
                            makeCell(d.platform),
                            makeCell(
                              d.remaining_tenor ? `${d.remaining_tenor} bln` : '-'
                            ),
                            makeCell(
                              formatRp(Number(d.monthly_installment)),
                              AlignmentType.RIGHT
                            ),
                            makeCell(
                              formatRp(Number(d.remaining_balance)),
                              AlignmentType.RIGHT,
                              'B4740B'
                            ),
                          ],
                        })
                    ),
                  ],
                }),
              ]
            : []),

          new Paragraph({
            spacing: { before: 280 },
            children: [
              new TextRun({
                text: `Dokumen elektronik ini diterbitkan otomatis oleh StashinMe (https://stashinme.biz.id) · Ref ${docRef}`,
                italics: true,
                color: '8B9893',
                size: 15,
              }),
            ],
          }),
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `StashinMe-EStatement-${(clientName || 'Laporan').replace(/\s+/g, '_')}.docx`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Pecah satu baris CSV dengan memperhatikan tanda kutip ganda (RFC 4180).
 */
function splitCsvLine(line: string): string[] {
  const cols: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        current += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      cols.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }

  cols.push(current.trim());
  return cols;
}

/**
 * Parse CSV transaksi (kompatibel balik dengan hasil `exportToCSV`).
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

    if (/^platform\s*,/i.test(line)) {
      debtSection = true;
      continue;
    }
    if (debtSection) continue;

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

function csvCell(value: string | number | null | undefined): string {
  const raw = value === null || value === undefined ? '' : String(value);
  if (/[",\n\r]/.test(raw)) {
    return `"${raw.replace(/"/g, '""')}"`;
  }
  return raw;
}

/**
 * Ekspor transaksi dan pinjaman ke CSV (kompatibel impor balik).
 */
export function exportToCSV(
  transactions: Transaction[],
  debts: Debt[],
  clientName: string,
  options?: ExportReportOptions
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
    'remaining_balance',
    'monthly_installment',
    'remaining_tenor',
    'due_day',
    'status',
  ];

  const debtRows = debts.map((d) =>
    [
      csvCell(d.platform),
      csvCell(Number(d.remaining_balance)),
      csvCell(Number(d.monthly_installment)),
      csvCell(d.remaining_tenor),
      csvCell(d.due_day),
      csvCell(d.status),
    ].join(',')
  );

  const lines = [
    `# StashinMe E-Statement - ${clientName}`,
    `# periode ${options?.periodLabel || 'Semua Periode'} | dibuat ${new Date().toISOString().slice(0, 10)}`,
    '',
    header.join(','),
    ...txRows,
    '',
    '# Pinjaman',
    debtHeader.join(','),
    ...debtRows,
  ];

  const blob = new Blob(['\uFEFF' + lines.join('\r\n')], {
    type: 'text/csv;charset=utf-8;',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `StashinMe-${(clientName || 'laporan').replace(/\s+/g, '_')}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
