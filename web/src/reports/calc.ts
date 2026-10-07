import type { PlanRow } from '../data/plans';
import type { GymMemberRow } from '../data/today';
import type { ActiveMembership, ReportBooking, ReportSession } from '../data/reports';
import type { Cell, ReportTable } from './download';
import { monthlyValue } from '../today/calc';

export const RANGES = [
  ['30', 'Last 30 days'],
  ['90', 'Last 90 days'],
  ['365', 'Last 12 months'],
  ['0', 'All time'],
] as const;

export const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;
export const BANDS = ['Morning', 'Daytime', 'Evening', 'Late'] as const;
export type Band = (typeof BANDS)[number];

/** Whole-number percentage; 0 when there is nothing to divide by. */
export function pct(part: number, whole: number): number {
  return whole ? Math.round((part / whole) * 100) : 0;
}

/** Start of the chosen range as an ISO time, or null for all time. */
export function rangeStart(days: number, now: Date): string | null {
  if (!days) return null;
  const d = new Date(now);
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

/** Whole pounds with thousands separators, as the old Reports page showed money. */
export function reportMoney(pence: number): string {
  return '£' + ((Number(pence) || 0) / 100).toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

const HOUR = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', hourCycle: 'h23', timeZone: 'Europe/London' });
const WEEKDAY = new Intl.DateTimeFormat('en-GB', { weekday: 'short', timeZone: 'Europe/London' });

export function bandOf(hour: number): Band {
  return hour < 9 ? 'Morning' : hour < 16 ? 'Daytime' : hour < 21 ? 'Evening' : 'Late';
}

export interface SessionMetric extends ReportSession {
  booked: number;
  attended: number;
  noShow: number;
  /** Booked + attended + no-show: everyone who took a place. */
  demand: number;
  day: string;
  band: Band;
}

/** Counts per class by booking status, and the day and time-of-day band in UK time. */
export function sessionMetrics(sessions: ReportSession[], bookings: ReportBooking[]): SessionMetric[] {
  const counts = new Map<string, { booked: number; attended: number; no_show: number }>();
  for (const b of bookings) {
    const c = counts.get(b.sessionId) ?? { booked: 0, attended: 0, no_show: 0 };
    if (b.status === 'booked') c.booked++;
    else if (b.status === 'attended') c.attended++;
    else if (b.status === 'no_show') c.no_show++;
    counts.set(b.sessionId, c);
  }
  return sessions.map((s) => {
    const c = counts.get(s.id) ?? { booked: 0, attended: 0, no_show: 0 };
    const at = new Date(s.startsAt);
    return {
      ...s,
      booked: c.booked,
      attended: c.attended,
      noShow: c.no_show,
      demand: c.booked + c.attended + c.no_show,
      day: WEEKDAY.format(at),
      band: bandOf(Number(HOUR.format(at))),
    };
  });
}

const sum = (rows: SessionMetric[], pick: (s: SessionMetric) => number) => rows.reduce((n, s) => n + pick(s), 0);
const fill = (rows: SessionMetric[]) => pct(sum(rows, (s) => s.demand), sum(rows, (s) => s.capacity));

export interface Overview {
  activeMemberships: number;
  /** Estimated monthly recurring revenue, in pence. */
  mrr: number;
  avgFill: number;
  attendanceRate: number;
  newMembers: number;
  attendances: number;
  noShows: number;
  sessions: number;
  byDay: { label: string; value: number }[];
  byBand: { label: string; value: number }[];
  planMix: { label: string; value: number }[];
}

export interface OverviewInput {
  metrics: SessionMetric[];
  /** Each active membership and its plan. */
  activeMemberships: ActiveMembership[];
  plans: PlanRow[];
  members: GymMemberRow[];
  since: string | null;
  now: Date;
}

/**
 * The Overview figures. Income per plan uses the same monthly values as the Today screen (annual and
 * quarterly plans are divided down to a month). Attendance rate only counts classes already started.
 */
export function buildOverview({ metrics, activeMemberships, plans, members, since, now }: OverviewInput): Overview {
  const activePlanIds = activeMemberships.map((m) => m.planId);
  const past = metrics.filter((s) => new Date(s.startsAt) < now);
  const attended = sum(past, (s) => s.attended);
  const noShows = sum(past, (s) => s.noShow);
  const priceOf = new Map(plans.map((p) => [p.id, monthlyValue(p.priceInPence, p.interval)]));
  const mrr = Math.round(activePlanIds.reduce((n, id) => n + (priceOf.get(id) ?? 0), 0));
  return {
    activeMemberships: activePlanIds.length,
    mrr,
    avgFill: fill(metrics),
    attendanceRate: pct(attended, attended + noShows),
    newMembers: members.filter((m) => !since || new Date(m.joinedAt) >= new Date(since)).length,
    attendances: attended,
    noShows,
    sessions: metrics.length,
    byDay: DAYS.map((d) => ({ label: d, value: fill(metrics.filter((s) => s.day === d)) })),
    byBand: BANDS.map((b) => ({ label: b, value: fill(metrics.filter((s) => s.band === b)) })),
    planMix: plans
      .map((p) => ({ label: p.name, value: activePlanIds.filter((id) => id === p.id).length }))
      .sort((a, b) => b.value - a.value),
  };
}

/** Width of a bar as a whole percentage of the longest bar in its list. */
export function barWidth(value: number, max: number): number {
  return Math.round((value / Math.max(1, max)) * 100);
}

// ---- The rows behind each figure and bar (shown when an owner clicks into it, and downloadable) ----

const UK_DATE_TIME = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: 'Europe/London' });
const UK_DATE = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Europe/London' });

export function ukDateTime(iso: string): string {
  return UK_DATE_TIME.format(new Date(iso)).replace(',', '');
}

export function ukDate(iso: string): string {
  return UK_DATE.format(new Date(iso));
}

export interface TableContext {
  gymName: string;
  /** e.g. "Last 30 days". */
  rangeLabel: string;
  now: Date;
}

function table(ctx: TableContext, title: string, headers: string[], rows: Cell[][]): ReportTable {
  return { title, subtitle: `${ctx.gymName} · ${ctx.rangeLabel} · made ${ukDateTime(ctx.now.toISOString())}`, headers, rows };
}

/** One row per class. `only` narrows it, for example to one day or one time of day. */
export function classesTable(ctx: TableContext, title: string, metrics: SessionMetric[], only?: (s: SessionMetric) => boolean): ReportTable {
  const rows = metrics
    .filter((s) => !only || only(s))
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())
    .map((s) => [s.name, ukDateTime(s.startsAt), s.capacity, s.booked, s.attended, s.noShow, pct(s.demand, s.capacity)]);
  return table(ctx, title, ['Class', 'Date and time (UK)', 'Places', 'Booked', 'Attended', 'No-show', 'Fill %'], rows);
}

/** Attendance by class name, for classes already started. */
export function attendanceTable(ctx: TableContext, title: string, metrics: SessionMetric[]): ReportTable {
  const past = metrics.filter((s) => new Date(s.startsAt) < ctx.now);
  const names = [...new Set(past.map((s) => s.name))];
  const rows = names
    .map((name) => {
      const a = past.filter((s) => s.name === name);
      const attended = sum(a, (s) => s.attended);
      const noShows = sum(a, (s) => s.noShow);
      return [name, a.length, attended, noShows, pct(attended, attended + noShows)] as Cell[];
    })
    .sort((a, b) => Number(b[2]) - Number(a[2]) || String(a[0]).localeCompare(String(b[0])));
  return table(ctx, title, ['Class', 'Sessions held', 'Attended', 'No-shows', 'Attendance %'], rows);
}

/** Estimated monthly income, plan by plan. */
export function incomeTable(ctx: TableContext, plans: PlanRow[], activeMemberships: ActiveMembership[]): ReportTable {
  const rows = plans
    .map((p) => {
      const count = activeMemberships.filter((m) => m.planId === p.id).length;
      const each = monthlyValue(p.priceInPence, p.interval);
      return [p.name, p.interval, reportMoney(p.priceInPence), count, reportMoney(Math.round(each * count))] as Cell[];
    })
    .sort((a, b) => Number(b[3]) - Number(a[3]));
  const none = activeMemberships.filter((m) => !plans.some((p) => p.id === m.planId)).length;
  if (none) rows.push(['(no plan)', '', '', none, reportMoney(0)]);
  return table(ctx, 'Estimated monthly income by plan', ['Plan', 'Billing', 'Price', 'Active members', 'Monthly value'], rows);
}

/** Members holding an active membership, optionally only on one plan. */
export function membershipsTable(ctx: TableContext, title: string, plans: PlanRow[], activeMemberships: ActiveMembership[], names: Map<string, string>, planId?: string): ReportTable {
  const planName = new Map(plans.map((p) => [p.id, p.name]));
  const rows = activeMemberships
    .filter((m) => planId === undefined || m.planId === planId)
    .map((m) => [names.get(m.userId) ?? 'Member', planName.get(m.planId) ?? '(no plan)'] as Cell[])
    .sort((a, b) => String(a[0]).localeCompare(String(b[0])));
  return table(ctx, title, ['Member', 'Plan'], rows);
}

/** People who joined inside the range, newest first. */
export function newMembersTable(ctx: TableContext, members: GymMemberRow[], names: Map<string, string>, since: string | null): ReportTable {
  const rows = members
    .filter((m) => !since || new Date(m.joinedAt) >= new Date(since))
    .sort((a, b) => new Date(b.joinedAt).getTime() - new Date(a.joinedAt).getTime())
    .map((m) => [names.get(m.userId) ?? 'Member', ukDate(m.joinedAt)] as Cell[]);
  return table(ctx, 'New members', ['Member', 'Joined'], rows);
}

/** The headline figures themselves, for downloading the whole Overview. */
export function overviewTable(ctx: TableContext, o: Overview): ReportTable {
  return table(ctx, 'Overview', ['Measure', 'Value'], [
    ['Active memberships', o.activeMemberships],
    ['Est. MRR', reportMoney(o.mrr)],
    ['Average class fill', `${o.avgFill}%`],
    ['Attendance rate', `${o.attendanceRate}%`],
    ['New members', o.newMembers],
    ['Class attendances', o.attendances],
    ['No-shows', o.noShows],
    ['Sessions analysed', o.sessions],
    ...o.byDay.map((d) => [`Busiest days: ${d.label}`, `${d.value}%`] as Cell[]),
    ...o.byBand.map((b) => [`Busiest times: ${b.label}`, `${b.value}%`] as Cell[]),
    ...o.planMix.map((p) => [`Membership mix: ${p.label}`, p.value] as Cell[]),
  ]);
}
