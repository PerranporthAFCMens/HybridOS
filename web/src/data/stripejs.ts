// Stripe's own card form (Stripe.js). It is loaded from Stripe's address, never bundled, and the card number goes straight from the
// form to Stripe: it never touches this app or the database.

export interface StripeElement {
  mount(target: HTMLElement): void;
  destroy(): void;
  on(event: 'ready' | 'change', handler: (e?: { complete?: boolean }) => void): void;
}
export interface StripeElements { create(type: 'payment', options?: Record<string, unknown>): StripeElement }
export interface StripeConfirmResult { error?: { message?: string; type?: string }; paymentIntent?: { status: string } }
export interface StripeJs {
  elements(options: Record<string, unknown>): StripeElements;
  confirmPayment(args: { elements: StripeElements; redirect: 'if_required'; confirmParams: { return_url: string } }): Promise<StripeConfirmResult>;
}
export type StripeFactory = (publishableKey: string, options?: { stripeAccount?: string }) => StripeJs;

declare global {
  interface Window { Stripe?: StripeFactory }
}

let loading: Promise<StripeFactory> | null = null;

/** Stripe.js, loaded once. Rejects (so the page can say so) when it cannot be reached. */
export function loadStripeJs(): Promise<StripeFactory> {
  if (window.Stripe) return Promise.resolve(window.Stripe);
  loading ??= new Promise<StripeFactory>((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://js.stripe.com/v3/';
    s.async = true;
    s.onload = () => (window.Stripe ? resolve(window.Stripe) : reject(new Error('The card form did not load.')));
    s.onerror = () => {
      loading = null;
      reject(new Error('The card form could not be reached. Check your connection and try again.'));
    };
    document.head.appendChild(s);
  });
  return loading;
}
