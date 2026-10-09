import { describe, expect, it } from 'vitest';
import { DEFAULT_FORM, cancelSentence, describeRequest, formFromRow, pauseProblem, pauseSentence, readOptions, validateRules } from '../src/membership/calc';

const pause = { enabled: true, allowed: true, reason: '', minWeeks: 2, maxWeeks: 8, noticeDays: 7, maxPerYear: 2, used: 0, feePence: 500, approval: 'admin' as const, earliestStart: '2026-10-20' };

describe('validateRules', () => {
  it('turns the default form into rows with everything off', () => {
    const r = validateRules(DEFAULT_FORM);
    expect(r.ok && r.row).toMatchObject({ pause_enabled: false, cancel_enabled: false, upgrade_enabled: false, downgrade_enabled: false, pause_fee_pence: 0, pause_approval: 'admin' });
  });
  it('reads pounds as pence', () => {
    const r = validateRules({ ...DEFAULT_FORM, pauseFee: '5', cancelFee: '25.50' });
    expect(r.ok && [r.row.pause_fee_pence, r.row.cancel_early_fee_pence]).toEqual([500, 2550]);
  });
  it.each([
    [{ pauseMin: '0' }, /shortest pause/],
    [{ pauseMin: '9', pauseMax: '8' }, /cannot be longer/],
    [{ pauseNotice: '-1' }, /Pause notice/],
    [{ pauseMaxYear: '1.5' }, /Pauses allowed/],
    [{ pauseFee: 'abc' }, /pause fee/],
    [{ cancelTerm: '99' }, /minimum term/],
    [{ changeMin: '' }, /between plan changes/],
  ])('refuses %j', (over, message) => {
    const r = validateRules({ ...DEFAULT_FORM, ...over });
    expect(r.ok).toBe(false);
    expect(!r.ok && r.message).toMatch(message);
  });
  it('round trips through a saved row', () => {
    const r = validateRules({ ...DEFAULT_FORM, pauseEnabled: true, pauseFee: '5', cancelEarly: 'fee', cancelFee: '25', upgrade: true, upgradeStarts: 'next_month', pauseApproval: 'auto' });
    if (!r.ok) throw new Error(r.message);
    const row = { ...r.row, gym_id: 'g', updated_at: '', updated_by: null };
    expect(validateRules(formFromRow(row))).toEqual(r);
  });
  it('no saved row means the defaults', () => expect(formFromRow(null)).toEqual(DEFAULT_FORM));
});

describe('readOptions', () => {
  it('is null without a membership, and survives rubbish', () => {
    expect(readOptions(null)).toBeNull();
    expect(readOptions({ membership: {} })).toBeNull();
    expect(readOptions('x')).toBeNull();
  });
  it('reads what the database sends and defaults the rest', () => {
    const o = readOptions({ membership: { id: 'm1', status: 'active', plan_name: 'Gold', price_pence: 3500 }, pause: { enabled: true, approval: 'auto' }, change: { plans: [{ id: 'p2', name: 'All', direction: 'up' }] }, requests: [{ id: 'r1', kind: 'pause', status: 'pending' }] });
    expect(o?.membership).toMatchObject({ id: 'm1', planName: 'Gold', pricePence: 3500, endsOn: null });
    expect(o?.pause).toMatchObject({ enabled: true, allowed: false, approval: 'auto' });
    expect(o?.cancel.enabled).toBe(false);
    expect(o?.change.plans).toEqual([{ id: 'p2', name: 'All', pricePence: 0, interval: '', direction: 'up', startsOn: '' }]);
    expect(o?.requests[0]).toMatchObject({ id: 'r1', kind: 'pause', untilOn: null });
  });
});

describe('words and checks', () => {
  it('pause sentence', () => expect(pauseSentence(pause)).toBe('2 to 8 weeks. 7 days notice. £5.00 fee.'));
  it('pause sentence without a fee or range', () => expect(pauseSentence({ ...pause, minWeeks: 1, maxWeeks: 1, noticeDays: 1, feePence: 0 })).toBe('1 week. 1 day notice. no fee.'));
  it('cancel sentence', () => {
    const c = { enabled: true, allowed: true, reason: '', noticeDays: 30, minTermMonths: 6, earlyMode: 'fee', offerPause: true, askReason: true, approval: 'admin' as const, inTerm: true, lastDay: '', feePence: 2500, termEndsOn: '' };
    expect(cancelSentence(c)).toBe('30 days notice. leave early for a £25.00 fee in the first 6 months. reviewed by the gym.');
  });
  it('pauseProblem', () => {
    expect(pauseProblem(pause, '', '')).toMatch(/Choose when/);
    expect(pauseProblem(pause, '2026-10-19', '2026-11-30')).toMatch(/7 days notice/);
    expect(pauseProblem(pause, '2026-10-20', '2026-10-20')).toMatch(/end after/);
    expect(pauseProblem(pause, '2026-10-20', '2026-10-27')).toMatch(/between 2 weeks and 8 weeks/);
    expect(pauseProblem(pause, '2026-10-20', '2026-11-17')).toBeNull();
  });
  it('describeRequest', () => {
    const plans = new Map([['p2', 'All Access']]);
    expect(describeRequest({ kind: 'pause', effectiveOn: '2026-11-01', untilOn: '2026-11-29', toPlanId: null, feePence: 500 }, plans)).toBe('from 1 Nov 2026 to 29 Nov 2026. Fee £5.00.');
    expect(describeRequest({ kind: 'cancel', effectiveOn: '2026-11-01', untilOn: null, toPlanId: null, feePence: 0 }, plans)).toBe('last day 1 Nov 2026.');
    expect(describeRequest({ kind: 'change_plan', effectiveOn: '2026-11-01', untilOn: null, toPlanId: 'p2', feePence: 0, direction: 'up' }, plans)).toBe('move to All Access from 1 Nov 2026 (bigger plan).');
  });
});
