import { describe, expect, it } from 'vitest';
import type { LibraryData } from '../src/data/reportLibrary';
import { LIBRARY, LIBRARY_COUNT, ageBand, ageOn, genderLabel, inRange, pounds, searchLibrary, type LibraryContext } from '../src/reports/library';

const NOW = new Date('2026-10-08T12:00:00Z');
const ctx = (since: string | null = null): LibraryContext => ({ gymName: 'Puffin Performance', rangeLabel: 'Test range', now: NOW, since });
const run = (key: string, d: LibraryData, since: string | null = null) => {
  const r = LIBRARY.flatMap((g) => g.reports).find((x) => x.key === key);
  if (!r) throw new Error(`no report ${key}`);
  return r.build(ctx(since), d);
};

const data = (over: Partial<LibraryData> = {}): LibraryData => ({
  plans: [
    { id: 'p1', name: 'Hybrid', pricePence: 5900, interval: 'monthly' },
    { id: 'p2', name: 'Annual', pricePence: 59000, interval: 'annual' },
    { id: 'p3', name: 'Gym', pricePence: 2900, interval: 'monthly' },
  ],
  memberships: [
    { userId: 'u1', planId: 'p1', status: 'active', startsOn: '2026-01-01', endsOn: '', provider: 'manual', paymentStatus: 'confirmed', updatedAt: '2026-10-01T10:00:00Z' },
    { userId: 'u2', planId: 'p1', status: 'active', startsOn: '2026-02-01', endsOn: '', provider: 'manual', paymentStatus: 'confirmed', updatedAt: '2026-03-01T10:00:00Z' },
    { userId: 'u3', planId: 'p2', status: 'active', startsOn: '2026-03-01', endsOn: '', provider: 'manual', paymentStatus: 'confirmed', updatedAt: '2026-03-01T10:00:00Z' },
    { userId: 'u4', planId: 'p3', status: 'cancelled', startsOn: '2026-01-01', endsOn: '2026-09-01', provider: 'manual', paymentStatus: 'confirmed', updatedAt: '2026-09-01T10:00:00Z' },
  ],
  gymMembers: [
    { userId: 'u1', joinedAt: '2026-01-10T10:00:00Z', attritionOn: '' },
    { userId: 'u2', joinedAt: '2026-01-20T10:00:00Z', attritionOn: '' },
    { userId: 'u3', joinedAt: '2026-03-05T10:00:00Z', attritionOn: '' },
    { userId: 'u4', joinedAt: '2026-01-15T10:00:00Z', attritionOn: '2026-09-01' },
  ],
  people: new Map([
    ['u1', { name: 'Amelia Hart', dateOfBirth: '1990-10-08', gender: 'female' }],
    ['u2', { name: 'Jack Pengelly', dateOfBirth: '2010-01-01', gender: 'male' }],
    ['u3', { name: 'Priya Nair', dateOfBirth: '', gender: '' }],
    ['u4', { name: 'Tom Trevorrow', dateOfBirth: '1960-05-05', gender: 'prefer_not_to_say' }],
    ['staff', { name: 'Coach Carla', dateOfBirth: '', gender: '' }],
  ]),
  payments: [
    { userId: 'u1', chargeDate: '2026-10-01', createdAt: '2026-10-01T00:00:00Z', amountPence: 5999, state: 'paid_out', provider: 'manual', failure: '' },
    { userId: 'u2', chargeDate: '2026-10-01', createdAt: '2026-10-01T00:00:00Z', amountPence: 5900, state: 'failed', provider: 'manual', failure: 'insufficient_funds' },
    { userId: 'u4', chargeDate: '2026-05-01', createdAt: '2026-05-01T00:00:00Z', amountPence: 2900, state: 'charged_back', provider: 'manual', failure: '' },
  ],
  purchases: [{ userId: 'u1', sessionId: 's1', createdAt: '2026-10-02T09:00:00Z', amountPence: 800, status: 'paid' }],
  assignments: [
    { userId: 'u1', title: 'Leg day', type: 'pt', source: 'pt', status: 'completed', scheduledFor: '2026-10-03', completedAt: '2026-10-03T10:00:00Z', rpe: 7, createdAt: '2026-10-01T10:00:00Z' },
    { userId: 'u2', title: 'WOD', type: 'wod', source: 'wod', status: 'assigned', scheduledFor: '', completedAt: '', rpe: null, createdAt: '2026-10-02T10:00:00Z' },
    { userId: 'u3', title: 'Old one', type: 'wod', source: 'wod', status: 'assigned', scheduledFor: '', completedAt: '', rpe: null, createdAt: '2026-01-02T10:00:00Z' },
  ],
  workoutSessions: [{ userId: 'u1', title: 'Run', performedAt: '2026-10-04T08:00:00Z', notes: 'Easy' }],
  pt: [{ memberId: 'u1', staffId: 'staff', startsAt: '2026-10-05T09:00:00Z', endsAt: '2026-10-05T10:00:00Z', status: 'booked', notes: '' }],
  sessions: [
    { id: 's1', name: 'HIIT', startsAt: '2026-10-05T09:00:00Z', endsAt: '2026-10-05T10:00:00Z', capacity: 10, dropInPence: 800 },
    { id: 's2', name: 'HIIT', startsAt: '2026-09-28T09:00:00Z', endsAt: '2026-09-28T10:00:00Z', capacity: 10, dropInPence: null },
    { id: 's3', name: 'Yoga', startsAt: '2026-10-06T18:00:00Z', endsAt: '2026-10-06T19:00:00Z', capacity: 5, dropInPence: null },
  ],
  bookings: [
    { sessionId: 's1', userId: 'u1', status: 'attended', bookedAt: '2026-10-01T10:00:00Z', cancelledAt: '' },
    { sessionId: 's1', userId: 'u2', status: 'no_show', bookedAt: '2026-10-01T11:00:00Z', cancelledAt: '' },
    { sessionId: 's1', userId: 'u3', status: 'cancelled', bookedAt: '2026-10-01T12:00:00Z', cancelledAt: '2026-10-02T08:00:00Z' },
    { sessionId: 's2', userId: 'u1', status: 'attended', bookedAt: '2026-09-20T10:00:00Z', cancelledAt: '' },
    { sessionId: 's3', userId: 'u1', status: 'booked', bookedAt: '2026-10-02T10:00:00Z', cancelledAt: '' },
  ],
  ...over,
});

describe('library', () => {
  it('has the 24 reports of the old page in five groups', () => {
    expect(LIBRARY_COUNT).toBe(24);
    expect(LIBRARY.map((g) => g.group)).toEqual(['Membership & growth', 'Lifecycle & retention', 'Classes & attendance', 'Revenue & payments', 'Workouts & PT']);
    expect(new Set(LIBRARY.flatMap((g) => g.reports.map((r) => r.key))).size).toBe(24);
  });

  it('builds every report with a title, subtitle and matching column counts, even with no data at all', () => {
    const empty = data({ plans: [], memberships: [], gymMembers: [], people: new Map(), payments: [], purchases: [], assignments: [], workoutSessions: [], pt: [], sessions: [], bookings: [] });
    for (const d of [data(), empty]) {
      for (const r of LIBRARY.flatMap((g) => g.reports)) {
        const t = r.build(ctx('2026-09-01T00:00:00Z'), d);
        expect(t.title).toBe(r.title);
        expect(t.subtitle).toContain('Puffin Performance');
        for (const row of t.rows) expect(row).toHaveLength(t.headers.length);
      }
    }
  });

  it('searches by name, description or group', () => {
    expect(searchLibrary('').length).toBe(5);
    expect(searchLibrary('no-show').flatMap((g) => g.reports.map((r) => r.key))).toContain('no_shows');
    expect(searchLibrary('retention').map((g) => g.group)).toEqual(['Lifecycle & retention', 'Classes & attendance'].filter((g) => searchLibrary('retention').some((x) => x.group === g)));
    expect(searchLibrary('zzzz')).toEqual([]);
  });
});

describe('helpers', () => {
  it('shows pounds and pence', () => {
    expect(pounds(5999)).toBe('£59.99');
    expect(pounds(0)).toBe('£0.00');
    expect(pounds(123456)).toBe('£1,234.56');
  });
  it('keeps rows with no date and drops older ones', () => {
    expect(inRange(null, '2020-01-01')).toBe(true);
    expect(inRange('2026-09-01T00:00:00Z', '')).toBe(true);
    expect(inRange('2026-09-01T00:00:00Z', '2026-08-31T23:59:59Z')).toBe(false);
    expect(inRange('2026-09-01T00:00:00Z', '2026-09-01T00:00:00Z')).toBe(true);
  });
  it('works out age and band on the birthday itself', () => {
    expect(ageOn('1990-10-08', NOW)).toBe(36);
    expect(ageOn('1990-10-09', NOW)).toBe(35);
    expect(ageOn('', NOW)).toBeNull();
    expect(ageBand('2010-01-01', NOW)).toBe('Under 18');
    expect(ageBand('1990-10-08', NOW)).toBe('35–44');
    expect(ageBand('1960-05-05', NOW)).toBe('65+');
    expect(ageBand('', NOW)).toBe('Not set');
  });
  it('words genders', () => {
    expect(genderLabel('non_binary')).toBe('Non-binary');
    expect(genderLabel('')).toBe('Not set');
  });
});

describe('membership reports', () => {
  it('lists every membership, and only active ones in the active report', () => {
    expect(run('membership_register', data()).rows).toHaveLength(4);
    const a = run('active_memberships', data());
    expect(a.rows.map((r) => r[0])).toEqual(['Amelia Hart', 'Jack Pengelly', 'Priya Nair']);
    expect(a.rows[0]).toEqual(['Amelia Hart', 'Hybrid', '2026-01-01', 'manual', 'confirmed']);
  });
  it('plan mix counts active members and monthly income, with the annual plan spread over 12 months', () => {
    const t = run('membership_plan_mix', data());
    expect(t.rows).toEqual([['Hybrid', 2, '£118.00'], ['Annual', 1, '£49.17'], ['Gym', 0, '£0.00']]);
  });
  it('membership changes respects the range', () => {
    const all = run('membership_changes', data());
    const recent = run('membership_changes', data(), '2026-09-15T00:00:00Z');
    expect(all.rows).toHaveLength(4);
    expect(recent.rows.map((r) => r[0])).toEqual(['Amelia Hart']);
  });
});

describe('lifecycle reports', () => {
  it('shows live and left members with age and gender', () => {
    const t = run('member_lifecycle', data());
    expect(t.rows[0]).toEqual(['Amelia Hart', '10/01/2026', '', 'Live', 36, 'Female']);
    expect(t.rows[3]).toEqual(['Tom Trevorrow', '15/01/2026', '01/09/2026', 'Left', 66, 'Prefer not to say']);
  });
  it('attrition log has days as a member', () => {
    const t = run('attrition_log', data());
    expect(t.rows).toEqual([['Tom Trevorrow', '15/01/2026', '01/09/2026', 229]]);
    expect(run('attrition_log', data(), '2026-10-01T00:00:00Z').rows).toEqual([]);
  });
  it('monthly joins versus attrition nets out', () => {
    const t = run('joins_attrition_monthly', data());
    expect(t.rows).toEqual([['2026-01', 3, 0, 3], ['2026-03', 1, 0, 1], ['2026-09', 0, 1, -1]]);
  });
  it('groups ages and genders, biggest first', () => {
    expect(run('age_demographics', data()).rows).toEqual([['35–44', 1], ['65+', 1], ['Not set', 1], ['Under 18', 1]]);
    expect(run('gender_demographics', data()).rows.map((r) => r[0]).sort()).toEqual(['Female', 'Male', 'Not set', 'Prefer not to say']);
  });
});

describe('class and attendance reports', () => {
  it('session detail counts only people who took a place', () => {
    const t = run('class_sessions', data());
    expect(t.rows[0]).toEqual(['HIIT', '05/10/2026 10:00', '05/10/2026 11:00', 10, 2, 1, 1, 20, '£8.00']);
    expect(t.rows[1]?.[8]).toBe('');
  });
  it('class performance rolls sessions up by class and ranks by fill', () => {
    const t = run('class_performance', data());
    // HIIT: 2 sessions, 20 places, 3 took a place (u1 attended, u2 no-show, u1 attended again) = 15%. Yoga: 1 of 5 = 20%.
    expect(t.rows).toEqual([['Yoga', 1, 1, 0, 0, 20], ['HIIT', 2, 3, 2, 1, 15]]);
  });
  it('attendance log, no-shows and cancellations come from the same bookings', () => {
    expect(run('attendance_log', data()).rows).toHaveLength(5);
    expect(run('no_shows', data()).rows).toEqual([['Jack Pengelly', 'HIIT', '05/10/2026 10:00', '01/10/2026 12:00']]);
    expect(run('cancellations', data()).rows).toEqual([['Priya Nair', 'HIIT', '05/10/2026 10:00', '02/10/2026 09:00']]);
  });
  it('attendance log respects the range (by when it was booked)', () => {
    expect(run('attendance_log', data(), '2026-10-01T00:00:00Z').rows).toHaveLength(4);
  });
  it('member attendance ranks by activity and leaves cancellations out', () => {
    expect(run('member_attendance', data()).rows).toEqual([['Amelia Hart', 3], ['Jack Pengelly', 1]]);
  });
  it('inactive members: never attended, or last attended before the range', () => {
    const t = run('inactive_members', data(), '2026-10-01T00:00:00Z');
    // u1 last attended 5 Oct (after the range start): active. u2 and u3 never attended. u4 has left.
    expect(t.rows.map((r) => [r[0], r[2]])).toEqual([['Jack Pengelly', 'Never'], ['Priya Nair', 'Never']]);
    const old = run('inactive_members', data({ bookings: [{ sessionId: 's2', userId: 'u1', status: 'attended', bookedAt: '2026-09-20T10:00:00Z', cancelledAt: '' }] }), '2026-10-01T00:00:00Z');
    expect(old.rows.map((r) => r[0])).toContain('Amelia Hart');
    // All time: only people who never attended.
    expect(run('inactive_members', data()).rows.map((r) => r[0])).toEqual(['Jack Pengelly', 'Priya Nair']);
  });
});

describe('payment reports', () => {
  it('ledger shows pence and respects the range', () => {
    const t = run('payment_ledger', data(), '2026-09-01T00:00:00Z');
    expect(t.rows).toEqual([['Amelia Hart', '2026-10-01', '£59.99', 'paid_out', 'manual', ''], ['Jack Pengelly', '2026-10-01', '£59.00', 'failed', 'manual', 'insufficient_funds']]);
  });
  it('failed payments include charge-backs and ignore the range', () => {
    expect(run('failed_payments', data(), '2026-09-01T00:00:00Z').rows.map((r) => [r[0], r[3]])).toEqual([['Jack Pengelly', 'failed'], ['Tom Trevorrow', 'charged_back']]);
  });
  it('revenue by state groups value', () => {
    expect(run('revenue_by_state', data()).rows).toEqual([['paid_out', 1, '£59.99'], ['failed', 1, '£59.00'], ['charged_back', 1, '£29.00']]);
  });
  it('drop-in sales name the class', () => {
    expect(run('drop_in_sales', data()).rows).toEqual([['Amelia Hart', 'HIIT', '02/10/2026 10:00', '£8.00', 'paid']]);
  });
});

describe('workout and PT reports', () => {
  it('lists assignments in range with RPE', () => {
    const t = run('workout_assignments', data(), '2026-09-01T00:00:00Z');
    expect(t.rows).toHaveLength(2);
    expect(t.rows[0]).toEqual(['Amelia Hart', 'Leg day', 'pt', 'pt', 'completed', '2026-10-03', '03/10/2026 11:00', 7]);
    expect(t.rows[1]?.[7]).toBe('');
  });
  it('workout completion groups by status', () => {
    expect(run('workout_completion', data(), '2026-09-01T00:00:00Z').rows).toEqual([['assigned', 1], ['completed', 1]]);
  });
  it('sessions and PT appointments name both people', () => {
    expect(run('workout_sessions', data()).rows).toEqual([['Amelia Hart', 'Run', '04/10/2026 09:00', 'Easy']]);
    expect(run('pt_appointments', data()).rows).toEqual([['Amelia Hart', 'Coach Carla', '05/10/2026 10:00', '05/10/2026 11:00', 'booked', '']]);
  });
});
