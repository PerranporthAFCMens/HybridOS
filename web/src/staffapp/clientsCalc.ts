/** Rules for the PT's "My clients" list. Plain functions, unit tested. */
export interface ClientSummary {
  userId: string;
  name: string;
  /** Workouts the PT set that the client has not finished. */
  waiting: number;
  /** Finished workouts the PT set that nobody has replied to. */
  needsReply: number;
  pain: boolean;
  /** The last time the client finished a workout the PT set. */
  lastDoneAt: string | null;
  /** The last time the PT set them a workout. */
  lastSetAt: string | null;
}

const DAY = 86400000;
export const daysBetween = (iso: string, now: Date): number => Math.max(0, Math.floor((now.getTime() - new Date(iso).getTime()) / DAY));

const ago = (days: number): string => (days === 0 ? 'today' : days === 1 ? 'yesterday' : days < 14 ? `${days} days ago` : `${Math.floor(days / 7)} weeks ago`);

/** The one line under a client's name: what needs the PT, or else how things stand. */
export function clientLine(c: ClientSummary, now: Date): string {
  if (c.needsReply > 0) return `Finished a workout${c.needsReply > 1 ? ` (${c.needsReply})` : ''}, needs your reply${c.pain ? '. Pain noted' : ''}`;
  if (c.waiting > 0) return c.waiting === 1 ? '1 workout waiting for them' : `${c.waiting} workouts waiting for them`;
  const latest = [c.lastDoneAt, c.lastSetAt].filter((x): x is string => !!x).sort().pop();
  if (!latest) return 'Nothing set yet';
  const days = daysBetween(latest, now);
  if (days >= 14) return `Quiet for ${Math.floor(days / 7)} weeks`;
  return c.lastDoneAt && c.lastDoneAt >= latest ? `Last workout ${ago(days)}` : `Last set ${ago(days)}`;
}

/** Clients who need the PT first, then the rest by name. */
export function sortClients(list: ClientSummary[]): ClientSummary[] {
  return [...list].sort((a, b) => Number(b.needsReply > 0) - Number(a.needsReply > 0) || a.name.localeCompare(b.name, 'en-GB', { sensitivity: 'base' }));
}

/** The members still to add: everyone who is not already a client, filtered by what was typed. */
export function addable(all: { userId: string; name: string }[], current: string[], self: string, typed: string): { userId: string; name: string }[] {
  const have = new Set(current);
  const t = typed.trim().toLowerCase();
  return all.filter((m) => m.userId !== self && !have.has(m.userId) && (t === '' || m.name.toLowerCase().includes(t)));
}
