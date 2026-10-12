// Pure rules for how a member's class workouts are listed: those in a block are grouped under it, with the week of each class and
// how many they have recorded; the rest sit together. Blocks that are running come first.
import { blockLabel, blockState, blockWeek, gymDay } from '../classes/blocks';

export interface ClassItem { sessionId: string; title: string; className: string; startsAt: string; done: boolean }
export interface BlockInfo { id: string; name: string; startsOn: string; weeks: number }
export interface ClassGroup { key: string; heading: string | null; progress: string; items: (ClassItem & { week: number | null })[] }

export function groupClassWorkouts(items: ClassItem[], blockOf: Map<string, BlockInfo>, today: string): ClassGroup[] {
  const groups = new Map<string, { block: BlockInfo | null; items: (ClassItem & { week: number | null })[] }>();
  for (const it of items) {
    const b = blockOf.get(it.sessionId) ?? null;
    const key = b ? b.id : 'none';
    const g = groups.get(key) ?? { block: b, items: [] };
    g.items.push({ ...it, week: b ? blockWeek(b.startsOn, b.weeks, gymDay(it.startsAt)) : null });
    groups.set(key, g);
  }
  const rank = (b: BlockInfo | null) => (!b ? 3 : blockState(b.startsOn, b.weeks, today).state === 'running' ? 0 : blockState(b.startsOn, b.weeks, today).state === 'upcoming' ? 1 : 2);
  return [...groups.entries()]
    .sort(([, a], [, b]) => rank(a.block) - rank(b.block) || (b.block?.startsOn ?? '').localeCompare(a.block?.startsOn ?? ''))
    .map(([key, g]) => {
      const recorded = g.items.filter((i) => i.done).length;
      const st = g.block ? blockState(g.block.startsOn, g.block.weeks, today) : null;
      return {
        key,
        heading: g.block ? blockLabel(g.block.name, st?.state === 'running' ? st.week : null, g.block.weeks) : null,
        progress: `Recorded ${recorded} of ${g.items.length}`,
        items: g.items.sort((a, b) => b.startsAt.localeCompare(a.startsAt)),
      };
    });
}
