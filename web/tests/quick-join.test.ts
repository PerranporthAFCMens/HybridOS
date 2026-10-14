import { describe, expect, it } from 'vitest';
import {
  EMPTY_DETAILS, basicsErrors, checkEmail, firstToDo, needsFinishing, parseReady, quickProgress, quickStepsFor, readyCounts, toBasicsArgs,
  type ReadyItem,
} from '../src/join/calc';

const now = new Date('2026-10-14T12:00:00Z');
const adult = { ...EMPTY_DETAILS, firstName: 'Sam', lastName: 'Penrose', dob: '1990-04-12', phone: '07700 900123' };

describe('Quick join steps', () => {
  it('is plan, email, basics, pay for someone who is not signed in', () => {
    expect(quickStepsFor({ signedIn: false, paying: true })).toEqual(['plan', 'email', 'basics', 'pay', 'done']);
  });
  it('skips the email for a signed-in person and the payment for a free plan', () => {
    expect(quickStepsFor({ signedIn: true, paying: true })).toEqual(['plan', 'basics', 'pay', 'done']);
    expect(quickStepsFor({ signedIn: false, paying: false })).toEqual(['plan', 'email', 'basics', 'done']);
  });
  it('counts only the screens before the welcome', () => {
    const steps = quickStepsFor({ signedIn: false, paying: true });
    expect(quickProgress(steps, 'plan')).toBe('Step 1 of 4');
    expect(quickProgress(steps, 'pay')).toBe('Step 4 of 4');
    expect(quickProgress(quickStepsFor({ signedIn: true, paying: false }), 'basics')).toBe('Step 2 of 2');
  });
});

describe('Quick join basics', () => {
  it('has no errors for a complete adult', () => {
    expect(basicsErrors(adult, now)).toEqual({});
  });
  it('says what is wrong next to each box', () => {
    const e = basicsErrors(EMPTY_DETAILS, now);
    expect(Object.keys(e).sort()).toEqual(['dob', 'firstName', 'lastName', 'phone']);
  });
  it('asks for a parent or guardian under 18, and only then', () => {
    const minor = { ...adult, dob: '2012-06-01' };
    expect(Object.keys(basicsErrors(minor, now)).sort()).toEqual(['guardianName', 'guardianPhone']);
    expect(basicsErrors({ ...minor, guardianName: 'Pat Penrose', guardianPhone: '07700 900124' }, now)).toEqual({});
  });
  it('sends the number the database wants, and guardian details only for under 18s', () => {
    expect(toBasicsArgs({ ...adult, guardianName: 'Pat', guardianPhone: '07700 900124' }, now)).toEqual({
      p_first_name: 'Sam', p_last_name: 'Penrose', p_date_of_birth: '1990-04-12', p_phone: '+447700900123', p_guardian_name: '', p_guardian_phone: '',
    });
    expect(toBasicsArgs({ ...adult, dob: '2012-06-01', guardianName: 'Pat', guardianPhone: '07700 900124' }, now)).toMatchObject({ p_guardian_name: 'Pat', p_guardian_phone: '+447700900124' });
  });
  it('checks an email address', () => {
    expect(checkEmail('sam@example.com')).toBeNull();
    expect(checkEmail('sam@')).toMatch(/valid email/);
  });
});

describe('the checklist after paying', () => {
  const items: ReadyItem[] = [
    { key: 'emergency', label: 'Emergency contact', required: true, done: false },
    { key: 'documents', label: 'Health questions and waiver', required: true, done: true },
    { key: 'address', label: 'Your address', required: false, done: false },
  ];
  it('reads what the database sends', () => {
    const s = parseReady({ style: 'quick', ready: false, held: true, items: [{ key: 'emergency', label: 'Emergency contact', required: true, done: false }, { key: 'nonsense' }] });
    expect(s).toEqual({ style: 'quick', ready: false, held: true, items: [{ key: 'emergency', label: 'Emergency contact', required: true, done: false }] });
    expect(parseReady(null)).toBeNull();
    expect(parseReady([])).toBeNull();
  });
  it('counts what is done and picks the next thing, required first', () => {
    expect(readyCounts(items)).toEqual({ done: 1, total: 3 });
    expect(firstToDo(items)?.key).toBe('emergency');
    expect(firstToDo(items.map((i) => (i.key === 'emergency' ? { ...i, done: true } : i)))?.key).toBe('address');
    expect(firstToDo(items.map((i) => ({ ...i, done: true })))).toBeNull();
  });
  it('only nudges members of a Quick join gym who have something left', () => {
    expect(needsFinishing({ style: 'quick', ready: false, held: true, items })).toBe(true);
    expect(needsFinishing({ style: 'full', ready: false, held: false, items })).toBe(false);
    expect(needsFinishing({ style: 'quick', ready: true, held: false, items: items.map((i) => ({ ...i, done: true })) })).toBe(false);
    expect(needsFinishing(null)).toBe(false);
  });
});
