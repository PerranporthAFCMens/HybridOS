// Pure rules behind the Workout builder: what a workout is made of, what a valid one looks like, and the
// snapshot that is copied to a member when a coach assigns it. A coach sees a name and a list of exercises with their
// set boxes; the blocks, type, tags and minutes underneath are kept for workouts that already have them.
import { FIELDS, blankSets, describeTarget, readTarget, toDbSet, type SetValues, type Tracking } from '../train/calc';
import { guessTracking } from '../train/activities';
import { isPercent, percentError } from '../train/percent';

export const BLOCK_TYPES = ['warmup', 'standard', 'strength', 'circuit', 'amrap', 'emom', 'for_time', 'intervals', 'finisher', 'cooldown', 'custom'] as const;
export const TRACKING = ['strength', 'reps', 'time', 'distance', 'calories', 'intervals', 'instruction'] as const;
export const WORKOUT_TYPES = ['strength', 'cardio', 'conditioning', 'hybrid', 'mobility', 'recovery', 'custom'] as const;

export const blockLabel = (t: string) => (t === 'for_time' ? 'For time' : t === 'amrap' ? 'AMRAP' : t === 'emom' ? 'EMOM' : t.charAt(0).toUpperCase() + t.slice(1));
export const trackingLabel = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

/** `prescription` is only the earlier free-text wording, kept until the coach enters sets. */
export interface ActivityForm { key: string; id: string | null; name: string; tracking: string; prescription: string; sets: SetValues[]; notes: string; activityType: string; extra: Record<string, unknown> }
export interface BlockForm { key: string; id: string | null; title: string; blockType: string; rounds: string; instructions: string; activities: ActivityForm[] }
export interface WorkoutForm { title: string; type: string; tags: string; minutes: string; description: string; visibility: 'private' | 'gym' }

export const emptyWorkout: WorkoutForm = { title: '', type: 'custom', tags: '', minutes: '', description: '', visibility: 'private' };

let counter = 0;
const nextKey = () => `k${++counter}`;

export const newActivity = (): ActivityForm => ({ key: nextKey(), id: null, name: '', tracking: 'strength', prescription: '', sets: blankSets('strength', 1), notes: '', activityType: 'exercise', extra: {} });
export const newBlock = (): BlockForm => ({ key: nextKey(), id: null, title: 'Workout', blockType: 'standard', rounds: '', instructions: '', activities: [] });

export const parseTags = (text: string): string[] => [...new Set(text.split(',').map((x) => x.trim()).filter(Boolean))];

/** The words and the set boxes saved with a prescription; any other keys are kept when the workout is saved again. */
export function readPrescription(raw: unknown): { display: string; sets: SetValues[]; extra: Record<string, unknown> } {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const { display, sets, ...extra } = raw as Record<string, unknown>;
    return { display: typeof display === 'string' ? display : '', sets: readTarget(sets), extra };
  }
  return { display: '', sets: [], extra: {} };
}

/** Add an exercise to a workout: it joins the last block, starting one if there is none. */
export function addExercise(blocks: BlockForm[], name: string): BlockForm[] {
  const tracking = guessTracking(name);
  const act = { ...newActivity(), name, tracking, sets: blankSets(tracking, 1) };
  const last = blocks[blocks.length - 1];
  if (!last) return [{ ...newBlock(), activities: [act] }];
  return blocks.map((b, i) => (i === blocks.length - 1 ? { ...b, activities: [...b.activities, act] } : b));
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
  const used = blocks.filter((b) => b.activities.length > 0);
  if (used.length === 0) return { ok: false, message: 'Add at least one exercise.' };
  const out: BlockInput[] = [];
  for (const [bi, b] of used.entries()) {
    if (b.activities.some((a) => !a.name.trim())) return { ok: false, message: 'Every exercise needs a name.' };
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
      activities: [],
    });
    const target = out[out.length - 1];
    for (const a of b.activities) {
      const name = a.name.trim();
      const kept = cleanSets(a.tracking, a.sets);
      for (const row of kept) {
        // A weight typed as a percentage is checked as one; the rest of the row is checked as numbers as usual.
        const { weight, ...rest } = row;
        if (isPercent(weight)) {
          const bad = percentError(weight ?? '');
          if (bad) return { ok: false, message: `${name}: ${bad}` };
        }
        const r = toDbSet(asTracking(a.tracking), isPercent(weight) ? rest : row);
        if (r.error) return { ok: false, message: `${name}: ${r.error}` };
      }
      const display = kept.length ? describeTarget(asTracking(a.tracking), kept) : a.prescription.trim();
      target?.activities.push({
        name, activityType: a.activityType || 'exercise', tracking: a.tracking,
        prescription: { ...a.extra, display, ...(kept.length ? { sets: kept } : {}) }, notes: a.notes.trim() || null,
      });
    }
  }
  return { ok: true, input: { title, description: f.description.trim() || null, workoutType: f.type, focusTags: tags, estimatedMinutes: minutes, visibility: f.visibility }, blocks: out };
}

const TRACKINGS: readonly string[] = ['strength', 'reps', 'time', 'distance', 'calories', 'intervals', 'instruction'];
const asTracking = (t: string): Tracking => (TRACKINGS.includes(t) ? (t as Tracking) : 'strength');

/** The set rows a coach filled in, keeping only the boxes that kind of exercise uses. Blank rows are dropped. */
export function cleanSets(tracking: string, sets: SetValues[]): SetValues[] {
  const ids = FIELDS[asTracking(tracking)].map((f) => f.id);
  const out: SetValues[] = [];
  for (const row of sets) {
    const kept: SetValues = {};
    for (const id of ids) {
      const v = (row[id] ?? '').trim();
      if (v) kept[id] = v;
    }
    if (Object.keys(kept).length) out.push(kept);
  }
  return out;
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
