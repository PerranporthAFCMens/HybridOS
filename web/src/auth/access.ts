import type { GymRole, MembershipRow } from '../data/memberships';

export type Access = 'privileged' | 'active' | 'paused' | 'pending' | 'ended';

const PRIVILEGED: readonly GymRole[] = ['owner', 'admin', 'staff', 'coach'];

export function isPrivileged(role: GymRole): boolean {
  return PRIVILEGED.includes(role);
}

/**
 * Membership access for the SELECTED gym. The newest membership row governs,
 * whatever its status. `ends_on` before today counts as expired. No row is
 * pending. Owners, admins, staff and coaches bypass by role.
 * Mirrors getMembershipAccess in the legacy gym-context.js.
 */
export function resolveAccess(role: GymRole, membership: MembershipRow | null, today: string): Access {
  if (isPrivileged(role)) return 'privileged';
  if (!membership) return 'pending';
  let status: string = membership.status;
  if (status !== 'cancelled' && status !== 'expired' && membership.endsOn && membership.endsOn < today) {
    status = 'expired';
  }
  if (status === 'active') return 'active';
  if (status === 'paused') return 'paused';
  if (status === 'pending') return 'pending';
  return 'ended';
}
