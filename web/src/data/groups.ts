import { supabase } from './client';
import { parseDashboard, parseGroups, parsePreview, type GroupDashboard, type GroupSummary, type InvitePreview, type Metric } from '../groups/calc';

/** Every call below is a member function that checks the caller is signed in and in the group. */
export async function listGroups(gymId: string): Promise<GroupSummary[]> {
  const { data, error } = await supabase.rpc('get_my_training_groups', { p_gym_id: gymId });
  if (error) throw error;
  return parseGroups(data);
}

export async function loadGroup(groupId: string): Promise<GroupDashboard> {
  const { data, error } = await supabase.rpc('get_training_group_dashboard', { p_group_id: groupId });
  if (error) throw error;
  return parseDashboard(data);
}

export async function createGroup(gymId: string, name: string, description: string): Promise<string> {
  const { data, error } = await supabase.rpc('create_training_group', { p_gym_id: gymId, p_name: name, p_description: description.trim() || undefined });
  if (error) throw error;
  return String((data as { id?: string } | null)?.id ?? '');
}

export async function createChallenge(groupId: string, v: { name: string; activity: string; metric: Metric; unit: string; lowerWins: boolean; endsOn: string }): Promise<void> {
  const { error } = await supabase.rpc('create_training_group_challenge', {
    p_group_id: groupId, p_name: v.name, p_activity_name: v.activity, p_metric_type: v.metric, p_unit: v.unit.trim(),
    p_comparison_direction: v.lowerWins ? 'lower' : 'higher', p_ends_at: v.endsOn ? new Date(`${v.endsOn}T23:59:59`).toISOString() : undefined,
  });
  if (error) throw error;
}

export async function submitResult(challengeId: string, value: number): Promise<void> {
  const { error } = await supabase.rpc('submit_training_group_challenge_result', { p_challenge_id: challengeId, p_value: value });
  if (error) throw error;
}

export async function previewInvite(code: string): Promise<InvitePreview> {
  const { data, error } = await supabase.rpc('preview_training_group_invite', { p_code: code });
  if (error) throw error;
  return parsePreview(data);
}

export async function joinByCode(code: string): Promise<string> {
  const { data, error } = await supabase.rpc('join_training_group_by_code', { p_code: code });
  if (error) throw error;
  return String((data as { id?: string } | null)?.id ?? '');
}
