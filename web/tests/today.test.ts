import { describe, expect, it } from 'vitest';
import {
  bookedPercent, buildNeeds, expectedMonthlyIncome, greeting, liveAt, memberTrend, monthlyCounts,
  monthlyValue, money, sessionsOnDay, summaryLine, upcomingSessions,
} from '../src/today/calc';
import { homeFor } from '../src/auth/access';
import type { ClassSession, GymMemberRow, PlanRow } from '../src/data/today';

const NOW = new Date(2026, 9, 7, 10, 0, 0); // 7 Oct 2026, 10:00 local
const member = (joinedAt: string, attritionOn: string | null = null): GymMemberRow => ({ userId: 'u', joinedAt, attritionOn });
const plan = (isActive: boolean): PlanRow => ({ id: 'p', name: 'Hybrid', priceInPence: 5000, interval: 'monthly', accessType: 'hybrid', isActive });
const session = (over: Partial<ClassSession>): ClassSession => ({
  availability_note: '', bookable_for_me: true, booked_count: 5, capacity: 10, description: '', ends_at: '',
  is_cancelled: false, my_booking_status: '', name: 'WOD', reserved_capacity: 0, reserved_eligible: false,
  reserved_plan_names: [], reserved_release_minutes_before: 0, session_id: 's1', spaces_left: 5,
  starts_at: new Date(2026, 9, 7, 18, 0).toISOString(), ...over,
});

describe('members', () => {
  it('liveAt: joined on or before, and not yet left', () => {
    expect(liveAt(member('2026-10-07T00:00:00'), NOW)).toBe(true);
    expect(liveAt(member('2026-10-08T00:00:00'), NOW)).toBe(false);
    expect(liveAt(member('2026-01-01T00:00:00', '2026-10-07'), NOW)).toBe(false);
    expect(liveAt(member('2026-01-01T00:00:00', '2026-10-08'), NOW)).toBe(true);
  });
  it('counts joined and left in the current month', () => {
    const rows = [member('2026-10-02T09:00:00'), member('2026-09-30T09:00:00'), member('2026-01-01T00:00:00', '2026-10-03')];
    expect(monthlyCounts(rows, NOW)).toEqual({ active: 2, joined: 1, left: 1 });
  });
  it('trend has 12 points ending with the current live count', () => {
    const pts = memberTrend([member('2026-01-01T00:00:00')], NOW);
    expect(pts).toHaveLength(12);
    expect(pts.map((p) => p.label)[0]).toBe('Nov');
    expect(pts[0]?.count).toBe(0); // end of Nov 2025: before they joined
    expect(pts[2]?.count).toBe(1); // end of Jan 2026
    expect(pts[11]?.count).toBe(1);
  });
});

describe('income', () => {
  it('converts every interval to a monthly figure', () => {
    expect(monthlyValue(1200, 'weekly')).toBeCloseTo(5200);
    expect(monthlyValue(3000, 'quarterly')).toBe(1000);
    expect(monthlyValue(12000, 'annual')).toBe(1000);
    expect(monthlyValue(4000, 'monthly')).toBe(4000);
    expect(monthlyValue(4000, 'mystery')).toBe(0);
  });
  it('sums and formats', () => {
    expect(expectedMonthlyIncome([{ priceInPence: 4000, interval: 'monthly' }, { priceInPence: 3000, interval: 'quarterly' }])).toBe(5000);
    expect(money(5000)).toBe('£50.00');
  });
});

describe('needs you', () => {
  const base = { pendingPayments: 0, plans: [plan(true)], sessions: [session({})], memberCount: 3, now: NOW };
  it('is empty when everything is fine', () => {
    expect(buildNeeds(base)).toEqual([]);
    expect(summaryLine(0)).toMatch(/Nothing needs you/);
  });
  it('flags pending payments with singular and plural wording', () => {
    expect(buildNeeds({ ...base, pendingPayments: 1 })[0]?.title).toBe('1 membership payment is waiting to be confirmed');
    expect(buildNeeds({ ...base, pendingPayments: 3 })[0]?.title).toBe('3 membership payments are waiting to be confirmed');
  });
  it('flags no active plan, no classes and no members', () => {
    const keys = buildNeeds({ ...base, plans: [plan(false)], sessions: [], memberCount: 0 }).map((n) => n.key);
    expect(keys).toEqual(['plan', 'classes', 'invite']);
    expect(summaryLine(1)).toBe('1 thing needs a look. Everything else is running.');
    expect(summaryLine(3)).toBe('3 things need a look. Everything else is running.');
  });
  it('flags the quietest upcoming class under 25% booked with capacity of 4 or more', () => {
    const quiet = session({ name: 'Yoga', booked_count: 1, capacity: 8 });
    expect(buildNeeds({ ...base, sessions: [session({}), quiet] }).map((n) => n.key)).toEqual(['quiet']);
    expect(buildNeeds({ ...base, sessions: [session({ booked_count: 0, capacity: 3 })] })).toEqual([]);
    expect(buildNeeds({ ...base, sessions: [session({ booked_count: 0, starts_at: new Date(2026, 9, 7, 8, 0).toISOString() })] })).toEqual([]);
  });
});

describe('classes and greeting', () => {
  it('computes booked percent within 0..100', () => {
    expect(bookedPercent({ booked_count: 5, capacity: 10 })).toBe(50);
    expect(bookedPercent({ booked_count: 12, capacity: 10 })).toBe(100);
    expect(bookedPercent({ booked_count: 0, capacity: 0 })).toBe(0);
  });
  it('drops cancelled sessions, sorts, and filters to a day', () => {
    const a = session({ session_id: 'a', starts_at: new Date(2026, 9, 8, 9, 0).toISOString() });
    const b = session({ session_id: 'b', starts_at: new Date(2026, 9, 7, 9, 0).toISOString() });
    const c = session({ session_id: 'c', is_cancelled: true });
    const list = upcomingSessions([a, b, c]);
    expect(list.map((s) => s.session_id)).toEqual(['b', 'a']);
    expect(sessionsOnDay(list, NOW).map((s) => s.session_id)).toEqual(['b']);
  });
  it('greets by time of day with the first name', () => {
    expect(greeting('Josh Smith', new Date(2026, 9, 7, 9))).toBe('Good morning, Josh.');
    expect(greeting('Josh', new Date(2026, 9, 7, 14))).toBe('Good afternoon, Josh.');
    expect(greeting('Josh', new Date(2026, 9, 7, 20))).toBe('Good evening, Josh.');
  });
});

describe('homeFor', () => {
  it('keeps owners and admins in the new Admin shell and sends others to their app', () => {
    expect(homeFor('owner', 'g')).toBe('admin');
    expect(homeFor('admin', 'g')).toBe('admin');
    expect(homeFor('coach', 'g')).toBe('../staff.html?gym_id=g');
    expect(homeFor('member', 'g')).toBe('../member.html?gym_id=g');
  });
});
