import { siteUrl } from '../app/site';
import type { GymAccess } from '../data/memberships';
import { homeFor } from './access';

/** Where a person lands for one gym: owners and admins in the new admin, staff and coaches in the staff app, members in the member app. */
export function landingFor(gym: GymAccess): string {
  const home = homeFor(gym.role);
  return home === 'admin' ? siteUrl('today') : home;
}

/**
 * A return address is only followed when it stays on this site, inside the app, and is not a sign-in page.
 * Anything else is ignored so a crafted link cannot send a person elsewhere.
 */
export function safeReturn(raw: string | null, origin: string, siteRoot: string): string {
  if (!raw) return '';
  let target: URL;
  try {
    target = new URL(raw, origin);
  } catch {
    return '';
  }
  if (target.origin !== origin || !target.pathname.startsWith(siteRoot)) return '';
  const leaf = target.pathname.split('/').pop() ?? '';
  if (['login.html', 'choose-gym.html', 'auth-return.html', 'sign-out.html', 'sign-in', 'choose-gym'].includes(leaf)) return '';
  return `${target.pathname}${target.search}${target.hash}`;
}

/** Where the link in an email opens. Still the classic page until that screen moves. */
export function authReturnUrl(mode: 'recovery' | 'magic'): string {
  return `${window.location.origin}${siteUrl('auth-return.html')}?mode=${mode}`;
}
