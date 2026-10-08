import { formatDuration, type DbSet, type Tracking } from './calc';

// Personal bests, with the same rules as the classic logger: the heaviest weight (else the most reps) for a
// strength exercise, the most reps, the longest or shortest time, the furthest distance, the most calories.
// A first log creates the best; later logs only replace it when better. Rules are pure so they are tested.

export type Metric = 'weight' | 'reps' | 'time' | 'distance' | 'calories' | 'custom';
export interface PbCandidate { name: string; metric: Metric; dir: 'higher' | 'lower'; value: number; unit: string }
export interface StoredPb { id: string; name: string; metric: string; dir: string; value: number; unit: string; achievedAt: string; notes: string | null }

const HOLD = /\b(plank|hold|hang|wall sit|l-sit|farmer|carry|dead hang|bridge)\b/i;

const positive = (xs: (number | null)[]): number[] => xs.filter((v): v is number => typeof v === 'number' && v > 0);

/** The bests one logged exercise could set. A time is a best when it is shorter, except for holds where longer is better. */
export function candidatesFor(name: string, tracking: Tracking, sets: DbSet[]): PbCandidate[] {
  const n = name.trim();
  if (!n) return [];
  const weight = positive(sets.map((s) => s.weight_kg));
  const reps = positive(sets.map((s) => s.reps));
  const time = positive(sets.map((s) => s.duration_seconds));
  const dist = positive(sets.map((s) => s.distance_m));
  const cal = positive(sets.map((s) => s.calories));
  if (tracking === 'strength') {
    if (weight.length) return [{ name: n, metric: 'weight', dir: 'higher', value: Math.max(...weight), unit: 'kg' }];
    if (reps.length) return [{ name: n, metric: 'reps', dir: 'higher', value: Math.max(...reps), unit: 'reps' }];
  }
  if (tracking === 'reps' && reps.length) return [{ name: n, metric: 'reps', dir: 'higher', value: Math.max(...reps), unit: 'reps' }];
  if (tracking === 'time' && time.length) {
    const hold = HOLD.test(n);
    return [{ name: n, metric: 'time', dir: hold ? 'higher' : 'lower', value: hold ? Math.max(...time) : Math.min(...time), unit: 'sec' }];
  }
  if (tracking === 'distance' && dist.length) return [{ name: n, metric: 'distance', dir: 'higher', value: Math.max(...dist), unit: 'm' }];
  if (tracking === 'calories' && cal.length) return [{ name: n, metric: 'calories', dir: 'higher', value: Math.max(...cal), unit: 'kcal' }];
  return [];
}

export const pbKey = (name: string) => name.trim().toLowerCase();

/** Old rows could hold times in minutes; compare everything in seconds. */
export function comparable(metric: string, unit: string | null, value: number): number {
  return metric === 'time' && /^min/i.test(unit ?? '') ? value * 60 : value;
}

export function isBetter(c: PbCandidate, old: { metric: string; unit: string | null; value: number } | undefined): boolean {
  if (!old) return true;
  const o = comparable(old.metric, old.unit, old.value);
  return c.dir === 'lower' ? c.value < o : c.value > o;
}

export function fmtDist(m: number): string {
  return m >= 1000 ? `${Math.round(m / 10) / 100} km` : `${Math.round(m * 10) / 10} m`;
}

/** A best as the member reads it: "120 kg", "24:18", "5 km". */
export function pbValueText(metric: string, unit: string | null, value: number): string {
  const u = (unit ?? '').toLowerCase();
  if (metric === 'time' && (u === '' || /^(s|sec|secs|seconds)$/.test(u))) return formatDuration(value);
  if (metric === 'time' && /^min/.test(u)) return formatDuration(value * 60);
  if (metric === 'distance' && u === 'm') return fmtDist(value);
  return `${value}${unit ? ` ${unit}` : ''}`;
}

export interface Won { text: string; first: boolean }
export const wonText = (c: PbCandidate): string => `${c.name} ${pbValueText(c.metric, c.unit, c.value)}`;

/** One line for the screen after a workout. */
export function wonMessage(won: Won[]): string {
  if (won.length === 0) return '';
  const label = won.every((w) => w.first) ? (won.length > 1 ? 'First personal bests' : 'First personal best') : won.length > 1 ? 'New personal bests' : 'New personal best';
  return `${label}: ${won.slice(0, 3).map((w) => w.text).join(', ')}${won.length > 3 ? ` and ${won.length - 3} more` : ''}`;
}

export const METRIC_CHOICES: { id: Metric; label: string; unit: string; dir: 'higher' | 'lower' }[] = [
  { id: 'weight', label: 'Weight (kg)', unit: 'kg', dir: 'higher' },
  { id: 'reps', label: 'Most reps', unit: 'reps', dir: 'higher' },
  { id: 'time', label: 'Time (shorter is better)', unit: 'sec', dir: 'lower' },
  { id: 'distance', label: 'Distance (km)', unit: 'm', dir: 'higher' },
  { id: 'calories', label: 'Calories', unit: 'kcal', dir: 'higher' },
];

/** A best typed by hand: value in the unit the person sees (kg, reps, mm:ss, km, kcal). Null when it cannot be read. */
export function manualCandidate(name: string, metric: Metric, text: string): { c: PbCandidate | null; error: string | null } {
  const n = name.trim();
  if (!n) return { c: null, error: 'Add the exercise or event.' };
  const choice = METRIC_CHOICES.find((m) => m.id === metric);
  if (!choice) return { c: null, error: 'Choose what you are recording.' };
  let value: number;
  if (metric === 'time') {
    const t = text.trim();
    const m = /^(\d{1,3}):([0-5]?\d)$/.exec(t);
    value = m ? Number(m[1]) * 60 + Number(m[2]) : /^\d+$/.test(t) ? Number(t) : NaN;
    if (!Number.isFinite(value) || value <= 0) return { c: null, error: 'Enter the time as minutes and seconds, like 24:18.' };
  } else {
    const x = Number(text.replace(',', '.'));
    if (!Number.isFinite(x) || x <= 0) return { c: null, error: 'Enter a number above zero.' };
    value = metric === 'distance' ? Math.round(x * 1000) : x;
  }
  return { c: { name: n, metric, dir: choice.dir, value, unit: choice.unit }, error: null };
}
