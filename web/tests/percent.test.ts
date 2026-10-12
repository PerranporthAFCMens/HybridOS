import { describe, expect, it } from 'vitest';
import { bestWeights, hasPercent, isPercent, kgFromPercent, parsePercent, percentError, planFor, resolveTarget } from '../src/train/percent';
import { describeTarget, setText } from '../src/train/calc';
import { emptyWorkout, newActivity, newBlock, validateWorkout } from '../src/workouts/calc';
import type { StoredPb } from '../src/train/pb';

const pb = (name: string, metric: string, value: number): StoredPb => ({ id: name + metric + value, name, metric, dir: 'higher', value, unit: 'kg', achievedAt: '2026-10-01T00:00:00Z', notes: null });

describe('percent: reading what a coach typed', () => {
  it('reads a percentage, with or without a space or decimals', () => {
    expect(parsePercent('80%')).toBe(80);
    expect(parsePercent(' 80 % ')).toBe(80);
    expect(parsePercent('82.5%')).toBe(82.5);
    expect(parsePercent('82,5%')).toBe(82.5);
  });

  it('refuses anything else, and anything out of range', () => {
    for (const t of ['80', 'abc%', '%', '0%', '151%', '-5%', '80%%', '8 0%', '', '1000%']) expect(parsePercent(t)).toBeNull();
  });

  it('knows a percentage box even when it is typed badly', () => {
    expect(isPercent('80%')).toBe(true);
    expect(isPercent('abc%')).toBe(true);
    expect(isPercent('80')).toBe(false);
    expect(isPercent(undefined)).toBe(false);
    expect(percentError('abc%')).toContain('is not a percentage');
    expect(percentError('80%')).toBeNull();
  });
});

describe('percent: turning it into kilos', () => {
  it('is a percentage of the best, to the nearest 1 kg', () => {
    expect(kgFromPercent(80, 100)).toBe(80);
    expect(kgFromPercent(80, 102.5)).toBe(82);
    expect(kgFromPercent(70, 87.5)).toBe(61);
    expect(kgFromPercent(82.5, 100)).toBe(83);
    expect(kgFromPercent(100, 142)).toBe(142);
  });

  it('is nothing when there is no best to work from', () => {
    expect(kgFromPercent(80, null)).toBeNull();
    expect(kgFromPercent(80, undefined)).toBeNull();
    expect(kgFromPercent(80, 0)).toBeNull();
    expect(kgFromPercent(1, 20)).toBeNull();
  });

  it('uses the heaviest recorded weight for an exercise, ignoring other kinds of best and case', () => {
    const m = bestWeights([pb('Back Squat', 'weight', 100), pb('back squat', 'weight', 110), pb('Back Squat', 'reps', 30), pb('Deadlift', 'weight', 0)]);
    expect(m.get('back squat')).toBe(110);
    expect(m.has('deadlift')).toBe(false);
  });
});

describe('percent: the member\'s sets', () => {
  const target = [{ reps: '5', weight: '60%' }, { reps: '5', weight: '70%' }, { reps: '3', weight: '80' }];

  it('fills in kilos for each percentage and leaves plain kilos alone', () => {
    expect(resolveTarget(target, 100)).toEqual([{ reps: '5', weight: '60' }, { reps: '5', weight: '70' }, { reps: '3', weight: '80' }]);
  });

  it('leaves the weight box empty when there is no best, but keeps the reps', () => {
    expect(resolveTarget(target, null)).toEqual([{ reps: '5' }, { reps: '5' }, { reps: '3', weight: '80' }]);
  });

  it('does not change what was passed in', () => {
    const copy = JSON.parse(JSON.stringify(target));
    resolveTarget(target, 100);
    expect(target).toEqual(copy);
  });

  it('says it in words, grouping identical sets', () => {
    expect(planFor('strength', [{ reps: '5', weight: '80%' }, { reps: '5', weight: '80%' }, { reps: '5', weight: '80%' }], 100, 'x')).toBe('3 sets: 5 × 80% (80 kg)');
    expect(planFor('strength', [{ reps: '5', weight: '80%' }], null, 'x')).toBe('5 × 80% (no best recorded yet)');
    expect(planFor('strength', [{ reps: '5', weight: '60' }], 100, 'the old words')).toBe('the old words');
  });

  it('shows a percentage as typed and kilos with kg', () => {
    expect(setText('strength', { reps: '5', weight: '80%' })).toBe('5 × 80%');
    expect(setText('strength', { reps: '5', weight: '60' })).toBe('5 × 60 kg');
    expect(describeTarget('strength', [{ reps: '5', weight: '80%' }, { reps: '5', weight: '80%' }])).toBe('2 sets: 5 × 80%');
    expect(hasPercent(target)).toBe(true);
    expect(hasPercent([{ weight: '60' }])).toBe(false);
  });
});

describe('percent: saving a workout with a percentage', () => {
  const build = (sets: Record<string, string>[]) => {
    const act = { ...newActivity(), name: 'Back Squat', tracking: 'strength', sets };
    return validateWorkout({ ...emptyWorkout, title: 'Squat day' }, [{ ...newBlock(), activities: [act] }]);
  };

  it('keeps the percentage in the saved sets and in the words', () => {
    const r = build([{ reps: '5', weight: '80%' }, { reps: '5', weight: '80%' }]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const p = r.blocks[0]?.activities[0]?.prescription as { display: string; sets: Record<string, string>[] };
    expect(p.display).toBe('2 sets: 5 × 80%');
    expect(p.sets).toEqual([{ reps: '5', weight: '80%' }, { reps: '5', weight: '80%' }]);
  });

  it('still accepts plain kilos, and a mix', () => {
    expect(build([{ reps: '5', weight: '85' }]).ok).toBe(true);
    expect(build([{ reps: '5', weight: '60%' }, { reps: '3', weight: '90' }]).ok).toBe(true);
  });

  it('refuses a badly typed or out of range percentage, naming the exercise', () => {
    for (const w of ['abc%', '0%', '200%']) {
      const r = build([{ reps: '5', weight: w }]);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.message).toContain('Back Squat: ');
    }
  });

  it('still refuses a weight that is not a number', () => {
    const r = build([{ reps: '5', weight: 'heavy' }]);
    expect(r.ok).toBe(false);
  });

  it('still checks the other boxes in a percentage row', () => {
    const r = build([{ reps: 'lots', weight: '80%' }]);
    expect(r.ok).toBe(false);
  });
});
