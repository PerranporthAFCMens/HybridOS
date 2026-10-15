import { supabase } from './client';
import type { GymAccess } from './memberships';
import type { EstateInput } from '../estate/calc';

const PAGE = 1000;

/** Reads past the 1000-row limit by asking for the next page until one comes back short. */
async function every<T>(page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await page(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    out.push(...(data ?? []));
    if ((data?.length ?? 0) < PAGE) return out;
  }
}

/**
 * The raw rows for the estate view. Plain reads under the person's own access in each gym, so a gym they do not
 * run is simply absent: nothing here can show them more than they could already see one gym at a time.
 */
export async function loadEstate(gyms: Pick<GymAccess, 'gymId' | 'gymName'>[]): Promise<EstateInput> {
  const ids = gyms.map((g) => g.gymId);
  const [people, memberships, plans] = await Promise.all([
    every((f, t) => supabase.from('gym_members').select('gym_id, role, joined_at').in('gym_id', ids).eq('is_active', true).eq('access_status', 'active').order('user_id').range(f, t)),
    every((f, t) => supabase.from('memberships').select('gym_id, plan_id').in('gym_id', ids).eq('status', 'active').order('id').range(f, t)),
    every((f, t) => supabase.from('membership_plans').select('id, price_pence, billing_interval').in('gym_id', ids).order('id').range(f, t)),
  ]);
  return {
    gyms: gyms.map((g) => ({ gymId: g.gymId, gymName: g.gymName })),
    people: people.map((p) => ({ gymId: p.gym_id, role: p.role, joinedAt: p.joined_at })),
    memberships: memberships.map((m) => ({ gymId: m.gym_id, planId: m.plan_id ?? '' })),
    plans: plans.map((p) => ({ id: p.id, priceInPence: p.price_pence, interval: p.billing_interval })),
  };
}
