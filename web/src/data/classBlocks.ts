import { supabase } from './client';
import { listTimetable, type TimetableSession } from './classes';
import { blockRange, blockWeek, gymDay } from '../classes/blocks';

export interface ClassBlock { id: string; name: string; startsOn: string; weeks: number }

const toBlock = (r: { id: string; name: string; starts_on: string; weeks: number }): ClassBlock => ({ id: r.id, name: r.name, startsOn: r.starts_on, weeks: r.weeks });

/** The gym's blocks, newest first. */
export async function listBlocks(gymId: string): Promise<ClassBlock[]> {
  const { data, error } = await supabase.from('class_blocks').select('id, name, starts_on, weeks').eq('gym_id', gymId).order('starts_on', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(toBlock);
}

export async function createBlock(gymId: string, userId: string, v: { name: string; startsOn: string; weeks: number }): Promise<string> {
  const { data, error } = await supabase.from('class_blocks').insert({ gym_id: gymId, name: v.name, starts_on: v.startsOn, weeks: v.weeks, created_by: userId }).select('id').single();
  if (error) throw error;
  return data.id;
}

export async function updateBlock(blockId: string, v: { name: string; startsOn: string; weeks: number }): Promise<void> {
  const { error } = await supabase.from('class_blocks').update({ name: v.name, starts_on: v.startsOn, weeks: v.weeks }).eq('id', blockId);
  if (error) throw error;
}

export async function deleteBlock(blockId: string): Promise<void> {
  const { error } = await supabase.from('class_blocks').delete().eq('id', blockId);
  if (error) throw error;
}

/** One class of a block with where its workout stands: none yet, a draft, or available to the class. */
export interface BlockClass { session: TimetableSession; inBlock: boolean; workout: 'none' | 'draft' | 'available'; workoutTitle: string | null }

/** Every class in the block's weeks, whether it is in the block, and the state of its workout. */
export async function loadBlockClasses(gymId: string, block: ClassBlock): Promise<BlockClass[]> {
  const { from, to } = blockRange(block.startsOn, block.weeks);
  const sessions = (await listTimetable(gymId, from, to)).filter((s) => !s.is_cancelled && blockWeek(block.startsOn, block.weeks, gymDay(s.starts_at)) !== null);
  if (sessions.length === 0) return [];
  const ids = sessions.map((s) => s.session_id);
  const [inBlock, workouts] = await Promise.all([
    supabase.from('class_block_sessions').select('session_id').eq('block_id', block.id).in('session_id', ids),
    supabase.from('class_session_workouts').select('session_id, title, published_at').in('session_id', ids),
  ]);
  if (inBlock.error) throw inBlock.error;
  if (workouts.error) throw workouts.error;
  const members = new Set((inBlock.data ?? []).map((r) => r.session_id));
  const byId = new Map((workouts.data ?? []).map((w) => [w.session_id, w]));
  return sessions.map((session) => {
    const w = byId.get(session.session_id);
    return { session, inBlock: members.has(session.session_id), workout: w ? (w.published_at ? 'available' : 'draft') : 'none', workoutTitle: w?.title ?? null };
  });
}

/** Put classes in the block and take others out, in one go each. */
export async function setBlockClasses(gymId: string, blockId: string, add: string[], remove: string[]): Promise<void> {
  if (remove.length > 0) {
    const { error } = await supabase.from('class_block_sessions').delete().eq('block_id', blockId).in('session_id', remove);
    if (error) throw error;
  }
  if (add.length > 0) {
    const { error } = await supabase.from('class_block_sessions').insert(add.map((session_id) => ({ session_id, block_id: blockId, gym_id: gymId })));
    if (error) throw error;
  }
}

/** The block a class is in (if any), for the label on the class. */
export async function getBlockOfClass(sessionId: string): Promise<ClassBlock | null> {
  const { data, error } = await supabase.from('class_block_sessions').select('class_blocks(id, name, starts_on, weeks)').eq('session_id', sessionId).maybeSingle();
  if (error) throw error;
  const b = data ? (Array.isArray(data.class_blocks) ? data.class_blocks[0] : data.class_blocks) : null;
  return b ? toBlock(b) : null;
}

/** For a set of classes, the block each is in. Used to label a member's class workouts. */
export async function getBlocksOfClasses(sessionIds: string[]): Promise<Map<string, ClassBlock>> {
  const out = new Map<string, ClassBlock>();
  if (sessionIds.length === 0) return out;
  const { data, error } = await supabase.from('class_block_sessions').select('session_id, class_blocks(id, name, starts_on, weeks)').in('session_id', sessionIds);
  if (error) throw error;
  for (const r of data ?? []) {
    const b = Array.isArray(r.class_blocks) ? r.class_blocks[0] : r.class_blocks;
    if (b) out.set(r.session_id, toBlock(b));
  }
  return out;
}
