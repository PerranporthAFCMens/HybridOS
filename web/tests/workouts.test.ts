import { describe, expect, it } from 'vitest';
import { buildSnapshot, dueAt, emptyWorkout, moveItem, newActivity, newBlock, parseTags, readPrescription, validateWodDate, validateWorkout, type BlockForm } from '../src/workouts/calc';

const goodBlock = (): BlockForm => ({ ...newBlock(), activities: [{ ...newActivity(), name: ' Back squat ', prescription: ' 4 x 6 ', notes: ' cue ' }] });
const goodForm = { ...emptyWorkout, title: ' Leg Day ', tags: 'Legs, Strength, legs ,', minutes: '50' };

describe('validateWorkout', () => {
  it('accepts a good workout and trims it', () => {
    const c = validateWorkout(goodForm, [goodBlock()]);
    expect(c.ok).toBe(true);
    if (!c.ok) return;
    expect(c.input).toEqual({ title: 'Leg Day', description: null, workoutType: 'strength', focusTags: ['Legs', 'Strength', 'legs'], estimatedMinutes: 50, visibility: 'private' });
    expect(c.blocks[0]).toMatchObject({ title: 'Strength', blockType: 'strength', rounds: null, instructions: null });
    expect(c.blocks[0]?.activities[0]).toEqual({ name: 'Back squat', activityType: 'exercise', tracking: 'strength', prescription: { display: '4 x 6' }, notes: 'cue' });
  });
  it('needs a name and at least one block with named activities', () => {
    expect(validateWorkout({ ...goodForm, title: ' ' }, [goodBlock()])).toEqual({ ok: false, message: 'Enter a workout name.' });
    expect(validateWorkout(goodForm, [])).toEqual({ ok: false, message: 'Add at least one workout block.' });
    expect(validateWorkout(goodForm, [newBlock()])).toEqual({ ok: false, message: 'Every block needs at least one named activity.' });
    const unnamed = goodBlock();
    unnamed.activities.push(newActivity());
    expect(validateWorkout(goodForm, [unnamed])).toEqual({ ok: false, message: 'Every block needs at least one named activity.' });
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
    expect(readPrescription({ display: '4 x 6', rpe: 8 })).toEqual({ display: '4 x 6', extra: { rpe: 8 } });
    expect(readPrescription(null)).toEqual({ display: '', extra: {} });
    expect(readPrescription('x')).toEqual({ display: '', extra: {} });
    expect(readPrescription({ display: 5 })).toEqual({ display: '', extra: {} });
    expect(readPrescription([1])).toEqual({ display: '', extra: {} });
  });
  it('moves an item and stops at the ends', () => {
    expect(moveItem([1, 2, 3], 1, -1)).toEqual([2, 1, 3]);
    expect(moveItem([1, 2, 3], 1, 1)).toEqual([1, 3, 2]);
    const l = [1, 2];
    expect(moveItem(l, 0, -1)).toBe(l);
    expect(moveItem(l, 1, 1)).toBe(l);
  });
  it('due date means the end of that day in UK time', () => {
    expect(dueAt('')).toBeNull();
    expect(dueAt('nope')).toBeNull();
    expect(dueAt('2026-07-10')).toBe('2026-07-10T22:59:00.000Z');
    expect(dueAt('2026-12-10')).toBe('2026-12-10T23:59:00.000Z');
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
