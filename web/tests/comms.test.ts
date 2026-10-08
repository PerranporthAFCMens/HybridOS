import { describe, expect, it } from 'vitest';
import { DEFAULT_FROM, DEFAULT_TEMPLATE, checkLogoFile, fillTokens, logoPath, senderFormFrom, senderStatusText, templateFormFrom, validateSender, validateTemplate } from '../src/comms/calc';

describe('logo', () => {
  it('accepts png, jpg and webp up to 2 MB', () => {
    expect(checkLogoFile('image/png', 1000)).toBeNull();
    expect(checkLogoFile('image/jpeg', 2 * 1024 * 1024)).toBeNull();
    expect(checkLogoFile('image/webp', 1)).toBeNull();
  });
  it('refuses other types and big files', () => {
    expect(checkLogoFile('image/svg+xml', 10)).toBe('Use a PNG, JPG or WebP image.');
    expect(checkLogoFile('application/pdf', 10)).toBe('Use a PNG, JPG or WebP image.');
    expect(checkLogoFile('image/png', 2 * 1024 * 1024 + 1)).toBe('That image is over 2 MB. Please use a smaller file.');
  });
  it('stores each upload in the gym folder under a fresh name', () => {
    expect(logoPath('g1', 1700, 'image/png')).toBe('g1/logo-1700.png');
    expect(logoPath('g1', 1700, 'image/jpeg')).toBe('g1/logo-1700.jpg');
    expect(logoPath('g1', 1700, 'image/webp')).toBe('g1/logo-1700.webp');
  });
});

describe('sender details', () => {
  const blank = senderFormFrom(null, 'Puffin');
  it('starts from the gym name and the HybridOne sender', () => {
    expect(blank).toEqual({ name: 'Puffin', from: DEFAULT_FROM, replyTo: '', accent: '#0b1020', logoUrl: '', footer: '' });
  });
  it('the HybridOne address is verified', () => {
    const c = validateSender(blank, 'Puffin');
    expect(c).toMatchObject({ ok: true, payload: { sender_email: DEFAULT_FROM, sender_domain_status: 'verified', reply_to_email: null, logo_url: null, footer_text: null } });
  });
  it('another domain is never marked verified by this screen', () => {
    const c = validateSender({ ...blank, from: 'hello@puffin.example' }, 'Puffin');
    expect(c).toMatchObject({ ok: true, payload: { sender_domain_status: 'unverified' } });
    const spoof = validateSender({ ...blank, from: 'x@hybridone.co.uk.evil.example' }, 'Puffin');
    expect(spoof).toMatchObject({ ok: true, payload: { sender_domain_status: 'unverified' } });
  });
  it('a blank From falls back to the default; blank name to the gym name', () => {
    expect(validateSender({ ...blank, from: ' ', name: ' ' }, 'Puffin')).toMatchObject({ ok: true, payload: { sender_email: DEFAULT_FROM, sender_name: 'Puffin' } });
  });
  it('refuses bad addresses, colours, logo links and long text', () => {
    expect(validateSender({ ...blank, from: 'nope' }, 'P')).toMatchObject({ ok: false });
    expect(validateSender({ ...blank, replyTo: 'nope' }, 'P')).toMatchObject({ ok: false });
    expect(validateSender({ ...blank, accent: 'red' }, 'P')).toMatchObject({ ok: false });
    expect(validateSender({ ...blank, logoUrl: 'http://x.co/a.png' }, 'P')).toMatchObject({ ok: false });
    expect(validateSender({ ...blank, logoUrl: 'javascript:alert(1)' }, 'P')).toMatchObject({ ok: false });
    expect(validateSender({ ...blank, footer: 'x'.repeat(241) }, 'P')).toMatchObject({ ok: false });
    expect(validateSender({ ...blank, name: 'x'.repeat(101) }, 'P')).toMatchObject({ ok: false });
  });
  it('words the status', () => {
    expect(senderStatusText('a@b.co', 'verified')).toBe('Verified sender: a@b.co');
    expect(senderStatusText('a@b.co', 'pending')).toContain('pending');
    expect(senderStatusText('a@b.co', 'failed')).toContain('failed');
    expect(senderStatusText('a@b.co', 'unverified')).toContain('must be verified');
    expect(senderStatusText(' ', null)).toContain('Choose');
  });
});

describe('invitation template', () => {
  it('shows the placeholders as sample values', () => {
    expect(fillTokens('{{invited_by}} invites you to {{gym_name}} as {{role}}', 'Puffin')).toBe('Gym owner invites you to Puffin as Admin');
    expect(fillTokens('{{gym_name}} {{gym_name}}', '')).toBe('Your gym Your gym');
  });
  it('starts from the HybridOne wording', () => {
    expect(templateFormFrom(null)).toEqual(DEFAULT_TEMPLATE);
    expect(templateFormFrom({ subject: 'S', preheader: null, heading: 'H', body_text: 'B', button_label: null })).toEqual({ subject: 'S', preheader: '', heading: 'H', body: 'B', button: 'Accept invitation' });
  });
  it('needs subject, heading and body, and trims', () => {
    expect(validateTemplate({ ...DEFAULT_TEMPLATE, subject: ' ' })).toMatchObject({ ok: false });
    expect(validateTemplate({ ...DEFAULT_TEMPLATE, heading: '' })).toMatchObject({ ok: false });
    expect(validateTemplate({ ...DEFAULT_TEMPLATE, body: '' })).toMatchObject({ ok: false });
    expect(validateTemplate({ subject: ' S ', preheader: ' ', heading: ' H ', body: ' B ', button: ' ' })).toEqual({ ok: true, value: { subject: 'S', preheader: null, heading: 'H', body_text: 'B', button_label: 'Accept invitation' } });
  });
  it('limits lengths', () => {
    expect(validateTemplate({ ...DEFAULT_TEMPLATE, subject: 'x'.repeat(181) })).toMatchObject({ ok: false });
    expect(validateTemplate({ ...DEFAULT_TEMPLATE, preheader: 'x'.repeat(221) })).toMatchObject({ ok: false });
    expect(validateTemplate({ ...DEFAULT_TEMPLATE, body: 'x'.repeat(1601) })).toMatchObject({ ok: false });
    expect(validateTemplate({ ...DEFAULT_TEMPLATE, button: 'x'.repeat(61) })).toMatchObject({ ok: false });
  });
});
