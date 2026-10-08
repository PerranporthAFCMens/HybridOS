import { describe, expect, it } from 'vitest';
import { arcPath, compact, labelStep, niceTicks, roundedTop, shares, sliceAngles } from '../src/charts/scale';
import { SERIES_COLORS, seriesColor } from '../src/charts/palette';
import type { LibraryData } from '../src/data/reportLibrary';
import type { LibraryContext } from '../src/reports/library';
import {
  activeMembersSeries, attendanceRowsTable, attendanceSeries, foldSlices, incomeSeries, inPeriod, joinsRowsTable, joinsSeries, payGroup, paymentRowsTable,
  paymentSeries, paymentStateSlices, periodsFor, type Period,
} from '../src/reports/trends';

const NOW = new Date('2026-10-08T12:00:00Z'); // Thursday 8 October, UK summer time
const ctx: LibraryContext = { gymName: 'Puffin Performance', rangeLabel: 'Test', now: NOW, since: null };

describe('chart arithmetic', () => {
  it('chooses clean ticks that include zero and cover the maximum', () => {
    expect(niceTicks(0)).toEqual([0, 1]);
    expect(niceTicks(7)).toEqual([0, 2, 4, 6, 8]);
    expect(niceTicks(100)).toEqual([0, 50, 100]);
    expect(niceTicks(3)).toEqual([0, 1, 2, 3]);
    expect(niceTicks(1234)).toEqual([0, 500, 1000, 1500]);
    // Small counts step by whole numbers, so the axis never shows 2, 2, 1, 1, 0.
    expect(niceTicks(2)).toEqual([0, 1, 2]);
    expect(niceTicks(1)).toEqual([0, 1]);
    expect(niceTicks(0.4)).toEqual([0, 1]);
  });
  it('shortens big numbers', () => {
    expect([0, 999, 1284, 12900, 4_200_000].map(compact)).toEqual(['0', '999', '1,284', '12.9K', '4.2M']);
  });
  it('thins labels so they fit', () => {
    expect(labelStep(50, 30)).toBe(1);
    expect(labelStep(20, 40)).toBe(3);
    expect(labelStep(0, 40)).toBe(1);
  });
  it('rounds only the data end of a column', () => {
    const d = roundedTop(10, 20, 24, 50, 4);
    expect(d.startsWith('M10,70V24')).toBe(true); // up the left edge to just under the top
    expect(d.endsWith('V70Z')).toBe(true); // straight down to the baseline
    expect(roundedTop(0, 0, 4, 1, 4)).toContain('Q'); // a very short column never errors
  });
  it('draws ring slices between angles', () => {
    expect(arcPath(50, 50, 40, 20, 0, Math.PI / 2)).toMatch(/^M50\.00,10\.00A40,40 0 0 1 90\.00,50\.00L70\.00,50\.00A20,20 0 0 0 50\.00,30\.00Z$/);
    expect(arcPath(50, 50, 40, 20, 0, Math.PI * 1.5)).toContain('0 1 1');
  });
  it('lays out slices with a gap, and no gap for a single slice', () => {
    const a = sliceAngles([1, 1], 0.1);
    expect(a[0]?.a0).toBeCloseTo(0.05);
    expect(a[0]?.a1).toBeCloseTo(Math.PI - 0.05);
    expect(a[1]?.a0).toBeCloseTo(Math.PI + 0.05);
    const one = sliceAngles([5, 0], 0.1);
    expect(one[0]).toEqual({ a0: 0, a1: Math.PI * 2 });
    expect(one[1]?.a1).toBeLessThanOrEqual(one[1]?.a0 ?? 0);
    expect(sliceAngles([0, 0], 0.1)).toHaveLength(2);
  });
  it('shares add up to 100', () => {
    expect(shares([1, 1, 1])).toEqual([34, 33, 33]);
    expect(shares([2, 1]).reduce((n, v) => n + v, 0)).toBe(100);
    expect(shares([0, 0])).toEqual([0, 0]);
    expect(shares([1])).toEqual([100]);
  });
  it('keeps to the validated colours in order and never makes up a ninth', () => {
    expect(SERIES_COLORS).toHaveLength(8);
    expect(seriesColor(0)).toBe(SERIES_COLORS[0]);
    expect(seriesColor(20)).toBe(SERIES_COLORS[7]);
  });
});

describe('periods', () => {
  it('uses Monday weeks for short ranges, oldest first, ending this week', () => {
    const p = periodsFor(30, NOW);
    expect(p.map((x) => x.label)).toEqual(['7 Sep', '14 Sep', '21 Sep', '28 Sep', '5 Oct']);
    expect(p[4]?.start).toBe('2026-10-04T23:00:00.000Z'); // Monday 5 Oct 00:00 in London (BST)
    expect(p[4]?.end).toBe('2026-10-11T23:00:00.000Z');
    expect(p[0]?.end).toBe(p[1]?.start);
    expect(periodsFor(90, NOW)).toHaveLength(13);
  });
  it('uses calendar months for a year and for all time', () => {
    const y = periodsFor(365, NOW);
    expect(y).toHaveLength(12);
    expect(y.at(-1)?.label).toBe('Oct');
    expect(y[0]?.label).toBe('Nov 25');
    expect(y.find((x) => x.label === 'Jan 26')).toBeTruthy();
    expect(y.at(-1)?.start).toBe('2026-09-30T23:00:00.000Z'); // 1 Oct 00:00 London
    expect(periodsFor(0, NOW)).toHaveLength(24);
  });
  it('knows which period a moment is in (start inclusive, end exclusive)', () => {
    const p = periodsFor(30, NOW).at(4) as Period;
    expect(inPeriod(p.start, p)).toBe(true);
    expect(inPeriod(p.end, p)).toBe(false);
    expect(inPeriod('', p)).toBe(false);
  });
});

const data = (over: Partial<LibraryData> = {}): LibraryData => ({
  plans: [], memberships: [],
  gymMembers: [
    { userId: 'u1', joinedAt: '2026-10-06T10:00:00Z', attritionOn: '', isActive: true },
    { userId: 'u2', joinedAt: '2026-09-10T10:00:00Z', attritionOn: '2026-10-07', isActive: false },
    { userId: 'u3', joinedAt: '2026-01-10T10:00:00Z', attritionOn: '', isActive: true },
  ],
  people: new Map([['u1', { name: 'Amelia Hart', dateOfBirth: '', gender: '' }], ['u2', { name: 'Jack Pengelly', dateOfBirth: '', gender: '' }]]),
  payments: [
    { id: 'pay-u1', membershipId: '', userId: 'u1', chargeDate: '2026-10-06', createdAt: '', amountPence: 5900, state: 'paid_out', provider: 'manual', failure: '' },
    { id: 'pay-u2', membershipId: '', userId: 'u2', chargeDate: '2026-10-06', createdAt: '', amountPence: 4500, state: 'confirmed', provider: 'manual', failure: '' },
    { id: 'pay-u3', membershipId: '', userId: 'u3', chargeDate: '2026-09-29', createdAt: '', amountPence: 2900, state: 'failed', provider: 'manual', failure: 'insufficient_funds' },
    { id: 'pay-u3', membershipId: '', userId: 'u3', chargeDate: '2026-10-01', createdAt: '', amountPence: 1000, state: 'pending', provider: 'manual', failure: '' },
    { id: 'pay-u1', membershipId: '', userId: 'u1', chargeDate: '2026-10-02', createdAt: '', amountPence: 999, state: 'refunded', provider: 'manual', failure: '' },
  ],
  purchases: [], assignments: [], workoutSessions: [], pt: [],
  sessions: [
    { id: 's1', name: 'HIIT', startsAt: '2026-10-05T08:00:00Z', endsAt: '2026-10-05T09:00:00Z', capacity: 10, dropInPence: null },
    { id: 's2', name: 'HIIT', startsAt: '2026-09-29T08:00:00Z', endsAt: '2026-09-29T09:00:00Z', capacity: 10, dropInPence: null },
    { id: 's3', name: 'HIIT', startsAt: '2026-10-20T08:00:00Z', endsAt: '2026-10-20T09:00:00Z', capacity: 10, dropInPence: null },
  ],
  bookings: [
    { sessionId: 's1', userId: 'u1', status: 'attended', bookedAt: '', cancelledAt: '' },
    { sessionId: 's1', userId: 'u2', status: 'attended', bookedAt: '', cancelledAt: '' },
    { sessionId: 's1', userId: 'u3', status: 'no_show', bookedAt: '', cancelledAt: '' },
    { sessionId: 's2', userId: 'u1', status: 'attended', bookedAt: '', cancelledAt: '' },
    { sessionId: 's3', userId: 'u1', status: 'booked', bookedAt: '', cancelledAt: '' },
  ],
  ...over,
});

describe('series', () => {
  const periods = periodsFor(30, NOW);
  it('attendance counts attended and no-shows per week, past classes only', () => {
    const [att, no] = attendanceSeries(data(), periods, NOW);
    expect(att?.values).toEqual([0, 0, 0, 1, 2]); // 29 Sep is in the week of 28 Sep; 5 Oct in the week of 5 Oct
    expect(no?.values).toEqual([0, 0, 0, 0, 1]);
    expect(att?.name).toBe('Attended');
    expect(no?.name).toBe('No-show');
  });
  it('joins and leavers per week', () => {
    const [j, l] = joinsSeries(data(), periods);
    expect(j?.values).toEqual([1, 0, 0, 0, 1]); // u2 joined 10 Sep (week of 7 Sep); u1 joined 6 Oct (week of 5 Oct)
    expect(l?.values).toEqual([0, 0, 0, 0, 1]);
  });
  it('members at the end of each week', () => {
    const [m] = activeMembersSeries(data(), periods, NOW);
    expect(m?.values.at(-1)).toBe(2); // u2 left on 7 Oct, so u1 and u3 remain
    expect(m?.values[0]).toBe(2); // end of the week of 7 Sep: u2 and u3 (u1 not yet joined)
  });
  it('payments split into paid, failed and pending, in whole pounds; refunds are left out', () => {
    const [paid, failed, pending] = paymentSeries(data(), periods);
    expect(paid?.values).toEqual([0, 0, 0, 0, 104]); // 59 + 45
    expect(failed?.values).toEqual([0, 0, 0, 29, 0]);
    expect(pending?.values).toEqual([0, 0, 0, 10, 0]);
    expect(incomeSeries(data(), periods)[0]?.values).toEqual([0, 0, 0, 0, 104]);
    expect(payGroup('refunded')).toBeNull();
    expect(payGroup('charged_back')).toBe('Failed');
  });
  it('payment state slices count per state inside the range', () => {
    const s = paymentStateSlices(data(), '2026-10-01T00:00:00Z');
    expect(s.map((x) => [x.label, x.value])).toEqual([['Paid', 2], ['Failed', 0], ['Pending', 1]]);
  });
});

describe('slices', () => {
  it('keeps the biggest groups and folds the tail into a grey Other', () => {
    const items = Array.from({ length: 9 }, (_, i) => ({ label: `Plan ${i}`, value: 9 - i, id: `p${i}` }));
    const s = foldSlices(items, 6);
    expect(s).toHaveLength(6);
    expect(s.slice(0, 5).map((x) => x.label)).toEqual(['Plan 0', 'Plan 1', 'Plan 2', 'Plan 3', 'Plan 4']);
    expect(s[5]).toMatchObject({ label: 'Other', value: 4 + 3 + 2 + 1, color: '#6b7589' });
    expect(s[5]?.ids).toHaveLength(4);
    expect(s[0]?.color).toBe(SERIES_COLORS[0]);
    expect(foldSlices([{ label: 'A', value: 0, id: 'a' }])).toEqual([]);
    expect(foldSlices([{ label: 'A', value: 2, id: 'a' }, { label: 'B', value: 1, id: 'b' }]).map((x) => x.label)).toEqual(['A', 'B']);
  });
});

describe('the rows behind a column', () => {
  const p = periodsFor(30, NOW).at(4) as Period;
  it('lists the classes in that week', () => {
    const t = attendanceRowsTable(ctx, data(), p);
    expect(t.title).toBe('Classes, 5 Oct');
    expect(t.rows).toHaveLength(1);
    expect(t.rows[0]?.[0]).toBe('HIIT');
  });
  it('lists who joined and left that week, oldest first', () => {
    const t = joinsRowsTable(ctx, data(), p);
    expect(t.rows).toEqual([['Amelia Hart', 'Joined', '06/10/2026'], ['Jack Pengelly', 'Left', '07/10/2026']]);
  });
  it('lists payments of one kind in that week', () => {
    const t = paymentRowsTable(ctx, data(), p, 'Paid');
    expect(t.rows.map((r) => [r[0], r[2]])).toEqual([['Amelia Hart', '£59.00'], ['Jack Pengelly', '£45.00']]);
    expect(paymentRowsTable(ctx, data(), p).rows).toHaveLength(2);
  });
});
