// Pure rules behind Communications: the gym's logo, the sender details on member emails, and the wording of the
// access-invitation email. Same fields and defaults as the old page.

export const DEFAULT_FROM = 'noreply@hybridone.co.uk';
export const SYSTEM_DOMAIN = 'hybridone.co.uk';
export const DEFAULT_ACCENT = '#0b1020';

export const DEFAULT_TEMPLATE = {
  subject: "You've been invited to {{gym_name}} on HybridOne",
  preheader: 'Join {{gym_name}} on HybridOne.',
  heading: "You've been invited to {{gym_name}}",
  body: '{{invited_by}} has invited you to join {{gym_name}} as {{role}} on HybridOne.',
  button: 'Accept invitation',
};

/** What the preview shows for the placeholders. */
export function fillTokens(text: string, gymName: string): string {
  return text.replaceAll('{{gym_name}}', gymName || 'Your gym').replaceAll('{{invited_by}}', 'Gym owner').replaceAll('{{role}}', 'Admin');
}

// ---- Logo ----
export const LOGO_TYPES: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' };
export const LOGO_MAX_BYTES = 2 * 1024 * 1024;

export function checkLogoFile(type: string, size: number): string | null {
  if (!(type in LOGO_TYPES)) return 'Use a PNG, JPG or WebP image.';
  if (size > LOGO_MAX_BYTES) return 'That image is over 2 MB. Please use a smaller file.';
  return null;
}

/** Where a new logo is stored: always inside the gym's own folder, with a fresh name so old copies are never overwritten. */
export function logoPath(gymId: string, now: number, type: string): string {
  return `${gymId}/logo-${now}.${LOGO_TYPES[type] ?? 'jpg'}`;
}

// ---- Sender details ----
export interface SenderForm { name: string; from: string; replyTo: string; accent: string; logoUrl: string; footer: string }

export interface SenderSaved { name: string | null; from: string | null; replyTo: string | null; accent: string | null; logoUrl: string | null; footer: string | null; status: string | null }

export function senderFormFrom(s: SenderSaved | null, gymName: string): SenderForm {
  return { name: s?.name || gymName, from: s?.from || DEFAULT_FROM, replyTo: s?.replyTo ?? '', accent: s?.accent || DEFAULT_ACCENT, logoUrl: s?.logoUrl ?? '', footer: s?.footer ?? '' };
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const HEX = /^#[0-9a-fA-F]{6}$/;

export interface SenderPayload { sender_name: string; sender_email: string; reply_to_email: string | null; sender_domain_status: string; accent_color: string; logo_url: string | null; footer_text: string | null }
export type SenderCheck = { ok: true; payload: SenderPayload } | { ok: false; message: string };

/**
 * The From address may be the HybridOne one (ready now) or the gym's own, which stays "unverified" until its
 * domain is verified. This screen can never mark another domain as verified (the old page's rule).
 */
export function validateSender(f: SenderForm, gymName: string): SenderCheck {
  const from = f.from.trim() || DEFAULT_FROM;
  if (!EMAIL.test(from)) return { ok: false, message: 'Enter a valid From email address.' };
  const reply = f.replyTo.trim();
  if (reply && !EMAIL.test(reply)) return { ok: false, message: 'Enter a valid reply-to email address, or leave it blank.' };
  const name = f.name.trim() || gymName;
  if (name.length > 100) return { ok: false, message: 'The email brand name can be up to 100 characters.' };
  if (from.length > 254 || reply.length > 254) return { ok: false, message: 'Email addresses can be up to 254 characters.' };
  if (!HEX.test(f.accent)) return { ok: false, message: 'Choose a brand colour.' };
  const logo = f.logoUrl.trim();
  if (logo && !/^https:\/\//i.test(logo)) return { ok: false, message: 'The logo link must start with https://.' };
  if (f.footer.trim().length > 240) return { ok: false, message: 'The footer text can be up to 240 characters.' };
  const domain = (from.split('@')[1] ?? '').toLowerCase();
  return {
    ok: true,
    payload: { sender_name: name, sender_email: from, reply_to_email: reply || null, sender_domain_status: domain === SYSTEM_DOMAIN ? 'verified' : 'unverified', accent_color: f.accent, logo_url: logo || null, footer_text: f.footer.trim() || null },
  };
}

export function senderStatusText(from: string, status: string | null): string {
  const email = from.trim();
  if (!email) return 'Choose the From email address this gym wants to use.';
  if (status === 'verified') return `Verified sender: ${email}`;
  if (status === 'pending') return `Verification pending: ${email}`;
  if (status === 'failed') return `Verification failed: ${email}`;
  return `Needs verification: ${email}. The domain must be verified before this can be used as the From address.`;
}

// ---- Access-invitation email wording ----
export interface TemplateForm { subject: string; preheader: string; heading: string; body: string; button: string }
export type TemplateCheck = { ok: true; value: { subject: string; preheader: string | null; heading: string; body_text: string; button_label: string } } | { ok: false; message: string };

export function templateFormFrom(t: { subject: string; preheader: string | null; heading: string; body_text: string; button_label: string | null } | null): TemplateForm {
  return t
    ? { subject: t.subject, preheader: t.preheader ?? '', heading: t.heading, body: t.body_text, button: t.button_label || DEFAULT_TEMPLATE.button }
    : { ...DEFAULT_TEMPLATE };
}

export function validateTemplate(f: TemplateForm): TemplateCheck {
  const subject = f.subject.trim();
  const heading = f.heading.trim();
  const body = f.body.trim();
  if (!subject || !heading || !body) return { ok: false, message: 'Subject, heading and body are required.' };
  if (subject.length > 180 || heading.length > 180) return { ok: false, message: 'The subject and heading can be up to 180 characters.' };
  if (f.preheader.trim().length > 220) return { ok: false, message: 'The preheader can be up to 220 characters.' };
  if (body.length > 1600) return { ok: false, message: 'The body can be up to 1600 characters.' };
  if (f.button.trim().length > 60) return { ok: false, message: 'The button text can be up to 60 characters.' };
  return { ok: true, value: { subject, preheader: f.preheader.trim() || null, heading, body_text: body, button_label: f.button.trim() || DEFAULT_TEMPLATE.button } };
}
