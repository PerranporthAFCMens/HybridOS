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

export interface NewClass {
  name: string;
  description: string | null;
  startsAt: string;
  endsAt: string;
  capacity: number;
  reservedCapacity: number;
  releaseMinutesBefore: number | null;
  /** Plans allowed to use the reserved spaces (ignored when nothing is reserved). */
  reservedPlanIds: string[];
  /** People to assign; the first is the lead. */
  staff: StaffOption[];
}

/**
 * Creates a class, then its reserved-plan rules, then its staff, in that order (as the old page did;
 * there is no single database call for all three). If a later step fails the class itself is kept and
 * the error says which step failed, so nothing is silently half-saved.
 */
export async function createClassSession(gymId: string, c: NewClass): Promise<void> {
  const { data, error } = await supabase
    .from('class_sessions')
    .insert({
      gym_id: gymId,
      name: c.name,
      description: c.description,
      starts_at: c.startsAt,
      ends_at: c.endsAt,
      capacity: c.capacity,
      reserved_capacity: c.reservedCapacity,
      reserved_release_minutes_before: c.releaseMinutesBefore,
    })
    .select('id')
    .single();
  if (error) throw error;
  if (c.reservedCapacity > 0 && c.reservedPlanIds.length) {
    const { error: rErr } = await supabase
      .from('class_session_reserved_plans')
      .insert(c.reservedPlanIds.map((plan_id) => ({ session_id: data.id, plan_id })));
    if (rErr) throw new Error(`Class saved, but reserved-plan rules failed: ${rErr.message}`);
  }
  if (c.staff.length) {
    const { error: sErr } = await supabase.from('class_session_staff').insert(
      c.staff.map((p, i) => ({
        session_id: data.id,
        gym_id: gymId,
        user_id: p.userId,
        assignment_role: p.role === 'coach' ? 'coach' : 'staff',
        is_lead: i === 0,
      })),
    );
    if (sErr) throw new Error(`Class saved, but staff assignment failed: ${sErr.message}`);
  }
}
