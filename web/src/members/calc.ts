import type { MemberRow } from '../data/members';

// Pure rules behind the Members screen. Same behaviour as the legacy directory.

export type SortMode = 'first' | 'surname' | 'registered_desc' | 'registered_asc';

export function nameOf(m: Pick<MemberRow, 'displayName' | 'firstName' | 'lastName'>): string {
  return m.displayName || [m.firstName, m.lastName].filter(Boolean).join(' ') || 'Member';
}

export function nameParts(m: Pick<MemberRow, 'displayName' | 'firstName' | 'lastName'>): { first: string; surname: string } {
  const fallback = nameOf(m).trim().split(/\s+/);
  return {
    first: (m.firstName || fallback[0] || '').trim(),
    surname: (m.lastName || fallback.slice(1).join(' ') || '').trim(),
  };
}

export function jumpLetter(m: MemberRow, mode: SortMode): string {
  const p = nameParts(m);
  const base = mode === 'surname' ? p.surname || p.first : p.first || p.surname;
  return (base || '#').charAt(0).toUpperCase();
}

function sortKey(m: MemberRow, mode: SortMode): string | number {
  const p = nameParts(m);
  if (mode === 'surname') return (p.surname || p.first || nameOf(m)).toLocaleLowerCase();
  if (mode === 'registered_asc' || mode === 'registered_desc') return new Date(m.joinedAt || 0).getTime();
  return (p.first || nameOf(m)).toLocaleLowerCase();
}

export function filterAndSort(rows: MemberRow[], opts: { search: string; sort: SortMode; letter: string }): MemberRow[] {
  const search = opts.search.trim().toLocaleLowerCase();
  const out = rows.filter((m) => {
    const p = nameParts(m);
    const hay = [nameOf(m), p.first, p.surname].join(' ').toLocaleLowerCase();
    const letterOk = !opts.letter || jumpLetter(m, opts.sort) === opts.letter;
    return (!search || hay.includes(search)) && letterOk;
  });
  return out.sort((a, b) => {
    const ka = sortKey(a, opts.sort);
    const kb = sortKey(b, opts.sort);
    if (opts.sort === 'registered_desc') return Number(kb) - Number(ka);
    if (opts.sort === 'registered_asc') return Number(ka) - Number(kb);
    return String(ka).localeCompare(String(kb), undefined, { sensitivity: 'base' });
  });
}

export function availableLetters(rows: MemberRow[], mode: SortMode): Set<string> {
  return new Set(rows.map((m) => jumpLetter(m, mode)));
}

export function summaryText(shown: number, total: number): string {
  return shown === total ? `${total} gym users` : `${shown} of ${total} gym users`;
}

export function initials(name: string): string {
  return (name || 'H').split(/\s+/).slice(0, 2).map((x) => x[0] ?? '').join('').toUpperCase();
}

export function labelStatus(status: string | null | undefined): string {
  return String(status || 'pending').replaceAll('_', ' ');
}

export function formatRegistered(d: string | null | undefined): string {
  if (!d) return 'Unknown';
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(d));
}

export function formatDate(d: string | null | undefined): string {
  if (!d) return '—';
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(`${d}T00:00:00`));
}

/** Local YYYY-MM-DD for a date input. */
export function dateInputValue(v: string | null | undefined): string {
  if (!v) return '';
  const d = new Date(v);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function validateLifecycle(joined: string, attrition: string): string | null {
  if (!joined) return 'Joined date is required.';
  if (attrition && attrition < joined) return 'Attrition cannot be before joined date.';
  return null;
}

export function paymentHint(payment: 'manual' | 'gocardless'): string {
  return payment === 'gocardless'
    ? 'Creates the HybridOne membership now and leaves payment pending until a GoCardless mandate/subscription is linked.'
    : 'Manual mode lets the gym use HybridOne before GoCardless is connected.';
}
