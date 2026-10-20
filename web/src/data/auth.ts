import type { Session } from '@supabase/supabase-js';
import type { ConfirmType } from '../auth/confirmLink';
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

/** Confirms a link from an email that opens on our own domain. On success the person is signed in on this browser. */
export async function confirmEmailLink(tokenHash: string, type: ConfirmType): Promise<void> {
  const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
  if (error) throw new Error(/expired|invalid|used/i.test(error.message) ? 'This link has run out or was already used.' : error.message);
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
/** 'exists': Supabase hides an address that already has an account (no error, no session, no email), so the screen must say so. */
export async function signUpForInvite(email: string, password: string, name: string, redirectTo: string): Promise<'signed-in' | 'confirm' | 'exists'> {
  const display = name || email.split('@')[0];
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: redirectTo, data: { display_name: display, full_name: display, signup_type: 'staff' } },
  });
  if (error) throw error;
  if (data.session) return 'signed-in';
  return data.user && data.user.identities?.length === 0 ? 'exists' : 'confirm';
}

/** Confirms a new account with the code from the email. On success the person is signed in. Used by every sign-up screen. */
export async function confirmWithCode(email: string, code: string): Promise<void> {
  const { error } = await supabase.auth.verifyOtp({ email: email.trim().toLowerCase(), token: code, type: 'email' });
  if (error) throw new Error(/expired|invalid/i.test(error.message) ? 'That code is wrong or has run out. Check it, or ask for a new one.' : error.message);
}

/** Sends a fresh code to the same address. `redirectTo` is the page the link in the same email opens. */
export async function resendCode(email: string, redirectTo: string): Promise<void> {
  const { error } = await supabase.auth.resend({ type: 'signup', email: email.trim().toLowerCase(), options: { emailRedirectTo: redirectTo } });
  if (error) throw new Error(error.message);
}
