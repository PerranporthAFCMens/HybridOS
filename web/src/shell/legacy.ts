/** Links into the old pages, which still run inside the old persistent Admin shell until each screen moves. */
export function legacyAdminUrl(file: string, hash = ''): string {
  return `../admin.html?view=${encodeURIComponent(file + (hash ? `#${hash}` : ''))}`;
}

export const legacyRoutes = {
  channels: legacyAdminUrl('index.html', 'community'),
  classes: legacyAdminUrl('classes.html'),
  'class-setup': legacyAdminUrl('class-setup.html'),
  communications: legacyAdminUrl('communications.html'),
  community: legacyAdminUrl('community.html'),
  reports: legacyAdminUrl('reporting.html'),
  settings: legacyAdminUrl('admin-operations.html', 'staff'),
} as const;

export type LegacyRoute = keyof typeof legacyRoutes;

/** Screens already moved to the new app (hash routes). */
export const appLinks = { members: '#/members', plans: '#/plans' } as const;

/** Every link target a screen may use: moved screens first, old pages for the rest. */
export const links = { ...legacyRoutes, ...appLinks } as const;

export type LinkKey = keyof typeof links;
