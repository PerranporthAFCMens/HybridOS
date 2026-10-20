import { describe, expect, it } from 'vitest';
import { addDays, blockText, bookedText, cellFor, emptyBlockForm, findClashes, slotText, validateBlock, weekDates, weekLabel, weekStart, type BlockRow } from '../src/rota/calc';

const hours = [{ weekday: 4, isWorking: true, start: '06:00:00', end: '14:00:00' }];
const block = (startsAt: string, endsAt: string, kind = 'leave', reason: string | null = null): BlockRow => ({ id: 'b1', userId: 'u1', startsAt, endsAt, kind, reason });

describe('rota weeks', () => {
  it('starts weeks on Monday', () => {
    expect(weekStart('2026-10-29')).toBe('2026-10-26'); // Thursday
    expect(weekStart('2026-10-26')).toBe('2026-10-26');
    expect(weekStart('2026-11-01')).toBe('2026-10-26'); // Sunday belongs to the week before
    expect(weekDates('2026-10-26')).toHaveLength(7);
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(weekLabel('2026-10-26')).toBe('26 Oct to 1 Nov 2026');
  });
});

describe('what a day looks like', () => {
  it('shows normal hours, a day off, closed days and time off', () => {
    expect(cellFor('2026-10-29', hours, [], undefined)).toMatchObject({ state: 'working', text: '06:00–14:00' });
    expect(cellFor('2026-10-30', hours, [], undefined)).toMatchObject({ state: 'off', text: 'Off' });
    expect(cellFor('2026-10-29', hours, [], { id: 'c', closedOn: '2026-10-29', reason: 'Event' })).toMatchObject({ state: 'closed', detail: 'Event' });
    // 28 and 29 October 2026 are in UK summer time until 25 October only: from 25 Oct the clocks are on GMT.
    const whole = block('2026-10-29T00:00:00.000Z', '2026-10-31T00:00:00.000Z');
    expect(cellFor('2026-10-29', hours, [whole], undefined)).toMatchObject({ state: 'away', text: 'Holiday or leave' });
    expect(cellFor('2026-10-30', hours, [whole], undefined)).toMatchObject({ state: 'away' });
    expect(cellFor('2026-10-31', hours, [whole], undefined)).toMatchObject({ state: 'off' });
  });

  it('keeps hours visible when only part of the day is blocked', () => {
    const part = block('2026-10-29T16:00:00.000Z', '2026-10-29T18:00:00.000Z', 'blocked', 'Dentist');
    expect(cellFor('2026-10-29', hours, [part], undefined)).toMatchObject({ state: 'part', text: 'Blocked out', detail: '16:00–18:00' });
  });

  it('uses the gym clock across the summer-time change', () => {
    // 1 September is on British Summer Time (UTC+1): a whole-day block is 23:00 to 23:00 UTC.
    const day = block('2026-08-31T23:00:00.000Z', '2026-09-01T23:00:00.000Z');
    expect(cellFor('2026-09-01', [], [day], undefined).state).toBe('away');
    expect(cellFor('2026-09-02', [], [day], undefined).state).toBe('off');
  });
});

describe('saving a block', () => {
  it('turns whole days into midnight to midnight gym time', () => {
    const f = { ...emptyBlockForm('u1', '2026-09-01'), toDate: '2026-09-02' };
    expect(validateBlock(f)).toEqual({ ok: true, startsAt: '2026-08-31T23:00:00.000Z', endsAt: '2026-09-02T23:00:00.000Z', reason: null });
  });
  it('turns part of a day into the two times', () => {
    const f = { ...emptyBlockForm('u1', '2026-09-01'), wholeDay: false, fromTime: '16:00', toTime: '18:00', reason: '  Dentist ' };
    expect(validateBlock(f)).toEqual({ ok: true, startsAt: '2026-09-01T15:00:00.000Z', endsAt: '2026-09-01T17:00:00.000Z', reason: 'Dentist' });
  });
  it('says what to fix', () => {
    expect(validateBlock({ ...emptyBlockForm('', '2026-09-01') })).toMatchObject({ ok: false, message: 'Choose who this is for.' });
    expect(validateBlock({ ...emptyBlockForm('u1', '2026-09-02'), toDate: '2026-09-01' })).toMatchObject({ ok: false, message: 'The last day cannot be before the first day.' });
    expect(validateBlock({ ...emptyBlockForm('u1', '2026-09-01'), wholeDay: false, fromTime: '18:00', toTime: '16:00' })).toMatchObject({ ok: false, message: 'The end time must be after the start time.' });
    expect(validateBlock({ ...emptyBlockForm('u1', ''), })).toMatchObject({ ok: false, message: 'Choose the first day.' });
  });
  it('describes a block in words', () => {
    expect(blockText(block('2026-10-29T16:00:00.000Z', '2026-10-29T18:00:00.000Z'))).toBe('Thu 29, 16:00–18:00');
    expect(blockText(block('2026-10-29T00:00:00.000Z', '2026-10-31T00:00:00.000Z'))).toBe('Thursday 29 October to Friday 30 October');
  });
});

describe('bookings inside time off', () => {
  const blocks = [block('2026-10-29T16:00:00.000Z', '2026-10-29T18:00:00.000Z', 'blocked')];
  const cls = (sessionId: string, userId: string, startsAt: string, endsAt: string) => ({ sessionId, name: 'HIIT', startsAt, endsAt, userId, booked: 6 });
  it('lists only what overlaps that person\'s own time off, soonest first', () => {
    const out = findClashes(
      blocks,
      [cls('s2', 'u1', '2026-10-29T17:30:00.000Z', '2026-10-29T18:30:00.000Z'), cls('s1', 'u1', '2026-10-29T17:00:00.000Z', '2026-10-29T18:00:00.000Z'), cls('s3', 'u1', '2026-10-29T18:00:00.000Z', '2026-10-29T19:00:00.000Z'), cls('s4', 'u2', '2026-10-29T17:00:00.000Z', '2026-10-29T18:00:00.000Z')],
      [{ id: 'p1', userId: 'u1', startsAt: '2026-10-29T16:00:00.000Z', endsAt: '2026-10-29T17:00:00.000Z' }],
    );
    expect(out.map((c) => c.key)).toEqual(['p:p1', 'c:s1:u1', 'c:s2:u1']); // s3 starts as the block ends; s4 is someone else
    expect(out[0]).toMatchObject({ kind: 'pt', title: 'Personal training session' });
    expect(bookedText(out[1] ?? { kind: 'class', booked: null })).toBe('6 booked');
    expect(bookedText(out[0] ?? { kind: 'class', booked: null })).toBe('Booked');
  });
  it('shows times on the gym clock', () => {
    expect(slotText('2026-10-29T17:00:00.000Z', '2026-10-29T18:00:00.000Z')).toBe('Thu 29 Oct, 17:00–18:00');
  });
});
