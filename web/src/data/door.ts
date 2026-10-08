import { supabase } from './client';
import type { DoorSaved } from '../door/calc';

export async function loadDoor(gymId: string): Promise<DoorSaved | null> {
  const { data, error } = await supabase.from('gym_access_settings').select('access_enabled, access_code, member_label, member_note').eq('gym_id', gymId).maybeSingle();
  if (error) throw error;
  return data ? { enabled: data.access_enabled, code: data.access_code, label: data.member_label, note: data.member_note } : null;
}

/** One settings row per gym (created on first save). Owners and admins only; the database refuses anyone else. */
export async function saveDoor(gymId: string, userId: string, v: DoorSaved): Promise<void> {
  const { error } = await supabase.from('gym_access_settings').upsert(
    { gym_id: gymId, access_enabled: v.enabled, access_code: v.code, member_label: v.label, member_note: v.note, updated_at: new Date().toISOString(), updated_by: userId },
    { onConflict: 'gym_id' },
  );
  if (error) throw error;
}
