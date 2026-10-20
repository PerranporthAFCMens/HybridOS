import { describe, expect, it } from 'vitest';
import { emptyPackForm, formFromPack, packSummary, perClassText, validatePackType, validityText } from '../src/packs/calc';
import type { PackType } from '../src/data/classPacks';

const type = (over: Partial<PackType> = {}): PackType => ({ id: 'k1', name: '10 class pack', credits: 10, pricePence: 6000, validDays: 90, isActive: true, ...over });

describe('validatePackType', () => {
  const ok = { name: '10 class pack', credits: '10', price: '60', validDays: '90' };
  it('turns what was typed into pence and whole numbers', () => {
    expect(validatePackType(ok)).toEqual({ ok: true, input: { name: '10 class pack', credits: 10, pricePence: 6000, validDays: 90 } });
    expect(validatePackType({ ...ok, name: '  Drop-in ', credits: '1', price: '12.5', validDays: '' })).toEqual({ ok: true, input: { name: 'Drop-in', credits: 1, pricePence: 1250, validDays: null } });
  });
  it('allows a free pack', () => {
    expect(validatePackType({ ...ok, price: '0' })).toMatchObject({ ok: true, input: { pricePence: 0 } });
  });
  it('needs a name, a price and a sensible number of classes', () => {
    expect(validatePackType({ ...ok, name: '   ' })).toMatchObject({ ok: false });
    expect(validatePackType({ ...ok, name: 'x'.repeat(81) })).toMatchObject({ ok: false });
    expect(validatePackType({ ...ok, price: '' })).toMatchObject({ ok: false });
    expect(validatePackType({ ...ok, price: '-1' })).toMatchObject({ ok: false });
    for (const credits of ['0', '201', '2.5', '', 'ten']) expect(validatePackType({ ...ok, credits })).toMatchObject({ ok: false });
    expect(validatePackType({ ...ok, credits: '200' })).toMatchObject({ ok: true });
  });
  it('days are whole numbers from 1 to 730, or blank for never', () => {
    for (const validDays of ['0', '731', '1.5', 'soon', '-5']) expect(validatePackType({ ...ok, validDays })).toMatchObject({ ok: false });
    expect(validatePackType({ ...ok, validDays: '730' })).toMatchObject({ ok: true, input: { validDays: 730 } });
  });
});

describe('wording', () => {
  it('works out the price of one class', () => {
    expect(perClassText(type())).toBe('£6.00 a class');
    expect(perClassText(type({ credits: 3, pricePence: 1000 }))).toBe('£3.33 a class');
    expect(perClassText(type({ pricePence: 0 }))).toBe('Free');
  });
  it('says how long a pack lasts', () => {
    expect(validityText(90)).toBe('Lasts 90 days');
    expect(validityText(1)).toBe('Lasts 1 day');
    expect(validityText(null)).toBe('Never expires');
  });
  it('counts the packs on sale', () => {
    expect(packSummary([type(), type({ id: 'k2', isActive: false })])).toBe('1 on sale · 2 total');
  });
  it('fills the form from a saved pack and starts a new one with 10 classes', () => {
    expect(formFromPack(type())).toEqual({ name: '10 class pack', credits: '10', price: '60.00', validDays: '90' });
    expect(formFromPack(type({ validDays: null })).validDays).toBe('');
    expect(emptyPackForm.credits).toBe('10');
  });
});
