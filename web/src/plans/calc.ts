import type { PlanDetail, PlanInput } from '../data/plans';

export const INTERVALS = [
  ['monthly', 'Monthly'],
  ['weekly', 'Weekly'],
  ['quarterly', 'Quarterly'],
  ['annual', 'Annual'],
  ['one_off', 'One-off'],
] as const;

export const ACCESS_TYPES = [
  ['hybrid', 'Hybrid'],
  ['gym', 'Gym only'],
  ['classes', 'Classes'],
  ['pt', 'PT'],
  ['custom', 'Custom'],
] as const;

/** What the form boxes hold: text for the boxes, booleans for the ticks. */
export interface PlanForm {
  name: string;
  price: string;
  interval: string;
  accessType: string;
  joiningFee: string;
  classesPerWeek: string;
  description: string;
  includesOpenGym: boolean;
  includesClasses: boolean;
  includesPt: boolean;
  isPublic: boolean;
}

export const emptyForm: PlanForm = {
  name: '', price: '', interval: 'monthly', accessType: 'hybrid', joiningFee: '0', classesPerWeek: '', description: '',
  includesOpenGym: true, includesClasses: true, includesPt: false, isPublic: true,
};

export function poundsText(pence: number): string {
  return (pence / 100).toFixed(2);
}

export function formFromPlan(p: PlanDetail): PlanForm {
  return {
    name: p.name, price: poundsText(p.priceInPence), interval: p.interval, accessType: p.accessType,
    joiningFee: poundsText(p.joiningFeeInPence), classesPerWeek: p.classesPerWeek === null ? '' : String(p.classesPerWeek),
    description: p.description ?? '', includesOpenGym: p.includesOpenGym, includesClasses: p.includesClasses,
    includesPt: p.includesPt, isPublic: p.isPublic,
  };
}

/** Pounds typed by a person to pence; null when it is not a number of zero or more. */
export function toPence(text: string): number | null {
  const t = text.trim();
  if (t === '') return null;
  const n = Number(t);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}

export type PlanCheck = { ok: true; input: PlanInput } | { ok: false; message: string };

export function validatePlan(form: PlanForm): PlanCheck {
  const name = form.name.trim();
  const price = toPence(form.price);
  if (!name || price === null) return { ok: false, message: 'Add a name and valid price.' };
  // A blank joining fee means none, as the old page did.
  const joining = form.joiningFee.trim() === '' ? 0 : toPence(form.joiningFee);
  if (joining === null) return { ok: false, message: 'The joining fee must be a number of zero or more.' };
  let classesPerWeek: number | null = null;
  if (form.classesPerWeek.trim() !== '') {
    const n = Number(form.classesPerWeek);
    if (!Number.isInteger(n) || n < 0) return { ok: false, message: 'Classes per week must be a whole number, or blank for unlimited.' };
    classesPerWeek = n;
  }
  return {
    ok: true,
    input: {
      name, description: form.description.trim() || null, priceInPence: price, interval: form.interval, accessType: form.accessType,
      joiningFeeInPence: joining, classesPerWeek, includesOpenGym: form.includesOpenGym, includesClasses: form.includesClasses,
      includesPt: form.includesPt, isPublic: form.isPublic,
    },
  };
}

export function planSummary(plans: PlanDetail[]): string {
  return `${plans.filter((p) => p.isActive).length} active · ${plans.length} total`;
}

/** "Open gym · Classes · 3 classes/week", as on the old page. */
export function includesText(p: PlanDetail): string {
  const parts: string[] = [];
  if (p.includesOpenGym) parts.push('Open gym');
  if (p.includesClasses) parts.push('Classes');
  if (p.includesPt) parts.push('PT');
  parts.push(p.classesPerWeek !== null ? `${p.classesPerWeek} classes/week` : 'Unlimited classes');
  return parts.join(' · ');
}
