// Pure rules behind the Workout builder: what a workout is made of, what a valid one looks like, and the
// snapshot that is copied to a member when a coach assigns it. Same fields and limits as the old page.
import { londonInstant } from '../classes/calc';

export const BLOCK_TYPES = ['warmup', 'standard', 'strength', 'circuit', 'amrap', 'emom', 'for_time', 'intervals', 'finisher', 'cooldown', 'custom'] as const;
export const TRACKING = ['strength', 'reps', 'time', 'distance', 'calories', 'intervals', 'instruction'] as const;
export const WORKOUT_TYPES = ['strength', 'cardio', 'conditioning', 'hybrid', 'mobility', 'recovery', 'custom'] as const;

export const blockLabel = (t: string) => (t === 'for_time' ? 'For time' : t === 'amrap' ? 'AMRAP' : t === 'emom' ? 'EMOM' : t.charAt(0).toUpperCase() + t.slice(1));
export const trackingLabel = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

export interface ActivityForm { key: string; id: string | null; name: string; tracking: string; prescription: string; notes: string; activityType: string; extra: Record<string, unknown> }
export interface BlockForm { key: string; id: string | null; title: string; blockType: string; rounds: string; instructions: string; activities: ActivityForm[] }
export interface WorkoutForm { title: string; type: string; tags: string; minutes: string; description: string; visibility: 'private' | 'gym' }

export const emptyWorkout: WorkoutForm = { title: '', type: 'strength', tags: '', minutes: '45', description: '', visibility: 'private' };

let counter = 0;
const nextKey = () => `k${++counter}`;

export const newActivity = (): ActivityForm => ({ key: nextKey(), id: null, name: '', tracking: 'strength', prescription: '', notes: '', activityType: 'exercise', extra: {} });
export const newBlock = (): BlockForm => ({ key: nextKey(), id: null, title: 'Strength', blockType: 'strength', rounds: '', instructions: '', activities: [] });

export const parseTags = (text: string): string[] => [...new Set(text.split(',').map((x) => x.trim()).filter(Boolean))];

/** The words shown for a prescription; any other keys saved with it are kept when the workout is saved again. */
export function readPrescription(raw: unknown): { display: string; extra: Record<string, unknown> } {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const { display, ...extra } = raw as Record<string, unknown>;
    return { display: typeof display === 'string' ? display : '', extra };
  }
  return { display: '', extra: {} };
}

export function moveItem<T>(list: T[], index: number, by: -1 | 1): T[] {
  const j = index + by;
  if (index < 0 || j < 0 || j >= list.length) return list;
  const next = list.slice();
  const a = next[index];
  const b = next[j];
  if (a === undefined || b === undefined) return list;
  next[index] = b;
  next[j] = a;
  return next;
}

export interface WorkoutInput { title: string; description: string | null; workoutType: string; focusTags: string[]; estimatedMinutes: number | null; visibility: string }
export interface ActivityInput { name: string; activityType: string; tracking: string; prescription: Record<string, unknown>; notes: string | null }
export interface BlockInput { title: string; blockType: string; rounds: number | null; instructions: string | null; activities: ActivityInput[] }
export type WorkoutCheck = { ok: true; input: WorkoutInput; blocks: BlockInput[] } | { ok: false; message: string };

export function validateWorkout(f: WorkoutForm, blocks: BlockForm[]): WorkoutCheck {
  const title = f.title.trim();
  if (!title) return { ok: false, message: 'Enter a workout name.' };
  if (title.length > 120) return { ok: false, message: 'The workout name can be up to 120 characters.' };
  if (!WORKOUT_TYPES.includes(f.type as (typeof WORKOUT_TYPES)[number])) return { ok: false, message: 'Choose a workout type.' };
  let minutes: number | null = null;
  if (f.minutes.trim() !== '') {
    minutes = Number(f.minutes);
    if (!Number.isInteger(minutes) || minutes < 1 || minutes > 600) return { ok: false, message: 'Estimated minutes must be a whole number from 1 to 600, or blank.' };
  }
  const tags = parseTags(f.tags);
  if (tags.length > 12 || tags.some((t) => t.length > 40)) return { ok: false, message: 'Use up to 12 focus tags of up to 40 characters each.' };
  if (f.description.trim().length > 2000) return { ok: false, message: 'The description can be up to 2000 characters.' };
  if (blocks.length === 0) return { ok: false, message: 'Add at least one workout block.' };
  const out: BlockInput[] = [];
  for (const [bi, b] of blocks.entries()) {
    if (b.activities.length === 0 || b.activities.some((a) => !a.name.trim())) return { ok: false, message: 'Every block needs at least one named activity.' };
    let rounds: number | null = null;
    if (b.rounds.trim() !== '') {
      rounds = Number(b.rounds);
      if (!Number.isInteger(rounds) || rounds < 1 || rounds > 999) return { ok: false, message: `Rounds in block ${bi + 1} must be a whole number of 1 or more, or blank.` };
    }
    if (!BLOCK_TYPES.includes(b.blockType as (typeof BLOCK_TYPES)[number])) return { ok: false, message: `Choose a format for block ${bi + 1}.` };
    out.push({
      title: b.title.trim() || `Block ${bi + 1}`,
      blockType: b.blockType,
      rounds,
      instructions: b.instructions.trim() || null,
      activities: b.activities.map((a) => ({
        name: a.name.trim(), activityType: a.activityType || 'exercise', tracking: a.tracking,
        prescription: { ...a.extra, display: a.prescription.trim() }, notes: a.notes.trim() || null,
      })),
    });
  }
  return { ok: true, input: { title, description: f.description.trim() || null, workoutType: f.type, focusTags: tags, estimatedMinutes: minutes, visibility: f.visibility }, blocks: out };
}

/** End of the chosen day at the gym (UK time), or nothing. */
export function dueAt(date: string): string | null {
  if (!date.trim()) return null;
  const d = londonInstant(date, '23:59');
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export const hasChanged = (a: unknown, b: unknown) => JSON.stringify(a) !== JSON.stringify(b);

export interface SnapshotBlock { id: string; title: string; block_type: string; position: number; rounds: number | null; instructions: string | null; activities: { block_id: string; activity_name: string; activity_type: string; tracking_type: string; position: number; prescription: unknown; notes: string | null }[] }

/** The copy stored with an assignment, so later edits to the workout never change what a member was given. */
export function buildSnapshot(t: { id: string; title: string; description: string | null; workoutType: string; focusTags: string[]; estimatedMinutes: number | null }, blocks: SnapshotBlock[]) {
  return { template_id: t.id, title: t.title, description: t.description, workout_type: t.workoutType, focus_tags: t.focusTags, estimated_minutes: t.estimatedMinutes, blocks };
}

export function validateWodDate(date: string): string | null {
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? null : 'Choose the date for the workout of the day.';
}
