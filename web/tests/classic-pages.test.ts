// The live sign-up page and the classic member app are single HTML files with their code inline. These tests pull
// out the birthday pieces and run them, so the date-of-birth rule and the happy birthday animation are checked
// without a browser or the database.
// @vitest-environment jsdom
import joinPage from '../../join.html?raw';
import memberPage from '../../member.html?raw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const read = (f: string): string => (f === 'join.html' ? joinPage : memberPage);
const between = (s: string, from: string, to: string) => {
  const a = s.indexOf(from);
  const b = s.indexOf(to, a);
  if (a < 0 || b < 0) throw new Error(`could not find ${from}`);
  return s.slice(a, b);
};

describe('join.html date of birth', () => {
  const html = read('join.html');
  const fn = between(html, 'function dobForSave(){', 'async function saveSignupDob');
  const dobForSave = new Function('$', `${fn}; return dobForSave;`);
  const check = (value: string) => {
    document.body.innerHTML = `<input id="dob" type="date">`;
    const input = document.getElementById('dob') as HTMLInputElement;
    input.value = value;
    return (dobForSave((id: string) => document.getElementById(id)) as () => string)();
  };

  it('has a required date of birth box on the sign-up form only', () => {
    expect(html).toContain('id="dob" type="date" autocomplete="bday" required');
    expect(html).toContain("$('dobField').classList.toggle('hidden',!signup)");
  });
  it('takes a real past date', () => {
    expect(check('1990-10-08')).toBe('1990-10-08');
  });
  it('refuses nothing, future dates, and dates before 1900', () => {
    expect(check('')).toBe('');
    expect(check('2999-01-01')).toBe('');
    expect(check('1899-01-01')).toBe('');
  });
  it('stops sign-up without one, sends it with the sign-up and saves it to the profile', () => {
    expect(html).toContain("if(!dob)return msg('authMsg','Enter your date of birth.','bad')");
    expect(html).toContain('phone:phone,date_of_birth:dob,signup_type:');
    expect(html).toContain("update({date_of_birth:dob,updated_at:");
    expect((html.match(/saveSignupDob\(/g) ?? []).length).toBeGreaterThanOrEqual(4); // definition, session, and both confirmed-email paths
  });
});

describe('member.html happy birthday', () => {
  const code = between(read('member.html'), 'function birthdayHello(profile,name){', 'async function init(){');
  const run = (profile: { date_of_birth: string | null; first_name?: string }, now: string, userId = 'u1') => {
    vi.setSystemTime(new Date(now));
    const make = new Function('session', 'gym', `${code}; return birthdayHello;`);
    (make({ user: { id: userId } }, { name: 'Puffin Performance' }) as (p: unknown, n: string) => void)(profile, 'Alex Taylor');
  };
  beforeEach(() => { vi.useFakeTimers({ toFake: ['Date'] }); document.body.innerHTML = ''; localStorage.clear(); });
  afterEach(() => vi.useRealTimers());

  it('says happy birthday on the day, with their first name and the gym', () => {
    run({ date_of_birth: '1990-10-08', first_name: 'Alex' }, '2026-10-08T09:00:00Z');
    const dialog = document.querySelector('[role="dialog"]');
    expect(dialog?.getAttribute('aria-label')).toBe('Happy birthday');
    expect(dialog?.textContent).toContain('Happy birthday, Alex!');
    expect(dialog?.textContent).toContain('Puffin Performance');
  });
  it('closes when they tap Thank you', () => {
    run({ date_of_birth: '1990-10-08' }, '2026-10-08T09:00:00Z');
    (document.querySelector('.bday-card button') as HTMLButtonElement).click();
    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });
  it('only once a year on a phone, even if they reopen the app', () => {
    run({ date_of_birth: '1990-10-08' }, '2026-10-08T09:00:00Z');
    document.body.innerHTML = '';
    run({ date_of_birth: '1990-10-08' }, '2026-10-08T17:00:00Z');
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    run({ date_of_birth: '1990-10-08' }, '2027-10-08T09:00:00Z');
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();
  });
  it('says nothing on other days or with no date of birth', () => {
    run({ date_of_birth: '1990-10-09' }, '2026-10-08T09:00:00Z');
    run({ date_of_birth: null }, '2026-10-08T09:00:00Z');
    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });
  it('uses the same key as the new member app, so they are not wished twice', () => {
    run({ date_of_birth: '1990-10-08' }, '2026-10-08T09:00:00Z', 'u9');
    expect(localStorage.getItem('hybrid-birthday-u9-2026')).toBe('1');
  });
  it('is called once the app is on screen, and cannot break it', () => {
    const html = read('member.html');
    expect(html).toContain("$('app').classList.remove('hidden');try{birthdayHello(profile,name)}catch(e)");
  });
});
