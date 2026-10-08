// The datasets the report builder offers. Each is a flat list of rows made from the data the Reports already load,
// with a fixed list of fields. Dates are the gym's (UK) calendar day. Money is in pence.
import type { LibraryData } from '../data/reportLibrary';
import { bandOf } from '../reports/calc';
import { ageBand, genderLabel, sessionStats } from '../reports/library';
import { londonParts } from '../classes/calc';
import { monthlyValue } from '../today/calc';
import type { Field, Row } from './engine';

export interface Dataset { id: string; label: string; description: string; fields: Field[]; rows: (d: LibraryData, now: Date) => Row[] }

const day = (iso: string): string | null => (iso ? londonParts(new Date(iso)).date : null);
const dateOnly = (v: string): string | null => (v ? v.slice(0, 10) : null);
const person = (d: LibraryData, id: string) => d.people.get(id);
const nameOf = (d: LibraryData, id: string) => person(d, id)?.name || 'Member';
const planOf = (d: LibraryData, id: string) => d.plans.find((p) => p.id === id);
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const members: Dataset = {
  id: 'members', label: 'Members', description: 'One row per member of the gym.',
  fields: [
    { id: 'name', label: 'Member', type: 'text' },
    { id: 'joined', label: 'Joined', type: 'date' },
    { id: 'left', label: 'Left on', type: 'date' },
    { id: 'active', label: 'Active', type: 'text' },
    { id: 'plan', label: 'Current plan', type: 'text' },
    { id: 'status', label: 'Membership status', type: 'text' },
    { id: 'monthly', label: 'Monthly value', type: 'money' },
    { id: 'age', label: 'Age band', type: 'text', sensitive: true },
    { id: 'gender', label: 'Gender', type: 'text', sensitive: true },
  ],
  rows: (d, now) => d.gymMembers.map((g) => {
    const ms = d.memberships.filter((m) => m.userId === g.userId).sort((a, b) => b.startsOn.localeCompare(a.startsOn));
    const m = ms.find((x) => x.status === 'active') ?? ms[0];
    const plan = m ? planOf(d, m.planId) : undefined;
    const p = person(d, g.userId);
    return {
      name: nameOf(d, g.userId), joined: day(g.joinedAt), left: dateOnly(g.attritionOn), active: g.isActive ? 'Yes' : 'No',
      plan: plan?.name ?? '', status: m?.status ?? '', monthly: m && m.status === 'active' && plan ? Math.round(monthlyValue(plan.pricePence, plan.interval)) : null,
      age: ageBand(p?.dateOfBirth ?? '', now), gender: genderLabel(p?.gender ?? ''),
    };
  }),
};

const memberships: Dataset = {
  id: 'memberships', label: 'Memberships', description: 'One row per membership: who has which plan.',
  fields: [
    { id: 'member', label: 'Member', type: 'text' },
    { id: 'plan', label: 'Plan', type: 'text' },
    { id: 'status', label: 'Status', type: 'text' },
    { id: 'starts', label: 'Starts', type: 'date' },
    { id: 'ends', label: 'Ends', type: 'date' },
    { id: 'provider', label: 'Payment provider', type: 'text' },
    { id: 'payment', label: 'Payment status', type: 'text' },
    { id: 'price', label: 'Plan price', type: 'money' },
    { id: 'monthly', label: 'Monthly value', type: 'money' },
  ],
  rows: (d) => d.memberships.map((m) => {
    const plan = planOf(d, m.planId);
    return {
      member: nameOf(d, m.userId), plan: plan?.name ?? '', status: m.status, starts: dateOnly(m.startsOn), ends: dateOnly(m.endsOn), provider: m.provider, payment: m.paymentStatus,
      price: plan ? plan.pricePence : null, monthly: plan ? Math.round(monthlyValue(plan.pricePence, plan.interval)) : null,
    };
  }),
};

const payments: Dataset = {
  id: 'payments', label: 'Payments', description: 'One row per payment record: money taken, failed or pending.',
  fields: [
    { id: 'member', label: 'Member', type: 'text' },
    { id: 'date', label: 'Charge date', type: 'date' },
    { id: 'amount', label: 'Amount', type: 'money' },
    { id: 'state', label: 'State', type: 'text' },
    { id: 'provider', label: 'Provider', type: 'text' },
    { id: 'plan', label: 'Plan', type: 'text' },
    { id: 'failure', label: 'Failure reason', type: 'text' },
  ],
  rows: (d) => {
    const byMembership = new Map(d.memberships.map((m) => [m.id, m]));
    return d.payments.map((p) => {
      const m = byMembership.get(p.membershipId);
      return { member: nameOf(d, p.userId), date: dateOnly(p.chargeDate) ?? day(p.createdAt), amount: p.amountPence, state: p.state, provider: p.provider, plan: m ? planOf(d, m.planId)?.name ?? '' : '', failure: p.failure };
    });
  },
};

const classes: Dataset = {
  id: 'classes', label: 'Classes', description: 'One row per class that was scheduled, with how full it was.',
  fields: [
    { id: 'class', label: 'Class', type: 'text' },
    { id: 'date', label: 'Date', type: 'date' },
    { id: 'day', label: 'Day of week', type: 'text' },
    { id: 'band', label: 'Time of day', type: 'text' },
    { id: 'capacity', label: 'Capacity', type: 'number' },
    { id: 'booked', label: 'Took a place', type: 'number' },
    { id: 'attended', label: 'Attended', type: 'number' },
    { id: 'noshow', label: 'No-shows', type: 'number' },
    { id: 'fill', label: 'Fill %', type: 'number' },
    { id: 'dropin', label: 'Drop-in price', type: 'money' },
  ],
  rows: (d) => sessionStats(d).map((s) => {
    const p = londonParts(new Date(s.session.startsAt));
    return {
      class: s.session.name, date: p.date, day: DAYS[p.weekday] ?? '', band: bandOf(Number(p.time.slice(0, 2))), capacity: s.session.capacity, booked: s.demand, attended: s.attended, noshow: s.noShow,
      fill: s.session.capacity > 0 ? Math.round((s.demand / s.session.capacity) * 100) : 0, dropin: s.session.dropInPence,
    };
  }),
};

const bookings: Dataset = {
  id: 'bookings', label: 'Bookings and attendance', description: 'One row per class booking: who, which class, and whether they came.',
  fields: [
    { id: 'member', label: 'Member', type: 'text' },
    { id: 'class', label: 'Class', type: 'text' },
    { id: 'classDate', label: 'Class date', type: 'date' },
    { id: 'status', label: 'Status', type: 'text' },
    { id: 'booked', label: 'Booked on', type: 'date' },
    { id: 'cancelled', label: 'Cancelled on', type: 'date' },
  ],
  rows: (d) => {
    const byId = new Map(d.sessions.map((s) => [s.id, s]));
    return d.bookings.map((b) => {
      const s = byId.get(b.sessionId);
      return { member: nameOf(d, b.userId), class: s?.name ?? '', classDate: s ? day(s.startsAt) : null, status: b.status, booked: day(b.bookedAt), cancelled: day(b.cancelledAt) };
    });
  },
};

const hoursBetween = (a: string, b: string) => Math.max(0, (new Date(b).getTime() - new Date(a).getTime()) / 3600000);
const timeHours = (t: string) => { const [h = 0, m = 0] = t.split(':').map(Number); return h + m / 60; };
const round2 = (n: number) => Math.round(n * 100) / 100;
const roleName = (r: string) => (r === 'coach' ? 'Coach / PT' : r.charAt(0).toUpperCase() + r.slice(1));

const staff: Dataset = {
  id: 'staff', label: 'Staff', description: 'One row per person on the team: their role and the working hours set up for them.',
  fields: [
    { id: 'name', label: 'Name', type: 'text' },
    { id: 'role', label: 'Role', type: 'text' },
    { id: 'job', label: 'Job title', type: 'text' },
    { id: 'days', label: 'Days a week working', type: 'number' },
    { id: 'hours', label: 'Scheduled hours a week', type: 'number' },
    { id: 'pay', label: 'Hourly pay', type: 'money', sensitive: true },
  ],
  rows: (d) => d.staff.map((s) => {
    const h = d.staffHours.filter((x) => x.userId === s.userId && x.isWorking && x.start && x.end);
    return { name: s.name, role: roleName(s.role), job: s.jobTitle, days: h.length, hours: round2(h.reduce((n, x) => n + Math.max(0, timeHours(x.end) - timeHours(x.start)), 0)), pay: s.payPence };
  }),
};

const delivered: Dataset = {
  id: 'delivered', label: 'Classes delivered', description: 'One row for each class a coach or member of staff was on, with its length and how many came.',
  fields: [
    { id: 'coach', label: 'Coach', type: 'text' },
    { id: 'class', label: 'Class', type: 'text' },
    { id: 'date', label: 'Date', type: 'date' },
    { id: 'day', label: 'Day of week', type: 'text' },
    { id: 'band', label: 'Time of day', type: 'text' },
    { id: 'role', label: 'Lead or assistant', type: 'text' },
    { id: 'hours', label: 'Hours', type: 'number' },
    { id: 'attended', label: 'Attended', type: 'number' },
    { id: 'booked', label: 'Took a place', type: 'number' },
  ],
  rows: (d) => {
    const stats = new Map(sessionStats(d).map((s) => [s.session.id, s]));
    const names = new Map(d.staff.map((s) => [s.userId, s.name]));
    return d.sessionStaff.flatMap((a) => {
      const st = stats.get(a.sessionId);
      if (!st) return [];
      const p = londonParts(new Date(st.session.startsAt));
      return [{
        coach: names.get(a.userId) ?? nameOf(d, a.userId), class: st.session.name, date: p.date, day: DAYS[p.weekday] ?? '', band: bandOf(Number(p.time.slice(0, 2))),
        role: a.isLead ? 'Lead' : 'Assistant', hours: round2(hoursBetween(st.session.startsAt, st.session.endsAt)), attended: st.attended, booked: st.demand,
      }];
    });
  },
};

const seen: Dataset = {
  id: 'seen', label: 'Clients seen', description: 'One row each time a coach saw a client: a class they attended, or a personal training session.',
  fields: [
    { id: 'coach', label: 'Coach', type: 'text' },
    { id: 'client', label: 'Client', type: 'text' },
    { id: 'date', label: 'Date', type: 'date' },
    { id: 'kind', label: 'Class or PT', type: 'text' },
    { id: 'what', label: 'What it was', type: 'text' },
    { id: 'status', label: 'Status', type: 'text' },
    { id: 'hours', label: 'Hours', type: 'number' },
  ],
  rows: (d) => {
    const names = new Map(d.staff.map((s) => [s.userId, s.name]));
    const sessions = new Map(d.sessions.map((s) => [s.id, s]));
    const coachesOf = new Map<string, string[]>();
    for (const a of d.sessionStaff) coachesOf.set(a.sessionId, [...(coachesOf.get(a.sessionId) ?? []), a.userId]);
    const fromClasses = d.bookings.filter((b) => b.status === 'attended').flatMap((b) => {
      const s = sessions.get(b.sessionId);
      if (!s) return [];
      return (coachesOf.get(b.sessionId) ?? []).map((c) => ({ coach: names.get(c) ?? nameOf(d, c), client: nameOf(d, b.userId), date: day(s.startsAt), kind: 'Class', what: s.name, status: 'Attended', hours: round2(hoursBetween(s.startsAt, s.endsAt)) }));
    });
    const fromPt = d.pt.filter((p) => p.memberId).map((p) => ({ coach: names.get(p.staffId) ?? nameOf(d, p.staffId), client: nameOf(d, p.memberId), date: day(p.startsAt), kind: 'PT', what: 'Personal training', status: p.status.replace('_', ' '), hours: round2(hoursBetween(p.startsAt, p.endsAt)) }));
    return [...fromClasses, ...fromPt];
  },
};

export const DATASETS: Dataset[] = [members, memberships, payments, classes, bookings, staff, delivered, seen];
