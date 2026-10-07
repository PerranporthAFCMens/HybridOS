import { describe, expect, it } from 'vitest';
import { emptyForm, formFromPlan, includesText, planSummary, poundsText, toPence, validatePlan } from '../src/plans/calc';
import type { PlanDetail } from '../src/data/plans';

const plan = (over: Partial<PlanDetail> = {}): PlanDetail => ({
  id: 'p1', name: 'Hybrid Monthly', description: null, priceInPence: 4500, interval: 'monthly', accessType: 'hybrid',
  joiningFeeInPence: 0, classesPerWeek: null, includesOpenGym: true, includesClasses: true, includesPt: false, isPublic: true, isActive: true, ...over,
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
        classesPerWeek: 3, includesOpenGym: true, includesClasses: true, includesPt: true, isPublic: false,
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
