import { describe, expect, it } from 'vitest';
import type { ClassRow, MyPlan, PtRow } from '../src/data/member';
import { addDay, chooseHero, dayLabel, dayOf, dayStrip, flagsFor, goalMessage, spaceText, suggestions, timeOf, weekStartInstant, whenWords } from '../src/member/calc';

const cls = (id: string, startsAt: string, patch: Partial<ClassRow> = {}): ClassRow => ({ sessionId: id, name: id, description: '', startsAt, endsAt: new Date(new Date(startsAt).getTime() + 3600000).toISOString(), capacity: 10, bookedCount: 0, availableSpaces: 5, isBooked: false, ...patch });
const pt = (id: string, startsAt: string, status = 'scheduled'): PtRow => ({ id, startsAt, endsAt: new Date(new Date(startsAt).getTime() + 3600000).toISOString(), status });
const NOW = new Date('2026-10-08T10:00:00Z');
const ALL = { classes: true, gym: true, pt: true, train: true };

describe('days', () => {
  it('reads the gym day, not the UTC day', () => {
    expect(dayOf('2026-10-08T23:30:00Z')).toBe('2026-10-09'); // 00:30 BST
    expect(timeOf('2026-10-08T23:30:00Z')).toBe('00:30');
    expect(dayOf('2026-12-08T23:30:00Z')).toBe('2026-12-08');
  });
  it('words and labels', () => {
    expect(whenWords('2026-10-08', '2026-10-08')).toBe('today');
    expect(whenWords('2026-10-09', '2026-10-08')).toBe('tomorrow');
    expect(whenWords('2026-10-11', '2026-10-08')).toBe('Sunday');
    expect(whenWords('2026-10-20', '2026-10-08')).toBe('Tue 20 Oct');
    expect(dayLabel('2026-10-09')).toBe('Fri 9 Oct');
    expect(addDay('2026-12-31', 1)).toBe('2027-01-01');
  });
  it('a strip of days', () => {
    const s = dayStrip('2026-10-08', 3);
    expect(s.map((d) => `${d.weekday} ${d.num}`)).toEqual(['Today 8', 'Fri 9', 'Sat 10']);
  });
});

describe('spaces and plan', () => {
  it('words', () => {
    expect(spaceText({ isBooked: true, availableSpaces: 0 })).toBe('Booked');
    expect(spaceText({ isBooked: false, availableSpaces: 0 })).toBe('Full');
    expect(spaceText({ isBooked: false, availableSpaces: 1 })).toBe('1 space left');
    expect(spaceText({ isBooked: false, availableSpaces: 4 })).toBe('4 spaces left');
  });
  it('what a member has comes from the plan', () => {
    const plan = (p: Partial<MyPlan>): MyPlan => ({ name: 'P', status: 'active', includesClasses: false, includesOpenGym: false, includesPt: false, ...p });
    expect(flagsFor(plan({ includesClasses: true }), false)).toEqual({ classes: true, gym: false, pt: false, train: false });
    expect(flagsFor(plan({ includesOpenGym: true }), false)).toEqual({ classes: false, gym: true, pt: false, train: true });
    expect(flagsFor(plan({ includesOpenGym: true }), true).pt).toBe(true);
    expect(flagsFor(null, false)).toEqual({ classes: true, gym: false, pt: false, train: false });
    expect(flagsFor(plan({ includesClasses: true }), false, true).train).toBe(true);
  });
});

describe('the one thing on top', () => {
  it('the soonest booked thing wins, class or PT', () => {
    const c = cls('a', '2026-10-09T18:00:00Z', { isBooked: true });
    expect(chooseHero(NOW, [c], [pt('p', '2026-10-10T09:00:00Z')], ALL)).toMatchObject({ kind: 'class' });
    expect(chooseHero(NOW, [c], [pt('p', '2026-10-09T09:00:00Z')], ALL)).toMatchObject({ kind: 'pt' });
  });
  it('ignores cancelled PT and classes that are over', () => {
    const over = cls('o', '2026-10-08T07:00:00Z', { isBooked: true });
    expect(chooseHero(NOW, [over], [pt('p', '2026-10-09T09:00:00Z', 'cancelled')], ALL)).toMatchObject({ kind: 'book' });
  });
  it('a class still running counts', () => {
    const running = cls('r', '2026-10-08T09:30:00Z', { isBooked: true });
    expect(chooseHero(NOW, [running], [], ALL)).toMatchObject({ kind: 'class' });
  });
  it('invites a booking, or just welcomes someone with no classes', () => {
    expect(chooseHero(NOW, [], [], ALL)).toEqual({ kind: 'book' });
    expect(chooseHero(NOW, [], [], { classes: false, gym: false, pt: false, train: false })).toEqual({ kind: 'welcome' });
  });
  it('suggests classes with room, not booked, soonest first', () => {
    const list = [cls('late', '2026-10-12T10:00:00Z'), cls('full', '2026-10-09T10:00:00Z', { availableSpaces: 0 }), cls('mine', '2026-10-09T11:00:00Z', { isBooked: true }), cls('soon', '2026-10-09T12:00:00Z'), cls('past', '2026-10-07T12:00:00Z')];
    expect(suggestions(NOW, list, 2).map((c) => c.sessionId)).toEqual(['soon', 'late']);
  });
});

describe('workouts on top', () => {
  const w = { id: 'w1', title: 'Upper body', status: 'todo' };
  it('a due workout beats a class that is hours away, but not one starting soon', () => {
    const far = cls('far', '2026-10-08T18:00:00Z', { isBooked: true });
    const soon = cls('soon', '2026-10-08T11:30:00Z', { isBooked: true });
    expect(chooseHero(NOW, [far], [], ALL, w)).toMatchObject({ kind: 'workout' });
    expect(chooseHero(NOW, [soon], [], ALL, w)).toMatchObject({ kind: 'class' });
  });
  it('a workout alone, or nothing', () => {
    expect(chooseHero(NOW, [], [], ALL, w)).toMatchObject({ kind: 'workout' });
    expect(chooseHero(NOW, [], [], ALL, null)).toEqual({ kind: 'book' });
  });
});

describe('the week', () => {
  it('starts at Monday midnight gym time', () => {
    expect(weekStartInstant('2026-10-08').toISOString()).toBe('2026-10-04T23:00:00.000Z'); // Mon 5 Oct 00:00 BST
    expect(weekStartInstant('2026-12-02').toISOString()).toBe('2026-11-30T00:00:00.000Z'); // Mon 30 Nov 00:00 GMT
  });
  it('goal words', () => {
    expect(goalMessage(3, 3)).toBe('Weekly goal done. Nice work.');
    expect(goalMessage(2, 3)).toBe('One more session to reach your goal.');
    expect(goalMessage(0, 3)).toBe('3 sessions to reach your goal.');
  });
});
