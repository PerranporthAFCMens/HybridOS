// Turning a table of rows into a file the owner can keep: CSV, Excel or PDF. The CSV part is pure
// (and unit tested); Excel and PDF are loaded only when someone asks for them, so the page stays light.

export type Cell = string | number;

export interface ReportTable {
  title: string;
  /** A line under the title: the gym, the date range, when it was made. */
  subtitle: string;
  headers: string[];
  rows: Cell[][];
}

/**
 * Text that a spreadsheet would read as a formula (starts with = + - @ or a tab or return) gets a
 * leading apostrophe so a member called "=HYPERLINK(...)" cannot run anything when opened in Excel.
 * Numbers are left alone.
 */
export function safeCell(value: Cell): Cell {
  if (typeof value === 'number') return value;
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

function csvField(value: Cell): string {
  const text = String(safeCell(value));
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** Comma-separated text with a byte-order mark (so Excel shows £ and accents correctly) and Windows line ends. */
export function toCsv(table: Pick<ReportTable, 'headers' | 'rows'>): string {
  const lines = [table.headers, ...table.rows].map((r) => r.map(csvField).join(','));
  return '﻿' + lines.join('\r\n') + '\r\n';
}

/** "puffin-performance-members-joined-2026-10-07" style file name, without the extension. */
export function fileBase(gymName: string, title: string, now: Date): string {
  const slug = (t: string) => t.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  const day = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  return [slug(gymName), slug(title), day].filter(Boolean).join('-');
}

export type Format = 'csv' | 'xlsx' | 'pdf';

function save(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

export async function downloadTable(table: ReportTable, format: Format, name: string): Promise<void> {
  if (format === 'csv') {
    save(new Blob([toCsv(table)], { type: 'text/csv;charset=utf-8' }), `${name}.csv`);
    return;
  }
  if (format === 'xlsx') {
    const { default: writeXlsxFile } = await import('write-excel-file/universal');
    const header = table.headers.map((value) => ({ value, fontWeight: 'bold' as const }));
    const body = table.rows.map((r) => r.map((value) => ({ value: safeCell(value) })));
    const blob = await writeXlsxFile([header, ...body], { sheet: table.title.slice(0, 31).replace(/[\\/?*[\]:]/g, ' ') || 'Report' }).toBlob();
    save(blob, `${name}.xlsx`);
    return;
  }
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  const doc = new jsPDF({ orientation: table.headers.length > 5 ? 'landscape' : 'portrait', unit: 'pt', format: 'a4' });
  doc.setFontSize(16);
  doc.text(table.title, 40, 44);
  doc.setFontSize(10);
  doc.setTextColor(110);
  doc.text(table.subtitle, 40, 62);
  autoTable(doc, {
    startY: 78,
    head: [table.headers],
    body: table.rows.map((r) => r.map((c) => String(c))),
    styles: { fontSize: 9, cellPadding: 4 },
    headStyles: { fillColor: [11, 16, 32] },
    margin: { left: 40, right: 40 },
  });
  save(doc.output('blob'), `${name}.pdf`);
}
