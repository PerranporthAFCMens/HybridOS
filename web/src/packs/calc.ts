import type { PackType, PackTypeInput } from '../data/classPacks';
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
