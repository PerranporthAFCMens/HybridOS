import { supabase } from './client';
import type { Database } from './database.types';

export type GymRole = Database['public']['Enums']['gym_member_role'];

export interface GymAccess {
  gymId: string;
  gymName: string;
  logoUrl: string | null;
  role: GymRole;
}

export interface MembershipRow {
  id: string;
  status: Database['public']['Enums']['membership_status'];
  endsOn: string | null;
  createdAt: string;
}

/** Every gym this person has active access to. Never filtered to one gym. */
export async function listActiveGyms(userId: string): Promise<GymAccess[]> {
  const { data, error } = await supabase
    .from('gym_members')
    .select('gym_id, role, gyms(name, logo_url)')
    .eq('user_id', userId)
    .eq('is_active', true)
    .eq('access_status', 'active');
  if (error) throw error;
  return (data ?? []).map((r) => ({
    gymId: r.gym_id,
    gymName: r.gyms?.name ?? 'Gym',
    logoUrl: r.gyms?.logo_url ?? null,
    role: r.role,
  }));
}

/** Newest membership row for ONE gym, whatever its status (owner rule). */
export async function newestMembership(userId: string, gymId: string): Promise<MembershipRow | null> {
  const { data, error } = await supabase
    .from('memberships')
    .select('id, status, ends_on, created_at')
    .eq('user_id', userId)
    .eq('gym_id', gymId)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(1);
  if (error) throw error;
  const r = data?.[0];
  return r ? { id: r.id, status: r.status, endsOn: r.ends_on, createdAt: r.created_at } : null;
}
