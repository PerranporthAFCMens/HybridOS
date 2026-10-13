import { describe, expect, it } from 'vitest';
import { isRepsTarget, parseRepsTarget, repsError, repsText } from '../src/train/reps';
import { describeTarget, setText, toDbSet } from '../src/train/calc';
import { resolveTarget } from '../src/train/percent';
import { emptyWorkout, newActivity, newBlock, validateWorkout } from '../src/workouts/calc';

describe('reps a coach can set', () => {
  it('reads a number, a range, or max (AMRAP means the same)', () => {
    expect(parseRepsTarget('10')).toEqual({ kind: 'count', n: 10 });
    expect(parseRepsTarget('8-12')).toEqual({ kind: 'range', min: 8, max: 12 });
    expect(parseRepsTarget(' 8 – 12 ')).toEqual({ kind: 'range', min: 8, max: 12 });
    expect(parseRepsTarget('8 to 12')).toEqual({ kind: 'range', min: 8, max: 12 });
    expect(parseRepsTarget('MAX')).toEqual({ kind: 'max' });
    expect(parseRepsTarget('amrap')).toEqual({ kind: 'max' });
  });

  it('refuses ranges that do not make sense, and anything else', () => {
    for (const t of ['12-8', '8-8', '0-5', '8-', '-8', 'lots', '8-12-16', '1000-2000', '']) expect(parseRepsTarget(t)).toBeNull();
  });

  it('knows which are targets the member cannot just copy', () => {
    expect(isRepsTarget('8-12')).toBe(true);
    expect(isRepsTarget('max')).toBe(true);
    expect(isRepsTarget('10')).toBe(false);
    expect(isRepsTarget('')).toBe(false);
  });

  it('explains a range that is typed wrongly, but leaves other text for the number check', () => {
    expect(repsError('12-8')).toContain('is not a range of reps');
    expect(repsError('8-')).toContain('is not a range of reps');
    expect(repsError('8-12')).toBeNull();
    expect(repsError('max')).toBeNull();
    expect(repsError('10')).toBeNull();
    expect(repsError('lots')).toBeNull();
    expect(repsError('')).toBeNull();
  });

  it('words them for the member', () => {
    expect(repsText('8-12')).toBe('8–12');
    expect(repsText('AMRAP')).toBe('max');
    expect(repsText('10')).toBe('10');
    expect(setText('strength', { reps: '8-12', weight: '60' })).toBe('8–12 × 60 kg');
    expect(setText('strength', { reps: 'max', weight: '80%' })).toBe('max reps × 80%');
    expect(setText('reps', { reps: 'max' })).toBe('max reps');
    expect(setText('reps', { reps: '8-12' })).toBe('8–12 reps');
    expect(describeTarget('strength', [{ reps: '8-12', weight: '60' }, { reps: '8-12', weight: '60' }])).toBe('2 sets: 8–12 × 60 kg');
  });

  it('is never filled in for the member, but a plain number still is', () => {
    expect(resolveTarget([{ reps: '8-12', weight: '60' }, { reps: 'max', weight: '60' }, { reps: '10', weight: '60' }], null)).toEqual([{ weight: '60' }, { weight: '60' }, { reps: '10', weight: '60' }]);
  });

  it('the member\'s own box still takes only a number', () => {
    expect(toDbSet('strength', { reps: 'max', weight: '60' }).error).toContain('not a number');
    expect(toDbSet('strength', { reps: '12', weight: '60' }).row?.reps).toBe(12);
  });
});

describe('saving a workout with rep targets', () => {
  const build = (sets: Record<string, string>[], tracking = 'strength') => {
    const act = { ...newActivity(), name: 'Push-ups', tracking, sets };
    return validateWorkout({ ...emptyWorkout, title: 'Upper' }, [{ ...newBlock(), activities: [act] }]);
  };

  it('keeps a range and max in the saved sets and the words', () => {
    const r = build([{ reps: '8-12', weight: '60' }, { reps: 'max', weight: '60' }]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const p = r.blocks[0]?.activities[0]?.prescription as { display: string; sets: Record<string, string>[] };
    expect(p.sets).toEqual([{ reps: '8-12', weight: '60' }, { reps: 'max', weight: '60' }]);
    expect(p.display).toBe('8–12 × 60 kg / max reps × 60 kg');
  });

  it('works for a reps-only exercise and alongside a percentage', () => {
    expect(build([{ reps: 'max' }], 'reps').ok).toBe(true);
    expect(build([{ reps: '8-12', weight: '80%' }]).ok).toBe(true);
  });

  it('refuses a range the wrong way round, naming the exercise', () => {
    const r = build([{ reps: '12-8', weight: '60' }]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toContain('Push-ups: "12-8" is not a range of reps');
  });

  it('still refuses reps that are not a number and other boxes that are wrong', () => {
    expect(build([{ reps: 'lots', weight: '60' }]).ok).toBe(false);
    expect(build([{ reps: '8-12', weight: 'heavy' }]).ok).toBe(false);
  });
});
