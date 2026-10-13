import { supabase } from './client';

export type SettleHow = 'paid' | 'waived' | 'written_off';

/** Someone who is not financial: they have at least one missed payment. */
export interface Debtor {
  userId: string;
  name: string;
  planName: string | null;
  membershipStatus: string | null;
  owedPence: number;
  missedCount: number;
  oldestMissed: string | null;
  latestMissed: string | null;
  latestReason: string | null;
}

export interface MissedPayment {
  id: string;
  chargeDate: string | null;
  amountPence: number;
  state: string;
  reason: string | null;
  planName: string | null;
  provider: string;
  /** Still owed. False once it has been marked paid, waived or written off. */
  outstanding: boolean;
  settledHow: SettleHow | null;
  settledNote: string | null;
  settledAt: string | null;
  settledBy: string | null;
}

const how = (v: string | null): SettleHow | null => (v === 'paid' || v === 'waived' || v === 'written_off' ? v : null);

/** Everyone who is not financial, biggest debt first (owners and admins only: the database refuses anyone else). */
export async function listDebtors(gymId: string): Promise<Debtor[]> {
  const { data, error } = await supabase.rpc('get_gym_arrears', { p_gym_id: gymId });
  if (error) throw error;
  return (data ?? []).map((r) => ({
    userId: r.user_id,
    name: r.display_name,
    planName: r.plan_name,
    membershipStatus: r.membership_status,
    owedPence: Number(r.owed_pence),
    missedCount: Number(r.missed_count),
    oldestMissed: r.oldest_missed,
    latestMissed: r.latest_missed,
    latestReason: r.latest_reason,
  }));
}

/** One person's missed payments, newest first, and the ones already dealt with. */
export async function listMissedPayments(gymId: string, userId: string): Promise<MissedPayment[]> {
  const { data, error } = await supabase.rpc('get_member_missed_payments', { p_gym_id: gymId, p_user_id: userId });
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.payment_id,
    chargeDate: r.charge_date,
    amountPence: Number(r.amount_pence),
    state: r.state,
    reason: r.reason,
    planName: r.plan_name,
    provider: r.provider,
    outstanding: r.outstanding,
    settledHow: how(r.settled_how),
    settledNote: r.settled_note,
    settledAt: r.settled_at,
    settledBy: r.settled_by_name,
  }));
}

export async function settlePayment(gymId: string, paymentId: string, h: SettleHow, note: string): Promise<void> {
  const { error } = await supabase.rpc('settle_missed_payment', { p_gym_id: gymId, p_payment_id: paymentId, p_how: h, p_note: note.trim() || undefined });
  if (error) throw error;
}

export async function reopenPayment(gymId: string, paymentId: string): Promise<void> {
  const { error } = await supabase.rpc('reopen_missed_payment', { p_gym_id: gymId, p_payment_id: paymentId });
  if (error) throw error;
}
