import { supabase } from './client';
import type { Json } from './database.types';
import type { DbSet, StoredSet, Tracking } from '../train/calc';
import { candidatesFor, isBetter, pbKey, wonText, type PbCandidate, type StoredPb, type Won } from '../train/pb';

export interface AssignmentRow { id: string; title: string; source: string; status: string; scheduledFor: string | null; dueAt: string | null; snapshot: Json; focusTags: string[] }
export interface SessionRow { id: string; title: string; performedAt: string }
export interface LastTime { name: string; sets: StoredSet[] }

const OPEN = ['todo', 'in_progress'];

/** Workouts a coach (or the member) has lined up that are not finished. */
export async function listMyAssignments(userId: string, gymId: string): Promise<AssignmentRow[]> {
  const { data, error } = await supabase
    .from('workout_assignments')
    .select('id, title, source, status, scheduled_for, due_at, workout_snapshot, focus_tags')
    .eq('gym_id', gymId)
    .eq('member_user_id', userId)
    .in('status', OPEN)
    .order('due_at', { nullsFirst: false })
    .limit(30);
  if (error) throw error;
  return (data ?? []).map((r) => ({ id: r.id, title: r.title, source: r.source, status: r.status, scheduledFor: r.scheduled_for, dueAt: r.due_at, snapshot: r.workout_snapshot, focusTags: r.focus_tags }));
}

export async function getMyAssignment(userId: string, gymId: string, id: string): Promise<AssignmentRow | null> {
  const { data, error } = await supabase
    .from('workout_assignments')
    .select('id, title, source, status, scheduled_for, due_at, workout_snapshot, focus_tags')
    .eq('id', id)
    .eq('gym_id', gymId)
    .eq('member_user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data ? { id: data.id, title: data.title, source: data.source, status: data.status, scheduledFor: data.scheduled_for, dueAt: data.due_at, snapshot: data.workout_snapshot, focusTags: data.focus_tags } : null;
}

/** Best effort: say the member has opened it. A failure here never stops the workout. */
export async function markStarted(id: string): Promise<void> {
  await supabase.from('workout_assignments').update({ status: 'in_progress', started_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', id).eq('status', 'todo');
}

export async function listRecentSessions(userId: string, gymId: string): Promise<SessionRow[]> {
  const { data, error } = await supabase
    .from('workout_sessions')
    .select('id, title, performed_at')
    .eq('gym_id', gymId)
    .eq('user_id', userId)
    .order('performed_at', { ascending: false })
    .limit(8);
  if (error) throw error;
  return (data ?? []).map((r) => ({ id: r.id, title: r.title ?? 'Workout', performedAt: r.performed_at }));
}

/** The most recent numbers for each exercise name, from the member's last 60 logged exercises. */
export async function listLastTimes(userId: string, gymId: string): Promise<Map<string, LastTime>> {
  const { data, error } = await supabase
    .from('workout_entries')
    .select('exercise_name, created_at, workout_sets(set_number, weight_kg, reps, duration_seconds, distance_m, calories, side)')
    .eq('gym_id', gymId)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(60);
  if (error) throw error;
  const out = new Map<string, LastTime>();
  for (const e of data ?? []) {
    const key = e.exercise_name.trim().toLowerCase();
    if (out.has(key)) continue;
    const sets = [...(e.workout_sets ?? [])].sort((a, b) => a.set_number - b.set_number);
    out.set(key, { name: e.exercise_name, sets });
  }
  return out;
}

export interface ExerciseInput { name: string; tracking: Tracking; note: string | null; sets: DbSet[] }

/**
 * Save one exercise now: the workout (created the first time), the exercise and its sets, then any personal best it sets.
 * If the sets cannot be written the exercise is removed again, so nothing half-saved is left. A best that could not
 * be recorded does not fail the save; it is reported.
 */
export async function saveExercise(
  ctx: { gymId: string; userId: string; sessionId: string | null; title: string; position: number },
  e: ExerciseInput,
): Promise<{ sessionId: string; entryId: string; won: Won[]; pbError: string | null }> {
  const fail = (err: unknown): never => { throw new Error(err instanceof Error ? err.message : (err as { message?: string }).message ?? 'Could not save the exercise.', { cause: err }); };
  let sessionId = ctx.sessionId;
  if (!sessionId) {
    const s = await supabase.from('workout_sessions').insert({ gym_id: ctx.gymId, user_id: ctx.userId, title: ctx.title, performed_at: new Date().toISOString() }).select('id').single();
    if (s.error) fail(s.error);
    sessionId = s.data?.id ?? null;
  }
  if (!sessionId) return fail(new Error('Could not start the workout.'));
  const r = await supabase.from('workout_entries').insert({ session_id: sessionId, gym_id: ctx.gymId, user_id: ctx.userId, exercise_name: e.name, tracking_type: e.tracking, notes: e.note, position: ctx.position }).select('id').single();
  if (r.error || !r.data) return fail(r.error ?? new Error('Could not save the exercise.'));
  const entryId = r.data.id;
  const ins = await supabase.from('workout_sets').insert(e.sets.map((st, j) => ({ entry_id: entryId, set_number: j + 1, ...st })));
  if (ins.error) {
    await supabase.from('workout_entries').delete().eq('id', entryId);
    return fail(ins.error);
  }
  let won: Won[] = [];
  let pbError: string | null = null;
  try {
    won = await savePbs(ctx.userId, ctx.gymId, candidatesFor(e.name, e.tracking, e.sets), new Date().toISOString());
  } catch (err) {
    pbError = err instanceof Error ? err.message : (err as { message?: string }).message ?? 'unknown error';
  }
  return { sessionId, entryId, won, pbError };
}

/** Take a saved exercise back out (to change it). Personal bests it set are kept. */
export async function removeExercise(entryId: string): Promise<void> {
  const a = await supabase.from('workout_sets').delete().eq('entry_id', entryId);
  if (a.error) throw new Error(a.error.message);
  const b = await supabase.from('workout_entries').delete().eq('id', entryId);
  if (b.error) throw new Error(b.error.message);
}

/** Finish: name and note the workout, and mark the coach's workout done. Returns whether that was marked. */
export async function completeWorkout(input: { sessionId: string | null; title: string; notes: string | null; assignment: { id: string; rpe: number | null; note: string | null } | null }): Promise<{ marked: boolean }> {
  if (input.sessionId) {
    const u = await supabase.from('workout_sessions').update({ title: input.title, notes: input.notes, updated_at: new Date().toISOString() }).eq('id', input.sessionId);
    if (u.error) throw new Error(`Your exercises are saved, but the workout could not be finished: ${u.error.message}`);
  }
  let marked = false;
  if (input.assignment) {
    const u = await supabase.from('workout_assignments').update({ status: 'completed', completed_at: new Date().toISOString(), member_rpe: input.assignment.rpe, member_notes: input.assignment.note, updated_at: new Date().toISOString() }).eq('id', input.assignment.id);
    if (u.error) throw new Error(`Your workout is saved, but it could not be marked as done: ${u.error.message}`);
    marked = true;
  }
  return { marked };
}

/** All the member's personal bests in this gym, newest first. */
export async function listMyPbs(userId: string, gymId: string): Promise<StoredPb[]> {
  const { data, error } = await supabase
    .from('personal_bests')
    .select('id, exercise_name, metric_type, comparison_direction, value_numeric, unit, achieved_at, notes')
    .eq('gym_id', gymId)
    .eq('user_id', userId)
    .order('achieved_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r) => ({ id: r.id, name: r.exercise_name, metric: r.metric_type, dir: r.comparison_direction, value: Number(r.value_numeric), unit: r.unit ?? '', achievedAt: r.achieved_at, notes: r.notes }));
}

/**
 * Record any of these that beat what the member already has (the first of its kind always counts).
 * Two of the same kind in one list: only the better is considered.
 */
export async function savePbs(userId: string, gymId: string, candidates: PbCandidate[], achievedAt: string): Promise<Won[]> {
  const best = new Map<string, PbCandidate>();
  for (const c of candidates) {
    const k = `${pbKey(c.name)}|${c.metric}`;
    const o = best.get(k);
    if (!o || (c.dir === 'lower' ? c.value < o.value : c.value > o.value)) best.set(k, c);
  }
  if (best.size === 0) return [];
  const keys = [...new Set([...best.values()].map((c) => pbKey(c.name)))];
  const have = await supabase.from('personal_bests').select('exercise_key, metric_type, value_numeric, unit').eq('gym_id', gymId).eq('user_id', userId).in('exercise_key', keys);
  if (have.error) throw have.error;
  const old = new Map((have.data ?? []).map((r) => [`${r.exercise_key}|${r.metric_type}`, { metric: r.metric_type, unit: r.unit, value: Number(r.value_numeric) }]));
  const won: Won[] = [];
  for (const [k, c] of best) {
    const o = old.get(k);
    if (!isBetter(c, o)) continue;
    const row = { gym_id: gymId, user_id: userId, exercise_name: c.name, metric_type: c.metric, comparison_direction: c.dir, value_numeric: c.value, unit: c.unit, achieved_at: achievedAt };
    const r = await supabase.from('personal_bests').upsert(row, { onConflict: 'gym_id,user_id,exercise_key,metric_type' });
    if (r.error) throw r.error;
    won.push({ text: wonText(c), first: !o });
  }
  return won;
}

export async function deletePb(id: string): Promise<void> {
  const { error } = await supabase.from('personal_bests').delete().eq('id', id);
  if (error) throw error;
}
