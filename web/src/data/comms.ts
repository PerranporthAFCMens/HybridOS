import { supabase } from './client';
import { LOGO_TYPES, logoPath, type SenderPayload, type SenderSaved } from '../comms/calc';

export interface TemplateSaved { subject: string; preheader: string | null; heading: string; body_text: string; button_label: string | null }
export interface CommsData { logoUrl: string | null; sender: SenderSaved | null; template: TemplateSaved | null }

export async function loadComms(gymId: string): Promise<CommsData> {
  const [g, s, t] = await Promise.all([
    supabase.from('gyms').select('logo_url').eq('id', gymId).maybeSingle(),
    supabase.from('gym_communication_settings').select('sender_name, sender_email, reply_to_email, accent_color, logo_url, footer_text, sender_domain_status').eq('gym_id', gymId).maybeSingle(),
    supabase.from('gym_email_templates').select('subject, preheader, heading, body_text, button_label').eq('gym_id', gymId).eq('template_key', 'access_invite').maybeSingle(),
  ]);
  for (const r of [g, s, t]) if (r.error) throw r.error;
  return {
    logoUrl: g.data?.logo_url ?? null,
    sender: s.data ? { name: s.data.sender_name, from: s.data.sender_email, replyTo: s.data.reply_to_email, accent: s.data.accent_color, logoUrl: s.data.logo_url, footer: s.data.footer_text, status: s.data.sender_domain_status } : null,
    template: t.data ?? null,
  };
}

/** Puts a logo (or none) on the gym and, if the gym has email settings, on those too. The second part is best effort. */
async function applyLogo(gymId: string, url: string | null): Promise<void> {
  const g = await supabase.from('gyms').update({ logo_url: url }).eq('id', gymId);
  if (g.error) throw g.error;
  await supabase.from('gym_communication_settings').update({ logo_url: url }).eq('gym_id', gymId);
  try {
    sessionStorage.removeItem(`hybrid-gym-brand:${gymId}`);
  } catch {
    /* the old branding cache is optional */
  }
}

export async function uploadLogo(gymId: string, file: File): Promise<string> {
  if (!(file.type in LOGO_TYPES)) throw new Error('Use a PNG, JPG or WebP image.');
  const path = logoPath(gymId, Date.now(), file.type);
  const up = await supabase.storage.from('gym-logos').upload(path, file, { contentType: file.type, upsert: false });
  if (up.error) throw up.error;
  const url = supabase.storage.from('gym-logos').getPublicUrl(path).data.publicUrl;
  await applyLogo(gymId, url);
  return url;
}

export const removeLogo = (gymId: string) => applyLogo(gymId, null);

export async function saveSender(gymId: string, p: SenderPayload): Promise<void> {
  const { error } = await supabase.from('gym_communication_settings').upsert({ gym_id: gymId, ...p, updated_at: new Date().toISOString() }, { onConflict: 'gym_id' });
  if (error) throw error;
}

export async function saveTemplate(gymId: string, v: { subject: string; preheader: string | null; heading: string; body_text: string; button_label: string }): Promise<void> {
  const { error } = await supabase.from('gym_email_templates').upsert(
    { gym_id: gymId, template_key: 'access_invite', category: 'transactional', template_name: 'Access invitation', ...v, enabled: true, updated_at: new Date().toISOString() },
    { onConflict: 'gym_id,template_key' },
  );
  if (error) throw error;
}
