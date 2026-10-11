import { supabase } from './client';
import type { Json } from './database.types';
import { toRpcArgs, type JoinDetails } from '../join/calc';

export interface SignedCopy { id: string; signedAt: string; signerName: string; isGuardian: boolean; termsPath: string | null; waiverPath: string | null; emailedAt: string | null }

export interface MemberDetails {
  dateOfBirth: string | null;
  /** The owner has hidden mobile numbers (or addresses) from the team, so this person cannot see them. */
  phoneHidden: boolean;
  addressHidden: boolean;
  phone: string | null;
  /** False for someone who has never given an address and emergency contact (for example, a member added by staff). */
  hasDetails: boolean;
  address: { line1: string; line2: string | null; town: string; postcode: string } | null;
  emergency: { name: string; phone: string; relationship: string } | null;
  guardian: { name: string; phone: string } | null;
  signed: SignedCopy[];
}

const o = (v: Json | undefined): { [k: string]: Json | undefined } => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});
const s = (v: Json | undefined): string | null => (typeof v === 'string' && v !== '' ? v : null);

/** What the gym holds on one member. Read through the database function, which hides the mobile number and address when the owner has chosen to hide them from the team. */
export async function getMemberDetails(gymId: string, userId: string): Promise<MemberDetails> {
  const [d, sig] = await Promise.all([
    supabase.rpc('get_member_details', { p_gym_id: gymId, p_user_id: userId }),
    supabase.from('member_signatures').select('*').eq('gym_id', gymId).eq('user_id', userId).order('signed_at', { ascending: false }),
  ]);
  if (d.error) throw new Error(d.error.message);
  if (sig.error) throw new Error(sig.error.message);
  const r = o(d.data);
  const line1 = s(r.address_line1);
  const town = s(r.town);
  const postcode = s(r.postcode);
  const ecName = s(r.emergency_name);
  const gName = s(r.guardian_name);
  return {
    dateOfBirth: s(r.date_of_birth),
    phoneHidden: r.phone_hidden === true,
    addressHidden: r.address_hidden === true,
    phone: s(r.phone),
    hasDetails: r.has_details === true,
    address: line1 && town && postcode ? { line1, line2: s(r.address_line2), town, postcode } : null,
    emergency: ecName ? { name: ecName, phone: s(r.emergency_phone) ?? '', relationship: s(r.emergency_relationship) ?? '' } : null,
    guardian: gName ? { name: gName, phone: s(r.guardian_phone) ?? '' } : null,
    signed: (sig.data ?? []).map((x) => ({ id: x.id, signedAt: x.signed_at, signerName: x.signer_name, isGuardian: x.signer_is_guardian, termsPath: x.signed_terms_path, waiverPath: x.signed_waiver_path, emailedAt: x.emailed_at })),
  };
}

/** Saves everything on the form for a member. The database checks who is asking and every field again. */
export async function saveMemberDetails(gymId: string, userId: string, d: JoinDetails, now: Date): Promise<void> {
  const { error } = await supabase.rpc('staff_save_member_details', { p_gym_id: gymId, p_user_id: userId, ...toRpcArgs(d, now) });
  if (error) throw new Error(error.message);
}

export interface ContactVisibility { teamSeesPhone: boolean; teamSeesAddress: boolean }

export async function getContactVisibility(gymId: string): Promise<ContactVisibility> {
  const { data, error } = await supabase.rpc('get_member_contact_visibility', { p_gym_id: gymId });
  if (error) throw new Error(error.message);
  const r = o(data);
  return { teamSeesPhone: r.team_sees_phone !== false, teamSeesAddress: r.team_sees_address !== false };
}

export async function setContactVisibility(gymId: string, v: ContactVisibility): Promise<void> {
  const { error } = await supabase.rpc('set_member_contact_visibility', { p_gym_id: gymId, p_team_sees_phone: v.teamSeesPhone, p_team_sees_address: v.teamSeesAddress });
  if (error) throw new Error(error.message);
}
