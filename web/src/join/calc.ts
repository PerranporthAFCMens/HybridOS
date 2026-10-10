import { checkBirthday } from '../member/account';

// The rules for the sign-up journey. The database checks all of these again; they are here so a person is told
// what is wrong on the screen they are looking at, and so the rules are tested without a screen.

export interface JoinDetails {
  firstName: string;
  lastName: string;
  dob: string;
  phone: string;
  line1: string;
  line2: string;
  town: string;
  postcode: string;
  emergencyName: string;
  emergencyPhone: string;
  emergencyRelationship: string;
  guardianName: string;
  guardianPhone: string;
}

export const EMPTY_DETAILS: JoinDetails = {
  firstName: '', lastName: '', dob: '', phone: '', line1: '', line2: '', town: '', postcode: '',
  emergencyName: '', emergencyPhone: '', emergencyRelationship: '', guardianName: '', guardianPhone: '',
};

export type StepId = 'account' | 'about' | 'address' | 'emergency' | 'guardian' | 'terms' | 'plan' | 'done';

export const STEP_TITLES: Record<StepId, string> = {
  account: 'Your account', about: 'About you', address: 'Your address', emergency: 'Emergency contact',
  guardian: 'Parent or guardian', terms: 'Terms and health declaration', plan: 'Choose your membership', done: 'Welcome',
};

/** The steps this person goes through. Guardian only under 18; terms only when the gym has some. */
export function stepsFor(opts: { under18: boolean; hasTerms: boolean }): StepId[] {
  const steps: StepId[] = ['account', 'about', 'address', 'emergency'];
  if (opts.under18) steps.push('guardian');
  if (opts.hasTerms) steps.push('terms');
  steps.push('plan', 'done');
  return steps;
}

/** Under 18 on the given day. An unreadable date counts as not under 18 (the date check reports it). */
export function isUnder18(dob: string, now: Date): boolean {
  if (checkBirthday(dob, now)) return false;
  const [y, m, d] = dob.split('-').map(Number) as [number, number, number];
  const eighteenth = Date.UTC(y + 18, m - 1, d);
  return eighteenth > Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
}

/**
 * A phone number as the database wants it ("+447700900123"). Accepts spaces and brackets, "07…" (UK), "00…" and "+…".
 * Returns '' when it cannot be a real number.
 */
export function normalisePhone(raw: string): string {
  let n = raw.trim().replace(/[^0-9+]/g, '');
  if (!n) return '';
  if (n.startsWith('00')) n = `+${n.slice(2)}`;
  else if (!n.startsWith('+')) n = `+44${n.replace(/^0+/, '')}`;
  return /^\+[1-9][0-9]{6,14}$/.test(n) ? n : '';
}

/** A UK postcode with the space in the right place ("PL28 8AB"), or '' when it is not one. */
export function normalisePostcode(raw: string): string {
  const n = raw.replace(/\s+/g, '').toUpperCase();
  if (!/^[A-Z]{1,2}[0-9][A-Z0-9]?[0-9][A-Z]{2}$/.test(n)) return '';
  return `${n.slice(0, -3)} ${n.slice(-3)}`;
}

export const MIN_PASSWORD = 8;

export function checkAccount(email: string, password: string, confirm: string): string | null {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return 'Enter a valid email address.';
  if (password.length < MIN_PASSWORD) return `Use a password with at least ${MIN_PASSWORD} characters.`;
  if (password !== confirm) return 'The two passwords do not match.';
  return null;
}

const name = (v: string, what: string): string | null => (!v.trim() ? `Enter ${what}.` : v.trim().length > 80 ? 'That is too long.' : null);

export function checkAbout(d: JoinDetails, now: Date): string | null {
  return name(d.firstName, 'your first name') ?? name(d.lastName, 'your last name') ?? checkBirthday(d.dob, now)
    ?? (normalisePhone(d.phone) ? null : 'Enter a valid mobile number, for example 07700 900123.');
}

export function checkAddress(d: JoinDetails): string | null {
  if (!d.line1.trim()) return 'Enter the first line of your address.';
  if (d.line1.trim().length > 120 || d.line2.trim().length > 120) return 'That address line is too long.';
  if (!d.town.trim()) return 'Enter your town or city.';
  if (!normalisePostcode(d.postcode)) return 'Enter a valid UK postcode, for example PL28 8AB.';
  return null;
}

export function checkEmergency(d: JoinDetails): string | null {
  const rel = d.emergencyRelationship.trim();
  return name(d.emergencyName, "your emergency contact's name")
    ?? (normalisePhone(d.emergencyPhone) ? null : "Enter a valid phone number for your emergency contact.")
    ?? (rel.length < 2 ? 'Say how they are related to you, for example partner, parent or friend.' : rel.length > 40 ? 'That is too long.' : null);
}

export function checkGuardian(d: JoinDetails): string | null {
  return name(d.guardianName, "your parent or guardian's name")
    ?? (normalisePhone(d.guardianPhone) ? null : 'Enter a valid phone number for your parent or guardian.');
}

/** What is sent to save_my_join_details. Guardian details are sent only for under-18s. */
export function toRpcArgs(d: JoinDetails, now: Date) {
  const under = isUnder18(d.dob, now);
  return {
    p_first_name: d.firstName.trim(),
    p_last_name: d.lastName.trim(),
    p_date_of_birth: d.dob,
    p_phone: normalisePhone(d.phone),
    p_address_line1: d.line1.trim(),
    p_address_line2: d.line2.trim(),
    p_town: d.town.trim(),
    p_postcode: normalisePostcode(d.postcode),
    p_emergency_name: d.emergencyName.trim(),
    p_emergency_phone: normalisePhone(d.emergencyPhone),
    p_emergency_relationship: d.emergencyRelationship.trim(),
    p_guardian_name: under ? d.guardianName.trim() : '',
    p_guardian_phone: under ? normalisePhone(d.guardianPhone) : '',
  };
}

export interface JoinPlan {
  id: string;
  name: string;
  description: string | null;
  pricePence: number;
  interval: string;
  perks: string[];
}

/** "£59.00 / monthly", or just the price for a one-off. */
export function planPrice(p: Pick<JoinPlan, 'pricePence' | 'interval'>): string {
  const amount = `£${(p.pricePence / 100).toFixed(2)}`;
  return p.interval === 'one_off' ? amount : `${amount} / ${p.interval}`;
}
