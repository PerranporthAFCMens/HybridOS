import { describe, expect, it } from 'vitest';
import { barWidth, bandOf, buildOverview, pct, rangeStart, reportMoney, sessionMetrics } from '../src/reports/calc';
import type { PlanRow } from '../src/data/plans';
import type { ReportBooking, ReportSession } from '../src/data/reports';

const plan = (id: string, name: string, priceInPence: number, interval: string): PlanRow => ({ id, name, priceInPence, interval, accessType: 'hybrid', isActive: true });
const session = (id: string, startsAt: string, capacity = 10, name = 'Class'): ReportSession => ({ id, name, startsAt, capacity });
const bk = (sessionId: string, status: string, n = 1): ReportBooking[] => Array.from({ length: n }, () => ({ sessionId, status }));

describe('small helpers', () => {
  it('pct rounds and never divides by zero', () => {
    expect([pct(1, 3), pct(2, 3), pct(5, 0), pct(0, 0)]).toEqual([33, 67, 0, 0]);
  });
  it('shows whole pounds with separators', () => {
    expect([reportMoney(0), reportMoney(4550), reportMoney(123456789)]).toEqual(['£0', '£46', '£1,234,568']);
  });
  it('bar widths are relative to the longest bar, and safe when all are zero', () => {
    expect([barWidth(50, 100), barWidth(100, 100), barWidth(0, 0)]).toEqual([50, 100, 0]);
  });
  it('range start: null for all time, else that many days back', () => {
    const now = new Date('2026-10-07T12:00:00Z');
    expect(rangeStart(0, now)).toBeNull();
    expect(rangeStart(30, now)).toBe(new Date('2026-09-07T12:00:00Z').toISOString());
  });
  it('splits the day into the old four bands', () => {
    expect([8, 9, 15, 16, 20, 21, 23].map(bandOf)).toEqual(['Morning', 'Daytime', 'Daytime', 'Evening', 'Evening', 'Late', 'Late']);
    expect(bandOf(0)).toBe('Morning');
  });
});

describe('sessionMetrics', () => {
  // 7 Oct 2026 is a Wednesday and BST (UTC+1): 17:30Z is 18:30 UK = Evening; 22:30Z is 23:30 UK = Late
  const sessions = [session('a', '2026-10-07T17:30:00Z'), session('b', '2026-10-07T22:30:00Z'), session('c', '2026-01-07T09:00:00Z')];
  const m = sessionMetrics(sessions, [...bk('a', 'booked', 3), ...bk('a', 'attended', 2), ...bk('a', 'no_show'), ...bk('a', 'cancelled', 4)]);
  it('counts by status; cancelled bookings take no place', () => {
    expect([m[0]?.booked, m[0]?.attended, m[0]?.noShow, m[0]?.demand]).toEqual([3, 2, 1, 6]);
    expect(m[1]?.demand).toBe(0);
  });
  it('uses UK time for the day and band', () => {
    expect([m[0]?.day, m[0]?.band]).toEqual(['Wed', 'Evening']);
    expect([m[1]?.day, m[1]?.band]).toEqual(['Wed', 'Late']);
    // January is GMT: 09:00Z is 09:00 UK
    expect([m[2]?.day, m[2]?.band]).toEqual(['Wed', 'Daytime']);
  });
});

describe('buildOverview', () => {
  const now = new Date('2026-10-07T12:00:00Z');
  const plans = [plan('p1', 'Monthly', 4500, 'monthly'), plan('p2', 'Annual', 48000, 'annual'), plan('p3', 'Weekly', 1200, 'weekly'), plan('p4', 'Unused', 100, 'monthly')];
  const sessions = [
    session('past', '2026-10-05T17:30:00Z', 10), // Monday evening, already happened
    session('future', '2026-10-09T17:30:00Z', 10), // Friday evening, not yet
  ];
  const bookings = [...bk('past', 'attended', 6), ...bk('past', 'no_show', 2), ...bk('past', 'booked'), ...bk('future', 'booked', 4)];
  const metrics = sessionMetrics(sessions, bookings);
  const o = buildOverview({
    metrics, plans, now, since: '2026-09-07T12:00:00.000Z',
    activePlanIds: ['p1', 'p1', 'p2', 'p3', ''],
    members: [
      { userId: '1', joinedAt: '2026-10-01T00:00:00', attritionOn: null },
      { userId: '2', joinedAt: '2026-01-01T00:00:00', attritionOn: null },
    ],
  });
  it('counts active memberships including one with no plan', () => expect(o.activeMemberships).toBe(5));
  it('estimates monthly income, dividing annual and weekly plans to a month', () => {
    // 4500 + 4500 + 48000/12 (4000) + 1200*52/12 (5200) + nothing for no plan
    expect(o.mrr).toBe(4500 + 4500 + 4000 + 5200);
  });
  it('average fill counts every class: demand 13 of capacity 20', () => expect(o.avgFill).toBe(65));
  it('attendance rate only counts classes already started', () => {
    expect([o.attendances, o.noShows, o.attendanceRate]).toEqual([6, 2, 75]);
  });
  it('new members only inside the range', () => expect(o.newMembers).toBe(1));
  it('all time counts every member', () => {
    expect(buildOverview({ metrics, plans, now, since: null, activePlanIds: [], members: [{ userId: '1', joinedAt: '2020-01-01T00:00:00', attritionOn: null }] }).newMembers).toBe(1);
  });
  it('busiest days and times, in week order', () => {
    expect(o.byDay.map((d) => d.label)).toEqual(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);
    expect(o.byDay.find((d) => d.label === 'Mon')?.value).toBe(90); // 9 of 10
    expect(o.byDay.find((d) => d.label === 'Fri')?.value).toBe(40);
    expect(o.byDay.find((d) => d.label === 'Tue')?.value).toBe(0);
    expect(o.byBand.map((b) => b.label)).toEqual(['Morning', 'Daytime', 'Evening', 'Late']);
    expect(o.byBand.find((b) => b.label === 'Evening')?.value).toBe(65);
  });
  it('plan mix lists every plan, biggest first', () => {
    expect(o.planMix[0]).toEqual({ label: 'Monthly', value: 2 });
    expect(o.planMix.find((p) => p.label === 'Unused')?.value).toBe(0);
    expect(o.planMix).toHaveLength(4);
  });
  it('an empty gym gives zeros, not errors', () => {
    const e = buildOverview({ metrics: [], plans: [], now, since: null, activePlanIds: [], members: [] });
    expect([e.activeMemberships, e.mrr, e.avgFill, e.attendanceRate, e.newMembers, e.sessions]).toEqual([0, 0, 0, 0, 0, 0]);
  });
});
