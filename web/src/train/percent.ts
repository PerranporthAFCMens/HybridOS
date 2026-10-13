import { describeTarget, type SetValues, type Tracking } from './calc';
import { pbKey, type StoredPb } from './pb';
import { isRepsTarget } from './reps';

// Percentage targets. A coach can type a weight as a percentage of the member's best ("80%") instead of kilos. The
// member's app turns it into kilos from their heaviest recorded lift for that exercise, rounded to the nearest 1 kg, and
// the member can go up or down from there. With no best recorded yet, the box is left for the member to fill in.

export const MIN_PERCENT = 1;
export const MAX_PERCENT = 150;

/** True when the box holds a percentage (it ends in %), even a badly typed one. */
export const isPercent = (text: string | undefined): boolean => /%\s*$/.test((text ?? '').trim());

/** "80%", "80 %" or "82.5%" to 80, 80, 82.5. Null when it is not a percentage in range. */
export function parsePercent(text: string | undefined): number | null {
  const m = /^(\d{1,3}(?:[.,]\d{1,2})?)\s*%$/.exec((text ?? '').trim());
  if (!m) return null;
  const n = Number((m[1] ?? '').replace(',', '.'));
  return n >= MIN_PERCENT && n <= MAX_PERCENT ? n : null;
}

/** An error in words for a percentage box that cannot be used, or null when it is fine. */
export function percentError(text: string): string | null {
  return parsePercent(text) === null ? `"${text.trim()}" is not a percentage from ${MIN_PERCENT}% to ${MAX_PERCENT}%. Type something like 80%, or a weight in kg.` : null;
}

/** The weight for a percentage of a best, to the nearest 1 kg. Null when there is no best to work from. */
export function kgFromPercent(percent: number, best: number | null | undefined): number | null {
  if (!best || best <= 0) return null;
  const kg = Math.round((best * percent) / 100);
  return kg > 0 ? kg : null;
}

/** Each exercise's heaviest recorded weight, by the name key personal bests use. */
export function bestWeights(pbs: StoredPb[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const p of pbs) {
    if (p.metric !== 'weight' || !(p.value > 0)) continue;
    const k = pbKey(p.name);
    if (p.value > (out.get(k) ?? 0)) out.set(k, p.value);
  }
  return out;
}

export const hasPercent = (sets: SetValues[]): boolean => sets.some((s) => isPercent(s.weight));

/** The coach's sets with each percentage turned into kilos. Where there is no best, the weight box is left empty. */
export function resolveTarget(sets: SetValues[], best: number | null | undefined): SetValues[] {
  return sets.map((set) => {
    // A range ("8-12") or "max" is something to aim for, not a number to fill in: the member's box is left for what they did.
    const s = { ...set };
    if (isRepsTarget(s.reps)) delete s.reps;
    if (!isPercent(s.weight)) return s;
    const rest = { ...s };
    delete rest.weight;
    const p = parsePercent(s.weight);
    const kg = p === null ? null : kgFromPercent(p, best);
    return kg === null ? rest : { ...rest, weight: String(kg) };
  });
}

/** Words for the member: "5 × 80% (80 kg)", or "5 × 80% (no best recorded yet)". Plain targets read as before. */
export function planFor(tracking: Tracking, sets: SetValues[], best: number | null | undefined, fallback: string): string {
  if (!hasPercent(sets)) return fallback;
  const shown = sets.map((s) => {
    if (!isPercent(s.weight)) return s;
    const p = parsePercent(s.weight);
    const kg = p === null ? null : kgFromPercent(p, best);
    return { ...s, weight: `${(s.weight ?? '').trim().replace(/\s+/g, '')} (${kg === null ? 'no best recorded yet' : `${kg} kg`})` };
  });
  return describeTarget(tracking, shown);
}
