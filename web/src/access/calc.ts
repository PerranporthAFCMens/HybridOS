// Pure rules behind Access levels: the permission list (same keys as the old Staff access page), what a
// level is called, what a valid form looks like, and how a save keeps permissions the screen does not know.

export const PERMISSIONS: { key: string; label: string; text: string }[] = [
  { key: 'full_access', label: 'Admin workspace', text: 'Allow this level into the full admin workspace. Individual restrictions below still apply.' },
  { key: 'view_timetable', label: 'View full timetable', text: 'See the gym-wide class timetable.' },
  { key: 'create_classes', label: 'Create classes', text: 'Add classes to the timetable.' },
  { key: 'edit_timetable', label: 'Edit timetable', text: 'Change scheduled classes.' },
  { key: 'cancel_classes', label: 'Cancel classes', text: 'Cancel scheduled classes.' },
  { key: 'mark_attendance', label: 'Mark attendance', text: 'Mark booked members attended or no-show.' },
  { key: 'view_member_contact', label: 'View member contact details', text: 'See member contact information where available.' },
  { key: 'view_memberships', label: 'View memberships', text: 'See member plans and membership state.' },
  { key: 'manage_memberships', label: 'Manage memberships', text: 'Change membership records.' },
  { key: 'view_reporting', label: 'View reporting', text: 'Open business and attendance reports.' },
  { key: 'manage_resources', label: 'Manage rooms and resources', text: 'Edit rooms, areas and equipment.' },
  { key: 'manage_staff', label: 'Manage staff and access', text: 'Change staff setup and staff access. This lets them change who can do what.' },
  { key: 'view_own_pay', label: 'View own pay', text: 'See their own pay rate only.' },
  { key: 'view_member_notes', label: 'View member notes', text: 'See coaching and member notes.' },
  { key: 'moderate_community', label: 'Moderate community', text: 'Manage community content.' },
];

export type Permissions = Record<string, boolean>;

/** Only an owner may create, change or delete a level (the database enforces the same). */
export const canEditLevels = (role: string) => role === 'owner';

/** Reads the stored permissions JSON safely: only real true/false values count. */
export function readPermissions(raw: unknown): Permissions {
  const out: Permissions = {};
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    for (const [k, v] of Object.entries(raw)) if (typeof v === 'boolean') out[k] = v;
  }
  return out;
}

/** Ticked permissions in the form, plus every key the screen does not list left exactly as it was stored. */
export function mergePermissions(stored: Permissions, ticked: Set<string>): Permissions {
  const known = new Set(PERMISSIONS.map((p) => p.key));
  const out: Permissions = {};
  for (const [k, v] of Object.entries(stored)) if (!known.has(k)) out[k] = v;
  for (const p of PERMISSIONS) out[p.key] = ticked.has(p.key);
  return out;
}

export const tickedKeys = (p: Permissions): Set<string> => new Set(PERMISSIONS.filter((d) => p[d.key] === true).map((d) => d.key));

export function permissionSummary(p: Permissions): string {
  const n = tickedKeys(p).size;
  return n === 0 ? 'No permissions' : `${n} of ${PERMISSIONS.length} permissions`;
}

export interface LevelForm { name: string; description: string; ticked: string[] }
export type LevelCheck = { ok: true; name: string; description: string | null } | { ok: false; message: string };

export function validateLevel(f: LevelForm, others: { id: string; name: string }[], selfId: string | null): LevelCheck {
  const name = f.name.trim();
  if (!name) return { ok: false, message: 'Give this access level a name.' };
  if (name.length > 80) return { ok: false, message: 'The name can be up to 80 characters.' };
  if (f.description.trim().length > 280) return { ok: false, message: 'The description can be up to 280 characters.' };
  if (others.some((o) => o.id !== selfId && o.name.trim().toLowerCase() === name.toLowerCase())) return { ok: false, message: `There is already an access level called ${name}.` };
  return { ok: true, name, description: f.description.trim() || null };
}

/** Why a level cannot be deleted yet, or null when it can. */
export function deleteBlocker(assigned: number): string | null {
  return assigned > 0 ? `Move ${assigned} staff member${assigned === 1 ? '' : 's'} to another level before deleting this one.` : null;
}
