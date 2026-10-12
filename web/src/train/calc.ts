// Pure rules for the member's Train screens: reading what a coach sent, the boxes each kind of exercise needs,
// turning what the member typed into database rows, and what to say about last time. No database in here.

export type Tracking = 'strength' | 'reps' | 'time' | 'distance' | 'calories' | 'intervals' | 'instruction';

export interface PlannedActivity { key: string; name: string; tracking: Tracking; plan: string; note: string; block: string; target: SetValues[] }

/**
 * What the database accepts for an exercise's type: strength, time, distance, calories or custom. A reps-only exercise is a
 * strength exercise with no weight, and rounds with a time are custom. (Saving "reps" or "intervals" as they are was refused.)
 */
export function dbTracking(t: Tracking): 'strength' | 'time' | 'distance' | 'calories' | 'custom' {
  if (t === 'reps') return 'strength';
  if (t === 'time' || t === 'distance' || t === 'calories' || t === 'strength') return t;
  return 'custom';
}

const TRACKINGS: Tracking[] = ['strength', 'reps', 'time', 'distance', 'calories', 'intervals', 'instruction'];
const asTracking = (v: unknown): Tracking => (TRACKINGS.includes(v as Tracking) ? (v as Tracking) : 'strength');
const str = (v: unknown) => (typeof v === 'string' ? v : '');

/** The exercises in a workout a coach sent, in order. Anything unreadable is skipped, never a crash. */
export function readSnapshot(raw: unknown): { title: string; activities: PlannedActivity[] } {
  const snap = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const blocks = Array.isArray(snap.blocks) ? (snap.blocks as unknown[]) : [];
  const ordered = blocks
    .filter((b): b is Record<string, unknown> => !!b && typeof b === 'object')
    .sort((a, b) => Number(a.position ?? 0) - Number(b.position ?? 0));
  const activities: PlannedActivity[] = [];
  ordered.forEach((b, bi) => {
    const acts = Array.isArray(b.activities) ? (b.activities as unknown[]) : [];
    acts
      .filter((a): a is Record<string, unknown> => !!a && typeof a === 'object')
      .sort((a, c) => Number(a.position ?? 0) - Number(c.position ?? 0))
      .forEach((a, ai) => {
        const name = str(a.activity_name).trim();
        if (!name) return;
        const p = a.prescription && typeof a.prescription === 'object' && !Array.isArray(a.prescription) ? (a.prescription as Record<string, unknown>) : {};
        const tracking = asTracking(a.tracking_type);
        const target = readTarget(p.sets);
        activities.push({ key: `a${bi}-${ai}`, name, tracking, plan: str(p.display) || describeTarget(tracking, target), note: str(a.notes), block: str(b.title), target });
      });
  });
  return { title: str(snap.title), activities };
}

/** The note a coach wrote when sending the workout, kept inside the copy the client received. */
export function coachNote(raw: unknown): string {
  const snap = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  return typeof snap.coach_note === 'string' ? snap.coach_note.trim() : '';
}

export type Field = 'weight' | 'reps' | 'time' | 'distance' | 'calories';
export const FIELDS: Record<Tracking, { id: Field; label: string; hint: string }[]> = {
  strength: [{ id: 'reps', label: 'reps', hint: 'Reps' }, { id: 'weight', label: 'kg', hint: 'Weight' }],
  reps: [{ id: 'reps', label: 'reps', hint: 'Reps' }],
  time: [{ id: 'time', label: 'time', hint: 'Time, like 12:30' }],
  distance: [{ id: 'distance', label: 'km', hint: 'Distance in km' }],
  calories: [{ id: 'calories', label: 'cal', hint: 'Calories' }],
  intervals: [{ id: 'reps', label: 'rounds', hint: 'Rounds' }, { id: 'time', label: 'time', hint: 'Time, like 1:00' }],
  instruction: [],
};

export type Side = 'left' | 'right' | 'both';
export const SIDES: [Side, string][] = [['left', 'Left'], ['right', 'Right'], ['both', 'Both']];
const asSide = (v: unknown): Side | null => (v === 'left' || v === 'right' || v === 'both' ? v : null);

export type SetValues = Partial<Record<Field, string>> & { side?: string };

const FIELD_IDS: Field[] = ['weight', 'reps', 'time', 'distance', 'calories'];

/** The numbers a coach set, one row per set. Unreadable rows and empty boxes are dropped, never a crash. */
export function readTarget(raw: unknown): SetValues[] {
  if (!Array.isArray(raw)) return [];
  const out: SetValues[] = [];
  for (const r of raw as unknown[]) {
    if (!r || typeof r !== 'object' || Array.isArray(r)) continue;
    const row: SetValues = {};
    for (const id of FIELD_IDS) {
      const v = (r as Record<string, unknown>)[id];
      const text = typeof v === 'number' ? String(v) : typeof v === 'string' ? v.trim() : '';
      if (text) row[id] = text;
    }
    if (Object.keys(row).length) out.push(row);
  }
  return out;
}

/** Words for what a coach set, like "3 sets: 8 × 60 kg". Identical sets are grouped; different ones are listed. */
export function describeTarget(tracking: Tracking, sets: SetValues[]): string {
  const texts = sets.map((s) => setText(tracking, s)).filter(Boolean);
  if (texts.length === 0) return '';
  const first = texts[0] ?? '';
  if (texts.length > 1 && texts.every((t) => t === first)) return `${texts.length} sets: ${first}`;
  return texts.join(' / ');
}

export const blankSets = (tracking: Tracking, n = 3): SetValues[] => (tracking === 'instruction' ? [] : Array.from({ length: n }, () => ({})));

/** "12:30" or "90" (seconds) to seconds. Null when it is not a time. */
export function parseDuration(text: string): number | null {
  const t = text.trim();
  if (!t) return null;
  if (/^\d+$/.test(t)) return Number(t);
  const m = /^(\d{1,3}):([0-5]?\d)$/.exec(t);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

const num = (text: string | undefined): number | null => {
  if (text === undefined || text.trim() === '') return null;
  const n = Number(text.replace(',', '.'));
  return Number.isFinite(n) && n >= 0 ? n : null;
};

export interface DbSet { weight_kg: number | null; reps: number | null; duration_seconds: number | null; distance_m: number | null; calories: number | null; side: Side | null }

/** One typed set as database columns. Null when nothing was entered; `error` names a box that cannot be read. */
export function toDbSet(tracking: Tracking, v: SetValues): { row: DbSet | null; error: string | null } {
  const used = FIELDS[tracking].map((f) => f.id);
  const entered = used.filter((id) => (v[id] ?? '').trim() !== '');
  if (entered.length === 0) return { row: null, error: null };
  const row: DbSet = { weight_kg: null, reps: null, duration_seconds: null, distance_m: null, calories: null, side: asSide(v.side) };
  for (const id of entered) {
    const raw = v[id] ?? '';
    if (id === 'time') {
      const s = parseDuration(raw);
      if (s === null) return { row: null, error: `"${raw}" is not a time. Use minutes and seconds, like 12:30.` };
      row.duration_seconds = s;
    } else {
      const n = num(raw);
      if (n === null) return { row: null, error: `"${raw}" is not a number.` };
      if (id === 'weight') row.weight_kg = n;
      else if (id === 'reps') row.reps = Math.round(n);
      else if (id === 'distance') row.distance_m = Math.round(n * 1000);
      else row.calories = Math.round(n);
    }
  }
  return { row, error: null };
}

/** Database columns back to the boxes, for "last time". */
export type StoredSet = Partial<Omit<DbSet, 'side'>> & { side?: string | null };
export function fromDbSet(tracking: Tracking, r: StoredSet): SetValues {
  const out: SetValues = {};
  for (const f of FIELDS[tracking]) {
    if (f.id === 'weight' && r.weight_kg != null) out.weight = String(r.weight_kg);
    if (f.id === 'reps' && r.reps != null) out.reps = String(r.reps);
    if (f.id === 'time' && r.duration_seconds != null) out.time = formatDuration(r.duration_seconds);
    if (f.id === 'distance' && r.distance_m != null) out.distance = String(Math.round(r.distance_m) / 1000);
    if (f.id === 'calories' && r.calories != null) out.calories = String(r.calories);
  }
  const side = asSide(r.side);
  if (side) out.side = side;
  return out;
}

/** "10 × 24 kg" (reps, then weight) style words for one set. */
export function setText(tracking: Tracking, v: SetValues): string {
  const parts: string[] = [];
  const side = asSide(v.side);
  const tail = side ? ` (${side})` : '';
  if (tracking === 'strength') return [v.reps ? `${v.reps}` : '', v.weight ? `${v.weight} kg` : ''].filter(Boolean).join(' × ') + tail;
  if (v.reps) parts.push(`${v.reps} ${tracking === 'intervals' ? 'rounds' : 'reps'}`);
  if (v.time) parts.push(v.time);
  if (v.distance) parts.push(`${v.distance} km`);
  if (v.calories) parts.push(`${v.calories} cal`);
  return parts.join(' · ') + tail;
}

export type Outcome = 'as_set' | 'changed';
export interface PlayedActivity {
  name: string; originalName: string; tracking: Tracking; sets: SetValues[]; done: boolean; skipped: boolean; note: string; sided?: boolean;
  /** What the coach wrote for this exercise, kept so the coach can see it beside what was done. */
  plan?: string;
  /** The client's own word on it: done as set, or changed. Left empty when they do not say. */
  outcome?: Outcome;
  reason?: string;
}

export type Prepared =
  | { ok: true; entries: { name: string; tracking: Tracking; note: string | null; sets: DbSet[] }[]; ticked: string[]; skipped: string[]; swapped: string[] }
  | { ok: false; message: string };

/**
 * What to write when the member finishes. Skipped exercises are left out and listed so the coach can see them;
 * a swapped exercise keeps its original name in the note. Nothing is required: it is a record, not a test.
 */
export function prepareFinish(acts: PlayedActivity[]): Prepared {
  const entries: { name: string; tracking: Tracking; note: string | null; sets: DbSet[] }[] = [];
  const ticked: string[] = [];
  const skipped: string[] = [];
  const swapped: string[] = [];
  for (const a of acts) {
    const name = a.name.trim();
    if (!name) continue;
    if (a.skipped) { skipped.push(a.originalName || name); continue; }
    const swap = a.originalName && a.originalName !== name;
    if (swap) swapped.push(`${a.originalName} → ${name}`);
    if (a.tracking === 'instruction') { if (a.done) ticked.push(name); continue; }
    const sets: DbSet[] = [];
    for (const s of a.sets) {
      const { row, error } = toDbSet(a.tracking, a.sided ? s : { ...s, side: undefined });
      if (error) return { ok: false, message: `${name}: ${error}` };
      if (row) sets.push(row);
    }
    if (sets.length === 0) continue;
    entries.push({ name, tracking: a.tracking, note: [swap ? `Swapped from ${a.originalName}` : '', a.note.trim()].filter(Boolean).join('. ') || null, sets });
  }
  return { ok: true, entries, ticked, skipped, swapped };
}

/** The note kept with a finished assignment: the member's words, then what they skipped or swapped. */
export function assignmentNote(memberNote: string, skipped: string[], swapped: string[]): string | null {
  const parts = [memberNote.trim(), skipped.length ? `Skipped: ${skipped.join(', ')}` : '', swapped.length ? `Swapped: ${swapped.join(', ')}` : ''].filter(Boolean);
  return parts.length ? parts.join('\n') : null;
}

export interface PlanRow { id: string; title: string; status: string; scheduledFor: string | null; dueAt: string | null }

/** The day a planned workout is meant for, as a gym day: the set date, else the day it is due, else none. */
export function planDay(p: PlanRow, dayOf: (iso: string) => string): string | null {
  return p.scheduledFor ? p.scheduledFor.slice(0, 10) : p.dueAt ? dayOf(p.dueAt) : null;
}

/** Workouts to do now (today, earlier, or with no date), most overdue first. */
export function dueNow(plans: PlanRow[], today: string, dayOf: (iso: string) => string): PlanRow[] {
  return plans
    .filter((p) => p.status === 'todo' || p.status === 'in_progress')
    .filter((p) => { const d = planDay(p, dayOf); return d === null || d <= today; })
    .sort((a, b) => (planDay(a, dayOf) ?? '9999').localeCompare(planDay(b, dayOf) ?? '9999'));
}

/** Workouts planned for later days, soonest first. */
export function comingUp(plans: PlanRow[], today: string, dayOf: (iso: string) => string): PlanRow[] {
  return plans
    .filter((p) => p.status === 'todo' || p.status === 'in_progress')
    .filter((p) => { const d = planDay(p, dayOf); return d !== null && d > today; })
    .sort((a, b) => (planDay(a, dayOf) ?? '').localeCompare(planDay(b, dayOf) ?? ''));
}

/** Did the client record anything for this exercise: a number in any box, or a tick? */
export function hasEntered(a: PlayedActivity): boolean {
  return a.done || a.sets.some((set) => Object.entries(set).some(([k, v]) => k !== 'side' && typeof v === 'string' && v.trim() !== ''));
}

/** Why something was different. Chips, then a few words if they want. Nothing here is a judgement. */
export const REASONS: [string, string][] = [
  ['too_heavy', 'Too heavy'],
  ['too_tired', 'Too tired'],
  ['pain', 'Pain or discomfort'],
  ['out_of_time', 'Out of time'],
  ['no_equipment', 'No equipment'],
  ['other', 'Something else'],
];
export const reasonLabel = (key: string | undefined): string => REASONS.find(([k]) => k === key)?.[1] ?? '';

export type ExerciseStatus = 'as_set' | 'changed' | 'not_this_time' | 'logged' | 'added';
export interface ExerciseResult { name: string; plan: string; status: ExerciseStatus; reason?: string; note?: string; swappedTo?: string }

const STATUS_LABEL: Record<ExerciseStatus, string> = { as_set: 'As set', changed: 'Changed', not_this_time: 'Not this time', logged: 'Logged', added: 'Added by them' };
export const statusLabel = (s: ExerciseStatus): string => STATUS_LABEL[s];

/**
 * The client's report of a finished workout, one line per exercise: as the coach set it, changed (with a reason),
 * not this time, or just logged when they made no claim either way. An exercise they never touched counts as
 * "not this time". `entered` says whether any numbers or a tick were recorded for it.
 */
export function buildResult(acts: (PlayedActivity & { entered: boolean })[]): ExerciseResult[] {
  const out: ExerciseResult[] = [];
  for (const a of acts) {
    const name = (a.originalName || a.name).trim();
    if (!name) continue;
    const base = { name, plan: (a.plan ?? '').trim() };
    // The member's own words about the exercise ride along whatever happened; the chip only matters when it differed.
    const words = a.note.trim() ? { note: a.note.trim() } : {};
    const extra = { ...(a.reason ? { reason: a.reason } : {}), ...words };
    if (!a.originalName) {
      if (a.entered) out.push({ ...base, status: 'added', ...words });
      continue;
    }
    if (a.skipped) { out.push({ ...base, status: 'not_this_time', ...extra }); continue; }
    if (a.name.trim() && a.name.trim() !== a.originalName.trim()) { out.push({ ...base, status: 'changed', swappedTo: a.name.trim(), ...extra }); continue; }
    if (!a.entered) { out.push({ ...base, status: 'not_this_time', ...extra }); continue; }
    if (a.outcome === 'changed') out.push({ ...base, status: 'changed', ...extra });
    else if (a.outcome === 'as_set') out.push({ ...base, status: 'as_set', ...words });
    else out.push({ ...base, status: 'logged', ...words });
  }
  return out;
}

/** A stored report back to rows. Anything unreadable is skipped, never a crash. */
export function readResult(raw: unknown): ExerciseResult[] {
  const obj = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const list = Array.isArray(obj.exercises) ? obj.exercises : [];
  const out: ExerciseResult[] = [];
  for (const e of list) {
    if (!e || typeof e !== 'object') continue;
    const r = e as Record<string, unknown>;
    const status = r.status;
    if (typeof r.name !== 'string' || !(status === 'as_set' || status === 'changed' || status === 'not_this_time' || status === 'logged' || status === 'added')) continue;
    out.push({
      name: r.name, plan: typeof r.plan === 'string' ? r.plan : '', status,
      ...(typeof r.reason === 'string' && r.reason ? { reason: r.reason } : {}),
      ...(typeof r.note === 'string' && r.note ? { note: r.note } : {}),
      ...(typeof r.swappedTo === 'string' && r.swappedTo ? { swappedTo: r.swappedTo } : {}),
    });
  }
  return out;
}

/** The report as it is stored: an object with its exercises (so it can grow without a database change). */
export const resultJson = (exercises: ExerciseResult[]): { version: 1; exercises: ExerciseResult[] } => ({ version: 1, exercises });

/** One line for a list: how many went as set and how many differed. No score, no judgement. */
export function resultSummary(rows: ExerciseResult[]): string {
  const counted = rows.filter((r) => r.status !== 'added');
  if (counted.length === 0) return '';
  const asSet = counted.filter((r) => r.status === 'as_set' || r.status === 'logged').length;
  const changed = counted.filter((r) => r.status === 'changed').length;
  const not = counted.filter((r) => r.status === 'not_this_time').length;
  const parts = [asSet ? `${asSet} as set` : '', changed ? `${changed} changed` : '', not ? `${not} not this time` : ''].filter(Boolean);
  return parts.join(', ');
}

export const hasPainFlag = (rows: ExerciseResult[]): boolean => rows.some((r) => r.reason === 'pain');
