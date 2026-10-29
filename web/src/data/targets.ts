import { supabase } from './client';

export type TargetMetric = 'income_pence' | 'members_joined' | 'active_members' | 'classes_taught' | 'pt_sessions';

/** One saved goal. `userId` is empty for a goal for the whole gym. Income is in pence. */
export interface TargetRow { id: string; userId: string; metric: TargetMetric; value: number }

export async function listTargets(gymId: string): Promise<TargetRow[]> {
  const { data, error } = await supabase.from('gym_targets').select('id, user_id, metric, target_value').eq('gym_id', gymId);
  if (error) throw error;
  return (data ?? []).map((t) => ({ id: t.id, userId: t.user_id ?? '', metric: t.metric as TargetMetric, value: t.target_value }));
}

/** Saves a goal, or removes it when `value` is null. One goal per gym, person and measure. */
export async function saveTarget(gymId: string, userId: string, metric: TargetMetric, value: number | null, existingId?: string): Promise<void> {
  if (value === null) {
    if (!existingId) return;
    const { error } = await supabase.from('gym_targets').delete().eq('gym_id', gymId).eq('id', existingId);
    if (error) throw error;
    return;
  }
  if (existingId) {
    const { error } = await supabase.from('gym_targets').update({ target_value: value, updated_at: new Date().toISOString() }).eq('gym_id', gymId).eq('id', existingId);
    if (error) throw error;
    return;
  }
  const { error } = await supabase.from('gym_targets').insert({ gym_id: gymId, user_id: userId || null, metric, target_value: value });
  if (error) throw error;
}
