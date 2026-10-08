import { londonInstant, londonParts } from '../classes/calc';
import type { LibraryData } from '../data/reportLibrary';
import { SERIES_COLORS } from '../charts/palette';
import { table, ukDate, ukDateTime } from './calc';
import type { ReportTable } from './download';
import { pounds, sessionStats, type LibraryContext } from './library';
import { metricsOf, type PlanRow } from './tabs';
import { classesTable } from './calc';

// The numbers behind the charts: a measure per period (weeks for short ranges, months for long ones),
// worked out from the same plain rows the tabs and library use, and the rows behind each column so a
// click can show them. Pure, so it is tested without a database.

export interface Period { label: string; start: string; end: string }

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const dayKey = (y: number, m: number, d: number) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

/** Add whole days to a yyyy-mm-dd date (calendar arithmetic, no time zones involved). */
function addDays(date: string, n: number): string {
  const [y = 0, m = 1, d = 1] = date.split('-').map(Number);
  const x = new Date(Date.UTC(y, m - 1, d + n));
  return dayKey(x.getUTCFullYear(), x.getUTCMonth() + 1, x.getUTCDate());
}

/**
 * The periods a chart shows, oldest first, ending with the current one. Ranges up to 90 days use weeks
 * (Monday to Sunday, gym time); longer ones use calendar months: 12 for a year, 24 for all time.
 */
export function periodsFor(rangeDays: number, now: Date): Period[] {
  const today = londonParts(now);
  if (rangeDays > 0 && rangeDays <= 90) {
    const weeks = Math.ceil(rangeDays / 7);
    const sinceMonday = (today.weekday + 6) % 7;
    const thisMonday = addDays(today.date, -sinceMonday);
    return Array.from({ length: weeks }, (_, i) => {
      const startDate = addDays(thisMonday, -7 * (weeks - 1 - i));
      const [, m = 1, d = 1] = startDate.split('-').map(Number);
      return { label: `${d} ${MONTHS[m - 1]}`, start: londonInstant(startDate, '00:00').toISOString(), end: londonInstant(addDays(startDate, 7), '00:00').toISOString() };
    });
  }
  const count = rangeDays > 0 ? Math.max(1, Math.round(rangeDays / 30.4)) : 24;
  const [ty = 2026, tm = 1] = today.date.split('-').map(Number);
  return Array.from({ length: count }, (_, i) => {
    const offset = count - 1 - i;
    const idx = ty * 12 + (tm - 1) - offset;
    const y = Math.floor(idx / 12);
    const m = (idx % 12) + 1;
    const ny = m === 12 ? y + 1 : y;
    const nm = m === 12 ? 1 : m + 1;
    const label = `${MONTHS[m - 1]}${m === 1 || i === 0 ? ` ${String(y).slice(2)}` : ''}`;
    return { label, start: londonInstant(dayKey(y, m, 1), '00:00').toISOString(), end: londonInstant(dayKey(ny, nm, 1), '00:00').toISOString() };
  });
}

export function inPeriod(iso: string, p: Period): boolean {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  return t >= new Date(p.start).getTime() && t < new Date(p.end).getTime();
}

/** A plain date (yyyy-mm-dd) as a time in the middle of that day, so it falls in the right period. */
const dateAsTime = (d: string) => (d.length === 10 ? `${d}T12:00:00Z` : d);

export interface Series { name: string; color: string; values: number[] }

const color = (i: number) => SERIES_COLORS[i] as string;

/** Who attended and who did not turn up, per period (classes that have started). */
export function attendanceSeries(d: LibraryData, periods: Period[], now: Date): Series[] {
  const stats = sessionStats(d).filter((s) => new Date(s.session.startsAt) < now);
  const sum = (p: Period, pick: (s: (typeof stats)[number]) => number) => stats.filter((s) => inPeriod(s.session.startsAt, p)).reduce((n, s) => n + pick(s), 0);
  return [
    { name: 'Attended', color: color(0), values: periods.map((p) => sum(p, (s) => s.attended)) },
    { name: 'No-show', color: color(1), values: periods.map((p) => sum(p, (s) => s.noShow)) },
  ];
}

/** New members and members who left, per period. */
export function joinsSeries(d: LibraryData, periods: Period[]): Series[] {
  return [
    { name: 'Joined', color: color(0), values: periods.map((p) => d.gymMembers.filter((m) => inPeriod(m.joinedAt, p)).length) },
    { name: 'Left', color: color(1), values: periods.map((p) => d.gymMembers.filter((m) => m.attritionOn && inPeriod(dateAsTime(m.attritionOn), p)).length) },
  ];
}

/** How many members there were at the end of each period. */
export function activeMembersSeries(d: LibraryData, periods: Period[], now: Date): Series[] {
  const values = periods.map((p) => {
    const end = Math.min(new Date(p.end).getTime(), now.getTime());
    return d.gymMembers.filter((m) => new Date(m.joinedAt).getTime() < end && (!m.attritionOn || new Date(dateAsTime(m.attritionOn)).getTime() >= end)).length;
  });
  return [{ name: 'Members', color: color(0), values }];
}

export type PayGroup = 'Paid' | 'Failed' | 'Pending';
export function payGroup(state: string): PayGroup | null {
  if (state === 'paid_out' || state === 'confirmed') return 'Paid';
  if (state === 'failed' || state === 'charged_back') return 'Failed';
  if (state === 'pending' || state === 'submitted') return 'Pending';
  return null; // cancelled and refunded are neither money in nor money lost
}

const payDate = (p: { chargeDate: string; createdAt: string }) => dateAsTime(p.chargeDate || p.createdAt);

/** Money in (paid), money lost (failed or charged back) and money waiting, per period, in whole pounds. */
export function paymentSeries(d: LibraryData, periods: Period[]): Series[] {
  const groups: PayGroup[] = ['Paid', 'Failed', 'Pending'];
  return groups.map((g, i) => ({
    name: g,
    color: color(i === 0 ? 0 : i === 1 ? 1 : 2),
    values: periods.map((p) => Math.round(d.payments.filter((x) => payGroup(x.state) === g && inPeriod(payDate(x), p)).reduce((n, x) => n + x.amountPence, 0) / 100)),
  }));
}

/** Paid money per period, in whole pounds. */
export function incomeSeries(d: LibraryData, periods: Period[]): Series[] {
  const paid = paymentSeries(d, periods)[0] as Series;
  return [{ ...paid, name: 'Income collected' }];
}

export interface DonutSlice { label: string; value: number; color: string; ids: string[] }

/** The biggest `max - 1` groups get their own colour; the rest fold into "Other" (a grey, never a new hue). */
export function foldSlices(items: { label: string; value: number; id: string }[], max = 6): DonutSlice[] {
  const sorted = items.filter((i) => i.value > 0).sort((a, b) => b.value - a.value || a.label.localeCompare(b.label));
  const keep = sorted.length > max ? sorted.slice(0, max - 1) : sorted;
  const rest = sorted.length > max ? sorted.slice(max - 1) : [];
  const out: DonutSlice[] = keep.map((i, n) => ({ label: i.label, value: i.value, color: color(n), ids: [i.id] }));
  if (rest.length) out.push({ label: 'Other', value: rest.reduce((n, i) => n + i.value, 0), color: '#6b7589', ids: rest.map((i) => i.id) });
  return out;
}

export function planSlices(plans: PlanRow[]): DonutSlice[] {
  return foldSlices(plans.map((p) => ({ label: p.name, value: p.members, id: p.id })));
}

export function paymentStateSlices(d: LibraryData, since: string | null): DonutSlice[] {
  const counts = new Map<PayGroup, number>();
  for (const p of d.payments) {
    const g = payGroup(p.state);
    if (g && (!since || new Date(payDate(p)) >= new Date(since))) counts.set(g, (counts.get(g) ?? 0) + 1);
  }
  return (['Paid', 'Failed', 'Pending'] as PayGroup[]).map((g, i) => ({ label: g, value: counts.get(g) ?? 0, color: color(i), ids: [g] }));
}

// ---- the rows behind a column ----

const sub = (ctx: LibraryContext, p: Period) => ({ ...ctx, rangeLabel: `${ukDate(p.start)} to ${ukDate(new Date(new Date(p.end).getTime() - 1).toISOString())}` });

export function attendanceRowsTable(ctx: LibraryContext, d: LibraryData, p: Period): ReportTable {
  return classesTable(sub(ctx, p), `Classes, ${p.label}`, metricsOf(d), (s) => inPeriod(s.startsAt, p));
}

export function joinsRowsTable(ctx: LibraryContext, d: LibraryData, p: Period): ReportTable {
  const who = (id: string) => d.people.get(id)?.name ?? 'Member';
  const rows = [
    ...d.gymMembers.filter((m) => inPeriod(m.joinedAt, p)).map((m) => ({ at: m.joinedAt, row: [who(m.userId), 'Joined', ukDate(m.joinedAt)] })),
    ...d.gymMembers.filter((m) => m.attritionOn && inPeriod(dateAsTime(m.attritionOn), p)).map((m) => ({ at: dateAsTime(m.attritionOn), row: [who(m.userId), 'Left', ukDate(dateAsTime(m.attritionOn))] })),
  ].sort((a, b) => a.at.localeCompare(b.at));
  return table(sub(ctx, p), `Members joined and left, ${p.label}`, ['Member', 'What happened', 'Date'], rows.map((r) => r.row));
}

export function paymentRowsTable(ctx: LibraryContext, d: LibraryData, p: Period, group?: PayGroup): ReportTable {
  const who = (id: string) => d.people.get(id)?.name ?? 'Member';
  const rows = d.payments
    .filter((x) => inPeriod(payDate(x), p) && (group ? payGroup(x.state) === group : payGroup(x.state) !== null))
    .sort((a, b) => payDate(a).localeCompare(payDate(b)))
    .map((x) => [who(x.userId), x.chargeDate || ukDateTime(x.createdAt), pounds(x.amountPence), x.state, x.failure]);
  return table(sub(ctx, p), `${group ?? 'Payments'}, ${p.label}`, ['Member', 'Charge date', 'Amount', 'State', 'Failure'], rows);
}

/** The people holding an active membership on the given plans (for clicking a slice of the plan ring). */
export function planMembersTable(ctx: LibraryContext, d: LibraryData, title: string, planIds: string[]): ReportTable {
  const planName = new Map(d.plans.map((p) => [p.id, p.name]));
  const rows = d.memberships
    .filter((m) => m.status === 'active' && planIds.includes(m.planId))
    .map((m) => [d.people.get(m.userId)?.name ?? 'Member', planName.get(m.planId) ?? '(no plan)'])
    .sort((a, b) => String(a[0]).localeCompare(String(b[0])));
  return table(ctx, title, ['Member', 'Plan'], rows);
}

/** Payments in one group (paid, failed or pending) inside the range, for clicking a slice of the payments ring. */
export function paymentGroupTable(ctx: LibraryContext, d: LibraryData, group: PayGroup): ReportTable {
  const who = (id: string) => d.people.get(id)?.name ?? 'Member';
  const rows = d.payments
    .filter((x) => payGroup(x.state) === group && (!ctx.since || new Date(payDate(x)) >= new Date(ctx.since)))
    .sort((a, b) => payDate(a).localeCompare(payDate(b)))
    .map((x) => [who(x.userId), x.chargeDate || ukDateTime(x.createdAt), pounds(x.amountPence), x.state, x.failure]);
  return table(ctx, `${group} payments`, ['Member', 'Charge date', 'Amount', 'State', 'Failure'], rows);
}
