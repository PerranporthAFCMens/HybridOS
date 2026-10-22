import { describe, expect, it } from 'vitest';
import type { LibraryData } from '../src/data/reportLibrary';
import { attentionList, summaryFigures, summaryTable } from '../src/reports/summary';

const NOW = new Date('2026-10-08T12:00:00Z');

const data = (over: Partial<LibraryData> = {}): LibraryData => ({
  plans: [{ id: 'p1', name: 'Hybrid', pricePence: 5900, interval: 'monthly', isActive: true }],
  memberships: [
    { id: 'm1', userId: 'u1', planId: 'p1', status: 'active', startsOn: '', endsOn: '', provider: '', paymentStatus: '', updatedAt: '' },
    { id: 'm2', userId: 'u2', planId: 'p1', status: 'active', startsOn: '', endsOn: '', provider: '', paymentStatus: '', updatedAt: '' },
  ],
  gymMembers: [
    { userId: 'u1', joinedAt: '2026-10-01T10:00:00Z', attritionOn: '', isActive: true },
    { userId: 'u2', joinedAt: '2026-01-20T10:00:00Z', attritionOn: '', isActive: true },
    { userId: 'u3', joinedAt: '2026-01-15T10:00:00Z', attritionOn: '2026-10-03', isActive: false },
    { userId: 'u4', joinedAt: '2026-01-15T10:00:00Z', attritionOn: '2026-08-01', isActive: false },
  ],
  people: new Map(),
  payments: [
    { id: 'a', membershipId: '', userId: 'u1', chargeDate: '2026-10-01', createdAt: '', amountPence: 5900, state: 'paid_out', provider: '', failure: '' },
    { id: 'b', membershipId: '', userId: 'u2', chargeDate: '2026-10-02', createdAt: '', amountPence: 5900, state: 'failed', provider: '', failure: '' },
    { id: 'c', membershipId: '', userId: 'u2', chargeDate: '2026-08-02', createdAt: '', amountPence: 5900, state: 'paid_out', provider: '', failure: '' },
  ],
  purchases: [], assignments: [], workoutSessions: [], pt: [],
  sessions: [
    { id: 's1', name: 'HIIT', startsAt: '2026-10-05T08:00:00Z', endsAt: '2026-10-05T09:00:00Z', capacity: 9, dropInPence: null },
    { id: 's2', name: 'HIIT', startsAt: '2026-10-06T08:00:00Z', endsAt: '2026-10-06T09:00:00Z', capacity: 9, dropInPence: null },
  ],
  bookings: [
    { sessionId: 's1', userId: 'u1', status: 'attended', bookedAt: '', cancelledAt: '' },
    { sessionId: 's1', userId: 'u2', status: 'attended', bookedAt: '', cancelledAt: '' },
    { sessionId: 's1', userId: 'u3', status: 'attended', bookedAt: '', cancelledAt: '' },
    { sessionId: 's1', userId: 'u4', status: 'attended', bookedAt: '', cancelledAt: '' },
    { sessionId: 's2', userId: 'u1', status: 'cancelled', bookedAt: '', cancelledAt: '' },
  ],
  staff: [], staffHours: [], sessionStaff: [],
  ...over,
});

describe('business summary figures', () => {
  const f = summaryFigures(data(), '2026-09-08T00:00:00Z', NOW);
  it('counts only money paid inside the range', () => expect(f.income).toBe(5900));
  it('counts failed money and payments', () => { expect(f.lost).toBe(5900); expect(f.lostCount).toBe(1); });
  it('counts joins and leavers inside the range, and the net', () => { expect(f.joined).toBe(1); expect(f.left).toBe(1); expect(f.net).toBe(0); });
  it('reports active members and expected monthly income', () => { expect(f.active).toBe(2); expect(f.mrr).toBe(11800); });
  it('counts classes under a third full', () => expect(f.emptyClasses).toBe(1));
  it('uses all time when there is no start', () => expect(summaryFigures(data(), null, NOW).income).toBe(11800));
});

describe('needs a look', () => {
  it('lists failed payments, net loss and empty classes', () => {
    const list = attentionList({ ...summaryFigures(data(), null, NOW), lostCount: 2, lost: 11800, net: -2, emptyClasses: 1 });
    expect(list.map((a) => a.text)).toEqual(['2 failed payments, £118 not collected', '2 more members left than joined', '1 class under a third full']);
  });
  it('is empty when all is well', () => expect(attentionList({ ...summaryFigures(data(), null, NOW), lostCount: 0, net: 3, emptyClasses: 0 })).toEqual([]));
});

describe('summary export', () => {
  it('has one row per measure', () => {
    const t = summaryTable({ gymName: 'Puffin Performance', rangeLabel: 'Last 30 days', now: NOW }, summaryFigures(data(), null, NOW));
    expect(t.title).toBe('Business summary');
    expect(t.rows).toHaveLength(12);
  });
});
