import { supabase } from './client';
import type { Json } from './database.types';
import type { JoinPlan } from '../join/calc';

export interface JoinGym {
  gymId: string;
  name: string;
  logoUrl: string | null;
  plans: JoinPlan[];
}

export interface JoinTerms { termsText: string; healthText: string; version: number }

const obj = (v: Json | null): Record<string, Json | undefined> => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});
const str = (v: Json | undefined): string => (typeof v === 'string' ? v : '');

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

export async function getJoinTerms(slug: string): Promise<JoinTerms> {
  const { data, error } = await supabase.rpc('get_public_gym_join_terms', { p_gym_slug: slug });
  if (error) throw new Error(error.message);
  const t = obj(data);
  return { termsText: str(t.terms_text), healthText: str(t.health_declaration_text), version: Number(t.terms_version) || 1 };
}

export const hasTerms = (t: JoinTerms): boolean => t.termsText.trim() !== '' || t.healthText.trim() !== '';

export async function createAccount(email: string, password: string, slug: string, gymName: string): Promise<{ signedIn: boolean }> {
  const back = new URL('./', window.location.href);
  back.searchParams.set('join', slug);
  const { data, error } = await supabase.auth.signUp({
    email: email.trim().toLowerCase(),
    password,
    options: { emailRedirectTo: back.toString(), data: { signup_type: 'member', gym_slug: slug, gym_name: gymName } },
  });
  if (error) throw new Error(error.message);
  return { signedIn: !!data.session };
}

export async function signInToJoin(email: string, password: string): Promise<void> {
  const { error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
  if (error) throw new Error(error.message);
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

export async function acceptTerms(slug: string): Promise<void> {
  const { error } = await supabase.rpc('accept_gym_terms', { p_gym_slug: slug });
  if (error) throw new Error(error.message);
}

export async function joinWithPlan(slug: string, planId: string): Promise<{ planName: string; gymId: string }> {
  const { data, error } = await supabase.rpc('join_public_gym_with_membership', { p_gym_slug: slug, p_plan_id: planId });
  if (error) throw new Error(error.message);
  const r = obj(data);
  return { planName: str(r.plan_name) || 'Membership', gymId: str(r.gym_id) };
}
