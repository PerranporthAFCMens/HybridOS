import { describe, expect, it } from 'vitest';
import { emptyDoorForm, formFromSaved, previewOf, sameAsSaved, validateDoor } from '../src/door/calc';

describe('door access', () => {
  it('starts switched off with the default label', () => {
    expect(formFromSaved(null)).toEqual({ enabled: false, code: '', label: 'Door access', note: '' });
  });
  it('fills the form from saved settings, with a blank label going back to the default', () => {
    expect(formFromSaved({ enabled: true, code: '4826', label: '', note: null })).toEqual({ enabled: true, code: '4826', label: 'Door access', note: '' });
  });
  it('will not show access to members without a code', () => {
    expect(validateDoor({ ...emptyDoorForm, enabled: true, code: '  ' })).toMatchObject({ ok: false });
    expect(validateDoor({ ...emptyDoorForm, enabled: false, code: '' })).toMatchObject({ ok: true });
  });
  it('trims and nulls empty values', () => {
    expect(validateDoor({ enabled: true, code: ' 4826 ', label: ' ', note: ' ' })).toEqual({ ok: true, value: { enabled: true, code: '4826', label: 'Door access', note: null } });
  });
  it('limits lengths', () => {
    expect(validateDoor({ ...emptyDoorForm, code: '1'.repeat(13) })).toMatchObject({ ok: false });
    expect(validateDoor({ ...emptyDoorForm, label: 'x'.repeat(41) })).toMatchObject({ ok: false });
    expect(validateDoor({ ...emptyDoorForm, note: 'x'.repeat(201) })).toMatchObject({ ok: false });
  });
  it('previews what members see', () => {
    expect(previewOf({ enabled: false, code: '', label: '', note: '' })).toEqual({ label: 'Door access', code: '••••', note: 'No note set.', visible: false });
    expect(previewOf({ enabled: true, code: '99', label: 'Gate', note: 'Side door' })).toEqual({ label: 'Gate', code: '99', note: 'Side door', visible: true });
  });
  it('knows when nothing changed', () => {
    const saved = { enabled: true, code: '4826', label: 'Door access', note: null };
    expect(sameAsSaved(formFromSaved(saved), saved)).toBe(true);
    expect(sameAsSaved({ ...formFromSaved(saved), code: '1111' }, saved)).toBe(false);
    expect(sameAsSaved(emptyDoorForm, null)).toBe(true);
    expect(sameAsSaved({ ...emptyDoorForm, enabled: true }, null)).toBe(false);
  });
});
