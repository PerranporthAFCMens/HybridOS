import { supabase } from './client';

// Everything the report library needs, loaded in one go. Plain rows with no maths: every report is
// worked out from these in reports/library.ts, which is where the tests are.

const PAGE = 1000;
const IDS_PER_REQUEST = 80;

type Page<T> = PromiseLike<{ data: T[] | null; error: { message: string } | null }>;

/** All rows of a query, a thousand at a time (the database's per-request limit), so nothing is silently cut off. */
async function allRows<T>(page: (from: number, to: number) => Page<T>): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await page(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    out.push(...(data ?? []));
    if ((data ?? []).length < PAGE) break;
  }
  return out;
}

export interface LibPlan { id: string; name: string; pricePence: number; interval: string; isActive: boolean }
export interface LibMembership { id: string; userId: string; planId: string; status: string; startsOn: string; endsOn: string; provider: string; paymentStatus: string; updatedAt: string }
export interface LibGymMember { userId: string; joinedAt: string; attritionOn: string; isActive: boolean }
export interface LibPerson { name: string; dateOfBirth: string; gender: string }
export interface LibPayment { id: string; membershipId: string; userId: string; chargeDate: string; createdAt: string; amountPence: number; state: string; provider: string; failure: string }
export interface LibPurchase { userId: string; sessionId: string; createdAt: string; amountPence: number; status: string }
export interface LibAssignment { userId: string; title: string; type: string; source: string; status: string; scheduledFor: string; completedAt: string; rpe: number | null; createdAt: string }
export interface LibWorkoutSession { userId: string; title: string; performedAt: string; notes: string }
export interface LibPt { memberId: string; staffId: string; startsAt: string; endsAt: string; status: string; notes: string }
export interface LibStaff { userId: string; name: string; role: string; jobTitle: string; payPence: number | null }
export interface LibStaffHours { userId: string; weekday: number; isWorking: boolean; start: string; end: string }
export interface LibSessionStaff { sessionId: string; userId: string; isLead: boolean }
export interface LibSession { id: string; name: string; startsAt: string; endsAt: string; capacity: number; dropInPence: number | null }
export interface LibBooking { sessionId: string; userId: string; status: string; bookedAt: string; cancelledAt: string }

export interface LibraryData {
  plans: LibPlan[];
  memberships: LibMembership[];
  gymMembers: LibGymMember[];
  people: Map<string, LibPerson>;
  payments: LibPayment[];
  purchases: LibPurchase[];
  assignments: LibAssignment[];
  workoutSessions: LibWorkoutSession[];
  pt: LibPt[];
  sessions: LibSession[];
  bookings: LibBooking[];
  /** Everyone with a staff-side role (owners, admins, staff, coaches) and what they are set up to work. */
  staff: LibStaff[];
  staffHours: LibStaffHours[];
  /** Which staff are on which class. */
  sessionStaff: LibSessionStaff[];
}

export async function loadLibraryData(gymId: string, since: string | null): Promise<LibraryData> {
  const plansP = allRows((a, b) => supabase.from('membership_plans').select('id, name, price_pence, billing_interval, is_active').eq('gym_id', gymId).order('id').range(a, b));
  const membershipsP = allRows((a, b) => supabase.from('memberships').select('id, user_id, plan_id, status, starts_on, ends_on, payment_provider, payment_status, updated_at').eq('gym_id', gymId).order('id').range(a, b));
  const gymMembersP = allRows((a, b) => supabase.from('gym_members').select('id, user_id, joined_at, attrition_on, is_active').eq('gym_id', gymId).eq('role', 'member').order('id').range(a, b));
  const paymentsP = allRows((a, b) => supabase.from('payment_records').select('id, membership_id, user_id, charge_date, created_at, amount_pence, state, provider, failure_code, failure_message').eq('gym_id', gymId).order('id').range(a, b));
  const purchasesP = allRows((a, b) => supabase.from('class_booking_purchases').select('id, user_id, session_id, created_at, amount_pence, status').eq('gym_id', gymId).order('id').range(a, b));
  const assignmentsP = allRows((a, b) => supabase.from('workout_assignments').select('id, member_user_id, title, workout_type, source, status, scheduled_for, completed_at, member_rpe, created_at').eq('gym_id', gymId).order('id').range(a, b));
  const workoutSessionsP = allRows((a, b) => supabase.from('workout_sessions').select('id, user_id, title, performed_at, notes').eq('gym_id', gymId).order('id').range(a, b));
  const ptP = allRows((a, b) => supabase.from('pt_appointments').select('id, member_user_id, staff_user_id, starts_at, ends_at, status, notes').eq('gym_id', gymId).order('id').range(a, b));
  const sessionsP = allRows((a, b) => {
    let q = supabase.from('class_sessions').select('id, name, starts_at, ends_at, capacity, drop_in_price_pence').eq('gym_id', gymId).eq('is_cancelled', false).order('starts_at').order('id').range(a, b);
    if (since) q = q.gte('starts_at', since);
    return q;
  });
  const teamP = supabase.rpc('get_gym_team_accounts', { target_gym_id: gymId });
  const profilesP = allRows((a, b) => supabase.from('staff_profiles').select('user_id, job_title, gross_hourly_rate_pence').eq('gym_id', gymId).order('user_id').range(a, b));
  const hoursP = allRows((a, b) => supabase.from('staff_working_hours').select('id, user_id, weekday, is_working, start_time, end_time').eq('gym_id', gymId).order('id').range(a, b));
  const [plans, memberships, gymMembers, payments, purchases, assignments, workoutSessions, pt, sessions, team, staffProfiles, staffHours] = await Promise.all([
    plansP, membershipsP, gymMembersP, paymentsP, purchasesP, assignmentsP, workoutSessionsP, ptP, sessionsP, teamP, profilesP, hoursP,
  ]);
  if (team.error) throw new Error(team.error.message);

  // Bookings for those classes, asked in groups of classes so the web address stays short.
  const bookings: LibBooking[] = [];
  for (let i = 0; i < sessions.length; i += 50) {
    const ids = sessions.slice(i, i + 50).map((s) => s.id);
    const rows = await allRows((a, b) => supabase.from('class_bookings').select('id, session_id, user_id, status, booked_at, cancelled_at').in('session_id', ids).order('id').range(a, b));
    for (const r of rows) bookings.push({ sessionId: r.session_id, userId: r.user_id, status: r.status, bookedAt: r.booked_at, cancelledAt: r.cancelled_at ?? '' });
  }

  // Which staff are on those classes, asked in groups of classes like the bookings.
  const sessionStaff: LibSessionStaff[] = [];
  for (let i = 0; i < sessions.length; i += 50) {
    const ids = sessions.slice(i, i + 50).map((x) => x.id);
    const rows = await allRows((a, b) => supabase.from('class_session_staff').select('id, session_id, user_id, is_lead').in('session_id', ids).order('id').range(a, b));
    for (const r of rows) sessionStaff.push({ sessionId: r.session_id, userId: r.user_id, isLead: r.is_lead });
  }

  const userIds = new Set<string>();
  for (const m of memberships) if (m.user_id) userIds.add(m.user_id);
  for (const m of gymMembers) userIds.add(m.user_id);
  for (const p of payments) if (p.user_id) userIds.add(p.user_id);
  for (const p of purchases) userIds.add(p.user_id);
  for (const w of assignments) userIds.add(w.member_user_id);
  for (const w of workoutSessions) userIds.add(w.user_id);
  for (const p of pt) { userIds.add(p.staff_user_id); if (p.member_user_id) userIds.add(p.member_user_id); }
  for (const b of bookings) userIds.add(b.userId);
  const people = new Map<string, LibPerson>();
  const all = [...userIds];
  for (let i = 0; i < all.length; i += IDS_PER_REQUEST) {
    const { data, error } = await supabase.from('profiles').select('id, display_name, first_name, last_name, date_of_birth, gender').in('id', all.slice(i, i + IDS_PER_REQUEST));
    if (error) throw error;
    for (const p of data ?? []) {
      people.set(p.id, { name: p.display_name || [p.first_name, p.last_name].filter(Boolean).join(' ') || 'Member', dateOfBirth: p.date_of_birth ?? '', gender: p.gender ?? '' });
    }
  }

  return {
    plans: plans.map((p) => ({ id: p.id, name: p.name, pricePence: p.price_pence, interval: p.billing_interval, isActive: p.is_active })),
    memberships: memberships.map((m) => ({ id: m.id, userId: m.user_id ?? '', planId: m.plan_id ?? '', status: m.status, startsOn: m.starts_on ?? '', endsOn: m.ends_on ?? '', provider: m.payment_provider ?? '', paymentStatus: m.payment_status ?? '', updatedAt: m.updated_at })),
    gymMembers: gymMembers.map((m) => ({ userId: m.user_id, joinedAt: m.joined_at, attritionOn: m.attrition_on ?? '', isActive: m.is_active })),
    people,
    payments: payments.map((p) => ({ id: p.id, membershipId: p.membership_id ?? '', userId: p.user_id ?? '', chargeDate: p.charge_date ?? '', createdAt: p.created_at, amountPence: p.amount_pence, state: p.state, provider: p.provider, failure: p.failure_message || p.failure_code || '' })),
    purchases: purchases.map((p) => ({ userId: p.user_id, sessionId: p.session_id, createdAt: p.created_at, amountPence: p.amount_pence, status: p.status })),
    assignments: assignments.map((w) => ({ userId: w.member_user_id, title: w.title, type: w.workout_type, source: w.source, status: w.status, scheduledFor: w.scheduled_for ?? '', completedAt: w.completed_at ?? '', rpe: w.member_rpe, createdAt: w.created_at })),
    workoutSessions: workoutSessions.map((w) => ({ userId: w.user_id, title: w.title ?? '', performedAt: w.performed_at, notes: w.notes ?? '' })),
    pt: pt.map((p) => ({ memberId: p.member_user_id ?? '', staffId: p.staff_user_id, startsAt: p.starts_at, endsAt: p.ends_at, status: p.status, notes: p.notes ?? '' })),
    sessions: sessions.map((s) => ({ id: s.id, name: s.name, startsAt: s.starts_at, endsAt: s.ends_at, capacity: s.capacity, dropInPence: s.drop_in_price_pence })),
    bookings,
    staff: (team.data ?? []).filter((t) => t.role !== 'member').map((t) => {
      const sp = staffProfiles.find((x) => x.user_id === t.user_id);
      return { userId: t.user_id, name: t.display_name || t.email || 'Staff', role: t.role, jobTitle: sp?.job_title ?? '', payPence: sp?.gross_hourly_rate_pence ?? null };
    }),
    staffHours: staffHours.map((h) => ({ userId: h.user_id, weekday: h.weekday, isWorking: h.is_working, start: h.start_time ?? '', end: h.end_time ?? '' })),
    sessionStaff,
  };
}
