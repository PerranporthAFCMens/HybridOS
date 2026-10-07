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
