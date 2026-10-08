import { describe, expect, it } from 'vitest';
import { assignmentNote, blankSets, comingUp, dueNow, formatDuration, fromDbSet, parseDuration, prepareFinish, readSnapshot, setText, toDbSet, type PlayedActivity } from '../src/train/calc';

const dayOf = (iso: string) => iso.slice(0, 10);

describe('reading what a coach sent', () => {
  it('flattens blocks and activities in order and tolerates rubbish', () => {
    const r = readSnapshot({
      title: 'Upper body',
      blocks: [
        { position: 1, title: 'Strength', activities: [{ position: 2, activity_name: 'Press', tracking_type: 'strength', prescription: { display: '4 x 8' } }, { position: 1, activity_name: 'Row', tracking_type: 'nonsense' }, { activity_name: '  ' }, null] },
        { position: 0, title: 'Warm-up', activities: [{ position: 0, activity_name: 'Stretch', tracking_type: 'instruction', notes: 'Slowly' }] },
      ],
    });
    expect(r.title).toBe('Upper body');
    expect(r.activities.map((a) => `${a.block}:${a.name}:${a.tracking}`)).toEqual(['Warm-up:Stretch:instruction', 'Strength:Row:strength', 'Strength:Press:strength']);
    expect(r.activities[2]?.plan).toBe('4 x 8');
    expect(readSnapshot(null).activities).toEqual([]);
    expect(readSnapshot('x').title).toBe('');
  });
});

describe('numbers', () => {
  it('times', () => {
    expect(parseDuration('12:30')).toBe(750);
    expect(parseDuration('90')).toBe(90);
    expect(parseDuration('1:75')).toBeNull();
    expect(parseDuration('')).toBeNull();
    expect(formatDuration(750)).toBe('12:30');
    expect(formatDuration(65)).toBe('1:05');
  });
  it('a set becomes columns, or says what is wrong', () => {
    expect(toDbSet('strength', { weight: '24', reps: '10' }).row).toEqual({ weight_kg: 24, reps: 10, duration_seconds: null, distance_m: null, calories: null });
    expect(toDbSet('strength', {}).row).toBeNull();
    expect(toDbSet('strength', { weight: 'abc' }).error).toBe('"abc" is not a number.');
    expect(toDbSet('time', { time: '12:30' }).row?.duration_seconds).toBe(750);
    expect(toDbSet('time', { time: 'soon' }).error).toContain('not a time');
    expect(toDbSet('distance', { distance: '5,5' }).row?.distance_m).toBe(5500);
    expect(toDbSet('strength', { weight: '-4' }).error).not.toBeNull();
  });
  it('and back, for last time', () => {
    const v = fromDbSet('strength', { weight_kg: 24, reps: 10 });
    expect(v).toEqual({ weight: '24', reps: '10' });
    expect(setText('strength', v)).toBe('24 kg × 10');
    expect(fromDbSet('distance', { distance_m: 5500 })).toEqual({ distance: '5.5' });
    expect(setText('time', { time: '12:30' })).toBe('12:30');
  });
  it('blank sets', () => {
    expect(blankSets('strength')).toHaveLength(3);
    expect(blankSets('instruction')).toHaveLength(0);
  });
});

const act = (p: Partial<PlayedActivity>): PlayedActivity => ({ name: 'Squat', originalName: 'Squat', tracking: 'strength', sets: [{ weight: '100', reps: '5' }, {}], done: false, skipped: false, note: '', ...p });

describe('finishing', () => {
  it('writes what was typed, leaves out empty sets', () => {
    const r = prepareFinish([act({})]);
    expect(r.ok && r.entries[0]?.sets).toHaveLength(1);
  });
  it('skipped work is listed, not written; nothing is required', () => {
    const r = prepareFinish([act({ skipped: true }), act({ name: 'Row', originalName: 'Row', sets: [{}, {}] })]);
    expect(r).toMatchObject({ ok: true, entries: [], skipped: ['Squat'] });
  });
  it('a swap is noted on the entry and in the list', () => {
    const r = prepareFinish([act({ name: 'Leg press', originalName: 'Squat' })]);
    expect(r.ok && r.entries[0]?.note).toBe('Swapped from Squat');
    expect(r.ok && r.swapped).toEqual(['Squat → Leg press']);
  });
  it('a box that cannot be read stops the save and says which exercise', () => {
    const r = prepareFinish([act({ sets: [{ weight: 'heavy' }] })]);
    expect(r).toEqual({ ok: false, message: 'Squat: "heavy" is not a number.' });
  });
  it('instructions are ticked, not written', () => {
    const r = prepareFinish([act({ name: 'Stretch', originalName: 'Stretch', tracking: 'instruction', sets: [], done: true })]);
    expect(r).toMatchObject({ ok: true, entries: [], ticked: ['Stretch'] });
  });
  it('the note for the coach', () => {
    expect(assignmentNote('Felt good', ['Row'], ['A → B'])).toBe('Felt good\nSkipped: Row\nSwapped: A → B');
    expect(assignmentNote('', [], [])).toBeNull();
  });
});

describe('what is planned', () => {
  const p = (id: string, status: string, scheduledFor: string | null, dueAt: string | null = null) => ({ id, title: id, status, scheduledFor, dueAt });
  const plans = [p('later', 'todo', '2026-10-12'), p('today', 'todo', '2026-10-08'), p('old', 'in_progress', '2026-10-05'), p('undated', 'todo', null), p('done', 'completed', '2026-10-08'), p('due', 'todo', null, '2026-10-08T12:00:00Z')];
  it('now: today and earlier and undated, most overdue first', () => {
    expect(dueNow(plans, '2026-10-08', dayOf).map((x) => x.id)).toEqual(['old', 'today', 'due', 'undated']);
  });
  it('coming up', () => {
    expect(comingUp(plans, '2026-10-08', dayOf).map((x) => x.id)).toEqual(['later']);
  });
});
