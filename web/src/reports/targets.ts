import type { LibraryData } from '../data/reportLibrary';
import type { TargetMetric, TargetRow } from '../data/targets';
import { reportMoney } from './calc';
import { summaryFigures } from './summary';
import { periodsFor } from './trends';

export interface MetricInfo { key: TargetMetric; label: string; /** What the box asks for, e.g. "pounds a month". */ unit: string }

export const GYM_METRICS: MetricInfo[] = [
  { key: 'income_pence', label: 'Income collected', unit: 'pounds a month' },
  { key: 'members_joined', label: 'New members', unit: 'a month' },
  { key: 'active_members', label: 'Active members', unit: 'members' },
];
export const STAFF_METRICS: MetricInfo[] = [
  { key: 'classes_taught', label: 'Classes taught', unit: 'a month' },
  { key: 'pt_sessions', label: 'PT sessions done', unit: 'a month' },
];

/** The calendar month we are in (UK time), as a period. */
export function thisMonth(now: Date) {
  const months = periodsFor(365, now);
  return months[months.length - 1] as (typeof months)[number];
}

export interface Progress {
  metric: TargetMetric;
  label: string;
  /** What has been done so far this month, and the goal. Income is in pence. */
  done: number;
  target: number;
  /** Whole percent of the goal reached; can go over 100. */
  pct: number;
  doneText: string;
  targetText: string;
}

const text = (metric: TargetMetric, v: number) => (metric === 'income_pence' ? reportMoney(v) : String(v));

function progress(info: MetricInfo, done: number, target: number): Progress {
  return {
    metric: info.key, label: info.label, done, target,
    pct: target > 0 ? Math.round((done / target) * 100) : 0,
    doneText: text(info.key, done), targetText: text(info.key, target),
  };
}

/** What the whole gym has done so far this month, for the three gym measures. */
export function gymMonthToDate(d: LibraryData, now: Date): Record<'income_pence' | 'members_joined' | 'active_members', number> {
  const m = thisMonth(now);
  const f = summaryFigures(d, m.start, now, m.end);
  return { income_pence: f.income, members_joined: f.joined, active_members: f.active };
}

/** Classes taught (that have started) and PT sessions done this month by one person. */
export function staffMonthToDate(d: LibraryData, userId: string, now: Date): Record<'classes_taught' | 'pt_sessions', number> {
  const m = thisMonth(now);
  const inMonth = (iso: string) => iso >= m.start && iso < m.end;
  const mine = new Set(d.sessionStaff.filter((s) => s.userId === userId).map((s) => s.sessionId));
  return {
    classes_taught: d.sessions.filter((s) => mine.has(s.id) && inMonth(s.startsAt) && new Date(s.startsAt) < now).length,
    pt_sessions: d.pt.filter((p) => p.staffId === userId && p.status === 'completed' && inMonth(p.startsAt)).length,
  };
}

/** Progress on each gym goal that has been set, in the order shown on screen. */
export function gymProgress(d: LibraryData, now: Date, targets: TargetRow[]): Progress[] {
  const done = gymMonthToDate(d, now);
  return GYM_METRICS.flatMap((info) => {
    const t = targets.find((x) => x.userId === '' && x.metric === info.key);
    return t ? [progress(info, done[info.key as keyof typeof done], t.value)] : [];
  });
}

/** Progress on each goal set for one staff member. */
export function staffProgress(d: LibraryData, userId: string, now: Date, targets: TargetRow[]): Progress[] {
  const done = staffMonthToDate(d, userId, now);
  return STAFF_METRICS.flatMap((info) => {
    const t = targets.find((x) => x.userId === userId && x.metric === info.key);
    return t ? [progress(info, done[info.key as keyof typeof done], t.value)] : [];
  });
}

/** Turns what was typed into the stored number: pounds become pence for income; blank means "no goal". Null for blank, NaN-safe. */
export function parseTarget(metric: TargetMetric, typed: string): number | null | 'bad' {
  const t = typed.trim().replace(/[£,\s]/g, '');
  if (t === '') return null;
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return 'bad';
  const n = Number(t);
  const v = metric === 'income_pence' ? Math.round(n * 100) : n;
  if (metric !== 'income_pence' && !Number.isInteger(n)) return 'bad';
  return v > 100000000 ? 'bad' : v;
}

/** The stored number as it is typed into the box. */
export function targetInput(metric: TargetMetric, value: number | undefined): string {
  if (value === undefined) return '';
  return metric === 'income_pence' ? String(value / 100) : String(value);
}
