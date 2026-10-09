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
