import type { LibBooking, LibPerson, LibSession, LibraryData } from '../data/reportLibrary';
import { monthlyValue } from '../today/calc';
import { pct, table, ukDate, ukDateTime, type TableContext } from './calc';
import type { Cell, ReportTable } from './download';

// The 24 reports from the old Reporting page's library, rebuilt as pure functions of plain rows (so they
// are tested without a database). Same reports, same columns and the same meaning as the old page, with
// three deliberate changes: money in the payment and sales reports shows pence (the old page rounded
// £29.99 to £30); the "Inactive members" report compares real dates (the old comparison was unreliable);
// and times are shown in UK time.

export interface LibraryContext extends TableContext {
  /** Start of the chosen range, or null for all time. */
  since: string | null;
}

export interface LibraryReport {
  key: string;
  title: string;
  description: string;
  build: (ctx: LibraryContext, d: LibraryData) => ReportTable;
}

export interface LibraryGroup {
  group: string;
  reports: LibraryReport[];
}

const NO_PERSON: LibPerson = { name: 'Member', dateOfBirth: '', gender: '' };
const who = (d: LibraryData, userId: string) => d.people.get(userId)?.name ?? NO_PERSON.name;
const person = (d: LibraryData, userId: string) => d.people.get(userId) ?? NO_PERSON;

/** Pounds and pence, for money that has to add up (payments, sales). */
export function pounds(pence: number): string {
  return '£' + ((Number(pence) || 0) / 100).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** A date or time falls inside the range. Rows with no date are kept, as on the old page. */
export function inRange(since: string | null, iso: string): boolean {
  return !since || !iso || new Date(iso) >= new Date(since);
}

const date = (iso: string) => (iso ? ukDate(iso) : '');
const dateTime = (iso: string) => (iso ? ukDateTime(iso) : '');

export function genderLabel(value: string): string {
  return ({ female: 'Female', male: 'Male', non_binary: 'Non-binary', other: 'Other', prefer_not_to_say: 'Prefer not to say' } as Record<string, string>)[value] ?? 'Not set';
}

/** Whole years old on `now`, or null when there is no date of birth. */
export function ageOn(dateOfBirth: string, now: Date): number | null {
  if (!dateOfBirth) return null;
  const b = new Date(`${dateOfBirth}T00:00:00Z`);
  if (Number.isNaN(b.getTime())) return null;
  let age = now.getUTCFullYear() - b.getUTCFullYear();
  if (now.getUTCMonth() < b.getUTCMonth() || (now.getUTCMonth() === b.getUTCMonth() && now.getUTCDate() < b.getUTCDate())) age--;
  return age;
}

export function ageBand(dateOfBirth: string, now: Date): string {
  const a = ageOn(dateOfBirth, now);
  if (a === null) return 'Not set';
  if (a < 18) return 'Under 18';
  if (a < 25) return '18–24';
  if (a < 35) return '25–34';
  if (a < 45) return '35–44';
  if (a < 55) return '45–54';
  if (a < 65) return '55–64';
  return '65+';
}

/** Count rows by a label, biggest first (ties alphabetical). */
function groupCount<T>(rows: T[], key: (r: T) => string): Cell[][] {
  const m = new Map<string, number>();
  for (const r of rows) m.set(key(r), (m.get(key(r)) ?? 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([k, n]) => [k, n]);
}

interface SessionStat { session: LibSession; booked: number; attended: number; noShow: number; demand: number }

/** Per class: who took a place (booked, attended, no-show) and how full it was. */
export function sessionStats(d: LibraryData): SessionStat[] {
  const counts = new Map<string, { booked: number; attended: number; noShow: number }>();
  for (const b of d.bookings) {
    const c = counts.get(b.sessionId) ?? { booked: 0, attended: 0, noShow: 0 };
    if (b.status === 'booked') c.booked++;
    else if (b.status === 'attended') c.attended++;
    else if (b.status === 'no_show') c.noShow++;
    counts.set(b.sessionId, c);
  }
  return d.sessions.map((session) => {
    const c = counts.get(session.id) ?? { booked: 0, attended: 0, noShow: 0 };
    return { session, ...c, demand: c.booked + c.attended + c.noShow };
  });
}

function bookingRows(ctx: LibraryContext, d: LibraryData): { b: LibBooking; className: string; sessionStart: string }[] {
  const byId = new Map(d.sessions.map((s) => [s.id, s]));
  return d.bookings
    .filter((b) => inRange(ctx.since, b.bookedAt))
    .map((b) => ({ b, className: byId.get(b.sessionId)?.name ?? '', sessionStart: byId.get(b.sessionId)?.startsAt ?? '' }));
}

const planName = (d: LibraryData, id: string) => d.plans.find((p) => p.id === id)?.name ?? '';

export const LIBRARY: LibraryGroup[] = [
  {
    group: 'Membership & growth',
    reports: [
      {
        key: 'membership_register', title: 'Membership register', description: 'Every membership with plan, status, start/end dates and payment state.',
        build: (ctx, d) => table(ctx, 'Membership register', ['Member', 'Plan', 'Status', 'Starts', 'Ends', 'Payment status'],
          d.memberships.map((m) => [who(d, m.userId), planName(d, m.planId), m.status, m.startsOn, m.endsOn, m.paymentStatus])),
      },
      {
        key: 'active_memberships', title: 'Active memberships', description: 'Current active customer subscriptions and payment status.',
        build: (ctx, d) => table(ctx, 'Active memberships', ['Member', 'Plan', 'Starts', 'Payment provider', 'Payment status'],
          d.memberships.filter((m) => m.status === 'active').map((m) => [who(d, m.userId), planName(d, m.planId), m.startsOn, m.provider, m.paymentStatus])),
      },
      {
        key: 'membership_plan_mix', title: 'Membership plan mix', description: 'Active member count and estimated recurring revenue by plan.',
        build: (ctx, d) => {
          const active = d.memberships.filter((m) => m.status === 'active');
          const rows = d.plans
            .map((p) => {
              const n = active.filter((m) => m.planId === p.id).length;
              return [p.name, n, pounds(Math.round(monthlyValue(p.pricePence, p.interval) * n))] as Cell[];
            })
            .sort((a, b) => Number(b[1]) - Number(a[1]) || String(a[0]).localeCompare(String(b[0])));
          return table(ctx, 'Membership plan mix', ['Plan', 'Active members', 'Est. monthly income'], rows);
        },
      },
      {
        key: 'membership_changes', title: 'Membership changes', description: 'Membership records changed within the selected reporting window.',
        build: (ctx, d) => table(ctx, 'Membership changes', ['Member', 'Plan', 'Status', 'Starts', 'Ends', 'Updated'],
          d.memberships.filter((m) => inRange(ctx.since, m.updatedAt)).map((m) => [who(d, m.userId), planName(d, m.planId), m.status, m.startsOn, m.endsOn, dateTime(m.updatedAt)])),
      },
    ],
  },
  {
    group: 'Lifecycle & retention',
    reports: [
      {
        key: 'member_lifecycle', title: 'Member lifecycle', description: 'Joined date, attrition date, current state and demographics.',
        build: (ctx, d) => table(ctx, 'Member lifecycle', ['Member', 'Joined', 'Attrition', 'State', 'Age', 'Gender'],
          d.gymMembers.map((m) => [who(d, m.userId), date(m.joinedAt), date(m.attritionOn), m.attritionOn ? 'Left' : 'Live', ageOn(person(d, m.userId).dateOfBirth, ctx.now) ?? '', genderLabel(person(d, m.userId).gender)])),
      },
      {
        key: 'attrition_log', title: 'Attrition log', description: 'Customers who left in the selected period with lifecycle length.',
        build: (ctx, d) => table(ctx, 'Attrition log', ['Member', 'Joined', 'Attrition', 'Days as a member'],
          d.gymMembers.filter((m) => m.attritionOn && inRange(ctx.since, m.attritionOn)).map((m) => [who(d, m.userId), date(m.joinedAt), date(m.attritionOn), Math.max(0, Math.round((new Date(m.attritionOn).getTime() - new Date(m.joinedAt).getTime()) / 86400000))])),
      },
      {
        key: 'joins_attrition_monthly', title: 'Monthly joins vs attrition', description: 'Monthly new customers, attrition and net movement.',
        build: (ctx, d) => {
          const months = new Map<string, { joined: number; left: number }>();
          const bump = (iso: string, field: 'joined' | 'left') => {
            const k = iso.slice(0, 7);
            const x = months.get(k) ?? { joined: 0, left: 0 };
            x[field]++;
            months.set(k, x);
          };
          for (const m of d.gymMembers) {
            if (m.joinedAt) bump(m.joinedAt, 'joined');
            if (m.attritionOn) bump(m.attritionOn, 'left');
          }
          return table(ctx, 'Monthly joins vs attrition', ['Month', 'Joined', 'Attrition', 'Net'],
            [...months.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([k, x]) => [k, x.joined, x.left, x.joined - x.left]));
        },
      },
      {
        key: 'age_demographics', title: 'Age demographics', description: 'Current member population grouped by age band.',
        build: (ctx, d) => table(ctx, 'Age demographics', ['Age band', 'Members'], groupCount(d.gymMembers, (m) => ageBand(person(d, m.userId).dateOfBirth, ctx.now))),
      },
      {
        key: 'gender_demographics', title: 'Gender demographics', description: 'Current member population by self-described gender.',
        build: (ctx, d) => table(ctx, 'Gender demographics', ['Gender', 'Members'], groupCount(d.gymMembers, (m) => genderLabel(person(d, m.userId).gender))),
      },
    ],
  },
  {
    group: 'Classes & attendance',
    reports: [
      {
        key: 'class_sessions', title: 'Class session detail', description: 'Session-level capacity, demand, attendance, no-shows and fill rate.',
        build: (ctx, d) => table(ctx, 'Class session detail', ['Class', 'Starts', 'Ends', 'Places', 'Took a place', 'Attended', 'No-show', 'Fill %', 'Drop-in price'],
          sessionStats(d).map((s) => [s.session.name, dateTime(s.session.startsAt), dateTime(s.session.endsAt), s.session.capacity, s.demand, s.attended, s.noShow, pct(s.demand, s.session.capacity), s.session.dropInPence === null ? '' : pounds(s.session.dropInPence)])),
      },
      {
        key: 'class_performance', title: 'Class performance', description: 'Aggregated performance by class type.',
        build: (ctx, d) => {
          const stats = sessionStats(d);
          const rows = [...new Set(stats.map((s) => s.session.name))].map((name) => {
            const a = stats.filter((s) => s.session.name === name);
            const demand = a.reduce((n, s) => n + s.demand, 0);
            const cap = a.reduce((n, s) => n + s.session.capacity, 0);
            return [name, a.length, demand, a.reduce((n, s) => n + s.attended, 0), a.reduce((n, s) => n + s.noShow, 0), pct(demand, cap)] as Cell[];
          });
          rows.sort((a, b) => Number(b[5]) - Number(a[5]) || String(a[0]).localeCompare(String(b[0])));
          return table(ctx, 'Class performance', ['Class', 'Sessions', 'Took a place', 'Attended', 'No-show', 'Average fill %'], rows);
        },
      },
      {
        key: 'attendance_log', title: 'Attendance log', description: 'Member-by-member booking and attendance history.',
        build: (ctx, d) => table(ctx, 'Attendance log', ['Member', 'Class', 'Session', 'Status', 'Booked', 'Cancelled'],
          bookingRows(ctx, d).map(({ b, className, sessionStart }) => [who(d, b.userId), className, dateTime(sessionStart), b.status, dateTime(b.bookedAt), dateTime(b.cancelledAt)])),
      },
      {
        key: 'no_shows', title: 'No-shows', description: 'All no-show events in the selected reporting window.',
        build: (ctx, d) => table(ctx, 'No-shows', ['Member', 'Class', 'Session', 'Booked'],
          bookingRows(ctx, d).filter(({ b }) => b.status === 'no_show').map(({ b, className, sessionStart }) => [who(d, b.userId), className, dateTime(sessionStart), dateTime(b.bookedAt)])),
      },
      {
        key: 'cancellations', title: 'Cancellations', description: 'Cancelled class bookings in the selected reporting window.',
        build: (ctx, d) => table(ctx, 'Cancellations', ['Member', 'Class', 'Session', 'Cancelled'],
          bookingRows(ctx, d).filter(({ b }) => b.status === 'cancelled').map(({ b, className, sessionStart }) => [who(d, b.userId), className, dateTime(sessionStart), dateTime(b.cancelledAt)])),
      },
      {
        key: 'member_attendance', title: 'Member attendance ranking', description: 'Member activity ranked by recorded class activity.',
        build: (ctx, d) => {
          const counts = new Map<string, number>();
          for (const b of d.bookings) if (['attended', 'booked', 'no_show'].includes(b.status)) counts.set(b.userId, (counts.get(b.userId) ?? 0) + 1);
          return table(ctx, 'Member attendance ranking', ['Member', 'Activity count'],
            [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([u, n]) => [who(d, u), n]));
        },
      },
      {
        key: 'inactive_members', title: 'Inactive members', description: 'Live customers with no recent recorded class attendance.',
        build: (ctx, d) => {
          const byId = new Map(d.sessions.map((s) => [s.id, s.startsAt]));
          const last = new Map<string, string>();
          for (const b of d.bookings) {
            const at = b.status === 'attended' ? byId.get(b.sessionId) : undefined;
            if (at && at > (last.get(b.userId) ?? '')) last.set(b.userId, at);
          }
          const rows = d.gymMembers
            .filter((m) => !m.attritionOn)
            .map((m) => ({ m, at: last.get(m.userId) ?? '' }))
            .filter(({ at }) => !at || (ctx.since !== null && new Date(at) < new Date(ctx.since)))
            .map(({ m, at }) => [who(d, m.userId), date(m.joinedAt), at ? dateTime(at) : 'Never'] as Cell[]);
          return table(ctx, 'Inactive members', ['Member', 'Joined', 'Last recorded attendance'], rows);
        },
      },
    ],
  },
  {
    group: 'Revenue & payments',
    reports: [
      {
        key: 'payment_ledger', title: 'Payment ledger', description: 'Payment records, charge dates, values, states and provider information.',
        build: (ctx, d) => table(ctx, 'Payment ledger', ['Member', 'Charge date', 'Amount', 'State', 'Provider', 'Failure'],
          d.payments.filter((p) => inRange(ctx.since, p.chargeDate || p.createdAt)).map((p) => [who(d, p.userId), p.chargeDate, pounds(p.amountPence), p.state, p.provider, p.failure])),
      },
      {
        key: 'failed_payments', title: 'Failed payments', description: 'Failed and charged-back payments requiring recovery.',
        build: (ctx, d) => table(ctx, 'Failed payments', ['Member', 'Charge date', 'Amount', 'State', 'Failure'],
          d.payments.filter((p) => p.state === 'failed' || p.state === 'charged_back').map((p) => [who(d, p.userId), p.chargeDate, pounds(p.amountPence), p.state, p.failure])),
      },
      {
        key: 'revenue_by_state', title: 'Revenue by payment state', description: 'Payment record count and value grouped by state.',
        build: (ctx, d) => {
          const m = new Map<string, { n: number; v: number }>();
          for (const p of d.payments) {
            const x = m.get(p.state || 'unknown') ?? { n: 0, v: 0 };
            x.n++;
            x.v += Number(p.amountPence) || 0;
            m.set(p.state || 'unknown', x);
          }
          return table(ctx, 'Revenue by payment state', ['Payment state', 'Records', 'Value'],
            [...m.entries()].sort((a, b) => b[1].v - a[1].v || a[0].localeCompare(b[0])).map(([k, x]) => [k, x.n, pounds(x.v)]));
        },
      },
      {
        key: 'drop_in_sales', title: 'Drop-in class sales', description: 'Individual paid class bookings and their payment status.',
        build: (ctx, d) => {
          const byId = new Map(d.sessions.map((s) => [s.id, s.name]));
          return table(ctx, 'Drop-in class sales', ['Member', 'Class', 'Created', 'Amount', 'Status'],
            d.purchases.filter((p) => inRange(ctx.since, p.createdAt)).map((p) => [who(d, p.userId), byId.get(p.sessionId) ?? '', dateTime(p.createdAt), pounds(p.amountPence), p.status]));
        },
      },
    ],
  },
  {
    group: 'Workouts & PT',
    reports: [
      {
        key: 'workout_assignments', title: 'Workout assignments', description: 'PT, WOD and self-assigned workouts with completion status and RPE.',
        build: (ctx, d) => table(ctx, 'Workout assignments', ['Member', 'Workout', 'Type', 'Source', 'Status', 'Scheduled', 'Completed', 'RPE'],
          d.assignments.filter((w) => inRange(ctx.since, w.createdAt)).map((w) => [who(d, w.userId), w.title, w.type, w.source, w.status, w.scheduledFor, dateTime(w.completedAt), w.rpe ?? ''])),
      },
      {
        key: 'workout_completion', title: 'Workout completion', description: 'Assigned workout volume grouped by current status.',
        build: (ctx, d) => table(ctx, 'Workout completion', ['Status', 'Assignments'], groupCount(d.assignments.filter((w) => inRange(ctx.since, w.createdAt)), (w) => w.status || 'unknown')),
      },
      {
        key: 'workout_sessions', title: 'Completed workout sessions', description: 'Recorded member workout sessions in the selected period.',
        build: (ctx, d) => table(ctx, 'Completed workout sessions', ['Member', 'Workout', 'Performed', 'Notes'],
          d.workoutSessions.filter((w) => inRange(ctx.since, w.performedAt)).map((w) => [who(d, w.userId), w.title, dateTime(w.performedAt), w.notes])),
      },
      {
        key: 'pt_appointments', title: 'PT appointments', description: 'Member/PT appointment schedule and status history.',
        build: (ctx, d) => table(ctx, 'PT appointments', ['Member', 'PT / staff', 'Starts', 'Ends', 'Status', 'Notes'],
          d.pt.filter((p) => inRange(ctx.since, p.startsAt)).map((p) => [p.memberId ? who(d, p.memberId) : '', who(d, p.staffId), dateTime(p.startsAt), dateTime(p.endsAt), p.status, p.notes])),
      },
    ],
  },
];

export const LIBRARY_COUNT = LIBRARY.reduce((n, g) => n + g.reports.length, 0);

/** Filter the library by a search: matches the report name, its description or its group. */
export function searchLibrary(query: string): LibraryGroup[] {
  const q = query.trim().toLowerCase();
  if (!q) return LIBRARY;
  return LIBRARY.map((g) => ({ group: g.group, reports: g.reports.filter((r) => `${r.title} ${r.description} ${g.group}`.toLowerCase().includes(q)) })).filter((g) => g.reports.length > 0);
}

/** Rows shown on screen for a report; the downloads always include every row. */
export const PREVIEW_ROWS = 100;
