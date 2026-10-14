import { describe, expect, it } from 'vitest';
import { escapeHtml, roleWords, welcomeMail } from '../../supabase/functions/notify-staff-welcome/index';

const base = { gymName: 'Puffin Performance', adderName: 'Adam Turner', firstName: 'Jamie', role: 'staff', email: 'jamie@example.com', link: 'https://www.hybridone.co.uk/login?gym_id=g1' };

describe('the welcome email', () => {
  it('welcomes them to the team and says who added them', () => {
    const m = welcomeMail(base);
    expect(m.subject).toBe('Welcome to the team at Puffin Performance');
    expect(m.text).toContain('Hi Jamie,');
    expect(m.text).toContain('Adam Turner has added you to the team at Puffin Performance as a member of the team.');
  });
  it('gives the link to the staff app, in the text and on the button', () => {
    const m = welcomeMail(base);
    expect(m.html).toContain('Open the staff app');
    expect(m.html).toContain('href="https://www.hybridone.co.uk/login?gym_id=g1"');
    expect(m.text).toContain('Open the staff app: https://www.hybridone.co.uk/login?gym_id=g1');
  });
  it('for someone who has signed in before, tells them to use their usual password and never mentions a temporary one', () => {
    const m = welcomeMail(base);
    expect(m.text).toContain('jamie@example.com');
    expect(m.text).toContain('usual password');
    expect(m.text).toContain('Forgot password?');
    expect(m.text).toContain('Email me a sign-in link');
    expect(m.text.toLowerCase()).not.toContain('temporary');
    expect(m.html).not.toContain('Choose your password');
  });
  it('for a new login, the button is a one-time link to choose a password, and the way in after that', () => {
    const m = welcomeMail({ ...base, passwordLink: 'https://x.supabase.co/auth/v1/verify?token=abc&type=recovery' });
    expect(m.html).toContain('Choose your password');
    expect(m.html).toContain('href="https://x.supabase.co/auth/v1/verify?token=abc&amp;type=recovery"');
    expect(m.text).toContain('Choose your password: https://x.supabase.co/auth/v1/verify?token=abc&type=recovery');
    expect(m.text).toContain('The link works once');
    expect(m.text).toContain('Forgot password?');
    expect(m.text).toContain(base.link);
    expect(m.text.toLowerCase()).not.toContain('temporary');
  });
  it('never carries a password', () => {
    for (const m of [welcomeMail(base), welcomeMail({ ...base, passwordLink: 'https://x/y' })]) expect(m.text).not.toMatch(/Hybrid[0-9a-f]{10}!/);
  });
  it('says coach for a coach', () => {
    expect(roleWords('coach')).toBe('a coach');
    expect(welcomeMail({ ...base, role: 'coach' }).text).toContain('as a coach.');
  });
  it('copes with no first name or no adder', () => {
    expect(welcomeMail({ ...base, firstName: '' }).text.startsWith('Hi,')).toBe(true);
    expect(welcomeMail({ ...base, adderName: '' }).text).toContain('Your gym has added you');
  });
  it('never puts markup from a name into the page, and keeps the subject on one line', () => {
    const m = welcomeMail({ ...base, firstName: '<b>x</b>', gymName: 'A\r\nBcc: x@y.z <i>' });
    expect(m.html).not.toContain('<b>x</b>');
    expect(m.html).not.toContain('<i>');
    expect(m.subject).not.toMatch(/[\r\n]/);
  });
  it('escapes the five characters that matter', () => {
    expect(escapeHtml(`<a href="x">'&'</a>`)).toBe('&lt;a href=&quot;x&quot;&gt;&#039;&amp;&#039;&lt;/a&gt;');
  });
});
