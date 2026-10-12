import type { MemberRow } from '../data/members';
import type { MemberDetails } from '../data/memberDetails';
import { isUnder18, normalisePhone, normalisePostcode, type JoinDetails } from '../join/calc';

// Pure rules behind the Members screen. Same behaviour as the legacy directory.

export type SortMode = 'first' | 'surname' | 'registered_desc' | 'registered_asc';

export function nameOf(m: Pick<MemberRow, 'displayName' | 'firstName' | 'lastName'>): string {
  return m.displayName || [m.firstName, m.lastName].filter(Boolean).join(' ') || 'Member';
}

export function nameParts(m: Pick<MemberRow, 'displayName' | 'firstName' | 'lastName'>): { first: string; surname: string } {
  const fallback = nameOf(m).trim().split(/\s+/);
  return {
    first: (m.firstName || fallback[0] || '').trim(),
    surname: (m.lastName || fallback.slice(1).join(' ') || '').trim(),
  };
}

export function jumpLetter(m: MemberRow, mode: SortMode): string {
  const p = nameParts(m);
  const base = mode === 'surname' ? p.surname || p.first : p.first || p.surname;
  return (base || '#').charAt(0).toUpperCase();
}

function sortKey(m: MemberRow, mode: SortMode): string | number {
  const p = nameParts(m);
  if (mode === 'surname') return (p.surname || p.first || nameOf(m)).toLocaleLowerCase();
  if (mode === 'registered_asc' || mode === 'registered_desc') return new Date(m.joinedAt || 0).getTime();
  return (p.first || nameOf(m)).toLocaleLowerCase();
}

export function filterAndSort(rows: MemberRow[], opts: { search: string; sort: SortMode; letter: string }): MemberRow[] {
  const search = opts.search.trim().toLocaleLowerCase();
  const out = rows.filter((m) => {
    const p = nameParts(m);
    const hay = [nameOf(m), p.first, p.surname].join(' ').toLocaleLowerCase();
    const letterOk = !opts.letter || jumpLetter(m, opts.sort) === opts.letter;
    return (!search || hay.includes(search)) && letterOk;
  });
  return out.sort((a, b) => {
    const ka = sortKey(a, opts.sort);
    const kb = sortKey(b, opts.sort);
    if (opts.sort === 'registered_desc') return Number(kb) - Number(ka);
    if (opts.sort === 'registered_asc') return Number(ka) - Number(kb);
    return String(ka).localeCompare(String(kb), undefined, { sensitivity: 'base' });
  });
}

export function availableLetters(rows: MemberRow[], mode: SortMode): Set<string> {
  return new Set(rows.map((m) => jumpLetter(m, mode)));
}

/** Owners, admins, staff and coaches. */
export const isTeam = (m: Pick<MemberRow, 'role'>): boolean => m.role !== 'member';

export const ROLE_LABEL: Record<string, string> = { owner: 'Owner', admin: 'Admin', staff: 'Staff', coach: 'Coach', member: 'Member' };

export type Show = 'all' | 'members' | 'team';

export function showOnly(rows: MemberRow[], show: Show): MemberRow[] {
  return show === 'all' ? rows : rows.filter((m) => isTeam(m) === (show === 'team'));
}

export function summaryText(shown: number, total: number): string {
  return shown === total ? `${total} gym users` : `${shown} of ${total} gym users`;
}

export function initials(name: string): string {
  return (name || 'H').split(/\s+/).slice(0, 2).map((x) => x[0] ?? '').join('').toUpperCase();
}

export function labelStatus(status: string | null | undefined): string {
  return String(status || 'pending').replaceAll('_', ' ');
}

export function formatRegistered(d: string | null | undefined): string {
  if (!d) return 'Unknown';
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(d));
}

export function formatDate(d: string | null | undefined): string {
  if (!d) return '—';
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(`${d}T00:00:00`));
}

/** Local YYYY-MM-DD for a date input. */
export function dateInputValue(v: string | null | undefined): string {
  if (!v) return '';
  const d = new Date(v);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function validateLifecycle(joined: string, attrition: string): string | null {
  if (!joined) return 'Joined date is required.';
  if (attrition && attrition < joined) return 'Attrition cannot be before joined date.';
  return null;
}

export function paymentHint(payment: 'manual' | 'gocardless'): string {
  return payment === 'gocardless'
    ? 'Creates the HybridOne membership now and leaves payment pending until a GoCardless mandate/subscription is linked.'
    : 'Manual mode lets the gym use HybridOne before GoCardless is connected.';
}

/** "3 members are missing details", "1 member is missing details". */
export function missingSummary(n: number): string {
  return n === 1 ? '1 member is missing details' : `${n} members are missing details`;
}

/** "address, emergency contact" for the line under a name. */
export function missingList(missing: string[]): string {
  return missing.join(', ');
}

/** "12 High Street, Flat 2, Truro, TR1 2AB" on one line, or a dash when there is none. */
export function addressText(a: { line1: string; line2: string | null; town: string; postcode: string } | null | undefined): string {
  if (!a) return '—';
  return [a.line1, a.line2, a.town, a.postcode].map((x) => (x ?? '').trim()).filter(Boolean).join(', ');
}

/** "+447700900123" as "07700 900123" (UK numbers); anything else is shown as stored. */
export function phoneText(p: string | null | undefined): string {
  if (!p) return '—';
  const m = /^\+44(\d{4})(\d{6})$/.exec(p);
  return m ? `0${m[1]} ${m[2]}` : p;
}

/** "Jo Smith (Mum), 07700 900123" for the emergency contact, or a dash. */
export function emergencyText(e: { name: string; phone: string; relationship: string } | null | undefined): string {
  if (!e || !e.name) return '—';
  return `${e.name} (${e.relationship}), ${phoneText(e.phone)}`;
}

/** "14 Mar 2001 (25)" for a date of birth, or a dash. */
export function dobText(dob: string | null | undefined, now: Date): string {
  if (!dob) return '—';
  const born = new Date(`${dob}T00:00:00Z`);
  if (Number.isNaN(born.getTime())) return '—';
  let age = now.getUTCFullYear() - born.getUTCFullYear();
  if (now.getUTCMonth() < born.getUTCMonth() || (now.getUTCMonth() === born.getUTCMonth() && now.getUTCDate() < born.getUTCDate())) age--;
  return `${formatDate(dob)} (${age})`;
}

/** The form's starting values: what is held now. The mobile number is shown the way people write it (07…). */
export function draftFromDetails(member: Pick<MemberRow, 'displayName' | 'firstName' | 'lastName'>, d: MemberDetails): JoinDetails {
  const p = nameParts(member);
  return {
    firstName: p.first, lastName: p.surname, dob: d.dateOfBirth ?? '', phone: d.phone ? phoneText(d.phone) : '',
    line1: d.address?.line1 ?? '', line2: d.address?.line2 ?? '', town: d.address?.town ?? '', postcode: d.address?.postcode ?? '',
    emergencyName: d.emergency?.name ?? '', emergencyPhone: d.emergency?.phone ? phoneText(d.emergency.phone) : '', emergencyRelationship: d.emergency?.relationship ?? '',
    guardianName: d.guardian?.name ?? '', guardianPhone: d.guardian?.phone ? phoneText(d.guardian.phone) : '',
  };
}

/** What is wrong with the form, said to the person filling it in for someone else; null when it can be saved. The database checks all of it again. */
export function checkDetailsDraft(d: JoinDetails, now: Date): string | null {
  const short = (v: string, what: string): string | null => (!v.trim() ? `Enter ${what}.` : v.trim().length > 80 ? 'That is too long.' : null);
  const dob = /^\d{4}-\d{2}-\d{2}$/.test(d.dob.trim()) ? new Date(`${d.dob.trim()}T00:00:00Z`) : null;
  if (short(d.firstName, 'a first name')) return short(d.firstName, 'a first name');
  if (short(d.lastName, 'a last name')) return short(d.lastName, 'a last name');
  if (!dob || Number.isNaN(dob.getTime())) return 'Choose a date of birth.';
  if (dob.getTime() > now.getTime() || dob.getUTCFullYear() < 1900) return 'Check the date of birth.';
  if (!normalisePhone(d.phone)) return 'Enter a valid mobile number, for example 07700 900123.';
  if (!d.line1.trim()) return 'Enter the first line of the address.';
  if (d.line1.trim().length > 120 || d.line2.trim().length > 120) return 'That address line is too long.';
  if (!d.town.trim()) return 'Enter a town or city.';
  if (!normalisePostcode(d.postcode)) return 'Enter a valid UK postcode, for example PL28 8AB.';
  if (short(d.emergencyName, "the emergency contact's name")) return short(d.emergencyName, "the emergency contact's name");
  if (!normalisePhone(d.emergencyPhone)) return 'Enter a valid phone number for the emergency contact.';
  const rel = d.emergencyRelationship.trim();
  if (rel.length < 2) return 'Say how they are related to the member, for example partner, parent or friend.';
  if (rel.length > 40) return 'That relationship is too long.';
  if (isUnder18(d.dob, now)) {
    if (short(d.guardianName, "the parent or guardian's name")) return short(d.guardianName, "the parent or guardian's name");
    if (!normalisePhone(d.guardianPhone)) return 'Enter a valid phone number for the parent or guardian.';
  }
  return null;
}

/** "today", "yesterday" or "5 days ago": plain, never "late". Days are counted in UK time. */
export function daysAgo(iso: string, now: Date): string {
  const day = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London' }).format(d);
  const n = Math.round((Date.parse(day(now)) - Date.parse(day(new Date(iso)))) / 86400000);
  if (!Number.isFinite(n) || n <= 0) return 'today';
  return n === 1 ? 'yesterday' : `${n} days ago`;
}
