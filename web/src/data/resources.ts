import { supabase } from './client';
import type { QualificationRow, ResourceInput, ResourceRow } from '../rooms/calc';

export interface RoomsData {
  resources: ResourceRow[];
  qualifications: QualificationRow[];
  requirements: { classTypeId: string; capabilityId: string | null; resourceId: string | null }[];
  types: { id: string; name: string; isActive: boolean }[];
}

/** Every room, piece of equipment and qualification of a gym (switched on or off), and which class types need them. */
export async function loadRooms(gymId: string): Promise<RoomsData> {
  const [r, c, q, t] = await Promise.all([
    supabase.from('resources').select('id, name, resource_type, capacity, allow_overlap, notes, is_active').eq('gym_id', gymId).order('name'),
    supabase.from('capabilities').select('id, name, description, is_active').eq('gym_id', gymId).order('name'),
    supabase.from('service_requirements').select('class_type_id, capability_id, resource_id').eq('gym_id', gymId),
    supabase.from('class_types').select('id, name, is_active').eq('gym_id', gymId),
  ]);
  for (const res of [r, c, q, t]) if (res.error) throw res.error;
  return {
    resources: (r.data ?? []).map((v) => ({ id: v.id, name: v.name, type: v.resource_type, capacity: v.capacity, allowOverlap: v.allow_overlap, notes: v.notes, isActive: v.is_active })),
    qualifications: (c.data ?? []).map((v) => ({ id: v.id, name: v.name, description: v.description, isActive: v.is_active })),
    requirements: (q.data ?? []).map((v) => ({ classTypeId: v.class_type_id, capabilityId: v.capability_id, resourceId: v.resource_id })),
    types: (t.data ?? []).map((v) => ({ id: v.id, name: v.name, isActive: v.is_active })),
  };
}

/** Adds or changes a room or piece of equipment. Editing writes only the form's fields (the old page also forced it back on). */
export async function saveResource(gymId: string, id: string | null, i: ResourceInput): Promise<void> {
  const row = { name: i.name, resource_type: i.type, capacity: i.capacity, allow_overlap: i.allowOverlap, notes: i.notes };
  const { error } = id
    ? await supabase.from('resources').update(row).eq('id', id).eq('gym_id', gymId)
    : await supabase.from('resources').insert({ gym_id: gymId, is_bookable: true, is_active: true, ...row });
  if (error) throw error;
}

export async function setResourceActive(gymId: string, id: string, isActive: boolean): Promise<void> {
  const { error } = await supabase.from('resources').update({ is_active: isActive }).eq('id', id).eq('gym_id', gymId);
  if (error) throw error;
}

export async function saveQualification(gymId: string, id: string | null, name: string, description: string | null): Promise<void> {
  const { error } = id
    ? await supabase.from('capabilities').update({ name, description }).eq('id', id).eq('gym_id', gymId)
    : await supabase.from('capabilities').insert({ gym_id: gymId, is_active: true, name, description });
  if (error) throw error;
}

export async function setQualificationActive(gymId: string, id: string, isActive: boolean): Promise<void> {
  const { error } = await supabase.from('capabilities').update({ is_active: isActive }).eq('id', id).eq('gym_id', gymId);
  if (error) throw error;
}
