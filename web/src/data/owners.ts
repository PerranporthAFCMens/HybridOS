import { supabase } from './client';
import { edgeErrorMessage } from './edge';
import type { Invite, OwnershipAction, Person } from '../owners/calc';

export interface OwnersData {
  people: Person[];
  invites: Invite[];
  /** invite id -> owner user ids who approved */
  inviteApprovals: Map<string, string[]>;
  actions: OwnershipAction[];
  /** action id -> owner user ids who approved */
  actionApprovals: Map<string, string[]>;
  names: Map<string, string>;
}

function group(rows: { key: string; owner: string }[]): Map<string, string[]> {
  const m = new Map<string, string[]>();
  for (const r of rows) m.set(r.key, [...(m.get(r.key) ?? []), r.owner]);
  return m;
}

/** Owners and admins of a gym, every access invitation, and ownership decisions still waiting for approval. */
export async function loadOwners(gymId: string): Promise<OwnersData> {
  const [team, inv, act] = await Promise.all([
    supabase.rpc('get_gym_team_accounts', { target_gym_id: gymId }),
    supabase.from('gym_admin_invites').select('id, email, invitee_name, status, invite_role, claimed_by, created_at, expires_at, email_sent_at, delivery_method').eq('gym_id', gymId).order('created_at', { ascending: false }),
    supabase.from('gym_ownership_actions').select('id, action_type, target_user_id').eq('gym_id', gymId).eq('status', 'pending').order('created_at', { ascending: false }),
  ]);
  for (const r of [team, inv, act]) if (r.error) throw r.error;
  const invites = (inv.data ?? []).map((i): Invite => ({
    id: i.id, email: i.email, inviteeName: i.invitee_name, status: i.status, role: i.invite_role, claimedBy: i.claimed_by,
    createdAt: i.created_at, expiresAt: i.expires_at, emailSentAt: i.email_sent_at, delivery: i.delivery_method,
  }));
  const actions = (act.data ?? []).map((a): OwnershipAction => ({ id: a.id, type: a.action_type, targetUserId: a.target_user_id }));
  const [ia, aa] = await Promise.all([
    invites.length ? supabase.from('gym_access_invite_approvals').select('invite_id, owner_user_id').in('invite_id', invites.map((i) => i.id)) : Promise.resolve({ data: [], error: null }),
    actions.length ? supabase.from('gym_ownership_action_approvals').select('action_id, owner_user_id').in('action_id', actions.map((a) => a.id)) : Promise.resolve({ data: [], error: null }),
  ]);
  if (ia.error) throw ia.error;
  if (aa.error) throw aa.error;
  const members = (team.data ?? []).filter((m) => m.is_active && (m.role === 'owner' || m.role === 'admin'));
  return {
    people: members.map((m): Person => ({ userId: m.user_id, name: m.display_name || m.email || 'Team member', email: m.email ?? '', role: m.role === 'owner' ? 'owner' : 'admin', accessStatus: m.access_status })),
    invites,
    inviteApprovals: group((ia.data ?? []).map((r) => ({ key: r.invite_id, owner: r.owner_user_id }))),
    actions,
    actionApprovals: group((aa.data ?? []).map((r) => ({ key: r.action_id, owner: r.owner_user_id }))),
    names: new Map((team.data ?? []).map((m) => [m.user_id, m.display_name || m.email || 'Team member'])),
  };
}

export interface InviteCreated { inviteId: string; status: string; approvals: number; required: number; token: string | null }

export async function createInvite(gymId: string, v: { email: string; name: string; role: 'admin' | 'owner'; days: number; link: boolean }): Promise<InviteCreated> {
  const args = { target_gym_id: gymId, invite_email: v.email, requested_role: v.role, expires_in_days: v.days, invitee_name: v.name };
  if (v.link) {
    const { data, error } = await supabase.rpc('create_shareable_access_invite', args);
    if (error) throw error;
    const row = data?.[0];
    if (!row) throw new Error('Secure invite was not created.');
    return { inviteId: row.invite_id, status: row.status, approvals: row.owner_approvals, required: row.owner_approvals_required, token: row.token };
  }
  const { data, error } = await supabase.rpc('create_email_access_invite', args);
  if (error) throw error;
  const row = data?.[0];
  if (!row) throw new Error('Invitation was not created.');
  return { inviteId: row.invite_id, status: row.status, approvals: row.owner_approvals, required: row.owner_approvals_required, token: null };
}

/** Emails the invitation with the live "send-access-invite" function (the same call the old page makes). */
export async function sendInviteEmail(inviteId: string): Promise<string> {
  const { data, error } = await supabase.functions.invoke('send-access-invite', { body: { invite_id: inviteId } });
  if (error) throw new Error(await edgeErrorMessage(error, 'Could not send the invitation email.'));
  const j = (data ?? {}) as { error?: string; stage?: string; email?: string };
  if (j.error) throw new Error(j.stage ? `${j.stage}: ${j.error}` : j.error);
  return j.email ?? '';
}

export interface OwnerInviteApproval { ready: boolean; token: string | null }

export async function approveOwnerInvite(inviteId: string, link: boolean): Promise<OwnerInviteApproval> {
  if (link) {
    const { data, error } = await supabase.rpc('approve_shareable_owner_invite', { target_invite_id: inviteId });
    if (error) throw error;
    const row = data?.[0];
    if (!row) throw new Error('Approval was not recorded.');
    return { ready: row.ready_to_share, token: row.token };
  }
  const { data, error } = await supabase.rpc('approve_email_owner_invite', { target_invite_id: inviteId });
  if (error) throw error;
  const row = data?.[0];
  if (!row) throw new Error('Approval was not recorded.');
  return { ready: row.ready_to_send, token: null };
}

export async function approvePendingAccess(gymId: string, userId: string) {
  const { data, error } = await supabase.rpc('approve_pending_access', { target_gym_id: gymId, target_user_id: userId });
  if (error) throw error;
  return data;
}
export async function proposeOwnerPromotion(gymId: string, userId: string) {
  const { data, error } = await supabase.rpc('propose_owner_promotion', { target_gym_id: gymId, target_user_id: userId });
  if (error) throw error;
  return data;
}
export async function proposeOwnerRemoval(gymId: string, userId: string) {
  const { data, error } = await supabase.rpc('propose_owner_removal', { target_gym_id: gymId, target_user_id: userId });
  if (error) throw error;
  return data;
}
export async function approveOwnershipAction(actionId: string) {
  const { data, error } = await supabase.rpc('approve_ownership_action', { target_action_id: actionId });
  if (error) throw error;
  return data;
}
export async function removeAdminAccess(gymId: string, userId: string): Promise<void> {
  const { error } = await supabase.rpc('remove_admin_access', { target_gym_id: gymId, target_user_id: userId });
  if (error) throw error;
}
export async function revokeInvite(inviteId: string): Promise<void> {
  const { error } = await supabase.rpc('revoke_admin_invite', { target_invite_id: inviteId });
  if (error) throw error;
}
export async function deleteInvite(inviteId: string): Promise<void> {
  const { error } = await supabase.rpc('delete_admin_invite', { target_invite_id: inviteId });
  if (error) throw error;
}
