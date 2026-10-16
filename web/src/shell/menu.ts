/**
 * The side menu, the same short list the old admin shell shows. Pages that used to have their own menu line
 * (Membership plans, Workout builder, Client training, Community, Communications) now sit under the line they belong to,
 * and show as tabs along the top of their page.
 */
export interface MenuPage { to: string; label: string }
export interface MenuGroup { key: string; label: string; icon: IconName; to: string; pages: MenuPage[] }
export type IconName = 'home' | 'members' | 'classes' | 'community' | 'reporting' | 'admin' | 'profile' | 'staff';

export const MENU: MenuGroup[] = [
  { key: 'today', label: 'Today', icon: 'home', to: '/today', pages: [{ to: '/today', label: 'Today' }] },
  { key: 'members', label: 'Members', icon: 'members', to: '/members', pages: [{ to: '/members', label: 'Members' }, { to: '/plans', label: 'Membership plans' }] },
  { key: 'classes', label: 'Classes and workouts', icon: 'classes', to: '/classes', pages: [{ to: '/classes', label: 'Classes' }, { to: '/workouts', label: 'Workout builder' }, { to: '/movements', label: 'Movements' }, { to: '/training', label: 'Client training' }] },
  { key: 'messages', label: 'Messages and community', icon: 'community', to: '/community', pages: [{ to: '/community', label: 'Community' }, { to: '/communications', label: 'Communications' }] },
  { key: 'reports', label: 'Reports', icon: 'reporting', to: '/reports', pages: [{ to: '/reports', label: 'Reports' }] },
];

export const SETTINGS_GROUP: MenuGroup = { key: 'settings', label: 'Settings and staff', icon: 'admin', to: '/settings', pages: [] };

const within = (pathname: string, to: string) => pathname === to || pathname.startsWith(`${to}/`);

/** Which menu line a page belongs to. Anything that is not under another line (door code, access levels, rooms…) is under Settings. */
export function groupFor(pathname: string): MenuGroup | null {
  if (pathname === '/m' || pathname.startsWith('/m/')) return null;
  return MENU.find((g) => g.pages.some((p) => within(pathname, p.to))) ?? SETTINGS_GROUP;
}

/** The tabs to show along the top of a page: only on the main page of a line that has more than one. */
export function tabsFor(pathname: string): MenuPage[] {
  const g = groupFor(pathname);
  if (!g || g.pages.length < 2) return [];
  return g.pages.some((p) => p.to === pathname) ? g.pages : [];
}
