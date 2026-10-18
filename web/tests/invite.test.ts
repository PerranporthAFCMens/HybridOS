import { describe, expect, it } from 'vitest';
import { inviteNotice, inviteUsable, roleLabel } from '../src/auth/invite';

const invite = (role: string, status: string) => ({ email: 'a@example.test', gymName: 'Gym', role, status });

describe('invite wording', () => {
  it('labels the role', () => {
    expect(roleLabel('owner')).toBe('Owner');
    expect(roleLabel('admin')).toBe('Admin');
  });
  it('explains an open invitation by role', () => {
    expect(inviteNotice(invite('owner', 'open'))).toContain('equal Owner');
    expect(inviteNotice(invite('admin', 'open'))).toContain('Admin access');
  });
  it('shows the state of one that is not open', () => {
    expect(inviteNotice(invite('admin', 'awaiting_approval'))).toBe('Invite status: awaiting approval.');
  });
  it('only revoked or expired invitations are unusable', () => {
    expect(inviteUsable(invite('admin', 'revoked'))).toBe(false);
    expect(inviteUsable(invite('admin', 'expired'))).toBe(false);
    expect(inviteUsable(invite('admin', 'open'))).toBe(true);
  });
});
