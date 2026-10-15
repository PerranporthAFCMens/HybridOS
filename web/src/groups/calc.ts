/** Training groups: reading what the database sends back and the rules for forms. No network here. */

export interface GroupSummary { id: string; name: string; description: string; inviteCode: string; memberCount: number; challengeCount: number }
export interface GroupMember { userId: string; name: string; workouts: { title: string; at: string }[]; pbs: { exercise: string; value: string; unit: string; at: string }[] }
export interface Entry { userId: string; name: string; value: number; note: string }
export interface Challenge { id: string; name: string; activity: string; metric: string; unit: string; lowerWins: boolean; endsAt: string | null; entries: Entry[] }
export interface GroupDashboard { id: string; name: string; description: string; inviteCode: string; members: GroupMember[]; challenges: Challenge[] }
export interface InvitePreview { id: string; name: string; description: string; memberCount: number; ownerName: string; alreadyMember: boolean }

export const METRICS = ['weight', 'reps', 'time', 'distance', 'calories', 'custom'] as const;
export type Metric = (typeof METRICS)[number];
const UNITS: Record<Metric, string> = { weight: 'kg', reps: 'reps', time: 'sec', distance: 'm', calories: 'kcal', custom: '' };
export const unitFor = (m: Metric): string => UNITS[m];
/** Times are won by the lowest number; everything else by the highest. */
export const defaultLowerWins = (m: Metric): boolean => m === 'time';

type Raw = Record<string, unknown>;
const obj = (v: unknown): Raw => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Raw) : {});
const list = (v: unknown): Raw[] => (Array.isArray(v) ? v.map(obj) : []);
const str = (v: unknown, fallback = ''): string => (typeof v === 'string' ? v : fallback);
const num = (v: unknown): number => (typeof v === 'number' ? v : Number(v) || 0);

export function parseGroups(json: unknown): GroupSummary[] {
  return list(json).map((g) => ({ id: str(g.id), name: str(g.name), description: str(g.description), inviteCode: str(g.invite_code), memberCount: num(g.member_count), challengeCount: num(g.challenge_count) }));
}

export function parseDashboard(json: unknown): GroupDashboard {
  const j = obj(json);
  const g = obj(j.group);
  return {
    id: str(g.id), name: str(g.name), description: str(g.description), inviteCode: str(g.invite_code),
    members: list(j.members).map((m) => ({
      userId: str(m.user_id), name: str(m.name, 'Member'),
      workouts: list(m.recent_workouts).map((w) => ({ title: str(w.title, 'Workout'), at: str(w.performed_at) })),
      pbs: list(m.recent_pbs).map((p) => ({ exercise: str(p.exercise_name), value: String(p.value ?? ''), unit: str(p.unit), at: str(p.achieved_at) })),
    })),
    challenges: list(j.challenges).map((c) => ({
      id: str(c.id), name: str(c.name), activity: str(c.activity_name), metric: str(c.metric_type), unit: str(c.unit) || UNITS[str(c.metric_type) as Metric] || '',
      lowerWins: c.comparison_direction === 'lower', endsAt: typeof c.ends_at === 'string' ? c.ends_at : null,
      entries: list(c.entries).map((e) => ({ userId: str(e.user_id), name: str(e.name, 'Member'), value: num(e.value), note: str(e.note) })),
    })),
  };
}

export function parsePreview(json: unknown): InvitePreview {
  const j = obj(json);
  return { id: str(j.id), name: str(j.name), description: str(j.description), memberCount: num(j.member_count), ownerName: str(j.owner_name, 'a member'), alreadyMember: j.already_member === true };
}

export const NAME_MIN = 2;
export const NAME_MAX = 80;
export const CHALLENGE_NAME_MAX = 100;

export function validateGroup(name: string): { ok: true; name: string } | { ok: false; message: string } {
  const n = name.trim();
  if (n.length < NAME_MIN) return { ok: false, message: 'Add a group name (at least 2 letters).' };
  if (n.length > NAME_MAX) return { ok: false, message: `Keep the group name to ${NAME_MAX} letters or fewer.` };
  return { ok: true, name: n };
}

export function validateChallenge(name: string, activity: string): { ok: true; name: string; activity: string } | { ok: false; message: string } {
  const n = name.trim();
  const a = activity.trim();
  if (n.length < NAME_MIN || a === '') return { ok: false, message: 'Add a challenge name and an activity.' };
  if (n.length > CHALLENGE_NAME_MAX) return { ok: false, message: `Keep the challenge name to ${CHALLENGE_NAME_MAX} letters or fewer.` };
  return { ok: true, name: n, activity: a };
}

/** A result must be a real number. */
export function parseResult(text: string): number | null {
  const t = text.trim();
  if (t === '') return null;
  const v = Number(t);
  return Number.isFinite(v) ? v : null;
}

/** The invite link members share: back to this app, on the join screen, carrying the code. */
export function inviteLink(origin: string, basePath: string, code: string): string {
  return `${origin}${basePath.replace(/\/$/, '')}/m/groups/join?code=${encodeURIComponent(code)}`;
}

/** Best result first. Ties share a place (1, 1, 3). */
export function rankEntries(entries: Entry[], lowerWins: boolean): (Entry & { rank: number })[] {
  const sorted = [...entries].sort((a, b) => (lowerWins ? a.value - b.value : b.value - a.value));
  let rank = 0;
  return sorted.map((e, i) => {
    if (i === 0 || e.value !== sorted[i - 1]?.value) rank = i + 1;
    return { ...e, rank };
  });
}
