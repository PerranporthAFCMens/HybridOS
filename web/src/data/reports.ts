import { supabase } from './client';

export interface ReportSession {
  id: string;
  name: string;
  startsAt: string;
  capacity: number;
}

export interface ReportBooking {
  sessionId: string;
  status: string;
}

/** Every live (not cancelled) class from `since` on, oldest first. `since` null means all time. */
export async function listReportSessions(gymId: string, since: string | null): Promise<ReportSession[]> {
  let q = supabase
    .from('class_sessions')
    .select('id, name, starts_at, capacity')
    .eq('gym_id', gymId)
    .eq('is_cancelled', false)
    .order('starts_at');
  if (since) q = q.gte('starts_at', since);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map((s) => ({ id: s.id, name: s.name, startsAt: s.starts_at, capacity: s.capacity }));
}

const SESSIONS_PER_REQUEST = 50;
const PAGE = 1000;

/**
 * Bookings for the given classes. Asked in groups of classes (so the web address stays short) and in
 * pages of 1000 rows (the database's per-request limit), so nothing is silently cut off.
 */
export async function listReportBookings(sessionIds: string[]): Promise<ReportBooking[]> {
  const out: ReportBooking[] = [];
  for (let i = 0; i < sessionIds.length; i += SESSIONS_PER_REQUEST) {
    const ids = sessionIds.slice(i, i + SESSIONS_PER_REQUEST);
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await supabase
        .from('class_bookings')
        .select('id, session_id, status')
        .in('session_id', ids)
        .order('id')
        .range(from, from + PAGE - 1);
      if (error) throw error;
      for (const b of data ?? []) out.push({ sessionId: b.session_id, status: b.status });
      if ((data ?? []).length < PAGE) break;
    }
  }
  return out;
}

/** Plan of every active membership (an empty text for one with no plan, so it still counts). */
export async function listActiveMembershipPlans(gymId: string): Promise<string[]> {
  const { data, error } = await supabase.from('memberships').select('plan_id').eq('gym_id', gymId).eq('status', 'active');
  if (error) throw error;
  return (data ?? []).map((m) => m.plan_id ?? '');
}
