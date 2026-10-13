import { describe, expect, it } from 'vitest';
import { emptyForm, formFromPlan, includesText, planSummary, poundsText, toPence, validatePlan } from '../src/plans/calc';
import type { PlanDetail } from '../src/data/plans';

const plan = (over: Partial<PlanDetail> = {}): PlanDetail => ({
  id: 'p1', name: 'Hybrid Monthly', description: null, priceInPence: 4500, interval: 'monthly', accessType: 'hybrid',
  joiningFeeInPence: 0, classesPerWeek: null, includesOpenGym: true, includesClasses: true, includesPt: false, isPublic: true, canSwitchTo: false, minTermMonths: null, noticeDays: null, isActive: true, ...over,
});

describe('money', () => {
  it('turns typed pounds into pence without float drift', () => {
    expect(toPence('42')).toBe(4200);
    expect(toPence('42.50')).toBe(4250);
    expect(toPence('19.99')).toBe(1999);
    expect(toPence('0.29')).toBe(29);
    expect(toPence('0')).toBe(0);
  });
  it('rejects blanks, negatives and non-numbers', () => {
    expect(toPence('')).toBeNull();
    expect(toPence('  ')).toBeNull();
    expect(toPence('-1')).toBeNull();
    expect(toPence('abc')).toBeNull();
  });
  it('shows pence as pounds', () => expect(poundsText(4250)).toBe('42.50'));
});

describe('validatePlan', () => {
  const good = { ...emptyForm, name: ' Unlimited ', price: '42.00' };
  it('needs a name and a price', () => {
    expect(validatePlan({ ...good, name: '  ' })).toEqual({ ok: false, message: 'Add a name and valid price.' });
    expect(validatePlan({ ...good, price: '' }).ok).toBe(false);
    expect(validatePlan({ ...good, price: '-5' }).ok).toBe(false);
  });
  it('builds the exact values to save', () => {
    const r = validatePlan({ ...good, joiningFee: '10', classesPerWeek: '3', description: ' All access ', includesPt: true, isPublic: false });
    expect(r).toEqual({
      ok: true,
      input: {
        name: 'Unlimited', description: 'All access', priceInPence: 4200, interval: 'monthly', accessType: 'hybrid', joiningFeeInPence: 1000,
        classesPerWeek: 3, includesOpenGym: true, includesClasses: true, includesPt: true, isPublic: false, canSwitchTo: false, minTermMonths: null, noticeDays: null,
      },
    });
  });
  it('treats a blank joining fee as none, blank classes as unlimited and blank description as null', () => {
    const r = validatePlan({ ...good, joiningFee: '', classesPerWeek: '', description: '  ' });
    expect(r.ok && [r.input.joiningFeeInPence, r.input.classesPerWeek, r.input.description]).toEqual([0, null, null]);
  });
  it('allows 0 classes a week but not fractions or negatives', () => {
    const zero = validatePlan({ ...good, classesPerWeek: '0' });
    expect(zero.ok && zero.input.classesPerWeek).toBe(0);
    expect(validatePlan({ ...good, classesPerWeek: '1.5' }).ok).toBe(false);
    expect(validatePlan({ ...good, classesPerWeek: '-1' }).ok).toBe(false);
  });
  it('rejects a bad joining fee', () => expect(validatePlan({ ...good, joiningFee: '-2' }).ok).toBe(false));
});

describe('form and display', () => {
  it('round-trips a plan through the form', () => {
    const p = plan({ description: 'Hi', joiningFeeInPence: 1500, classesPerWeek: 2, includesPt: true, isPublic: false });
    const r = validatePlan(formFromPlan(p));
    expect(r.ok && r.input).toMatchObject({ name: p.name, priceInPence: 4500, joiningFeeInPence: 1500, classesPerWeek: 2, includesPt: true, isPublic: false, description: 'Hi' });
  });
  it('summarises and describes what is included', () => {
    expect(planSummary([plan(), plan({ id: 'p2', isActive: false })])).toBe('1 active · 2 total');
    expect(includesText(plan())).toBe('Open gym · Classes · Unlimited classes');
    expect(includesText(plan({ includesOpenGym: false, includesPt: true, classesPerWeek: 3 }))).toBe('Classes · PT · 3 classes/week');
  });
});

describe('plan terms in the form', () => {
  const ok = (over: Partial<ReturnType<typeof formFromPlan>>) => validatePlan({ ...emptyForm, name: 'Gold', price: '40', ...over });
  it('blank means use the gym-wide setting', () => {
    const r = ok({});
    expect(r.ok && [r.input.minTermMonths, r.input.noticeDays]).toEqual([null, null]);
  });
  it('accepts any whole numbers within the limits, including zero', () => {
    const r = ok({ minTerm: '6', notice: '14' });
    expect(r.ok && [r.input.minTermMonths, r.input.noticeDays]).toEqual([6, 14]);
    const z = ok({ minTerm: '0', notice: '0' });
    expect(z.ok && [z.input.minTermMonths, z.input.noticeDays]).toEqual([0, 0]);
    const long = ok({ minTerm: '24', notice: '90' });
    expect(long.ok).toBe(true);
  });
  it('refuses what is not a whole number or is out of range', () => {
    expect(ok({ minTerm: '-1' }).ok).toBe(false);
    expect(ok({ minTerm: '1.5' }).ok).toBe(false);
    expect(ok({ minTerm: '61' }).ok).toBe(false);
    expect(ok({ notice: 'a month' }).ok).toBe(false);
    expect(ok({ notice: '366' }).ok).toBe(false);
  });
  it('shows a plan\'s saved terms back in the form', () => {
    expect(formFromPlan(plan({ minTermMonths: 12, noticeDays: 30 }))).toMatchObject({ minTerm: '12', notice: '30' });
    expect(formFromPlan(plan())).toMatchObject({ minTerm: '', notice: '' });
  });
});
