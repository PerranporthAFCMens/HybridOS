import type { GymRole } from '../data/memberships';
import type { ProfileNames } from '../data/profile';

/** Full name for the menu: profile display name, else first and last name, else the part of the email before the @. */
export function fullName(names: ProfileNames | undefined, email: string): string {
  const joined = [names?.firstName, names?.lastName].filter(Boolean).join(' ');
  return names?.displayName?.trim() || joined || email.split('@')[0] || '';
}

const ROLE_LABELS: Record<GymRole, string> = {
  owner: 'Owner',
  admin: 'Admin',
  staff: 'Staff',
  coach: 'Coach',
  member: 'Member',
};

/** The person's position in the selected gym, in plain words. */
export function roleLabel(role: GymRole): string {
  return ROLE_LABELS[role];
}
