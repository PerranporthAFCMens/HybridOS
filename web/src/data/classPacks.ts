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

/** A pack a member holds. Never written directly: owners give and cancel through functions. */
export interface HeldPack {
  id: string;
  userId: string;
  name: string;
  creditsTotal: number;
  creditsLeft: number;
  expiresAt: string | null;
  source: string;
  voidedAt: string | null;
  createdAt: string;
}

export async function listHeldPacks(gymId: string): Promise<HeldPack[]> {
  const { data, error } = await supabase
    .from('class_packs')
    .select('id, user_id, name, credits_total, credits_left, expires_at, source, voided_at, created_at')
    .eq('gym_id', gymId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((p) => ({ id: p.id, userId: p.user_id, name: p.name, creditsTotal: p.credits_total, creditsLeft: p.credits_left, expiresAt: p.expires_at, source: p.source, voidedAt: p.voided_at, createdAt: p.created_at }));
}

export async function giveClassPack(gymId: string, userId: string, packTypeId: string): Promise<void> {
  const { error } = await supabase.rpc('owner_give_class_pack', { p_gym_id: gymId, p_user_id: userId, p_pack_type_id: packTypeId });
  if (error) throw error;
}

export async function voidClassPack(packId: string): Promise<void> {
  const { error } = await supabase.rpc('owner_void_class_pack', { p_pack_id: packId });
  if (error) throw error;
}
