import { supabase } from './client';
import { edgeErrorMessage } from './edge';
import { getGymSlug, getPaymentMode } from './join';

export interface PackPaymentSession {
  publishableKey: string;
  stripeAccount: string;
  clientSecret: string;
  paymentIntentId: string;
  amountPence: number;
  packName: string;
  credits: number;
  wording: string;
}

/** True when this gym takes card payments, so a Buy button can work. Anything else (including a lookup that fails) hides it. */
export async function gymTakesCardPayments(gymId: string): Promise<boolean> {
  try {
    return (await getPaymentMode(await getGymSlug(gymId))) === 'stripe';
  } catch {
    return false;
  }
}

const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const str = (v: unknown): string => (typeof v === 'string' ? v : '');

async function call(body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const { data, error } = await supabase.functions.invoke('stripe-pack-buy', { body });
  if (error) throw new Error(await edgeErrorMessage(error, 'The payment service did not answer. Please try again.'));
  return obj(data);
}

/** Sets up a one-off payment for this pack. Nothing is charged until the card form is confirmed. */
export async function preparePackPayment(gymId: string, packTypeId: string): Promise<PackPaymentSession> {
  const r = await call({ action: 'prepare', gym_id: gymId, pack_type_id: packTypeId });
  const pack = obj(r.pack);
  return {
    publishableKey: str(r.publishable_key), stripeAccount: str(r.stripe_account), clientSecret: str(r.client_secret), paymentIntentId: str(r.payment_intent_id),
    amountPence: Number(r.amount_pence) || 0, packName: str(pack.name), credits: Number(pack.credits) || 0, wording: str(r.wording),
  };
}

/** After the card form worked: the server asks Stripe, and only then adds the pack. 'pending' means Stripe has not confirmed yet. */
export async function finishPackPayment(gymId: string, paymentIntentId: string): Promise<'paid' | 'pending'> {
  const r = await call({ action: 'finish', gym_id: gymId, payment_intent_id: paymentIntentId });
  return r.status === 'paid' ? 'paid' : 'pending';
}
