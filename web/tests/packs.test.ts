import { describe, expect, it } from 'vitest';
import { emptyPackForm, formFromPack, heldExpiryText, heldLeftText, heldState, heldSummary, packSummary, perClassText, sortHeld, validatePackType, validityText } from '../src/packs/calc';
import type { HeldPack, PackType } from '../src/data/classPacks';

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

describe('held packs', () => {
  const now = new Date('2026-10-20T12:00:00Z');
  const held = (over: Partial<HeldPack> = {}): HeldPack => ({ id: 'p1', userId: 'u1', name: '10 class pack', creditsTotal: 10, creditsLeft: 7, expiresAt: null, source: 'owner', voidedAt: null, createdAt: '2026-10-01T00:00:00Z', ...over });
  it('says where a pack stands: cancelled, then used up, then expired, else in use', () => {
    expect(heldState(held(), now)).toBe('active');
    expect(heldState(held({ expiresAt: '2026-12-01T00:00:00Z' }), now)).toBe('active');
    expect(heldState(held({ expiresAt: '2026-10-19T00:00:00Z' }), now)).toBe('expired');
    expect(heldState(held({ creditsLeft: 0, expiresAt: '2026-10-19T00:00:00Z' }), now)).toBe('used');
    expect(heldState(held({ voidedAt: '2026-10-10T00:00:00Z', creditsLeft: 0 }), now)).toBe('cancelled');
  });
  it('words the classes left and the expiry', () => {
    expect(heldLeftText(held())).toBe('7 of 10 classes left');
    expect(heldLeftText(held({ creditsTotal: 1, creditsLeft: 1 }))).toBe('1 of 1 class left');
    expect(heldExpiryText(null)).toBe('Never expires');
    expect(heldExpiryText('2026-12-01T00:00:00Z')).toBe('Expires 1 Dec 2026');
  });
  it('lists packs in use first, newest first within each group', () => {
    const list = [held({ id: 'old', createdAt: '2026-09-01T00:00:00Z' }), held({ id: 'gone', voidedAt: '2026-10-10T00:00:00Z', createdAt: '2026-10-15T00:00:00Z' }), held({ id: 'new', createdAt: '2026-10-10T00:00:00Z' })];
    expect(sortHeld(list, now).map((p) => p.id)).toEqual(['new', 'old', 'gone']);
  });
  it('counts packs in use', () => {
    expect(heldSummary([held(), held({ voidedAt: '2026-10-10T00:00:00Z' })], now)).toBe('1 in use · 2 given or bought');
  });
});
