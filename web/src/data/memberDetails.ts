import { supabase } from './client';

export interface SignedCopy { id: string; signedAt: string; signerName: string; isGuardian: boolean; termsPath: string | null; waiverPath: string | null; emailedAt: string | null }

export interface MemberDetails {
  dateOfBirth: string | null;
  phone: string | null;
  /** Null when the person has never given their address and emergency contact (for example, a member added by staff). */
  contact: {
    addressLine1: string; addressLine2: string | null; town: string; postcode: string;
    emergencyName: string; emergencyPhone: string; emergencyRelationship: string;
    guardianName: string | null; guardianPhone: string | null;
  } | null;
  signed: SignedCopy[];
}

/** What the gym holds on one member. Only the member and the gym's owner, admin and staff can read it (row rules in the database). */
export async function getMemberDetails(gymId: string, userId: string): Promise<MemberDetails> {
  const [p, d, s] = await Promise.all([
    supabase.from('profiles').select('date_of_birth, phone').eq('id', userId).maybeSingle(),
    supabase.from('member_details').select('*').eq('user_id', userId).maybeSingle(),
    supabase.from('member_signatures').select('*').eq('gym_id', gymId).eq('user_id', userId).order('signed_at', { ascending: false }),
  ]);
  if (p.error) throw new Error(p.error.message);
  if (d.error) throw new Error(d.error.message);
  if (s.error) throw new Error(s.error.message);
  const c = d.data;
  return {
    dateOfBirth: p.data?.date_of_birth ?? null,
    phone: p.data?.phone ?? null,
    contact: c
      ? {
          addressLine1: c.address_line1, addressLine2: c.address_line2, town: c.town, postcode: c.postcode,
          emergencyName: c.emergency_name, emergencyPhone: c.emergency_phone, emergencyRelationship: c.emergency_relationship,
          guardianName: c.guardian_name, guardianPhone: c.guardian_phone,
        }
      : null,
    signed: (s.data ?? []).map((r) => ({ id: r.id, signedAt: r.signed_at, signerName: r.signer_name, isGuardian: r.signer_is_guardian, termsPath: r.signed_terms_path, waiverPath: r.signed_waiver_path, emailedAt: r.emailed_at })),
  };
}
