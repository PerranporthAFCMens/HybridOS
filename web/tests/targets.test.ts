import { describe, expect, it } from 'vitest';
import type { LibraryData } from '../src/data/reportLibrary';
import type { TargetRow } from '../src/data/targets';
import { gymProgress, parseTarget, staffMonthToDate, staffProgress, targetInput } from '../src/reports/targets';

const NOW = new Date('2026-10-20T12:00:00Z');

const data = (): LibraryData => ({
  plans: [{ id: 'p1', name: 'Hybrid', pricePence: 5900, interval: 'monthly', isActive: true }],
  memberships: [{ id: 'm1', userId: 'u1', planId: 'p1', status: 'active', startsOn: '', endsOn: '', provider: '', paymentStatus: '', updatedAt: '' }],
  gymMembers: [
    { userId: 'u1', joinedAt: '2026-10-03T10:00:00Z', attritionOn: '', isActive: true },
    { userId: 'u2', joinedAt: '2026-09-28T10:00:00Z', attritionOn: '', isActive: true },
  ],
  people: new Map(),
  payments: [
    { id: 'a', membershipId: '', userId: 'u1', chargeDate: '2026-10-02', createdAt: '', amountPence: 5900, state: 'paid_out', provider: '', failure: '' },
    { id: 'b', membershipId: '', userId: 'u1', chargeDate: '2026-09-30', createdAt: '', amountPence: 5900, state: 'paid_out', provider: '', failure: '' },
  ],
  purchases: [], assignments: [], workoutSessions: [],
  pt: [
    { memberId: 'u1', staffId: 'c1', startsAt: '2026-10-05T10:00:00Z', endsAt: '2026-10-05T11:00:00Z', status: 'completed', notes: '' },
    { memberId: 'u1', staffId: 'c1', startsAt: '2026-10-06T10:00:00Z', endsAt: '2026-10-06T11:00:00Z', status: 'cancelled', notes: '' },
    { memberId: 'u1', staffId: 'c1', startsAt: '2026-09-29T10:00:00Z', endsAt: '2026-09-29T11:00:00Z', status: 'completed', notes: '' },
  ],
  sessions: [
    { id: 's1', name: 'HIIT', startsAt: '2026-10-05T08:00:00Z', endsAt: '2026-10-05T09:00:00Z', capacity: 9, dropInPence: null },
    { id: 's2', name: 'HIIT', startsAt: '2026-10-25T08:00:00Z', endsAt: '2026-10-25T09:00:00Z', capacity: 9, dropInPence: null },
    { id: 's3', name: 'HIIT', startsAt: '2026-09-20T08:00:00Z', endsAt: '2026-09-20T09:00:00Z', capacity: 9, dropInPence: null },
  ],
  bookings: [],
  staff: [{ userId: 'c1', name: 'Coach One', role: 'coach', jobTitle: '', payPence: null }],
  staffHours: [],
  sessionStaff: [
    { sessionId: 's1', userId: 'c1', isLead: true },
    { sessionId: 's2', userId: 'c1', isLead: true },
    { sessionId: 's3', userId: 'c1', isLead: true },
  ],
});

const row = (userId: string, metric: TargetRow['metric'], value: number): TargetRow => ({ id: `${userId}-${metric}`, userId, metric, value });

describe('gym goals this month', () => {
  const out = gymProgress(data(), NOW, [row('', 'income_pence', 20000), row('', 'members_joined', 2), row('', 'active_members', 1)]);
  it('counts only this month\'s income', () => { expect(out[0]?.done).toBe(5900); expect(out[0]?.pct).toBe(30); expect(out[0]?.doneText).toBe('£59'); expect(out[0]?.targetText).toBe('£200'); });
  it('counts only this month\'s joiners', () => { expect(out[1]?.done).toBe(1); expect(out[1]?.pct).toBe(50); });
  it('can go over 100%', () => expect(out[2]?.pct).toBe(100));
  it('shows nothing for goals that are not set', () => expect(gymProgress(data(), NOW, [])).toEqual([]));
});

describe('staff goals this month', () => {
  it('counts classes that have started, this month, with that coach', () => expect(staffMonthToDate(data(), 'c1', NOW).classes_taught).toBe(1));
  it('counts completed PT sessions this month only', () => expect(staffMonthToDate(data(), 'c1', NOW).pt_sessions).toBe(1));
  it('counts nothing for someone else', () => expect(staffMonthToDate(data(), 'nobody', NOW)).toEqual({ classes_taught: 0, pt_sessions: 0 }));
  it('shows progress for the goals that person has', () => {
    const out = staffProgress(data(), 'c1', NOW, [row('c1', 'classes_taught', 4), row('other', 'pt_sessions', 9)]);
    expect(out).toHaveLength(1);
    expect(out[0]?.pct).toBe(25);
  });
});

describe('typing a goal', () => {
  it('turns pounds into pence for income', () => { expect(parseTarget('income_pence', '£5,000')).toBe(500000); expect(parseTarget('income_pence', '99.50')).toBe(9950); });
  it('keeps other goals as whole numbers', () => expect(parseTarget('members_joined', '12')).toBe(12));
  it('blank means no goal', () => expect(parseTarget('members_joined', '  ')).toBeNull());
  it('refuses nonsense, decimals on counts and huge numbers', () => {
    expect(parseTarget('members_joined', 'lots')).toBe('bad');
    expect(parseTarget('members_joined', '2.5')).toBe('bad');
    expect(parseTarget('members_joined', '-3')).toBe('bad');
    expect(parseTarget('active_members', '999999999')).toBe('bad');
  });
  it('shows a saved goal the way it is typed', () => { expect(targetInput('income_pence', 500000)).toBe('5000'); expect(targetInput('pt_sessions', 12)).toBe('12'); expect(targetInput('pt_sessions', undefined)).toBe(''); });
});
