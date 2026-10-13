import { describe, expect, it } from 'vitest';
import { accountState, environmentOf, returnAllowed, stripeForm } from '../../supabase/functions/stripe-connect/index';
import { hourOptions, stripeStatus, windowText } from '../src/payments/calc';

describe('Stripe form encoding', () => {
  it('uses brackets for nested values and skips empty ones', () => {
    expect(stripeForm({ type: 'standard', country: 'GB', metadata: { gym_id: 'g1' }, business_profile: { name: 'Puffin & Co' }, skip: undefined, nope: null })).toBe('type=standard&country=GB&metadata%5Bgym_id%5D=g1&business_profile%5Bname%5D=Puffin%20%26%20Co');
  });
});

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

describe('what we keep of a Stripe account', () => {
  it('keeps three yes/no answers', () => {
    expect(accountState({ details_submitted: true, charges_enabled: true, payouts_enabled: false })).toEqual({ details_submitted: true, charges_enabled: true, payouts_enabled: false, last_error: null });
  });
  it('says what Stripe is waiting for, in words', () => {
    const s = accountState({ details_submitted: false, charges_enabled: false, payouts_enabled: false, requirements: { currently_due: ['individual.id_number', 'external_account', 'business_profile.url', 'tos_acceptance.date'] } });
    expect(s.last_error).toBe('Stripe still needs: individual id number, external account, business profile url and more.');
  });
  it('says when Stripe has paused it', () => {
    expect(accountState({ charges_enabled: false, requirements: { disabled_reason: 'requirements.past_due' } }).last_error).toBe('Stripe has paused this account (requirements past due).');
  });
  it('does not complain once it can take payments', () => {
    expect(accountState({ charges_enabled: true, requirements: { currently_due: ['x'] } }).last_error).toBeNull();
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
