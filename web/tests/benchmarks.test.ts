import { describe, expect, it } from 'vitest';
import { betterText, defaultBetter, defaultTestDays, isBetter, testWindow, validateBenchmark } from '../src/classes/benchmarks';

const block = { startsOn: '2026-10-12', weeks: 6 };
const good = { movementId: 'mv1', startOn: '2026-10-12', endOn: '2026-11-16', better: 'lower' as const };

describe('benchmark rules', () => {
  it('says a time is better lower and everything else higher', () => {
    expect(defaultBetter('time')).toBe('lower');
    for (const t of ['strength', 'reps', 'distance', 'calories', 'intervals']) expect(defaultBetter(t)).toBe('higher');
    expect(betterText('lower')).toBe('Lower is better');
    expect(isBetter('higher') && isBetter('lower') && !isBetter('bigger')).toBe(true);
  });
  it('gives a week for each test', () => {
    expect(testWindow('2026-10-12')).toEqual({ from: '2026-10-12', to: '2026-10-18' });
    expect(testWindow('2026-12-28')).toEqual({ from: '2026-12-28', to: '2027-01-03' });
  });
  it('suggests the first day and the first day of the last week', () => {
    expect(defaultTestDays(block)).toEqual({ startOn: '2026-10-12', endOn: '2026-11-16' });
    expect(defaultTestDays({ startsOn: '2026-10-12', weeks: 1 })).toEqual({ startOn: '2026-10-12', endOn: '2026-10-12' });
  });
  it('accepts a good benchmark', () => {
    expect(validateBenchmark(good, block, [])).toEqual({ ok: true, ...good });
  });
  it('refuses a missing or repeated movement', () => {
    expect(validateBenchmark({ ...good, movementId: '' }, block, [])).toEqual({ ok: false, message: 'Choose the movement to test.' });
    expect(validateBenchmark(good, block, ['mv1'])).toEqual({ ok: false, message: 'This block already tests that movement.' });
  });
  it('refuses days that are not days, or outside the block', () => {
    expect(validateBenchmark({ ...good, startOn: '' }, block, [])).toEqual({ ok: false, message: 'Choose the day each test opens.' });
    expect(validateBenchmark({ ...good, endOn: '2026-02-30' }, block, [])).toEqual({ ok: false, message: 'Choose the day each test opens.' });
    expect(validateBenchmark({ ...good, startOn: '2026-10-11' }, block, [])).toEqual({ ok: false, message: 'The start test must open inside the block.' });
    expect(validateBenchmark({ ...good, endOn: '2026-11-23' }, block, [])).toEqual({ ok: false, message: 'The end test must open inside the block.' });
  });
  it('refuses an end test that is not after the start test', () => {
    expect(validateBenchmark({ ...good, endOn: good.startOn }, block, [])).toEqual({ ok: false, message: 'The end test must come after the start test.' });
    expect(validateBenchmark({ ...good, startOn: '2026-11-16', endOn: '2026-10-19' }, block, [])).toEqual({ ok: false, message: 'The end test must come after the start test.' });
  });
  it('allows the last day of the block', () => {
    expect(validateBenchmark({ ...good, endOn: '2026-11-22' }, block, []).ok).toBe(true);
  });
});
