import type { HeldPack, PackType, PackTypeInput } from '../data/classPacks';
import { toPence } from '../plans/calc';
import { money } from '../today/calc';

export const MAX_CREDITS = 200;
export const MAX_VALID_DAYS = 730;

/** What the form boxes hold, as typed. */
export interface PackForm { name: string; credits: string; price: string; validDays: string }

export const emptyPackForm: PackForm = { name: '', credits: '10', price: '', validDays: '' };

export function formFromPack(t: PackType): PackForm {
  return { name: t.name, credits: String(t.credits), price: (t.pricePence / 100).toFixed(2), validDays: t.validDays === null ? '' : String(t.validDays) };
}

export type PackCheck = { ok: true; input: PackTypeInput } | { ok: false; message: string };

const whole = (text: string): number | null => {
  const t = text.trim();
  if (!/^\d+$/.test(t)) return null;
  return Number(t);
};

export function validatePackType(form: PackForm): PackCheck {
  const name = form.name.trim();
  if (!name) return { ok: false, message: 'Give the pack a name, like 10 class pack.' };
  if (name.length > 80) return { ok: false, message: 'Keep the name under 80 characters.' };
  const credits = whole(form.credits);
  if (credits === null || credits < 1 || credits > MAX_CREDITS) return { ok: false, message: `The number of classes must be a whole number from 1 to ${MAX_CREDITS}.` };
  const price = toPence(form.price);
  if (price === null) return { ok: false, message: 'Add a price in pounds, or 0 if it is free.' };
  let validDays: number | null = null;
  if (form.validDays.trim() !== '') {
    validDays = whole(form.validDays);
    if (validDays === null || validDays < 1 || validDays > MAX_VALID_DAYS) return { ok: false, message: `Days it lasts must be a whole number from 1 to ${MAX_VALID_DAYS}, or blank if it never expires.` };
  }
  return { ok: true, input: { name, credits, pricePence: price, validDays } };
}

/** "£6.00 a class", worked out from the price and the number of classes. */
export function perClassText(t: Pick<PackType, 'credits' | 'pricePence'>): string {
  if (t.credits < 1) return '';
  if (t.pricePence === 0) return 'Free';
  return `${money(Math.round(t.pricePence / t.credits))} a class`;
}

/** "Lasts 90 days" or "Never expires". */
export function validityText(validDays: number | null): string {
  return validDays === null ? 'Never expires' : `Lasts ${validDays} ${validDays === 1 ? 'day' : 'days'}`;
}

export function packSummary(types: PackType[]): string {
  return `${types.filter((t) => t.isActive).length} on sale · ${types.length} total`;
}

export type HeldState = 'active' | 'used' | 'expired' | 'cancelled';

/** Where a held pack stands. Cancelled wins, then used up, then expired. */
export function heldState(p: Pick<HeldPack, 'creditsLeft' | 'expiresAt' | 'voidedAt'>, now: Date): HeldState {
  if (p.voidedAt) return 'cancelled';
  if (p.creditsLeft <= 0) return 'used';
  if (p.expiresAt && new Date(p.expiresAt) <= now) return 'expired';
  return 'active';
}

export const heldStateLabel: Record<HeldState, string> = { active: 'In use', used: 'Used up', expired: 'Expired', cancelled: 'Cancelled' };

/** "7 of 10 classes left". */
export function heldLeftText(p: Pick<HeldPack, 'creditsLeft' | 'creditsTotal'>): string {
  return `${p.creditsLeft} of ${p.creditsTotal} ${p.creditsTotal === 1 ? 'class' : 'classes'} left`;
}

export function heldExpiryText(expiresAt: string | null): string {
  return expiresAt ? `Expires ${new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(expiresAt))}` : 'Never expires';
}

/** In-use packs first, then the rest; newest first inside each group. */
export function sortHeld(packs: HeldPack[], now: Date): HeldPack[] {
  const rank = (p: HeldPack) => (heldState(p, now) === 'active' ? 0 : 1);
  return [...packs].sort((a, b) => rank(a) - rank(b) || b.createdAt.localeCompare(a.createdAt));
}

export function heldSummary(packs: HeldPack[], now: Date): string {
  const live = packs.filter((p) => heldState(p, now) === 'active').length;
  return `${live} in use · ${packs.length} given or bought`;
}
