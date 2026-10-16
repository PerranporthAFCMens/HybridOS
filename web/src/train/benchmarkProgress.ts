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
