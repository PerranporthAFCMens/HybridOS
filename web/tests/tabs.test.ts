import { describe, expect, it } from 'vitest';
import type { LibraryData } from '../src/data/reportLibrary';
import { TOP_MEMBERS, atRiskTable, classIncomeTable, classPerformanceTable, classesTab, heatStep, incomeByType, membersTab, membershipsTab, membershipsTable, paymentsTab, topMembersTable } from '../src/reports/tabs';
import type { LibraryContext } from '../src/reports/library';

const NOW = new Date('2026-10-08T12:00:00Z');
const ctx: LibraryContext = { gymName: 'Puffin Performance', rangeLabel: 'Test', now: NOW, since: null };

const base = (over: Partial<LibraryData> = {}): LibraryData => ({
  plans: [
    { id: 'p1', name: 'Hybrid', pricePence: 5900, interval: 'monthly', isActive: true },
    { id: 'p2', name: 'Annual', pricePence: 59000, interval: 'annual', isActive: true },
    { id: 'p3', name: 'Gym', pricePence: 2900, interval: 'monthly', isActive: false },
  ],
  memberships: [
    { id: 'm-u1', userId: 'u1', planId: 'p1', status: 'active', startsOn: '', endsOn: '', provider: '', paymentStatus: '', updatedAt: '' },
    { id: 'm-u2', userId: 'u2', planId: 'p1', status: 'active', startsOn: '', endsOn: '', provider: '', paymentStatus: '', updatedAt: '' },
    { id: 'm-u3', userId: 'u3', planId: 'p2', status: 'active', startsOn: '', endsOn: '', provider: '', paymentStatus: '', updatedAt: '' },
    { id: 'm-u4', userId: 'u4', planId: 'p3', status: 'cancelled', startsOn: '', endsOn: '', provider: '', paymentStatus: '', updatedAt: '' },
  ],
  gymMembers: [
    { userId: 'u1', joinedAt: '2026-10-01T10:00:00Z', attritionOn: '', isActive: true },
    { userId: 'u2', joinedAt: '2026-01-20T10:00:00Z', attritionOn: '', isActive: true },
    { userId: 'u3', joinedAt: '2026-03-05T10:00:00Z', attritionOn: '', isActive: true },
    { userId: 'u4', joinedAt: '2026-01-15T10:00:00Z', attritionOn: '2026-09-01', isActive: false },
  ],
  people: new Map([['u1', { name: 'Amelia Hart', dateOfBirth: '', gender: '' }], ['u2', { name: 'Jack Pengelly', dateOfBirth: '', gender: '' }], ['u3', { name: 'Priya Nair', dateOfBirth: '', gender: '' }]]),
  payments: [
    { id: 'pay-u1', membershipId: '', userId: 'u1', chargeDate: '2026-10-01', createdAt: '', amountPence: 5900, state: 'paid_out', provider: 'manual', failure: '' },
    { id: 'pay-u2', membershipId: '', userId: 'u2', chargeDate: '2026-10-01', createdAt: '', amountPence: 5900, state: 'failed', provider: 'manual', failure: 'insufficient_funds' },
    { id: 'pay-u3', membershipId: '', userId: 'u3', chargeDate: '2026-09-01', createdAt: '', amountPence: 2900, state: 'charged_back', provider: 'manual', failure: '' },
  ],
  purchases: [], assignments: [], workoutSessions: [], pt: [],
  // Mon 5 Oct 09:00 London (08:00Z) HIIT cap 10; Mon 5 Oct 18:00 London Yoga cap 5; Tue 6 Oct 12:30 HIIT cap 10; a future class.
  sessions: [
    { id: 's1', name: 'HIIT', startsAt: '2026-10-05T08:00:00Z', endsAt: '2026-10-05T09:00:00Z', capacity: 10, dropInPence: null },
    { id: 's2', name: 'Yoga', startsAt: '2026-10-05T17:00:00Z', endsAt: '2026-10-05T18:00:00Z', capacity: 5, dropInPence: null },
    { id: 's3', name: 'HIIT', startsAt: '2026-10-06T11:30:00Z', endsAt: '2026-10-06T12:30:00Z', capacity: 10, dropInPence: null },
    { id: 's4', name: 'HIIT', startsAt: '2026-10-20T08:00:00Z', endsAt: '2026-10-20T09:00:00Z', capacity: 10, dropInPence: null },
  ],
  bookings: [
    { sessionId: 's1', userId: 'u1', status: 'attended', bookedAt: '', cancelledAt: '' },
    { sessionId: 's1', userId: 'u2', status: 'attended', bookedAt: '', cancelledAt: '' },
    { sessionId: 's1', userId: 'u3', status: 'no_show', bookedAt: '', cancelledAt: '' },
    { sessionId: 's2', userId: 'u1', status: 'attended', bookedAt: '', cancelledAt: '' },
    { sessionId: 's2', userId: 'u2', status: 'cancelled', bookedAt: '', cancelledAt: '' },
    { sessionId: 's3', userId: 'u1', status: 'attended', bookedAt: '', cancelledAt: '' },
    { sessionId: 's4', userId: 'u2', status: 'booked', bookedAt: '', cancelledAt: '' },
  ],
  staff: [], staffHours: [], sessionStaff: [],
  ...over,
});

describe('memberships tab', () => {
  it('counts active memberships, plans and income, with shares', () => {
    const t = membershipsTab(base(), null);
    expect(t.active).toBe(3);
    expect(t.activePlans).toBe(2);
    expect(t.newJoins).toBe(4);
    expect(t.plans.map((p) => [p.name, p.members, p.mrr, p.share])).toEqual([['Hybrid', 2, 11800, 67], ['Annual', 1, 4917, 33], ['Gym', 0, 0, 0]]);
    expect(t.mrr).toBe(16717);
  });
  it('new joins respects the range', () => {
    expect(membershipsTab(base(), '2026-09-01T00:00:00Z').newJoins).toBe(1);
  });
  it('the plan table words the figures', () => {
    expect(membershipsTable(ctx, membershipsTab(base(), null)).rows[0]).toEqual(['Hybrid', 2, '£118.00', '67%']);
  });
  it('has no divide-by-zero with nobody active', () => {
    const t = membershipsTab(base({ memberships: [] }), null);
    expect(t.plans.every((p) => p.share === 0)).toBe(true);
  });
});

describe('income by class', () => {
  const purchases = [
    { userId: 'u1', sessionId: 's1', createdAt: '', amountPence: 800, status: 'paid' },
    { userId: 'u2', sessionId: 's3', createdAt: '', amountPence: 800, status: 'paid' },
    { userId: 'u3', sessionId: 's2', createdAt: '', amountPence: 1200, status: 'paid' },
    { userId: 'u3', sessionId: 's1', createdAt: '', amountPence: 800, status: 'refunded' },
    { userId: 'u3', sessionId: 's1', createdAt: '', amountPence: 800, status: 'pending' },
  ];
  const t = classesTab(base({ purchases }), NOW);
  it('adds up paid drop-ins per class and ranks the biggest earner first', () => {
    expect(incomeByType(t).map((r) => [r.name, r.revenue])).toEqual([['HIIT', 1600], ['Yoga', 1200]]);
  });
  it('ignores unpaid and refunded purchases, and shows nothing earned when there are none', () => {
    expect(classesTab(base(), NOW).byType.every((r) => r.revenue === 0)).toBe(true);
  });
  it('the download has income and income per session', () => {
    expect(classIncomeTable(ctx, t).rows).toEqual([['HIIT', 3, '£16.00', '£5.33'], ['Yoga', 1, '£12.00', '£12.00']]);
  });
});

describe('classes tab', () => {
  const t = classesTab(base(), NOW);
  it('headline figures use all classes for fill and only started classes for attendance', () => {
    // demand: s1 3, s2 1, s3 1, s4 1 = 6 of 35 places = 17%.
    expect(t.avgFill).toBe(17);
    expect(t.sessions).toBe(4);
    expect(t.attendances).toBe(4);
    expect(t.noShows).toBe(1);
  });
  it('class types ranked by fill', () => {
    // Yoga 1 of 5 = 20%; HIIT 5 of 30 = 17%.
    expect(t.byType.map((r) => [r.name, r.sessions, r.bookings, r.attended, r.fill])).toEqual([['Yoga', 1, 1, 1, 20], ['HIIT', 3, 5, 3, 17]]);
  });
  it('heatmap puts each class in its UK day and time band', () => {
    const cell = (day: string, band: string) => t.heat.find((r) => r.day === day)?.cells.find((c) => c.band === band)?.fill;
    expect(cell('Mon', 'Daytime')).toBe(30); // Mon 09:00 London is "Daytime" (9 to 16): 3 of 10
    expect(cell('Mon', 'Evening')).toBe(20); // Mon 18:00 Yoga: 1 of 5
    expect(cell('Tue', 'Daytime')).toBe(10); // Tue 12:30
    expect(cell('Sun', 'Morning')).toBe(0);
    expect(t.heat).toHaveLength(7);
    expect(t.heat[0]?.cells).toHaveLength(4);
  });
  it('heat steps match the old colours', () => {
    expect([0, 24, 25, 49, 50, 69, 70, 84, 85, 100].map(heatStep)).toEqual([1, 1, 2, 2, 3, 3, 4, 4, 5, 5]);
  });
  it('the detail table matches the bars', () => {
    expect(classPerformanceTable(ctx, t).rows[0]).toEqual(['Yoga', 1, 1, 1, 20]);
  });
});

describe('members tab', () => {
  const t = membersTab(base(), NOW);
  it('headline figures', () => {
    expect(t.activeMembers).toBe(3);
    expect(t.attending).toBe(2); // u1 and u2 attended at least once
    expect(t.attendances).toBe(4);
    expect(t.noShowRate).toBe(20); // 1 of 5 started places
  });
  it('most active ranks by attended, then activity', () => {
    expect(t.top.map((m) => [m.name, m.attended, m.activity, m.noShows])).toEqual([['Amelia Hart', 3, 3, 0], ['Jack Pengelly', 1, 2, 0], ['Priya Nair', 0, 1, 1]]);
  });
  it('keeps the top twelve only', () => {
    const many = base({
      bookings: Array.from({ length: 20 }, (_, i) => ({ sessionId: 's1', userId: `x${i}`, status: 'attended', bookedAt: '', cancelledAt: '' })),
    });
    expect(membersTab(many, NOW).top).toHaveLength(TOP_MEMBERS);
  });
  it('the table ranks from 1', () => {
    expect(topMembersTable(ctx, t).rows[0]).toEqual([1, 'Amelia Hart', 3, 3, 0]);
  });
});

describe('payments tab', () => {
  it('finds failed and charged-back payments and what they add up to', () => {
    const d = base();
    const t = paymentsTab(d);
    expect(t.atRisk).toHaveLength(2);
    expect(t.outstanding).toBe(8800);
    expect(t.records).toBe(3);
    expect(atRiskTable(ctx, d, t).rows).toEqual([['Jack Pengelly', '2026-10-01', '£59.00', 'failed', 'insufficient_funds'], ['Priya Nair', '2026-09-01', '£29.00', 'charged_back', '']]);
  });
  it('is empty and zero when nothing failed', () => {
    const t = paymentsTab(base({ payments: [] }));
    expect(t).toEqual({ atRisk: [], outstanding: 0, records: 0 });
  });
});
