// Pure rules behind Owners and admins: who can do what to whom, how an invitation is described, and what to
// tell the owner after each action. Same rules as the old Admin access page; the database enforces them again.

export interface Person { userId: string; name: string; email: string; role: 'owner' | 'admin'; accessStatus: string }
export interface Invite {
  id: string; email: string; inviteeName: string | null; status: string; role: string; claimedBy: string | null;
  createdAt: string; expiresAt: string; emailSentAt: string | null; delivery: string | null;
}
export interface OwnershipAction { id: string; type: string; targetUserId: string | null }

export const activeOwners = (people: Person[]) => people.filter((p) => p.role === 'owner' && p.accessStatus === 'active');

/** Buttons a person row offers. */
export function personActions(p: Person, ownerCount: number): { approve: boolean; promote: boolean; remove: boolean; requestRemoval: boolean } {
  const owner = p.role === 'owner';
  return {
    approve: p.accessStatus === 'pending',
    promote: !owner && p.accessStatus === 'active',
    remove: !owner,
    requestRemoval: owner && p.accessStatus === 'active' && ownerCount > 1,
  };
}

/** An invitation still waiting to be used is shown as expired once its time has passed. */
export function inviteStatus(i: Pick<Invite, 'status' | 'expiresAt'>, now: Date): string {
  const waiting = i.status === 'open' || i.status === 'awaiting_approval';
  return waiting && new Date(i.expiresAt) <= now ? 'expired' : i.status;
}

/** How many current owners must approve an invitation: every owner for an owner invite, otherwise just the one. */
export const approvalsRequired = (role: string, ownerCount: number) => (role === 'owner' ? Math.max(ownerCount, 1) : 1);

export function inviteActions(i: Invite, mine: boolean): { approveOwner: boolean; sendEmail: boolean; revoke: boolean; remove: boolean } {
  return {
    approveOwner: i.status === 'awaiting_approval' && i.role === 'owner' && !mine,
    sendEmail: i.status === 'open' && i.delivery !== 'link',
    revoke: i.status === 'awaiting_approval' || i.status === 'open' || i.status === 'claimed',
    remove: i.status !== 'approved',
  };
}

const ACTION_LABELS: Record<string, string> = {
  activate_owner: 'Activate Owner',
  promote_owner: 'Promote Admin to Owner',
  remove_owner: 'Remove Owner',
};
export const actionLabel = (type: string) => ACTION_LABELS[type] ?? 'Delete gym';

export type Outcome = 'approve-access' | 'promote' | 'remove-owner' | 'approve-action';

/** What to tell the owner after a call that may complete now or wait for the other owners. */
export function outcomeText(kind: Outcome, result: unknown): string {
  // Only an explicit `executed: false` means it is waiting on other owners (as the old page treated it).
  const waiting = typeof result === 'object' && result !== null && (result as { executed?: unknown }).executed === false;
  if (!waiting) return 'Done.';
  if (kind === 'remove-owner') return 'Removal request created. It only completes when every active owner approves.';
  return 'Your approval is recorded. Waiting for the other owner approval(s).';
}

export function validateInvite(name: string, email: string): { ok: true; name: string; email: string } | { ok: false; message: string } {
  if (!name.trim()) return { ok: false, message: 'Enter their name first.' };
  if (!email.trim()) return { ok: false, message: 'Enter the email address first.' };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return { ok: false, message: 'Enter a valid email address.' };
  return { ok: true, name: name.trim(), email: email.trim() };
}

export const EXPIRY_DAYS = [3, 7, 14, 30] as const;

/** The secure link the invited person opens. It still goes through the old landing page until the cutover. */
export function inviteLink(base: string, token: string, email: string, gymName: string, role: string): string {
  const u = new URL('../index.html', base);
  u.search = '';
  u.hash = '';
  u.searchParams.set('access_invite', token);
  u.searchParams.set('invite_email', email);
  u.searchParams.set('invite_gym', gymName);
  u.searchParams.set('invite_role', role);
  return u.toString();
}

export function approvalText(i: Invite, approvals: number, required: number): string {
  return i.role === 'owner' && (i.status === 'awaiting_approval' || i.status === 'open') ? `${approvals} of ${required} owner approvals` : '';
}
