// Dates in the report builder. Every date is a gym (UK) calendar day written YYYY-MM-DD, so a period is
// plain text that compares correctly and never shifts with the browser's time zone.

export type Preset = 'today' | 'week' | 'last-week' | 'month' | 'last-month' | '30' | '90' | '12m' | 'year' | 'last-year' | 'all';
export const PRESETS: [Preset, string][] = [
  ['today', 'Today'], ['week', 'This week'], ['last-week', 'Last week'], ['month', 'This month'], ['last-month', 'Last month'],
  ['30', 'Last 30 days'], ['90', 'Last 90 days'], ['12m', 'Last 12 months'], ['year', 'This year'], ['last-year', 'Last year'], ['all', 'All time'],
];
export type PeriodSel = { preset: Preset } | { from: string; to: string };
export type Compare = 'none' | 'previous' | 'year';
export interface Period { from: string | null; to: string | null; label: string }

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAY = 86400000;
const ISO = /^\d{4}-\d{2}-\d{2}$/;

const ms = (d: string) => Date.UTC(Number(d.slice(0, 4)), Number(d.slice(5, 7)) - 1, Number(d.slice(8, 10)));
const text = (t: number) => new Date(t).toISOString().slice(0, 10);
export const addDays = (d: string, n: number) => text(ms(d) + n * DAY);
const daysInMonth = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();
const pad = (n: number) => String(n).padStart(2, '0');
const ymd = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;
const parts = (d: string) => ({ y: Number(d.slice(0, 4)), m: Number(d.slice(5, 7)), d: Number(d.slice(8, 10)) });

function addMonths(d: string, n: number): string {
  const p = parts(d);
  const idx = p.y * 12 + (p.m - 1) + n;
  const y = Math.floor(idx / 12);
  const m = (idx % 12) + 1;
  return ymd(y, m, Math.min(p.d, daysInMonth(y, m)));
}
const monthRange = (d: string) => { const p = parts(d); return { from: ymd(p.y, p.m, 1), to: ymd(p.y, p.m, daysInMonth(p.y, p.m)) }; };

export function isRealDate(v: string): boolean {
  if (!ISO.test(v)) return false;
  const p = parts(v);
  return p.m >= 1 && p.m <= 12 && p.d >= 1 && p.d <= daysInMonth(p.y, p.m);
}

/** "14 Oct 2026". */
export function dayText(d: string): string {
  const p = parts(d);
  return `${p.d} ${MONTHS[p.m - 1] ?? ''} ${p.y}`;
}

const isWholeMonth = (f: string, t: string) => { const r = monthRange(f); return r.from === f && r.to === t; };
const isWholeYear = (f: string, t: string) => f.slice(5) === '01-01' && t.slice(5) === '12-31' && f.slice(0, 4) === t.slice(0, 4);

/** A short name for a range: "Oct 2026", "2026" or "1 Oct 2026 to 14 Oct 2026". */
export function rangeText(f: string | null, t: string | null): string {
  if (!f || !t) return 'All time';
  if (f === t) return dayText(f);
  if (isWholeMonth(f, t)) { const p = parts(f); return `${MONTHS[p.m - 1] ?? ''} ${p.y}`; }
  if (isWholeYear(f, t)) return f.slice(0, 4);
  return `${dayText(f)} to ${dayText(t)}`;
}

/** A ready-made period, worked out from today's date in the gym's time zone. */
export function presetPeriod(preset: Preset, today: string): Period {
  const label = PRESETS.find(([id]) => id === preset)?.[1] ?? 'All time';
  const p = parts(today);
  switch (preset) {
    case 'today': return { from: today, to: today, label };
    case 'week': case 'last-week': {
      const dow = (new Date(ms(today)).getUTCDay() + 6) % 7; // Monday is 0
      const monday = addDays(today, -dow - (preset === 'last-week' ? 7 : 0));
      return { from: monday, to: addDays(monday, 6), label };
    }
    case 'month': return { ...monthRange(today), label };
    case 'last-month': return { ...monthRange(addMonths(today, -1)), label };
    case '30': return { from: addDays(today, -29), to: today, label };
    case '90': return { from: addDays(today, -89), to: today, label };
    case '12m': return { from: addDays(addMonths(today, -12), 1), to: today, label };
    case 'year': return { from: ymd(p.y, 1, 1), to: ymd(p.y, 12, 31), label };
    case 'last-year': return { from: ymd(p.y - 1, 1, 1), to: ymd(p.y - 1, 12, 31), label };
    default: return { from: null, to: null, label };
  }
}

/** Two dates the owner typed. Null when either is missing, not a real date, or the end is before the start. */
export function customPeriod(from: string, to: string): Period | null {
  if (!isRealDate(from) || !isRealDate(to) || from > to) return null;
  return { from, to, label: rangeText(from, to) };
}

export function periodFor(sel: PeriodSel, today: string): Period {
  if ('preset' in sel) return presetPeriod(sel.preset, today);
  return customPeriod(sel.from, sel.to) ?? presetPeriod('all', today);
}

/** The period to compare with: the one just before it, or the same dates a year earlier. Null for all time. */
export function comparePeriod(p: Period, mode: Compare): Period | null {
  if (mode === 'none' || !p.from || !p.to) return null;
  let from: string;
  let to: string;
  if (mode === 'year') {
    from = addMonths(p.from, -12);
    to = isWholeMonth(p.from, p.to) ? monthRange(addMonths(p.to, -12)).to : addMonths(p.to, -12);
  } else if (isWholeYear(p.from, p.to)) {
    from = addMonths(p.from, -12);
    to = addMonths(p.to, -12);
  } else if (isWholeMonth(p.from, p.to)) {
    const r = monthRange(addMonths(p.from, -1));
    from = r.from;
    to = r.to;
  } else {
    const len = Math.round((ms(p.to) - ms(p.from)) / DAY) + 1;
    to = addDays(p.from, -1);
    from = addDays(to, -(len - 1));
  }
  return { from, to, label: rangeText(from, to) };
}

/** Filters that keep only rows whose date field falls inside the period. */
export function periodFilters(field: string | undefined, p: Period): { field: string; op: 'on_or_after' | 'on_or_before'; value: string }[] {
  if (!field) return [];
  return [
    ...(p.from ? [{ field, op: 'on_or_after' as const, value: p.from }] : []),
    ...(p.to ? [{ field, op: 'on_or_before' as const, value: p.to }] : []),
  ];
}

/** A saved choice read back safely. */
export function sanitiseSel(raw: unknown): PeriodSel {
  const r = raw as { preset?: unknown; from?: unknown; to?: unknown } | null;
  if (r && typeof r.preset === 'string' && PRESETS.some(([id]) => id === r.preset)) return { preset: r.preset as Preset };
  if (r && typeof r.from === 'string' && typeof r.to === 'string' && customPeriod(r.from, r.to)) return { from: r.from, to: r.to };
  return { preset: 'all' };
}
export const sanitiseCompare = (raw: unknown): Compare => (raw === 'previous' || raw === 'year' ? raw : 'none');
