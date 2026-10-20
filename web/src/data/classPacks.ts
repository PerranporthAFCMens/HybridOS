import { supabase } from './client';

export interface PackType {
  id: string;
  name: string;
  credits: number;
  pricePence: number;
  /** How many days a pack lasts once it is made. null = never expires. */
  validDays: number | null;
  isActive: boolean;
}

/** What the form can change. Money is already in pence. */
export interface PackTypeInput {
  name: string;
  credits: number;
  pricePence: number;
  validDays: number | null;
}

export async function listPackTypes(gymId: string): Promise<PackType[]> {
  const { data, error } = await supabase
    .from('class_pack_types')
    .select('id, name, credits, price_pence, valid_days, is_active')
    .eq('gym_id', gymId)
    .order('created_at');
  if (error) throw error;
  return (data ?? []).map((t) => ({ id: t.id, name: t.name, credits: t.credits, pricePence: t.price_pence, validDays: t.valid_days, isActive: t.is_active }));
}

const toRow = (i: PackTypeInput) => ({ name: i.name, credits: i.credits, price_pence: i.pricePence, valid_days: i.validDays });

export async function createPackType(gymId: string, input: PackTypeInput): Promise<void> {
  const { error } = await supabase.from('class_pack_types').insert({ gym_id: gymId, ...toRow(input) });
  if (error) throw error;
}

export async function updatePackType(gymId: string, id: string, input: PackTypeInput): Promise<void> {
  const { error } = await supabase.from('class_pack_types').update({ ...toRow(input), updated_at: new Date().toISOString() }).eq('id', id).eq('gym_id', gymId);
  if (error) throw error;
}

export async function setPackTypeActive(gymId: string, id: string, isActive: boolean): Promise<void> {
  const { error } = await supabase.from('class_pack_types').update({ is_active: isActive, updated_at: new Date().toISOString() }).eq('id', id).eq('gym_id', gymId);
  if (error) throw error;
}
