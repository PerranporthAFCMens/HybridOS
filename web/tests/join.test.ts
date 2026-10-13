import { looksLikeExistingAccount } from '../src/join/calc';
import { describe, expect, it } from 'vitest';
import { EMPTY_DETAILS, answersPayload, canPayOnline, checkAgreed, checkPayer, isFreePlan, moneyText, payTermsText, checkAbout, checkAccount, checkAddress, checkCode, cleanCode, checkEmergency, checkGuardian, checkSign, isUnder18, normalisePhone, normalisePostcode, planPrice, stepsFor, toRpcArgs, type JoinDocument } from '../src/join/calc';

const NOW = new Date('2026-10-10T12:00:00Z');
const good = { ...EMPTY_DETAILS, firstName: 'Sam', lastName: 'Penrose', dob: '1990-04-12', phone: '07700 900123', line1: '1 Cliff Road', town: 'Perranporth', postcode: 'pl28 8ab', emergencyName: 'Alex', emergencyPhone: '+44 7700 900124', emergencyRelationship: 'Partner' };

describe('join steps', () => {
  it('guardian only for under-18s, signing only when the gym has documents', () => {
    expect(stepsFor({ under18: false, hasDocuments: false })).toEqual(['account', 'about', 'address', 'emergency', 'plan', 'done']);
    expect(stepsFor({ under18: true, hasDocuments: true })).toEqual(['account', 'about', 'address', 'emergency', 'guardian', 'sign', 'plan', 'done']);
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

const doc = (over: Partial<JoinDocument> = {}): JoinDocument => ({
  id: 'd1', kind: 'waiver', version: 1, title: 'Waiver', source: 'text', filePath: null, fileName: null, body: 'Risks.', acceptance: 'I agree.',
  questions: [
    { id: 'q1', prompt: 'Heart condition?', answerType: 'yes_no', detailsIfYes: true, required: true },
    { id: 'q2', prompt: 'Injuries?', answerType: 'text', detailsIfYes: false, required: false },
  ],
  ...over,
});
const ready = { docs: [doc()], answers: { q1: { yes: false, text: '' } }, ticked: { d1: true }, name: 'Sam Penrose', hasInk: true };

describe('before signing', () => {
  it('every required question must be answered, and a yes needs its details', () => {
    expect(checkSign({ ...ready, answers: {} })).toBe('Answer this question: Heart condition?');
    expect(checkSign({ ...ready, answers: { q1: { yes: true, text: '' } } })).toBe('Give a few details for: Heart condition?');
    expect(checkSign({ ...ready, answers: { q1: { yes: true, text: 'Controlled' } } })).toBeNull();
  });
  it('optional questions can be left', () => {
    expect(checkSign(ready)).toBeNull();
  });
  it('each document must be ticked, a name typed and a signature drawn', () => {
    expect(checkSign({ ...ready, ticked: {} })).toMatch(/Tick the box/);
    expect(checkSign({ ...ready, docs: [doc(), doc({ id: 'd2', title: 'Terms', questions: [] })] })).toMatch(/Tick the box/);
    expect(checkSign({ ...ready, name: ' S ' })).toBe('Type your full name.');
    expect(checkSign({ ...ready, hasInk: false })).toBe('Draw your signature in the box.');
  });
  it('sends only the questions that were answered', () => {
    expect(answersPayload([doc()], { q1: { yes: true, text: ' Controlled ' }, q2: { yes: null, text: '' } })).toEqual([{ question_id: 'q1', yes: true, text: 'Controlled' }]);
    expect(answersPayload([doc()], { q1: { yes: false, text: '' }, q2: { yes: null, text: 'Knee' } })).toEqual([{ question_id: 'q1', yes: false }, { question_id: 'q2', text: 'Knee' }]);
    expect(answersPayload([doc()], {})).toEqual([]);
  });
});

describe('an email that already has an account', () => {
  it('is recognised when the service answers a repeat sign-up with no identities', () => {
    expect(looksLikeExistingAccount(null, { identities: [] })).toBe(true);
    expect(looksLikeExistingAccount(null, { identities: [{}] })).toBe(false);
    expect(looksLikeExistingAccount(null, null)).toBe(false);
  });
  it('is recognised from the service saying so, but not from other errors', () => {
    expect(looksLikeExistingAccount({ message: 'User already registered' }, null)).toBe(true);
    expect(looksLikeExistingAccount({ message: 'Password should be at least 6 characters' }, null)).toBe(false);
  });
});

describe('paying to join', () => {
  it('payment is a step only when the gym takes it, after the plan', () => {
    expect(stepsFor({ under18: false, hasDocuments: false, takesPayment: true })).toEqual(['account', 'about', 'address', 'emergency', 'plan', 'pay', 'done']);
    expect(stepsFor({ under18: true, hasDocuments: true, takesPayment: true })).toEqual(['account', 'about', 'address', 'emergency', 'guardian', 'sign', 'plan', 'pay', 'done']);
  });
  it('only paid, repeating plans can be paid for online; free plans need no card', () => {
    expect(canPayOnline({ pricePence: 5900, interval: 'monthly' })).toBe(true);
    expect(canPayOnline({ pricePence: 5900, interval: 'quarterly' })).toBe(true);
    expect(canPayOnline({ pricePence: 800, interval: 'one_off' })).toBe(false);
    expect(canPayOnline({ pricePence: 0, interval: 'monthly' })).toBe(false);
    expect(isFreePlan({ pricePence: 0 })).toBe(true);
    expect(isFreePlan({ pricePence: 1 })).toBe(false);
  });
  it('says what is charged today and after', () => {
    expect(moneyText(5900)).toBe('£59.00');
    expect(payTermsText({ pricePence: 5900, interval: 'monthly' })).toBe('£59.00 today, then £59.00 every month');
    expect(payTermsText({ pricePence: 15000, interval: 'quarterly' })).toBe('£150.00 today, then £150.00 every 3 months');
  });
  it('an under-18 needs a parent or guardian name and email; an adult needs neither', () => {
    expect(checkPayer(false, '', '')).toBeNull();
    expect(checkPayer(true, '', 'a@b.co')).toMatch(/name/);
    expect(checkPayer(true, 'Sam', 'nonsense')).toMatch(/email/);
    expect(checkPayer(true, 'Sam Penrose', ' sam@example.test ')).toBeNull();
  });
  it('they must tick the agreement before paying', () => {
    expect(checkAgreed(false)).toMatch(/Tick/);
    expect(checkAgreed(true)).toBeNull();
  });
});

describe('the email code', () => {
  it('keeps the digits, however it was typed or pasted', () => {
    expect(cleanCode('123456')).toBe('123456');
    expect(cleanCode(' 123 456 ')).toBe('123456');
    expect(cleanCode('123-456')).toBe('123456');
    expect(cleanCode('code: 654321.')).toBe('654321');
    expect(cleanCode('06700482')).toBe('06700482');
    expect(cleanCode('123456789012')).toBe('1234567890');
  });
  it('accepts the 6 to 10 digit codes Supabase sends, and nothing else', () => {
    expect(checkCode('123456')).toBeNull();
    expect(checkCode('0670 0482')).toBeNull();
    expect(checkCode('1234567890')).toBeNull();
    expect(checkCode('')).toMatch(/code from the email/);
    expect(checkCode('12345')).toMatch(/code from the email/);
    expect(checkCode('abcdef')).toMatch(/code from the email/);
  });
});
