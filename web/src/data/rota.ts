import { supabase } from './client';
import type { BlockRow, ClosedRow } from '../rota/calc';

export interface RotaData { blocks: BlockRow[]; closed: ClosedRow[] }

/** Time off and closed days that touch a window of days: from (first day, inclusive) to the day after the last. */
export async function loadRota(gymId: string, fromIso: string, toIso: string, firstDay: string, lastDay: string): Promise<RotaData> {
  const [blocks, closed] = await Promise.all([
    supabase.from('staff_time_blocks').select('id, user_id, starts_at, ends_at, kind, reason').eq('gym_id', gymId).lt('starts_at', toIso).gt('ends_at', fromIso).order('starts_at'),
    supabase.from('gym_closed_days').select('id, closed_on, reason').eq('gym_id', gymId).gte('closed_on', firstDay).lte('closed_on', lastDay).order('closed_on'),
  ]);
  if (blocks.error) throw blocks.error;
  if (closed.error) throw closed.error;
  return {
    blocks: (blocks.data ?? []).map((b) => ({ id: b.id, userId: b.user_id, startsAt: b.starts_at, endsAt: b.ends_at, kind: b.kind, reason: b.reason })),
    closed: (closed.data ?? []).map((c) => ({ id: c.id, closedOn: c.closed_on, reason: c.reason })),
  };
}

export interface NewBlock { userId: string; startsAt: string; endsAt: string; kind: string; reason: string | null }

export async function addBlock(gymId: string, b: NewBlock): Promise<void> {
  const { error } = await supabase.from('staff_time_blocks').insert({ gym_id: gymId, user_id: b.userId, starts_at: b.startsAt, ends_at: b.endsAt, kind: b.kind, reason: b.reason });
  if (error) throw error;
}

export async function removeBlock(gymId: string, id: string): Promise<void> {
  const { error } = await supabase.from('staff_time_blocks').delete().eq('gym_id', gymId).eq('id', id);
  if (error) throw error;
}

export async function addClosedDay(gymId: string, day: string, reason: string | null): Promise<void> {
  const { error } = await supabase.from('gym_closed_days').insert({ gym_id: gymId, closed_on: day, reason });
  if (error) throw error;
}

export async function removeClosedDay(gymId: string, id: string): Promise<void> {
  const { error } = await supabase.from('gym_closed_days').delete().eq('gym_id', gymId).eq('id', id);
  if (error) throw error;
}
