import { supabase } from './client';
import { readPaymentNotice, type PaymentNotice } from '../member/paymentNotice';

/** The member's own billing problem, if any. Own rows only: the database decides who is asking. */
export async function getMyPaymentNotice(gymId: string): Promise<PaymentNotice> {
  const { data, error } = await supabase.rpc('get_my_payment_notice', { p_gym_id: gymId });
  if (error) throw error;
  return readPaymentNotice(data);
}
