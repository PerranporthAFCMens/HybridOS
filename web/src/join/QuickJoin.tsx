import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { siteUrl } from '../app/site';
import {
  confirmWithCode, currentUserId, emailMeACode, getPaymentMode, getSignupDocuments, joinWithPlan, myMembershipAt, preparePayment, resendCode, saveBasics,
  type JoinGym, type JoinStyle, type PaymentSession,
} from '../data/join';
import { Button, LinkButton } from '../ui/Button';
import { Card } from '../ui/Card';
import { DateInput, Field, FieldRow, Input } from '../ui/Field';
import { termsSentence } from '../plans/terms';
import {
  EMPTY_DETAILS, QUICK_TITLES, basicsErrors, canPayOnline, checkCode, checkEmail, checkPayer, cleanCode, isFreePlan, isUnder18, payTermsText, planPrice,
  quickProgress, quickStepsFor, toBasicsArgs,
  type BasicsField, type JoinDetails, type JoinPlan, type QuickStepId,
} from './calc';
import { Checklist } from './Checklist';
import { SignForm } from './SignForm';
import { PayForm } from './PayForm';
import './join.css';

const draftKey = (slug: string) => `hybrid-quick-draft-${slug}`;
const planKey = (slug: string) => `hybrid-quick-plan-${slug}`;

function read<T>(key: string, fallback: T): T {
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function write(key: string, value: unknown) {
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* a private window may refuse; the journey still works */
  }
}

const CODE_LENGTH = 8;

/**
 * Quick join: choose a plan, confirm your email with a code (no password), give the basics, agree and pay. The emergency contact,
 * health questions, waiver and address are a short checklist afterwards. The gym chooses this journey; the full one stays as it was.
 */
export function QuickJoin({ slug, gym, style }: { slug: string; gym: JoinGym; style: JoinStyle }) {
  const now = useMemo(() => new Date(), []);
  const [userId, setUserId] = useState<string | null | undefined>(undefined);
  // Whether they arrived already signed in. The step count is fixed by this, so it does not change when they sign in on the email step.
  const [hadAccount, setHadAccount] = useState(false);
  const [step, setStep] = useState<QuickStepId>('plan');
  const [d, setD] = useState<JoinDetails>(() => ({ ...EMPTY_DETAILS, ...read<Partial<JoinDetails>>(draftKey(slug), {}) }));
  const [chosen, setChosen] = useState<JoinPlan | null>(() => gym.plans.find((p) => p.id === read<string>(planKey(slug), '')) ?? null);
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState('');
  const [errors, setErrors] = useState<Partial<Record<BasicsField | 'email', string>>>({});
  const [msg, setMsg] = useState<{ text: string; good: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [payer, setPayer] = useState({ email: '' });
  const [payment, setPayment] = useState<PaymentSession | null>(null);
  const [joined, setJoined] = useState<{ planName: string; confirming: boolean } | null>(null);

  useEffect(() => {
    let live = true;
    currentUserId().then((id) => { if (!live) return; setUserId(id); setHadAccount(!!id); }, () => live && setUserId(null));
    return () => { live = false; };
  }, []);

  const existingQ = useQuery({ queryKey: ['quick-existing', gym.gymId, userId], queryFn: () => myMembershipAt(gym.gymId, userId ?? ''), enabled: !!userId, retry: false });
  // Whether this gym takes payment here can only be asked once signed in (the database refuses a signed-out question). Until then the
  // journey is shown with its payment step, and the answer is known by the time the basics are saved.
  const modeQ = useQuery({ queryKey: ['quick-mode', slug, userId], queryFn: () => getPaymentMode(slug), enabled: !!userId, retry: false });
  const docsQ = useQuery({ queryKey: ['quick-docs', slug], queryFn: () => getSignupDocuments(slug), retry: false });
  const takesPayment = modeQ.data === 'stripe';
  const wantsPayment = userId ? takesPayment : true;
  // A gym that wants the terms and waiver signed before paying adds a reading-and-signing screen, if it has any documents.
  const signing = style.signBeforePaying && (docsQ.data?.length ?? 0) > 0;
  const under18 = isUnder18(d.dob, now);
  const paying = wantsPayment && !(chosen && isFreePlan(chosen));
  const signedIn = !!userId;
  const steps = quickStepsFor({ signedIn: hadAccount, paying, signing });
  const at = steps.indexOf(step);

  const set = (patch: Partial<JoinDetails>) => {
    const next = { ...d, ...patch };
    setD(next);
    write(draftKey(slug), next);
  };
  const go = (to: QuickStepId) => {
    setMsg(null);
    setErrors({});
    setStep(to);
  };
  const after = (from: QuickStepId, list: QuickStepId[] = steps) => list[Math.min(list.indexOf(from) + 1, list.length - 1)] ?? 'done';
  const back = () => go(steps[Math.max(at - 1, 0)] ?? 'plan');
  const fail = (e: unknown) => setMsg({ text: e instanceof Error ? e.message : 'Something went wrong. Please try again.', good: false });
  const run = async (work: () => Promise<void>) => {
    setBusy(true);
    setMsg(null);
    try {
      await work();
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };

  // ---- Plan ----
  const choose = (p: JoinPlan) => {
    setChosen(p);
    setPayment(null);
    write(planKey(slug), p.id);
    const list = quickStepsFor({ signedIn: hadAccount, paying: wantsPayment && !isFreePlan(p), signing });
    go(after('plan', list));
  };

  // ---- Email and code ----
  const sendCode = (e?: FormEvent) => {
    e?.preventDefault();
    const problem = checkEmail(email);
    if (problem) return setErrors({ email: problem });
    setErrors({});
    void run(async () => {
      await emailMeACode(email, slug, gym.gymId);
      setSent(true);
      setCode('');
    });
  };
  const confirm = (value: string) => {
    const problem = checkCode(value);
    if (problem) return setMsg({ text: problem, good: false });
    void run(async () => {
      await confirmWithCode(email, cleanCode(value));
      setUserId(await currentUserId());
      setSent(false);
      setCode('');
      go('basics');
    });
  };
  const onCode = (value: string) => {
    setCode(value);
    if (cleanCode(value).length === CODE_LENGTH && !busy) confirm(value);
  };
  const sendAnother = () => {
    void run(async () => {
      await resendCode(email, slug);
      setMsg({ text: 'A new code is on its way. Use the newest email.', good: true });
    });
  };

  // ---- Basics ----
  const finishJoin = (r: { planName: string; confirming: boolean }) => {
    try {
      sessionStorage.removeItem(draftKey(slug));
      sessionStorage.removeItem(planKey(slug));
      sessionStorage.setItem('hybrid-gym-id', gym.gymId);
    } catch {
      /* nothing to clear */
    }
    setJoined(r);
    setStep('done');
  };
  const submitBasics = (e: FormEvent) => {
    e.preventDefault();
    const found = basicsErrors(d, now);
    setErrors(found);
    if (Object.keys(found).length > 0 || !chosen) return;
    // A one-off pass cannot be paid for on this page; say so before anything is saved.
    if (takesPayment && !isFreePlan(chosen) && !canPayOnline(chosen)) return setMsg({ text: `${chosen.name} cannot be paid for online. Ask ${gym.name} to sign you up, or choose another membership.`, good: false });
    void run(async () => {
      await saveBasics(toBasicsArgs(d, now));
      if (signing) return go('sign');
      await afterBasics(chosen);
    });
  };
  // After the basics (and the signature, when it comes first): pay, or join straight away on a free plan or at a gym that does not take payment here.
  const afterBasics = async (plan: JoinPlan) => {
    if (paying) return go('pay');
    const r = await joinWithPlan(slug, plan.id);
    finishJoin({ planName: r.planName || plan.name, confirming: false });
  };

  // ---- Pay ----
  const submitPayer = (e: FormEvent) => {
    e.preventDefault();
    if (!chosen) return;
    const problem = checkPayer(under18, d.guardianName, payer.email);
    if (problem) return setMsg({ text: problem, good: false });
    void run(async () => {
      setPayment(await preparePayment(gym.gymId, chosen.id, under18 ? { name: d.guardianName.trim(), email: payer.email.trim() } : null));
    });
  };

  const header = (
    <header className="join-head">
      {gym.logoUrl ? <img src={gym.logoUrl} alt={gym.name} className="join-logo" /> : null}
      <h1>Join {gym.name}</h1>
    </header>
  );

  if (userId === undefined || (signedIn && existingQ.isLoading) || modeQ.isLoading || docsQ.isLoading) return <div className="center muted">Loading…</div>;

  // Someone who already has a membership here is never shown the join steps. A pending one at a gym that takes payment is an unfinished payment.
  if (signedIn && existingQ.data && !(existingQ.data === 'pending' && takesPayment) && step !== 'done') {
    const status = existingQ.data;
    return (
      <main className="join">
        {header}
        <Card>
          <div className="join-done">
            <p>{status === 'active' ? 'You are already a member. Your membership is active.' : `Your membership is ${status}. Contact ${gym.name} if you need to change it.`}</p>
            <LinkButton variant="primary" href={`${siteUrl('member.html')}?gym_id=${encodeURIComponent(gym.gymId)}`}>Open the member app</LinkButton>
          </div>
        </Card>
      </main>
    );
  }

  const alertBox = msg && <p className={`join-msg ${msg.good ? 'good' : 'bad'}`} role={msg.good ? 'status' : 'alert'}>{msg.text}</p>;
  const total = steps.length - 1;
  const progress = (
    <div className="qj-head">
      <div className="qj-meta"><span>{quickProgress(steps, step)}</span><span>{QUICK_TITLES[step]}</span></div>
      <div className="qj-bar" role="img" aria-label={quickProgress(steps, step)}><i style={{ width: `${Math.round(((at + 1) / total) * 100)}%` }} /></div>
    </div>
  );
  const chosenLine = chosen && (
    <div className="qj-chosen">
      <span><b>{chosen.name}</b> · {isFreePlan(chosen) ? 'Free' : planPrice(chosen)}</span>
      <Button onClick={() => go('plan')} disabled={busy}>Change</Button>
    </div>
  );

  // What comes after paying, in the gym's own terms.
  const later: string[] = [];
  if (style.askEmergency !== 'off') later.push('Add an emergency contact');
  if (docsQ.data && docsQ.data.length > 0 && !signing) later.push('Answer a few health questions and sign the waiver');
  if (style.askAddress !== 'off') later.push('Add your address');

  return (
    <main className="join">
      {header}
      {step !== 'done' && progress}

      <Card>
        {step === 'plan' && (
          <div>
            <h2>Choose your membership</h2>
            {gym.plans.length === 0 ? <p className="muted">No public memberships are available right now.</p> : (
              <div className="join-plans">
                {gym.plans.map((p) => (
                  <article key={p.id} className="join-plan">
                    <h3>{p.name}{isFreePlan(p) && <span className="qj-badge">Free</span>}</h3>
                    <div className="join-price">{isFreePlan(p) ? 'Free' : planPrice(p)}</div>
                    {p.description && <p className="muted">{p.description}</p>}
                    {p.perks.length > 0 && <ul className="qj-perks">{p.perks.map((perk) => <li key={perk}>{perk}</li>)}</ul>}
                    {termsSentence(p.minTermMonths, p.noticeDays) && <p className="muted small">{termsSentence(p.minTermMonths, p.noticeDays)}</p>}
                    {takesPayment && !isFreePlan(p) && !canPayOnline(p)
                      ? <p className="muted small">This one cannot be paid for online. Ask {gym.name} to sign you up.</p>
                      : <Button variant="primary" disabled={busy} onClick={() => choose(p)}>Choose {p.name}</Button>}
                  </article>
                ))}
              </div>
            )}
          </div>
        )}

        {step === 'email' && (
          <form onSubmit={sent ? (e) => { e.preventDefault(); confirm(code); } : sendCode} noValidate>
            {chosenLine}
            <h2>What is your email?</h2>
            <p className="muted">No password to make up. We email you a code, and that is how you sign in.</p>
            <Field label="Email" htmlFor="quick-email" error={errors.email}>
              <Input id="quick-email" type="email" autoComplete="email" value={email} disabled={sent} onChange={(e) => setEmail(e.target.value)} />
            </Field>
            {sent && (
              <>
                <p>We sent a code to <b>{email.trim()}</b>.</p>
                <Field label="Code from the email" htmlFor="quick-code">
                  <Input id="quick-code" className="qj-code" inputMode="numeric" autoComplete="one-time-code" maxLength={14} value={code} onChange={(e) => onCode(e.target.value)} />
                </Field>
              </>
            )}
            {alertBox}
            <div className="join-nav">
              <Button onClick={sent ? () => { setSent(false); setCode(''); setMsg(null); } : back} disabled={busy}>{sent ? 'Use a different email' : 'Back'}</Button>
              <Button variant="primary" type="submit" disabled={busy}>{busy ? 'Checking…' : sent ? 'Confirm' : 'Send me a code'}</Button>
            </div>
            {sent && (
              <>
                <p><Button onClick={sendAnother} disabled={busy}>Send me a new code</Button></p>
                <p className="muted small">It can take a minute. Check your spam folder too.</p>
              </>
            )}
          </form>
        )}

        {step === 'basics' && (
          <form onSubmit={submitBasics} noValidate>
            {chosenLine}
            <h2>Just the basics</h2>
            <p className="muted">{signing ? `Next you will read and sign the terms and waiver.${later.length > 0 ? ' The rest can wait until after you have joined.' : ''}` : later.length > 0 ? 'The rest can wait until after you have joined.' : 'This is all we need.'}</p>
            <FieldRow>
              <Field label="First name" htmlFor="join-first" error={errors.firstName}><Input id="join-first" autoComplete="given-name" value={d.firstName} onChange={(e) => set({ firstName: e.target.value })} /></Field>
              <Field label="Last name" htmlFor="join-last" error={errors.lastName}><Input id="join-last" autoComplete="family-name" value={d.lastName} onChange={(e) => set({ lastName: e.target.value })} /></Field>
            </FieldRow>
            <Field label="Date of birth" htmlFor="join-dob" error={errors.dob} hint="Under 18? We will ask for a parent or guardian here."><DateInput id="join-dob" autoComplete="bday" value={d.dob} onChange={(e) => set({ dob: e.target.value })} /></Field>
            <Field label="Mobile number" htmlFor="join-phone" error={errors.phone} hint="UK numbers can start 07. For another country start with + and the country code."><Input id="join-phone" type="tel" autoComplete="tel" value={d.phone} onChange={(e) => set({ phone: e.target.value })} /></Field>
            {under18 && (
              <>
                <p className="muted">You are under 18, so a parent or guardian agrees and pays for you.</p>
                <Field label="Parent or guardian name" htmlFor="join-g-name" error={errors.guardianName}><Input id="join-g-name" value={d.guardianName} onChange={(e) => set({ guardianName: e.target.value })} /></Field>
                <Field label="Parent or guardian phone number" htmlFor="join-g-phone" error={errors.guardianPhone}><Input id="join-g-phone" type="tel" value={d.guardianPhone} onChange={(e) => set({ guardianPhone: e.target.value })} /></Field>
              </>
            )}
            {later.length > 0 && (
              <div className="qj-later">
                <h3>After you {paying ? 'pay' : 'join'}, you will:</h3>
                <ul>{later.map((l) => <li key={l}>{l}</li>)}</ul>
                <p className="muted small">Takes about two minutes.</p>
              </div>
            )}
            {alertBox}
            <div className="join-nav">
              <Button onClick={back} disabled={busy}>Back</Button>
              <Button variant="primary" type="submit" disabled={busy || !chosen}>{busy ? 'Saving…' : signing ? 'Continue' : paying ? 'Continue to payment' : 'Join'}</Button>
            </div>
          </form>
        )}

        {step === 'sign' && chosen && (
          <div>
            {chosenLine}
            <h2>Read and sign</h2>
            {!docsQ.data ? <p className="muted">Loading…</p> : (
              <SignForm slug={slug} docs={docsQ.data} under18={under18} submitLabel={paying ? 'Sign and continue to payment' : 'Sign and join'} backDisabled={busy} onBack={back} onSigned={() => { void run(() => afterBasics(chosen)); }} />
            )}
          </div>
        )}

        {step === 'pay' && chosen && (
          <div>
            <h2>Agree and pay</h2>
            <div className="join-pay-summary">
              <h3>{chosen.name}</h3>
              <div className="join-price">{payTermsText(chosen)}</div>
              {termsSentence(chosen.minTermMonths, chosen.noticeDays) && <p className="muted small">{termsSentence(chosen.minTermMonths, chosen.noticeDays)}</p>}
              {under18 && <p className="muted small">Because {d.firstName || 'this member'} is under 18, {d.guardianName || 'a parent or guardian'} agrees and pays.</p>}
            </div>
            {payment ? (
              <PayForm
                session={payment} gymId={gym.gymId} planId={chosen.id} busy={busy} onBusy={setBusy}
                onBack={() => setPayment(null)}
                onDone={(status) => finishJoin({ planName: chosen.name, confirming: status === 'pending' })}
              />
            ) : (
              <form onSubmit={submitPayer} noValidate>
                {under18 && (
                  <Field label="Parent or guardian email" htmlFor="join-payer-email" hint="Their receipts and payment reminders go here.">
                    <Input id="join-payer-email" type="email" autoComplete="email" value={payer.email} onChange={(e) => setPayer({ email: e.target.value })} />
                  </Field>
                )}
                {alertBox}
                <div className="join-nav">
                  <Button onClick={back} disabled={busy}>Back</Button>
                  <Button variant="primary" type="submit" disabled={busy}>{busy ? 'Setting up…' : 'Continue to payment'}</Button>
                </div>
              </form>
            )}
          </div>
        )}

        {step === 'done' && joined && (
          <div>
            <div className="qj-welcome">
              <span className="qj-tick" aria-hidden="true">✓</span>
              <h2>You're in{d.firstName ? `, ${d.firstName}` : ''}</h2>
              <p className="muted">
                {joined.confirming
                  ? `Payment received. Your ${joined.planName} membership switches on as soon as the bank confirms the payment. This usually takes a minute. Please do not pay again.`
                  : `${joined.planName} is active.`}
              </p>
            </div>
            <Checklist gymId={gym.gymId} slug={slug} />
            <p><LinkButton variant="secondary" href={`${siteUrl('member.html')}?gym_id=${encodeURIComponent(gym.gymId)}`}>Open the member app</LinkButton></p>
          </div>
        )}
      </Card>
    </main>
  );
}
