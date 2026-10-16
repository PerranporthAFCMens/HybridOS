import { supabase } from './client';
import { isBetter, type Better } from '../classes/benchmarks';

export interface BlockBenchmark { id: string; blockId: string; movementId: string; movementName: string; tracking: string; startOn: string; endOn: string; better: Better }

/** The benchmarks of one block, in the order they were added. */
export async function listBlockBenchmarks(gymId: string, blockId: string): Promise<BlockBenchmark[]> {
  const { data, error } = await supabase
    .from('block_benchmarks')
    .select('id, block_id, movement_id, test_start_on, test_end_on, better, created_at, movements(name, default_tracking)')
    .eq('gym_id', gymId)
    .eq('block_id', blockId)
    .order('created_at');
  if (error) throw error;
  return (data ?? []).map((r) => {
    const m = Array.isArray(r.movements) ? r.movements[0] : r.movements;
    return { id: r.id, blockId: r.block_id, movementId: r.movement_id, movementName: m?.name ?? 'A movement', tracking: m?.default_tracking ?? 'strength', startOn: r.test_start_on, endOn: r.test_end_on, better: isBetter(r.better) ? r.better : 'higher' };
  });
}

export async function addBlockBenchmark(gymId: string, userId: string, blockId: string, v: { movementId: string; startOn: string; endOn: string; better: Better }): Promise<void> {
  const { error } = await supabase.from('block_benchmarks').insert({ gym_id: gymId, block_id: blockId, movement_id: v.movementId, test_start_on: v.startOn, test_end_on: v.endOn, better: v.better, created_by: userId });
  if (error) throw error;
}

export async function removeBlockBenchmark(id: string): Promise<void> {
  const { error } = await supabase.from('block_benchmarks').delete().eq('id', id);
  if (error) throw error;
}
