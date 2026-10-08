import { describe, expect, it } from 'vitest';
import type { DbSet } from '../src/train/calc';
import { candidatesFor, comparable, fmtDist, isBetter, manualCandidate, pbValueText, wonMessage, wonText } from '../src/train/pb';

const set = (p: Partial<DbSet>): DbSet => ({ weight_kg: null, reps: null, duration_seconds: null, distance_m: null, calories: null, side: null, ...p });

describe('candidates', () => {
  it('strength: the heaviest weight, else the most reps', () => {
    expect(candidatesFor('Squat', 'strength', [set({ weight_kg: 100, reps: 5 }), set({ weight_kg: 120, reps: 1 })])).toEqual([{ name: 'Squat', metric: 'weight', dir: 'higher', value: 120, unit: 'kg' }]);
    expect(candidatesFor('Pull-ups', 'strength', [set({ reps: 8 }), set({ reps: 12 })])[0]).toMatchObject({ metric: 'reps', value: 12 });
    expect(candidatesFor('Squat', 'strength', [set({})])).toEqual([]);
  });
  it('time: shorter is better, but a hold is better longer', () => {
    expect(candidatesFor('5k', 'time', [set({ duration_seconds: 1500 }), set({ duration_seconds: 1458 })])[0]).toMatchObject({ dir: 'lower', value: 1458 });
    expect(candidatesFor('Plank', 'time', [set({ duration_seconds: 60 }), set({ duration_seconds: 95 })])[0]).toMatchObject({ dir: 'higher', value: 95 });
  });
  it('distance, calories, reps and the ones with no best', () => {
    expect(candidatesFor('Row', 'distance', [set({ distance_m: 2000 }), set({ distance_m: 5000 })])[0]).toMatchObject({ metric: 'distance', value: 5000, unit: 'm' });
    expect(candidatesFor('Bike', 'calories', [set({ calories: 80 })])[0]).toMatchObject({ metric: 'calories', unit: 'kcal' });
    expect(candidatesFor('Burpees', 'reps', [set({ reps: 30 })])[0]).toMatchObject({ metric: 'reps', value: 30 });
    expect(candidatesFor('Stretch', 'instruction', [])).toEqual([]);
    expect(candidatesFor('Rounds', 'intervals', [set({ reps: 5 })])).toEqual([]);
    expect(candidatesFor('  ', 'strength', [set({ weight_kg: 5 })])).toEqual([]);
  });
});

describe('better', () => {
  const c = { name: 'x', metric: 'weight' as const, dir: 'higher' as const, value: 100, unit: 'kg' };
  it('the first is always better; after that it must beat it', () => {
    expect(isBetter(c, undefined)).toBe(true);
    expect(isBetter(c, { metric: 'weight', unit: 'kg', value: 100 })).toBe(false);
    expect(isBetter(c, { metric: 'weight', unit: 'kg', value: 99 })).toBe(true);
    expect(isBetter({ ...c, metric: 'time', dir: 'lower', value: 1400 }, { metric: 'time', unit: 'sec', value: 1458 })).toBe(true);
  });
  it('old times in minutes are compared in seconds', () => {
    expect(comparable('time', 'min', 24)).toBe(1440);
    expect(isBetter({ ...c, metric: 'time', dir: 'lower', value: 1500, unit: 'sec' }, { metric: 'time', unit: 'min', value: 24 })).toBe(false);
  });
});

describe('words', () => {
  it('values', () => {
    expect(pbValueText('weight', 'kg', 120)).toBe('120 kg');
    expect(pbValueText('time', 'sec', 1458)).toBe('24:18');
    expect(pbValueText('time', 'min', 24)).toBe('24:00');
    expect(pbValueText('distance', 'm', 5000)).toBe('5 km');
    expect(pbValueText('distance', 'm', 400)).toBe('400 m');
    expect(fmtDist(1500)).toBe('1.5 km');
    expect(wonText({ name: 'Squat', metric: 'weight', dir: 'higher', value: 120, unit: 'kg' })).toBe('Squat 120 kg');
  });
  it('the message', () => {
    expect(wonMessage([])).toBe('');
    expect(wonMessage([{ text: 'Squat 120 kg', first: true }])).toBe('First personal best: Squat 120 kg');
    expect(wonMessage([{ text: 'A', first: false }, { text: 'B', first: true }])).toBe('New personal bests: A, B');
    expect(wonMessage(['A', 'B', 'C', 'D', 'E'].map((text) => ({ text, first: false })))).toBe('New personal bests: A, B, C and 2 more');
  });
});

describe('typed by hand', () => {
  it('kilograms, times and kilometres', () => {
    expect(manualCandidate('Deadlift', 'weight', '145').c).toMatchObject({ value: 145, unit: 'kg', dir: 'higher' });
    expect(manualCandidate('5k', 'time', '24:18').c).toMatchObject({ value: 1458, dir: 'lower', unit: 'sec' });
    expect(manualCandidate('Run', 'distance', '5,5').c).toMatchObject({ value: 5500, unit: 'm' });
  });
  it('says what is wrong', () => {
    expect(manualCandidate('', 'weight', '5').error).toBe('Add the exercise or event.');
    expect(manualCandidate('x', 'weight', 'heavy').error).toBe('Enter a number above zero.');
    expect(manualCandidate('x', 'time', '99:99').error).toContain('minutes and seconds');
    expect(manualCandidate('x', 'weight', '0').error).not.toBeNull();
  });
});
