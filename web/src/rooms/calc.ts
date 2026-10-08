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
