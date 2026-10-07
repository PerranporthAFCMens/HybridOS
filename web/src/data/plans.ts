import { supabase } from './client';

export interface PlanRow {
  id: string;
  name: string;
  priceInPence: number;
  interval: string;
  accessType: string;
  isActive: boolean;
}

export async function listPlans(gymId: string): Promise<PlanRow[]> {
  const { data, error } = await supabase
    .from('membership_plans')
    .select('id, name, price_pence, billing_interval, access_type, is_active')
    .eq('gym_id', gymId)
    .order('price_pence');
  if (error) throw error;
  return (data ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    priceInPence: p.price_pence,
    interval: p.billing_interval,
    accessType: p.access_type,
    isActive: p.is_active,
  }));
}
