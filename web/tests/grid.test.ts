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
