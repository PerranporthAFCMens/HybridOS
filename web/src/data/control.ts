import { supabase } from './client';
import type { Addon, AuditEntry, ControlGym } from '../control/calc';

/** Every call here is platform-admin only: the database refuses anyone else, and the screens show that as "not allowed". */
export async function listControlGyms(): Promise<ControlGym[]> {
  const { data, error } = await supabase.rpc('platform_list_gyms');
  if (error) throw new Error(error.message);
  return (data ?? []).map((g) => ({ gymId: g.gym_id, name: g.name, slug: g.slug, createdAt: g.created_at, members: Number(g.members), ownerEmail: g.owner_email ?? '', addonsOff: g.addons_off ?? [] }));
}

export async function listAddons(): Promise<Addon[]> {
  const { data, error } = await supabase.from('platform_addons').select('key, name, description, optional, default_on, sort_order').order('sort_order');
  if (error) throw new Error(error.message);
  return (data ?? []).map((a) => ({ key: a.key, name: a.name, description: a.description ?? '', optional: a.optional, defaultOn: a.default_on }));
}

export async function setGymAddon(gymId: string, key: string, enabled: boolean): Promise<void> {
  const { error } = await supabase.rpc('platform_set_gym_addon', { p_gym_id: gymId, p_key: key, p_enabled: enabled });
  if (error) throw new Error(error.message);
}

export async function listAudit(limit = 100): Promise<AuditEntry[]> {
  const { data, error } = await supabase.rpc('platform_audit', { p_limit: limit });
  if (error) throw new Error(error.message);
  return (data ?? []).map((e) => ({ id: e.id, at: e.at, actor: e.actor ?? '', action: e.action, gymId: e.gym_id ?? '', detail: (e.detail && typeof e.detail === 'object' && !Array.isArray(e.detail) ? e.detail : {}) as Record<string, unknown> }));
}
