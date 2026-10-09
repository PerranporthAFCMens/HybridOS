import { supabase } from './client';
import type { Database } from './database.types';

export type MembershipStatus = Database['public']['Enums']['membership_status'];
export type PaymentProvider = Database['public']['Enums']['payment_provider'];
export type PaymentState = Database['public']['Enums']['payment_state'];

export interface MemberRow {
  userId: string;
  /** owner, admin, staff, coach or member. Team members can hold a membership like anyone else. */
  role: string;
  displayName: string | null;
  firstName: string | null;
  lastName: string | null;
  joinedAt: string;
  attritionOn: string | null;
  /** Newest membership row for this gym, whatever its status. */
  latest: { planName: string | null; status: MembershipStatus } | null;
}

export interface MemberMembership {
  id: string;
  status: MembershipStatus;
  startsOn: string | null;
  endsOn: string | null;
  paymentProvider: PaymentProvider | null;
  paymentStatus: PaymentState;
  planName: string | null;
  planPricePence: number | null;
  planInterval: string | null;
}

const CHUNK = 100;
function chunks<T>(items: T[]): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += CHUNK) out.push(items.slice(i, i + CHUNK));
  return out;
}

/** Everyone with a login at this gym (members and the team), with profile names and newest membership. */
export async function listMemberDirectory(gymId: string): Promise<MemberRow[]> {
  const { data: people, error } = await supabase
    .from('gym_members')
    .select('user_id, joined_at, attrition_on, role')
    .eq('gym_id', gymId)
    .order('joined_at');
  if (error) throw error;
  const rows = people ?? [];
  const ids = rows.map((r) => r.user_id);

  const profiles = new Map<string, { display_name: string | null; first_name: string | null; last_name: string | null }>();
  const latest = new Map<string, MemberRow['latest']>();
  for (const part of chunks(ids)) {
    const [p, m] = await Promise.all([
      supabase.from('profiles').select('id, display_name, first_name, last_name').in('id', part),
      supabase
        .from('memberships')
        .select('user_id, status, membership_plans(name)')
        .eq('gym_id', gymId)
        .in('user_id', part)
        .order('created_at', { ascending: false }),
    ]);
    if (p.error) throw p.error;
    if (m.error) throw m.error;
    for (const r of p.data ?? []) profiles.set(r.id, r);
    for (const r of m.data ?? []) {
      if (r.user_id && !latest.has(r.user_id)) {
        latest.set(r.user_id, { planName: r.membership_plans?.name ?? null, status: r.status });
      }
    }
  }

  return rows.map((r) => {
    const p = profiles.get(r.user_id);
    return {
      userId: r.user_id,
      role: r.role,
      displayName: p?.display_name ?? null,
      firstName: p?.first_name ?? null,
      lastName: p?.last_name ?? null,
      joinedAt: r.joined_at,
      attritionOn: r.attrition_on,
      latest: latest.get(r.user_id) ?? null,
    };
  });
}

export async function listMemberMemberships(gymId: string, userId: string): Promise<MemberMembership[]> {
  const { data, error } = await supabase
    .from('memberships')
    .select(
      'id, status, starts_on, ends_on, payment_provider, payment_status, membership_plans(name, price_pence, billing_interval)',
    )
    .eq('gym_id', gymId)
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((m) => ({
    id: m.id,
    status: m.status,
    startsOn: m.starts_on,
    endsOn: m.ends_on,
    paymentProvider: m.payment_provider,
    paymentStatus: m.payment_status,
    planName: m.membership_plans?.name ?? null,
    planPricePence: m.membership_plans?.price_pence ?? null,
    planInterval: m.membership_plans?.billing_interval ?? null,
  }));
}

/** Joined date drives new-customer reporting; an attrition date marks them as left. */
export async function updateMemberLifecycle(args: {
  gymId: string;
  userId: string;
  joinedOn: string; // YYYY-MM-DD
  attritionOn: string | null;
}): Promise<void> {
  const { error } = await supabase
    .from('gym_members')
    .update({
      joined_at: `${args.joinedOn}T00:00:00`,
      attrition_on: args.attritionOn,
      updated_at: new Date().toISOString(),
      is_active: !args.attritionOn,
    })
    .eq('gym_id', args.gymId)
    .eq('user_id', args.userId)
    .eq('role', 'member');
  if (error) throw error;
}

/** Activate, pause or cancel one membership. Cancelling also ends it today. */
export async function setMembershipStatus(args: {
  gymId: string;
  membershipId: string;
  status: 'active' | 'paused' | 'cancelled';
}): Promise<void> {
  const updates: Database['public']['Tables']['memberships']['Update'] = { status: args.status };
  if (args.status === 'cancelled') {
    updates.ends_on = new Date().toISOString().slice(0, 10);
    updates.payment_status = 'cancelled';
  }
  const { error } = await supabase
    .from('memberships')
    .update(updates)
    .eq('id', args.membershipId)
    .eq('gym_id', args.gymId);
  if (error) throw error;
}

export async function assignMembership(args: {
  gymId: string;
  userId: string;
  planId: string;
  status: 'active' | 'pending' | 'paused';
  startsOn: string | null;
  payment: 'manual' | 'gocardless';
}): Promise<void> {
  const { error } = await supabase.from('memberships').insert({
    gym_id: args.gymId,
    user_id: args.userId,
    plan_id: args.planId,
    status: args.status,
    starts_on: args.startsOn,
    payment_provider: args.payment,
    payment_status: args.payment === 'gocardless' ? 'pending' : 'confirmed',
  });
  if (error) throw error;
}
