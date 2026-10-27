import { LIBRARY, type LibraryReport } from './library';

/** The screens that are not a single library table. Each opens its own report page. */
export type PaneKey = 'memberships' | 'classes' | 'members' | 'payments' | 'owed' | 'xero' | 'builder';

export interface ListEntry { key: string; title: string; blurb: string }
export interface ListGroup { group: string; entries: ListEntry[] }

const PANES: Record<PaneKey, ListEntry> = {
  payments: { key: 'payments', title: 'Payments overview', blurb: 'What came in, what failed, and who to chase.' },
  owed: { key: 'owed', title: 'Money owed', blurb: 'Members with failed payments, with the amount and since when.' },
  xero: { key: 'xero', title: 'Accounting (Xero)', blurb: 'Download payments in the format your accountant or Xero wants.' },
  memberships: { key: 'memberships', title: 'Memberships overview', blurb: 'Plans, active members and monthly income.' },
  members: { key: 'members', title: 'Members overview', blurb: 'Who is active, who attends and who is slipping.' },
  classes: { key: 'classes', title: 'Classes overview', blurb: 'How full classes are, the busiest slots and class income.' },
  builder: { key: 'builder', title: 'Report builder', blurb: 'Make and save your own report from any list of data.' },
};

const libraryEntries = (group: string): ListEntry[] =>
  (LIBRARY.find((g) => g.group === group)?.reports ?? []).map((r) => ({ key: r.key, title: r.title, blurb: r.description }));

/** The one list: every report, grouped by the question it answers. */
export const REPORT_LIST: ListGroup[] = [
  { group: 'Money', entries: [PANES.payments, PANES.owed, PANES.xero, ...libraryEntries('Revenue & payments')] },
  { group: 'Members', entries: [PANES.memberships, PANES.members, ...libraryEntries('Membership & growth'), ...libraryEntries('Lifecycle & retention')] },
  { group: 'Classes', entries: [PANES.classes, ...libraryEntries('Classes & attendance')] },
  { group: 'Coaches and training', entries: libraryEntries('Workouts & PT') },
  { group: 'Your own', entries: [PANES.builder] },
];

export const isPane = (key: string): key is PaneKey => key in PANES;

export function findEntry(key: string): ListEntry | null {
  for (const g of REPORT_LIST) for (const e of g.entries) if (e.key === key) return e;
  return null;
}

export function findLibraryReport(key: string): LibraryReport | null {
  for (const g of LIBRARY) for (const r of g.reports) if (r.key === key) return r;
  return null;
}

/** Old links used `?tab=`; map them to the new report keys. Anything unknown means the home page. */
export function legacyKey(tab: string | null): string {
  if (!tab || tab === 'summary' || tab === 'overview' || tab === 'workouts') return '';
  return tab;
}
