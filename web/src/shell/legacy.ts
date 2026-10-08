/** Links into the old pages, which still run inside the old persistent Admin shell until each screen moves. */
export function legacyAdminUrl(file: string, hash = ''): string {
  return `../admin.html?view=${encodeURIComponent(file + (hash ? `#${hash}` : ''))}`;
}

export const legacyRoutes = {
  channels: legacyAdminUrl('index.html', 'community'),
  reports: legacyAdminUrl('reporting.html'),
  layout: legacyAdminUrl('gym-layout.html'),
} as const;

export type LegacyRoute = keyof typeof legacyRoutes;

/** Screens already moved to the new app (hash routes). */
export const appLinks = { members: '#/members', plans: '#/plans', classes: '#/classes', staff: '#/staff', access: '#/access', owners: '#/owners', community: '#/community', communications: '#/communications', door: '#/door', 'member-view': '#/member-view', resources: '#/rooms', settings: '#/settings', 'class-setup': '#/class-setup' } as const;

/** Every link target a screen may use: moved screens first, old pages for the rest. */
export const links = { ...legacyRoutes, ...appLinks } as const;

export type LinkKey = keyof typeof links;
