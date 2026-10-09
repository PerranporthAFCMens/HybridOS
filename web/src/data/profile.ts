import { supabase } from './client';

export interface ProfileNames {
  displayName: string | null;
  firstName: string | null;
  lastName: string | null;
}

/** The signed-in person's own profile names. */
export async function getProfileNames(userId: string): Promise<ProfileNames> {
  const { data, error } = await supabase
    .from('profiles')
    .select('display_name, first_name, last_name')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw error;
  return { displayName: data?.display_name ?? null, firstName: data?.first_name ?? null, lastName: data?.last_name ?? null };
}

/** Save the member's own name: the profile row, and the sign-in account so both agree. */
export async function updateMyName(userId: string, n: { displayName: string; firstName: string; lastName: string }): Promise<void> {
  const p = await supabase.from('profiles').update({ display_name: n.displayName, first_name: n.firstName || null, last_name: n.lastName || null }).eq('id', userId);
  if (p.error) throw new Error(p.error.message);
  const a = await supabase.auth.updateUser({ data: { display_name: n.displayName, full_name: n.displayName } });
  if (a.error) throw new Error(a.error.message);
}

/** Ask to change the sign-in email. The old address stays in use until the new one is confirmed by email. */
export async function changeMyEmail(email: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({ email });
  if (error) throw new Error(error.message);
}

export async function changeMyPassword(password: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw new Error(error.message);
}
