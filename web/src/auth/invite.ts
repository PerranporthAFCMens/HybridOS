import { siteUrl } from '../app/site';
import type { AccessInvite } from '../data/auth';

export function roleLabel(role: string): string {
  return role === 'owner' ? 'Owner' : 'Admin';
}

/** The line under the heading: what accepting does, or the invitation's state when it is not open. */
export function inviteNotice(invite: AccessInvite): string {
  if (invite.status !== 'open') return `Invite status: ${invite.status.replaceAll('_', ' ')}.`;
  return invite.role === 'owner'
    ? 'This Owner invitation has the required approval. Sign in and accept it to become an equal Owner.'
    : 'This Admin invitation has already been approved. Sign in and accept it to activate your Admin access.';
}

export function inviteUsable(invite: AccessInvite): boolean {
  return !['revoked', 'expired'].includes(invite.status);
}

/** Where a confirmation email sends the person back to. Still the classic invite page until email links move. */
export function inviteReturnUrl(token: string): string {
  return `${window.location.origin}${siteUrl('admin-invite.html')}?token=${encodeURIComponent(token)}`;
}
