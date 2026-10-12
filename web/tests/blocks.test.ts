import { describe, expect, it } from 'vitest';
import { addDaysTo, blockLabel, blockLastDay, blockRange, blockState, blockWeek, daysBetween, groupByWeek, validateBlock } from '../src/classes/blocks';
import { isScoreMetric, scoreChoices, scoreMetricLabel, scoreText } from '../src/train/calc';

describe('block weeks', () => {
  it('numbers weeks from the first day, and says null outside the block', () => {
    expect(blockWeek('2026-10-12', 6, '2026-10-12')).toBe(1);
    expect(blockWeek('2026-10-12', 6, '2026-10-18')).toBe(1);
    expect(blockWeek('2026-10-12', 6, '2026-10-19')).toBe(2);
    expect(blockWeek('2026-10-12', 6, '2026-11-22')).toBe(6);
    expect(blockWeek('2026-10-12', 6, '2026-11-23')).toBeNull();
    expect(blockWeek('2026-10-12', 6, '2026-10-11')).toBeNull();
  });
  it('works across a month, a year and a clock change', () => {
    expect(addDaysTo('2026-12-30', 3)).toBe('2027-01-02');
    expect(daysBetween('2026-10-24', '2026-10-27')).toBe(3);
    expect(blockLastDay('2026-10-12', 6)).toBe('2026-11-22');
    expect(blockWeek('2026-10-19', 2, '2026-10-30')).toBe(2);
  });
  it('labels a block with its week', () => {
    expect(blockLabel('Hybrid Uppers', 3, 6)).toBe('Hybrid Uppers · week 3 of 6');
    expect(blockLabel('Hybrid Uppers', null, 6)).toBe('Hybrid Uppers · 6 weeks');
  });
  it('says where a block is today', () => {
    expect(blockState('2026-10-12', 6, '2026-10-05')).toEqual({ state: 'upcoming', week: null });
    expect(blockState('2026-10-12', 6, '2026-10-30')).toEqual({ state: 'running', week: 3 });
    expect(blockState('2026-10-12', 6, '2026-12-01')).toEqual({ state: 'finished', week: null });
  });
  it('covers the block on the gym clock', () => {
    const r = blockRange('2026-10-26', 1);
    expect(r.from).toBe('2026-10-26T00:00:00.000Z');
    // the clocks go back on 25 October, so midnight on the 3rd is UTC+0 too
    expect(r.to).toBe('2026-11-02T00:00:00.000Z');
    expect(blockRange('2026-07-06', 1).from).toBe('2026-07-05T23:00:00.000Z');
  });
  it('groups classes by week and keeps empty weeks', () => {
    const g = groupByWeek('2026-10-12', 3, [{ startsAt: '2026-10-21T18:00:00Z', id: 'b' }, { startsAt: '2026-10-13T18:00:00Z', id: 'a' }, { startsAt: '2026-12-01T18:00:00Z', id: 'out' }]);
    expect(g.map((w) => w.items.map((i) => i.id).join(','))).toEqual(['a', 'b', '']);
  });
});

describe('checking a block', () => {
  const ok = { name: ' Hybrid Uppers ', startsOn: '2026-10-12', weeks: '6' };
  it('accepts a good one and trims it', () => {
    expect(validateBlock(ok)).toEqual({ ok: true, name: 'Hybrid Uppers', startsOn: '2026-10-12', weeks: 6 });
  });
  it('needs a name, a real day and 1 to 52 whole weeks', () => {
    expect(validateBlock({ ...ok, name: ' ' })).toMatchObject({ ok: false });
    expect(validateBlock({ ...ok, name: 'x'.repeat(81) })).toMatchObject({ ok: false });
    expect(validateBlock({ ...ok, startsOn: '' })).toMatchObject({ ok: false });
    expect(validateBlock({ ...ok, startsOn: '2026-02-30' })).toMatchObject({ ok: false });
    expect(validateBlock({ ...ok, weeks: '0' })).toMatchObject({ ok: false });
    expect(validateBlock({ ...ok, weeks: '53' })).toMatchObject({ ok: false });
    expect(validateBlock({ ...ok, weeks: '2.5' })).toMatchObject({ ok: false });
    expect(validateBlock({ ...ok, weeks: '52' })).toMatchObject({ ok: true });
  });
});

describe('the score of a class workout', () => {
  const snap = { blocks: [{ position: 0, title: 'W', activities: [
    { position: 0, activity_name: 'Back squat', tracking_type: 'strength' },
    { position: 1, activity_name: 'Push-ups', tracking_type: 'reps' },
    { position: 2, activity_name: 'Row 500 m', tracking_type: 'time' },
    { position: 3, activity_name: 'Bike', tracking_type: 'distance' },
    { position: 4, activity_name: 'Ski', tracking_type: 'calories' },
    { position: 5, activity_name: 'Stretch', tracking_type: 'instruction' },
    { position: 6, activity_name: 'back squat', tracking_type: 'strength' },
  ] }] };
  it('offers what makes sense for how each exercise is recorded, with no repeats', () => {
    expect(scoreChoices(snap).map((c) => `${c.exercise}/${c.metric}`)).toEqual(['Back squat/weight', 'Back squat/reps', 'Push-ups/reps', 'Row 500 m/time', 'Bike/distance', 'Ski/calories']);
    expect(scoreChoices(null)).toEqual([]);
  });
  it('writes a score as words', () => {
    expect(scoreText('weight', 62.5)).toBe('62.5 kg');
    expect(scoreText('reps', 35)).toBe('35 reps');
    expect(scoreText('time', 100)).toBe('1:40');
    expect(scoreText('distance', 500)).toBe('500 m');
    expect(scoreText('distance', 1250)).toBe('1.25 km');
    expect(scoreText('calories', 120)).toBe('120 cal');
    expect(scoreMetricLabel('time')).toBe('fastest time');
  });
  it('knows the kinds of score', () => {
    expect(isScoreMetric('reps')).toBe(true);
    expect(isScoreMetric('vibes')).toBe(false);
  });
});
