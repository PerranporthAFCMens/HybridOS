import { supabase } from './client';
import { setClassCancelled } from './classes';
import { listClassSessions } from './today';
import type { BlockRow, ClassSlot, ClosedRow, PtSlot } from '../rota/calc';

export interface RotaData { blocks: BlockRow[]; closed: ClosedRow[] }

/** Time off and closed days that touch a window of days: from (first day, inclusive) to the day after the last. */
export async function loadRota(gymId: string, fromIso: string, toIso: string, firstDay: string, lastDay: string): Promise<RotaData> {
  const [blocks, closed] = await Promise.all([
    supabase.from('staff_time_blocks').select('id, user_id, starts_at, ends_at, kind, reason').eq('gym_id', gymId).lt('starts_at', toIso).gt('ends_at', fromIso).order('starts_at'),
    supabase.from('gym_closed_days').select('id, closed_on, reason').eq('gym_id', gymId).gte('closed_on', firstDay).lte('closed_on', lastDay).order('closed_on'),
  ]);
  if (blocks.error) throw blocks.error;
  if (closed.error) throw closed.error;
  return {
    blocks: (blocks.data ?? []).map((b) => ({ id: b.id, userId: b.user_id, startsAt: b.starts_at, endsAt: b.ends_at, kind: b.kind, reason: b.reason })),
    closed: (closed.data ?? []).map((c) => ({ id: c.id, closedOn: c.closed_on, reason: c.reason })),
  };
}

export interface NewBlock { userId: string; startsAt: string; endsAt: string; kind: string; reason: string | null }

export async function addBlock(gymId: string, b: NewBlock): Promise<void> {
  const { error } = await supabase.from('staff_time_blocks').insert({ gym_id: gymId, user_id: b.userId, starts_at: b.startsAt, ends_at: b.endsAt, kind: b.kind, reason: b.reason });
  if (error) throw error;
}

export async function removeBlock(gymId: string, id: string): Promise<void> {
  const { error } = await supabase.from('staff_time_blocks').delete().eq('gym_id', gymId).eq('id', id);
  if (error) throw error;
}

export async function addClosedDay(gymId: string, day: string, reason: string | null): Promise<void> {
  const { error } = await supabase.from('gym_closed_days').insert({ gym_id: gymId, closed_on: day, reason });
  if (error) throw error;
}

export async function removeClosedDay(gymId: string, id: string): Promise<void> {
  const { error } = await supabase.from('gym_closed_days').delete().eq('gym_id', gymId).eq('id', id);
  if (error) throw error;
}

// ---- What is already booked with someone (so time off can be checked against it) ----

export interface Bookings { classes: ClassSlot[]; pt: PtSlot[] }

/**
 * The upcoming classes (one row per coach) and booked personal training sessions between two instants. With `userId` only that
 * person's; without it everyone's (owners and admins).
 */
export async function loadBookings(gymId: string, fromIso: string, toIso: string, userId?: string): Promise<Bookings> {
  let classesQ = supabase.from('class_session_staff').select('user_id, class_sessions!inner(id, name, starts_at, ends_at, is_cancelled)').eq('gym_id', gymId)
    .gte('class_sessions.starts_at', fromIso).lt('class_sessions.starts_at', toIso).eq('class_sessions.is_cancelled', false);
  let ptQ = supabase.from('pt_appointments').select('id, staff_user_id, starts_at, ends_at').eq('gym_id', gymId).eq('status', 'booked').gte('starts_at', fromIso).lt('starts_at', toIso);
  if (userId) {
    classesQ = classesQ.eq('user_id', userId);
    ptQ = ptQ.eq('staff_user_id', userId);
  }
  const [classes, pt, calendar] = await Promise.all([classesQ, ptQ, listClassSessions(gymId, fromIso, toIso).catch(() => [])]);
  if (classes.error) throw classes.error;
  if (pt.error) throw pt.error;
  const booked = new Map(calendar.map((s) => [s.session_id, s.booked_count]));
  return {
    classes: (classes.data ?? []).flatMap((r) => (r.class_sessions ? [{ sessionId: r.class_sessions.id, name: r.class_sessions.name, startsAt: r.class_sessions.starts_at, endsAt: r.class_sessions.ends_at, userId: r.user_id, booked: booked.get(r.class_sessions.id) ?? null }] : [])),
    pt: (pt.data ?? []).map((p) => ({ id: p.id, userId: p.staff_user_id, startsAt: p.starts_at, endsAt: p.ends_at })),
  };
}

/** A person's own time off from now on (their screen). */
export async function loadMyBlocks(gymId: string, userId: string, fromIso: string): Promise<BlockRow[]> {
  const { data, error } = await supabase.from('staff_time_blocks').select('id, user_id, starts_at, ends_at, kind, reason').eq('gym_id', gymId).eq('user_id', userId).gt('ends_at', fromIso).order('starts_at').limit(200);
  if (error) throw error;
  return (data ?? []).map((b) => ({ id: b.id, userId: b.user_id, startsAt: b.starts_at, endsAt: b.ends_at, kind: b.kind, reason: b.reason }));
}

/** Every person's time off from now on, for the owner's "needs a decision" list. */
export async function loadUpcomingBlocks(gymId: string, fromIso: string, toIso: string): Promise<BlockRow[]> {
  const { data, error } = await supabase.from('staff_time_blocks').select('id, user_id, starts_at, ends_at, kind, reason').eq('gym_id', gymId).lt('starts_at', toIso).gt('ends_at', fromIso).order('starts_at').limit(1000);
  if (error) throw error;
  return (data ?? []).map((b) => ({ id: b.id, userId: b.user_id, startsAt: b.starts_at, endsAt: b.ends_at, kind: b.kind, reason: b.reason }));
}

/** Owners and admins: cancel a class (members see it as cancelled, as from the timetable), or a personal training session. */
export const cancelClass = (gymId: string, sessionId: string) => setClassCancelled(gymId, sessionId, true);
export async function cancelPtSession(gymId: string, id: string): Promise<void> {
  const { error } = await supabase.from('pt_appointments').update({ status: 'cancelled' }).eq('gym_id', gymId).eq('id', id);
  if (error) throw error;
}
