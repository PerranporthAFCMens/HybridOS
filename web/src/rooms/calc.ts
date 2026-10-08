// Pure rules behind Rooms and equipment: what a room, area or piece of kit is described as, what a valid
// form looks like, and which class types would be hit by switching one off.

export const RESOURCE_TYPES: [string, string][] = [['room', 'Room'], ['area', 'Area'], ['equipment', 'Equipment'], ['other', 'Other']];

export function typeLabel(type: string): string {
  return RESOURCE_TYPES.find(([v]) => v === type)?.[1] ?? type.charAt(0).toUpperCase() + type.slice(1);
}

export interface ResourceRow { id: string; name: string; type: string; capacity: number | null; allowOverlap: boolean; notes: string | null; isActive: boolean }
export interface QualificationRow { id: string; name: string; description: string | null; isActive: boolean }

export interface ResourceForm { name: string; type: string; capacity: string; overlap: 'exclusive' | 'shared'; notes: string }
export const emptyResourceForm: ResourceForm = { name: '', type: 'room', capacity: '', overlap: 'exclusive', notes: '' };

export function formFromResource(r: ResourceRow): ResourceForm {
  return { name: r.name, type: r.type, capacity: r.capacity === null ? '' : String(r.capacity), overlap: r.allowOverlap ? 'shared' : 'exclusive', notes: r.notes ?? '' };
}

export interface ResourceInput { name: string; type: string; capacity: number | null; allowOverlap: boolean; notes: string | null }
export type ResourceCheck = { ok: true; input: ResourceInput } | { ok: false; message: string };

/** Another resource or qualification of the same gym with the same name (ignoring case and spaces) is refused. */
export function nameTaken(name: string, others: { id: string; name: string }[], selfId: string | null): boolean {
  const n = name.trim().toLowerCase();
  return others.some((o) => o.id !== selfId && o.name.trim().toLowerCase() === n);
}

export function validateResource(f: ResourceForm, others: { id: string; name: string }[], selfId: string | null): ResourceCheck {
  const name = f.name.trim();
  if (!name) return { ok: false, message: 'Enter a name.' };
  if (name.length > 80) return { ok: false, message: 'The name can be up to 80 characters.' };
  if (nameTaken(name, others, selfId)) return { ok: false, message: `There is already a room or piece of equipment called ${name}.` };
  if (!RESOURCE_TYPES.some(([v]) => v === f.type)) return { ok: false, message: 'Choose a type.' };
  let capacity: number | null = null;
  if (f.capacity.trim() !== '') {
    capacity = Number(f.capacity);
    if (!Number.isInteger(capacity) || capacity < 1 || capacity > 10000) return { ok: false, message: 'Max occupancy must be a whole number of 1 or more, or blank for no limit.' };
  }
  return { ok: true, input: { name, type: f.type, capacity, allowOverlap: f.overlap === 'shared', notes: f.notes.trim() || null } };
}

export interface QualificationForm { name: string; description: string }
export type QualificationCheck = { ok: true; name: string; description: string | null } | { ok: false; message: string };

export function validateQualification(f: QualificationForm, others: { id: string; name: string }[], selfId: string | null): QualificationCheck {
  const name = f.name.trim();
  if (!name) return { ok: false, message: 'Enter a name.' };
  if (name.length > 80) return { ok: false, message: 'The name can be up to 80 characters.' };
  if (nameTaken(name, others, selfId)) return { ok: false, message: `There is already a qualification called ${name}.` };
  return { ok: true, name, description: f.description.trim() || null };
}

export function resourceFacts(r: ResourceRow): string {
  return [typeLabel(r.type), r.capacity ? `max ${r.capacity} people` : 'no occupancy limit', r.allowOverlap ? 'can be shared' : 'one class at a time'].join(' · ');
}

/** The class types that need this room, equipment or qualification (so the owner knows what switching it off affects). */
export function usedBy(id: string, kind: 'resource' | 'capability', reqs: { classTypeId: string; capabilityId: string | null; resourceId: string | null }[], types: { id: string; name: string; isActive: boolean }[]): string[] {
  const ids = new Set(reqs.filter((r) => (kind === 'resource' ? r.resourceId : r.capabilityId) === id).map((r) => r.classTypeId));
  return types.filter((t) => ids.has(t.id) && t.isActive).map((t) => t.name);
}

// ---- Opening hours: the normal hours each room or piece of equipment can be scheduled (resource_availability) ----

export interface DayHours { on: boolean; start: string; end: string }
/** Keyed by the database's weekday number (0 = Sunday). */
export type HoursForm = Record<number, DayHours>;
export interface HoursRow { weekday: number; isAvailable: boolean; start: string; end: string }

export const DEFAULT_OPEN = '06:00';
export const DEFAULT_CLOSE = '22:00';
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Saved rows turned into the form. A day with no saved row shows as open 06:00 to 22:00, as the old page did. */
export function hoursFromRows(rows: HoursRow[]): HoursForm {
  const out: HoursForm = {};
  for (let d = 0; d < 7; d++) {
    const r = rows.find((x) => x.weekday === d);
    out[d] = r ? { on: r.isAvailable, start: r.start.slice(0, 5), end: r.end.slice(0, 5) } : { on: true, start: DEFAULT_OPEN, end: DEFAULT_CLOSE };
  }
  return out;
}

export type HoursCheck = { ok: true; rows: HoursRow[] } | { ok: false; message: string };

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/**
 * All seven days are written (as before). An open day needs a start and a later finish. A closed day keeps whatever
 * valid times it had, otherwise the defaults, because the database wants a finish after the start on every row.
 */
export function validateHours(f: HoursForm): HoursCheck {
  const rows: HoursRow[] = [];
  for (let d = 0; d < 7; d++) {
    const h = f[d] ?? { on: true, start: DEFAULT_OPEN, end: DEFAULT_CLOSE };
    const valid = TIME.test(h.start) && TIME.test(h.end) && h.end > h.start;
    if (h.on && !valid) return { ok: false, message: TIME.test(h.start) && TIME.test(h.end) ? `${DAY_NAMES[d]} must finish after it starts.` : `Enter an opening and closing time for ${DAY_NAMES[d]}.` };
    rows.push(valid ? { weekday: d, isAvailable: h.on, start: h.start, end: h.end } : { weekday: d, isAvailable: h.on, start: DEFAULT_OPEN, end: DEFAULT_CLOSE });
  }
  return { ok: true, rows };
}
