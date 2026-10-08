import type { ClassTypeFull, ClassTypeInput, RequirementChanges, RequirementInput, RequirementRow, SetupData } from '../data/classSetup';
import { toPence } from '../plans/calc';

export const LEVELS = [
  ['all_levels', 'All levels'],
  ['beginner', 'Beginner'],
  ['intermediate', 'Intermediate'],
  ['advanced', 'Advanced'],
] as const;

export interface TypeForm {
  name: string;
  level: string;
  duration: string;
  capacity: string;
  dropIn: string;
  description: string;
  /** Qualifications the instructor needs. */
  capabilityIds: string[];
  /** Room or equipment id to the "how many" text. */
  resources: Record<string, string>;
}

export const emptyTypeForm: TypeForm = { name: '', level: 'all_levels', duration: '60', capacity: '20', dropIn: '5.00', description: '', capabilityIds: [], resources: {} };

export function formFromType(t: ClassTypeFull, reqs: RequirementRow[]): TypeForm {
  const mine = reqs.filter((r) => r.classTypeId === t.id);
  return {
    name: t.name, level: t.level, duration: String(t.durationMinutes), capacity: String(t.defaultCapacity),
    dropIn: t.dropInPence === null ? '' : (t.dropInPence / 100).toFixed(2), description: t.description ?? '',
    capabilityIds: mine.flatMap((r) => (r.capabilityId ? [r.capabilityId] : [])),
    resources: Object.fromEntries(mine.flatMap((r) => (r.resourceId ? [[r.resourceId, String(r.quantity)] as [string, string]] : []))),
  };
}

export type TypeCheck = { ok: true; input: ClassTypeInput; needs: RequirementInput[] } | { ok: false; message: string };

/** Same rules as the old page (name needed, defaults of 60 minutes and 20 places) with the limits made explicit. */
export function validateType(form: TypeForm): TypeCheck {
  const name = form.name.trim();
  if (!name) return { ok: false, message: 'Enter a class name.' };
  const duration = Number(form.duration);
  if (form.duration.trim() === '' || !Number.isInteger(duration) || duration < 5 || duration > 480) return { ok: false, message: 'Duration must be a whole number of minutes from 5 to 480.' };
  const capacity = Number(form.capacity);
  if (form.capacity.trim() === '' || !Number.isInteger(capacity) || capacity < 1) return { ok: false, message: 'Default capacity must be a whole number of 1 or more.' };
  const dropIn = form.dropIn.trim() === '' ? null : toPence(form.dropIn);
  if (form.dropIn.trim() !== '' && dropIn === null) return { ok: false, message: 'The drop-in price must be a number of zero or more, or blank.' };
  const needs: RequirementInput[] = form.capabilityIds.map((capabilityId) => ({ capabilityId, resourceId: null, quantity: 1 }));
  for (const [resourceId, text] of Object.entries(form.resources)) {
    const q = Number(text);
    if (text.trim() === '' || !Number.isInteger(q) || q < 1 || q > 1000) return { ok: false, message: 'How many of each room or piece of equipment must be a whole number from 1 to 1000.' };
    needs.push({ capabilityId: null, resourceId, quantity: q });
  }
  return { ok: true, input: { name, description: form.description.trim() || null, level: form.level, durationMinutes: duration, defaultCapacity: capacity, dropInPence: dropIn }, needs };
}

/** What to add, change and remove so the saved requirements match the wanted ones, touching nothing else. */
export function diffRequirements(existing: RequirementRow[], wanted: RequirementInput[]): RequirementChanges {
  const key = (r: { capabilityId: string | null; resourceId: string | null }) => (r.capabilityId ? `c:${r.capabilityId}` : `r:${r.resourceId}`);
  const have = new Map(existing.map((e) => [key(e), e]));
  const want = new Map(wanted.map((w) => [key(w), w]));
  return {
    insert: wanted.filter((w) => !have.has(key(w))),
    update: wanted.flatMap((w) => {
      const e = have.get(key(w));
      return e && e.quantity !== w.quantity ? [{ id: e.id, quantity: w.quantity }] : [];
    }),
    remove: existing.filter((e) => !want.has(key(e))).map((e) => e.id),
  };
}

export function levelLabel(level: string): string {
  return LEVELS.find(([v]) => v === level)?.[1] ?? 'All levels';
}

/** "60 min · 20 places · £5.00 drop-in", or "upgrade only" when there is no drop-in price. */
export function typeFacts(t: ClassTypeFull): string {
  const drop = t.dropInPence === null ? 'upgrade only' : `£${(t.dropInPence / 100).toFixed(2)} drop-in`;
  return `${t.durationMinutes} min · ${t.defaultCapacity} places · ${drop}`;
}

/** "Qualification: Spin instructor · Needs: Studio A, 12 × Spin bike", or a plain "No requirements". */
export function needsText(typeId: string, data: Pick<SetupData, 'requirements' | 'capabilities' | 'resources'>): string {
  const mine = data.requirements.filter((r) => r.classTypeId === typeId);
  const quals = mine.flatMap((r) => data.capabilities.filter((c) => c.id === r.capabilityId).map((c) => c.name));
  const things = mine.flatMap((r) => data.resources.filter((x) => x.id === r.resourceId).map((x) => (r.quantity > 1 ? `${r.quantity} × ${x.name}` : x.name)));
  const parts = [quals.length ? `Qualification: ${quals.join(', ')}` : '', things.length ? `Needs: ${things.join(', ')}` : ''].filter(Boolean);
  return parts.length ? parts.join(' · ') : 'No requirements';
}
