import type { Session } from '@supabase/supabase-js';
import { supabase } from './client';

export async function getSession(): Promise<Session | null> {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
}

export function onSessionChange(cb: (session: Session | null) => void): () => void {
  const { data } = supabase.auth.onAuthStateChange((_event, session) => cb(session));
  return () => data.subscription.unsubscribe();
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
}

export async function signInWithPassword(email: string, password: string): Promise<void> {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
}

/** Sends the password reset email. `redirectTo` is the page the link in the email opens. */
export async function sendPasswordReset(email: string, redirectTo: string): Promise<void> {
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
  if (error) throw error;
}

/** Sends a one-time sign-in link. Never creates an account. */
export async function sendSignInLink(email: string, redirectTo: string): Promise<void> {
  const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: redirectTo, shouldCreateUser: false } });
  if (error) throw error;
}

export interface PublicGymBrand {
  name: string | null;
  logoUrl: string | null;
}

/** The name and logo a gym shows on its own sign-in link. Public by design; null when the gym is not found. */
export async function getPublicGymBrand(gymId: string): Promise<PublicGymBrand | null> {
  const { data, error } = await supabase.rpc('get_public_gym_brand', { p_gym_id: gymId });
  if (error || !data || typeof data !== 'object' || Array.isArray(data)) return null;
  const b = data as { name?: unknown; logo_url?: unknown };
  return { name: typeof b.name === 'string' ? b.name : null, logoUrl: typeof b.logo_url === 'string' ? b.logo_url : null };
}

/** Sets a new password for the signed-in person (used after a password reset link). */
export async function updatePassword(password: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw error;
}

export interface AccessInvite {
  email: string;
  gymName: string;
  role: string;
  status: string;
}

/** Looks up an access invitation by its secure token. Null when there is no such invitation. */
export async function getAccessInvite(token: string): Promise<AccessInvite | null> {
  const { data, error } = await supabase.rpc('get_access_invite', { invite_token: token });
  if (error) throw error;
  const row = data?.[0];
  return row ? { email: row.email, gymName: row.gym_name, role: row.invite_role || 'admin', status: row.status } : null;
}

export interface ClaimedInvite {
  gymId: string;
  role: string;
  active: boolean;
}

/** Accepts the invitation for the signed-in person. The database checks the email matches. */
export async function claimAccessInvite(token: string): Promise<ClaimedInvite> {
  const { data, error } = await supabase.rpc('claim_access_invite', { invite_token: token });
  if (error) throw error;
  const row = data?.[0];
  if (!row) throw new Error('Invitation could not be accepted.');
  return { gymId: row.gym_id, role: row.role, active: row.access_status === 'active' };
}

/** Creates the invited person's account. Returns true when they are signed in straight away (no email confirmation needed). */
export async function signUpForInvite(email: string, password: string, name: string, redirectTo: string): Promise<boolean> {
  const display = name || email.split('@')[0];
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: redirectTo, data: { display_name: display, full_name: display, signup_type: 'staff' } },
  });
  if (error) throw error;
  return !!data.session;
}
