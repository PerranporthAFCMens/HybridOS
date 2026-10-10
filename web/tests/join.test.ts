import { describe, expect, it } from 'vitest';
import { EMPTY_DETAILS, checkAbout, checkAccount, checkAddress, checkEmergency, checkGuardian, isUnder18, normalisePhone, normalisePostcode, planPrice, stepsFor, toRpcArgs } from '../src/join/calc';

const NOW = new Date('2026-10-10T12:00:00Z');
const good = { ...EMPTY_DETAILS, firstName: 'Sam', lastName: 'Penrose', dob: '1990-04-12', phone: '07700 900123', line1: '1 Cliff Road', town: 'Perranporth', postcode: 'pl28 8ab', emergencyName: 'Alex', emergencyPhone: '+44 7700 900124', emergencyRelationship: 'Partner' };

describe('join steps', () => {
  it('guardian only for under-18s, terms only when the gym has some', () => {
    expect(stepsFor({ under18: false, hasTerms: false })).toEqual(['account', 'about', 'address', 'emergency', 'plan', 'done']);
    expect(stepsFor({ under18: true, hasTerms: true })).toEqual(['account', 'about', 'address', 'emergency', 'guardian', 'terms', 'plan', 'done']);
  });
});

describe('under 18', () => {
  it('turns 18 on the birthday itself', () => {
    expect(isUnder18('2008-10-11', NOW)).toBe(true);
    expect(isUnder18('2008-10-10', NOW)).toBe(false);
    expect(isUnder18('2008-10-09', NOW)).toBe(false);
  });
  it('an unreadable or future date is not treated as under 18', () => {
    expect(isUnder18('', NOW)).toBe(false);
    expect(isUnder18('2030-01-01', NOW)).toBe(false);
  });
});

describe('phone and postcode', () => {
  it('a UK number becomes +44, an international one is kept', () => {
    expect(normalisePhone('07700 900123')).toBe('+447700900123');
    expect(normalisePhone('(07700) 900-123')).toBe('+447700900123');
    expect(normalisePhone('+34 612 345 678')).toBe('+34612345678');
    expect(normalisePhone('0034612345678')).toBe('+34612345678');
  });
  it('rubbish is refused', () => {
    expect(normalisePhone('')).toBe('');
    expect(normalisePhone('12')).toBe('');
    expect(normalisePhone('abc')).toBe('');
  });
  it('a postcode is tidied or refused', () => {
    expect(normalisePostcode('pl288ab')).toBe('PL28 8AB');
    expect(normalisePostcode(' EC1A  1BB ')).toBe('EC1A 1BB');
    expect(normalisePostcode('M1 1AE')).toBe('M1 1AE');
    expect(normalisePostcode('nonsense')).toBe('');
    expect(normalisePostcode('12345')).toBe('');
  });
});

describe('step checks', () => {
  it('account', () => {
    expect(checkAccount('nope', 'longenough1', 'longenough1')).toMatch(/valid email/);
    expect(checkAccount('a@b.co', 'short', 'short')).toMatch(/at least 8/);
    expect(checkAccount('a@b.co', 'longenough1', 'other')).toMatch(/do not match/);
    expect(checkAccount('a@b.co', 'longenough1', 'longenough1')).toBeNull();
  });
  it('about you needs names, a real birthday and a mobile', () => {
    expect(checkAbout(EMPTY_DETAILS, NOW)).toMatch(/first name/);
    expect(checkAbout({ ...good, lastName: ' ' }, NOW)).toMatch(/last name/);
    expect(checkAbout({ ...good, dob: '' }, NOW)).toMatch(/date of birth/);
    expect(checkAbout({ ...good, phone: '12' }, NOW)).toMatch(/mobile/);
    expect(checkAbout(good, NOW)).toBeNull();
  });
  it('address, emergency contact and guardian', () => {
    expect(checkAddress({ ...good, line1: '' })).toMatch(/first line/);
    expect(checkAddress({ ...good, town: '' })).toMatch(/town/);
    expect(checkAddress({ ...good, postcode: 'x' })).toMatch(/postcode/);
    expect(checkAddress(good)).toBeNull();
    expect(checkEmergency({ ...good, emergencyName: '' })).toMatch(/name/);
    expect(checkEmergency({ ...good, emergencyPhone: '1' })).toMatch(/phone/);
    expect(checkEmergency({ ...good, emergencyRelationship: 'a' })).toMatch(/related/);
    expect(checkEmergency(good)).toBeNull();
    expect(checkGuardian(good)).toMatch(/guardian/);
    expect(checkGuardian({ ...good, guardianName: 'Sam', guardianPhone: '07700 900123' })).toBeNull();
  });
});

describe('what is sent to the database', () => {
  it('tidied values, and a guardian only for under-18s', () => {
    const adult = toRpcArgs({ ...good, guardianName: 'Left over', guardianPhone: '07700 900123' }, NOW);
    expect(adult.p_postcode).toBe('PL28 8AB');
    expect(adult.p_phone).toBe('+447700900123');
    expect(adult.p_guardian_name).toBe('');
    const teen = toRpcArgs({ ...good, dob: '2012-01-01', guardianName: 'Sam', guardianPhone: '07700 900123' }, NOW);
    expect(teen.p_guardian_name).toBe('Sam');
    expect(teen.p_guardian_phone).toBe('+447700900123');
  });
});

describe('plan price', () => {
  it('shows the interval except for one-offs', () => {
    expect(planPrice({ pricePence: 5900, interval: 'monthly' })).toBe('£59.00 / monthly');
    expect(planPrice({ pricePence: 800, interval: 'one_off' })).toBe('£8.00');
  });
});
