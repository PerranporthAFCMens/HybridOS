// Plan terms in words, and the warnings the plan editor shows. The database holds the numbers; this is only how they read.
// A term is a number of months a member is committed for; notice is the number of days they give to leave. Blank (null) means
// "use the gym-wide setting". Any values are allowed: the warnings never block saving.

export const MAX_TERM_MONTHS = 60;
export const MAX_NOTICE_DAYS = 365;

export const termText = (months: number): string => (months <= 0 ? 'No minimum term' : months === 1 ? '1 month' : `${months} months`);

/** 30 days reads as "1 month", 14 as "2 weeks", anything else in days. */
export function noticeText(days: number): string {
  if (days <= 0) return 'no notice';
  if (days % 30 === 0) return days === 30 ? '1 month' : `${days / 30} months`;
  if (days % 7 === 0) return days === 7 ? '1 week' : `${days / 7} weeks`;
  return days === 1 ? '1 day' : `${days} days`;
}

/** "6 months minimum · 2 weeks' notice to leave". Empty when the plan has no terms of its own. */
export function termsSentence(term: number | null | undefined, notice: number | null | undefined): string {
  const parts: string[] = [];
  if (term !== null && term !== undefined) parts.push(term > 0 ? `${termText(term)} minimum` : 'No minimum term');
  if (notice !== null && notice !== undefined) parts.push(notice > 0 ? `${noticeText(notice)} notice to leave` : 'Cancel any time');
  return parts.join(' · ');
}

/** Gentle warnings for long terms. They explain the risk and never stop the gym saving what it chose. */
export function termWarnings(term: number | null, notice: number | null): string[] {
  const out: string[] = [];
  if (term !== null && term > 12) out.push('A minimum term of more than 12 months can be treated as unfair to consumers under UK guidance. You can still save it, but check it is right for your gym.');
  if (notice !== null && notice > 30) out.push('More than a month of notice can also be treated as unfair under UK guidance. You can still save it, but check it is right for your gym.');
  return out;
}

/** A whole number from min to max, or null for blank. 'bad' when it is anything else. */
export function parseWhole(text: string, min: number, max: number): number | null | 'bad' {
  const t = text.trim();
  if (t === '') return null;
  if (!/^\d+$/.test(t)) return 'bad';
  const n = Number(t);
  return n >= min && n <= max ? n : 'bad';
}
