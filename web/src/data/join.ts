import { siteUrl } from '../app/site';
import { supabase } from './client';
import { edgeErrorMessage } from './edge';
import type { Json } from './database.types';
import { BLOCKING_STATUSES, looksLikeExistingAccount, parseReady, type JoinDocument, type JoinPlan, type JoinQuestion, type ReadyStatus } from '../join/calc';

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
    const whole = (v: Json | undefined): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
    return { id: str(p.id), name: str(p.name), description: str(p.description) || null, pricePence: Number(p.price_pence) || 0, interval: str(p.billing_interval), perks, minTermMonths: whole(p.min_term_months), noticeDays: whole(p.notice_days) };
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

/** Confirms a new account with the 6-digit code from the email. On success the person is signed in. */
export async function confirmWithCode(email: string, code: string): Promise<void> {
  const { error } = await supabase.auth.verifyOtp({ email: email.trim().toLowerCase(), token: code, type: 'email' });
  if (error) throw new Error(/expired|invalid/i.test(error.message) ? 'That code is wrong or has run out. Check it, or ask for a new one.' : error.message);
}

/** Sends a fresh code to the same address. */
export async function resendCode(email: string, slug: string): Promise<void> {
  const back = new URL(siteUrl(`join/${encodeURIComponent(slug)}`), window.location.origin);
  const { error } = await supabase.auth.resend({ type: 'signup', email: email.trim().toLowerCase(), options: { emailRedirectTo: back.toString() } });
  if (error) throw new Error(error.message);
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

// ---- Paying to join (Stripe) ----

/** 'stripe' when this gym takes the first payment on the sign-up page, otherwise 'off' (joining works as it always did). */
export async function getPaymentMode(slug: string): Promise<'stripe' | 'off'> {
  const { data, error } = await supabase.rpc('get_gym_payment_mode', { p_gym_slug: slug });
  if (error) throw new Error(error.message);
  return data === 'stripe' ? 'stripe' : 'off';
}

export interface PaymentSession {
  publishableKey: string;
  stripeAccount: string;
  clientSecret: string;
  subscriptionId: string;
  dueTodayPence: number;
  amountPence: number;
  interval: string;
  nextPaymentDate: string;
  wording: string;
  under18: boolean;
}

async function callJoin(body: Record<string, unknown>): Promise<Record<string, Json | undefined>> {
  const { data, error } = await supabase.functions.invoke('stripe-join', { body });
  if (error) throw new Error(await edgeErrorMessage(error, 'The payment service did not answer. Please try again.'));
  return obj(data as Json);
}

/** Sets up the payment for this plan (and creates the pending membership). A person under 18 passes their parent or guardian. */
export async function preparePayment(gymId: string, planId: string, guardian: { name: string; email: string } | null): Promise<PaymentSession> {
  const r = await callJoin({ action: 'prepare', gym_id: gymId, plan_id: planId, ...(guardian ? { guardian } : {}) });
  return {
    publishableKey: str(r.publishable_key), stripeAccount: str(r.stripe_account), clientSecret: str(r.client_secret), subscriptionId: str(r.subscription_id),
    dueTodayPence: Number(r.amount_due_pence) || 0, amountPence: Number(r.amount_pence) || 0, interval: str(r.interval), nextPaymentDate: str(r.next_payment_date),
    wording: str(r.wording), under18: r.under18 === true,
  };
}

/** After the card form worked: the server asks Stripe, and only then turns the membership on. 'pending' means Stripe has not confirmed yet. */
export async function finishPayment(gymId: string, planId: string, subscriptionId: string): Promise<'active' | 'pending'> {
  const r = await callJoin({ action: 'finish', gym_id: gymId, plan_id: planId, subscription_id: subscriptionId });
  return r.status === 'active' ? 'active' : 'pending';
}

// ---- Quick join: pay first, finish later ----

export interface JoinStyle { style: 'quick' | 'full'; askAddress: string; askEmergency: string; askDocuments: string }

/** Which sign-up journey this gym uses, and what it asks for afterwards. Anything unexpected (or a database without Quick join yet) is the full journey, as it always was. */
export async function getJoinStyle(slug: string): Promise<JoinStyle> {
  const { data, error } = await supabase.rpc('get_public_gym_join_style', { p_gym_slug: slug });
  const r = error ? {} : obj(data);
  return { style: r.join_style === 'quick' ? 'quick' : 'full', askAddress: str(r.ask_address) || 'optional', askEmergency: str(r.ask_emergency) || 'required', askDocuments: str(r.ask_documents) || 'required' };
}

/** Emails a sign-in code. A new address gets an account; an existing one just signs in. No password either way. */
export async function emailMeACode(email: string, slug: string, gymId: string): Promise<void> {
  const back = new URL(siteUrl(`join/${encodeURIComponent(slug)}`), window.location.origin);
  back.searchParams.set('gym', slug);
  back.searchParams.set('gym_id', gymId);
  const { error } = await supabase.auth.signInWithOtp({
    email: email.trim().toLowerCase(),
    options: { shouldCreateUser: true, emailRedirectTo: back.toString(), data: { signup_type: 'member', gym_slug: slug } },
  });
  if (error) throw new Error(error.message);
}

type BasicsArgs = { p_first_name: string; p_last_name: string; p_date_of_birth: string; p_phone: string; p_guardian_name: string; p_guardian_phone: string };

/** Name, date of birth, mobile and (under 18) parent or guardian: what is needed before paying. The database checks them all again. */
export async function saveBasics(args: BasicsArgs): Promise<void> {
  const { error } = await supabase.rpc('save_my_basics', args);
  if (error) throw new Error(error.message);
}

export async function saveEmergency(name: string, phone: string, relationship: string): Promise<void> {
  const { error } = await supabase.rpc('save_my_emergency', { p_name: name, p_phone: phone, p_relationship: relationship });
  if (error) throw new Error(error.message);
}

export async function saveAddress(line1: string, line2: string, town: string, postcode: string): Promise<void> {
  const { error } = await supabase.rpc('save_my_address', { p_line1: line1, p_line2: line2, p_town: town, p_postcode: postcode });
  if (error) throw new Error(error.message);
}

/** What this member still has to do at the gym, and whether the door code is being held until then. Null when they are not a member. */
export async function getReadyStatus(gymId: string): Promise<ReadyStatus | null> {
  const { data, error } = await supabase.rpc('get_my_ready_status', { p_gym_id: gymId });
  if (error) throw new Error(error.message);
  return parseReady(data);
}

/** The signed-in member's own date of birth (it is private), to know whether a parent or guardian signs. */
export async function myBirthday(): Promise<string | null> {
  const { data, error } = await supabase.rpc('get_my_private_profile');
  if (error) throw new Error(error.message);
  const v = obj(data).date_of_birth;
  return typeof v === 'string' ? v : null;
}

/** The web address name of a gym the signed-in person belongs to (the sign-up documents are asked for by it). */
export async function getGymSlug(gymId: string): Promise<string> {
  const { data, error } = await supabase.from('gyms').select('slug').eq('id', gymId).single();
  if (error) throw new Error(error.message);
  return data.slug;
}
