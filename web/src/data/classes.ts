import { supabase } from './client';
import { listClassSessions, type ClassSession } from './today';

export interface TimetableSession extends ClassSession {
  /** Names of the staff assigned to this class, lead first. */
  staffNames: string[];
}

/** Classes between two instants (ISO strings) with the names of the people assigned to each. */
export async function listTimetable(gymId: string, from: string, to: string): Promise<TimetableSession[]> {
  const sessions = await listClassSessions(gymId, from, to);
  if (sessions.length === 0) return [];
  const ids = sessions.map((s) => s.session_id);
  const { data: assigned, error } = await supabase
    .from('class_session_staff')
    .select('session_id, user_id, is_lead')
    .in('session_id', ids);
  if (error) throw error;
  const userIds = [...new Set((assigned ?? []).map((a) => a.user_id))];
  const names = new Map<string, string>();
  if (userIds.length) {
    const { data: profiles, error: pErr } = await supabase
      .from('profiles')
      .select('id, display_name, first_name, last_name')
      .in('id', userIds);
    if (pErr) throw pErr;
    for (const p of profiles ?? []) {
      names.set(p.id, p.display_name || [p.first_name, p.last_name].filter(Boolean).join(' ') || 'Staff');
    }
  }
  return sessions.map((s) => ({
    ...s,
    staffNames: (assigned ?? [])
      .filter((a) => a.session_id === s.session_id)
      .sort((a, b) => Number(b.is_lead) - Number(a.is_lead))
      .map((a) => names.get(a.user_id) ?? 'Staff'),
  }));
}

export interface StaffOption {
  userId: string;
  role: string;
  name: string;
}

/** People who can be assigned to a class: active owners, admins, staff and coaches, by name. */
export async function listStaffOptions(gymId: string): Promise<StaffOption[]> {
  const { data: people, error } = await supabase
    .from('gym_members')
    .select('user_id, role')
    .eq('gym_id', gymId)
    .eq('is_active', true)
    .in('role', ['owner', 'admin', 'staff', 'coach']);
  if (error) throw error;
  const ids = (people ?? []).map((p) => p.user_id);
  const names = new Map<string, string>();
  if (ids.length) {
    const { data: profiles, error: pErr } = await supabase
      .from('profiles')
      .select('id, display_name, first_name, last_name')
      .in('id', ids);
    if (pErr) throw pErr;
    for (const p of profiles ?? []) {
      names.set(p.id, p.display_name || [p.first_name, p.last_name].filter(Boolean).join(' '));
    }
  }
  return (people ?? [])
    .map((p) => ({ userId: p.user_id, role: p.role, name: names.get(p.user_id) || p.role }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export interface ClassTypeRow {
  id: string;
  name: string;
  description: string | null;
  durationMinutes: number;
  defaultCapacity: number;
}

/** Saved class types (templates) that are switched on. */
export async function listClassTypes(gymId: string): Promise<ClassTypeRow[]> {
  const { data, error } = await supabase
    .from('class_types')
    .select('id, name, description, duration_minutes, default_capacity')
    .eq('gym_id', gymId)
    .eq('is_active', true)
    .order('name');
  if (error) throw error;
  return (data ?? []).map((t) => ({ id: t.id, name: t.name, description: t.description, durationMinutes: t.duration_minutes, defaultCapacity: t.default_capacity }));
}

export interface Requirement {
  classTypeId: string;
  capabilityId: string | null;
  resourceId: string | null;
  quantity: number;
}

export interface NamedItem {
  id: string;
  name: string;
}

export interface ResourceItem extends NamedItem {
  type: string;
  capacity: number | null;
}

export interface StaffQualification {
  userId: string;
  capabilityId: string;
  qualified: boolean;
  expiresOn: string | null;
}

export interface WorkingHours {
  userId: string;
  weekday: number;
  startTime: string | null;
  endTime: string | null;
  isWorking: boolean;
}

/** Everything a class type needs, and what each person holds, so the form can explain itself. */
export interface SchedulingRules {
  requirements: Requirement[];
  capabilities: NamedItem[];
  resources: ResourceItem[];
  qualifications: StaffQualification[];
  hours: WorkingHours[];
}

export async function listSchedulingRules(gymId: string): Promise<SchedulingRules> {
  const [req, cap, res, qual, hours] = await Promise.all([
    supabase.from('service_requirements').select('class_type_id, capability_id, resource_id, quantity').eq('gym_id', gymId),
    supabase.from('capabilities').select('id, name').eq('gym_id', gymId),
    supabase.from('resources').select('id, name, resource_type, capacity').eq('gym_id', gymId).eq('is_active', true),
    supabase.from('staff_capabilities').select('user_id, capability_id, qualified, expires_on').eq('gym_id', gymId),
    supabase.from('staff_working_hours').select('user_id, weekday, start_time, end_time, is_working').eq('gym_id', gymId),
  ]);
  for (const r of [req, cap, res, qual, hours]) if (r.error) throw r.error;
  return {
    requirements: (req.data ?? []).map((r) => ({ classTypeId: r.class_type_id, capabilityId: r.capability_id, resourceId: r.resource_id, quantity: r.quantity })),
    capabilities: (cap.data ?? []).map((c) => ({ id: c.id, name: c.name })),
    resources: (res.data ?? []).map((r) => ({ id: r.id, name: r.name, type: r.resource_type, capacity: r.capacity })),
    qualifications: (qual.data ?? []).map((q) => ({ userId: q.user_id, capabilityId: q.capability_id, qualified: q.qualified, expiresOn: q.expires_on })),
    hours: (hours.data ?? []).map((h) => ({ userId: h.user_id, weekday: h.weekday, startTime: h.start_time, endTime: h.end_time, isWorking: h.is_working })),
  };
}

export interface ScheduleProposal {
  classTypeId: string | null;
  startsAt: string;
  endsAt: string;
  capacity: number;
  /** User ids of the people to assign; the first is the lead. */
  staffIds: string[];
}

/** What the database says about a proposed class: ok, or a list of problems in plain English. */
export interface ScheduleVerdict {
  ok: boolean;
  errors: string[];
  warnings: string[];
}

function toVerdict(value: unknown): ScheduleVerdict {
  const v = (value ?? {}) as { ok?: boolean; errors?: unknown; warnings?: unknown };
  const list = (x: unknown) => (Array.isArray(x) ? x.map(String) : []);
  return { ok: v.ok === true, errors: list(v.errors), warnings: list(v.warnings) };
}

/**
 * Asks the database whether this class can run: qualified coach, coach working and free, room open and
 * big enough, equipment free. A class with no class type has nothing to check against.
 */
export async function checkSchedule(gymId: string, p: ScheduleProposal): Promise<ScheduleVerdict> {
  if (!p.classTypeId) return { ok: true, errors: [], warnings: [] };
  const { data, error } = await supabase.rpc('validate_class_schedule', {
    p_gym_id: gymId,
    p_class_type_id: p.classTypeId,
    p_starts_at: p.startsAt,
    p_ends_at: p.endsAt,
    p_capacity: p.capacity,
    p_staff_ids: p.staffIds,
  });
  if (error) throw error;
  return toVerdict(data);
}

export interface NewClass extends ScheduleProposal {
  name: string;
  description: string | null;
  reservedCapacity: number;
  releaseMinutesBefore: number | null;
  /** Plans allowed to use the reserved spaces (ignored when nothing is reserved). */
  reservedPlanIds: string[];
}

/**
 * Creates the class, its reserved-plan rules, its staff and its room and equipment in ONE database
 * call that checks everything first. Nothing is saved unless every check passes, so a class can no
 * longer be half-saved. Returns the verdict: ok, or what has to change.
 */
export async function createClassSession(gymId: string, c: NewClass): Promise<ScheduleVerdict> {
  const { data, error } = await supabase.rpc('create_validated_class_session', {
    p_gym_id: gymId,
    // A class with no class type is allowed (nothing to check against); the database function accepts
    // null here although its generated type cannot say so.
    p_class_type_id: c.classTypeId as string,
    p_name: c.name,
    p_description: c.description as string,
    p_starts_at: c.startsAt,
    p_ends_at: c.endsAt,
    p_capacity: c.capacity,
    p_reserved_capacity: c.reservedCapacity,
    p_reserved_release_minutes_before: c.releaseMinutesBefore as number,
    p_staff_ids: c.staffIds,
    p_plan_ids: c.reservedPlanIds,
  });
  if (error) throw error;
  return toVerdict(data);
}
