import { supabase } from './client';
import { listClassSessions } from './today';
import { manageBooking, type BookingStatus } from './classes';
import { readPermissions, type Permissions } from '../access/calc';

/** One class on a staff member's screen. `role` is their part in it ("Coach", "Lead") when they are assigned to it. */
export interface StaffClass {
  sessionId: string;
  name: string;
  startsAt: string;
  endsAt: string;
  role: string | null;
  booked: number | null;
  capacity: number | null;
}

/** What this person was allowed to do by their access level. Owners and admins are not stored here (they can do everything). */
export async function loadMyPermissions(gymId: string, userId: string): Promise<Permissions> {
  const { data, error } = await supabase.from('staff_access').select('permissions').eq('gym_id', gymId).eq('user_id', userId).maybeSingle();
  if (error) throw error;
  return readPermissions(data?.permissions);
}

/** The classes this person is assigned to between two instants. Cancelled classes are left out. */
export async function listMyClasses(gymId: string, userId: string, from: string, to: string): Promise<StaffClass[]> {
  const { data, error } = await supabase
    .from('class_session_staff')
    .select('session_id, assignment_role, is_lead, class_sessions(id, name, starts_at, ends_at, capacity, is_cancelled)')
    .eq('gym_id', gymId)
    .eq('user_id', userId);
  if (error) throw error;
  const out: StaffClass[] = [];
  for (const r of data ?? []) {
    const s = r.class_sessions;
    if (!s || s.is_cancelled || s.starts_at < from || s.starts_at > to) continue;
    out.push({ sessionId: s.id, name: s.name, startsAt: s.starts_at, endsAt: s.ends_at, role: r.is_lead ? 'Lead' : r.assignment_role || 'Coach', booked: null, capacity: s.capacity });
  }
  return out.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}

/** The whole gym's classes between two instants (for staff who may see the timetable). Cancelled classes are left out. */
export async function listGymClasses(gymId: string, from: string, to: string): Promise<StaffClass[]> {
  const rows = await listClassSessions(gymId, from, to);
  return rows
    .filter((s) => !s.is_cancelled)
    .map((s) => ({ sessionId: s.session_id, name: s.name, startsAt: s.starts_at, endsAt: s.ends_at, role: null, booked: s.booked_count, capacity: s.capacity }));
}

/**
 * Mark one booking attended, no-show, or back to booked. Staff and coaches change the booking directly (the database allows it only
 * for a class they are assigned to and only with the attendance permission); owners and admins use the checked admin call.
 */
export async function markAttendance(a: { gymId: string; sessionId: string; bookingId: string; userId: string; status: BookingStatus; admin: boolean }): Promise<void> {
  if (a.admin) {
    const r = await manageBooking(a.gymId, a.sessionId, a.userId, a.status);
    if (!r.ok) throw new Error(r.errors.join(' ') || 'Could not change that booking.');
    return;
  }
  const { data, error } = await supabase.from('class_bookings').update({ status: a.status }).eq('id', a.bookingId).select('id');
  if (error) throw error;
  if (!data?.length) throw new Error('You can only mark attendance for classes you are assigned to.');
}
