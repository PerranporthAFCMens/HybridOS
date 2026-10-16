// Pure rules for the Programmes page: which classes a "type and days" choice picks, and where each of the four steps stands.
// A programme is a block (a named run of weeks). The class type here is the class name, as on the timetable.
import type { BlockClass } from '../data/classBlocks';
import { londonParts } from '../classes/calc';
import { blockWeek, gymDay } from '../classes/blocks';

/** Monday first, as the timetable shows the week. The number is the gym-clock weekday, 0 = Sunday. */
export const WEEKDAYS: { day: number; label: string }[] = [
  { day: 1, label: 'Mon' }, { day: 2, label: 'Tue' }, { day: 3, label: 'Wed' }, { day: 4, label: 'Thu' }, { day: 5, label: 'Fri' }, { day: 6, label: 'Sat' }, { day: 0, label: 'Sun' },
];

/** The class names on offer in these weeks, alphabetical. */
export function classNames(classes: BlockClass[]): string[] {
  return [...new Set(classes.map((c) => c.session.name))].sort((a, b) => a.localeCompare(b));
}

/** The days of the week (gym clock) a class name runs on in these weeks. */
export function daysFor(classes: BlockClass[], name: string): number[] {
  return [...new Set(classes.filter((c) => c.session.name === name).map((c) => londonParts(new Date(c.session.starts_at)).weekday))];
}

export interface Pick { matching: string[]; toAdd: string[]; alreadyIn: number; elsewhere: { id: string; block: string }[] }

/**
 * Every class with this name on these days. Ones already in this programme are left alone; ones in another programme are
 * skipped (a class can be in only one), and reported so the coach is told.
 */
export function pickClasses(classes: BlockClass[], name: string, days: number[], otherBlock: Map<string, string>): Pick {
  const matching = classes.filter((c) => c.session.name === name && days.includes(londonParts(new Date(c.session.starts_at)).weekday));
  const elsewhere = matching.filter((c) => !c.inBlock && otherBlock.has(c.session.session_id)).map((c) => ({ id: c.session.session_id, block: otherBlock.get(c.session.session_id) ?? '' }));
  const skip = new Set(elsewhere.map((e) => e.id));
  return {
    matching: matching.map((c) => c.session.session_id),
    toAdd: matching.filter((c) => !c.inBlock && !skip.has(c.session.session_id)).map((c) => c.session.session_id),
    alreadyIn: matching.filter((c) => c.inBlock).length,
    elsewhere,
  };
}

export type StepState = 'done' | 'current' | 'next' | 'optional';
export interface Step { n: number; title: string; detail: string; state: StepState }

/** The four steps with what is done and what is next. Step 4 (tests) is optional, so it is never "current" on its own. */
export function programmeSteps(classes: BlockClass[], tests: number): Step[] {
  const inBlock = classes.filter((c) => c.inBlock);
  const withWorkout = inBlock.filter((c) => c.workout !== 'none').length;
  const classesDone = inBlock.length > 0;
  const workoutsDone = classesDone && withWorkout === inBlock.length;
  const current = !classesDone ? 2 : !workoutsDone ? 3 : 4;
  const state = (n: number, optional = false): StepState => (n < current ? 'done' : n === current ? 'current' : optional ? 'optional' : 'next');
  return [
    { n: 1, title: 'Name it', detail: 'Name, start and weeks', state: 'done' },
    { n: 2, title: 'Classes', detail: classesDone ? `${inBlock.length} attached` : 'None attached yet', state: state(2) },
    { n: 3, title: 'Workouts', detail: classesDone ? `${withWorkout} of ${inBlock.length} set` : 'After the classes', state: state(3) },
    { n: 4, title: 'Tests', detail: tests > 0 ? `${tests} set` : 'Optional', state: tests > 0 && current === 4 ? 'done' : state(4, true) },
  ];
}

export interface GridRow { key: string; label: string; cells: (BlockClass | null)[] }

/**
 * The workout grid: one row for each class slot in the programme (same name, weekday and start time) and one cell for each week.
 * A week with no class in that slot is null. Only classes that are in the programme are shown.
 */
export function gridRows(classes: BlockClass[], startsOn: string, weeks: number): GridRow[] {
  const rows = new Map<string, GridRow & { sort: [number, string, string] }>();
  for (const c of classes) {
    if (!c.inBlock) continue;
    const week = blockWeek(startsOn, weeks, gymDay(c.session.starts_at));
    if (week === null) continue;
    const p = londonParts(new Date(c.session.starts_at));
    const time = p.time.slice(0, 5);
    const key = `${c.session.name}|${p.weekday}|${time}`;
    const day = WEEKDAYS.find((d) => d.day === p.weekday)?.label ?? '';
    const row = rows.get(key) ?? { key, label: `${day} ${time} ${c.session.name}`, cells: Array<BlockClass | null>(weeks).fill(null), sort: [(p.weekday + 6) % 7, time, c.session.name] };
    row.cells[week - 1] ??= c;
    rows.set(key, row);
  }
  return [...rows.values()]
    .sort((a, b) => a.sort[0] - b.sort[0] || a.sort[1].localeCompare(b.sort[1]) || a.sort[2].localeCompare(b.sort[2]))
    .map(({ key, label, cells }) => ({ key, label, cells }));
}
