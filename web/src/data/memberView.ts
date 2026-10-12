import { supabase } from './client';
import { normaliseCta, normaliseLayout, type Cta, type TileSetting } from '../memberview/calc';

export interface MemberViewSaved { layout: TileSetting[]; cta: Cta }

export async function loadMemberView(gymId: string): Promise<MemberViewSaved> {
  const { data, error } = await supabase.from('gym_member_view_settings').select('home_layout, cta_config').eq('gym_id', gymId).maybeSingle();
  if (error) throw error;
  return { layout: normaliseLayout(data?.home_layout), cta: normaliseCta(data?.cta_config) };
}

/** One settings row per gym (created on first save). Owners and admins only; the database refuses anyone else. */
export async function saveMemberView(gymId: string, userId: string, v: MemberViewSaved): Promise<void> {
  const { error } = await supabase.from('gym_member_view_settings').upsert(
    { gym_id: gymId, home_layout: v.layout.map((t) => ({ key: t.key, visible: t.visible })), cta_config: { ...v.cta }, updated_at: new Date().toISOString(), updated_by: userId },
    { onConflict: 'gym_id' },
  );
  if (error) throw error;
  // The old member preview page reads these two keys, so keep them in step until it moves.
  try {
    localStorage.setItem('hybrid_member_home_layout_preview', JSON.stringify(v.layout));
    localStorage.setItem('hybrid_member_cta_preview', JSON.stringify(v.cta));
  } catch {
    /* preview copy is optional */
  }
}

/** What a member sees: the gym's tile order and promo panel, through the function members are allowed to call. Falls back to the defaults if the gym has set nothing. */
export async function loadMyHomeSettings(gymId: string): Promise<MemberViewSaved> {
  const { data, error } = await supabase.rpc('get_member_home_settings', { p_gym_id: gymId });
  if (error) throw error;
  const d = data && typeof data === 'object' && !Array.isArray(data) ? (data as Record<string, unknown>) : {};
  return { layout: normaliseLayout(d.home_layout), cta: normaliseCta(d.cta_config) };
}
