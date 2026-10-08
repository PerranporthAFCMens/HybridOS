import { supabase } from './client';
import { readPrescription, buildSnapshot, type ActivityForm, type BlockForm, type BlockInput, type SnapshotBlock, type WorkoutInput } from '../workouts/calc';

export interface TemplateRow { id: string; title: string; description: string | null; workoutType: string; focusTags: string[]; estimatedMinutes: number | null; visibility: 'private' | 'gym' }
export interface MemberOption { userId: string; name: string }

export async function loadTemplates(gymId: string): Promise<TemplateRow[]> {
  const { data, error } = await supabase.from('workout_templates').select('id, title, description, workout_type, focus_tags, estimated_minutes, visibility').eq('gym_id', gymId).eq('is_active', true).order('updated_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((t) => ({ id: t.id, title: t.title, description: t.description, workoutType: t.workout_type, focusTags: t.focus_tags ?? [], estimatedMinutes: t.estimated_minutes, visibility: t.visibility === 'gym' ? 'gym' : 'private' }));
}

async function loadParts(templateId: string) {
  const [b, a] = await Promise.all([
    supabase.from('workout_template_blocks').select('id, title, block_type, position, rounds, instructions').eq('template_id', templateId).order('position'),
    supabase.from('workout_template_activities').select('id, block_id, activity_name, activity_type, tracking_type, position, prescription, notes').eq('template_id', templateId).order('position'),
  ]);
  if (b.error) throw b.error;
  if (a.error) throw a.error;
  return { blocks: b.data ?? [], activities: a.data ?? [] };
}

/** One workout's blocks and activities as editable form rows. */
export async function loadBlocks(templateId: string): Promise<BlockForm[]> {
  const { blocks, activities } = await loadParts(templateId);
  let n = 0;
  return blocks.map((b): BlockForm => ({
    key: `b${b.id}`, id: b.id, title: b.title, blockType: b.block_type, rounds: b.rounds === null ? '' : String(b.rounds), instructions: b.instructions ?? '',
    activities: activities.filter((a) => a.block_id === b.id).map((a): ActivityForm => {
      const p = readPrescription(a.prescription);
      return { key: `a${a.id}-${n++}`, id: a.id, name: a.activity_name, tracking: a.tracking_type, prescription: p.display, notes: a.notes ?? '', activityType: a.activity_type, extra: p.extra };
    }),
  }));
}

/**
 * Saves a workout. The new blocks and activities are written first and the old ones removed last, so a failure
 * part-way never leaves a workout with nothing in it (the old page deleted every block first, then re-added).
 */
export async function saveWorkout(gymId: string, userId: string, id: string | null, input: WorkoutInput, blocks: BlockInput[]): Promise<string> {
  const row = {
    gym_id: gymId, created_by: userId, title: input.title, description: input.description, workout_type: input.workoutType,
    focus_tags: input.focusTags, estimated_minutes: input.estimatedMinutes, visibility: input.visibility, is_active: true, updated_at: new Date().toISOString(),
  };
  let templateId = id;
  let oldBlockIds: string[] = [];
  if (templateId) {
    const old = await supabase.from('workout_template_blocks').select('id').eq('template_id', templateId);
    if (old.error) throw old.error;
    oldBlockIds = (old.data ?? []).map((b) => b.id);
    const { error } = await supabase.from('workout_templates').update(row).eq('id', templateId).eq('gym_id', gymId);
    if (error) throw error;
  } else {
    const { data, error } = await supabase.from('workout_templates').insert(row).select('id').single();
    if (error) throw error;
    templateId = data.id;
  }
  for (const [bi, b] of blocks.entries()) {
    const br = await supabase.from('workout_template_blocks').insert({ template_id: templateId, gym_id: gymId, title: b.title, block_type: b.blockType, position: bi, rounds: b.rounds, instructions: b.instructions }).select('id').single();
    if (br.error) throw br.error;
    const ar = await supabase.from('workout_template_activities').insert(
      b.activities.map((a, ai) => ({ block_id: br.data.id, template_id: templateId as string, gym_id: gymId, activity_name: a.name, activity_type: a.activityType, tracking_type: a.tracking, position: ai, prescription: JSON.parse(JSON.stringify(a.prescription)) as never, notes: a.notes })),
    );
    if (ar.error) throw ar.error;
  }
  if (oldBlockIds.length) {
    const { error } = await supabase.from('workout_template_blocks').delete().eq('template_id', templateId).in('id', oldBlockIds);
    if (error) throw error;
  }
  return templateId as string;
}

export async function archiveWorkout(gymId: string, id: string): Promise<void> {
  const { error } = await supabase.from('workout_templates').update({ is_active: false, updated_at: new Date().toISOString() }).eq('id', id).eq('gym_id', gymId);
  if (error) throw error;
}

export async function loadAssignableMembers(gymId: string): Promise<MemberOption[]> {
  const { data, error } = await supabase.from('members').select('user_id, display_name, first_name, last_name, email').eq('gym_id', gymId).eq('status', 'active').not('user_id', 'is', null).order('display_name');
  if (error) throw error;
  return (data ?? []).flatMap((m) => (m.user_id ? [{ userId: m.user_id, name: m.display_name || [m.first_name, m.last_name].filter(Boolean).join(' ') || m.email || 'Member' }] : []));
}

/** A coach assigns a saved workout to one member: the workout is copied into the assignment as it is now. */
export async function assignWorkout(gymId: string, userId: string, t: TemplateRow, memberUserId: string, dueAt: string | null): Promise<void> {
  const { blocks, activities } = await loadParts(t.id);
  const snapBlocks: SnapshotBlock[] = blocks.map((b) => ({ ...b, activities: activities.filter((a) => a.block_id === b.id).map((a) => ({ block_id: a.block_id, activity_name: a.activity_name, activity_type: a.activity_type, tracking_type: a.tracking_type, position: a.position, prescription: a.prescription, notes: a.notes })) }));
  const snapshot = buildSnapshot(t, snapBlocks);
  const { error } = await supabase.from('workout_assignments').insert({
    gym_id: gymId, template_id: t.id, member_user_id: memberUserId, assigned_by: userId, source: 'pt', title: t.title, workout_type: t.workoutType, focus_tags: t.focusTags,
    workout_snapshot: JSON.parse(JSON.stringify(snapshot)) as never, due_at: dueAt, status: 'todo',
  });
  if (error) throw error;
}

export async function publishWod(gymId: string, userId: string, templateId: string, date: string, message: string | null): Promise<void> {
  const { error } = await supabase.from('workout_wods').upsert({ gym_id: gymId, template_id: templateId, published_by: userId, wod_date: date, message, is_active: true }, { onConflict: 'gym_id,wod_date' });
  if (error) throw error;
}
