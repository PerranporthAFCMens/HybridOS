// Pure rules behind the Rota screen: which days a week shows, what each person's day looks like once time off and
// closed days are laid over their weekly hours, and exactly what a new block saves. Times are the gym's clock (UK time).
import { londonInstant, londonParts } from '../classes/calc';
import type { HoursRow } from '../staff/calc';

export type BlockKind = 'blocked' | 'leave' | 'sick' | 'other';
export const BLOCK_KINDS: [BlockKind, string][] = [['blocked', 'Blocked out'], ['leave', 'Holiday or leave'], ['sick', 'Sick'], ['other', 'Other']];
export const kindLabel = (k: string) => BLOCK_KINDS.find(([v]) => v === k)?.[1] ?? 'Blocked out';

export interface BlockRow { id: string; userId: string; startsAt: string; endsAt: string; kind: string; reason: string | null }
export interface ClosedRow { id: string; closedOn: string; reason: string | null }

const DAY_MS = 86_400_000;

/** Add days to a YYYY-MM-DD date (pure date maths, no clock involved). */
export function addDays(date: string, n: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10);
}

/** The Monday of the week that holds this date. */
export function weekStart(date: string): string {
  const dow = new Date(`${date}T12:00:00Z`).getUTCDay(); // 0 = Sunday
  return addDays(date, -((dow + 6) % 7));
}

export const weekDates = (start: string) => Array.from({ length: 7 }, (_, i) => addDays(start, i));
const weekdayOf = (date: string) => new Date(`${date}T12:00:00Z`).getUTCDay();

const MONTH = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const DAY = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', timeZone: 'UTC' });
const LONG = new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
const at = (date: string) => new Date(`${date}T12:00:00Z`);
export const dayHeading = (date: string) => DAY.format(at(date));
export const longDay = (date: string) => LONG.format(at(date));
export const weekLabel = (start: string) => `${MONTH.format(at(start))} to ${MONTH.format(at(addDays(start, 6)))} ${addDays(start, 6).slice(0, 4)}`;

/** The window of the gym's clock that a date covers: midnight to the next midnight. */
export function dayRange(date: string): { start: Date; end: Date } {
  return { start: londonInstant(date, '00:00'), end: londonInstant(addDays(date, 1), '00:00') };
}

const hhmm = (t: string | null | undefined) => String(t ?? '').slice(0, 5);
const clock = (d: Date) => londonParts(d).time.slice(0, 5);

export type CellState = 'closed' | 'away' | 'part' | 'working' | 'off';
export interface Cell { state: CellState; text: string; detail: string; blocks: BlockRow[] }

/**
 * What one person's day looks like. Closed days win, then a block that covers the whole day, then a block over part of
 * it (their hours stay visible with the blocked time beside them), then their normal weekly hours, then a day off.
 */
export function cellFor(date: string, hours: HoursRow[], blocks: BlockRow[], closed: ClosedRow | undefined): Cell {
  const day = dayRange(date);
  const over = blocks.filter((b) => new Date(b.startsAt) < day.end && new Date(b.endsAt) > day.start);
  const normal = hours.find((h) => h.weekday === weekdayOf(date) && h.isWorking && h.start && h.end);
  if (closed) return { state: 'closed', text: 'Closed', detail: closed.reason ?? '', blocks: over };
  const whole = over.find((b) => new Date(b.startsAt) <= day.start && new Date(b.endsAt) >= day.end);
  if (whole) return { state: 'away', text: kindLabel(whole.kind), detail: whole.reason ?? '', blocks: over };
  if (over.length) {
    const times = over.map((b) => `${clock(new Date(Math.max(+new Date(b.startsAt), +day.start)))}–${clock(new Date(Math.min(+new Date(b.endsAt), +day.end - 60_000)))}`);
    return { state: 'part', text: kindLabel(over[0]?.kind ?? 'blocked'), detail: times.join(', '), blocks: over };
  }
  if (normal) return { state: 'working', text: `${hhmm(normal.start)}–${hhmm(normal.end)}`, detail: '', blocks: [] };
  return { state: 'off', text: 'Off', detail: '', blocks: [] };
}

export interface BlockForm { userId: string; kind: BlockKind; wholeDay: boolean; fromDate: string; toDate: string; fromTime: string; toTime: string; reason: string }

export const emptyBlockForm = (userId: string, date: string): BlockForm => ({ userId, kind: 'blocked', wholeDay: true, fromDate: date, toDate: date, fromTime: '09:00', toTime: '10:00', reason: '' });

export type BlockCheck = { ok: true; startsAt: string; endsAt: string; reason: string | null } | { ok: false; message: string };

/** Turns the form into the two instants that are saved, or says what to fix. */
export function validateBlock(f: BlockForm): BlockCheck {
  if (!f.userId) return { ok: false, message: 'Choose who this is for.' };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(f.fromDate)) return { ok: false, message: 'Choose the first day.' };
  const reason = f.reason.trim().slice(0, 200) || null;
  if (f.wholeDay) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(f.toDate)) return { ok: false, message: 'Choose the last day.' };
    if (f.toDate < f.fromDate) return { ok: false, message: 'The last day cannot be before the first day.' };
    return { ok: true, startsAt: londonInstant(f.fromDate, '00:00').toISOString(), endsAt: londonInstant(addDays(f.toDate, 1), '00:00').toISOString(), reason };
  }
  const start = londonInstant(f.fromDate, f.fromTime);
  const end = londonInstant(f.fromDate, f.toTime);
  if (Number.isNaN(+start) || Number.isNaN(+end)) return { ok: false, message: 'Choose a start and end time.' };
  if (end <= start) return { ok: false, message: 'The end time must be after the start time.' };
  return { ok: true, startsAt: start.toISOString(), endsAt: end.toISOString(), reason };
}

/** "Wed 28 Oct, 16:00–18:00" or "Wed 28 Oct to Thu 29 Oct" for the list of blocks on a day. */
export function blockText(b: BlockRow): string {
  const s = new Date(b.startsAt);
  const e = new Date(b.endsAt);
  const sp = londonParts(s);
  const ep = londonParts(new Date(+e - 60_000));
  const whole = sp.time.startsWith('00:00') && londonParts(e).time.startsWith('00:00');
  if (whole) return sp.date === ep.date ? longDay(sp.date) : `${longDay(sp.date)} to ${longDay(ep.date)}`;
  return `${dayHeading(sp.date)}, ${clock(s)}–${clock(e)}`;
}
