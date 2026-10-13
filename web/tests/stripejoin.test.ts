import { describe, expect, it } from 'vitest';
import { agreementWording, cardOf, environmentOf, invoiceSecret, isUnder18, nextPaymentDate, poundsText, recurringOf, stripeForm, todayUtc } from '../../supabase/functions/stripe-join/index';

describe('Stripe form encoding', () => {
  it('uses brackets for nested values, indexes for lists of objects and [] for lists of plain values', () => {
    expect(stripeForm({ customer: 'cus_1', items: [{ price: 'price_1' }], payment_settings: { save_default_payment_method: 'on_subscription' }, expand: ['latest_invoice.confirmation_secret'], skip: undefined, no: null }))
      .toBe('customer=cus_1&items%5B0%5D%5Bprice%5D=price_1&payment_settings%5Bsave_default_payment_method%5D=on_subscription&expand%5B%5D=latest_invoice.confirmation_secret');
  });
  it('encodes awkward text', () => {
    expect(stripeForm({ name: 'Puffin & Co: Hybrid' })).toBe('name=Puffin%20%26%20Co%3A%20Hybrid');
  });
});

describe('what Stripe is asked for', () => {
  it('maps the plan intervals to Stripe, and leaves one-off plans alone', () => {
    expect(recurringOf('monthly')).toEqual({ interval: 'month', interval_count: 1 });
    expect(recurringOf('weekly')).toEqual({ interval: 'week', interval_count: 1 });
    expect(recurringOf('quarterly')).toEqual({ interval: 'month', interval_count: 3 });
    expect(recurringOf('annual')).toEqual({ interval: 'year', interval_count: 1 });
    expect(recurringOf('one_off')).toBeNull();
    expect(recurringOf('')).toBeNull();
  });
  it('tells test from live keys', () => {
    expect(environmentOf('sk_test_x')).toBe('sandbox');
    expect(environmentOf('sk_live_x')).toBe('live');
    expect(environmentOf('pk_test_x')).toBeNull();
  });
  it('writes money as pounds', () => {
    expect(poundsText(5310)).toBe('£53.10');
    expect(poundsText(0)).toBe('£0.00');
    expect(poundsText(-5)).toBe('£0.00');
  });
});

describe('under 18', () => {
  it('is decided on the day, not the year', () => {
    expect(isUnder18('2008-10-14', '2026-10-13')).toBe(true);
    expect(isUnder18('2008-10-13', '2026-10-13')).toBe(false);
    expect(isUnder18('2000-01-01', '2026-10-13')).toBe(false);
    expect(isUnder18('rubbish', '2026-10-13')).toBe(false);
  });
});

describe('the agreement the member gives', () => {
  const base = { gymName: 'Puffin Performance', planName: 'Hybrid', interval: 'monthly', amountPence: 5900, dueTodayPence: 5900, nextPaymentDate: '2026-11-13', memberName: 'Priya Nair', guardianName: null };
  it('says they want to start today, the 14 day right, the amounts and the dates', () => {
    const w = agreementWording(base);
    expect(w).toContain('I want the Hybrid membership at Puffin Performance to start today.');
    expect(w).toContain('cancel within 14 days');
    expect(w).toContain('charge this card £59.00 today, then £59.00 every month from 13 Nov 2026');
    expect(w).toContain('any payment I miss');
  });
  it('names the parent or guardian when they pay for someone under 18', () => {
    const w = agreementWording({ ...base, guardianName: 'Alex Parent', memberName: 'Jamie' });
    expect(w).toContain("I am Jamie's parent or guardian.");
    expect(w).toContain('responsible for Jamie while at the gym');
  });
  it('states a different amount today when a discount applies', () => {
    expect(agreementWording({ ...base, dueTodayPence: 0 })).toContain('charge this card £0.00 today, then £59.00 every month');
  });
  it('reads other intervals', () => {
    expect(agreementWording({ ...base, interval: 'quarterly' })).toContain('every 3 months');
    expect(agreementWording({ ...base, interval: 'annual' })).toContain('every year');
  });
});

describe('reading what Stripe sends back', () => {
  it('finds the card form secret in either shape of invoice', () => {
    expect(invoiceSecret({ confirmation_secret: { client_secret: 'pi_1_secret_a' } })).toBe('pi_1_secret_a');
    expect(invoiceSecret({ payment_intent: { client_secret: 'pi_2_secret_b' } })).toBe('pi_2_secret_b');
    expect(invoiceSecret({})).toBe('');
  });
  it('keeps only the brand, last four and expiry of a card', () => {
    expect(cardOf({ id: 'pm_1', card: { brand: 'visa', last4: '4242', exp_month: 12, exp_year: 2030, number: '4242424242424242', fingerprint: 'x' } })).toEqual({ id: 'pm_1', brand: 'visa', last4: '4242', month: 12, year: 2030 });
    expect(cardOf(null)).toBeNull();
    expect(cardOf({ id: 'pm_2', card: { brand: 'visa', last4: 'oops' } })).toBeNull();
  });
  it('finds the next payment date from the subscription item or the subscription', () => {
    const t = Date.UTC(2026, 10, 13) / 1000;
    expect(nextPaymentDate({ items: { data: [{ current_period_end: t }] } })).toBe('2026-11-13');
    expect(nextPaymentDate({ current_period_end: t })).toBe('2026-11-13');
    expect(nextPaymentDate({})).toBe('');
    expect(todayUtc(Date.UTC(2026, 9, 13, 23, 59))).toBe('2026-10-13');
  });
});
