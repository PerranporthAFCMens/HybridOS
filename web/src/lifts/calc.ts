import { ACTIVITIES, guessTracking } from '../train/activities';
import { pbKey } from '../train/pb';

/** The usual big lifts, offered as a one-tap start. The gym can tick or untick any of them afterwards. */
export const STARTER_LIFTS = ['Back Squat', 'Front Squat', 'Deadlift', 'Bench Press', 'Overhead Press'];

/** Every exercise in the list that is measured in weight: these are the ones that can have a leaderboard. */
export const WEIGHT_EXERCISES: string[] = ACTIVITIES.filter((n) => guessTracking(n) === 'strength');

export interface LiftRow { key: string; name: string; ticked: boolean }

/** The list to show: ticked ones first, then the rest, narrowed by what was typed. A ticked exercise that is not in the list (added by hand) still shows. */
export function liftRows(ticked: { key: string; name: string }[], query: string): LiftRow[] {
  const tickedKeys = new Set(ticked.map((t) => t.key));
  const q = query.trim().toLowerCase();
  const all: LiftRow[] = [
    ...ticked.map((t) => ({ key: t.key, name: t.name, ticked: true })),
    ...WEIGHT_EXERCISES.filter((n) => !tickedKeys.has(pbKey(n))).map((n) => ({ key: pbKey(n), name: n, ticked: false })),
  ];
  return all.filter((r) => !q || r.name.toLowerCase().includes(q)).sort((a, b) => Number(b.ticked) - Number(a.ticked) || a.name.localeCompare(b.name));
}

/** A name typed by hand: it must be something, and not a repeat. */
export function validateLiftName(name: string, ticked: { key: string }[]): string | null {
  const n = name.trim();
  if (!n) return 'Type the name of the exercise.';
  if (n.length > 120) return 'Keep the name under 120 characters.';
  if (ticked.some((t) => t.key === pbKey(n))) return 'That one is already ticked.';
  return null;
}

/** What the gym's switch means, in words, for the admin and the member. */
export function defaultText(showByDefault: boolean): string {
  return showByDefault
    ? 'Everyone is on the leaderboards until they opt out.'
    : 'Nobody is on the leaderboards until they opt in.';
}

/** A member's setting in words: their own choice if they made one, otherwise what the gym's switch says. */
export function choiceText(choice: boolean | null, showByDefault: boolean): string {
  if (choice === true) return 'You chose to be shown.';
  if (choice === false) return 'You chose to be hidden.';
  return showByDefault ? 'You are shown, because that is how the gym has it set. You can hide yourself.' : 'You are hidden, because that is how the gym has it set. You can choose to be shown.';
}

/** Whether a member is currently on the boards. */
export function effectiveShow(choice: boolean | null, showByDefault: boolean): boolean {
  return choice ?? showByDefault;
}
