import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useReadyAuth } from '../auth/AuthProvider';
import { finishPackPayment, gymTakesCardPayments, preparePackPayment, type PackPaymentSession } from '../data/packBuy';
import { loadStripeJs, type StripeElements, type StripeJs } from '../data/stripejs';
import { moneyText } from '../join/calc';
import { perClassText, validityText } from '../packs/calc';
import { usePackTypes } from '../packs/usePacks';
import { Button } from '../ui/Button';
import { Checkbox } from '../ui/Field';
import { Modal } from '../ui/Modal';

const WAIT_MS = 1200;
const TRIES = 3;
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** What a member sees on the Classes screen when their gym sells class packs and takes card payments. Nothing at all otherwise. */
export function BuyPacks() {
  const { gym } = useReadyAuth();
  const qc = useQueryClient();
  const types = usePackTypes(gym.gymId);
  const mode = useQuery({ queryKey: ['m-pay-mode', gym.gymId], queryFn: () => gymTakesCardPayments(gym.gymId), staleTime: 5 * 60 * 1000 });
  const [session, setSession] = useState<PackPaymentSession | null>(null);
  const [starting, setStarting] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ text: string; good: boolean } | null>(null);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 6000);
    return () => clearTimeout(t);
  }, [notice]);

  const onSale = (types.data ?? []).filter((t) => t.isActive);
  if (mode.data !== true || onSale.length === 0) return notice ? <div className={`mem-notice ${notice.good ? '' : 'bad'}`} role={notice.good ? 'status' : 'alert'}>{notice.text}</div> : null;

  const start = async (id: string) => {
    setStarting(id);
    setNotice(null);
    try {
      setSession(await preparePackPayment(gym.gymId, id));
    } catch (e) {
      setNotice({ text: e instanceof Error ? e.message : 'Could not start the payment.', good: false });
    } finally {
      setStarting(null);
    }
  };

  const done = (status: 'paid' | 'pending') => {
    const s = session;
    setSession(null);
    void qc.invalidateQueries({ queryKey: ['m-packs', gym.gymId] });
    setNotice(status === 'paid' && s
      ? { text: `Thank you. ${s.packName} is yours: ${s.credits} ${s.credits === 1 ? 'class' : 'classes'} added.`, good: true }
      : { text: 'Your payment went through. Your pack will appear in a minute. Please check back before paying again.', good: true });
  };

  return (
    <section className="mem-card pack-buy" aria-label="Class packs">
      {notice && <div className={`mem-notice ${notice.good ? '' : 'bad'}`} role={notice.good ? 'status' : 'alert'}>{notice.text}</div>}
      <h2>Class packs</h2>
      <p className="muted small">Buy a bundle of classes. A class is used when you book one your plan does not cover.</p>
      <ul className="mem-list">
        {onSale.map((t) => (
          <li key={t.id} className="pack-buy-row">
            <div>
              <b>{t.name}</b>
              <div className="muted small">{t.credits} {t.credits === 1 ? 'class' : 'classes'} · {perClassText(t)} · {validityText(t.validDays)}</div>
            </div>
            <Button variant="primary" disabled={starting !== null} onClick={() => void start(t.id)} aria-label={`Buy ${t.name}`}>{starting === t.id ? 'One moment…' : `Buy ${moneyText(t.pricePence)}`}</Button>
          </li>
        ))}
      </ul>
      {session && <PackPay session={session} gymId={gym.gymId} onDone={done} onClose={() => setSession(null)} />}
    </section>
  );
}

/** The agreement and Stripe's card form. The card number is typed into Stripe's own box, so it never reaches this app. */
function PackPay({ session, gymId, onDone, onClose }: { session: PackPaymentSession; gymId: string; onDone: (s: 'paid' | 'pending') => void; onClose: () => void }) {
  const box = useRef<HTMLDivElement>(null);
  const handle = useRef<{ stripe: StripeJs; elements: StripeElements } | null>(null);
  const [ready, setReady] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
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
    if (!agreed) return setMsg('Tick the box to say you agree before paying.');
    const h = handle.current;
    if (!h) return setMsg('The card form is still loading. Try again in a moment.');
    setBusy(true);
    setMsg(null);
    try {
      const r = await h.stripe.confirmPayment({ elements: h.elements, redirect: 'if_required', confirmParams: { return_url: window.location.href } });
      if (r.error) return setMsg(r.error.message ?? 'That card was not accepted. Check the details or try another card.');
      // Money has been taken. From here on, never ask them to pay again.
      let status: 'paid' | 'pending' = 'pending';
      try {
        status = await finishPackPayment(gymId, session.paymentIntentId);
        for (let i = 0; i < TRIES && status === 'pending'; i++) {
          await sleep(WAIT_MS);
          status = await finishPackPayment(gymId, session.paymentIntentId);
        }
      } catch {
        status = 'pending';
      }
      onDone(status);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Something went wrong. Check with the gym before trying again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title="Buy a class pack" onClose={() => !busy && onClose()}>
      <h3>{session.packName}</h3>
      <p className="pack-due"><b>{moneyText(session.amountPence)}</b>, once</p>
      <div ref={box} className="pack-card-box" aria-label="Card details" />
      {!ready && !msg && <p className="muted small">Loading the card form…</p>}
      <div className="pack-agree"><Checkbox label={session.wording} checked={agreed} onChange={setAgreed} disabled={busy} /></div>
      {msg && <p className="bad" role="alert">{msg}</p>}
      <div className="mem-actions">
        <Button variant="primary" onClick={() => void pay()} disabled={busy || !ready}>{busy ? 'Paying…' : `Pay ${moneyText(session.amountPence)}`}</Button>
        <Button onClick={onClose} disabled={busy}>Not now</Button>
      </div>
    </Modal>
  );
}
