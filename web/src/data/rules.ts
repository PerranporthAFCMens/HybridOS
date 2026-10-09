import { supabase } from './client';
import type { Database, Json } from './database.types';

export type RulesRow = Database['public']['Tables']['membership_rules']['Row'];

/** The gym's rules, or null when it has never set any (everything is then off). */
export async function getRules(gymId: string): Promise<RulesRow | null> {
  const { data, error } = await supabase.from('membership_rules').select('*').eq('gym_id', gymId).maybeSingle();
  if (error) throw error;
  return data;
}

export async function saveRules(gymId: string, userId: string, row: Omit<RulesRow, 'gym_id' | 'updated_at' | 'updated_by'>): Promise<void> {
  const { error } = await supabase.from('membership_rules').upsert({ ...row, gym_id: gymId, updated_by: userId, updated_at: new Date().toISOString() }, { onConflict: 'gym_id' });
  if (error) throw error;
}

export interface RequestRow {
  id: string; kind: string; status: string; userId: string; effectiveOn: string; untilOn: string | null; fromPlanId: string | null; toPlanId: string | null;
  reason: string | null; feePence: number; requestedAt: string; decidedAt: string | null; decisionNote: string | null; direction: string;
}

/** Waiting requests, and anything decided or started in the last 60 days, newest first. */
export async function listRequests(gymId: string): Promise<RequestRow[]> {
  const since = new Date(Date.now() - 60 * 86400000).toISOString();
  const { data, error } = await supabase
    .from('membership_requests')
    .select('id, kind, status, user_id, effective_on, until_on, from_plan_id, to_plan_id, reason, fee_pence, requested_at, decided_at, decision_note, rules_snapshot')
    .eq('gym_id', gymId)
    .or(`status.eq.pending,status.eq.approved,requested_at.gte.${since}`)
    .order('requested_at', { ascending: false })
    .limit(200);
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id, kind: r.kind, status: r.status, userId: r.user_id, effectiveOn: r.effective_on, untilOn: r.until_on, fromPlanId: r.from_plan_id, toPlanId: r.to_plan_id,
    reason: r.reason, feePence: r.fee_pence, requestedAt: r.requested_at, decidedAt: r.decided_at, decisionNote: r.decision_note,
    direction: String((r.rules_snapshot as { direction?: unknown } | null)?.direction ?? ''),
  }));
}

export async function decideRequest(id: string, approve: boolean, note: string): Promise<void> {
  const { error } = await supabase.rpc('decide_membership_request', { p_request_id: id, p_approve: approve, p_note: note.trim() || undefined });
  if (error) throw new Error(error.message);
}

/** What this member may do, as the database works it out. */
export async function getMyOptions(gymId: string): Promise<Json> {
  const { data, error } = await supabase.rpc('get_my_membership_options', { p_gym_id: gymId });
  if (error) throw new Error(error.message);
  return data;
}

export async function askToPause(membershipId: string, startsOn: string, endsOn: string, reason: string): Promise<void> {
  const { error } = await supabase.rpc('request_membership_pause', { p_membership_id: membershipId, p_starts_on: startsOn, p_ends_on: endsOn, p_reason: reason || undefined });
  if (error) throw new Error(error.message);
}

export async function askToCancel(membershipId: string, reason: string): Promise<void> {
  const { error } = await supabase.rpc('request_membership_cancel', { p_membership_id: membershipId, p_reason: reason || undefined });
  if (error) throw new Error(error.message);
}

export async function askToChange(membershipId: string, toPlanId: string): Promise<void> {
  const { error } = await supabase.rpc('request_membership_change', { p_membership_id: membershipId, p_to_plan_id: toPlanId });
  if (error) throw new Error(error.message);
}

export async function withdrawRequest(id: string): Promise<void> {
  const { error } = await supabase.rpc('withdraw_membership_request', { p_request_id: id });
  if (error) throw new Error(error.message);
}
