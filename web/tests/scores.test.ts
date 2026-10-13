import { describe, expect, it } from 'vitest';
import { blankSets, checkScores, dbTracking, fromDbSet, readScores, readSnapshot, scoreFields, scoreSummary, setText, toDbSet } from '../src/train/calc';
import { defaultScores, emptyWorkout, formScores, newActivity, newBlock, validateWorkout } from '../src/workouts/calc';

describe('two scores on one exercise: reading and checking them', () => {
  it('reads two named scores and drops anything unusable, a repeated kind or a third', () => {
    expect(readScores([{ name: 'Rounds', kind: 'rounds' }, { name: 'Time', kind: 'time' }])).toEqual([{ name: 'Rounds', kind: 'rounds' }, { name: 'Time', kind: 'time' }]);
    expect(readScores([{ name: 'A', kind: 'reps' }, { name: 'B', kind: 'reps' }, { name: 'C', kind: 'time' }])).toEqual([{ name: 'A', kind: 'reps' }, { name: 'C', kind: 'time' }]);
    expect(readScores([{ name: 'A', kind: 'reps' }, { name: 'B', kind: 'time' }, { name: 'C', kind: 'weight' }])).toHaveLength(2);
    expect(readScores([{ name: ' ', kind: 'reps' }, { name: 'X', kind: 'speed' }, 'x', null])).toEqual([]);
    expect(readScores('nope')).toEqual([]);
    expect(readScores([{ name: 'x'.repeat(100), kind: 'reps' }])[0]?.name).toHaveLength(40);
  });

  it('asks for both scores to be named and to be different kinds', () => {
    expect(checkScores([{ name: 'Rounds', kind: 'rounds' }, { name: 'Reps', kind: 'reps' }])).toBeNull();
    expect(checkScores([{ name: 'Rounds', kind: 'rounds' }])).toContain('both scores');
    expect(checkScores([{ name: '', kind: 'rounds' }, { name: 'Reps', kind: 'reps' }])).toContain('name');
    expect(checkScores([{ name: 'A', kind: 'reps' }, { name: 'B', kind: 'reps' }])).toContain('different kinds');
    expect(checkScores([{ name: 'A', kind: 'speed' }, { name: 'B', kind: 'reps' }])).toContain('kind');
  });

  it('gives one box per score, labelled with the score\'s name, and words the plan', () => {
    const scores = readScores([{ name: 'Rounds completed', kind: 'rounds' }, { name: 'Finish time', kind: 'time' }]);
    expect(scoreFields(scores)).toEqual([{ id: 'rounds', label: 'Rounds completed', hint: 'Rounds completed' }, { id: 'time', label: 'Finish time', hint: 'Finish time' }]);
    expect(scoreSummary(scores)).toBe('Record Rounds completed and Finish time');
    expect(scoreSummary([])).toBe('');
  });

  it('is read from a workout sent to a client, and is one row to fill in', () => {
    const snap = { blocks: [{ position: 0, title: 'W', activities: [{ position: 0, activity_name: 'AMRAP 12', tracking_type: 'scores', prescription: { display: 'x', scores: [{ name: 'Rounds', kind: 'rounds' }, { name: 'Reps', kind: 'reps' }] } }, { position: 1, activity_name: 'Squat', tracking_type: 'strength', prescription: { scores: [{ name: 'Ignored', kind: 'reps' }] } }] }] };
    const [a, b] = readSnapshot(snap).activities;
    expect(a?.tracking).toBe('scores');
    expect(a?.scores).toEqual([{ name: 'Rounds', kind: 'rounds' }, { name: 'Reps', kind: 'reps' }]);
    expect(b?.scores).toEqual([]);
    expect(blankSets('scores')).toHaveLength(1);
    expect(blankSets('strength')).toHaveLength(3);
  });
});

describe('two scores on one exercise: saving and reading back what was recorded', () => {
  it('puts each score in its own column, rounds in the spare custom value, and marks the set', () => {
    expect(toDbSet('scores', { rounds: '5', reps: '12' }).row).toMatchObject({ custom_value: 5, custom_unit: 'rounds', reps: 12, duration_seconds: null, weight_kg: null });
    expect(toDbSet('scores', { time: '11:30', reps: '40' }).row).toMatchObject({ duration_seconds: 690, reps: 40, custom_value: null, custom_unit: 'score' });
    expect(toDbSet('scores', { distance: '2.5', weight: '20' }).row).toMatchObject({ distance_m: 2500, weight_kg: 20, custom_unit: 'score' });
    expect(toDbSet('scores', { calories: '120.4' }).row).toMatchObject({ calories: 120, custom_unit: 'score' });
  });

  it('records nothing for empty boxes, and names a box that is not a number or a time', () => {
    expect(toDbSet('scores', {}).row).toBeNull();
    expect(toDbSet('scores', { rounds: 'many' }).error).toContain('not a number');
    expect(toDbSet('scores', { time: 'soon' }).error).toContain('not a time');
  });

  it('other kinds of exercise are saved exactly as before, with no custom value', () => {
    expect(toDbSet('strength', { reps: '5', weight: '60' }).row).toMatchObject({ reps: 5, weight_kg: 60, custom_value: null, custom_unit: null });
    expect(toDbSet('intervals', { reps: '4', time: '1:00' }).row).toMatchObject({ reps: 4, duration_seconds: 60, custom_value: null, custom_unit: null });
  });

  it('is saved as a custom exercise, with no personal best', () => {
    expect(dbTracking('scores')).toBe('custom');
  });

  it('reads back into the same boxes and the same words', () => {
    const stored = { reps: null, weight_kg: null, duration_seconds: 690, distance_m: null, calories: null, custom_value: 5, custom_unit: 'rounds' };
    expect(fromDbSet('scores', stored)).toEqual({ rounds: '5', time: '11:30' });
    expect(setText('scores', fromDbSet('scores', stored))).toBe('5 rounds · 11:30');
    expect(setText('scores', { reps: '40', distance: '2.5' })).toBe('40 reps · 2.5 km');
    expect(fromDbSet('scores', { ...stored, custom_unit: 'litres' }).rounds).toBeUndefined();
  });
});

describe('two scores on one exercise: saving a workout', () => {
  const build = (extra: Record<string, unknown>, tracking = 'scores') => {
    const act = { ...newActivity(), name: 'AMRAP 12', tracking, extra };
    return validateWorkout({ ...emptyWorkout, title: 'Friday' }, [{ ...newBlock(), activities: [act] }]);
  };

  it('keeps both scores and the words, and no sets', () => {
    const r = build({ scores: [{ name: 'Rounds', kind: 'rounds' }, { name: 'Reps', kind: 'reps' }], keep: 'me' });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const a = r.blocks[0]?.activities[0];
    expect(a?.tracking).toBe('scores');
    expect(a?.prescription).toEqual({ keep: 'me', display: 'Record Rounds and Reps', scores: [{ name: 'Rounds', kind: 'rounds' }, { name: 'Reps', kind: 'reps' }] });
  });

  it('refuses scores that cannot be used, naming the exercise', () => {
    for (const extra of [{}, { scores: [{ name: 'Rounds', kind: 'rounds' }] }, { scores: [{ name: 'A', kind: 'reps' }, { name: 'B', kind: 'reps' }] }, { scores: [{ name: '', kind: 'reps' }, { name: 'B', kind: 'time' }] }]) {
      const r = build(extra);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.message.startsWith('AMRAP 12: ')).toBe(true);
    }
  });

  it('drops scores left over when the exercise is changed back to another kind', () => {
    const r = build({ scores: [{ name: 'Rounds', kind: 'rounds' }, { name: 'Reps', kind: 'reps' }] }, 'reps');
    expect(r.ok).toBe(true);
    if (r.ok) expect('scores' in (r.blocks[0]?.activities[0]?.prescription ?? {})).toBe(false);
  });

  it('starts as rounds and reps, and reads what was typed in the form', () => {
    expect(defaultScores()).toEqual([{ name: 'Rounds', kind: 'rounds' }, { name: 'Reps', kind: 'reps' }]);
    expect(formScores({ scores: [{ name: 'A', kind: 'time' }, { name: 5, kind: null }] })).toEqual([{ name: 'A', kind: 'time' }, { name: '', kind: '' }]);
    expect(formScores({})).toEqual([]);
  });
});
