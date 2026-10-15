import { supabase } from './client';
import { names } from './clientTraining';
import { loadAssignableMembers } from './workouts';
import { hasPainFlag, readResult } from '../train/calc';
import type { ClientSummary } from '../staffapp/clientsCalc';

/** Who a PT's clients are: the ones they added, plus anyone they have a booked or finished PT session with. */
export async function listMyClientIds(gymId: string, staffId: string): Promise<{ ids: string[]; added: string[] }> {
  const [c, a] = await Promise.all([
    supabase.from('pt_clients').select('client_user_id').eq('gym_id', gymId).eq('staff_user_id', staffId),
    supabase.from('pt_appointments').select('member_user_id').eq('gym_id', gymId).eq('staff_user_id', staffId).in('status', ['booked', 'completed']).not('member_user_id', 'is', null),
  ]);
  if (c.error) throw c.error;
  if (a.error) throw a.error;
  const added = (c.data ?? []).map((r) => r.client_user_id);
  const booked = (a.data ?? []).flatMap((r) => (r.member_user_id ? [r.member_user_id] : []));
  return { ids: [...new Set([...added, ...booked])], added };
}

/** The PT's clients (or, for an owner or admin, every member) with where each stands. Only workouts the PT's gym coaches set (source "pt") count. */
export async function listMyClients(gymId: string, staffId: string, everyone = false): Promise<ClientSummary[]> {
  // Owners and admins see every active member of the gym; a PT sees their own clients.
  const ids = everyone ? (await loadAssignableMembers(gymId)).map((m) => m.userId).filter((id) => id !== staffId) : (await listMyClientIds(gymId, staffId)).ids;
  if (ids.length === 0) return [];
  const [who, asg] = await Promise.all([
    names(ids),
    supabase.from('workout_assignments').select('id, member_user_id, status, completed_at, created_at, result').eq('gym_id', gymId).eq('source', 'pt').in('member_user_id', ids).order('created_at', { ascending: false }).limit(1000),
  ]);
  if (asg.error) throw asg.error;
  const rows = asg.data ?? [];
  const done = rows.filter((r) => r.status === 'completed');
  const fb = done.length ? await supabase.from('workout_assignment_feedback').select('assignment_id').in('assignment_id', done.map((r) => r.id)) : { data: [], error: null };
  if (fb.error) throw fb.error;
  const replied = new Set((fb.data ?? []).map((f) => f.assignment_id));
  return ids.map((id) => {
    const mine = rows.filter((r) => r.member_user_id === id);
    const open = mine.filter((r) => r.status === 'completed' && !replied.has(r.id));
    return {
      userId: id,
      name: who.get(id) ?? 'Member',
      waiting: mine.filter((r) => r.status === 'todo' || r.status === 'in_progress').length,
      needsReply: open.length,
      pain: open.some((r) => hasPainFlag(readResult(r.result))),
      lastDoneAt: mine.map((r) => r.completed_at).filter((x): x is string => !!x).sort().pop() ?? null,
      lastSetAt: mine.map((r) => r.created_at).sort().pop() ?? null,
    };
  });
}

export async function addClient(gymId: string, staffId: string, clientId: string): Promise<void> {
  const { error } = await supabase.from('pt_clients').upsert({ gym_id: gymId, staff_user_id: staffId, client_user_id: clientId }, { onConflict: 'gym_id,staff_user_id,client_user_id', ignoreDuplicates: true });
  if (error) throw error;
}

export async function removeClient(gymId: string, staffId: string, clientId: string): Promise<void> {
  const { error } = await supabase.from('pt_clients').delete().eq('gym_id', gymId).eq('staff_user_id', staffId).eq('client_user_id', clientId);
  if (error) throw error;
}
