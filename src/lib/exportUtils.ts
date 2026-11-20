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
  doc.text(`Net Cashflow: ${formatRp(totalInflow - totalOutflow)}`, 14, 28);
  doc.text(`Total Inflow: ${formatRp(totalInflow)}`, 14, 34);
  doc.text(`Total Outflow: ${formatRp(totalOutflow)}`, 14, 40);
  doc.text(`Total Sisa Debt: ${formatRp(totalDebt)}`, 14, 46);

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
          new Paragraph(`Net Cashflow: ${formatRp(totalInflow - totalOutflow)}`),
          new Paragraph(`Total Inflow: ${formatRp(totalInflow)}`),
          new Paragraph(`Total Outflow: ${formatRp(totalOutflow)}`),
          new Paragraph(`Total Sisa Debt: ${formatRp(totalDebt)}`),
          new Paragraph({ text: 'Riwayat Transaksi', heading: HeadingLevel.HEADING_2 }),
          new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: txRows }),
          new Paragraph({ text: 'Daftar Debt & Cicilan', heading: HeadingLevel.HEADING_2 }),
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

export function parseCSVTransactions(csvText: string): Omit<Transaction, 'id'>[] {
  const lines = csvText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length < 2) return [];

  const today = new Date().toISOString().split('T')[0];
  const results: Omit<Transaction, 'id'>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map((c) => c.trim().replace(/^"|"$/g, ''));
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
