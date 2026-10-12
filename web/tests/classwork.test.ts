import { describe, expect, it } from 'vitest';
import { groupClassWorkouts } from '../src/train/classwork';

const item = (id: string, startsAt: string, done = false) => ({ sessionId: id, title: `W ${id}`, className: 'Hybrid 6pm', startsAt, done });
const upper = { id: 'b1', name: 'Hybrid Uppers', startsOn: '2026-10-12', weeks: 6 };
const old = { id: 'b0', name: 'Old block', startsOn: '2026-08-03', weeks: 4 };

describe('a member\'s class workouts', () => {
  const items = [item('a', '2026-10-13T17:00:00Z', true), item('b', '2026-10-20T17:00:00Z'), item('c', '2026-10-21T17:00:00Z'), item('o', '2026-08-04T17:00:00Z', true), item('x', '2026-10-15T17:00:00Z')];
  const blockOf = new Map([['a', upper], ['b', upper], ['c', upper], ['o', old]]);
  const groups = groupClassWorkouts(items, blockOf, '2026-10-21');
  it('groups by block, running first, and the rest last', () => {
    expect(groups.map((g) => g.heading)).toEqual(['Hybrid Uppers · week 2 of 6', 'Old block · 4 weeks', null]);
  });
  it('shows the week of each class and counts what is recorded', () => {
    expect(groups[0]?.items.map((i) => `${i.sessionId}:${i.week}`)).toEqual(['c:2', 'b:2', 'a:1']);
    expect(groups[0]?.progress).toBe('Recorded 1 of 3');
    expect(groups[1]?.progress).toBe('Recorded 1 of 1');
    expect(groups[2]?.items[0]?.week).toBeNull();
  });
  it('is empty with nothing to list', () => {
    expect(groupClassWorkouts([], new Map(), '2026-10-21')).toEqual([]);
  });
});
