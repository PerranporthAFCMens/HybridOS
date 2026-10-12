// Pure rules for class blocks: a block is a named run of weeks ("Hybrid Uppers, 6 weeks from 12 October"). Which classes belong
// to it is the coach's choice; the week of a class is worked out from its date, never stored. Dates are plain yyyy-mm-dd days on
// the gym's clock (UK time).
import { londonInstant, londonParts } from './calc';

export const MIN_BLOCK_WEEKS = 1;
export const MAX_BLOCK_WEEKS = 52;

export interface BlockForm { name: string; startsOn: string; weeks: string }
export type BlockCheck = { ok: true; name: string; startsOn: string; weeks: number } | { ok: false; message: string };

const DAY_MS = 86400000;
const parse = (day: string): number => {
  const [y = 0, m = 1, d = 1] = day.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
};
const format = (ms: number): string => new Date(ms).toISOString().slice(0, 10);
const isDay = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(parse(s)) && format(parse(s)) === s;

export const addDaysTo = (day: string, n: number): string => format(parse(day) + n * DAY_MS);
export const daysBetween = (from: string, to: string): number => Math.round((parse(to) - parse(from)) / DAY_MS);

export function validateBlock(f: BlockForm): BlockCheck {
  const name = f.name.trim();
  if (!name) return { ok: false, message: 'Give the block a name, like Hybrid Uppers.' };
  if (name.length > 80) return { ok: false, message: 'The name can be up to 80 characters.' };
  if (!isDay(f.startsOn)) return { ok: false, message: 'Choose the day the block starts.' };
  const weeks = Number(f.weeks);
  if (!Number.isInteger(weeks) || weeks < MIN_BLOCK_WEEKS || weeks > MAX_BLOCK_WEEKS) return { ok: false, message: `Choose between ${MIN_BLOCK_WEEKS} and ${MAX_BLOCK_WEEKS} weeks.` };
  return { ok: true, name, startsOn: f.startsOn, weeks };
}

/** Which week of the block a day is in (1 is the first), or null when the day is outside the block. */
export function blockWeek(startsOn: string, weeks: number, day: string): number | null {
  const n = daysBetween(startsOn, day);
  return n < 0 || n >= weeks * 7 ? null : Math.floor(n / 7) + 1;
}

/** The last day of the block. */
export const blockLastDay = (startsOn: string, weeks: number): string => addDaysTo(startsOn, weeks * 7 - 1);

/** "Hybrid Uppers · week 3 of 6". */
export const blockLabel = (name: string, week: number | null, weeks: number): string => (week === null ? `${name} · ${weeks} weeks` : `${name} · week ${week} of ${weeks}`);

/** The instants that cover the block on the gym's clock, from its first midnight to the end of its last day. */
export function blockRange(startsOn: string, weeks: number): { from: string; to: string } {
  return { from: londonInstant(startsOn, '00:00').toISOString(), to: londonInstant(addDaysTo(blockLastDay(startsOn, weeks), 1), '00:00').toISOString() };
}

export type BlockState = { state: 'upcoming' | 'running' | 'finished'; week: number | null };

/** Where the block is today: not started, in a week of it, or over. */
export function blockState(startsOn: string, weeks: number, today: string): BlockState {
  if (daysBetween(startsOn, today) < 0) return { state: 'upcoming', week: null };
  const w = blockWeek(startsOn, weeks, today);
  return w === null ? { state: 'finished', week: null } : { state: 'running', week: w };
}

export const gymDay = (iso: string): string => londonParts(new Date(iso)).date;

/** Classes grouped by the week of the block they fall in; weeks with none are kept so gaps are visible. */
export function groupByWeek<T extends { startsAt: string }>(startsOn: string, weeks: number, items: T[]): { week: number; items: T[] }[] {
  const out = Array.from({ length: weeks }, (_, i) => ({ week: i + 1, items: [] as T[] }));
  for (const it of [...items].sort((a, b) => a.startsAt.localeCompare(b.startsAt))) {
    const w = blockWeek(startsOn, weeks, gymDay(it.startsAt));
    if (w !== null) out[w - 1]?.items.push(it);
  }
  return out;
}
