// A member's block benchmark results, worked out from the workouts they recorded. Nothing is stored: the start result is the best matching
// exercise recorded in the week the start test opened, the end result the same for the end test. Pure rules so they are tested.
import { addDaysTo, daysBetween } from '../classes/blocks';
import { TEST_DAYS, testWindow, type Better } from '../classes/benchmarks';
import { candidatesFor, pbKey, type Metric } from './pb';
import type { DbSet, Tracking } from './calc';

export interface BenchmarkDef { id: string; movementId: string; movementName: string; tracking: string; startOn: string; endOn: string; better: Better }
/** One exercise a member recorded, with the gym day it was recorded on. */
export interface RecordedExercise { day: string; name: string; movementId: string | null; tracking: Tracking; sets: DbSet[] }
export interface Reading { value: number; metric: Metric; unit: string }
export type TestState = 'done' | 'open' | 'soon' | 'missed';
export interface TestProgress { day: string; state: TestState; reading: Reading | null }
export interface BenchmarkProgress { def: BenchmarkDef; start: TestProgress; end: TestProgress; change: number | null; improved: boolean | null }

const matches = (b: BenchmarkDef, x: RecordedExercise): boolean => x.movementId === b.movementId || pbKey(x.name) === pbKey(b.movementName);

/** The best matching result recorded inside one test window, or null when nothing matching was recorded. */
export function readingIn(b: BenchmarkDef, window: { from: string; to: string }, recorded: RecordedExercise[]): Reading | null {
  let best: Reading | null = null;
  for (const x of recorded) {
    if (x.day < window.from || x.day > window.to || !matches(b, x)) continue;
    const c = candidatesFor(x.name, x.tracking, x.sets)[0];
    if (!c) continue;
    const better = best === null || (b.better === 'lower' ? c.value < best.value : c.value > best.value);
    if (better) best = { value: c.value, metric: c.metric, unit: c.unit };
  }
  return best;
}

function testState(day: string, today: string, reading: Reading | null): TestState {
  if (reading) return 'done';
  if (daysBetween(day, today) < 0) return 'soon';
  return daysBetween(addDaysTo(day, TEST_DAYS - 1), today) > 0 ? 'missed' : 'open';
}

export function progressFor(b: BenchmarkDef, recorded: RecordedExercise[], today: string): BenchmarkProgress {
  const s = readingIn(b, testWindow(b.startOn), recorded);
  const e = readingIn(b, testWindow(b.endOn), recorded);
  const change = s && e ? e.value - s.value : null;
  const improved = change === null || change === 0 ? null : b.better === 'lower' ? change < 0 : change > 0;
  return { def: b, start: { day: b.startOn, state: testState(b.startOn, today, s), reading: s }, end: { day: b.endOn, state: testState(b.endOn, today, e), reading: e }, change, improved };
}

/** One set of one exercise as the coach function returns it. */
export interface ResultRow { user_id: string; display_name: string; exercise_name: string; movement_id: string | null; tracking_type: string; day: string; weight_kg: number | null; reps: number | null; duration_seconds: number | null; distance_m: number | null; calories: number | null }
export interface MemberResults { userId: string; name: string; recorded: RecordedExercise[] }

const TRACKINGS: Tracking[] = ['strength', 'reps', 'time', 'distance', 'calories'];

/** Rows (one per set) back into each member's recorded exercises, sets gathered per day and exercise. */
export function groupMemberResults(rows: ResultRow[]): MemberResults[] {
  const people = new Map<string, MemberResults>();
  const entries = new Map<string, RecordedExercise>();
  for (const r of rows) {
    const tracking = r.tracking_type as Tracking;
    if (!TRACKINGS.includes(tracking)) continue;
    const person = people.get(r.user_id) ?? { userId: r.user_id, name: r.display_name, recorded: [] };
    people.set(r.user_id, person);
    const key = [r.user_id, r.day, r.movement_id ?? '', pbKey(r.exercise_name), tracking].join('|');
    let ex = entries.get(key);
    if (!ex) {
      ex = { day: r.day, name: r.exercise_name, movementId: r.movement_id, tracking, sets: [] };
      entries.set(key, ex);
      person.recorded.push(ex);
    }
    ex.sets.push({ weight_kg: r.weight_kg, reps: r.reps, duration_seconds: r.duration_seconds, distance_m: r.distance_m, calories: r.calories, side: null, custom_value: null, custom_unit: null });
  }
  return [...people.values()];
}
