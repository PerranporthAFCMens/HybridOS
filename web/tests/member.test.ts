import { describe, expect, it } from 'vitest';
import type { ClassRow, MyPlan, PtRow } from '../src/data/member';
import { ptMinutes, ptPastTag, splitPt, addDay, chooseHero, dayLabel, dayOf, dayStrip, flagsFor, goalMessage, spaceText, ordinal, minutesLeft, waitlistText, suggestions, timeOf, weekStartInstant, whenWords } from '../src/member/calc';

const cls = (id: string, startsAt: string, patch: Partial<ClassRow> = {}): ClassRow => ({ sessionId: id, name: id, description: '', startsAt, endsAt: new Date(new Date(startsAt).getTime() + 3600000).toISOString(), capacity: 10, bookedCount: 0, availableSpaces: 5, isBooked: false, ...patch });
const pt = (id: string, startsAt: string, status = 'scheduled'): PtRow => ({ id, startsAt, endsAt: new Date(new Date(startsAt).getTime() + 3600000).toISOString(), status });
const NOW = new Date('2026-10-08T10:00:00Z');
const ALL = { classes: true, gym: true, pt: true };

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

describe('waitlist words', () => {
  const at = new Date('2026-10-08T10:00:00Z').getTime();
  it('ordinals', () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 101, 111].map(ordinal)).toEqual(['1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st', '22nd', '101st', '111th']);
  });
  it('minutes left round up and stop at zero', () => {
    expect(minutesLeft('2026-10-08T10:12:10Z', at)).toBe(13);
    expect(minutesLeft('2026-10-08T10:15:00Z', at)).toBe(15);
    expect(minutesLeft('2026-10-08T09:59:00Z', at)).toBe(0);
    expect(minutesLeft(null, at)).toBe(0);
  });
  it('line for waiting and offered', () => {
    expect(waitlistText({ status: 'waiting', position: 2, offerExpiresAt: null }, at)).toBe("You're 2nd in line");
    expect(waitlistText({ status: 'waiting', position: null, offerExpiresAt: null }, at)).toBe("You're on the waitlist");
    expect(waitlistText({ status: 'offered', position: null, offerExpiresAt: '2026-10-08T10:01:00Z' }, at)).toBe('A place is held for you: 1 minute left');
    expect(waitlistText({ status: 'offered', position: null, offerExpiresAt: '2026-10-08T10:07:00Z' }, at)).toBe('A place is held for you: 7 minutes left');
    expect(waitlistText({ status: 'offered', position: null, offerExpiresAt: '2026-10-08T09:00:00Z' }, at)).toBe('Your held place has run out');
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
    expect(flagsFor(plan({ includesClasses: true }), false)).toEqual({ classes: true, gym: false, pt: false });
    expect(flagsFor(plan({ includesOpenGym: true }), false)).toEqual({ classes: false, gym: true, pt: false });
    expect(flagsFor(plan({ includesOpenGym: true }), true).pt).toBe(true);
    expect(flagsFor(null, false)).toEqual({ classes: true, gym: false, pt: false });
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
    expect(chooseHero(NOW, [], [], { classes: false, gym: false, pt: false })).toEqual({ kind: 'welcome' });
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

describe('personal training sessions', () => {
  const rows = [pt('past', '2026-10-01T09:00:00Z', 'completed'), pt('miss', '2026-09-20T09:00:00Z', 'no_show'), pt('cancelled', '2026-10-12T09:00:00Z', 'cancelled'), pt('next', '2026-10-10T09:00:00Z', 'booked'), pt('later', '2026-10-17T09:00:00Z', 'booked'), pt('unmarked', '2026-10-05T09:00:00Z', 'booked')];
  it('splits what is coming from what has been', () => {
    const r = splitPt(rows, NOW);
    expect(r.upcoming.map((x) => x.id)).toEqual(['next', 'later']);
    expect(r.past.map((x) => x.id)).toEqual(['unmarked', 'past', 'miss']);
  });
  it('lengths and labels', () => {
    expect(ptMinutes(pt('a', '2026-10-01T09:00:00Z'))).toBe(60);
    expect(ptPastTag('completed')).toBe('Done');
    expect(ptPastTag('no_show')).toBe('Missed');
    expect(ptPastTag('booked')).toBe('');
  });
});

import { birthdayKey, isBirthdayToday } from '../src/member/calc';

describe('birthdays', () => {
  it('is the birthday on the same month and day in UK time', () => {
    expect(isBirthdayToday('1990-10-08', NOW)).toBe(true);
    expect(isBirthdayToday('1990-10-09', NOW)).toBe(false);
    expect(isBirthdayToday('1990-09-08', NOW)).toBe(false);
  });
  it('uses the UK day, not the UTC day', () => {
    expect(isBirthdayToday('1990-10-09', new Date('2026-10-08T23:30:00Z'))).toBe(true); // 00:30 BST on the 9th
    expect(isBirthdayToday('1990-10-08', new Date('2026-10-08T23:30:00Z'))).toBe(false);
  });
  it('marks 29 February on the 28th in years with no 29th', () => {
    expect(isBirthdayToday('2000-02-29', new Date('2026-02-28T12:00:00Z'))).toBe(true);
    expect(isBirthdayToday('2000-02-29', new Date('2028-02-28T12:00:00Z'))).toBe(false);
    expect(isBirthdayToday('2000-02-29', new Date('2028-02-29T12:00:00Z'))).toBe(true);
  });
  it('is never a birthday with no date', () => {
    expect(isBirthdayToday(null, NOW)).toBe(false);
    expect(isBirthdayToday('', NOW)).toBe(false);
  });
  it('remembers per person and year', () => {
    expect(birthdayKey('u1', 2026)).toBe('hybrid-birthday-u1-2026');
  });
});

describe('Strava display', () => {
  it('shows short distances in metres and long ones in kilometres', async () => {
    const { distance } = await import('../src/member/calc');
    expect(distance(850)).toBe('850 m');
    expect(distance(5020)).toBe('5.02 km');
    expect(distance(0)).toBe('0 m');
  });
});
