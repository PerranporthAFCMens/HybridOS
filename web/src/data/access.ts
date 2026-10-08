import { supabase } from './client';
import { readPermissions, type Permissions } from '../access/calc';

export interface LevelRow { id: string; name: string; description: string | null; permissions: Permissions }
export interface StaffPerson { userId: string; name: string; role: string }

export interface AccessData {
  levels: LevelRow[];
  staff: StaffPerson[];
  /** userId -> level id */
  assigned: Map<string, string>;
}

/** The gym's access levels, its active staff and coaches, and which level each one has. */
export async function loadAccess(gymId: string): Promise<AccessData> {
  const [l, t, a] = await Promise.all([
    supabase.from('staff_access_levels').select('id, name, description, permissions').eq('gym_id', gymId).eq('is_active', true).order('name'),
    supabase.rpc('get_gym_team_accounts', { target_gym_id: gymId }),
    supabase.from('staff_access').select('user_id, access_level_id').eq('gym_id', gymId),
  ]);
  for (const r of [l, t, a]) if (r.error) throw r.error;
  return {
    levels: (l.data ?? []).map((v) => ({ id: v.id, name: v.name, description: v.description, permissions: readPermissions(v.permissions) })),
    staff: (t.data ?? [])
      .filter((m) => (m.role === 'staff' || m.role === 'coach') && m.is_active && m.access_status !== 'revoked')
      .map((m) => ({ userId: m.user_id, name: m.display_name || m.email || 'Team member', role: m.role }))
      .sort((x, y) => x.name.localeCompare(y.name)),
    assigned: new Map((a.data ?? []).filter((r) => r.access_level_id).map((r) => [r.user_id, r.access_level_id as string])),
  };
}

export interface LevelInput { name: string; description: string | null; permissions: Permissions }

/** Owners only (the database refuses anyone else). */
export async function saveLevel(gymId: string, id: string | null, userId: string, i: LevelInput): Promise<string> {
  if (id) {
    const { error } = await supabase.from('staff_access_levels').update({ name: i.name, description: i.description, permissions: i.permissions, updated_at: new Date().toISOString() }).eq('id', id).eq('gym_id', gymId);
    if (error) throw error;
    return id;
  }
  const { data, error } = await supabase.from('staff_access_levels').insert({ gym_id: gymId, name: i.name, description: i.description, permissions: i.permissions, created_by: userId }).select('id').single();
  if (error) throw error;
  return data.id;
}

export async function deleteLevel(gymId: string, id: string): Promise<void> {
  const { error } = await supabase.from('staff_access_levels').delete().eq('id', id).eq('gym_id', gymId);
  if (error) throw error;
}

export async function assignLevel(gymId: string, userId: string, levelId: string): Promise<void> {
  const { error } = await supabase.rpc('assign_staff_access_level', { target_gym_id: gymId, target_user_id: userId, target_level_id: levelId });
  if (error) throw error;
}
