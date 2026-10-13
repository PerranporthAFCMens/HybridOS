import { describe, expect, it } from 'vitest';
import { cardOf, safeEqual, sign, subscriptionIdOf, verifySignature } from '../../supabase/functions/stripe-webhook/index';

const secret = 'whsec_test_123';
const body = JSON.stringify({ id: 'evt_1', type: 'invoice.paid' });

describe('the Stripe signature check', () => {
  it('accepts a correctly signed, recent request', async () => {
    const t = 1_800_000_000;
    const header = `t=${t},v1=${await sign(body, secret, t)}`;
    expect(await verifySignature(body, header, secret, t + 10)).toBe(true);
  });
  it('accepts any one of several signatures', async () => {
    const t = 1_800_000_000;
    const header = `t=${t},v1=deadbeef,v1=${await sign(body, secret, t)}`;
    expect(await verifySignature(body, header, secret, t)).toBe(true);
  });
  it('refuses a changed body', async () => {
    const t = 1_800_000_000;
    const header = `t=${t},v1=${await sign(body, secret, t)}`;
    expect(await verifySignature(body + ' ', header, secret, t)).toBe(false);
  });
  it('refuses the wrong secret', async () => {
    const t = 1_800_000_000;
    const header = `t=${t},v1=${await sign(body, 'whsec_other', t)}`;
    expect(await verifySignature(body, header, secret, t)).toBe(false);
  });
  it('refuses an old request (a captured one replayed later)', async () => {
    const t = 1_800_000_000;
    const header = `t=${t},v1=${await sign(body, secret, t)}`;
    expect(await verifySignature(body, header, secret, t + 301)).toBe(false);
    expect(await verifySignature(body, header, secret, t + 300)).toBe(true);
  });
  it('refuses a missing or broken header, body or secret', async () => {
    expect(await verifySignature(body, '', secret, 1)).toBe(false);
    expect(await verifySignature(body, 'rubbish', secret, 1)).toBe(false);
    expect(await verifySignature(body, 't=abc,v1=ff', secret, 1)).toBe(false);
    expect(await verifySignature(body, 't=1800000000', secret, 1_800_000_000)).toBe(false);
    expect(await verifySignature('', 't=1800000000,v1=ff', secret, 1_800_000_000)).toBe(false);
    expect(await verifySignature(body, 't=1800000000,v1=ff', '', 1_800_000_000)).toBe(false);
  });
  it('compares text without stopping at the first difference', () => {
    expect(safeEqual('abc', 'abc')).toBe(true);
    expect(safeEqual('abc', 'abd')).toBe(false);
    expect(safeEqual('abc', 'abcd')).toBe(false);
  });
});

describe('reading an invoice', () => {
  it('finds the subscription in either shape', () => {
    expect(subscriptionIdOf({ parent: { subscription_details: { subscription: 'sub_new' } } })).toBe('sub_new');
    expect(subscriptionIdOf({ subscription: 'sub_old' })).toBe('sub_old');
    expect(subscriptionIdOf({ subscription: { id: 'sub_obj' } })).toBe('sub_obj');
    expect(subscriptionIdOf({})).toBe('');
  });
  it('keeps only the brand, last four and expiry of a card', () => {
    expect(cardOf({ id: 'pm_1', card: { brand: 'mastercard', last4: '4444', exp_month: 1, exp_year: 2031 } })).toEqual({ id: 'pm_1', brand: 'mastercard', last4: '4444', month: 1, year: 2031 });
    expect(cardOf(undefined)).toBeNull();
  });
});
