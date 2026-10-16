// What the member app shows from the gym's movement list beside an exercise: the coaching cue, the video, and the wording for
// the member's chosen level. Pure; the Player does the loading and the remembering.
import type { Movement } from '../data/movements';
import { LEVELS, LEVEL_LABEL, movementKey, type Level } from '../movements/calc';

export interface MovementHelp { cue: string; videoUrl: string; levelText: string }

export const isLevel = (v: unknown): v is Level => typeof v === 'string' && (LEVELS as readonly string[]).includes(v);

/** The gym's switched-on movements by key (lower case, trimmed), the way the database tells them apart. */
export function movementIndex(list: Movement[]): Map<string, Movement> {
  return new Map(list.filter((m) => m.isActive).map((m) => [movementKey(m.name), m]));
}

/** Help for one exercise name at one level, or null when the gym's list has nothing to show for it. */
export function helpFor(index: Map<string, Movement>, name: string, level: Level | null): MovementHelp | null {
  const m = index.get(movementKey(name));
  if (!m) return null;
  const levelText = level ? m.levels[level] : '';
  if (!m.cue && !m.videoUrl && !levelText) return null;
  return { cue: m.cue, videoUrl: m.videoUrl, levelText };
}

/** Does any exercise have wording for any level? Then the level choice is worth showing. */
export function anyLevels(index: Map<string, Movement>, names: string[]): boolean {
  return names.some((n) => { const m = index.get(movementKey(n)); return !!m && LEVELS.some((l) => m.levels[l]); });
}

export const levelLabel = (l: Level) => LEVEL_LABEL[l];
