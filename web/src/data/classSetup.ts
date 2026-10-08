import { supabase } from './client';
import type { Requirement } from './classes';

export interface ClassTypeFull {
  id: string;
  name: string;
  description: string | null;
  level: string;
  durationMinutes: number;
  defaultCapacity: number;
  dropInPence: number | null;
  isActive: boolean;
}

/** The fields the form can change, already checked and in the database's units. */
export interface ClassTypeInput {
  name: string;
  description: string | null;
  level: string;
  durationMinutes: number;
  defaultCapacity: number;
  dropInPence: number | null;
}

/** One thing a class type needs: a qualification, or a room or piece of equipment and how many. */
export interface RequirementInput {
  capabilityId: string | null;
  resourceId: string | null;
  quantity: number;
}

export interface RequirementRow extends Requirement {
  id: string;
}

export interface SetupData {
  types: ClassTypeFull[];
  requirements: RequirementRow[];
  capabilities: { id: string; name: string; description: string | null }[];
  resources: { id: string; name: string; type: string; capacity: number | null }[];
}

/** Everything the Class setup screen shows: all class types (switched on or off), what each needs, and what the gym has. */
export async function loadClassSetup(gymId: string): Promise<SetupData> {
  const [t, r, c, x] = await Promise.all([
    supabase.from('class_types').select('id, name, description, difficulty_level, duration_minutes, default_capacity, drop_in_price_pence, is_active').eq('gym_id', gymId).order('name'),
    supabase.from('service_requirements').select('id, class_type_id, capability_id, resource_id, quantity').eq('gym_id', gymId),
    supabase.from('capabilities').select('id, name, description').eq('gym_id', gymId).eq('is_active', true).order('name'),
    supabase.from('resources').select('id, name, resource_type, capacity').eq('gym_id', gymId).eq('is_active', true).order('name'),
  ]);
  for (const res of [t, r, c, x]) if (res.error) throw res.error;
  return {
    types: (t.data ?? []).map((v) => ({
      id: v.id, name: v.name, description: v.description, level: v.difficulty_level, durationMinutes: v.duration_minutes,
      defaultCapacity: v.default_capacity, dropInPence: v.drop_in_price_pence, isActive: v.is_active,
    })),
    requirements: (r.data ?? []).map((v) => ({ id: v.id, classTypeId: v.class_type_id, capabilityId: v.capability_id, resourceId: v.resource_id, quantity: v.quantity })),
    capabilities: (c.data ?? []).map((v) => ({ id: v.id, name: v.name, description: v.description })),
    resources: (x.data ?? []).map((v) => ({ id: v.id, name: v.name, type: v.resource_type, capacity: v.capacity })),
  };
}

export interface RequirementChanges {
  insert: RequirementInput[];
  update: { id: string; quantity: number }[];
  remove: string[];
}

/**
 * Saves a class type and what it needs. Missing requirements are added first, changed quantities updated,
 * and removed ones deleted last, so a failure part-way never leaves a class type with its requirements wiped
 * (the old page deleted everything first, then re-added).
 */
export async function saveClassType(
  gymId: string,
  typeId: string | null,
  input: ClassTypeInput,
  changes: (existing: RequirementRow[]) => RequirementChanges,
): Promise<string> {
  const row = {
    name: input.name,
    description: input.description,
    difficulty_level: input.level,
    duration_minutes: input.durationMinutes,
    default_capacity: input.defaultCapacity,
    drop_in_price_pence: input.dropInPence,
  };
  let id = typeId;
  if (id) {
    const { error } = await supabase.from('class_types').update(row).eq('id', id).eq('gym_id', gymId);
    if (error) throw error;
  } else {
    const { data, error } = await supabase.from('class_types').insert({ gym_id: gymId, is_active: true, ...row }).select('id').single();
    if (error) throw error;
    id = data.id;
  }
  const { data: existing, error: eErr } = await supabase
    .from('service_requirements')
    .select('id, class_type_id, capability_id, resource_id, quantity')
    .eq('gym_id', gymId)
    .eq('class_type_id', id);
  if (eErr) throw eErr;
  const diff = changes((existing ?? []).map((v) => ({ id: v.id, classTypeId: v.class_type_id, capabilityId: v.capability_id, resourceId: v.resource_id, quantity: v.quantity })));
  if (diff.insert.length) {
    const { error } = await supabase.from('service_requirements').insert(
      diff.insert.map((n) => ({ gym_id: gymId, class_type_id: id as string, capability_id: n.capabilityId, resource_id: n.resourceId, quantity: n.quantity })),
    );
    if (error) throw error;
  }
  for (const u of diff.update) {
    const { error } = await supabase.from('service_requirements').update({ quantity: u.quantity }).eq('id', u.id).eq('gym_id', gymId);
    if (error) throw error;
  }
  if (diff.remove.length) {
    const { error } = await supabase.from('service_requirements').delete().eq('gym_id', gymId).in('id', diff.remove);
    if (error) throw error;
  }
  return id as string;
}

/** Switch a class type off (hidden from Add class, kept for history) or back on. */
export async function setClassTypeActive(gymId: string, typeId: string, isActive: boolean): Promise<void> {
  const { error } = await supabase.from('class_types').update({ is_active: isActive }).eq('id', typeId).eq('gym_id', gymId);
  if (error) throw error;
}
