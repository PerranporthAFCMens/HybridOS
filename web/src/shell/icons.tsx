import type { ReactElement } from 'react';
import type { IconName } from './menu';

/** The same line icons the old admin shell draws (shared-shell.js), so both menus look alike. */
const PATHS: Record<IconName, ReactElement> = {
  home: <><path d="M3 11.5 12 4l9 7.5" /><path d="M5 10.5V20h5v-5h4v5h5v-9.5" /></>,
  members: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
  profile: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
  classes: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18" /></>,
  community: <><path d="M21 15a4 4 0 0 1-4 4H8l-5 3 1.6-4.8A7 7 0 0 1 3 12c0-4 3.6-7 8-7h3c4.4 0 8 3 8 7 0 1.1-.3 2.1-1 3z" /><path d="M8 12h.01M12 12h.01M16 12h.01" /></>,
  reporting: <><path d="M4 19V9M10 19V5M16 19v-7M22 19V3" /><path d="M2 21h22" /></>,
  admin: <><path d="M12 3 4 7v5c0 5 3.4 8.6 8 10 4.6-1.4 8-5 8-10V7l-8-4z" /><path d="M9 12h6M12 9v6" /></>,
  staff: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></>,
};

export function Icon({ name }: { name: IconName }) {
  return <svg className="nav-icon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">{PATHS[name]}</svg>;
}
