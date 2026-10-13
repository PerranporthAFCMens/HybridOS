import { useEffect, useRef, useState } from 'react';
import { finishPayment, type PaymentSession } from '../data/join';
import { loadStripeJs, type StripeElements, type StripeJs } from '../data/stripejs';
import { Button } from '../ui/Button';
import { Checkbox } from '../ui/Field';
import { checkAgreed, moneyText } from './calc';

const WAIT_MS = 1200;
const TRIES = 3;
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

const EVERY: Record<string, string> = { weekly: 'week', monthly: 'month', quarterly: '3 months', annual: 'year' };
const dayText = (iso: string): string => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${Number(m[3])} ${months[Number(m[2]) - 1] ?? ''} ${m[1]}`;
};

/**
 * The agreement and Stripe's card form. The card number is typed into Stripe's own box (an iframe), so it never reaches this app.
 * "Pay" asks Stripe to take the first payment; then the server asks Stripe again and only then turns the membership on.
 */
export function PayForm({ session, gymId, planId, busy, onBusy, onDone, onBack }: {
  session: PaymentSession; gymId: string; planId: string; busy: boolean; onBusy: (b: boolean) => void;
  onDone: (status: 'active' | 'pending') => void; onBack: () => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const handle = useRef<{ stripe: StripeJs; elements: StripeElements } | null>(null);
  const [ready, setReady] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    let destroy: (() => void) | null = null;
    loadStripeJs().then(
      (Stripe) => {
        if (!live || !box.current) return;
        const stripe = Stripe(session.publishableKey, { stripeAccount: session.stripeAccount });
        const elements = stripe.elements({ clientSecret: session.clientSecret, appearance: { theme: 'night' } });
        const el = elements.create('payment');
        el.mount(box.current);
        el.on('ready', () => live && setReady(true));
        handle.current = { stripe, elements };
        destroy = () => el.destroy();
      },
      (e: unknown) => live && setMsg(e instanceof Error ? e.message : 'The card form could not load.'),
    );
    return () => {
      live = false;
      handle.current = null;
      destroy?.();
    };
  }, [session.publishableKey, session.stripeAccount, session.clientSecret]);

  const pay = async () => {
    const problem = checkAgreed(agreed);
    if (problem) return setMsg(problem);
    const h = handle.current;
    if (!h) return setMsg('The card form is still loading. Try again in a moment.');
    onBusy(true);
    setMsg(null);
    try {
      const r = await h.stripe.confirmPayment({ elements: h.elements, redirect: 'if_required', confirmParams: { return_url: window.location.href } });
      if (r.error) return setMsg(r.error.message ?? 'That card was not accepted. Check the details or try another card.');
      // Money has been taken. From here on, never ask them to pay again.
      let status: 'active' | 'pending' = 'pending';
      try {
        status = await finishPayment(gymId, planId, session.subscriptionId);
        for (let i = 0; i < TRIES && status === 'pending'; i++) {
          await sleep(WAIT_MS);
          status = await finishPayment(gymId, planId, session.subscriptionId);
        }
      } catch {
        status = 'pending';
      }
      onDone(status);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Something went wrong. You have not been charged twice: check with the gym before trying again.');
    } finally {
      onBusy(false);
    }
  };

  const every = EVERY[session.interval] ?? 'period';
  return (
    <div>
      <p className="join-due">
        <b>{moneyText(session.dueTodayPence)} today</b>
        {session.nextPaymentDate ? <>, then {moneyText(session.amountPence)} every {every} from {dayText(session.nextPaymentDate)}</> : null}
      </p>
      <div ref={box} className="join-card" aria-label="Card details" />
      {!ready && !msg && <p className="muted small">Loading the card form…</p>}
      <div className="join-agree"><Checkbox label={session.wording} checked={agreed} onChange={setAgreed} disabled={busy} /></div>
      {msg && <p className="join-msg bad" role="alert">{msg}</p>}
      <div className="join-nav">
        <Button onClick={onBack} disabled={busy}>Change membership</Button>
        <Button variant="primary" onClick={() => void pay()} disabled={busy || !ready}>{busy ? 'Paying…' : `Pay ${moneyText(session.dueTodayPence)} and join`}</Button>
      </div>
    </div>
  );
}
