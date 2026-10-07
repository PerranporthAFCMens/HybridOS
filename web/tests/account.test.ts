import { describe, expect, it } from 'vitest';
import { fullName, roleLabel } from '../src/shell/account';

const names = (displayName: string | null, firstName: string | null, lastName: string | null) => ({ displayName, firstName, lastName });

describe('fullName', () => {
  it('prefers the display name', () => {
    expect(fullName(names('Adam Turner', 'A', 'T'), 'a@b.c')).toBe('Adam Turner');
  });
  it('falls back to first and last name', () => {
    expect(fullName(names(null, 'Adam', 'Turner'), 'a@b.c')).toBe('Adam Turner');
    expect(fullName(names('  ', 'Adam', null), 'a@b.c')).toBe('Adam');
  });
  it('falls back to the start of the email when there is no name, or the profile is missing', () => {
    expect(fullName(names(null, null, null), 'adam.t+gym@example.com')).toBe('adam.t+gym');
    expect(fullName(undefined, 'adam@example.com')).toBe('adam');
  });
});

describe('roleLabel', () => {
  it('words every role', () => {
    expect(roleLabel('owner')).toBe('Owner');
    expect(roleLabel('admin')).toBe('Admin');
    expect(roleLabel('staff')).toBe('Staff');
    expect(roleLabel('coach')).toBe('Coach');
    expect(roleLabel('member')).toBe('Member');
  });
});
