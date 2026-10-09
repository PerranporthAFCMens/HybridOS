import { poundsToPence } from '../builder/engine';
import type { RulesRow } from '../data/rules';

// Pure rules for the membership screens: the owner's rules form, and reading what the database says a member may do.
// The database makes every real decision; these only prepare the form and the words.

export type Approval = 'auto' | 'admin';
export interface RulesForm {
  pauseEnabled: boolean; pauseMin: string; pauseMax: string; pauseNotice: string; pauseMaxYear: string; pauseFee: string; pauseApproval: Approval;
  cancelEnabled: boolean; cancelNotice: string; cancelTerm: string; cancelEarly: 'wait' | 'fee'; cancelFee: string; cancelOffer: boolean; cancelAsk: boolean; cancelApproval: Approval;
  upgrade: boolean; downgrade: boolean; upgradeStarts: 'now' | 'next_month'; downgradeStarts: 'now' | 'next_month'; changeMin: string; changeApproval: Approval;
}

export const DEFAULT_FORM: RulesForm = {
  pauseEnabled: false, pauseMin: '1', pauseMax: '8', pauseNotice: '7', pauseMaxYear: '2', pauseFee: '0', pauseApproval: 'admin',
  cancelEnabled: false, cancelNotice: '30', cancelTerm: '0', cancelEarly: 'wait', cancelFee: '0', cancelOffer: true, cancelAsk: true, cancelApproval: 'admin',
  upgrade: false, downgrade: false, upgradeStarts: 'now', downgradeStarts: 'next_month', changeMin: '1', changeApproval: 'admin',
};

const pounds = (pence: number) => (pence / 100).toFixed(2);
const approval = (v: string): Approval => (v === 'auto' ? 'auto' : 'admin');
const starts = (v: string): 'now' | 'next_month' => (v === 'now' ? 'now' : 'next_month');

export function formFromRow(r: RulesRow | null): RulesForm {
  if (!r) return { ...DEFAULT_FORM };
  return {
    pauseEnabled: r.pause_enabled, pauseMin: String(r.pause_min_weeks), pauseMax: String(r.pause_max_weeks), pauseNotice: String(r.pause_notice_days), pauseMaxYear: String(r.pause_max_per_year),
    pauseFee: pounds(r.pause_fee_pence), pauseApproval: approval(r.pause_approval),
    cancelEnabled: r.cancel_enabled, cancelNotice: String(r.cancel_notice_days), cancelTerm: String(r.cancel_min_term_months), cancelEarly: r.cancel_early_mode === 'fee' ? 'fee' : 'wait',
    cancelFee: pounds(r.cancel_early_fee_pence), cancelOffer: r.cancel_offer_pause, cancelAsk: r.cancel_ask_reason, cancelApproval: approval(r.cancel_approval),
    upgrade: r.upgrade_enabled, downgrade: r.downgrade_enabled, upgradeStarts: starts(r.upgrade_starts), downgradeStarts: starts(r.downgrade_starts), changeMin: String(r.change_min_months), changeApproval: approval(r.change_approval),
  };
}

export type RulesOut = Omit<RulesRow, 'gym_id' | 'updated_at' | 'updated_by'>;
export type RulesCheck = { ok: true; row: RulesOut } | { ok: false; message: string };

function whole(text: string, name: string, lo: number, hi: number): number | string {
  const n = Number(text);
  if (text.trim() === '' || !Number.isInteger(n) || n < lo || n > hi) return `${name} must be a whole number from ${lo} to ${hi}.`;
  return n;
}
function money(text: string, name: string): number | string {
  const p = poundsToPence(text.trim() === '' ? '0' : text);
  return p === null || p < 0 ? `${name} must be an amount in pounds, like 5.00, or 0.` : p;
}

/** The form as database columns, or the first thing that is wrong (the same limits the database enforces). */
export function validateRules(f: RulesForm): RulesCheck {
  const a = whole(f.pauseMin, 'The shortest pause (weeks)', 1, 52);
  const b = whole(f.pauseMax, 'The longest pause (weeks)', 1, 52);
  const c = whole(f.pauseNotice, 'Pause notice (days)', 0, 90);
  const d = whole(f.pauseMaxYear, 'Pauses allowed in a year', 1, 12);
  const e = money(f.pauseFee, 'The pause fee');
  const g = whole(f.cancelNotice, 'Cancellation notice (days)', 0, 365);
  const h = whole(f.cancelTerm, 'The minimum term (months)', 0, 36);
  const i = money(f.cancelFee, 'The early cancellation fee');
  const j = whole(f.changeMin, 'Time between plan changes (months)', 0, 24);
  for (const v of [a, b, c, d, e, g, h, i, j]) if (typeof v === 'string') return { ok: false, message: v };
  const [min, max] = [a as number, b as number];
  if (min > max) return { ok: false, message: 'The shortest pause cannot be longer than the longest.' };
  return {
    ok: true,
    row: {
      pause_enabled: f.pauseEnabled, pause_min_weeks: min, pause_max_weeks: max, pause_notice_days: c as number, pause_max_per_year: d as number, pause_fee_pence: e as number, pause_approval: f.pauseApproval,
      cancel_enabled: f.cancelEnabled, cancel_notice_days: g as number, cancel_min_term_months: h as number, cancel_early_mode: f.cancelEarly, cancel_early_fee_pence: i as number,
      cancel_offer_pause: f.cancelOffer, cancel_ask_reason: f.cancelAsk, cancel_approval: f.cancelApproval,
      upgrade_enabled: f.upgrade, downgrade_enabled: f.downgrade, upgrade_starts: f.upgradeStarts, downgrade_starts: f.downgradeStarts, change_min_months: j as number, change_approval: f.changeApproval,
    },
  };
}

// ---- what the database says a member may do ----

export interface PlanChoice { id: string; name: string; pricePence: number; interval: string; direction: 'up' | 'down'; startsOn: string }
export interface MemberRequest { id: string; kind: string; status: string; effectiveOn: string; untilOn: string | null; toPlanId: string | null; feePence: number; requestedAt: string; decisionNote: string | null }
export interface Options {
  membership: { id: string; status: string; planId: string; planName: string; pricePence: number; interval: string; startsOn: string | null; endsOn: string | null };
  pause: { enabled: boolean; allowed: boolean; reason: string; minWeeks: number; maxWeeks: number; noticeDays: number; maxPerYear: number; used: number; feePence: number; approval: Approval; earliestStart: string };
  cancel: { enabled: boolean; allowed: boolean; reason: string; noticeDays: number; minTermMonths: number; earlyMode: string; offerPause: boolean; askReason: boolean; approval: Approval; inTerm: boolean; lastDay: string; feePence: number; termEndsOn: string };
  change: { allowed: boolean; reason: string; approval: Approval; plans: PlanChoice[] };
  requests: MemberRequest[];
}

const o = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const s = (v: unknown) => (typeof v === 'string' ? v : '');
const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
const b = (v: unknown) => v === true;

/** Read the database's answer defensively. Null when the member has no membership here. */
export function readOptions(raw: unknown): Options | null {
  const r = o(raw);
  const m = o(r.membership);
  if (!s(m.id)) return null;
  const p = o(r.pause);
  const c = o(r.cancel);
  const ch = o(r.change);
  return {
    membership: { id: s(m.id), status: s(m.status), planId: s(m.plan_id), planName: s(m.plan_name), pricePence: n(m.price_pence), interval: s(m.interval), startsOn: s(m.starts_on) || null, endsOn: s(m.ends_on) || null },
    pause: { enabled: b(p.enabled), allowed: b(p.allowed), reason: s(p.reason), minWeeks: n(p.min_weeks), maxWeeks: n(p.max_weeks), noticeDays: n(p.notice_days), maxPerYear: n(p.max_per_year), used: n(p.used_this_year), feePence: n(p.fee_pence), approval: approval(s(p.approval)), earliestStart: s(p.earliest_start) },
    cancel: { enabled: b(c.enabled), allowed: b(c.allowed), reason: s(c.reason), noticeDays: n(c.notice_days), minTermMonths: n(c.min_term_months), earlyMode: s(c.early_mode), offerPause: b(c.offer_pause), askReason: b(c.ask_reason), approval: approval(s(c.approval)), inTerm: b(c.in_term), lastDay: s(c.last_day), feePence: n(c.fee_pence), termEndsOn: s(c.term_ends_on) },
    change: {
      allowed: b(ch.allowed), reason: s(ch.reason), approval: approval(s(ch.approval)),
      plans: (Array.isArray(ch.plans) ? ch.plans : []).map((x) => { const q = o(x); return { id: s(q.id), name: s(q.name), pricePence: n(q.price_pence), interval: s(q.interval), direction: s(q.direction) === 'up' ? 'up' as const : 'down' as const, startsOn: s(q.starts_on) }; }),
    },
    requests: (Array.isArray(r.requests) ? r.requests : []).map((x) => { const q = o(x); return { id: s(q.id), kind: s(q.kind), status: s(q.status), effectiveOn: s(q.effective_on), untilOn: s(q.until_on) || null, toPlanId: s(q.to_plan_id) || null, feePence: n(q.fee_pence), requestedAt: s(q.requested_at), decisionNote: s(q.decision_note) || null }; }),
  };
}

export const money2 = (pence: number) => `£${(pence / 100).toFixed(2)}`;
const plural = (x: number, one: string, many = `${one}s`) => `${x} ${x === 1 ? one : many}`;

/** The pause rule as one sentence a member can read. */
export function pauseSentence(p: Options['pause']): string {
  const parts = [`${p.minWeeks === p.maxWeeks ? plural(p.minWeeks, 'week') : `${p.minWeeks} to ${plural(p.maxWeeks, 'week')}`}`, `${plural(p.noticeDays, 'day')} notice`, p.feePence > 0 ? `${money2(p.feePence)} fee` : 'no fee'];
  return `${parts.join('. ')}.`;
}

export function cancelSentence(c: Options['cancel']): string {
  const parts = [`${plural(c.noticeDays, 'day')} notice`];
  if (c.minTermMonths > 0) parts.push(c.earlyMode === 'fee' ? `leave early for a ${money2(c.feePence || 0)} fee in the first ${plural(c.minTermMonths, 'month')}` : `minimum term ${plural(c.minTermMonths, 'month')}`);
  parts.push(c.approval === 'admin' ? 'reviewed by the gym' : 'happens automatically');
  return `${parts.join('. ')}.`;
}

export const changeSentence = (a: Approval): string => (a === 'admin' ? 'The gym reviews each change.' : 'Changes happen automatically.');

/** A quick check before sending: the database repeats it, but this saves a round trip. */
export function pauseProblem(p: Options['pause'], from: string, to: string): string | null {
  if (!from || !to) return 'Choose when the pause starts and ends.';
  if (from < p.earliestStart) return `A pause needs ${plural(p.noticeDays, 'day')} notice, so it can start from ${p.earliestStart}.`;
  const days = Math.round((Date.parse(to) - Date.parse(from)) / 86400000);
  if (!(days > 0)) return 'The pause must end after it starts.';
  if (days < p.minWeeks * 7 || days > p.maxWeeks * 7) return `A pause must be between ${plural(p.minWeeks, 'week')} and ${plural(p.maxWeeks, 'week')}.`;
  return null;
}

export const KIND_LABEL: Record<string, string> = { pause: 'Pause', cancel: 'Cancel', change_plan: 'Change plan' };
export const STATUS_LABEL: Record<string, string> = { pending: 'Waiting for the gym', approved: 'Accepted', applied: 'In effect', ended: 'Finished', declined: 'Declined', withdrawn: 'Withdrawn' };

export const REASONS_PAUSE = ['Injury', 'Holiday', 'Money', 'Other'];
export const REASONS_CANCEL = ['Moving away', 'Cost', 'Not using it', 'Other'];

const day = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
export { day as niceDay };

/** One line saying what a request does and when. */
export function describeRequest(r: { kind: string; effectiveOn: string; untilOn: string | null; toPlanId: string | null; feePence: number; direction?: string }, plans: Map<string, string>): string {
  const fee = r.feePence > 0 ? ` Fee ${money2(r.feePence)}.` : '';
  if (r.kind === 'pause') return `from ${day(r.effectiveOn)}${r.untilOn ? ` to ${day(r.untilOn)}` : ''}.${fee}`;
  if (r.kind === 'cancel') return `last day ${day(r.effectiveOn)}.${fee}`;
  const to = r.toPlanId ? plans.get(r.toPlanId) ?? 'another plan' : 'another plan';
  return `move to ${to} from ${day(r.effectiveOn)}${r.direction === 'up' ? ' (bigger plan)' : r.direction === 'down' ? ' (cheaper plan)' : ''}.${fee}`;
}
