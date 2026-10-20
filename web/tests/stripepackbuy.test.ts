import { describe, expect, it } from 'vitest';
import { isPaymentIntentId, packPaymentFrom, packWording, packWords, poundsText, stripeForm } from '../../supabase/functions/stripe-pack-buy/index';
import { packPaymentFrom as webhookPackPaymentFrom } from '../../supabase/functions/stripe-webhook/index';

const G = 'a0000000-0000-4000-8000-0000000000aa';
const U = '00000000-0000-4000-8000-0000000000a2';
const K = 'd0000000-0000-4000-8000-000000000001';
const pi = (over: Record<string, unknown> = {}) => ({ id: 'pi_3Abc', amount: 6000, amount_received: 6000, metadata: { kind: 'class_pack', gym_id: G, user_id: U, pack_type_id: K }, ...over });

describe('class pack payment form', () => {
  it('asks Stripe for a payment with our marker in its metadata', () => {
    const f = stripeForm({ amount: 6000, currency: 'gbp', automatic_payment_methods: { enabled: true }, metadata: { kind: 'class_pack', gym_id: G } });
    expect(f).toContain('amount=6000');
    expect(f).toContain('automatic_payment_methods%5Benabled%5D=true');
    expect(f).toContain('metadata%5Bkind%5D=class_pack');
  });
});

describe('words the member agrees to', () => {
  it('names the pack, the classes, how long it lasts and the single charge', () => {
    const w = packWording({ gymName: 'Puffin Performance', name: '10 class pack', credits: 10, validDays: 90, amountPence: 6000 });
    expect(w).toContain('10 class pack (10 classes, to use within 90 days of buying)');
    expect(w).toContain('£60.00 once, today');
    expect(w).toContain('comes back if I cancel in time');
  });
  it('says so when a pack never ends, and handles one class', () => {
    expect(packWords('Single', 1, null)).toBe('Single (1 class, with no end date)');
    expect(packWords('Day', 5, 1)).toBe('Day (5 classes, to use within 1 day of buying)');
  });
  it('pounds', () => {
    expect(poundsText(6050)).toBe('£60.50');
  });
});

describe('reading a class pack payment', () => {
  it('reads our own payment', () => {
    expect(packPaymentFrom(pi())).toEqual({ paymentId: 'pi_3Abc', gymId: G, userId: U, packTypeId: K, amountPence: 6000 });
  });
  it('takes the amount actually received, falling back to the amount', () => {
    expect(packPaymentFrom(pi({ amount_received: 5500 }))?.amountPence).toBe(5500);
    expect(packPaymentFrom(pi({ amount_received: 0 }))?.amountPence).toBe(6000);
  });
  it('ignores a payment that is not a class pack (such as a membership invoice payment)', () => {
    expect(packPaymentFrom(pi({ metadata: {} }))).toBeNull();
    expect(packPaymentFrom(pi({ metadata: { kind: 'membership', gym_id: G, user_id: U, pack_type_id: K } }))).toBeNull();
  });
  it('ignores one with a missing or odd id', () => {
    expect(packPaymentFrom(pi({ metadata: { kind: 'class_pack', gym_id: G, user_id: U } }))).toBeNull();
    expect(packPaymentFrom(pi({ metadata: { kind: 'class_pack', gym_id: 'x', user_id: U, pack_type_id: K } }))).toBeNull();
    expect(packPaymentFrom(pi({ id: 'sub_1' }))).toBeNull();
  });
  it('payment ids are safe to put in a web address', () => {
    expect(isPaymentIntentId('pi_3Abc')).toBe(true);
    expect(isPaymentIntentId('pi_3/../x')).toBe(false);
    expect(isPaymentIntentId('')).toBe(false);
  });
  it('the webhook reads it the same way', () => {
    expect(webhookPackPaymentFrom(pi())).toEqual(packPaymentFrom(pi()));
    expect(webhookPackPaymentFrom(pi({ metadata: {} }))).toBeNull();
  });
});
