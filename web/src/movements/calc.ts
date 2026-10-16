// Pure rules for the movement library: what a valid movement looks like, which of the standard names are still missing from
// a gym's list, and how a level's wording is kept.
import { guessTracking } from '../train/activities';

export const LEVELS = ['rx', 'scaled', 'foundations'] as const;
export type Level = (typeof LEVELS)[number];
export const LEVEL_LABEL: Record<Level, string> = { rx: 'Rx', scaled: 'Scaled', foundations: 'Foundations' };

export const MOVEMENT_TRACKING = [['strength', 'Weight and reps'], ['reps', 'Reps'], ['time', 'Time'], ['distance', 'Distance'], ['calories', 'Calories'], ['intervals', 'Intervals'], ['instruction', 'Instruction only']] as const;

export interface MovementForm { name: string; videoUrl: string; cue: string; tracking: string; levels: Record<Level, string> }
export const emptyMovement = (): MovementForm => ({ name: '', videoUrl: '', cue: '', tracking: 'strength', levels: { rx: '', scaled: '', foundations: '' } });

/** The same key the database uses to tell movements apart: lower case, spaces trimmed. */
export const movementKey = (name: string) => name.trim().toLowerCase();

/** What is wrong with a movement as typed, or '' when it can be saved. `others` are the keys of the gym's other movements. */
export function validateMovement(f: MovementForm, others: string[]): string {
  const name = f.name.trim();
  if (!name) return 'Give the movement a name.';
  if (name.length > 120) return 'Keep the name under 120 characters.';
  if (others.includes(movementKey(name))) return 'That movement is already in your list.';
  const url = f.videoUrl.trim();
  if (url && !/^https:\/\/\S+$/i.test(url)) return 'A video link must start with https://.';
  if (url.length > 500) return 'That video link is too long.';
  if (f.cue.trim().length > 500) return 'Keep the cue under 500 characters.';
  for (const l of LEVELS) if (f.levels[l].trim().length > 200) return `Keep the ${LEVEL_LABEL[l]} wording under 200 characters.`;
  return '';
}

/** The standard names this gym does not have yet, each with the way it is usually tracked. */
export function missingStarters(have: string[], standard: string[]): { name: string; tracking: string }[] {
  const keys = new Set(have.map(movementKey));
  return standard.filter((n) => !keys.has(movementKey(n))).map((name) => ({ name, tracking: guessTracking(name) }));
}

/** The words saved for a level: the `display` text of its prescription. */
export function levelText(prescription: unknown): string {
  if (prescription && typeof prescription === 'object' && !Array.isArray(prescription)) {
    const d = (prescription as Record<string, unknown>).display;
    return typeof d === 'string' ? d : '';
  }
  return '';
}

/** A level's prescription with new wording, keeping anything else already saved with it (like set targets). */
export function withLevelText(prescription: unknown, text: string): Record<string, unknown> {
  const base = prescription && typeof prescription === 'object' && !Array.isArray(prescription) ? { ...(prescription as Record<string, unknown>) } : {};
  base.display = text.trim();
  return base;
}
