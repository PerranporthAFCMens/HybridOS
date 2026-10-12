import { describe, expect, it } from 'vitest';
import { addExercise, buildSnapshot, cleanSets, emptyWorkout, moveItem, newActivity, newBlock, parseTags, readPrescription, validateWodDate, validateWorkout, type BlockForm } from '../src/workouts/calc';

const goodBlock = (): BlockForm => ({ ...newBlock(), activities: [{ ...newActivity(), name: ' Back squat ', prescription: ' 4 x 6 ', notes: ' cue ' }] });
const goodForm = { ...emptyWorkout, type: 'strength', title: ' Leg Day ', tags: 'Legs, Strength, legs ,', minutes: '50' };

describe('validateWorkout', () => {
  it('accepts a good workout and trims it', () => {
    const c = validateWorkout(goodForm, [goodBlock()]);
    expect(c.ok).toBe(true);
    if (!c.ok) return;
    expect(c.input).toEqual({ title: 'Leg Day', description: null, workoutType: 'strength', focusTags: ['Legs', 'Strength', 'legs'], estimatedMinutes: 50, visibility: 'private' });
    expect(c.blocks[0]).toMatchObject({ title: 'Workout', blockType: 'standard', rounds: null, instructions: null });
    expect(c.blocks[0]?.activities[0]).toEqual({ name: 'Back squat', activityType: 'exercise', tracking: 'strength', prescription: { display: '4 x 6' }, notes: 'cue' });
  });
  it('needs a name and at least one named exercise; empty blocks are left out', () => {
    expect(validateWorkout({ ...goodForm, title: ' ' }, [goodBlock()])).toEqual({ ok: false, message: 'Enter a workout name.' });
    expect(validateWorkout(goodForm, [])).toEqual({ ok: false, message: 'Add at least one exercise.' });
    expect(validateWorkout(goodForm, [newBlock()])).toEqual({ ok: false, message: 'Add at least one exercise.' });
    const unnamed = goodBlock();
    unnamed.activities.push(newActivity());
    expect(validateWorkout(goodForm, [unnamed])).toEqual({ ok: false, message: 'Every exercise needs a name.' });
    const c = validateWorkout(goodForm, [newBlock(), goodBlock()]);
    expect(c.ok && c.blocks.length).toBe(1);
  });
  it('turns the set boxes into the target a member gets', () => {
    const a = { ...newActivity(), name: 'Back squat', sets: [{ reps: '8', weight: '60 ' }, { reps: '8', weight: '60' }, { reps: '8', weight: '60' }] };
    const c = validateWorkout(goodForm, [{ ...newBlock(), activities: [a] }]);
    expect(c.ok && c.blocks[0]?.activities[0]?.prescription).toEqual({ display: '3 sets: 8 × 60 kg', sets: [{ reps: '8', weight: '60' }, { reps: '8', weight: '60' }, { reps: '8', weight: '60' }] });
  });
  it('says which exercise has a box that is not a number', () => {
    const a = { ...newActivity(), name: 'Back squat', sets: [{ reps: 'lots' }] };
    expect(validateWorkout(goodForm, [{ ...newBlock(), activities: [a] }])).toEqual({ ok: false, message: 'Back squat: "lots" is not a number.' });
  });
  it('drops blank rows and boxes the exercise does not use', () => {
    expect(cleanSets('reps', [{ reps: '10', weight: '5' }, {}, { reps: ' ' }])).toEqual([{ reps: '10' }]);
    expect(cleanSets('strength', [])).toEqual([]);
  });
  it('adds an exercise to the last block, starting one if needed, and guesses what to record', () => {
    const fresh = addExercise([], 'Plank');
    expect(fresh).toHaveLength(1);
    expect(fresh[0]?.activities[0]).toMatchObject({ name: 'Plank', tracking: 'time' });
    const more = addExercise([goodBlock(), goodBlock()], 'Run 5K');
    expect(more[0]?.activities).toHaveLength(1);
    expect(more[1]?.activities[1]).toMatchObject({ name: 'Run 5K', tracking: 'distance' });
  });
  it('checks minutes, rounds, type, tags and lengths', () => {
    expect(validateWorkout({ ...goodForm, minutes: '0' }, [goodBlock()])).toMatchObject({ ok: false });
    expect(validateWorkout({ ...goodForm, minutes: '601' }, [goodBlock()])).toMatchObject({ ok: false });
    expect(validateWorkout({ ...goodForm, minutes: '' }, [goodBlock()])).toMatchObject({ ok: true, input: { estimatedMinutes: null } });
    expect(validateWorkout({ ...goodForm, type: 'nope' }, [goodBlock()])).toMatchObject({ ok: false });
    expect(validateWorkout({ ...goodForm, tags: Array.from({ length: 13 }, (_, i) => `t${i}`).join(',') }, [goodBlock()])).toMatchObject({ ok: false });
    expect(validateWorkout({ ...goodForm, title: 'x'.repeat(121) }, [goodBlock()])).toMatchObject({ ok: false });
    expect(validateWorkout({ ...goodForm, description: 'x'.repeat(2001) }, [goodBlock()])).toMatchObject({ ok: false });
    expect(validateWorkout(goodForm, [{ ...goodBlock(), rounds: '0' }])).toMatchObject({ ok: false });
    expect(validateWorkout(goodForm, [{ ...goodBlock(), rounds: '3' }])).toMatchObject({ ok: true });
    expect(validateWorkout(goodForm, [{ ...goodBlock(), blockType: 'nope' }])).toMatchObject({ ok: false });
  });
  it('names a blank block by its position', () => {
    const c = validateWorkout(goodForm, [{ ...goodBlock(), title: ' ' }, goodBlock()]);
    expect(c.ok && c.blocks[0]?.title).toBe('Block 1');
  });
  it('keeps other things saved with a prescription', () => {
    const a = { ...newActivity(), name: 'Row', prescription: '500 m', extra: { target: 'sub 2:00' } };
    const c = validateWorkout(goodForm, [{ ...newBlock(), activities: [a] }]);
    expect(c.ok && c.blocks[0]?.activities[0]?.prescription).toEqual({ target: 'sub 2:00', display: '500 m' });
  });
});

describe('helpers', () => {
  it('parses tags without repeats or blanks', () => {
    expect(parseTags('a, b ,a,, c')).toEqual(['a', 'b', 'c']);
    expect(parseTags('')).toEqual([]);
  });
  it('reads a stored prescription safely', () => {
    expect(readPrescription({ display: '4 x 6', rpe: 8 })).toEqual({ display: '4 x 6', sets: [], extra: { rpe: 8 } });
    expect(readPrescription({ display: '2 sets: 5', sets: [{ reps: 5 }, { reps: '5' }, 'junk'] })).toEqual({ display: '2 sets: 5', sets: [{ reps: '5' }, { reps: '5' }], extra: {} });
    expect(readPrescription(null)).toEqual({ display: '', sets: [], extra: {} });
    expect(readPrescription('x')).toEqual({ display: '', sets: [], extra: {} });
    expect(readPrescription({ display: 5 })).toEqual({ display: '', sets: [], extra: {} });
    expect(readPrescription([1])).toEqual({ display: '', sets: [], extra: {} });
  });
  it('moves an item and stops at the ends', () => {
    expect(moveItem([1, 2, 3], 1, -1)).toEqual([2, 1, 3]);
    expect(moveItem([1, 2, 3], 1, 1)).toEqual([1, 3, 2]);
    const l = [1, 2];
    expect(moveItem(l, 0, -1)).toBe(l);
    expect(moveItem(l, 1, 1)).toBe(l);
  });
  it('checks the WOD date', () => {
    expect(validateWodDate('2026-10-08')).toBeNull();
    expect(validateWodDate('')).not.toBeNull();
  });
  it('builds the copy given to a member', () => {
    const snap = buildSnapshot({ id: 't1', title: 'Leg Day', description: null, workoutType: 'strength', focusTags: ['Legs'], estimatedMinutes: 45 }, []);
    expect(snap).toEqual({ template_id: 't1', title: 'Leg Day', description: null, workout_type: 'strength', focus_tags: ['Legs'], estimated_minutes: 45, blocks: [] });
  });
});

