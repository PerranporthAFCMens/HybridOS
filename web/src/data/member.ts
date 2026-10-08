import { supabase } from './client';

export interface ClassRow {
  sessionId: string;
  name: string;
  description: string;
  startsAt: string;
  endsAt: string;
  capacity: number;
  bookedCount: number;
  availableSpaces: number;
  isBooked: boolean;
}

export interface PtRow { id: string; startsAt: string; endsAt: string; status: string }

export interface MyPlan { name: string; status: string; includesClasses: boolean; includesOpenGym: boolean; includesPt: boolean }

export interface ClassAccess {
  included: boolean;
  canPayDropIn: boolean;
  dropInPence: number;
  upgradePlans: { name: string; pricePence: number; interval: string }[];
}

/** Classes in the gym between two moments, with whether this member has booked each. */
export async function listMyClasses(gymId: string, from: Date, to: Date): Promise<ClassRow[]> {
  const { data, error } = await supabase.rpc('member_class_schedule', { p_gym_id: gymId, p_from: from.toISOString(), p_to: to.toISOString() });
  if (error) throw error;
  return (data ?? []).map((r) => ({
    sessionId: r.session_id, name: r.name, description: r.description ?? '', startsAt: r.starts_at, endsAt: r.ends_at,
    capacity: r.capacity, bookedCount: r.booked_count, availableSpaces: r.available_spaces, isBooked: r.is_booked,
  }));
}

/** The database decides whether the booking is allowed; its words are passed on as they are. */
export async function bookClass(sessionId: string): Promise<void> {
  const { error } = await supabase.rpc('member_book_class', { p_session_id: sessionId });
  if (error) throw new Error(error.message);
}

export async function cancelClass(sessionId: string): Promise<void> {
  const { error } = await supabase.rpc('member_cancel_class', { p_session_id: sessionId });
  if (error) throw new Error(error.message);
}

/** Does this member's plan cover the class, and if not what are the choices. */
export async function classAccess(sessionId: string): Promise<ClassAccess> {
  const { data, error } = await supabase.rpc('get_class_booking_options', { p_session_id: sessionId });
  if (error) throw new Error(error.message);
  const d = (data && typeof data === 'object' && !Array.isArray(data) ? data : {}) as Record<string, unknown>;
  const plans = Array.isArray(d.upgrade_plans) ? (d.upgrade_plans as Record<string, unknown>[]) : [];
  return {
    included: d.included_with_membership === true || d.already_paid === true,
    canPayDropIn: d.can_pay_drop_in === true,
    dropInPence: Number(d.drop_in_price_pence) || 0,
    upgradePlans: plans.map((p) => ({ name: String(p.name ?? ''), pricePence: Number(p.price_pence) || 0, interval: String(p.billing_interval ?? '') })),
  };
}

/** The member's newest membership and what its plan includes. Null when there is none. */
export async function getMyPlan(userId: string, gymId: string): Promise<MyPlan | null> {
  const { data, error } = await supabase
    .from('memberships')
    .select('status, membership_plans(name, includes_classes, includes_open_gym, includes_pt)')
    .eq('user_id', userId)
    .eq('gym_id', gymId)
    .order('created_at', { ascending: false })
    .limit(1);
  if (error) throw error;
  const r = data?.[0];
  const p = r?.membership_plans;
  if (!r || !p) return null;
  return { name: p.name, status: r.status, includesClasses: p.includes_classes, includesOpenGym: p.includes_open_gym, includesPt: p.includes_pt };
}

/** The member's own PT sessions from now on, soonest first. */
export async function listMyPt(userId: string, gymId: string, from: Date): Promise<PtRow[]> {
  const { data, error } = await supabase
    .from('pt_appointments')
    .select('id, starts_at, ends_at, status')
    .eq('gym_id', gymId)
    .eq('member_user_id', userId)
    .gte('starts_at', from.toISOString())
    .neq('status', 'cancelled')
    .order('starts_at')
    .limit(10);
  if (error) throw error;
  return (data ?? []).map((r) => ({ id: r.id, startsAt: r.starts_at, endsAt: r.ends_at, status: r.status }));
}

/** How many workouts the member logged since a moment (for the weekly ring). */
export async function countMyWorkouts(userId: string, gymId: string, since: Date): Promise<number> {
  const { count, error } = await supabase
    .from('workout_sessions')
    .select('id', { count: 'exact', head: true })
    .eq('gym_id', gymId)
    .eq('user_id', userId)
    .gte('performed_at', since.toISOString());
  if (error) throw error;
  return count ?? 0;
}

/** The member's PT sessions over the last year and the next few, newest first. */
export async function listMyPtAll(userId: string, gymId: string, now: Date): Promise<PtRow[]> {
  const from = new Date(now.getTime() - 365 * 86400000);
  const { data, error } = await supabase
    .from('pt_appointments')
    .select('id, starts_at, ends_at, status')
    .eq('gym_id', gymId)
    .eq('member_user_id', userId)
    .gte('starts_at', from.toISOString())
    .order('starts_at', { ascending: false })
    .limit(80);
  if (error) throw error;
  return (data ?? []).map((r) => ({ id: r.id, startsAt: r.starts_at, endsAt: r.ends_at, status: r.status }));
}
