import { supabase } from './client';
import type { Database } from './database.types';


export interface GymMemberRow {
  userId: string;
  joinedAt: string;
  attritionOn: string | null;
}

export interface ActiveMembershipValue {
  priceInPence: number;
  interval: string;
}

export interface ChannelRow {
  id: string;
  name: string;
  description: string | null;
}

export type ClassSession = Database['public']['Functions']['get_class_calendar']['Returns'][number];

/** People with the member role in this gym, oldest first (drives counts and the trend). */
export async function listGymMembers(gymId: string): Promise<GymMemberRow[]> {
  const { data, error } = await supabase
    .from('gym_members')
    .select('user_id, joined_at, attrition_on')
    .eq('gym_id', gymId)
    .eq('role', 'member')
    .order('joined_at');
  if (error) throw error;
  return (data ?? []).map((r) => ({ userId: r.user_id, joinedAt: r.joined_at, attritionOn: r.attrition_on }));
}

/** Plan price and billing interval of every active membership (for expected income). */
export async function listActiveMembershipValues(gymId: string): Promise<ActiveMembershipValue[]> {
  const { data, error } = await supabase
    .from('memberships')
    .select('membership_plans(price_pence, billing_interval)')
    .eq('gym_id', gymId)
    .eq('status', 'active');
  if (error) throw error;
  return (data ?? []).map((r) => ({
    priceInPence: r.membership_plans?.price_pence ?? 0,
    interval: r.membership_plans?.billing_interval ?? '',
  }));
}

export async function countPendingPayments(gymId: string): Promise<number> {
  const { count, error } = await supabase
    .from('memberships')
    .select('id', { count: 'exact', head: true })
    .eq('gym_id', gymId)
    .eq('payment_status', 'pending');
  if (error) throw error;
  return count ?? 0;
}

export async function listChannels(gymId: string): Promise<ChannelRow[]> {
  const { data, error } = await supabase
    .from('channels')
    .select('id, name, description')
    .eq('gym_id', gymId)
    .order('name');
  if (error) throw error;
  return data ?? [];
}

/** Class sessions between two instants (ISO strings). */
export async function listClassSessions(gymId: string, from: string, to: string): Promise<ClassSession[]> {
  const { data, error } = await supabase.rpc('get_class_calendar', { p_gym_id: gymId, p_from: from, p_to: to });
  if (error) throw error;
  return data ?? [];
}

/** Name shown in the greeting: profile name, else the start of the email. */
export async function getDisplayName(userId: string, email: string): Promise<string> {
  const { data, error } = await supabase
    .from('profiles')
    .select('display_name, first_name')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw error;
  return data?.display_name || data?.first_name || email.split('@')[0] || 'there';
}
