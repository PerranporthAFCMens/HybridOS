import { describe, expect, it } from 'vitest';
import { actionLabel, activeOwners, approvalText, approvalsRequired, inviteActions, inviteLink, inviteStatus, outcomeText, personActions, validateInvite, type Invite, type Person } from '../src/owners/calc';

const person = (role: 'owner' | 'admin', accessStatus = 'active'): Person => ({ userId: 'u', name: 'N', email: 'e@x.com', role, accessStatus });
const invite = (o: Partial<Invite> = {}): Invite => ({ id: 'i', email: 'a@b.co', inviteeName: null, status: 'open', role: 'admin', claimedBy: null, createdAt: '2026-10-01T10:00:00Z', expiresAt: '2026-10-10T10:00:00Z', emailSentAt: null, delivery: 'email', ...o });

describe('person actions', () => {
  it('pending people can be approved', () => expect(personActions(person('admin', 'pending'), 1).approve).toBe(true));
  it('an active admin can be promoted or removed', () => {
    expect(personActions(person('admin'), 1)).toEqual({ approve: false, promote: true, remove: true, requestRemoval: false });
  });
  it('an owner can never be removed directly and only has a removal request when there is another owner', () => {
    expect(personActions(person('owner'), 1)).toEqual({ approve: false, promote: false, remove: false, requestRemoval: false });
    expect(personActions(person('owner'), 2).requestRemoval).toBe(true);
    expect(personActions(person('owner', 'pending'), 2).requestRemoval).toBe(false);
  });
  it('counts only active owners', () => {
    expect(activeOwners([person('owner'), person('owner', 'pending'), person('admin')])).toHaveLength(1);
  });
});

describe('invites', () => {
  const now = new Date('2026-10-08T12:00:00Z');
  it('shows a waiting invite as expired once its time has passed', () => {
    expect(inviteStatus(invite({ expiresAt: '2026-10-08T11:59:00Z' }), now)).toBe('expired');
    expect(inviteStatus(invite({ status: 'awaiting_approval', expiresAt: '2026-10-08T12:00:00Z' }), now)).toBe('expired');
    expect(inviteStatus(invite({ expiresAt: '2026-10-09T00:00:00Z' }), now)).toBe('open');
    expect(inviteStatus(invite({ status: 'approved', expiresAt: '2020-01-01T00:00:00Z' }), now)).toBe('approved');
  });
  it('owner invites need every owner, others just one', () => {
    expect(approvalsRequired('owner', 3)).toBe(3);
    expect(approvalsRequired('owner', 0)).toBe(1);
    expect(approvalsRequired('admin', 3)).toBe(1);
  });
  it('offers the right buttons', () => {
    expect(inviteActions(invite({ status: 'awaiting_approval', role: 'owner' }), false)).toEqual({ approveOwner: true, sendEmail: false, revoke: true, remove: true });
    expect(inviteActions(invite({ status: 'awaiting_approval', role: 'owner' }), true).approveOwner).toBe(false);
    expect(inviteActions(invite({ status: 'awaiting_approval', role: 'admin' }), false).approveOwner).toBe(false);
    expect(inviteActions(invite(), false)).toEqual({ approveOwner: false, sendEmail: true, revoke: true, remove: true });
    expect(inviteActions(invite({ delivery: 'link' }), false).sendEmail).toBe(false);
    expect(inviteActions(invite({ status: 'approved' }), false)).toEqual({ approveOwner: false, sendEmail: false, revoke: false, remove: false });
    expect(inviteActions(invite({ status: 'claimed' }), false).revoke).toBe(true);
    expect(inviteActions(invite({ status: 'revoked' }), false)).toMatchObject({ revoke: false, remove: true });
  });
  it('words approvals only for waiting owner invites', () => {
    expect(approvalText(invite({ role: 'owner', status: 'awaiting_approval' }), 1, 2)).toBe('1 of 2 owner approvals');
    expect(approvalText(invite({ role: 'owner', status: 'approved' }), 2, 2)).toBe('');
    expect(approvalText(invite({ role: 'admin' }), 0, 1)).toBe('');
  });
  it('validates the form', () => {
    expect(validateInvite(' ', 'a@b.co')).toMatchObject({ ok: false });
    expect(validateInvite('A', ' ')).toMatchObject({ ok: false });
    expect(validateInvite('A', 'nope')).toMatchObject({ ok: false });
    expect(validateInvite(' Josh ', ' j@x.co ')).toEqual({ ok: true, name: 'Josh', email: 'j@x.co' });
  });
  it('builds the link to the old landing page with everything encoded', () => {
    const url = new URL(inviteLink('https://h.example/today', 'tok en', 'a+b@x.co', 'Puffin & Co', 'owner'));
    expect(url.pathname).toBe('/index.html');
    expect(url.hash).toBe('');
    expect(url.searchParams.get('access_invite')).toBe('tok en');
    expect(url.searchParams.get('invite_email')).toBe('a+b@x.co');
    expect(url.searchParams.get('invite_gym')).toBe('Puffin & Co');
    expect(url.searchParams.get('invite_role')).toBe('owner');
  });
});

describe('ownership decisions', () => {
  it('labels', () => {
    expect(actionLabel('activate_owner')).toBe('Activate Owner');
    expect(actionLabel('promote_owner')).toBe('Promote Admin to Owner');
    expect(actionLabel('remove_owner')).toBe('Remove Owner');
    expect(actionLabel('anything_else')).toBe('Delete gym');
  });
  it('tells the owner whether it happened or is waiting', () => {
    expect(outcomeText('promote', { executed: true })).toBe('Done.');
    expect(outcomeText('promote', null)).toBe('Done.');
    expect(outcomeText('promote', { executed: false })).toContain('Waiting for the other owner');
    expect(outcomeText('remove-owner', { executed: false })).toContain('every active owner');
    expect(outcomeText('approve-action', {})).toBe('Done.');
  });
});
