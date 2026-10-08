import { describe, expect, it } from 'vitest';
import type { TimetableSession } from '../src/data/classes';
import { HOUR_PX, MIN_BLOCK_PX, dayBlocks, gridHours, hourLabel } from '../src/classes/grid';

const session = (id: string, start: string, end: string): TimetableSession => ({ session_id: id, starts_at: start, ends_at: end, name: id, staffNames: [] }) as unknown as TimetableSession;
// 12 January: UK time is UTC, so the clock reads the same.
const s = (id: string, from: string, to: string) => session(id, `2027-01-12T${from}:00Z`, `2027-01-12T${to}:00Z`);

describe('calendar layout', () => {
  it('places a class by its gym-time start and length', () => {
    const [b] = dayBlocks([s('a', '09:00', '10:00')], '2027-01-12', 5);
    expect(b?.top).toBe(4 * HOUR_PX);
    expect(b?.height).toBe(HOUR_PX);
    expect([b?.lane, b?.lanes]).toEqual([0, 1]);
  });

  it('uses UK summer time, not UTC', () => {
    const summer = session('x', '2027-07-14T08:00:00Z', '2027-07-14T09:00:00Z'); // 09:00 to 10:00 in London
    const [b] = dayBlocks([summer], '2027-07-14', 5);
    expect(b?.top).toBe(4 * HOUR_PX);
  });

  it('keeps a short class tall enough to tap', () => {
    const [b] = dayBlocks([s('a', '09:00', '09:15')], '2027-01-12', 5);
    expect(b?.height).toBe(MIN_BLOCK_PX);
  });

  it('puts overlapping classes side by side and leaves lone ones full width', () => {
    const blocks = dayBlocks([s('a', '09:00', '10:00'), s('b', '09:30', '10:30'), s('c', '12:00', '13:00')], '2027-01-12', 5);
    const by = Object.fromEntries(blocks.map((b) => [b.session.session_id, [b.lane, b.lanes]]));
    expect(by).toEqual({ a: [0, 2], b: [1, 2], c: [0, 1] });
  });

  it('reuses a lane once a class has ended', () => {
    const blocks = dayBlocks([s('a', '09:00', '10:00'), s('b', '09:30', '11:00'), s('c', '10:00', '10:30')], '2027-01-12', 5);
    const by = Object.fromEntries(blocks.map((b) => [b.session.session_id, [b.lane, b.lanes]]));
    expect(by).toEqual({ a: [0, 2], b: [1, 2], c: [0, 2] });
  });

  it('only returns classes on that day', () => {
    expect(dayBlocks([s('a', '09:00', '10:00')], '2027-01-13', 5)).toEqual([]);
  });

  it('shows 05:00 to 23:00 and widens for an early or late class', () => {
    expect(gridHours([])).toEqual({ startHour: 5, endHour: 23 });
    expect(gridHours([s('a', '04:15', '05:00')]).startHour).toBe(4);
    expect(gridHours([s('a', '22:00', '23:30')]).endHour).toBe(24);
  });

  it('words an hour', () => {
    expect(hourLabel(9)).toBe('09:00');
  });
});

describe('edit form', () => {
  it('starts from the saved class in gym time', async () => {
    const { formFromClass } = await import('../src/classes/calc');
    // 08:00 to 09:15 UTC in July is 09:00 to 10:15 in London.
    const f = formFromClass({ sessionId: 's', classTypeId: 't', name: 'Spin', description: 'About', startsAt: '2027-07-14T08:00:00Z', endsAt: '2027-07-14T09:15:00Z', capacity: 12, reservedCapacity: 3, releaseMinutesBefore: 60, staffIds: [], planIds: [] });
    expect(f).toMatchObject({ classTypeId: 't', name: 'Spin', date: '2027-07-14', start: '09:00', duration: '75', capacity: '12', reserved: '3', release: '60', description: 'About', repeat: false });
  });

  it('leaves the release blank when there is none and the type blank for a custom class', async () => {
    const { formFromClass } = await import('../src/classes/calc');
    const f = formFromClass({ sessionId: 's', classTypeId: null, name: 'Custom', description: '', startsAt: '2027-01-12T09:00:00Z', endsAt: '2027-01-12T10:00:00Z', capacity: 5, reservedCapacity: 0, releaseMinutesBefore: null, staffIds: [], planIds: [] });
    expect(f.release).toBe('');
    expect(f.classTypeId).toBe('');
    expect(f.start).toBe('09:00');
  });
});

describe('roster', () => {
  it('words the counts, leaving out zero attended and no-show', async () => {
    const { rosterSummary } = await import('../src/classes/calc');
    expect(rosterSummary([])).toBe('0 booked');
    expect(rosterSummary([{ status: 'booked' }, { status: 'booked' }])).toBe('2 booked');
    expect(rosterSummary([{ status: 'booked' }, { status: 'attended' }, { status: 'attended' }, { status: 'no_show' }])).toBe('4 booked · 2 attended · 1 no-show');
  });
});

describe('roster actions', () => {
  it('offers attended, no-show and remove for a booked person', async () => {
    const { rosterActions } = await import('../src/classes/calc');
    expect(rosterActions('booked').map((a) => a.action)).toEqual(['attended', 'no_show', 'cancel']);
  });
  it('offers undo and remove once someone is marked', async () => {
    const { rosterActions } = await import('../src/classes/calc');
    expect(rosterActions('attended').map((a) => a.action)).toEqual(['booked', 'cancel']);
    expect(rosterActions('no_show').map((a) => a.action)).toEqual(['booked', 'cancel']);
  });
});
