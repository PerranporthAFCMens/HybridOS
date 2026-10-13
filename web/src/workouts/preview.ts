import { readTarget } from '../train/calc';
import { bestWeights, hasPercent, planFor } from '../train/percent';
import { pbKey, type StoredPb } from '../train/pb';
import type { BlockForm } from './calc';

export interface PreviewLine { exercise: string; text: string; missingBest: boolean }

/**
 * What the person will see for the exercises set as a percentage of their best, worked out from their own bests: the same
 * words as on their screen ("3 sets: 5 × 80% (80 kg)"), and a flag where they have no best yet so they will fill in the weight.
 */
export function previewLines(blocks: BlockForm[], pbs: StoredPb[]): PreviewLine[] {
  const bests = bestWeights(pbs);
  const out: PreviewLine[] = [];
  for (const b of blocks) {
    for (const a of b.activities) {
      const sets = readTarget(a.sets);
      if (a.tracking !== 'strength' || !hasPercent(sets)) continue;
      const best = bests.get(pbKey(a.name)) ?? null;
      out.push({ exercise: a.name, text: planFor('strength', sets, best, ''), missingBest: best === null });
    }
  }
  return out;
}
