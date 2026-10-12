import { describe, expect, it } from 'vitest';
import { choiceText, defaultText, effectiveShow, liftRows, STARTER_LIFTS, validateLiftName, WEIGHT_EXERCISES } from '../src/lifts/calc';
import { pbKey } from '../src/train/pb';

describe('lifts: which exercises can be ticked', () => {
  it('offers weight exercises only', () => {
    expect(WEIGHT_EXERCISES).toContain('Back Squat');
    expect(WEIGHT_EXERCISES).toContain('Deadlift');
    expect(WEIGHT_EXERCISES).not.toContain('Run 5K');
    expect(WEIGHT_EXERCISES).not.toContain('Plank');
    expect(WEIGHT_EXERCISES).not.toContain('Rowing');
  });

  it('every starter lift is in the list, so the one-tap start never invents a name', () => {
    for (const n of STARTER_LIFTS) expect(WEIGHT_EXERCISES).toContain(n);
  });

  it('keys match how personal bests are keyed', () => {
    expect(pbKey('  Back Squat ')).toBe('back squat');
  });
});

describe('lifts: the list on screen', () => {
  const ticked = [{ key: 'deadlift', name: 'Deadlift' }, { key: 'zercher squat', name: 'Zercher Squat' }];

  it('shows ticked ones first, then the rest, each once', () => {
    const rows = liftRows(ticked, '');
    expect(rows.slice(0, 2).map((r) => r.name)).toEqual(['Deadlift', 'Zercher Squat']);
    expect(rows.slice(0, 2).every((r) => r.ticked)).toBe(true);
    expect(rows.slice(2).every((r) => !r.ticked)).toBe(true);
    expect(rows.filter((r) => r.key === 'deadlift')).toHaveLength(1);
  });

  it('keeps a hand-typed lift that is not in the list', () => {
    expect(liftRows(ticked, '').some((r) => r.key === 'zercher squat' && r.ticked)).toBe(true);
  });

  it('narrows by what was typed, ignoring case', () => {
    const rows = liftRows(ticked, 'BENCH');
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.name.toLowerCase().includes('bench'))).toBe(true);
    expect(liftRows(ticked, 'zzzz')).toEqual([]);
  });
});

describe('lifts: adding a name by hand', () => {
  it('refuses an empty name, a repeat (however it is cased) and an over-long name', () => {
    expect(validateLiftName('   ', [])).toBe('Type the name of the exercise.');
    expect(validateLiftName(' DEADLIFT ', [{ key: 'deadlift' }])).toBe('That one is already ticked.');
    expect(validateLiftName('x'.repeat(121), [])).toBe('Keep the name under 120 characters.');
    expect(validateLiftName('Zercher Squat', [{ key: 'deadlift' }])).toBeNull();
  });
});

describe('lifts: who is shown', () => {
  it('own choice first, then the gym switch', () => {
    expect(effectiveShow(null, true)).toBe(true);
    expect(effectiveShow(null, false)).toBe(false);
    expect(effectiveShow(true, false)).toBe(true);
    expect(effectiveShow(false, true)).toBe(false);
  });

  it('says in words which one decided', () => {
    expect(choiceText(null, true)).toContain('how the gym has it set');
    expect(choiceText(null, false)).toContain('hidden');
    expect(choiceText(true, false)).toBe('You chose to be shown.');
    expect(choiceText(false, true)).toBe('You chose to be hidden.');
    expect(defaultText(true)).toContain('until they opt out');
    expect(defaultText(false)).toContain('until they opt in');
  });
});
