import { describe, expect, it } from 'vitest';
import { ACTIVITIES, guessTracking, matchExercises } from '../src/train/activities';
import { assignmentNote, blankSets, dbTracking, buildResult, comingUp, dueNow, formatDuration, fromDbSet, hasEntered, hasPainFlag, parseDuration, prepareFinish, readResult, readTarget, describeTarget, readSnapshot, reasonLabel, resultJson, resultSummary, setText, toDbSet, type PlayedActivity } from '../src/train/calc';

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

describe('what the database accepts for an exercise type', () => {
  it('turns reps and rounds into types the database allows', () => {
    expect(dbTracking('reps')).toBe('strength');
    expect(dbTracking('intervals')).toBe('custom');
    expect(dbTracking('instruction')).toBe('custom');
    for (const t of ['strength', 'time', 'distance', 'calories'] as const) expect(dbTracking(t)).toBe(t);
  });
});

describe('what the coach set, as numbers', () => {
  it('reads the set rows from the snapshot and describes them', () => {
    const r = readSnapshot({ blocks: [{ position: 0, title: 'Workout', activities: [{ position: 0, activity_name: 'Squat', tracking_type: 'strength', prescription: { sets: [{ reps: '8', weight: '60' }, { reps: '8', weight: '60' }] } }] }] });
    expect(r.activities[0]?.target).toEqual([{ reps: '8', weight: '60' }, { reps: '8', weight: '60' }]);
    expect(r.activities[0]?.plan).toBe('2 sets: 8 × 60 kg');
  });
  it('keeps the words of an older workout that has no set rows', () => {
    const r = readSnapshot({ blocks: [{ position: 0, title: 'W', activities: [{ position: 0, activity_name: 'Press', tracking_type: 'strength', prescription: { display: '4 x 8' } }] }] });
    expect(r.activities[0]).toMatchObject({ plan: '4 x 8', target: [] });
  });
  it('drops rubbish and empty boxes', () => {
    expect(readTarget(null)).toEqual([]);
    expect(readTarget([{ reps: 5, weight: ' ', nonsense: 1 }, 'x', {}, [1]])).toEqual([{ reps: '5' }]);
  });
  it('groups identical sets and lists different ones', () => {
    expect(describeTarget('strength', [{ reps: '5', weight: '100' }, { reps: '5', weight: '100' }, { reps: '5', weight: '100' }])).toBe('3 sets: 5 × 100 kg');
    expect(describeTarget('strength', [{ reps: '8', weight: '60' }, { reps: '6', weight: '70' }])).toBe('8 × 60 kg / 6 × 70 kg');
    expect(describeTarget('time', [{ time: '10:00' }])).toBe('10:00');
    expect(describeTarget('reps', [])).toBe('');
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
    expect(toDbSet('strength', { weight: '24', reps: '10' }).row).toEqual({ weight_kg: 24, reps: 10, duration_seconds: null, distance_m: null, calories: null, side: null });
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
    expect(setText('strength', v)).toBe('10 × 24 kg');
    expect(fromDbSet('distance', { distance_m: 5500 })).toEqual({ distance: '5.5' });
    expect(setText('time', { time: '12:30' })).toBe('12:30');
  });
  it('blank sets', () => {
    expect(blankSets('strength')).toHaveLength(3);
    expect(blankSets('instruction')).toHaveLength(0);
  });
});

const act = (p: Partial<PlayedActivity>): PlayedActivity => ({ name: 'Squat', originalName: 'Squat', tracking: 'strength', sets: [{ weight: '100', reps: '5' }, {}], done: false, skipped: false, note: '', ...p });

describe('left and right', () => {
  it('a side is kept only when asked for, and only the three words', () => {
    expect(toDbSet('strength', { weight: '20', reps: '8', side: 'left' }).row?.side).toBe('left');
    expect(toDbSet('strength', { weight: '20', side: 'upside' }).row?.side).toBeNull();
    expect(toDbSet('strength', { side: 'left' }).row).toBeNull();
  });
  it('comes back for last time', () => {
    const v = fromDbSet('strength', { weight_kg: 20, reps: 8, side: 'right' });
    expect(v.side).toBe('right');
    expect(setText('strength', v)).toBe('8 × 20 kg (right)');
    expect(fromDbSet('strength', { weight_kg: 20, side: null }).side).toBeUndefined();
  });
  it('is saved only for an exercise switched to left and right', () => {
    const base = { name: 'Row', originalName: 'Row', tracking: 'strength' as const, sets: [{ weight: '20', reps: '8', side: 'left' }], done: false, skipped: false, note: '' };
    const on = prepareFinish([{ ...base, sided: true }]);
    const off = prepareFinish([{ ...base, sided: false }]);
    expect(on.ok && on.entries[0]?.sets[0]?.side).toBe('left');
    expect(off.ok && off.entries[0]?.sets[0]?.side).toBeNull();
  });
});

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

describe('the exercise list', () => {
  it('has the classic list', () => { expect(ACTIVITIES.length).toBe(264); });
  it('matches as you type, best first, your own exercises ahead of the list', () => {
    expect(matchExercises('')).toEqual([]);
    expect(matchExercises('deadl')[0]).toBe('Deadlift');
    expect(matchExercises('bench', [], 3)).toHaveLength(3);
    expect(matchExercises('zzzz')).toEqual([]);
  });
  it('your own come first among equal matches, and nothing repeats', () => {
    const r = matchExercises('dumbbell row', ['dumbbell row']);
    expect(r.filter((n) => n.toLowerCase() === 'dumbbell row')).toHaveLength(1);
    expect(r[0]).toBe('dumbbell row');
  });
  it('guesses what to record', () => {
    expect(guessTracking('Plank')).toBe('time');
    expect(guessTracking('Dead Hang')).toBe('time');
    expect(guessTracking('Run 5K')).toBe('distance');
    expect(guessTracking('Concept2 RowErg')).toBe('distance');
    expect(guessTracking('Back Squat')).toBe('strength');
    expect(guessTracking('Farmer carry')).toBe('time');
  });
});

describe('what changed and why', () => {
  const act = (o: Partial<PlayedActivity> & { entered?: boolean }): PlayedActivity & { entered: boolean } => ({ name: 'Back squat', originalName: 'Back squat', tracking: 'strength', sets: [], done: false, skipped: false, note: '', plan: '4 x 6 @ 60kg', entered: true, ...o });
  it('records an exercise the client says went as set', () => {
    expect(buildResult([act({ outcome: 'as_set' })])).toEqual([{ name: 'Back squat', plan: '4 x 6 @ 60kg', status: 'as_set' }]);
  });
  it('records a change with its reason and their words', () => {
    expect(buildResult([act({ outcome: 'changed', reason: 'too_tired', note: ' legs felt heavy ' })])).toEqual([{ name: 'Back squat', plan: '4 x 6 @ 60kg', status: 'changed', reason: 'too_tired', note: 'legs felt heavy' }]);
  });
  it('keeps their own note on an exercise whatever happened', () => {
    expect(buildResult([act({ outcome: 'as_set', note: ' slept badly ' })])).toEqual([{ name: 'Back squat', plan: '4 x 6 @ 60kg', status: 'as_set', note: 'slept badly' }]);
    expect(buildResult([act({ note: 'felt easy' })])[0]).toMatchObject({ status: 'logged', note: 'felt easy' });
  });
  it('treats a swap as a change and keeps both names', () => {
    expect(buildResult([act({ name: 'Goblet squat', reason: 'no_equipment' })])).toEqual([{ name: 'Back squat', plan: '4 x 6 @ 60kg', status: 'changed', swappedTo: 'Goblet squat', reason: 'no_equipment' }]);
  });
  it('records a skip as not this time, with the reason if given', () => {
    expect(buildResult([act({ skipped: true, reason: 'pain' })])).toEqual([{ name: 'Back squat', plan: '4 x 6 @ 60kg', status: 'not_this_time', reason: 'pain' }]);
  });
  it('makes no claim when the client said neither', () => {
    expect(buildResult([act({})])).toEqual([{ name: 'Back squat', plan: '4 x 6 @ 60kg', status: 'logged' }]);
  });
  it('counts an exercise never touched as not this time', () => {
    expect(buildResult([act({ entered: false })])[0]?.status).toBe('not_this_time');
  });
  it('lists an exercise they added themselves, and ignores an empty one', () => {
    expect(buildResult([act({ name: 'Sled push', originalName: '', plan: '' }), act({ name: 'Rows', originalName: '', plan: '', entered: false })])).toEqual([{ name: 'Sled push', plan: '', status: 'added' }]);
  });
  it('reads a stored report safely', () => {
    expect(readResult(null)).toEqual([]);
    expect(readResult({ exercises: [{ name: 'A', status: 'changed', reason: 'pain' }, { name: 5 }, { name: 'B', status: 'nonsense' }, 'x'] })).toEqual([{ name: 'A', plan: '', status: 'changed', reason: 'pain' }]);
    expect(readResult(resultJson([{ name: 'A', plan: 'p', status: 'as_set' }]))).toEqual([{ name: 'A', plan: 'p', status: 'as_set' }]);
  });
  it('summarises without judging', () => {
    const rows = [{ name: 'a', plan: '', status: 'as_set' as const }, { name: 'b', plan: '', status: 'as_set' as const }, { name: 'c', plan: '', status: 'changed' as const }, { name: 'd', plan: '', status: 'not_this_time' as const }, { name: 'e', plan: '', status: 'added' as const }];
    expect(resultSummary(rows)).toBe('2 as set, 1 changed, 1 not this time');
    expect(resultSummary([])).toBe('');
  });
  it('spots a pain reason', () => {
    expect(hasPainFlag([{ name: 'a', plan: '', status: 'changed', reason: 'pain' }])).toBe(true);
    expect(hasPainFlag([{ name: 'a', plan: '', status: 'changed', reason: 'too_heavy' }])).toBe(false);
    expect(reasonLabel('too_tired')).toBe('Too tired');
    expect(reasonLabel('nope')).toBe('');
  });
});

describe('did the client record anything', () => {
  const base: PlayedActivity = { name: 'a', originalName: 'a', tracking: 'strength', sets: [{}, {}], done: false, skipped: false, note: '' };
  it('says no for empty boxes and yes for a number or a tick', () => {
    expect(hasEntered(base)).toBe(false);
    expect(hasEntered({ ...base, sets: [{}, { reps: ' 6 ' }] })).toBe(true);
    expect(hasEntered({ ...base, sets: [{ side: 'left' }] })).toBe(false);
    expect(hasEntered({ ...base, done: true })).toBe(true);
  });
});
