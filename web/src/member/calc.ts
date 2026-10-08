import { londonParts } from '../classes/calc';
import type { ClassRow, MyPlan, PtRow } from '../data/member';

// Pure rules for the member app: which day a class is on at the gym, what to put on top of the first
// screen, and how to word spaces. All days are gym (UK) calendar days.

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const LONG_WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export const dayOf = (iso: string): string => londonParts(new Date(iso)).date;
export const timeOf = (iso: string): string => londonParts(new Date(iso)).time.slice(0, 5);
const utc = (day: string) => Date.UTC(Number(day.slice(0, 4)), Number(day.slice(5, 7)) - 1, Number(day.slice(8, 10)));
export const addDay = (day: string, n: number): string => new Date(utc(day) + n * 86400000).toISOString().slice(0, 10);
const weekdayIndex = (day: string) => new Date(utc(day)).getUTCDay();

/** "Thu 9 Oct". */
export function dayLabel(day: string): string {
  return `${WEEKDAYS[weekdayIndex(day)]} ${Number(day.slice(8, 10))} ${MONTHS[Number(day.slice(5, 7)) - 1]}`;
}

/** "today", "tomorrow", or the weekday for the next six days, else the date. */
export function whenWords(day: string, today: string): string {
  const diff = Math.round((utc(day) - utc(today)) / 86400000);
  if (diff === 0) return 'today';
  if (diff === 1) return 'tomorrow';
  if (diff > 1 && diff < 7) return LONG_WEEKDAYS[weekdayIndex(day)] ?? day;
  return dayLabel(day);
}

/** A strip of days starting today. */
export function dayStrip(today: string, count: number): { key: string; weekday: string; num: string }[] {
  return Array.from({ length: count }, (_, i) => {
    const key = addDay(today, i);
    return { key, weekday: i === 0 ? 'Today' : (WEEKDAYS[weekdayIndex(key)] ?? ''), num: String(Number(key.slice(8, 10))) };
  });
}

export function spaceText(c: Pick<ClassRow, 'isBooked' | 'availableSpaces'>): string {
  if (c.isBooked) return 'Booked';
  if (c.availableSpaces <= 0) return 'Full';
  return `${c.availableSpaces} ${c.availableSpaces === 1 ? 'space' : 'spaces'} left`;
}

export interface Flags { classes: boolean; gym: boolean; pt: boolean }

/** What this member has. No plan information means classes are shown (they may still drop in) and nothing else. */
export function flagsFor(plan: MyPlan | null, hasPt: boolean): Flags {
  if (!plan) return { classes: true, gym: false, pt: hasPt };
  return { classes: plan.includesClasses, gym: plan.includesOpenGym, pt: plan.includesPt || hasPt };
}

export type Hero =
  | { kind: 'class'; row: ClassRow }
  | { kind: 'pt'; row: PtRow }
  | { kind: 'book' }
  | { kind: 'welcome' };

/** The one thing on top: the soonest thing already booked, whether class or PT; else invite a booking; else welcome. */
export function chooseHero(now: Date, classes: ClassRow[], pt: PtRow[], flags: Flags): Hero {
  const t = now.getTime();
  const nextClass = classes.filter((c) => c.isBooked && new Date(c.endsAt).getTime() >= t).sort((a, b) => a.startsAt.localeCompare(b.startsAt))[0];
  const nextPt = pt.filter((p) => p.status !== 'cancelled' && new Date(p.endsAt).getTime() >= t).sort((a, b) => a.startsAt.localeCompare(b.startsAt))[0];
  if (nextClass && nextPt) return nextPt.startsAt < nextClass.startsAt ? { kind: 'pt', row: nextPt } : { kind: 'class', row: nextClass };
  if (nextClass) return { kind: 'class', row: nextClass };
  if (nextPt) return { kind: 'pt', row: nextPt };
  return flags.classes ? { kind: 'book' } : { kind: 'welcome' };
}

/** Classes worth suggesting: coming up, not booked, with room, soonest first. */
export function suggestions(now: Date, classes: ClassRow[], n: number): ClassRow[] {
  return classes.filter((c) => !c.isBooked && c.availableSpaces > 0 && new Date(c.startsAt).getTime() > now.getTime()).sort((a, b) => a.startsAt.localeCompare(b.startsAt)).slice(0, n);
}

/** Monday 00:00 gym time of the week containing the day, as an instant (start of that UK day). */
export function weekStartInstant(today: string): Date {
  const back = (weekdayIndex(today) + 6) % 7;
  const monday = addDay(today, -back);
  // Midday UTC on that date is never near a day edge in the UK, so step back to the true midnight.
  const noon = new Date(`${monday}T12:00:00Z`);
  const parts = londonParts(noon);
  const [hh = 12, mm = 0] = parts.time.split(':').map(Number);
  return new Date(noon.getTime() - (hh * 60 + mm) * 60000);
}

export function goalMessage(done: number, target: number): string {
  if (done >= target) return 'Weekly goal done. Nice work.';
  if (done === target - 1) return 'One more session to reach your goal.';
  return `${target - done} sessions to reach your goal.`;
}
