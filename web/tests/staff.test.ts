import { describe, expect, it } from 'vitest';
import {
  QUAL_TEXT, changedHours, diffQuals, emptyStaffForm, formFromStaff, hoursSummary, isActiveMember, isOperational, payText, qualState, roleLabel, statusLabel, validateStaff, WEEK,
  type ExistingStaff, type StaffForm,
} from '../src/staff/calc';

const NOW = new Date('2026-10-08T12:00:00');
const good = (over: Partial<StaffForm> = {}): StaffForm => ({ ...emptyStaffForm(), name: 'Sam Coach', email: 'sam@example.com', accessLevelId: 'lvl', ...over });

describe('describing the team', () => {
  it('words roles and who is managed here', () => {
    expect(roleLabel('coach')).toBe('Coach / PT');
    expect(roleLabel('staff')).toBe('Staff');
    expect(roleLabel('owner')).toBe('Owner');
    expect(isOperational('coach')).toBe(true);
    expect(isOperational('admin')).toBe(false);
  });
  it('knows who is still on the team', () => {
    expect(isActiveMember({ isActive: true, accessStatus: 'active' })).toBe(true);
    expect(isActiveMember({ isActive: true, accessStatus: 'revoked' })).toBe(false);
    expect(isActiveMember({ isActive: false, accessStatus: 'active' })).toBe(false);
    expect(statusLabel({ isActive: false, accessStatus: 'active' })).toBe('removed');
    expect(statusLabel({ isActive: true, accessStatus: 'pending' })).toBe('pending');
  });
  it('summarises working hours Monday first, only the days worked', () => {
    expect(hoursSummary([])).toBe('Working hours not set');
    expect(hoursSummary([
      { weekday: 0, isWorking: true, start: '10:00:00', end: '14:00:00' },
      { weekday: 1, isWorking: true, start: '09:00:00', end: '17:00:00' },
      { weekday: 2, isWorking: false, start: '', end: '' },
    ])).toBe('Mon 09:00–17:00 · Sun 10:00–14:00');
  });
  it('flags qualifications that have expired or are about to', () => {
    expect(qualState(null, NOW)).toBe('valid');
    expect(qualState('2026-10-07', NOW)).toBe('expired');
    expect(qualState('2026-10-08', NOW)).toBe('expiring'); // valid until the end of today
    expect(qualState('2026-11-06', NOW)).toBe('expiring');
    expect(qualState('2026-11-08', NOW)).toBe('valid');
    expect(QUAL_TEXT.expired).toBe('expired');
  });
  it('words pay', () => {
    expect(payText(1250)).toBe('£12.50/hr');
    expect(payText(null)).toBe('');
  });
});

describe('the edit form', () => {
  it('starts empty with seven days, Monday first', () => {
    const f = emptyStaffForm();
    expect(Object.keys(f.hours)).toHaveLength(7);
    expect(WEEK.map((d) => d.weekday)).toEqual([1, 2, 3, 4, 5, 6, 0]);
    expect(f.role).toBe('staff');
  });
  it('fills from what is saved, including expiry dates', () => {
    const s: ExistingStaff = {
      role: 'coach', accessLevelId: 'l1', jobTitle: 'Head coach', payPence: 1250, employment: 'salary',
      hours: [{ weekday: 1, isWorking: true, start: '07:30:00', end: '15:00:00' }, { weekday: 3, isWorking: false, start: '', end: '' }],
      quals: [{ capabilityId: 'spin', expiresOn: '2027-01-31' }, { capabilityId: 'yoga', expiresOn: null }],
    };
    const f = formFromStaff('Sam', 'sam@x.com', s);
    expect(f).toMatchObject({ role: 'coach', accessLevelId: 'l1', jobTitle: 'Head coach', pay: '12.50', employment: 'salary' });
    expect(f.hours[1]).toEqual({ on: true, start: '07:30', end: '15:00' });
    expect(f.hours[3]?.on).toBe(false);
    expect(f.quals).toEqual({ spin: { on: true, expires: '2027-01-31' }, yoga: { on: true, expires: '' } });
  });
});

describe('validation', () => {
  it('needs a name, a real email and an access level for a new person only', () => {
    expect(validateStaff(good({ name: ' ' }), true)).toMatchObject({ ok: false });
    expect(validateStaff(good({ email: 'nope' }), true)).toMatchObject({ ok: false });
    expect(validateStaff(good({ name: '', email: '' }), false).ok).toBe(true);
    expect(validateStaff(good({ accessLevelId: '' }), false)).toMatchObject({ ok: false, message: 'Choose an access level for this person.' });
  });
  it('checks job title length and pay', () => {
    expect(validateStaff(good({ jobTitle: 'x'.repeat(81) }), false).ok).toBe(false);
    expect(validateStaff(good({ pay: 'abc' }), false).ok).toBe(false);
    expect(validateStaff(good({ pay: '-1' }), false).ok).toBe(false);
    const ok = validateStaff(good({ pay: '12.505', jobTitle: '  Coach  ' }), false);
    expect(ok.ok && ok.values.payPence).toBe(1251);
    expect(ok.ok && ok.values.jobTitle).toBe('Coach');
    const blank = validateStaff(good({ pay: '', jobTitle: '' }), false);
    expect(blank.ok && [blank.values.payPence, blank.values.jobTitle]).toEqual([null, null]);
  });
  it('a working day needs a start and a later finish', () => {
    const f = good();
    f.hours[1] = { on: true, start: '09:00', end: '09:00' };
    expect(validateStaff(f, false)).toMatchObject({ ok: false, message: 'Monday must finish after it starts.' });
    f.hours[1] = { on: true, start: '', end: '17:00' };
    expect(validateStaff(f, false)).toMatchObject({ ok: false });
    f.hours[1] = { on: true, start: '09:00', end: '17:00' };
    const r = validateStaff(f, false);
    expect(r.ok && r.values.hours.find((h) => h.weekday === 1)).toEqual({ weekday: 1, isWorking: true, start: '09:00', end: '17:00' });
    expect(r.ok && r.values.hours.find((h) => h.weekday === 2)).toEqual({ weekday: 2, isWorking: false, start: null, end: null });
  });
  it('qualification expiry must be a full date or blank', () => {
    expect(validateStaff(good({ quals: { a: { on: true, expires: '31/01/2027' } } }), false).ok).toBe(false);
    const r = validateStaff(good({ quals: { a: { on: true, expires: '2027-01-31' }, b: { on: false, expires: 'ignored' }, c: { on: true, expires: '' } } }), false);
    expect(r.ok && r.values.quals).toEqual([{ capabilityId: 'a', expiresOn: '2027-01-31' }, { capabilityId: 'c', expiresOn: null }]);
  });
});

describe('what a save writes', () => {
  const had = [{ capabilityId: 'a', expiresOn: null }, { capabilityId: 'b', expiresOn: '2027-01-01' }, { capabilityId: 'c', expiresOn: null }];
  it('adds new qualifications, updates a changed expiry, and removes the unticked ones last', () => {
    const d = diffQuals(had, [{ capabilityId: 'a', expiresOn: null }, { capabilityId: 'b', expiresOn: '2028-01-01' }, { capabilityId: 'd', expiresOn: null }]);
    expect(d.upsert).toEqual([{ capabilityId: 'b', expiresOn: '2028-01-01' }, { capabilityId: 'd', expiresOn: null }]);
    expect(d.remove).toEqual(['c']);
  });
  it('writes nothing when nothing changed', () => {
    expect(diffQuals(had, had)).toEqual({ upsert: [], remove: [] });
  });
  it('writes only the days that changed', () => {
    const saved = [{ weekday: 1, isWorking: true, start: '09:00:00', end: '17:00:00' }, { weekday: 2, isWorking: false, start: '', end: '' }];
    const wanted = [
      { weekday: 1, isWorking: true, start: '09:00', end: '17:00' },
      { weekday: 2, isWorking: false, start: null, end: null },
      { weekday: 3, isWorking: true, start: '10:00', end: '14:00' },
      { weekday: 4, isWorking: false, start: null, end: null },
      { weekday: 5, isWorking: true, start: '08:00', end: '16:00' },
    ];
    expect(changedHours(saved, wanted).map((h) => h.weekday)).toEqual([3, 5]);
    expect(changedHours(saved, [{ weekday: 1, isWorking: false, start: null, end: null }]).map((h) => h.weekday)).toEqual([1]);
    expect(changedHours(saved, [{ weekday: 1, isWorking: true, start: '09:00', end: '18:00' }]).map((h) => h.weekday)).toEqual([1]);
  });
});
