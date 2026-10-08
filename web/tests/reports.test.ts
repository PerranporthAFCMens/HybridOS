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
    activeMemberships: ['p1', 'p1', 'p2', 'p3', ''].map((planId, i) => ({ userId: 'u' + i, planId })),
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
    expect(buildOverview({ metrics, plans, now, since: null, activeMemberships: [], members: [{ userId: '1', joinedAt: '2020-01-01T00:00:00', attritionOn: null }] }).newMembers).toBe(1);
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
    const e = buildOverview({ metrics: [], plans: [], now, since: null, activeMemberships: [], members: [] });
    expect([e.activeMemberships, e.mrr, e.avgFill, e.attendanceRate, e.newMembers, e.sessions]).toEqual([0, 0, 0, 0, 0, 0]);
  });
});

import { attendanceTable, classesTable, incomeTable, membershipsTable, newMembersTable, overviewTable, ukDate, ukDateTime } from '../src/reports/calc';
import { fileBase, safeCell, toCsv } from '../src/reports/download';

describe('downloads: CSV text', () => {
  it('starts with a byte-order mark and uses Windows line ends', () => {
    const csv = toCsv({ headers: ['A', 'B'], rows: [['x', 1]] });
    expect(csv).toBe('﻿A,B\r\nx,1\r\n');
  });
  it('quotes commas, quotes and new lines, and keeps £ and accents', () => {
    const csv = toCsv({ headers: ['Name'], rows: [['Smith, Ann'], ['She said "hi"'], ['two\nlines'], ['£45 café']] });
    expect(csv).toBe('﻿Name\r\n"Smith, Ann"\r\n"She said ""hi"""\r\n"two\nlines"\r\n£45 café\r\n');
  });
  it('neutralises text a spreadsheet would run as a formula, but not numbers', () => {
    expect(['=SUM(A1)', '+1', '-1', '@x', '\tx'].map(safeCell)).toEqual(["'=SUM(A1)", "'+1", "'-1", "'@x", "'\tx"]);
    expect(safeCell(-5)).toBe(-5);
    expect(safeCell('Anna-Marie')).toBe('Anna-Marie');
    expect(toCsv({ headers: ['M'], rows: [['=HYPERLINK("http://x")']] })).toContain("\"'=HYPERLINK(\"\"http://x\"\")\"");
  });
  it('builds a tidy file name', () => {
    expect(fileBase('Puffin Performance', 'Classes on Mons', new Date(2026, 9, 7))).toBe('puffin-performance-classes-on-mons-2026-10-07');
    expect(fileBase('Café & Gym!', 'New members', new Date(2026, 0, 2))).toBe('cafe-gym-new-members-2026-01-02');
  });
});

describe('the rows behind each figure', () => {
  const now = new Date('2026-10-07T12:00:00Z');
  const ctx = { gymName: 'Puffin', rangeLabel: 'Last 30 days', now };
  const plans = [plan('p1', 'Monthly', 4500, 'monthly'), plan('p2', 'Annual', 48000, 'annual')];
  const mems = [{ userId: 'u1', planId: 'p1' }, { userId: 'u2', planId: 'p2' }, { userId: 'u3', planId: 'p1' }, { userId: 'u4', planId: '' }];
  const names = new Map([['u1', 'Zoe Zed'], ['u2', 'Amy Ash'], ['u3', 'Bob Bay']]);
  const metrics = sessionMetrics(
    [session('a', '2026-10-05T17:30:00Z', 10, 'Evening Hybrid'), session('b', '2026-10-06T17:30:00Z', 10, 'Evening Hybrid'), session('c', '2026-10-09T07:30:00Z', 10, 'Strength')],
    [...bk('a', 'attended', 6), ...bk('a', 'no_show', 2), ...bk('b', 'attended', 4), ...bk('c', 'booked', 3)],
  );
  it('formats UK dates and times', () => {
    expect(ukDateTime('2026-10-05T17:30:00Z')).toBe('05/10/2026 18:30');
    expect(ukDate('2026-10-05T23:30:00Z')).toBe('06/10/2026');
  });
  it('lists classes with fill, oldest first, and can narrow to one day', () => {
    const t = classesTable(ctx, 'Classes', metrics);
    expect(t.headers).toEqual(['Class', 'Date and time (UK)', 'Places', 'Booked', 'Attended', 'No-show', 'Fill %']);
    expect(t.rows.map((r) => r[0])).toEqual(['Evening Hybrid', 'Evening Hybrid', 'Strength']);
    expect(t.rows[0]).toEqual(['Evening Hybrid', '05/10/2026 18:30', 10, 0, 6, 2, 80]);
    expect(classesTable(ctx, 'Mondays', metrics, (m) => m.day === 'Mon').rows).toHaveLength(1);
    expect(t.subtitle).toContain('Puffin · Last 30 days');
  });
  it('attendance by class counts only classes already started', () => {
    const t = attendanceTable(ctx, 'Attendance', metrics);
    expect(t.rows).toEqual([['Evening Hybrid', 2, 10, 2, 83]]);
  });
  it('income by plan adds up to the Overview figure', () => {
    const t = incomeTable(ctx, plans, mems);
    expect(t.rows[0]).toEqual(['Monthly', 'monthly', '£45', 2, '£90']);
    expect(t.rows[1]).toEqual(['Annual', 'annual', '£480', 1, '£40']);
    expect(t.rows[2]).toEqual(['(no plan)', '', '', 1, '£0']);
  });
  it('lists active members by name, and can narrow to one plan', () => {
    expect(membershipsTable(ctx, 'All', plans, mems, names).rows.map((r) => r[0])).toEqual(['Amy Ash', 'Bob Bay', 'Member', 'Zoe Zed']);
    expect(membershipsTable(ctx, 'Monthly', plans, mems, names, 'p1').rows).toEqual([['Bob Bay', 'Monthly'], ['Zoe Zed', 'Monthly']]);
  });
  it('new members: only inside the range, newest first', () => {
    const members = [
      { userId: 'u1', joinedAt: '2026-10-01T00:00:00', attritionOn: null },
      { userId: 'u2', joinedAt: '2026-10-03T00:00:00', attritionOn: null },
      { userId: 'u3', joinedAt: '2025-01-01T00:00:00', attritionOn: null },
    ];
    expect(newMembersTable(ctx, members, names, '2026-09-07T12:00:00.000Z').rows).toEqual([['Amy Ash', '03/10/2026'], ['Zoe Zed', '01/10/2026']]);
    expect(newMembersTable(ctx, members, names, null).rows).toHaveLength(3);
  });
  it('the overview download carries every headline figure', () => {
    const o = buildOverview({ metrics, plans, now, since: null, activeMemberships: mems, members: [] });
    const t = overviewTable(ctx, o);
    expect(t.rows.slice(0, 8).map((r) => r[0])).toEqual(['Active memberships', 'Est. MRR', 'Average class fill', 'Attendance rate', 'New members', 'Class attendances', 'No-shows', 'Sessions analysed']);
    expect(t.rows).toContainEqual(['Membership mix: Monthly', 2]);
  });
});
