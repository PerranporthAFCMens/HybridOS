// Pure rules behind "What members see": which tiles the member home shows and in what order, and the gym's
// call-to-action panel. Same stored shape as the old page (the member portal reads it unchanged).

export const TILES: Record<string, { label: string; desc: string }> = {
  goal: { label: 'Training goal', desc: 'Weekly goal and progress ring' },
  progress: { label: 'Training snapshot', desc: 'Workouts, PBs and latest PB' },
  activity: { label: 'Recent activity', desc: 'Recent workouts and personal bests' },
  hero: { label: 'Training hub', desc: 'Primary member actions' },
  upcoming_count: { label: 'Upcoming bookings', desc: 'Booked class count' },
  next_classes: { label: 'Next classes', desc: 'Upcoming class cards' },
  membership: { label: 'Membership', desc: 'Current membership summary' },
  booked_classes: { label: 'My booked classes', desc: 'Member class bookings' },
  pt: { label: 'PT appointments', desc: 'Upcoming PT sessions' },
};

export interface TileSetting { key: string; visible: boolean }

export const DEFAULT_LAYOUT: TileSetting[] = ['next_classes', 'goal', 'progress', 'activity', 'upcoming_count', 'hero', 'membership', 'booked_classes', 'pt'].map((key) => ({ key, visible: true }));

/** Stored layout made safe: unknown or repeated tiles dropped, missing tiles added at the end (visible). */
export function normaliseLayout(raw: unknown): TileSetting[] {
  const out: TileSetting[] = [];
  if (Array.isArray(raw)) {
    for (const x of raw) {
      const key = x && typeof x === 'object' ? (x as { key?: unknown }).key : undefined;
      if (typeof key === 'string' && key in TILES && !out.some((o) => o.key === key)) out.push({ key, visible: (x as { visible?: unknown }).visible !== false });
    }
  }
  for (const d of DEFAULT_LAYOUT) if (!out.some((o) => o.key === d.key)) out.push({ ...d });
  return out;
}

export function moveTile(layout: TileSetting[], key: string, by: -1 | 1): TileSetting[] {
  const i = layout.findIndex((t) => t.key === key);
  const j = i + by;
  if (i < 0 || j < 0 || j >= layout.length) return layout;
  const next = layout.slice();
  const a = next[i];
  const b = next[j];
  if (!a || !b) return layout;
  next[i] = b;
  next[j] = a;
  return next;
}

export const setVisible = (layout: TileSetting[], key: string, visible: boolean): TileSetting[] => layout.map((t) => (t.key === key ? { ...t, visible } : t));

export const TARGETS: [string, string][] = [['classes', 'Classes'], ['workouts', 'Workouts'], ['pbs', 'PBs'], ['membership', 'Membership'], ['community', 'Community'], ['external', 'External link']];

export interface Cta {
  enabled: boolean; eyebrow: string; title: string; body: string;
  primary_label: string; primary_target: string; primary_url: string;
  secondary_label: string; secondary_target: string; secondary_url: string;
}

export const DEFAULT_CTA: Cta = {
  enabled: true, eyebrow: 'YOUR TRAINING HUB', title: 'Keep your training moving',
  body: 'Track your week, log workouts and keep your progress in one place.',
  primary_label: 'Log workout', primary_target: 'workouts', primary_url: '',
  secondary_label: 'View classes', secondary_target: 'classes', secondary_url: '',
};

/** Stored settings over the defaults; only real strings and booleans are accepted. */
export function normaliseCta(raw: unknown): Cta {
  const out: Cta = { ...DEFAULT_CTA };
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const r = raw as Record<string, unknown>;
    for (const k of Object.keys(DEFAULT_CTA) as (keyof Cta)[]) {
      if (k === 'enabled') { if (typeof r[k] === 'boolean') out.enabled = r[k]; } else if (typeof r[k] === 'string') out[k] = r[k];
    }
  }
  return out;
}

const isSecureUrl = (s: string) => {
  try { return new URL(s).protocol === 'https:'; } catch { return false; }
};

export type CtaCheck = { ok: true; cta: Cta } | { ok: false; message: string };

/** Lengths as before; an external link must be a full https address (the old page accepted any address, including ones that run code). */
export function validateCta(c: Cta): CtaCheck {
  const t = (s: string) => s.trim();
  const cta: Cta = { ...c, eyebrow: t(c.eyebrow), title: t(c.title), body: t(c.body), primary_label: t(c.primary_label), primary_url: t(c.primary_url), secondary_label: t(c.secondary_label), secondary_url: t(c.secondary_url) };
  if (cta.eyebrow.length > 60) return { ok: false, message: 'The small label can be up to 60 characters.' };
  if (cta.title.length > 120) return { ok: false, message: 'The headline can be up to 120 characters.' };
  if (cta.body.length > 300) return { ok: false, message: 'The supporting text can be up to 300 characters.' };
  if (cta.primary_label.length > 40 || cta.secondary_label.length > 40) return { ok: false, message: 'Button labels can be up to 40 characters.' };
  if (cta.primary_target === 'external' && !isSecureUrl(cta.primary_url)) return { ok: false, message: 'The first button needs a full link starting with https://.' };
  if (cta.secondary_target === 'external' && !isSecureUrl(cta.secondary_url)) return { ok: false, message: 'The second button needs a full link starting with https://.' };
  if (cta.primary_target !== 'external') cta.primary_url = '';
  if (cta.secondary_target !== 'external') cta.secondary_url = '';
  return { ok: true, cta };
}

/** The tile title shown in the preview: the hub tile shows the gym's headline. */
export const tileTitle = (key: string, cta: Cta) => (key === 'hero' ? cta.title.trim() || TILES[key]?.label || key : TILES[key]?.label ?? key);
