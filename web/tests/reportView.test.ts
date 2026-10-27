import { describe, expect, it } from 'vitest';
import type { ReportTable } from '../src/reports/download';
import { MAX_BARS, autoChart, cellNumber } from '../src/reports/reportView';

const t = (headers: string[], rows: (string | number)[][]): ReportTable => ({ title: 'T', subtitle: 'S', headers, rows });

describe('cellNumber', () => {
  it('reads numbers, pounds, percents and thousands separators', () => {
    expect(cellNumber(12)).toBe(12);
    expect(cellNumber('£1,234.50')).toBe(1234.5);
    expect(cellNumber('45%')).toBe(45);
    expect(cellNumber('-3')).toBe(-3);
  });
  it('does not read words, dates or blanks', () => {
    expect(cellNumber('Hybrid')).toBeNull();
    expect(cellNumber('2026-10-01')).toBeNull();
    expect(cellNumber('')).toBeNull();
  });
});

describe('autoChart', () => {
  it('draws the first numeric column against the name column', () => {
    const c = autoChart(t(['Plan', 'Note', 'Members'], [['Hybrid', 'x', 3], ['Annual', 'y', 1]]));
    expect(c?.heading).toBe('Members');
    expect(c?.bars.map((b) => [b.label, b.value, b.text])).toEqual([['Hybrid', 3, '3'], ['Annual', 1, '1']]);
  });
  it('keeps the text the table shows, such as pounds', () => {
    expect(autoChart(t(['Group', 'Income'], [['A', '£10.00'], ['B', '£5.00']]))?.bars[0]?.text).toBe('£10.00');
  });
  it('gives no chart for one row, a long list, all zeros, or numbers as names', () => {
    expect(autoChart(t(['A', 'B'], [['x', 1]]))).toBeNull();
    expect(autoChart(t(['A', 'B'], Array.from({ length: MAX_BARS + 1 }, (_, i) => [`n${i}`, i + 1])))).toBeNull();
    expect(autoChart(t(['A', 'B'], [['x', 0], ['y', 0]]))).toBeNull();
    expect(autoChart(t(['A', 'B'], [[1, 5], [2, 6]]))).toBeNull();
  });
  it('gives no chart when no column is all numbers', () => {
    expect(autoChart(t(['A', 'B'], [['x', 'one'], ['y', 2]]))).toBeNull();
  });
});
