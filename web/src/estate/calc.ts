import { monthlyValue, money } from '../today/calc';
import { table, type TableContext } from '../reports/calc';
import type { ReportTable } from '../reports/download';
import type { GymRole } from '../data/memberships';

/** Raw rows for every gym the person runs, as the data layer returns them. */
export interface EstateInput {
  gyms: { gymId: string; gymName: string }[];
  people: { gymId: string; role: GymRole; joinedAt: string }[];
  memberships: { gymId: string; planId: string }[];
  plans: { id: string; priceInPence: number; interval: string }[];
}

export interface GymFigures { gymId: string; gymName: string; members: number; activeMemberships: number; monthlyIncome: number; newMembers: number; staff: number }
export interface Estate { gyms: GymFigures[]; total: Omit<GymFigures, 'gymId' | 'gymName'> }

export const NEW_MEMBER_DAYS = 30;
const STAFF_ROLES: readonly GymRole[] = ['owner', 'admin', 'staff', 'coach'];

/** Only owners and admins may see across gyms, and only when they run more than one. */
export function runsEstate(gyms: { role: GymRole }[]): boolean {
  return gyms.filter((g) => g.role === 'owner' || g.role === 'admin').length >= 2;
}

/** The gyms where this person is an owner or admin (the only ones the estate view covers). */
export function estateGyms<T extends { role: GymRole }>(gyms: T[]): T[] {
  return gyms.filter((g) => g.role === 'owner' || g.role === 'admin');
}

export function buildEstate(input: EstateInput, now: Date): Estate {
  const since = new Date(now.getTime() - NEW_MEMBER_DAYS * 86_400_000);
  const price = new Map(input.plans.map((p) => [p.id, monthlyValue(p.priceInPence, p.interval)]));
  const gyms = input.gyms.map((g): GymFigures => {
    const people = input.people.filter((p) => p.gymId === g.gymId);
    const active = input.memberships.filter((m) => m.gymId === g.gymId);
    const members = people.filter((p) => p.role === 'member');
    return {
      gymId: g.gymId,
      gymName: g.gymName,
      members: members.length,
      activeMemberships: active.length,
      monthlyIncome: Math.round(active.reduce((n, m) => n + (price.get(m.planId) ?? 0), 0)),
      newMembers: members.filter((p) => new Date(p.joinedAt) >= since).length,
      staff: people.filter((p) => STAFF_ROLES.includes(p.role)).length,
    };
  });
  const sum = (f: (g: GymFigures) => number) => gyms.reduce((n, g) => n + f(g), 0);
  return { gyms, total: { members: sum((g) => g.members), activeMemberships: sum((g) => g.activeMemberships), monthlyIncome: sum((g) => g.monthlyIncome), newMembers: sum((g) => g.newMembers), staff: sum((g) => g.staff) } };
}

export function estateTable(ctx: Omit<TableContext, 'rangeLabel'>, e: Estate): ReportTable {
  const rows = e.gyms.map((g) => [g.gymName, g.members, g.activeMemberships, money(g.monthlyIncome), g.newMembers, g.staff]);
  rows.push(['All gyms', e.total.members, e.total.activeMemberships, money(e.total.monthlyIncome), e.total.newMembers, e.total.staff]);
  return table({ ...ctx, rangeLabel: `New members: last ${NEW_MEMBER_DAYS} days` }, 'Estate overview', ['Gym', 'Members', 'Active memberships', 'Estimated monthly income', 'New members', 'Team'], rows);
}
