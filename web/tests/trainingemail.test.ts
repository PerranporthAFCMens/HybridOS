import { describe, expect, it } from 'vitest';
import { assignedMail, escapeHtml, feedbackMail } from '../../supabase/functions/notify-training/index';

const base = { gymName: 'Puffin Performance', coachName: 'Coach Sam', firstName: 'Jamie', link: 'https://www.hybridone.co.uk/m/train' };

describe('the workouts email', () => {
  it('says how many were set and that there is no deadline', () => {
    const m = assignedMail({ ...base, titles: ['Leg Day'], note: '' });
    expect(m.subject).toBe('Coach Sam has set you a workout - Puffin Performance');
    expect(m.text).toContain('Hi Jamie,');
    expect(m.text).toContain('There is no deadline');
    expect(m.html).toContain('Open my workouts');
    expect(m.html).toContain(base.link);
  });
  it('lists several in plain words', () => {
    const m = assignedMail({ ...base, titles: ['Leg Day', 'Upper body', 'Easy conditioning'], note: '' });
    expect(m.subject).toBe('Coach Sam has set you 3 workouts - Puffin Performance');
    expect(m.text).toContain('Leg Day, Upper body and Easy conditioning');
    expect(m.text).toContain('Do them whenever');
  });
  it('includes the coach\'s note when there is one, and none when there is not', () => {
    expect(assignedMail({ ...base, titles: ['A'], note: ' Slow on the way down ' }).text).toContain('"Slow on the way down"');
    expect(assignedMail({ ...base, titles: ['A'], note: '' }).html).not.toContain('&ldquo;');
  });
  it('never puts markup from a name, title or note into the page', () => {
    const m = assignedMail({ ...base, coachName: '<b>Sam</b>', titles: ['<script>alert(1)</script>'], note: '"><img src=x>' });
    expect(m.html).not.toContain('<script>');
    expect(m.html).not.toContain('<img src=x');
    expect(m.html).not.toContain('<b>Sam</b>');
  });
  it('copes with no first name', () => {
    expect(assignedMail({ ...base, firstName: '', titles: ['A'], note: '' }).text.startsWith('Hi,')).toBe(true);
  });
  it('keeps the subject on one line', () => {
    expect(assignedMail({ ...base, coachName: 'Sam\r\nBcc: x@y.z', titles: ['A'], note: '' }).subject).not.toMatch(/[\r\n]/);
  });
});

describe('the reply email', () => {
  it('quotes the reply and says which workout', () => {
    const m = feedbackMail({ ...base, title: 'Lower body strength', reply: 'Good effort. Try 57.5 next time.', link: 'https://www.hybridone.co.uk/m/train/done/a1' });
    expect(m.subject).toBe('Coach Sam replied to your workout - Puffin Performance');
    expect(m.text).toContain('Lower body strength');
    expect(m.text).toContain('"Good effort. Try 57.5 next time."');
    expect(m.html).toContain('Read it in the app');
    expect(m.html).toContain('/m/train/done/a1');
  });
  it('keeps a very long reply to a sensible length and escapes it', () => {
    const m = feedbackMail({ ...base, title: 'A', reply: `<i>${'x'.repeat(5000)}`, link: base.link });
    expect(m.html).not.toContain('<i>');
    expect(m.html.length).toBeLessThan(6000);
  });
});

describe('escaping', () => {
  it('escapes the five characters that matter', () => {
    expect(escapeHtml(`<a href="x">'&'</a>`)).toBe('&lt;a href=&quot;x&quot;&gt;&#039;&amp;&#039;&lt;/a&gt;');
    expect(escapeHtml(null)).toBe('');
  });
});
