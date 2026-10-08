import type { TimetableSession } from '../data/classes';
import { londonParts } from './calc';

/** Height of one hour on the calendar, in pixels. Big enough that an hour slot is an easy tap. */
export const HOUR_PX = 56;
/** The calendar always shows at least these hours; it grows if a class falls outside them. */
export const DEFAULT_START_HOUR = 5;
export const DEFAULT_END_HOUR = 23;
/** Shortest a class block is drawn, so a 15 minute class can still be tapped. */
export const MIN_BLOCK_PX = 40;

function minutesOfDay(time: string): number {
  const [h = 0, m = 0] = time.split(':').map(Number);
  return h * 60 + m;
}

/** First and last hour to draw (end is exclusive), widened to include every class. */
export function gridHours(sessions: TimetableSession[]): { startHour: number; endHour: number } {
  let startHour = DEFAULT_START_HOUR;
  let endHour = DEFAULT_END_HOUR;
  for (const s of sessions) {
    const a = minutesOfDay(londonParts(new Date(s.starts_at)).time);
    const b = Math.min(24 * 60, minutesOfDay(londonParts(new Date(s.ends_at)).time) || 24 * 60);
    startHour = Math.min(startHour, Math.floor(a / 60));
    endHour = Math.max(endHour, Math.ceil(b / 60));
  }
  return { startHour, endHour };
}

export interface Block {
  session: TimetableSession;
  /** Pixels from the top of the day column. */
  top: number;
  height: number;
  /** Side-by-side position when classes overlap: lane 0 of 2, lane 1 of 2, and so on. */
  lane: number;
  lanes: number;
}

/** The classes on one gym-time day, placed on the calendar. Overlapping classes sit side by side. */
export function dayBlocks(sessions: TimetableSession[], dateKey: string, startHour: number): Block[] {
  const day = sessions
    .filter((s) => londonParts(new Date(s.starts_at)).date === dateKey)
    .map((s) => {
      const start = minutesOfDay(londonParts(new Date(s.starts_at)).time);
      const rawEnd = minutesOfDay(londonParts(new Date(s.ends_at)).time);
      const end = rawEnd > start ? rawEnd : 24 * 60;
      return { s, start, end };
    })
    .sort((a, b) => a.start - b.start || a.end - b.end);

  const placed: { s: TimetableSession; start: number; end: number; lane: number; cluster: number }[] = [];
  let laneEnds: number[] = [];
  let cluster = -1;
  let clusterEnd = -1;
  for (const item of day) {
    if (item.start >= clusterEnd) {
      cluster += 1;
      laneEnds = [];
    }
    let lane = laneEnds.findIndex((end) => end <= item.start);
    if (lane === -1) lane = laneEnds.length;
    laneEnds[lane] = item.end;
    clusterEnd = Math.max(clusterEnd, item.end);
    placed.push({ ...item, lane, cluster });
  }
  const lanesIn = new Map<number, number>();
  for (const p of placed) lanesIn.set(p.cluster, Math.max(lanesIn.get(p.cluster) ?? 0, p.lane + 1));
  return placed.map((p) => ({
    session: p.s,
    top: ((p.start - startHour * 60) / 60) * HOUR_PX,
    height: Math.max(((p.end - p.start) / 60) * HOUR_PX, MIN_BLOCK_PX),
    lane: p.lane,
    lanes: lanesIn.get(p.cluster) ?? 1,
  }));
}

/** "09:00" for an hour of the day. */
export function hourLabel(hour: number): string {
  return `${String(hour).padStart(2, '0')}:00`;
}
