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

export interface PlanDetail {
  id: string;
  name: string;
  description: string | null;
  priceInPence: number;
  interval: string;
  accessType: string;
  joiningFeeInPence: number;
  classesPerWeek: number | null;
  includesOpenGym: boolean;
  includesClasses: boolean;
  includesPt: boolean;
  isPublic: boolean;
  canSwitchTo: boolean;
  isActive: boolean;
}

/** What the form can change. Money is already in pence. */
export interface PlanInput {
  name: string;
  description: string | null;
  priceInPence: number;
  interval: string;
  accessType: string;
  joiningFeeInPence: number;
  classesPerWeek: number | null;
  includesOpenGym: boolean;
  includesClasses: boolean;
  includesPt: boolean;
  isPublic: boolean;
  canSwitchTo: boolean;
}

export async function listPlanDetails(gymId: string): Promise<PlanDetail[]> {
  const { data, error } = await supabase
    .from('membership_plans')
    .select('*')
    .eq('gym_id', gymId)
    .order('price_pence');
  if (error) throw error;
  return (data ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    priceInPence: p.price_pence,
    interval: p.billing_interval,
    accessType: p.access_type,
    joiningFeeInPence: p.joining_fee_pence,
    classesPerWeek: p.classes_per_week,
    includesOpenGym: p.includes_open_gym,
    includesClasses: p.includes_classes,
    includesPt: p.includes_pt,
    isPublic: p.is_public,
    canSwitchTo: p.members_can_switch_to,
    isActive: p.is_active,
  }));
}

function toRow(input: PlanInput) {
  return {
    name: input.name,
    description: input.description,
    price_pence: input.priceInPence,
    billing_interval: input.interval,
    joining_fee_pence: input.joiningFeeInPence,
    access_type: input.accessType,
    includes_open_gym: input.includesOpenGym,
    includes_classes: input.includesClasses,
    includes_pt: input.includesPt,
    classes_per_week: input.classesPerWeek,
    is_public: input.isPublic,
    members_can_switch_to: input.canSwitchTo,
  };
}

export async function createPlan(gymId: string, input: PlanInput): Promise<void> {
  const { error } = await supabase.from('membership_plans').insert({ gym_id: gymId, ...toRow(input) });
  if (error) throw error;
}

export async function updatePlan(gymId: string, planId: string, input: PlanInput): Promise<void> {
  const { error } = await supabase.from('membership_plans').update(toRow(input)).eq('id', planId).eq('gym_id', gymId);
  if (error) throw error;
}

export async function setPlanActive(gymId: string, planId: string, isActive: boolean): Promise<void> {
  const { error } = await supabase.from('membership_plans').update({ is_active: isActive }).eq('id', planId).eq('gym_id', gymId);
  if (error) throw error;
}
