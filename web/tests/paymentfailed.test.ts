import { describe, expect, it } from 'vitest';
import { failureWords, membershipEndedMail, paymentFailedMail, poundsOf } from '../../supabase/functions/stripe-webhook/index';
import { paymentNoticeText, readPaymentNotice } from '../src/member/paymentNotice';

const p = (n: number) => `£${(n / 100).toFixed(2)}`;

describe('failed payment emails', () => {
  it('says what failed, how much, and what to do', () => {
    const m = paymentFailedMail({ gymName: 'Puffin Performance', firstName: 'Sam', amountPence: 4500, reason: failureWords('insufficient_funds'), link: 'https://x.test/' });
    expect(m.subject).toBe('Your Puffin Performance payment did not go through');
    expect(m.text).toContain('Hi Sam,');
    expect(m.text).toContain('£45.00');
    expect(m.text).toContain('not enough money');
    expect(m.html).toContain('https://x.test/');
  });
  it('escapes a gym name and keeps the subject on one line', () => {
    const m = membershipEndedMail({ gymName: 'A<b>\nB', firstName: '', link: 'https://x.test/' });
    expect(m.html).not.toContain('<b>');
    expect(m.subject).not.toMatch(/[\r\n]/);
    expect(m.text.startsWith('Hi,')).toBe(true);
  });
  it('words money and reasons plainly', () => {
    expect(poundsOf(-5)).toBe('£0.00');
    expect(failureWords('card_expired')).toContain('expired');
    expect(failureWords('something_new')).toBe('the payment did not go through');
  });
});

describe('the notice a member sees', () => {
  it('shows nothing when nothing is wrong, or the data is odd', () => {
    expect(paymentNoticeText(readPaymentNotice({ failed_count: 0, owed_pence: 0, ended_for_non_payment: false }), p)).toBeNull();
    expect(paymentNoticeText(readPaymentNotice(null), p)).toBeNull();
    expect(paymentNoticeText(readPaymentNotice('x'), p)).toBeNull();
  });
  it('tells them about a failed payment and the amount', () => {
    const t = paymentNoticeText(readPaymentNotice({ failed_count: 1, owed_pence: 4500 }), p);
    expect(t?.title).toBe('Your last payment did not go through');
    expect(t?.body).toContain('£45.00');
  });
  it('tells them when the membership has ended', () => {
    expect(paymentNoticeText(readPaymentNotice({ failed_count: 2, ended_for_non_payment: true }), p)?.title).toBe('Your membership has ended');
  });
});
