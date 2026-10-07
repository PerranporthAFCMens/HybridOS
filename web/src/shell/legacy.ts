/** Links into the old pages, which still run inside the old persistent Admin shell until each screen moves. */
export function legacyAdminUrl(file: string, hash = ''): string {
  return `../admin.html?view=${encodeURIComponent(file + (hash ? `#${hash}` : ''))}`;
}

export const legacyRoutes = {
  members: legacyAdminUrl('index.html', 'members'),
  plans: legacyAdminUrl('index.html', 'memberships'),
  channels: legacyAdminUrl('index.html', 'community'),
  classes: legacyAdminUrl('classes.html'),
  'class-setup': legacyAdminUrl('class-setup.html'),
  communications: legacyAdminUrl('communications.html'),
  community: legacyAdminUrl('community.html'),
  reports: legacyAdminUrl('reporting.html'),
  settings: legacyAdminUrl('admin-operations.html', 'staff'),
} as const;

export type LegacyRoute = keyof typeof legacyRoutes;
