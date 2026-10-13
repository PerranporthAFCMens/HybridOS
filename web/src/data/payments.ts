import { supabase } from './client';
import { edgeErrorMessage } from './edge';

export interface PaymentSettings { enabled: boolean; cancellationHours: number; overdueDays: number }
export interface StripeLink { environment: 'sandbox' | 'live'; detailsSubmitted: boolean; chargesEnabled: boolean; payoutsEnabled: boolean; problem: string | null }
export interface PaymentsData { settings: PaymentSettings; link: StripeLink | null }

/** No settings row yet means payments are off and the cancellation window is the usual 24 hours. */
export const DEFAULT_SETTINGS: PaymentSettings = { enabled: false, cancellationHours: 24, overdueDays: 7 };

export async function loadPayments(gymId: string): Promise<PaymentsData> {
  const [s, a] = await Promise.all([
    supabase.from('gym_payment_settings').select('payments_enabled, cancellation_hours, overdue_grace_days').eq('gym_id', gymId).maybeSingle(),
    supabase.from('gym_stripe_accounts').select('environment, details_submitted, charges_enabled, payouts_enabled, last_error').eq('gym_id', gymId).maybeSingle(),
  ]);
  if (s.error) throw s.error;
  if (a.error) throw a.error;
  return {
    settings: s.data ? { enabled: s.data.payments_enabled, cancellationHours: s.data.cancellation_hours, overdueDays: s.data.overdue_grace_days } : DEFAULT_SETTINGS,
    link: a.data ? { environment: a.data.environment === 'live' ? 'live' : 'sandbox', detailsSubmitted: a.data.details_submitted, chargesEnabled: a.data.charges_enabled, payoutsEnabled: a.data.payouts_enabled, problem: a.data.last_error } : null,
  };
}

/** Saves one or both of the gym's choices. The database refuses to turn payments on until Stripe says the account can take cards. */
export async function savePaymentSettings(gymId: string, s: PaymentSettings): Promise<void> {
  const { error } = await supabase.from('gym_payment_settings').upsert(
    { gym_id: gymId, payments_enabled: s.enabled, cancellation_hours: s.cancellationHours, overdue_grace_days: s.overdueDays, updated_at: new Date().toISOString() },
    { onConflict: 'gym_id' },
  );
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
