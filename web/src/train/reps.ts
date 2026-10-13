// Reps a coach can set as a target: a number (10), a range (8-12) or "max" (as many as you can; AMRAP means the same). The member's
// own box always takes the number they actually did, so a range or "max" is a suggestion, never filled in for them.

export type RepsTarget = { kind: 'count'; n: number } | { kind: 'range'; min: number; max: number } | { kind: 'max' };

const RANGE = /^(\d{1,3})\s*(?:-|–|—|to)\s*(\d{1,3})$/i;

/** What a reps box says, or null when it is none of those (or a range that does not make sense). */
export function parseRepsTarget(text: string | undefined): RepsTarget | null {
  const t = (text ?? '').trim();
  if (!t) return null;
  if (/^(max|amrap)$/i.test(t)) return { kind: 'max' };
  if (/^\d{1,3}$/.test(t)) return { kind: 'count', n: Number(t) };
  const r = RANGE.exec(t);
  if (!r) return null;
  const min = Number(r[1]);
  const max = Number(r[2]);
  return min >= 1 && max > min ? { kind: 'range', min, max } : null;
}

/** True for a range or "max": a target the member cannot simply copy into their box. */
export function isRepsTarget(text: string | undefined): boolean {
  const k = parseRepsTarget(text)?.kind;
  return k === 'range' || k === 'max';
}

/** Typed like a range ("12-8", "8-", "5 to x") but not one that works. */
const looksLikeRange = (t: string) => /\d\s*(?:-|–|—)|(?:-|–|—)\s*\d|\bto\b/i.test(t);

/** An error in words for a reps box that is neither a number nor a good range nor max, or null when it is fine (or an ordinary number to check elsewhere). */
export function repsError(text: string | undefined): string | null {
  const t = (text ?? '').trim();
  if (!t || parseRepsTarget(t) !== null) return null;
  return looksLikeRange(t) ? `"${t}" is not a range of reps. Type it like 8-12, with the smaller number first.` : null;
}

/** The reps as the member reads them: "10", "8–12", "max". */
export function repsText(text: string | undefined): string {
  const r = parseRepsTarget(text);
  if (!r) return (text ?? '').trim();
  if (r.kind === 'range') return `${r.min}–${r.max}`;
  if (r.kind === 'max') return 'max';
  return String(r.n);
}
