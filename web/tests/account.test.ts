import { describe, expect, it } from 'vitest';
import { checkEmail, checkName, checkPassword } from '../src/member/account';

describe('account details', () => {
  it('a name needs something to show', () => {
    expect(checkName('  ', 'A', 'B')).not.toBeNull();
    expect(checkName('Jo Marsh', '', '')).toBeNull();
    expect(checkName('x'.repeat(121), '', '')).toBe('That name is too long.');
  });
  it('an email must look like one and be different', () => {
    expect(checkEmail('nope', 'a@b.co')).toBe('Enter a valid email address.');
    expect(checkEmail('A@B.co', 'a@b.co')).toBe('That is already your email address.');
    expect(checkEmail(' new@b.co ', 'a@b.co')).toBeNull();
  });
  it('a password is long enough and typed twice', () => {
    expect(checkPassword('short', 'short')).toContain('at least 8');
    expect(checkPassword('longenough1', 'different1')).toBe('The two passwords do not match.');
    expect(checkPassword('longenough1', 'longenough1')).toBeNull();
  });
});

import { checkBirthday } from '../src/member/account';

describe('checkBirthday', () => {
  const now = new Date('2026-10-08T12:00:00Z');
  it('accepts a real date in the past', () => {
    expect(checkBirthday('1990-10-08', now)).toBeNull();
    expect(checkBirthday('2026-10-08', now)).toBeNull();
  });
  it('asks for a date when there is none or it is not a date', () => {
    expect(checkBirthday('', now)).toMatch(/Choose/);
    expect(checkBirthday('hello', now)).toMatch(/Choose/);
  });
  it('refuses impossible, future and very old dates', () => {
    expect(checkBirthday('2001-02-30', now)).toMatch(/not a real date/);
    expect(checkBirthday('2027-01-01', now)).toMatch(/future/);
    expect(checkBirthday('1899-12-31', now)).toMatch(/year/);
  });
});
