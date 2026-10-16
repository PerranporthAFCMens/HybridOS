import { supabase } from './client';
import { LEVELS, levelText, withLevelText, type Level, type MovementForm } from '../movements/calc';
import type { Json } from './database.types';

export interface Movement {
  id: string;
  name: string;
  videoUrl: string;
  cue: string;
  tracking: string;
  isActive: boolean;
  levels: Record<Level, string>;
}

/** The gym's movements with their level wording, A to Z. */
export async function loadMovements(gymId: string): Promise<Movement[]> {
  const [m, l] = await Promise.all([
    supabase.from('movements').select('id, name, video_url, cue, default_tracking, is_active').eq('gym_id', gymId).order('key'),
    supabase.from('movement_levels').select('movement_id, level, prescription').eq('gym_id', gymId),
  ]);
  if (m.error) throw m.error;
  if (l.error) throw l.error;
  const text = new Map<string, Record<Level, string>>();
  for (const r of l.data ?? []) {
    if (!(LEVELS as readonly string[]).includes(r.level)) continue;
    const cur = text.get(r.movement_id) ?? { rx: '', scaled: '', foundations: '' };
    cur[r.level as Level] = levelText(r.prescription);
    text.set(r.movement_id, cur);
  }
  return (m.data ?? []).map((r) => ({
    id: r.id, name: r.name, videoUrl: r.video_url ?? '', cue: r.cue ?? '', tracking: r.default_tracking, isActive: r.is_active,
    levels: text.get(r.id) ?? { rx: '', scaled: '', foundations: '' },
  }));
}

/** Add or change a movement and its three levels. An emptied level is removed; other saved parts of a level are kept. */
export async function saveMovement(gymId: string, id: string | null, f: MovementForm): Promise<void> {
  const row = { name: f.name.trim(), video_url: f.videoUrl.trim() || null, cue: f.cue.trim() || null, default_tracking: f.tracking };
  let movementId = id;
  if (id) {
    const { error } = await supabase.from('movements').update(row).eq('id', id).eq('gym_id', gymId);
    if (error) throw error;
  } else {
    const { data, error } = await supabase.from('movements').insert({ ...row, gym_id: gymId }).select('id').single();
    if (error) throw error;
    movementId = data.id;
  }
  if (!movementId) return;
  const { data: existing, error: eErr } = await supabase.from('movement_levels').select('level, prescription').eq('movement_id', movementId);
  if (eErr) throw eErr;
  const have = new Map((existing ?? []).map((r) => [r.level, r.prescription]));
  for (const level of LEVELS) {
    const text = f.levels[level].trim();
    if (text) {
      const { error } = await supabase.from('movement_levels').upsert({ movement_id: movementId, gym_id: gymId, level, prescription: withLevelText(have.get(level), text) as Json }, { onConflict: 'movement_id,level' });
      if (error) throw error;
    } else if (have.has(level)) {
      const { error } = await supabase.from('movement_levels').delete().eq('movement_id', movementId).eq('level', level);
      if (error) throw error;
    }
  }
}

export async function setMovementActive(gymId: string, id: string, isActive: boolean): Promise<void> {
  const { error } = await supabase.from('movements').update({ is_active: isActive }).eq('id', id).eq('gym_id', gymId);
  if (error) throw error;
}

/** Add the given names to the gym's list; any the gym already has (same name, ignoring case) are left alone. */
export async function addStarterMovements(gymId: string, items: { name: string; tracking: string }[]): Promise<void> {
  for (let i = 0; i < items.length; i += 100) {
    const chunk = items.slice(i, i + 100).map((x) => ({ gym_id: gymId, name: x.name, default_tracking: x.tracking }));
    const { error } = await supabase.from('movements').upsert(chunk, { onConflict: 'gym_id,key', ignoreDuplicates: true });
    if (error) throw error;
  }
}

