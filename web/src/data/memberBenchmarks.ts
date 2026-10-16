import { supabase } from './client';
import { addDaysTo, gymDay } from '../classes/blocks';
import { TEST_DAYS, isBetter } from '../classes/benchmarks';
import type { BenchmarkDef, RecordedExercise } from '../train/benchmarkProgress';
import type { DbSet, Tracking } from '../train/calc';

export interface BlockBenchmarkSet { blockId: string; defs: BenchmarkDef[]; recorded: RecordedExercise[] }

const TRACKINGS: Tracking[] = ['strength', 'reps', 'time', 'distance', 'calories'];

/** The benchmarks of the member's blocks, with the matching exercises the member recorded around the test days. Only the member's own workouts are read. */
export async function getMyBenchmarks(userId: string, gymId: string, blocks: { id: string }[]): Promise<BlockBenchmarkSet[]> {
  if (blocks.length === 0) return [];
  const b = await supabase
    .from('block_benchmarks')
    .select('id, block_id, movement_id, test_start_on, test_end_on, better, created_at, movements(name, default_tracking)')
    .eq('gym_id', gymId)
    .in('block_id', blocks.map((x) => x.id))
    .order('created_at');
  if (b.error) throw b.error;
  const rows = b.data ?? [];
  if (rows.length === 0) return [];
  const days = rows.flatMap((r) => [r.test_start_on, r.test_end_on]).sort();
  // A day either side keeps the gym's clock from cutting a workout off at the edge; each exercise is placed on its gym day below.
  const from = `${addDaysTo(days[0] ?? '', -1)}T00:00:00Z`;
  const to = `${addDaysTo(days[days.length - 1] ?? '', TEST_DAYS + 1)}T00:00:00Z`;
  const s = await supabase.from('workout_sessions').select('id, performed_at').eq('user_id', userId).eq('gym_id', gymId).gte('performed_at', from).lt('performed_at', to);
  if (s.error) throw s.error;
  const sessions = new Map((s.data ?? []).map((x) => [x.id, gymDay(x.performed_at)]));
  const recorded: RecordedExercise[] = [];
  if (sessions.size > 0) {
    const e = await supabase.from('workout_entries').select('id, session_id, exercise_name, movement_id, tracking_type').in('session_id', [...sessions.keys()]);
    if (e.error) throw e.error;
    const entries = e.data ?? [];
    const st = entries.length ? await supabase.from('workout_sets').select('entry_id, reps, weight_kg, duration_seconds, distance_m, calories, custom_value, custom_unit, side').in('entry_id', entries.map((x) => x.id)) : { data: [], error: null };
    if (st.error) throw st.error;
    for (const x of entries) {
      const tracking = x.tracking_type as Tracking;
      if (!TRACKINGS.includes(tracking)) continue;
      const sets = (st.data ?? []).filter((r) => r.entry_id === x.id) as unknown as DbSet[];
      recorded.push({ day: sessions.get(x.session_id) ?? '', name: x.exercise_name, movementId: x.movement_id, tracking, sets });
    }
  }
  const out = new Map<string, BlockBenchmarkSet>();
  for (const r of rows) {
    const m = Array.isArray(r.movements) ? r.movements[0] : r.movements;
    const set = out.get(r.block_id) ?? { blockId: r.block_id, defs: [], recorded };
    set.defs.push({ id: r.id, movementId: r.movement_id, movementName: m?.name ?? 'A movement', tracking: m?.default_tracking ?? 'strength', startOn: r.test_start_on, endOn: r.test_end_on, better: isBetter(r.better) ? r.better : 'higher' });
    out.set(r.block_id, set);
  }
  return [...out.values()];
}
