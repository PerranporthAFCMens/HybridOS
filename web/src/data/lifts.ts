import { supabase } from './client';
import { pbKey } from '../train/pb';

export interface TrackedLift { key: string; name: string }
export interface BoardRow { rank: number; name: string; kg: number; isMe: boolean }

/** The exercises the gym has ticked: they get a leaderboard. A row is a tick. */
export async function listTrackedLifts(gymId: string): Promise<TrackedLift[]> {
  const { data, error } = await supabase.from('tracked_lifts').select('exercise_key, exercise_name').eq('gym_id', gymId).order('exercise_name');
  if (error) throw error;
  return (data ?? []).map((r) => ({ key: r.exercise_key, name: r.exercise_name }));
}

export async function setLiftTracked(gymId: string, name: string, on: boolean): Promise<void> {
  const key = pbKey(name);
  const { error } = on
    ? await supabase.from('tracked_lifts').upsert({ gym_id: gymId, exercise_key: key, exercise_name: name.trim() }, { onConflict: 'gym_id,exercise_key' })
    : await supabase.from('tracked_lifts').delete().eq('gym_id', gymId).eq('exercise_key', key);
  if (error) throw error;
}

/** The gym's one switch: true (the default) = people are on the leaderboard until they opt out; false = only if they opt in. */
export async function getShowByDefault(gymId: string): Promise<boolean> {
  const { data, error } = await supabase.from('gym_lift_settings').select('show_by_default').eq('gym_id', gymId).maybeSingle();
  if (error) throw error;
  return data?.show_by_default ?? true;
}

export async function setShowByDefault(gymId: string, on: boolean): Promise<void> {
  const { error } = await supabase.from('gym_lift_settings').upsert({ gym_id: gymId, show_by_default: on, updated_at: new Date().toISOString() }, { onConflict: 'gym_id' });
  if (error) throw error;
}

/** A member's own choice: true, false, or null when they have not chosen (the gym's switch decides). */
export async function getMyLiftChoice(gymId: string, userId: string): Promise<boolean | null> {
  const { data, error } = await supabase.from('member_lift_choice').select('show').eq('gym_id', gymId).eq('user_id', userId).maybeSingle();
  if (error) throw error;
  return data?.show ?? null;
}

export async function setMyLiftChoice(gymId: string, userId: string, show: boolean): Promise<void> {
  const { error } = await supabase.from('member_lift_choice').upsert({ gym_id: gymId, user_id: userId, show, updated_at: new Date().toISOString() }, { onConflict: 'gym_id,user_id' });
  if (error) throw error;
}

export async function getLiftLeaderboard(gymId: string, key: string): Promise<BoardRow[]> {
  const { data, error } = await supabase.rpc('get_lift_leaderboard', { p_gym_id: gymId, p_exercise_key: key });
  if (error) throw error;
  return (data ?? []).map((r) => ({ rank: r.rank, name: r.display_name, kg: Number(r.value), isMe: r.is_me }));
}
