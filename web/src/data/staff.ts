import { supabase } from './client';
import { edgeErrorMessage } from './edge';
import type { HoursRow, StaffValues, QualChanges, TeamRow } from '../staff/calc';

export interface CapabilityRow { id: string; name: string }
export interface LevelRow { id: string; name: string }
export interface StaffProfile { jobTitle: string | null; payPence: number | null; employment: string | null }
export interface Qualification { userId: string; capabilityId: string; expiresOn: string | null }

export interface StaffData {
  team: TeamRow[];
  profiles: Map<string, StaffProfile>;
  hours: (HoursRow & { userId: string })[];
  capabilities: CapabilityRow[];
  quals: Qualification[];
  levels: LevelRow[];
  /** Which access level each person has. */
  access: Map<string, string>;
}

/** The whole team of a gym with everything the Staff screen shows. */
export async function loadStaff(gymId: string): Promise<StaffData> {
  const [team, profiles, hours, caps, quals, levels, access] = await Promise.all([
    supabase.rpc('get_gym_team_accounts', { target_gym_id: gymId }),
    supabase.from('staff_profiles').select('user_id, job_title, gross_hourly_rate_pence, employment_type').eq('gym_id', gymId),
    supabase.from('staff_working_hours').select('user_id, weekday, is_working, start_time, end_time').eq('gym_id', gymId),
    supabase.from('capabilities').select('id, name').eq('gym_id', gymId).eq('is_active', true).order('name'),
    supabase.from('staff_capabilities').select('user_id, capability_id, expires_on').eq('gym_id', gymId).eq('qualified', true),
    supabase.from('staff_access_levels').select('id, name').eq('gym_id', gymId).eq('is_active', true).order('name'),
    supabase.from('staff_access').select('user_id, access_level_id').eq('gym_id', gymId),
  ]);
  for (const r of [team, profiles, hours, caps, quals, levels, access]) if (r.error) throw r.error;
  return {
    team: (team.data ?? []).map((t) => ({ userId: t.user_id, name: t.display_name || t.email || 'Team member', email: t.email ?? '', role: t.role, isActive: t.is_active, accessStatus: t.access_status })),
    profiles: new Map((profiles.data ?? []).map((p) => [p.user_id, { jobTitle: p.job_title, payPence: p.gross_hourly_rate_pence, employment: p.employment_type }])),
    hours: (hours.data ?? []).map((h) => ({ userId: h.user_id, weekday: h.weekday, isWorking: h.is_working, start: h.start_time ?? '', end: h.end_time ?? '' })),
    capabilities: (caps.data ?? []).map((c) => ({ id: c.id, name: c.name })),
    quals: (quals.data ?? []).map((q) => ({ userId: q.user_id, capabilityId: q.capability_id, expiresOn: q.expires_on })),
    levels: (levels.data ?? []).map((l) => ({ id: l.id, name: l.name })),
    access: new Map((access.data ?? []).map((a) => [a.user_id, a.access_level_id])),
  };
}

/** A save that stopped part-way: says which step failed and which had already been saved. */
export class StepError extends Error {
  constructor(public step: string, cause: string, public done: string[]) {
    super(done.length ? `Could not save ${step}: ${cause} Already saved: ${done.join(', ')}.` : `Could not save ${step}: ${cause}`);
  }
}

export interface SaveStaffArgs {
  gymId: string;
  userId: string;
  role: 'staff' | 'coach';
  roleChanged: boolean;
  accessLevelId: string;
  accessChanged: boolean;
  values: StaffValues;
  hoursToWrite: StaffValues['hours'];
  qualChanges: QualChanges;
}

/**
 * Saves an edit one step at a time, checking each. Additions and changes come before removals, so a
 * failure part-way never loses a qualification that should stay, and the message says what was and
 * was not saved. (The old page ignored most of these errors.)
 */
export async function saveStaff(a: SaveStaffArgs): Promise<void> {
  const done: string[] = [];
  const step = async (name: string, run: () => PromiseLike<{ error: { message: string } | null }>) => {
    const { error } = await run();
    if (error) throw new StepError(name, error.message, done);
    done.push(name);
  };
  if (a.roleChanged) await step('their role', () => supabase.from('gym_members').update({ role: a.role }).eq('gym_id', a.gymId).eq('user_id', a.userId));
  if (a.accessChanged) await step('their access level', () => supabase.rpc('assign_staff_access_level', { target_gym_id: a.gymId, target_user_id: a.userId, target_level_id: a.accessLevelId }));
  await step('their details', () =>
    supabase.from('staff_profiles').upsert(
      { gym_id: a.gymId, user_id: a.userId, job_title: a.values.jobTitle, gross_hourly_rate_pence: a.values.payPence, employment_type: a.values.employment, is_active: true },
      { onConflict: 'gym_id,user_id' },
    ),
  );
  if (a.hoursToWrite.length) {
    await step('their working hours', () =>
      supabase.from('staff_working_hours').upsert(
        a.hoursToWrite.map((h) => ({ gym_id: a.gymId, user_id: a.userId, weekday: h.weekday, is_working: h.isWorking, start_time: h.start, end_time: h.end })),
        { onConflict: 'gym_id,user_id,weekday' },
      ),
    );
  }
  if (a.qualChanges.upsert.length) {
    await step('their qualifications', () =>
      supabase.from('staff_capabilities').upsert(
        a.qualChanges.upsert.map((q) => ({ gym_id: a.gymId, user_id: a.userId, capability_id: q.capabilityId, qualified: true, expires_on: q.expiresOn })),
        { onConflict: 'gym_id,user_id,capability_id' },
      ),
    );
  }
  if (a.qualChanges.remove.length) {
    await step('removed qualifications', () =>
      supabase.from('staff_capabilities').delete().eq('gym_id', a.gymId).eq('user_id', a.userId).in('capability_id', a.qualChanges.remove),
    );
  }
}

export interface NewLogin { name: string; email: string; role: 'staff' | 'coach'; accessLevelId: string }

/**
 * Creates a staff login with the live "admin-create-staff-with-level" function (the same call the old
 * page makes). It may hand back a temporary password, which the owner passes on.
 */
export async function createStaffLogin(gymId: string, n: NewLogin): Promise<{ userId: string; tempPassword: string | null }> {
  const { data, error } = await supabase.functions.invoke('admin-create-staff-with-level', {
    body: { gym_id: gymId, email: n.email, display_name: n.name, role: n.role, access_level_id: n.accessLevelId },
  });
  if (error) throw new Error(await edgeErrorMessage(error, 'Could not create the staff login.'));
  const j = (data ?? {}) as { user_id?: string; temp_password?: string; error?: string };
  if (!j.user_id) throw new Error(j.error || 'Could not create the staff login.');
  return { userId: j.user_id, tempPassword: j.temp_password ?? null };
}

/** Stops a staff member's access to this gym. Their HybridOne login stays. */
export async function removeStaffAccess(gymId: string, userId: string): Promise<void> {
  const { error } = await supabase.rpc('remove_gym_staff_access', { target_gym_id: gymId, target_user_id: userId });
  if (error) throw error;
}
