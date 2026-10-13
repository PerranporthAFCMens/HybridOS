import type { StripeLink } from '../data/payments';

export type StripeStep = 'none' | 'unfinished' | 'ready';

export interface StripeStatus { step: StripeStep; headline: string; detail: string; button: string }

/** Where the gym is with Stripe, in plain words, and what the one button should say. */
export function stripeStatus(link: StripeLink | null): StripeStatus {
  if (!link) return { step: 'none', headline: 'Stripe is not connected.', detail: 'Connect your Stripe account so members can pay you by card. The money goes straight to your own Stripe account.', button: 'Connect Stripe' };
  if (!link.chargesEnabled) {
    return {
      step: 'unfinished',
      headline: link.detailsSubmitted ? 'Stripe is checking your details.' : 'Stripe set-up is not finished.',
      detail: link.problem ?? (link.detailsSubmitted ? 'This can take a little while. Check again in a few minutes.' : 'Carry on where you left off. Stripe asks for your business and bank details.'),
      button: link.detailsSubmitted ? 'Open Stripe' : 'Finish set-up on Stripe',
    };
  }
  return { step: 'ready', headline: 'Stripe is connected and can take card payments.', detail: link.payoutsEnabled ? 'Payouts to your bank are on.' : 'Stripe has not turned payouts on yet, so money will wait in Stripe until it does.', button: 'Open Stripe' };
}

export const HOUR_CHOICES = [0, 1, 2, 4, 6, 12, 24, 48, 72, 168];

/** How a cancellation window reads: "up to 24 hours before", "up to 2 days before", "right up to the start". */
export function windowText(hours: number): string {
  if (hours <= 0) return 'right up to the start of the class';
  if (hours % 24 === 0) {
    const d = hours / 24;
    return `up to ${d} ${d === 1 ? 'day' : 'days'} before the class`;
  }
  return `up to ${hours} ${hours === 1 ? 'hour' : 'hours'} before the class`;
}

/** The choice in the list: the usual ones, plus the gym's current one if it is something else (so nothing is ever hidden). */
export function hourOptions(current: number): { value: number; label: string }[] {
  const all = HOUR_CHOICES.includes(current) ? HOUR_CHOICES : [...HOUR_CHOICES, current].sort((a, b) => a - b);
  return all.map((value) => ({ value, label: value === 0 ? 'No notice needed' : value % 24 === 0 ? `${value / 24} ${value === 24 ? 'day' : 'days'} before` : `${value} ${value === 1 ? 'hour' : 'hours'} before` }));
}

export const OVERDUE_CHOICES = [0, 3, 7, 14, 30];

/** The choices for how long a payment can be late before it counts as missed, plus the gym's current one if it is something else. */
export function overdueOptions(current: number): { value: number; label: string }[] {
  const all = OVERDUE_CHOICES.includes(current) ? OVERDUE_CHOICES : [...OVERDUE_CHOICES, current].sort((a, b) => a - b);
  return all.map((value) => ({ value, label: value === 0 ? 'The day after it is due' : `${value} ${value === 1 ? 'day' : 'days'} after it is due` }));
}
