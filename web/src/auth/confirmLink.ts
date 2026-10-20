/** Link types an email can carry. Anything else is refused. */
export const CONFIRM_TYPES = ['invite', 'recovery', 'email_change', 'signup', 'magiclink', 'email'] as const;
export type ConfirmType = (typeof CONFIRM_TYPES)[number];

export interface ConfirmParams {
  tokenHash: string;
  type: ConfirmType;
  /** Where to go once the link is confirmed: always an address on this site. */
  next: string;
}

/**
 * Reads the address of an email link that opens on our own domain (/auth-confirm?token_hash=...&type=...&next=...).
 * Returns null when the token or type is missing or wrong. `next` is only followed when it stays on this site and is not
 * the confirm page itself, so a crafted link cannot send a person elsewhere; otherwise they land on the return page.
 */
export function parseConfirmParams(search: string, origin: string): ConfirmParams | null {
  const params = new URLSearchParams(search);
  const tokenHash = (params.get('token_hash') ?? '').trim();
  const type = params.get('type') ?? '';
  if (!tokenHash || !(CONFIRM_TYPES as readonly string[]).includes(type)) return null;
  return { tokenHash, type: type as ConfirmType, next: safeNext(params.get('next'), origin) };
}

function safeNext(raw: string | null, origin: string): string {
  const fallback = '/auth-return';
  if (!raw) return fallback;
  let target: URL;
  try {
    target = new URL(raw, origin);
  } catch {
    return fallback;
  }
  if (target.origin !== origin || target.pathname.replace(/\/+$/, '') === '/auth-confirm') return fallback;
  return `${target.pathname}${target.search}${target.hash}`;
}
