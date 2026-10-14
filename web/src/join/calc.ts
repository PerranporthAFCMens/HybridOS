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

export type StepId = 'account' | 'about' | 'address' | 'emergency' | 'guardian' | 'sign' | 'plan' | 'pay' | 'done';

export const STEP_TITLES: Record<StepId, string> = {
  account: 'Your account', about: 'About you', address: 'Your address', emergency: 'Emergency contact',
  guardian: 'Parent or guardian', sign: 'Read and sign', plan: 'Choose your membership', pay: 'Payment', done: 'Welcome',
};

/** The steps this person goes through. Guardian only under 18; reading and signing only when the gym has documents; payment only when the gym takes it here. */
export function stepsFor(opts: { under18: boolean; hasDocuments: boolean; takesPayment?: boolean }): StepId[] {
  const steps: StepId[] = ['account', 'about', 'address', 'emergency'];
  if (opts.under18) steps.push('guardian');
  if (opts.hasDocuments) steps.push('sign');
  steps.push('plan');
  if (opts.takesPayment) steps.push('pay');
  steps.push('done');
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

/** The digits from what someone typed or pasted (spaces, dashes and other characters are ignored). Supabase codes are 6 to 10 digits long; this project's are 8. */
export const cleanCode = (text: string): string => text.replace(/\D/g, '').slice(0, 10);

export function checkCode(text: string): string | null {
  const n = cleanCode(text).length;
  return n >= 6 && n <= 10 ? null : 'Enter the code from the email. It is made of numbers only.';
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
  /** The plan's own terms (or the gym's rule), shown before joining. Null when the gym has set none. */
  minTermMonths: number | null;
  noticeDays: number | null;
}

/** "£59.00 / monthly", or just the price for a one-off. */
export function planPrice(p: Pick<JoinPlan, 'pricePence' | 'interval'>): string {
  const amount = `£${(p.pricePence / 100).toFixed(2)}`;
  return p.interval === 'one_off' ? amount : `${amount} / ${p.interval}`;
}

// ---- Paying ----

const PAYABLE_INTERVALS = ['weekly', 'monthly', 'quarterly', 'annual'];
const EVERY: Record<string, string> = { weekly: 'week', monthly: 'month', quarterly: '3 months', annual: 'year' };

export const moneyText = (pence: number): string => `£${(Math.max(0, pence) / 100).toFixed(2)}`;

/** A free plan is joined without a card, as it always was. */
export const isFreePlan = (p: Pick<JoinPlan, 'pricePence'>): boolean => p.pricePence <= 0;

/** Can this plan be paid for on the sign-up page? Paid, and repeating (one-off passes are not subscriptions). */
export function canPayOnline(p: Pick<JoinPlan, 'pricePence' | 'interval'>): boolean {
  return p.pricePence > 0 && PAYABLE_INTERVALS.includes(p.interval);
}

/** "£59.00 today, then £59.00 every month" */
export function payTermsText(p: Pick<JoinPlan, 'pricePence' | 'interval'>): string {
  return `${moneyText(p.pricePence)} today, then ${moneyText(p.pricePence)} every ${EVERY[p.interval] ?? 'period'}`;
}

/** A person under 18 has a parent or guardian pay; they need a name and an email address. Anyone else pays themselves. */
export function checkPayer(under18: boolean, guardianName: string, guardianEmail: string): string | null {
  if (!under18) return null;
  if (guardianName.trim().length < 2) return "Enter your parent or guardian's name.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guardianEmail.trim())) return "Enter your parent or guardian's email address.";
  return null;
}

/** The page may not let someone pay until they have ticked the agreement shown to them. */
export function checkAgreed(agreed: boolean): string | null {
  return agreed ? null : 'Tick the box to say you agree before paying.';
}

// ---- Reading and signing ----

export interface JoinQuestion { id: string; prompt: string; answerType: 'yes_no' | 'text'; detailsIfYes: boolean; required: boolean }
export interface JoinDocument {
  id: string; kind: 'terms' | 'waiver'; version: number; title: string; source: 'pdf' | 'text';
  filePath: string | null; fileName: string | null; body: string | null; acceptance: string; questions: JoinQuestion[];
}
export interface AnswerDraft { yes: boolean | null; text: string }
export type Answers = Record<string, AnswerDraft>;

/** The first thing the person still has to do before signing, in words for them, or null when they can sign. */
export function checkSign(o: { docs: JoinDocument[]; answers: Answers; ticked: Record<string, boolean>; name: string; hasInk: boolean }): string | null {
  for (const d of o.docs) {
    for (const q of d.questions) {
      const a = o.answers[q.id] ?? { yes: null, text: '' };
      const hasText = a.text.trim() !== '';
      if (q.required && ((q.answerType === 'yes_no' && a.yes === null) || (q.answerType === 'text' && !hasText))) return `Answer this question: ${q.prompt}`;
      if (q.answerType === 'yes_no' && a.yes === true && q.detailsIfYes && !hasText) return `Give a few details for: ${q.prompt}`;
    }
  }
  if (o.docs.some((d) => !o.ticked[d.id])) return 'Tick the box under each document to say you have read and agree.';
  if (o.name.trim().length < 2) return 'Type your full name.';
  if (!o.hasInk) return 'Draw your signature in the box.';
  return null;
}

/** The answers as the database function wants them. Only questions that were answered are sent. */
export function answersPayload(docs: JoinDocument[], answers: Answers): { question_id: string; yes?: boolean; text?: string }[] {
  const out: { question_id: string; yes?: boolean; text?: string }[] = [];
  for (const d of docs) {
    for (const q of d.questions) {
      const a = answers[q.id];
      if (!a) continue;
      const text = a.text.trim();
      if (q.answerType === 'yes_no') {
        if (a.yes === null) continue;
        out.push({ question_id: q.id, yes: a.yes, ...(text ? { text } : {}) });
      } else if (text) {
        out.push({ question_id: q.id, text });
      }
    }
  }
  return out;
}

/**
 * Did the sign-up answer mean "this email already has an account"? With email confirmation on, the service answers a repeat
 * sign-up with a user that has no identities (it will not email them again); with it off, it answers with an error.
 */
export function looksLikeExistingAccount(error: { message?: string } | null | undefined, user: { identities?: unknown[] | null } | null | undefined): boolean {
  if (error) return /already (been )?registered|already exists/i.test(error.message ?? '');
  return !!user && Array.isArray(user.identities) && user.identities.length === 0;
}

/** Memberships that mean "you are already a member here": they are not offered the plan list again. */
export const BLOCKING_STATUSES = ['active', 'paused', 'pending'] as const;

// ---- Quick join: pay first, finish later ----

export type QuickStepId = 'plan' | 'email' | 'basics' | 'sign' | 'pay' | 'done';

export const QUICK_TITLES: Record<QuickStepId, string> = {
  plan: 'Choose your membership', email: 'Your email', basics: 'About you', sign: 'Read and sign', pay: 'Agree and pay', done: 'Welcome',
};

/**
 * The screens before someone is a member: plan, email (skipped when already signed in), the basics, reading and signing (only for a gym
 * that wants the terms and waiver signed before paying, and has some), and paying (skipped for a free plan).
 */
export function quickStepsFor(o: { signedIn: boolean; paying: boolean; signing?: boolean }): QuickStepId[] {
  const steps: QuickStepId[] = ['plan'];
  if (!o.signedIn) steps.push('email');
  steps.push('basics');
  if (o.signing) steps.push('sign');
  if (o.paying) steps.push('pay');
  steps.push('done');
  return steps;
}

/** "Step 2 of 4" for the screens before the welcome. */
export function quickProgress(steps: QuickStepId[], step: QuickStepId): string {
  const total = steps.length - 1;
  return `Step ${Math.min(Math.max(steps.indexOf(step), 0) + 1, total)} of ${total}`;
}

export function checkEmail(email: string): string | null {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ? null : 'Enter a valid email address.';
}

export type BasicsField = 'firstName' | 'lastName' | 'dob' | 'phone' | 'guardianName' | 'guardianPhone';

/** What is wrong with each box, so the message can sit next to it. Name, date of birth and mobile, plus a parent or guardian under 18. */
export function basicsErrors(d: JoinDetails, now: Date): Partial<Record<BasicsField, string>> {
  const e: Partial<Record<BasicsField, string>> = {};
  const first = name(d.firstName, 'your first name');
  const last = name(d.lastName, 'your last name');
  const dob = checkBirthday(d.dob, now);
  if (first) e.firstName = first;
  if (last) e.lastName = last;
  if (dob) e.dob = dob;
  if (!normalisePhone(d.phone)) e.phone = 'Enter a valid mobile number, for example 07700 900123.';
  if (isUnder18(d.dob, now)) {
    const g = name(d.guardianName, "your parent or guardian's name");
    if (g) e.guardianName = g;
    if (!normalisePhone(d.guardianPhone)) e.guardianPhone = 'Enter a valid phone number for your parent or guardian.';
  }
  return e;
}

/** What is sent to save_my_basics. Guardian details are sent only for under-18s. */
export function toBasicsArgs(d: JoinDetails, now: Date) {
  const under = isUnder18(d.dob, now);
  return {
    p_first_name: d.firstName.trim(),
    p_last_name: d.lastName.trim(),
    p_date_of_birth: d.dob,
    p_phone: normalisePhone(d.phone),
    p_guardian_name: under ? d.guardianName.trim() : '',
    p_guardian_phone: under ? normalisePhone(d.guardianPhone) : '',
  };
}

export type ReadyKey = 'emergency' | 'documents' | 'address';
export interface ReadyItem { key: ReadyKey; label: string; required: boolean; done: boolean }
export interface ReadyStatus { style: 'quick' | 'full'; ready: boolean; held: boolean; items: ReadyItem[] }

export const READY_TIME: Record<ReadyKey, string> = {
  emergency: '30 seconds',
  documents: '1 minute · you sign once',
  address: '30 seconds',
};

const isKey = (k: unknown): k is ReadyKey => k === 'emergency' || k === 'documents' || k === 'address';

/** The answer of get_my_ready_status, or null when it is not one (a gym on the full journey has nothing to finish). */
export function parseReady(data: unknown): ReadyStatus | null {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
  const r = data as Record<string, unknown>;
  const items = Array.isArray(r.items)
    ? r.items.flatMap((x): ReadyItem[] => {
        const i = (x && typeof x === 'object' ? x : {}) as Record<string, unknown>;
        return isKey(i.key) ? [{ key: i.key, label: String(i.label ?? ''), required: i.required === true, done: i.done === true }] : [];
      })
    : [];
  return { style: r.style === 'quick' ? 'quick' : 'full', ready: r.ready === true, held: r.held === true, items };
}

export const readyCounts = (items: ReadyItem[]): { done: number; total: number } => ({ done: items.filter((i) => i.done).length, total: items.length });

/** Something the person still has to do: required items first, then the optional ones. */
export function firstToDo(items: ReadyItem[]): ReadyItem | null {
  return items.find((i) => !i.done && i.required) ?? items.find((i) => !i.done) ?? null;
}

/** The checklist is worth showing in the member app: a Quick join gym, and something still to do. */
export const needsFinishing = (s: ReadyStatus | null): boolean => !!s && s.style === 'quick' && s.items.some((i) => !i.done);
