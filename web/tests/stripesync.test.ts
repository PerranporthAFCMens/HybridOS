import { describe, expect, it } from 'vitest';
import { actionFor, environmentOf, londonMidnightUnix, stripeForm } from '../../supabase/functions/stripe-membership-sync/index';

const state = (over: Record<string, unknown> = {}) => ({
  ok: true, today: '2026-10-14',
  membership: { id: 'm1', status: 'active', payment_provider: 'stripe', provider_subscription_id: 'sub_1' },
  account: { stripe_account_id: 'acct_1', environment: 'sandbox' },
  cancel: null,
  ...over,
});

describe('the London start of a day', () => {
  it('is an hour before UTC midnight in summer and the same as UTC midnight in winter', () => {
    expect(londonMidnightUnix('2026-07-01')).toBe(Date.UTC(2026, 6, 1) / 1000 - 3600);
    expect(londonMidnightUnix('2026-12-01')).toBe(Date.UTC(2026, 11, 1) / 1000);
  });
  it('is right on the days the clocks change', () => {
    expect(londonMidnightUnix('2026-03-29')).toBe(Date.UTC(2026, 2, 29) / 1000); // clocks go forward at 1am: midnight is still GMT
    expect(londonMidnightUnix('2026-03-30')).toBe(Date.UTC(2026, 2, 30) / 1000 - 3600);
    expect(londonMidnightUnix('2026-10-25')).toBe(Date.UTC(2026, 9, 25) / 1000 - 3600); // clocks go back at 2am: midnight is still BST
    expect(londonMidnightUnix('2026-10-26')).toBe(Date.UTC(2026, 9, 26) / 1000);
  });
  it('gives 0 for a date it cannot read', () => {
    expect(londonMidnightUnix('tomorrow')).toBe(0);
  });
});

describe('what to do to the Stripe subscription', () => {
  it('does nothing for a membership that is not paid through Stripe', () => {
    expect(actionFor(state({ membership: { id: 'm1', status: 'active', payment_provider: 'manual', provider_subscription_id: null } }), {}).kind).toBe('none');
  });
  it('does nothing when Stripe has already cancelled it', () => {
    expect(actionFor(state({ membership: { id: 'm1', status: 'cancelled', payment_provider: 'stripe', provider_subscription_id: 'sub_1' } }), { status: 'canceled' }).kind).toBe('none');
  });
  it('cancels now when the membership is over', () => {
    for (const status of ['cancelled', 'expired']) {
      expect(actionFor(state({ membership: { id: 'm1', status, payment_provider: 'stripe', provider_subscription_id: 'sub_1' } }), { status: 'active' }).kind).toBe('cancel_now');
    }
  });
  it('cancels now when an ending has come due', () => {
    expect(actionFor(state({ cancel: { effective_on: '2026-10-14', status: 'applied' } }), { status: 'active' }).kind).toBe('cancel_now');
  });
  it('schedules the stop for the start of the day after the last day', () => {
    const a = actionFor(state({ cancel: { effective_on: '2026-11-15', status: 'approved' } }), { status: 'active', cancel_at: null });
    expect(a).toEqual({ kind: 'cancel_at', at: londonMidnightUnix('2026-11-15'), lastDay: '2026-11-14' });
  });
  it('leaves Stripe alone when it already stops on that day', () => {
    expect(actionFor(state({ cancel: { effective_on: '2026-11-15', status: 'approved' } }), { status: 'active', cancel_at: londonMidnightUnix('2026-11-15') }).kind).toBe('none');
  });
  it('moves the stop when the date changed', () => {
    expect(actionFor(state({ cancel: { effective_on: '2026-12-01', status: 'approved' } }), { status: 'active', cancel_at: londonMidnightUnix('2026-11-15') }).kind).toBe('cancel_at');
  });
  it('removes a scheduled stop when nothing is booked any more', () => {
    expect(actionFor(state(), { status: 'active', cancel_at: 1800000000 }).kind).toBe('clear');
    expect(actionFor(state(), { status: 'active', cancel_at: null, cancel_at_period_end: true }).kind).toBe('clear');
  });
  it('does nothing when nothing is booked and nothing is scheduled', () => {
    expect(actionFor(state(), { status: 'active', cancel_at: null }).kind).toBe('none');
  });
});

describe('small helpers', () => {
  it('encodes a simple form and skips blanks', () => {
    expect(stripeForm({ cancel_at: 1800000000, proration_behavior: 'none', skip: undefined, no: null })).toBe('cancel_at=1800000000&proration_behavior=none');
    expect(stripeForm({ cancel_at: '' })).toBe('cancel_at=');
  });
  it('tells test keys from live keys', () => {
    expect(environmentOf('sk_test_123')).toBe('sandbox');
    expect(environmentOf('rk_live_123')).toBe('live');
    expect(environmentOf('pk_test_123')).toBeNull();
  });
});
