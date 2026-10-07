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
