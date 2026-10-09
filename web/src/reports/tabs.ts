import type { LibraryData, LibPayment } from '../data/reportLibrary';
import { monthlyValue } from '../today/calc';
import { BANDS, DAYS, pct, sessionMetrics, table, type Band, type SessionMetric } from './calc';
import type { Cell, ReportTable } from './download';
import { pounds, type LibraryContext } from './library';

// The figures behind the old Reporting page's Memberships, Classes, Members and Payments tabs, as pure
// functions of the same plain rows the report library uses (so they are tested without a database).

const sum = (rows: SessionMetric[], pick: (s: SessionMetric) => number) => rows.reduce((n, s) => n + pick(s), 0);

/** Per-class counts, with the day and time-of-day band in UK time. */
export function metricsOf(d: LibraryData): SessionMetric[] {
  return sessionMetrics(
    d.sessions.map((s) => ({ id: s.id, name: s.name, startsAt: s.startsAt, capacity: s.capacity })),
    d.bookings.map((b) => ({ sessionId: b.sessionId, status: b.status })),
  );
}

// ---- Memberships ----

export interface PlanRow { id: string; name: string; members: number; mrr: number; share: number }
export interface MembershipsTab { active: number; mrr: number; activePlans: number; newJoins: number; plans: PlanRow[] }

export function membershipsTab(d: LibraryData, since: string | null): MembershipsTab {
  const active = d.memberships.filter((m) => m.status === 'active');
  const plans = d.plans
    .map((p) => {
      const members = active.filter((m) => m.planId === p.id).length;
      return { id: p.id, name: p.name, members, mrr: Math.round(monthlyValue(p.pricePence, p.interval) * members), share: pct(members, active.length) };
    })
    .sort((a, b) => b.members - a.members || a.name.localeCompare(b.name));
  return {
    active: active.length,
    mrr: plans.reduce((n, p) => n + p.mrr, 0),
    activePlans: d.plans.filter((p) => p.isActive).length,
    newJoins: d.gymMembers.filter((m) => !since || new Date(m.joinedAt) >= new Date(since)).length,
    plans,
  };
}

export function membershipsTable(ctx: LibraryContext, t: MembershipsTab): ReportTable {
  return table(ctx, 'Membership plans', ['Plan', 'Members', 'Est. monthly income', 'Share of active memberships'],
    t.plans.map((p) => [p.name, p.members, pounds(p.mrr), `${p.share}%`]));
}

// ---- Classes ----

export interface TypeRow { name: string; sessions: number; bookings: number; attended: number; fill: number }
export interface HeatCell { band: Band; fill: number; bookings: number; sessions: number; revenue: number }
export interface HeatRow { day: string; cells: HeatCell[] }
export type HeatMetric = 'fill' | 'bookings' | 'revenue';

/** What a heat cell shows for the chosen measure (pence for revenue). */
export const heatValue = (c: HeatCell, m: HeatMetric): number => (m === 'fill' ? c.fill : m === 'bookings' ? c.bookings : c.revenue);

/** Heat colour step 1 to 5 for a bookings or revenue figure, relative to the busiest slot. Nothing at all is step 1. */
export function relativeStep(value: number, max: number): 1 | 2 | 3 | 4 | 5 {
  if (!max || value <= 0) return 1;
  const r = value / max;
  return r >= 0.85 ? 5 : r >= 0.7 ? 4 : r >= 0.5 ? 3 : r >= 0.25 ? 2 : 1;
}

/** The best slots for a measure, busiest first, leaving out empty ones. */
export function bestSlots(heat: HeatRow[], m: HeatMetric, n = 3): { day: string; band: Band; value: number }[] {
  return heat.flatMap((r) => r.cells.map((c) => ({ day: r.day, band: c.band, value: heatValue(c, m) })))
    .filter((x) => x.value > 0)
    .sort((a, b) => b.value - a.value || a.day.localeCompare(b.day))
    .slice(0, n);
}
export interface ClassesTab { avgFill: number; attendances: number; noShows: number; sessions: number; byType: TypeRow[]; heat: HeatRow[] }

export function classesTab(d: LibraryData, now: Date): ClassesTab {
  const metrics = metricsOf(d);
  const past = metrics.filter((s) => new Date(s.startsAt) < now);
  const fill = (rows: SessionMetric[]) => pct(sum(rows, (s) => s.demand), sum(rows, (s) => s.capacity));
  const paid = new Map<string, number>();
  for (const p of d.purchases) if (p.status === 'paid') paid.set(p.sessionId, (paid.get(p.sessionId) ?? 0) + (Number(p.amountPence) || 0));
  const cell = (day: string, band: Band): HeatCell => {
    const rows = metrics.filter((s) => s.day === day && s.band === band);
    return { band, fill: fill(rows), bookings: sum(rows, (s) => s.demand), sessions: rows.length, revenue: sum(rows, (s) => paid.get(s.id) ?? 0) };
  };
  const byType = [...new Set(metrics.map((s) => s.name))]
    .map((name) => {
      const a = metrics.filter((s) => s.name === name);
      return { name, sessions: a.length, bookings: sum(a, (s) => s.demand), attended: sum(a, (s) => s.attended), fill: fill(a) };
    })
    .sort((a, b) => b.fill - a.fill || a.name.localeCompare(b.name));
  return {
    avgFill: fill(metrics),
    attendances: sum(past, (s) => s.attended),
    noShows: sum(past, (s) => s.noShow),
    sessions: metrics.length,
    byType,
    heat: DAYS.map((day) => ({ day, cells: BANDS.map((band) => cell(day, band)) })),
  };
}

/** Heat colour step 1 to 5 for a fill percentage, as on the old heatmap. */
export function heatStep(fill: number): 1 | 2 | 3 | 4 | 5 {
  return fill >= 85 ? 5 : fill >= 70 ? 4 : fill >= 50 ? 3 : fill >= 25 ? 2 : 1;
}

export function classPerformanceTable(ctx: LibraryContext, t: ClassesTab): ReportTable {
  return table(ctx, 'Class performance detail', ['Class', 'Sessions', 'Took a place', 'Attended', 'Average fill %'],
    t.byType.map((r) => [r.name, r.sessions, r.bookings, r.attended, r.fill]));
}

// ---- Members ----

export interface TopMember { userId: string; name: string; attended: number; activity: number; noShows: number }
export interface MembersTab { activeMembers: number; attending: number; attendances: number; noShowRate: number; top: TopMember[] }

export const TOP_MEMBERS = 12;

export function membersTab(d: LibraryData, now: Date): MembersTab {
  const counts = new Map<string, { attended: number; activity: number; noShows: number }>();
  for (const b of d.bookings) {
    const c = counts.get(b.userId) ?? { attended: 0, activity: 0, noShows: 0 };
    if (b.status === 'attended') c.attended++;
    if (['attended', 'booked', 'no_show'].includes(b.status)) c.activity++;
    if (b.status === 'no_show') c.noShows++;
    counts.set(b.userId, c);
  }
  const all = [...counts.entries()]
    .map(([userId, c]) => ({ userId, name: d.people.get(userId)?.name ?? 'Member', ...c }))
    .sort((a, b) => b.attended - a.attended || b.activity - a.activity || a.name.localeCompare(b.name));
  const past = metricsOf(d).filter((s) => new Date(s.startsAt) < now);
  const attendances = sum(past, (s) => s.attended);
  const noShows = sum(past, (s) => s.noShow);
  return {
    activeMembers: d.gymMembers.filter((m) => m.isActive).length,
    attending: all.filter((m) => m.attended > 0).length,
    attendances,
    noShowRate: pct(noShows, attendances + noShows),
    top: all.slice(0, TOP_MEMBERS),
  };
}

export function topMembersTable(ctx: LibraryContext, t: MembersTab): ReportTable {
  return table(ctx, 'Most active members', ['Rank', 'Member', 'Attended', 'Total activity', 'No-shows'],
    t.top.map((m, i) => [i + 1, m.name, m.attended, m.activity, m.noShows] as Cell[]));
}

// ---- Payments ----

export interface PaymentsTab { atRisk: LibPayment[]; outstanding: number; records: number }

/** Payments that failed or were charged back, and what they add up to. */
export function paymentsTab(d: LibraryData): PaymentsTab {
  const atRisk = d.payments.filter((p) => p.state === 'failed' || p.state === 'charged_back');
  return { atRisk, outstanding: atRisk.reduce((n, p) => n + (p.amountPence || 0), 0), records: d.payments.length };
}

export function atRiskTable(ctx: LibraryContext, d: LibraryData, t: PaymentsTab): ReportTable {
  return table(ctx, 'Failed and at-risk payments', ['Member', 'Charge date', 'Amount', 'State', 'Failure'],
    t.atRisk.map((p) => [d.people.get(p.userId)?.name ?? 'Member', p.chargeDate, pounds(p.amountPence), p.state, p.failure]));
}
