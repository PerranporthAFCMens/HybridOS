import { describe, expect, it } from 'vitest';
import { accountIdempotencyKey, accountState, DEFAULT_API_VERSION, environmentOf, returnAllowed } from '../../supabase/functions/stripe-connect/index';
import { hourOptions, stripeStatus, windowText } from '../src/payments/calc';

describe('which Stripe environment a key is for', () => {
  it('tells test from live and refuses anything else', () => {
    expect(environmentOf('sk_test_abc')).toBe('sandbox');
    expect(environmentOf('rk_test_abc')).toBe('sandbox');
    expect(environmentOf('sk_live_abc')).toBe('live');
    expect(environmentOf('pk_live_abc')).toBeNull();
    expect(environmentOf('')).toBeNull();
  });
});

describe('where Stripe may send the owner back to', () => {
  const origins = ['https://www.hybridone.co.uk/', 'https://perranporthafcmens.github.io'];
  it('allows our own site only, over https', () => {
    expect(returnAllowed('https://www.hybridone.co.uk/payments', origins)).toBe(true);
    expect(returnAllowed('https://perranporthafcmens.github.io/HybridOS/payments', origins)).toBe(true);
    expect(returnAllowed('http://www.hybridone.co.uk/payments', origins)).toBe(false);
    expect(returnAllowed('https://www.hybridone.co.uk.evil.example/payments', origins)).toBe(false);
    expect(returnAllowed('https://evil.example/?https://www.hybridone.co.uk', origins)).toBe(false);
    expect(returnAllowed('not a url', origins)).toBe(false);
    expect(returnAllowed('', origins)).toBe(false);
  });
});

const merchant = (card: string, payouts = 'inactive') => ({ configuration: { merchant: { capabilities: { card_payments: { status: card }, stripe_balance: { payouts: { status: payouts } } } } } });

describe('what we keep of a Stripe account (Accounts v2)', () => {
  it('reads the capabilities as three yes/no answers', () => {
    expect(accountState(merchant('active', 'active'))).toEqual({ details_submitted: true, charges_enabled: true, payouts_enabled: true, last_error: null });
    expect(accountState(merchant('active'))).toMatchObject({ charges_enabled: true, payouts_enabled: false });
  });
  it('treats a capability Stripe is still reviewing as details sent but not ready', () => {
    expect(accountState(merchant('pending'))).toMatchObject({ details_submitted: true, charges_enabled: false });
  });
  it('treats a brand new account as not started', () => {
    expect(accountState({})).toEqual({ details_submitted: false, charges_enabled: false, payouts_enabled: false, last_error: null });
    expect(accountState(merchant('inactive'))).toMatchObject({ details_submitted: false, charges_enabled: false });
  });
  it('says what Stripe is waiting for, in words', () => {
    const s = accountState({ ...merchant('restricted'), requirements: { entries: [
      { description: 'individual.id_number', minimum_deadline: { status: 'currently_due' } },
      { description: 'external_account', minimum_deadline: { status: 'past_due' } },
      { description: 'business_profile.url', minimum_deadline: { status: 'currently_due' } },
      { description: 'tos_acceptance.date', minimum_deadline: { status: 'currently_due' } },
      { description: 'later.thing', minimum_deadline: { status: 'eventually_due' } },
    ] } });
    expect(s.last_error).toBe('Stripe still needs: individual id number, external account, business profile url and more.');
    expect(s.details_submitted).toBe(false);
  });
  it('says when Stripe has not allowed card payments', () => {
    expect(accountState(merchant('restricted')).last_error).toBe('Stripe has not allowed card payments on this account (restricted).');
    expect(accountState(merchant('unsupported')).last_error).toContain('unsupported');
  });
  it('does not complain once it can take payments', () => {
    expect(accountState({ ...merchant('active'), requirements: { entries: [{ description: 'x', minimum_deadline: { status: 'currently_due' } }] } }).last_error).toBeNull();
  });
  it('copes with anything odd', () => {
    expect(accountState({ configuration: null, requirements: 'x' } as never)).toMatchObject({ charges_enabled: false });
  });
});

describe('the payments page wording', () => {
  const link = { environment: 'sandbox' as const, detailsSubmitted: false, chargesEnabled: false, payoutsEnabled: false, problem: null };
  it('walks through not connected, unfinished, checking and ready', () => {
    expect(stripeStatus(null)).toMatchObject({ step: 'none', button: 'Connect Stripe' });
    expect(stripeStatus(link)).toMatchObject({ step: 'unfinished', headline: 'Stripe set-up is not finished.', button: 'Finish set-up on Stripe' });
    expect(stripeStatus({ ...link, detailsSubmitted: true })).toMatchObject({ step: 'unfinished', headline: 'Stripe is checking your details.' });
    expect(stripeStatus({ ...link, problem: 'Stripe still needs: x.' }).detail).toBe('Stripe still needs: x.');
    expect(stripeStatus({ ...link, detailsSubmitted: true, chargesEnabled: true, payoutsEnabled: true })).toMatchObject({ step: 'ready', detail: 'Payouts to your bank are on.' });
    expect(stripeStatus({ ...link, detailsSubmitted: true, chargesEnabled: true }).detail).toContain('payouts');
  });
  it('reads the cancellation window naturally', () => {
    expect(windowText(0)).toBe('right up to the start of the class');
    expect(windowText(1)).toBe('up to 1 hour before the class');
    expect(windowText(6)).toBe('up to 6 hours before the class');
    expect(windowText(24)).toBe('up to 1 day before the class');
    expect(windowText(48)).toBe('up to 2 days before the class');
    expect(windowText(30)).toBe('up to 30 hours before the class');
  });
  it('lists the usual choices and never hides the current one', () => {
    expect(hourOptions(24).map((o) => o.value)).toEqual([0, 1, 2, 4, 6, 12, 24, 48, 72, 168]);
    expect(hourOptions(30).map((o) => o.value)).toContain(30);
    expect(hourOptions(0)[0]?.label).toBe('No notice needed');
    expect(hourOptions(24).find((o) => o.value === 168)?.label).toBe('7 days before');
  });
});

describe('the key that stops a double click making two accounts', () => {
  it('is the same within a minute and different the next, so an old failure is never replayed', () => {
    const t = Date.UTC(2026, 9, 13, 10, 16, 39);
    expect(accountIdempotencyKey('sandbox', 'g1', t)).toBe(accountIdempotencyKey('sandbox', 'g1', t + 5000));
    expect(accountIdempotencyKey('sandbox', 'g1', t)).not.toBe(accountIdempotencyKey('sandbox', 'g1', t + 60000));
    expect(accountIdempotencyKey('sandbox', 'g1', t)).not.toBe(accountIdempotencyKey('live', 'g1', t));
    expect(accountIdempotencyKey('sandbox', 'g1', t)).not.toBe(accountIdempotencyKey('sandbox', 'g2', t));
  });
});

describe('the Stripe API version', () => {
  it('is a dated version Stripe will accept for Accounts v2', () => {
    expect(DEFAULT_API_VERSION).toMatch(/^\d{4}-\d{2}-\d{2}\.[a-z]+$/);
  });
});
