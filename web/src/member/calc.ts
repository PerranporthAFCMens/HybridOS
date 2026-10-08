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

export interface Flags { classes: boolean; gym: boolean; pt: boolean; train: boolean }

/** What this member has. No plan information means classes are shown (they may still drop in). Train appears when the plan has the gym or PT, or a workout has been sent. */
export function flagsFor(plan: MyPlan | null, hasPt: boolean, hasWorkouts = false): Flags {
  if (!plan) return { classes: true, gym: false, pt: hasPt, train: hasPt || hasWorkouts };
  const pt = plan.includesPt || hasPt;
  return { classes: plan.includesClasses, gym: plan.includesOpenGym, pt, train: plan.includesOpenGym || pt || hasWorkouts };
}

export type Hero =
  | { kind: 'class'; row: ClassRow }
  | { kind: 'pt'; row: PtRow }
  | { kind: 'workout'; row: { id: string; title: string; status: string } }
  | { kind: 'book' }
  | { kind: 'welcome' };

/**
 * The one thing on top. Something booked that starts within three hours (or is on now) comes first; then a workout
 * that is due today; then the soonest booked class or PT session; else an invitation to book, else a welcome.
 */
export function chooseHero(now: Date, classes: ClassRow[], pt: PtRow[], flags: Flags, workout: { id: string; title: string; status: string } | null = null): Hero {
  const t = now.getTime();
  const nextClass = classes.filter((c) => c.isBooked && new Date(c.endsAt).getTime() >= t).sort((a, b) => a.startsAt.localeCompare(b.startsAt))[0];
  const nextPt = pt.filter((p) => p.status !== 'cancelled' && new Date(p.endsAt).getTime() >= t).sort((a, b) => a.startsAt.localeCompare(b.startsAt))[0];
  const thing: Hero | null = nextClass && nextPt ? (nextPt.startsAt < nextClass.startsAt ? { kind: 'pt', row: nextPt } : { kind: 'class', row: nextClass }) : nextClass ? { kind: 'class', row: nextClass } : nextPt ? { kind: 'pt', row: nextPt } : null;
  const startsAt = thing ? new Date(thing.kind === 'class' || thing.kind === 'pt' ? thing.row.startsAt : 0).getTime() : Infinity;
  if (thing && startsAt - t <= 3 * 3600000) return thing;
  if (workout) return { kind: 'workout', row: workout };
  if (thing) return thing;
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

/** PT sessions still to come (not cancelled), soonest first, and the ones that have passed, newest first. */
export function splitPt(rows: PtRow[], now: Date): { upcoming: PtRow[]; past: PtRow[] } {
  const t = now.getTime();
  const upcoming = rows.filter((r) => r.status !== 'cancelled' && new Date(r.endsAt).getTime() >= t).sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const past = rows.filter((r) => new Date(r.endsAt).getTime() < t && r.status !== 'cancelled').sort((a, b) => b.startsAt.localeCompare(a.startsAt));
  return { upcoming, past };
}

export const ptMinutes = (r: Pick<PtRow, 'startsAt' | 'endsAt'>): number => Math.max(0, Math.round((new Date(r.endsAt).getTime() - new Date(r.startsAt).getTime()) / 60000));

/** What to say about a session that has passed. A booked one nobody has marked gets no label. */
export function ptPastTag(status: string): string {
  return status === 'completed' ? 'Done' : status === 'no_show' ? 'Missed' : '';
}
