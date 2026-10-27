import type { Cell, ReportTable } from './download';

export interface ChartBar { label: string; value: number; text: string }
export interface AutoChart { heading: string; bars: ChartBar[] }

/** "£1,234.50", "45%" and plain numbers as numbers; anything else is not a number. */
export function cellNumber(c: Cell): number | null {
  if (typeof c === 'number') return Number.isFinite(c) ? c : null;
  const t = c.trim().replace(/^[£$]/, '').replace(/,/g, '').replace(/%$/, '');
  return t !== '' && /^-?\d+(\.\d+)?$/.test(t) ? Number(t) : null;
}

/** Most bars a card draws; longer lists stay as a table. */
export const MAX_BARS = 12;

/**
 * A bar chart for a report table, when it has one worth drawing: two to twelve rows, a name in the first
 * column and a column of numbers (the first such column is used). Lists such as logs and registers get none.
 */
export function autoChart(t: ReportTable): AutoChart | null {
  if (t.rows.length < 2 || t.rows.length > MAX_BARS) return null;
  if (t.rows.some((r) => cellNumber(r[0] ?? '') !== null)) return null;
  for (let col = 1; col < t.headers.length; col++) {
    const values = t.rows.map((r) => cellNumber(r[col] ?? ''));
    if (values.some((v) => v === null)) continue;
    if (values.every((v) => v === 0)) return null;
    return { heading: t.headers[col] ?? '', bars: t.rows.map((r, i) => ({ label: String(r[0]), value: values[i] as number, text: String(r[col]) })) };
  }
  return null;
}
