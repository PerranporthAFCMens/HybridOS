import { describe, expect, it } from 'vitest';
import { parseConfirmParams } from '../src/auth/confirmLink';

const origin = 'https://www.hybridone.co.uk';
const q = (o: Record<string, string>) => `?${new URLSearchParams(o).toString()}`;

describe('email link on our own domain', () => {
  it('reads a good link', () => {
    expect(parseConfirmParams(q({ token_hash: 'abc', type: 'invite', next: '/app?access_invite=x&gym_id=1' }), origin)).toEqual({ tokenHash: 'abc', type: 'invite', next: '/app?access_invite=x&gym_id=1' });
  });
  it('refuses a missing token or an unknown type', () => {
    expect(parseConfirmParams(q({ type: 'invite' }), origin)).toBeNull();
    expect(parseConfirmParams(q({ token_hash: 'abc', type: 'admin' }), origin)).toBeNull();
    expect(parseConfirmParams('', origin)).toBeNull();
  });
  it('never follows a return address on another site or the confirm page itself', () => {
    expect(parseConfirmParams(q({ token_hash: 'a', type: 'recovery', next: 'https://evil.example/x' }), origin)?.next).toBe('/auth-return');
    expect(parseConfirmParams(q({ token_hash: 'a', type: 'recovery', next: '//evil.example/x' }), origin)?.next).toBe('/auth-return');
    expect(parseConfirmParams(q({ token_hash: 'a', type: 'recovery', next: '/auth-confirm?token_hash=b&type=invite' }), origin)?.next).toBe('/auth-return');
  });
  it('accepts a full address on this site and falls back when there is none', () => {
    expect(parseConfirmParams(q({ token_hash: 'a', type: 'recovery', next: `${origin}/auth-return?mode=recovery` }), origin)?.next).toBe('/auth-return?mode=recovery');
    expect(parseConfirmParams(q({ token_hash: 'a', type: 'signup' }), origin)?.next).toBe('/auth-return');
  });
});
