import type { PlanRow } from '../data/plans';
import type { GymMemberRow } from '../data/today';
import type { ReportBooking, ReportSession } from '../data/reports';
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
  /** Plan id of each active membership. */
  activePlanIds: string[];
  plans: PlanRow[];
  members: GymMemberRow[];
  since: string | null;
  now: Date;
}

/**
 * The Overview figures. Income per plan uses the same monthly values as the Today screen (annual and
 * quarterly plans are divided down to a month). Attendance rate only counts classes already started.
 */
export function buildOverview({ metrics, activePlanIds, plans, members, since, now }: OverviewInput): Overview {
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
