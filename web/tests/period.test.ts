import { describe, expect, it } from 'vitest';
import { mergeBuilt } from '../src/builder/compare';
import type { Built } from '../src/builder/engine';
import { comparePeriod, customPeriod, periodFilters, periodFor, presetPeriod, rangeText, sanitiseCompare, sanitiseSel } from '../src/builder/period';

const T = '2026-10-14'; // a Wednesday

describe('periods', () => {
  it('quick choices', () => {
    expect(presetPeriod('today', T)).toMatchObject({ from: T, to: T });
    expect(presetPeriod('week', T)).toMatchObject({ from: '2026-10-12', to: '2026-10-18' });
    expect(presetPeriod('last-week', T)).toMatchObject({ from: '2026-10-05', to: '2026-10-11' });
    expect(presetPeriod('month', T)).toMatchObject({ from: '2026-10-01', to: '2026-10-31' });
    expect(presetPeriod('last-month', T)).toMatchObject({ from: '2026-09-01', to: '2026-09-30' });
    expect(presetPeriod('30', T)).toMatchObject({ from: '2026-09-15', to: T });
    expect(presetPeriod('12m', T)).toMatchObject({ from: '2025-10-15', to: T });
    expect(presetPeriod('year', T)).toMatchObject({ from: '2026-01-01', to: '2026-12-31' });
    expect(presetPeriod('last-year', T)).toMatchObject({ from: '2025-01-01', to: '2025-12-31' });
    expect(presetPeriod('all', T)).toMatchObject({ from: null, to: null });
  });
  it('last month across a year end', () => {
    expect(presetPeriod('last-month', '2026-01-10')).toMatchObject({ from: '2025-12-01', to: '2025-12-31' });
  });
  it('a week starts on Monday, even when today is Sunday', () => {
    expect(presetPeriod('week', '2026-10-18')).toMatchObject({ from: '2026-10-12' });
  });
  it('custom dates must be real and in order', () => {
    expect(customPeriod('2026-02-30', '2026-03-01')).toBeNull();
    expect(customPeriod('2026-03-02', '2026-03-01')).toBeNull();
    expect(customPeriod('2026-03-01', '2026-03-01')?.label).toBe('1 Mar 2026');
  });
  it('names ranges', () => {
    expect(rangeText('2026-10-01', '2026-10-31')).toBe('Oct 2026');
    expect(rangeText('2026-01-01', '2026-12-31')).toBe('2026');
    expect(rangeText('2026-10-03', '2026-10-09')).toBe('3 Oct 2026 to 9 Oct 2026');
  });
  it('compares with the period before', () => {
    expect(comparePeriod(presetPeriod('month', T), 'previous')).toMatchObject({ from: '2026-09-01', to: '2026-09-30' });
    expect(comparePeriod(presetPeriod('year', T), 'previous')).toMatchObject({ from: '2025-01-01', to: '2025-12-31' });
    expect(comparePeriod(presetPeriod('30', T), 'previous')).toMatchObject({ from: '2026-08-16', to: '2026-09-14' });
    expect(comparePeriod(presetPeriod('week', T), 'previous')).toMatchObject({ from: '2026-10-05', to: '2026-10-11' });
  });
  it('compares with the same time last year', () => {
    expect(comparePeriod(presetPeriod('month', T), 'year')).toMatchObject({ from: '2025-10-01', to: '2025-10-31' });
    expect(comparePeriod(customPeriod('2024-02-29', '2024-03-05') as never, 'year')).toMatchObject({ from: '2023-02-28', to: '2023-03-05' });
    expect(comparePeriod(presetPeriod('all', T), 'previous')).toBeNull();
    expect(comparePeriod(presetPeriod('month', T), 'none')).toBeNull();
  });
  it('turns a period into filters, or none for all time or no date field', () => {
    expect(periodFilters('date', presetPeriod('month', T)).map((f) => `${f.op} ${f.value}`)).toEqual(['on_or_after 2026-10-01', 'on_or_before 2026-10-31']);
    expect(periodFilters('date', presetPeriod('all', T))).toEqual([]);
    expect(periodFilters(undefined, presetPeriod('month', T))).toEqual([]);
  });
  it('reads saved choices safely', () => {
    expect(sanitiseSel({ preset: 'month' })).toEqual({ preset: 'month' });
    expect(sanitiseSel({ preset: 'nonsense' })).toEqual({ preset: 'all' });
    expect(sanitiseSel({ from: '2026-01-01', to: '2025-01-01' })).toEqual({ preset: 'all' });
    expect(sanitiseSel({ from: '2026-01-01', to: '2026-02-01' })).toEqual({ from: '2026-01-01', to: '2026-02-01' });
    expect(sanitiseCompare('year')).toBe('year');
    expect(sanitiseCompare('x')).toBe('none');
    expect(periodFor({ from: '2026-01-01', to: '2026-01-02' }, T).from).toBe('2026-01-01');
  });
});

const built = (groups: [string, string, number][]): Built => ({
  table: { title: 'T', subtitle: 'S', headers: ['By', 'Total'], rows: [] },
  groups: groups.map(([key, label, v]) => ({ key, label, values: [v] })),
  totals: [groups.reduce((n, g) => n + g[2], 0)], measureLabels: ['Total'], measureTypes: ['money'], rowCount: 1,
});

describe('mergeBuilt', () => {
  it('lines months up by position', () => {
    const m = mergeBuilt(built([['2026-09', 'Sep 2026', 100], ['2026-10', 'Oct 2026', 300]]), built([['2025-09', 'Sep 2025', 50]]), 'This year', 'Last year', true);
    expect(m.groups.map((g) => g.values)).toEqual([[100, 50], [300, 0]]);
    expect(m.measureLabels).toEqual(['Total (This year)', 'Total (Last year)']);
    expect(m.totals).toEqual([400, 50]);
    expect(m.table.rows[0]).toEqual(['Sep 2026', '£1.00', '£0.50']);
  });
  it('lines names up by name', () => {
    const m = mergeBuilt(built([['a', 'Adult', 10], ['b', 'Junior', 5]]), built([['b', 'Junior', 7], ['c', 'Student', 2]]), 'A', 'B', false);
    expect(m.groups.map((g) => [g.label, ...g.values])).toEqual([['Adult', 10, 0], ['Junior', 5, 7], ['Student', 0, 2]]);
  });
});
