import { supabase } from './client';
import { ROUNDS_MARK, SCORE_MARK, fromDbSet, hasPainFlag, readResult, resultSummary, setText, type ExerciseResult, type Tracking } from '../train/calc';

export interface WaitingWorkout { id: string; title: string; createdAt: string; status: string }
export interface Feedback { id: string; body: string; createdAt: string; authorId: string; authorName: string }

/** One workout in a client's history. `setByCoach` ones are the coach's; the rest are the client's own. */
export interface ClientWorkout {
  key: string;
  assignmentId: string | null;
  sessionId: string | null;
  setByCoach: boolean;
  setBy: string | null;
  title: string;
  at: string;
  rpe: number | null;
  note: string | null;
  result: ExerciseResult[];
  feedback: Feedback[];
}
export interface ClientTraining { waiting: WaitingWorkout[]; workouts: ClientWorkout[] }

export interface LoggedExercise { name: string; text: string }

const PROFILE_COLS = 'id, display_name, first_name, last_name';
type ProfileRow = { id: string; display_name: string | null; first_name: string | null; last_name: string | null };
const nameFrom = (p: ProfileRow | undefined): string => p?.display_name?.trim() || [p?.first_name, p?.last_name].filter(Boolean).join(' ').trim() || 'Someone';

export async function names(ids: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return new Map();
  const { data, error } = await supabase.from('profiles').select(PROFILE_COLS).in('id', unique);
  if (error) throw error;
  return new Map((data ?? []).map((p) => [p.id, nameFrom(p)]));
}

/** Everything about one client's training: what is waiting for them, and every workout they have done, theirs and the coach's. */
export async function loadClientTraining(gymId: string, memberUserId: string): Promise<ClientTraining> {
  const [a, s] = await Promise.all([
    supabase.from('workout_assignments').select('id, title, status, source, assigned_by, created_at, completed_at, member_rpe, member_notes, result').eq('gym_id', gymId).eq('member_user_id', memberUserId).order('created_at', { ascending: false }).limit(80),
    supabase.from('workout_sessions').select('id, title, performed_at, notes, assignment_id').eq('gym_id', gymId).eq('user_id', memberUserId).order('performed_at', { ascending: false }).limit(80),
  ]);
  if (a.error) throw a.error;
  if (s.error) throw s.error;
  const assignments = a.data ?? [];
  const ids = assignments.map((x) => x.id);
  const fb = ids.length ? await supabase.from('workout_assignment_feedback').select('id, assignment_id, author_id, body, created_at').in('assignment_id', ids).order('created_at') : { data: [], error: null };
  if (fb.error) throw fb.error;
  const who = await names([...assignments.flatMap((x) => (x.assigned_by ? [x.assigned_by] : [])), ...(fb.data ?? []).map((f) => f.author_id)]);
  const byId = new Map(assignments.map((x) => [x.id, x]));
  const replies = (assignmentId: string | null): Feedback[] => (assignmentId ? (fb.data ?? []).filter((f) => f.assignment_id === assignmentId).map((f) => ({ id: f.id, body: f.body, createdAt: f.created_at, authorId: f.author_id, authorName: who.get(f.author_id) ?? 'Coach' })) : []);

  const workouts: ClientWorkout[] = [];
  const linked = new Set<string>();
  for (const x of s.data ?? []) {
    const asg = x.assignment_id ? byId.get(x.assignment_id) : undefined;
    if (asg) linked.add(asg.id);
    workouts.push({
      key: `s${x.id}`, assignmentId: asg?.id ?? null, sessionId: x.id, setByCoach: asg?.source === 'pt', setBy: asg?.source === 'pt' && asg.assigned_by ? who.get(asg.assigned_by) ?? 'Coach' : null,
      title: asg?.title ?? x.title ?? 'Workout', at: x.performed_at, rpe: asg?.member_rpe == null ? null : Number(asg.member_rpe), note: asg?.member_notes ?? x.notes, result: asg ? readResult(asg.result) : [], feedback: replies(asg?.id ?? null),
    });
  }
  // A coach's workout finished without any numbers saved still belongs in the history.
  for (const x of assignments) {
    if (x.source !== 'pt' || x.status !== 'completed' || linked.has(x.id)) continue;
    workouts.push({ key: `a${x.id}`, assignmentId: x.id, sessionId: null, setByCoach: true, setBy: x.assigned_by ? who.get(x.assigned_by) ?? 'Coach' : null, title: x.title, at: x.completed_at ?? x.created_at, rpe: x.member_rpe == null ? null : Number(x.member_rpe), note: x.member_notes, result: readResult(x.result), feedback: replies(x.id) });
  }
  workouts.sort((p, q) => q.at.localeCompare(p.at));
  const waiting = assignments.filter((x) => x.source === 'pt' && (x.status === 'todo' || x.status === 'in_progress')).map((x) => ({ id: x.id, title: x.title, createdAt: x.created_at, status: x.status }));
  return { waiting, workouts };
}

/** The numbers a client logged in one workout, as short lines. */
export async function loadLoggedExercises(sessionId: string): Promise<LoggedExercise[]> {
  const e = await supabase.from('workout_entries').select('id, exercise_name, tracking_type, position').eq('session_id', sessionId).order('position');
  if (e.error) throw e.error;
  const entries = e.data ?? [];
  if (entries.length === 0) return [];
  const st = await supabase.from('workout_sets').select('entry_id, set_number, reps, weight_kg, duration_seconds, distance_m, calories, custom_value, custom_unit').in('entry_id', entries.map((x) => x.id)).order('set_number');
  if (st.error) throw st.error;
  return entries.map((x) => {
    const rows = (st.data ?? []).filter((r) => r.entry_id === x.id);
    // An exercise scored two ways was saved as "custom" with its sets marked; the mark is how it is told apart from other custom ones.
    const twoScores = x.tracking_type === 'custom' && rows.some((r) => r.custom_unit === SCORE_MARK || r.custom_unit === ROUNDS_MARK);
    const tracking = (twoScores ? 'scores' : ['strength', 'reps', 'time', 'distance', 'calories', 'intervals'].includes(x.tracking_type) ? x.tracking_type : 'strength') as Tracking;
    const text = rows.map((r) => setText(tracking, fromDbSet(tracking, r))).filter(Boolean).join(', ');
    return { name: x.exercise_name, text };
  });
}

export async function addFeedback(gymId: string, userId: string, assignmentId: string, body: string): Promise<string> {
  const { data, error } = await supabase.from('workout_assignment_feedback').insert({ gym_id: gymId, assignment_id: assignmentId, author_id: userId, body: body.trim() }).select('id').single();
  if (error) throw error;
  return data.id;
}

/** Take back a workout the client has not started. Anything started or finished stays. */
export async function removeWaiting(gymId: string, assignmentId: string): Promise<void> {
  const { error } = await supabase.from('workout_assignments').delete().eq('id', assignmentId).eq('gym_id', gymId).eq('source', 'pt').eq('status', 'todo');
  if (error) throw error;
}

export interface ReviewRow { assignmentId: string; memberUserId: string; memberName: string; title: string; completedAt: string; summary: string; pain: boolean }

/** Finished coach workouts nobody has replied to yet, newest first, across the gym. */
export async function loadNeedsFeedback(gymId: string): Promise<ReviewRow[]> {
  const a = await supabase.from('workout_assignments').select('id, member_user_id, title, completed_at, result').eq('gym_id', gymId).eq('source', 'pt').eq('status', 'completed').order('completed_at', { ascending: false }).limit(60);
  if (a.error) throw a.error;
  const rows = a.data ?? [];
  if (rows.length === 0) return [];
  const fb = await supabase.from('workout_assignment_feedback').select('assignment_id').in('assignment_id', rows.map((r) => r.id));
  if (fb.error) throw fb.error;
  const replied = new Set((fb.data ?? []).map((f) => f.assignment_id));
  const open = rows.filter((r) => !replied.has(r.id));
  const who = await names(open.map((r) => r.member_user_id));
  return open.map((r) => {
    const res = readResult(r.result);
    return { assignmentId: r.id, memberUserId: r.member_user_id, memberName: who.get(r.member_user_id) ?? 'Member', title: r.title, completedAt: r.completed_at ?? '', summary: resultSummary(res), pain: hasPainFlag(res) };
  });
}
