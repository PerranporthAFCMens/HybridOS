import { siteUrl } from '../app/site';
import { supabase } from './client';
import type { Json } from './database.types';
import { BLOCKING_STATUSES, looksLikeExistingAccount, type JoinDocument, type JoinPlan, type JoinQuestion } from '../join/calc';

const obj = (v: Json | null): Record<string, Json | undefined> => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});
const str = (v: Json | undefined): string => (typeof v === 'string' ? v : '');

export interface JoinGym {
  gymId: string;
  name: string;
  logoUrl: string | null;
  plans: JoinPlan[];
}

/** The gym behind a sign-up link and the plans it offers publicly. Works before anyone is signed in. */
export async function getJoinGym(slug: string): Promise<JoinGym> {
  const { data, error } = await supabase.rpc('get_public_gym_join_options', { p_gym_slug: slug });
  if (error) throw new Error(error.message);
  const g = obj(data);
  const rows = Array.isArray(g.plans) ? g.plans : [];
  const plans = rows.map((r): JoinPlan => {
    const p = obj(r);
    const perks: string[] = [];
    if (p.includes_open_gym) perks.push('Open gym');
    if (p.includes_classes) perks.push(typeof p.classes_per_week === 'number' ? `${p.classes_per_week} classes / week` : 'Classes included');
    if (p.includes_pt) perks.push('PT included');
    return { id: str(p.id), name: str(p.name), description: str(p.description) || null, pricePence: Number(p.price_pence) || 0, interval: str(p.billing_interval), perks };
  });
  return { gymId: str(g.gym_id), name: str(g.gym_name) || 'your gym', logoUrl: str(g.logo_url) || null, plans };
}

const arr = (v: Json | undefined): Json[] => (Array.isArray(v) ? v : []);

/** The documents a joiner must read and sign: the gym's current terms and waiver, with their questions. */
export async function getSignupDocuments(slug: string): Promise<JoinDocument[]> {
  const { data, error } = await supabase.rpc('get_public_gym_signup_documents', { p_gym_slug: slug });
  if (error) throw new Error(error.message);
  return arr(data ?? undefined).map((r): JoinDocument => {
    const d = obj(r);
    return {
      id: str(d.id), kind: d.kind === 'waiver' ? 'waiver' : 'terms', version: Number(d.version) || 1, title: str(d.title), source: d.source === 'pdf' ? 'pdf' : 'text',
      filePath: str(d.file_path) || null, fileName: str(d.file_name) || null, body: str(d.body_text) || null, acceptance: str(d.acceptance_text),
      questions: arr(d.questions).map((x): JoinQuestion => {
        const q = obj(x);
        return { id: str(q.id), prompt: str(q.prompt), answerType: q.answer_type === 'text' ? 'text' : 'yes_no', detailsIfYes: q.details_if_yes === true, required: q.is_required !== false };
      }),
    };
  });
}

export async function createAccount(email: string, password: string, slug: string, gymName: string): Promise<{ signedIn: boolean; existing: boolean }> {
  const back = new URL(siteUrl(`join/${encodeURIComponent(slug)}`), window.location.origin);
  const { data, error } = await supabase.auth.signUp({
    email: email.trim().toLowerCase(),
    password,
    options: { emailRedirectTo: back.toString(), data: { signup_type: 'member', gym_slug: slug, gym_name: gymName } },
  });
  if (looksLikeExistingAccount(error, data?.user)) return { signedIn: false, existing: true };
  if (error) throw new Error(error.message);
  return { signedIn: !!data.session, existing: false };
}

/** Sends the person to Facebook and brings them back to this same sign-up link, signed in. Only name, email and photo come back. */
export async function signInWithFacebook(slug: string): Promise<void> {
  const back = new URL(siteUrl(`join/${encodeURIComponent(slug)}`), window.location.origin);
  const { error } = await supabase.auth.signInWithOAuth({ provider: 'facebook', options: { redirectTo: back.toString() } });
  if (error) throw new Error(error.message);
}

/** First and last name a sign-in provider (Facebook, Google) gave us, or empty strings for an email sign-up. */
export async function providerNames(): Promise<{ first: string; last: string }> {
  const { data } = await supabase.auth.getSession();
  const m = (data.session?.user.user_metadata ?? {}) as Record<string, unknown>;
  const text = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
  const first = text(m.given_name) || text(m.first_name);
  const last = text(m.family_name) || text(m.last_name);
  if (first || last) return { first, last };
  const [head = '', ...rest] = (text(m.full_name) || text(m.name)).split(/\s+/);
  return { first: head, last: rest.join(' ') };
}

export async function signInToJoin(email: string, password: string): Promise<void> {
  const { error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
  if (error) throw new Error(error.message);
}

/** The status of this person's membership at the gym ('active', 'paused' or 'pending'), or null when they have none. Each person can read their own. */
export async function myMembershipAt(gymId: string, userId: string): Promise<string | null> {
  const { data, error } = await supabase.from('memberships').select('status').eq('gym_id', gymId).eq('user_id', userId).in('status', [...BLOCKING_STATUSES]).limit(1);
  if (error) throw new Error(error.message);
  return data?.[0]?.status ?? null;
}

export async function currentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id ?? null;
}

type SaveArgs = {
  p_first_name: string; p_last_name: string; p_date_of_birth: string; p_phone: string;
  p_address_line1: string; p_address_line2: string; p_town: string; p_postcode: string;
  p_emergency_name: string; p_emergency_phone: string; p_emergency_relationship: string;
  p_guardian_name: string; p_guardian_phone: string;
};

/** Saves every detail in one call; the database checks them all again. */
export async function saveJoinDetails(args: SaveArgs): Promise<void> {
  const { error } = await supabase.rpc('save_my_join_details', args);
  if (error) throw new Error(error.message);
}

/** Signs everything the gym currently asks for, once, with the answers to its questions. Returns the id of the signature. */
export async function signDocuments(slug: string, name: string, signaturePng: string, answers: Json): Promise<string> {
  const { data, error } = await supabase.rpc('sign_gym_documents', { p_gym_slug: slug, p_signer_name: name.trim(), p_signature_png: signaturePng, p_answers: answers });
  if (error) throw new Error(error.message);
  return str(obj(data).signature_id);
}

/**
 * Asks the server to make the signed copies and email them. Best effort: the signature is already saved, so a problem here
 * never stops the person joining; the reason is kept on the signature for the gym to see.
 */
export async function sendSignedCopies(signatureId: string): Promise<boolean> {
  if (!signatureId) return false;
  try {
    const { data, error } = await supabase.functions.invoke('finalise-signature', { body: { signature_id: signatureId } });
    if (error) return false;
    return obj(data as Json).emailed === true;
  } catch {
    return false;
  }
}

export async function joinWithPlan(slug: string, planId: string): Promise<{ planName: string; gymId: string }> {
  const { data, error } = await supabase.rpc('join_public_gym_with_membership', { p_gym_slug: slug, p_plan_id: planId });
  if (error) throw new Error(error.message);
  const r = obj(data);
  return { planName: str(r.plan_name) || 'Membership', gymId: str(r.gym_id) };
}
