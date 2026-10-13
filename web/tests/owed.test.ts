import { describe, expect, it } from 'vitest';
import type { Debtor, MissedPayment } from '../src/data/arrears';
import { alertLine, biggestDebts, daysLate, findDebtors, HOW_WORDS, missedTable, missedText, owedOf, owedTable, reasonWords, shortDate, stateWords, totalMissed, totalOwed } from '../src/reports/owed';
import { overdueOptions } from '../src/payments/calc';

const d = (o: Partial<Debtor> = {}): Debtor => ({ userId: 'u1', name: 'Priya Nair', planName: 'Basic', membershipStatus: 'active', owedPence: 7000, missedCount: 2, oldestMissed: '2026-09-10', latestMissed: '2026-10-10', latestReason: 'insufficient_funds', ...o });
const p = (o: Partial<MissedPayment> = {}): MissedPayment => ({ id: 'p1', chargeDate: '2026-10-10', amountPence: 4000, state: 'failed', reason: 'insufficient_funds', planName: 'Basic', provider: 'manual', outstanding: true, settledHow: null, settledNote: null, settledAt: null, settledBy: null, ...o });
const ctx = { gymName: 'Puffin Performance', rangeLabel: 'Right now', now: new Date('2026-10-13T10:00:00Z') };

describe('money owed totals', () => {
  it('adds up what is owed and how many payments were missed', () => {
    const rows = [d(), d({ userId: 'u2', name: 'Sam Lee', owedPence: 5000, missedCount: 1 })];
    expect(totalOwed(rows)).toBe(12000);
    expect(totalMissed(rows)).toBe(3);
    expect(totalOwed([])).toBe(0);
  });
  it('adds up only what is still outstanding for one person', () => {
    expect(owedOf([p(), p({ id: 'p2', amountPence: 3000 }), p({ id: 'p3', amountPence: 2500, outstanding: false, settledHow: 'paid' })])).toBe(7000);
  });
});

describe('finding a member', () => {
  const rows = [d(), d({ userId: 'u2', name: 'Sam Lee', planName: 'Pro' })];
  it('matches part of a name or plan, in any case', () => {
    expect(findDebtors(rows, 'priya').map((r) => r.userId)).toEqual(['u1']);
    expect(findDebtors(rows, 'PRO').map((r) => r.userId)).toEqual(['u2']);
    expect(findDebtors(rows, '  ').length).toBe(2);
    expect(findDebtors(rows, 'zzz')).toEqual([]);
  });
});

describe('the words', () => {
  it('turns bank codes into a sentence and leaves real sentences alone', () => {
    expect(reasonWords('insufficient_funds')).toBe('Insufficient funds');
    expect(reasonWords('authorisation_disputed')).toBe('Authorisation disputed');
    expect(reasonWords('Not enough in the account')).toBe('Not enough in the account');
    expect(reasonWords(null)).toBe('');
    expect(reasonWords('   ')).toBe('');
  });
  it('says what happened to a payment', () => {
    expect(stateWords('failed')).toBe('Payment failed');
    expect(stateWords('charged_back')).toBe('Charged back');
    expect(stateWords('pending')).toBe('Not received');
    expect(stateWords('submitted')).toBe('Not received');
    expect(stateWords('paid_out')).toBe('Paid out');
  });
  it('says how a payment was dealt with', () => {
    expect(HOW_WORDS).toEqual({ paid: 'Paid another way', waived: 'Waived', written_off: 'Written off' });
  });
  it('reads dates and counts naturally', () => {
    expect(shortDate('2026-10-02')).toBe('2 Oct 2026');
    expect(shortDate('2026-10-02T12:00:00+00:00')).toBe('2 Oct 2026');
    expect(shortDate(null)).toBe('');
    expect(missedText(1)).toBe('1 missed payment');
    expect(missedText(3)).toBe('3 missed payments');
  });
  it('counts whole days late and never goes below zero', () => {
    expect(daysLate('2026-10-10', new Date(2026, 9, 13))).toBe(3);
    expect(daysLate('2026-10-13', new Date(2026, 9, 13))).toBe(0);
    expect(daysLate('2026-10-20', new Date(2026, 9, 13))).toBe(0);
    expect(daysLate(null, new Date())).toBe(0);
  });
});

describe('the downloads', () => {
  it('lists everyone with what they owe', () => {
    const t = owedTable(ctx, [d()]);
    expect(t.title).toBe('Money owed');
    expect(t.headers).toEqual(['Member', 'Plan', 'Membership', 'Owed', 'Missed payments', 'Oldest missed', 'Latest reason']);
    expect(t.rows).toEqual([['Priya Nair', 'Basic', 'active', '£70.00', 2, '10 Sep 2026', 'Insufficient funds']]);
  });
  it('lists one person\'s missed and settled payments', () => {
    const t = missedTable(ctx, 'Priya Nair', [p(), p({ id: 'p2', amountPence: 3000, outstanding: false, settledHow: 'waived', settledNote: 'Hardship' })]);
    expect(t.title).toBe('Missed payments: Priya Nair');
    expect(t.rows[0]).toEqual(['10 Oct 2026', '£40.00', 'Payment failed', 'Insufficient funds', 'Basic', 'Still owed', '']);
    expect(t.rows[1]?.[5]).toBe('Waived');
    expect(t.rows[1]?.[6]).toBe('Hardship');
  });
});

describe('the late payment setting', () => {
  it('offers the usual choices and never hides the current one', () => {
    expect(overdueOptions(7).map((o) => o.value)).toEqual([0, 3, 7, 14, 30]);
    expect(overdueOptions(10).map((o) => o.value)).toEqual([0, 3, 7, 10, 14, 30]);
    expect(overdueOptions(0)[0]?.label).toBe('The day after it is due');
    expect(overdueOptions(7).find((o) => o.value === 14)?.label).toBe('14 days after it is due');
  });
});

describe('the front dashboard alert', () => {
  const rows = [d(), d({ userId: 'u2', name: 'Sam Lee', owedPence: 5000, missedCount: 1 }), d({ userId: 'u3', name: 'Dee', owedPence: 1500, missedCount: 1 }), d({ userId: 'u4', name: 'Quinn', owedPence: 9000, missedCount: 3 })];
  it('says how many owe how much', () => {
    expect(alertLine(rows)).toBe('4 people owe £225.00 across 7 missed payments');
    expect(alertLine([d({ owedPence: 2500, missedCount: 1 })])).toBe('1 person owes £25.00 across 1 missed payment');
  });
  it('names the biggest debts first', () => {
    expect(biggestDebts(rows).map((r) => `${r.name} ${r.owed}`)).toEqual(['Quinn £90.00', 'Priya Nair £70.00', 'Sam Lee £50.00']);
    expect(biggestDebts(rows, 1)).toHaveLength(1);
  });
});
