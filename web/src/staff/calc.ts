// Pure rules behind the Staff screen: how a team member is described, what a valid edit looks like, and
// exactly which writes a save makes. Same fields as the old Staff, Resources and Services page, with the
// qualification expiry dates the old page silently dropped now kept.

export type StaffRole = 'staff' | 'coach';
export const STAFF_ROLES: [StaffRole, string][] = [['staff', 'Staff'], ['coach', 'Coach / PT']];
export const EMPLOYMENT: [string, string][] = [['hourly', 'Hourly'], ['salary', 'Salary'], ['contractor', 'Contractor'], ['volunteer', 'Volunteer']];

/** Days in the order a week is shown (Monday first), with the database's weekday number (0 = Sunday). */
export const WEEK: { weekday: number; name: string }[] = [
  { weekday: 1, name: 'Monday' }, { weekday: 2, name: 'Tuesday' }, { weekday: 3, name: 'Wednesday' }, { weekday: 4, name: 'Thursday' },
  { weekday: 5, name: 'Friday' }, { weekday: 6, name: 'Saturday' }, { weekday: 0, name: 'Sunday' },
];

export function roleLabel(role: string): string {
  return role === 'coach' ? 'Coach / PT' : role.charAt(0).toUpperCase() + role.slice(1);
}

/** The people the owner edits here: staff and coaches. Owners and admins are managed under Admin access. */
export const isOperational = (role: string) => role === 'staff' || role === 'coach';

export interface TeamRow { userId: string; name: string; email: string; role: string; isActive: boolean; accessStatus: string }

export function isActiveMember(m: Pick<TeamRow, 'isActive' | 'accessStatus'>): boolean {
  return m.isActive && m.accessStatus !== 'revoked';
}

export function statusLabel(m: Pick<TeamRow, 'isActive' | 'accessStatus'>): string {
  return isActiveMember(m) ? m.accessStatus || 'active' : 'removed';
}

export interface HoursRow { weekday: number; isWorking: boolean; start: string; end: string }

const hhmm = (t: string | null | undefined) => String(t ?? '').slice(0, 5);

/** "Mon 09:00–17:00 · Tue 09:00–17:00", Monday first, only the days they work. */
export function hoursSummary(rows: HoursRow[]): string {
  const work = WEEK.map((d) => ({ d, r: rows.find((x) => x.weekday === d.weekday && x.isWorking && x.start && x.end) })).filter((x) => x.r);
  return work.length ? work.map(({ d, r }) => `${d.name.slice(0, 3)} ${hhmm(r?.start)}–${hhmm(r?.end)}`).join(' · ') : 'Working hours not set';
}

export type QualState = 'valid' | 'expiring' | 'expired';

/** A qualification with no date never expires; one expiring within 30 days is flagged early. */
export function qualState(expiresOn: string | null | undefined, now: Date): QualState {
  if (!expiresOn) return 'valid';
  const end = new Date(`${expiresOn}T23:59:59`);
  if (end.getTime() < now.getTime()) return 'expired';
  return end.getTime() - now.getTime() <= 30 * 86400000 ? 'expiring' : 'valid';
}

export const QUAL_TEXT: Record<QualState, string> = { valid: '', expiring: 'expires soon', expired: 'expired' };

// ---- the edit form ----

export interface QualEntry { on: boolean; expires: string }

export interface StaffForm {
  name: string;
  email: string;
  role: StaffRole;
  accessLevelId: string;
  jobTitle: string;
  pay: string;
  employment: string;
  hours: Record<number, { on: boolean; start: string; end: string }>;
  quals: Record<string, QualEntry>;
}

export function emptyHours(): StaffForm['hours'] {
  return Object.fromEntries(WEEK.map((d) => [d.weekday, { on: false, start: '09:00', end: '17:00' }]));
}

export function emptyStaffForm(): StaffForm {
  return { name: '', email: '', role: 'staff', accessLevelId: '', jobTitle: '', pay: '', employment: 'hourly', hours: emptyHours(), quals: {} };
}

export interface ExistingStaff {
  role: string;
  accessLevelId: string;
  jobTitle: string | null;
  payPence: number | null;
  employment: string | null;
  hours: HoursRow[];
  quals: { capabilityId: string; expiresOn: string | null }[];
}

export function formFromStaff(name: string, email: string, s: ExistingStaff): StaffForm {
  const hours = emptyHours();
  for (const h of s.hours) hours[h.weekday] = { on: h.isWorking, start: hhmm(h.start) || '09:00', end: hhmm(h.end) || '17:00' };
  return {
    name, email, role: s.role === 'coach' ? 'coach' : 'staff', accessLevelId: s.accessLevelId, jobTitle: s.jobTitle ?? '',
    pay: s.payPence === null ? '' : (s.payPence / 100).toFixed(2), employment: s.employment ?? 'hourly', hours,
    quals: Object.fromEntries(s.quals.map((q) => [q.capabilityId, { on: true, expires: q.expiresOn ?? '' }])),
  };
}

export interface StaffValues {
  jobTitle: string | null;
  payPence: number | null;
  employment: string;
  hours: { weekday: number; isWorking: boolean; start: string | null; end: string | null }[];
  quals: { capabilityId: string; expiresOn: string | null }[];
}

export type StaffCheck = { ok: true; values: StaffValues } | { ok: false; message: string };

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export function validateStaff(f: StaffForm, isNew: boolean): StaffCheck {
  if (isNew) {
    if (!f.name.trim()) return { ok: false, message: 'Enter their name.' };
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim())) return { ok: false, message: 'Enter a valid email address.' };
  }
  if (!f.accessLevelId) return { ok: false, message: 'Choose an access level for this person.' };
  if (f.jobTitle.trim().length > 80) return { ok: false, message: 'The job title can be up to 80 characters.' };
  let payPence: number | null = null;
  if (f.pay.trim() !== '') {
    const pay = Number(f.pay);
    if (!Number.isFinite(pay) || pay < 0 || pay > 10000) return { ok: false, message: 'Enter the hourly pay as an amount in pounds, for example 12.50.' };
    payPence = Math.round(pay * 100);
  }
  const hours: StaffValues['hours'] = [];
  for (const d of WEEK) {
    const h = f.hours[d.weekday] ?? { on: false, start: '', end: '' };
    if (!h.on) {
      hours.push({ weekday: d.weekday, isWorking: false, start: null, end: null });
      continue;
    }
    if (!TIME.test(h.start) || !TIME.test(h.end)) return { ok: false, message: `Enter a start and finish time for ${d.name}.` };
    if (h.end <= h.start) return { ok: false, message: `${d.name} must finish after it starts.` };
    hours.push({ weekday: d.weekday, isWorking: true, start: h.start, end: h.end });
  }
  const quals: StaffValues['quals'] = [];
  for (const [capabilityId, q] of Object.entries(f.quals)) {
    if (!q.on) continue;
    if (q.expires && !DATE.test(q.expires)) return { ok: false, message: 'Enter the expiry date of each qualification as a full date, or leave it blank.' };
    quals.push({ capabilityId, expiresOn: q.expires || null });
  }
  return { ok: true, values: { jobTitle: f.jobTitle.trim() || null, payPence, employment: f.employment, hours, quals } };
}

export interface QualChanges {
  /** Qualifications to add or whose expiry changed (written first). */
  upsert: { capabilityId: string; expiresOn: string | null }[];
  /** Qualifications that were unticked (removed last, so a failure part-way never loses one that should stay). */
  remove: string[];
}

export function diffQuals(existing: { capabilityId: string; expiresOn: string | null }[], wanted: { capabilityId: string; expiresOn: string | null }[]): QualChanges {
  const had = new Map(existing.map((q) => [q.capabilityId, q.expiresOn]));
  const keep = new Set(wanted.map((q) => q.capabilityId));
  return {
    upsert: wanted.filter((q) => !had.has(q.capabilityId) || (had.get(q.capabilityId) ?? null) !== q.expiresOn),
    remove: existing.filter((q) => !keep.has(q.capabilityId)).map((q) => q.capabilityId),
  };
}

/** Hours rows that differ from what is saved (so an unchanged week writes nothing). */
export function changedHours(existing: HoursRow[], wanted: StaffValues['hours']): StaffValues['hours'] {
  return wanted.filter((w) => {
    const e = existing.find((x) => x.weekday === w.weekday);
    if (!e) return w.isWorking; // nothing saved for a day they do not work: nothing to write
    return e.isWorking !== w.isWorking || (w.isWorking && (hhmm(e.start) !== w.start || hhmm(e.end) !== w.end));
  });
}

export function payText(pence: number | null): string {
  return pence === null ? '' : `£${(pence / 100).toFixed(2)}/hr`;
}
