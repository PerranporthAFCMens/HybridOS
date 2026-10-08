import { describe, expect, it } from 'vitest';
import { resolveAccess } from '../src/auth/access';
import type { MembershipRow } from '../src/data/memberships';

const TODAY = '2026-10-07';
const row = (status: MembershipRow['status'], endsOn: string | null = null): MembershipRow => ({
  id: 'm1',
  status,
  endsOn,
  createdAt: '2026-01-01T00:00:00Z',
});

describe('resolveAccess', () => {
  it('lets owners, admins, staff and coaches bypass', () => {
    for (const role of ['owner', 'admin', 'staff', 'coach'] as const) {
      expect(resolveAccess(role, row('cancelled'), TODAY)).toBe('privileged');
      expect(resolveAccess(role, null, TODAY)).toBe('privileged');
    }
  });
  it('treats no membership row as pending', () => {
    expect(resolveAccess('member', null, TODAY)).toBe('pending');
  });
  it('maps statuses', () => {
    expect(resolveAccess('member', row('active'), TODAY)).toBe('active');
    expect(resolveAccess('member', row('paused'), TODAY)).toBe('paused');
    expect(resolveAccess('member', row('pending'), TODAY)).toBe('pending');
    expect(resolveAccess('member', row('cancelled'), TODAY)).toBe('ended');
    expect(resolveAccess('member', row('expired'), TODAY)).toBe('ended');
  });
  it('treats an active row that ended before today as ended', () => {
    expect(resolveAccess('member', row('active', '2026-10-06'), TODAY)).toBe('ended');
    expect(resolveAccess('member', row('active', '2026-10-07'), TODAY)).toBe('active');
  });
});
