// Pure rules for block benchmarks: a movement a block tests twice, at the start and at the end ("1 km row, tested week 1 and week 6").
// Dates are plain yyyy-mm-dd days on the gym's clock. A member's result is the workout they record with that movement, so nothing is
// stored here beyond which movement, which two days, and whether a higher or lower result is better.
import { addDaysTo, blockLastDay, daysBetween } from './blocks';

export type Better = 'higher' | 'lower';
export const isBetter = (v: unknown): v is Better => v === 'higher' || v === 'lower';

export interface BenchmarkForm { movementId: string; startOn: string; endOn: string; better: Better }
export type BenchmarkCheck = { ok: true; movementId: string; startOn: string; endOn: string; better: Better } | { ok: false; message: string };

const isDay = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && addDaysTo(s, 0) === s;

/** A time is better when it is shorter; weight, reps, distance and calories when they are bigger. The coach can change it (a plank hold is longer). */
export const defaultBetter = (tracking: string): Better => (tracking === 'time' ? 'lower' : 'higher');

export const betterText = (b: Better): string => (b === 'lower' ? 'Lower is better' : 'Higher is better');

/** The days a test is open: the day it opens and the six after it, so a member has a week to do it. */
export const TEST_DAYS = 7;
export const testWindow = (day: string): { from: string; to: string } => ({ from: day, to: addDaysTo(day, TEST_DAYS - 1) });

export function validateBenchmark(f: BenchmarkForm, block: { startsOn: string; weeks: number }, usedMovementIds: string[]): BenchmarkCheck {
  if (!f.movementId) return { ok: false, message: 'Choose the movement to test.' };
  if (usedMovementIds.includes(f.movementId)) return { ok: false, message: 'This block already tests that movement.' };
  if (!isDay(f.startOn) || !isDay(f.endOn)) return { ok: false, message: 'Choose the day each test opens.' };
  const last = blockLastDay(block.startsOn, block.weeks);
  if (daysBetween(block.startsOn, f.startOn) < 0 || daysBetween(f.startOn, last) < 0) return { ok: false, message: 'The start test must open inside the block.' };
  if (daysBetween(block.startsOn, f.endOn) < 0 || daysBetween(f.endOn, last) < 0) return { ok: false, message: 'The end test must open inside the block.' };
  if (daysBetween(f.startOn, f.endOn) <= 0) return { ok: false, message: 'The end test must come after the start test.' };
  if (!isBetter(f.better)) return { ok: false, message: 'Say whether a higher or a lower result is better.' };
  return { ok: true, movementId: f.movementId, startOn: f.startOn, endOn: f.endOn, better: f.better };
}

/** Sensible first dates for a block: the start test on its first day, the end test on its last week's first day. */
export function defaultTestDays(block: { startsOn: string; weeks: number }): { startOn: string; endOn: string } {
  const endOn = block.weeks > 1 ? addDaysTo(block.startsOn, (block.weeks - 1) * 7) : addDaysTo(block.startsOn, 0);
  return { startOn: block.startsOn, endOn };
}
