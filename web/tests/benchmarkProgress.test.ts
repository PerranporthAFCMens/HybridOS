import { describe, expect, it } from 'vitest';
import { groupMemberResults, progressFor, readingIn, type BenchmarkDef, type RecordedExercise } from '../src/train/benchmarkProgress';
import { canSwitchCoachView } from '../src/classes/benchmarks';
import type { DbSet } from '../src/train/calc';

const set = (o: Partial<DbSet>): DbSet => ({ weight_kg: null, reps: null, duration_seconds: null, distance_m: null, calories: null, side: null, custom_value: null, custom_unit: null, ...o });
const row: BenchmarkDef = { id: 'b1', movementId: 'mv1', movementName: '1 km Row', tracking: 'time', startOn: '2026-10-12', endOn: '2026-11-16', better: 'lower' };
const ex = (day: string, secs: number, extra: Partial<RecordedExercise> = {}): RecordedExercise => ({ day, name: '1 km row', movementId: 'mv1', tracking: 'time', sets: [set({ duration_seconds: secs })], ...extra });

describe('benchmark progress', () => {
  it('takes the best matching result inside the test week only', () => {
    const rec = [ex('2026-10-13', 250), ex('2026-10-15', 240), ex('2026-10-25', 200)];
    expect(readingIn(row, { from: '2026-10-12', to: '2026-10-18' }, rec)?.value).toBe(240);
    expect(readingIn(row, { from: '2026-11-16', to: '2026-11-22' }, rec)).toBeNull();
  });
  it('matches by name when an old workout has no movement link, and ignores other movements', () => {
    expect(readingIn(row, { from: '2026-10-12', to: '2026-10-18' }, [ex('2026-10-13', 230, { movementId: null })])?.value).toBe(230);
    expect(readingIn(row, { from: '2026-10-12', to: '2026-10-18' }, [ex('2026-10-13', 100, { name: 'Ski erg', movementId: 'mv9' })])).toBeNull();
  });
  it('shows a shorter time as better and a longer one as worse', () => {
    const better = progressFor(row, [ex('2026-10-13', 250), ex('2026-11-17', 235)], '2026-11-20');
    expect(better.change).toBe(-15);
    expect(better.improved).toBe(true);
    expect(progressFor(row, [ex('2026-10-13', 250), ex('2026-11-17', 260)], '2026-11-20').improved).toBe(false);
  });
  it('uses higher as better for weights', () => {
    const lift: BenchmarkDef = { ...row, movementName: 'Back squat', movementId: 'mv2', tracking: 'strength', better: 'higher' };
    const w = (day: string, kg: number): RecordedExercise => ({ day, name: 'Back squat', movementId: 'mv2', tracking: 'strength', sets: [set({ weight_kg: kg, reps: 5 })] });
    expect(progressFor(lift, [w('2026-10-12', 80), w('2026-11-16', 90)], '2026-11-30').improved).toBe(true);
  });
  it('says where each test is: soon, open, missed or done', () => {
    expect(progressFor(row, [], '2026-10-05').start.state).toBe('soon');
    expect(progressFor(row, [], '2026-10-14').start.state).toBe('open');
    expect(progressFor(row, [], '2026-10-20').start.state).toBe('missed');
    expect(progressFor(row, [ex('2026-10-13', 250)], '2026-10-20').start.state).toBe('done');
    expect(progressFor(row, [], '2026-10-20').change).toBeNull();
  });
});

describe('coach results', () => {
  const r = (user: string, day: string, secs: number, extra: Record<string, unknown> = {}) => ({ user_id: user, display_name: user === 'u1' ? 'Sam T.' : 'Alex B.', exercise_name: '1 km row', movement_id: 'mv1', tracking_type: 'time', day, weight_kg: null, reps: null, duration_seconds: secs, distance_m: null, calories: null, ...extra });
  it('groups rows per member and works out the same change the member sees', () => {
    const people = groupMemberResults([r('u1', '2026-10-13', 250), r('u1', '2026-11-17', 235), r('u2', '2026-10-14', 300)]);
    expect(people.map((p) => p.name)).toEqual(['Sam T.', 'Alex B.']);
    const sam = progressFor(row, people[0]?.recorded ?? [], '2026-11-20');
    expect(sam.start.reading?.value).toBe(250);
    expect(sam.change).toBe(-15);
    expect(progressFor(row, people[1]?.recorded ?? [], '2026-11-20').end.reading).toBeNull();
  });
  it('gathers the sets of one exercise and skips kinds it cannot score', () => {
    const people = groupMemberResults([r('u1', '2026-10-13', 260), r('u1', '2026-10-13', 245), r('u1', '2026-10-13', 1, { tracking_type: 'scores' })]);
    expect(people[0]?.recorded).toHaveLength(1);
    expect(progressFor(row, people[0]?.recorded ?? [], '2026-10-20').start.reading?.value).toBe(245);
  });
  it('lets only an owner or admin switch the coach view', () => {
    expect([canSwitchCoachView('owner'), canSwitchCoachView('admin'), canSwitchCoachView('coach'), canSwitchCoachView('staff'), canSwitchCoachView('member')]).toEqual([true, true, false, false, false]);
  });
});
