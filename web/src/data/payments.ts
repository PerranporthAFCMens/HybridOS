import { supabase } from './client';
import { edgeErrorMessage } from './edge';

export interface PaymentSettings { enabled: boolean; cancellationHours: number }
export interface StripeLink { environment: 'sandbox' | 'live'; detailsSubmitted: boolean; chargesEnabled: boolean; payoutsEnabled: boolean; problem: string | null }
export interface PaymentsData { settings: PaymentSettings; link: StripeLink | null; overdueDays: number }

/** No settings row yet means payments are off and the cancellation window is the usual 24 hours. */
export const DEFAULT_SETTINGS: PaymentSettings = { enabled: false, cancellationHours: 24 }

/** No row means a payment counts as missed 7 days after it was due. */
export const DEFAULT_OVERDUE_DAYS = 7;

export async function loadPayments(gymId: string): Promise<PaymentsData> {
  const [s, a, o] = await Promise.all([
    supabase.from('gym_payment_settings').select('payments_enabled, cancellation_hours').eq('gym_id', gymId).maybeSingle(),
    supabase.from('gym_stripe_accounts').select('environment, details_submitted, charges_enabled, payouts_enabled, last_error').eq('gym_id', gymId).maybeSingle(),
    supabase.from('gym_arrears_settings').select('overdue_grace_days').eq('gym_id', gymId).maybeSingle(),
  ]);
  if (s.error) throw s.error;
  if (a.error) throw a.error;
  if (o.error) throw o.error;
  return {
    settings: s.data ? { enabled: s.data.payments_enabled, cancellationHours: s.data.cancellation_hours } : DEFAULT_SETTINGS,
    overdueDays: o.data?.overdue_grace_days ?? DEFAULT_OVERDUE_DAYS,
    link: a.data ? { environment: a.data.environment === 'live' ? 'live' : 'sandbox', detailsSubmitted: a.data.details_submitted, chargesEnabled: a.data.charges_enabled, payoutsEnabled: a.data.payouts_enabled, problem: a.data.last_error } : null,
  };
}

/** Saves one or both of the gym's choices. The database refuses to turn payments on until Stripe says the account can take cards. */
export async function savePaymentSettings(gymId: string, s: PaymentSettings): Promise<void> {
  const { error } = await supabase.from('gym_payment_settings').upsert(
    { gym_id: gymId, payments_enabled: s.enabled, cancellation_hours: s.cancellationHours, updated_at: new Date().toISOString() },
    { onConflict: 'gym_id' },
  );
  if (error) throw error;
}

/** How many days after it was due a payment that has not arrived counts as missed (money owed). */
export async function saveOverdueDays(gymId: string, days: number): Promise<void> {
  const { error } = await supabase.from('gym_arrears_settings').upsert({ gym_id: gymId, overdue_grace_days: days, updated_at: new Date().toISOString() }, { onConflict: 'gym_id' });
  if (error) throw error;
}

async function callStripe<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('stripe-connect', { body });
  if (error) throw new Error(await edgeErrorMessage(error, 'Stripe did not answer.'));
  return data as T;
}

/** Stripe's own page where the gym finishes setting the account up; it sends the owner back to `returnTo`. */
export async function startStripe(gymId: string, returnTo: string): Promise<string> {
  const d = await callStripe<{ url?: string }>({ action: 'start', gym_id: gymId, return_to: returnTo });
  if (!d.url) throw new Error('Stripe did not give a page to continue on.');
  return d.url;
}

/** Asks Stripe how the account is doing and saves it. */
export async function refreshStripe(gymId: string): Promise<void> {
  await callStripe({ action: 'refresh', gym_id: gymId });
}
