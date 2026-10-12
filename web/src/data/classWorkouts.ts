import { supabase } from './client';
import { snapshotForTemplate, type TemplateRow } from './workouts';
import type { Json } from './database.types';

/** The workout on one class. It stays a draft until the coach makes it available to the people in that class. */
export interface ClassWorkout { sessionId: string; title: string; templateId: string | null; snapshot: Json; availableAt: string | null }

export async function getClassWorkout(sessionId: string): Promise<ClassWorkout | null> {
  const { data, error } = await supabase.from('class_session_workouts').select('session_id, title, template_id, workout_snapshot, published_at').eq('session_id', sessionId).maybeSingle();
  if (error) throw error;
  return data ? { sessionId: data.session_id, title: data.title, templateId: data.template_id, snapshot: data.workout_snapshot, availableAt: data.published_at } : null;
}

/** Put a saved workout on a class (a copy, so later edits to the library never change the class). Replacing keeps it as available or draft as it was. */
export async function setClassWorkout(gymId: string, userId: string, sessionId: string, t: TemplateRow): Promise<void> {
  const snapshot = await snapshotForTemplate(t);
  const { error } = await supabase.from('class_session_workouts').upsert(
    { session_id: sessionId, gym_id: gymId, template_id: t.id, title: t.title, workout_snapshot: JSON.parse(JSON.stringify(snapshot)) as Json, created_by: userId, updated_at: new Date().toISOString() },
    { onConflict: 'session_id' },
  );
  if (error) throw error;
}

/** Make it available to the people in the class, or take it back. */
export async function setClassWorkoutAvailable(sessionId: string, userId: string, available: boolean): Promise<void> {
  const { error } = await supabase.from('class_session_workouts').update(available ? { published_at: new Date().toISOString(), published_by: userId, updated_at: new Date().toISOString() } : { published_at: null, updated_at: new Date().toISOString() }).eq('session_id', sessionId);
  if (error) throw error;
}

export async function removeClassWorkout(sessionId: string): Promise<void> {
  const { error } = await supabase.from('class_session_workouts').delete().eq('session_id', sessionId);
  if (error) throw error;
}

/** What a member sees: a workout from a class they are in, with the class's name and time, and whether they have recorded it. */
export interface MyClassWorkout { sessionId: string; title: string; className: string; startsAt: string; snapshot: Json; done: boolean }

const FORTNIGHT_MS = 14 * 24 * 60 * 60 * 1000;

/** Available class workouts for classes in the last two weeks and the next two, newest class first. Row rules decide which the member may see. */
export async function listMyClassWorkouts(userId: string, gymId: string): Promise<MyClassWorkout[]> {
  const { data, error } = await supabase
    .from('class_session_workouts')
    .select('session_id, title, workout_snapshot, class_sessions(name, starts_at)')
    .eq('gym_id', gymId)
    .not('published_at', 'is', null);
  if (error) throw error;
  const now = Date.now();
  const rows = (data ?? []).flatMap((r) => {
    const c = Array.isArray(r.class_sessions) ? r.class_sessions[0] : r.class_sessions;
    if (!c) return [];
    const t = new Date(c.starts_at).getTime();
    return Math.abs(t - now) <= FORTNIGHT_MS ? [{ sessionId: r.session_id, title: r.title, className: c.name, startsAt: c.starts_at, snapshot: r.workout_snapshot }] : [];
  });
  if (rows.length === 0) return [];
  const { data: logged, error: lErr } = await supabase.from('workout_sessions').select('class_session_id').eq('user_id', userId).in('class_session_id', rows.map((r) => r.sessionId));
  if (lErr) throw lErr;
  const done = new Set((logged ?? []).map((l) => l.class_session_id));
  return rows.map((r) => ({ ...r, done: done.has(r.sessionId) })).sort((a, b) => b.startsAt.localeCompare(a.startsAt));
}

export async function getMyClassWorkout(userId: string, gymId: string, sessionId: string): Promise<MyClassWorkout | null> {
  const { data, error } = await supabase
    .from('class_session_workouts')
    .select('session_id, title, workout_snapshot, class_sessions(name, starts_at)')
    .eq('gym_id', gymId)
    .eq('session_id', sessionId)
    .not('published_at', 'is', null)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const c = Array.isArray(data.class_sessions) ? data.class_sessions[0] : data.class_sessions;
  const { data: logged, error: lErr } = await supabase.from('workout_sessions').select('id').eq('user_id', userId).eq('class_session_id', sessionId).limit(1);
  if (lErr) throw lErr;
  return { sessionId: data.session_id, title: data.title, className: c?.name ?? data.title, startsAt: c?.starts_at ?? '', snapshot: data.workout_snapshot, done: (logged ?? []).length > 0 };
}
