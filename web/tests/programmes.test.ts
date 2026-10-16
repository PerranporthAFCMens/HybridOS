import { describe, expect, it } from 'vitest';
import type { BlockClass } from '../src/data/classBlocks';
import { classNames, daysFor, pickClasses, programmeSteps } from '../src/programmes/calc';

// 2026-10-19 is a Monday, 2026-10-23 a Friday (UK time, BST).
const cls = (id: string, name: string, iso: string, inBlock = false, workout: BlockClass['workout'] = 'none'): BlockClass =>
  ({ session: { session_id: id, name, starts_at: iso } as BlockClass['session'], inBlock, workout, workoutTitle: null });
const list = [
  cls('a', 'Demo HIIT', '2026-10-19T05:30:00Z'),
  cls('b', 'Demo HIIT', '2026-10-23T16:30:00Z'),
  cls('c', 'Demo HIIT', '2026-10-24T08:00:00Z'),
  cls('d', 'Crossfit', '2026-10-19T12:00:00Z'),
];

describe('programme class picking', () => {
  it('lists class names and the days each runs on', () => {
    expect(classNames(list)).toEqual(['Crossfit', 'Demo HIIT']);
    expect(daysFor(list, 'Demo HIIT').sort()).toEqual([1, 5, 6]);
  });

  it('picks every class with that name on those days', () => {
    const p = pickClasses(list, 'Demo HIIT', [1, 5], new Map());
    expect(p.matching).toEqual(['a', 'b']);
    expect(p.toAdd).toEqual(['a', 'b']);
  });

  it('leaves classes already in the programme alone and skips ones in another programme', () => {
    const l = [cls('a', 'Demo HIIT', '2026-10-19T05:30:00Z', true), cls('b', 'Demo HIIT', '2026-10-23T16:30:00Z'), cls('c', 'Demo HIIT', '2026-10-26T05:30:00Z')];
    const p = pickClasses(l, 'Demo HIIT', [1, 5], new Map([['b', 'Summer Strength']]));
    expect(p.toAdd).toEqual(['c']);
    expect(p.alreadyIn).toBe(1);
    expect(p.elsewhere).toEqual([{ id: 'b', block: 'Summer Strength' }]);
  });

  it('picks nothing when no days are chosen', () => {
    expect(pickClasses(list, 'Demo HIIT', [], new Map()).toAdd).toEqual([]);
  });
});

describe('programme steps', () => {
  it('starts at classes when none are attached', () => {
    const s = programmeSteps(list, 0);
    expect(s.map((x) => x.state)).toEqual(['done', 'current', 'next', 'optional']);
  });

  it('moves to workouts, then tests, as things are filled in', () => {
    const half = [cls('a', 'X', '2026-10-19T05:30:00Z', true, 'available'), cls('b', 'X', '2026-10-20T05:30:00Z', true, 'none')];
    const s = programmeSteps(half, 0);
    expect(s.map((x) => x.state)).toEqual(['done', 'done', 'current', 'optional']);
    expect(s[2]?.detail).toBe('1 of 2 set');
    const all = programmeSteps(half.map((c) => ({ ...c, workout: 'available' as const })), 2);
    expect(all.map((x) => x.state)).toEqual(['done', 'done', 'done', 'done']);
  });
});
