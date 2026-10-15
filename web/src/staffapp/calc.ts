import type { Permissions } from '../access/calc';
import type { StaffClass } from '../data/staffApp';
import { dayLabel, dayOf, whenWords } from '../member/calc';

const ALL_ROLES = ['owner', 'admin'];

/** What a person may do: owners and admins everything, staff and coaches only what their access level ticks. */
export function can(role: string, permissions: Permissions, key: string): boolean {
  return ALL_ROLES.includes(role) || permissions[key] === true;
}

/** Classes grouped by London calendar day, in time order. */
export function groupByDay(classes: StaffClass[]): { day: string; classes: StaffClass[] }[] {
  const days = new Map<string, StaffClass[]>();
  for (const c of [...classes].sort((a, b) => a.startsAt.localeCompare(b.startsAt))) {
    const day = dayOf(c.startsAt);
    days.set(day, [...(days.get(day) ?? []), c]);
  }
  return [...days].map(([day, list]) => ({ day, classes: list }));
}

/** Classes still to come or already running (a class stays on "Next up" until it finishes). */
export function nextUp(classes: StaffClass[], now: Date): StaffClass | null {
  return [...classes].sort((a, b) => a.startsAt.localeCompare(b.startsAt)).find((c) => new Date(c.endsAt) > now) ?? null;
}

export function classCountText(n: number): string {
  return n === 0 ? 'No classes' : n === 1 ? '1 class' : `${n} classes`;
}

/** "Today · Thu 15 Oct", "Tomorrow · Fri 16 Oct", or just the date when it is a week or more away. */
export function dayHeading(day: string, today: string): string {
  const words = whenWords(day, today);
  return words === dayLabel(day) ? words : `${words.charAt(0).toUpperCase()}${words.slice(1)} · ${dayLabel(day)}`;
}
