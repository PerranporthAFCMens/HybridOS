import { supabase } from './client';
import type { ResultRow } from '../train/benchmarkProgress';

/** The gym's switch for coaches seeing members' benchmark results. No row means off. */
export async function getCoachesSeeResults(gymId: string): Promise<boolean> {
  const { data, error } = await supabase.from('gym_benchmark_settings').select('coaches_see_results').eq('gym_id', gymId).maybeSingle();
  if (error) throw error;
  return data?.coaches_see_results ?? false;
}

export async function setCoachesSeeResults(gymId: string, on: boolean): Promise<void> {
  const { error } = await supabase.from('gym_benchmark_settings').upsert({ gym_id: gymId, coaches_see_results: on, updated_at: new Date().toISOString() }, { onConflict: 'gym_id' });
  if (error) throw error;
}

/** What the booked members of a block recorded in the test weeks. The database returns nothing unless the switch is on and the caller is on the team. */
export async function getBlockResultRows(blockId: string): Promise<ResultRow[]> {
  const { data, error } = await supabase.rpc('get_block_benchmark_results', { p_block_id: blockId });
  if (error) throw error;
  return data ?? [];
}
