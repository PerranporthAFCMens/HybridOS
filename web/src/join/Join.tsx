import { siteUrl } from '../app/site';
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { createAccount, currentUserId, getJoinGym, getSignupDocuments, joinWithPlan, saveJoinDetails, sendSignedCopies, signDocuments, signInToJoin } from '../data/join';
import { publicPdfUrl } from '../data/signup';
import { Button, LinkButton } from '../ui/Button';
import { Card } from '../ui/Card';
import { Checkbox, DateInput, Field, FieldRow, Input, Select } from '../ui/Field';
import {
  EMPTY_DETAILS, STEP_TITLES, answersPayload, checkAbout, checkAccount, checkAddress, checkEmergency, checkGuardian, checkSign, isUnder18, planPrice, stepsFor, toRpcArgs,
  type Answers, type JoinDetails, type StepId,
} from './calc';
import { SignaturePad } from './SignaturePad';
import './join.css';

const draftKey = (slug: string) => `hybrid-join-draft-${slug}`;

function loadDraft(slug: string): JoinDetails {
  try {
    const raw = sessionStorage.getItem(draftKey(slug));
    return raw ? { ...EMPTY_DETAILS, ...(JSON.parse(raw) as Partial<JoinDetails>) } : EMPTY_DETAILS;
  } catch {
    return EMPTY_DETAILS;
  }
}

function saveDraft(slug: string, d: JoinDetails) {
  try {
    sessionStorage.setItem(draftKey(slug), JSON.stringify(d));
  } catch {
    /* a private window may refuse; the journey still works */
  }
}

function Row({ children }: { children: ReactNode }) {
  return <FieldRow>{children}</FieldRow>;
}

/** The sign-up link a gym sends to new members: account, details, terms, plan. Open to anyone; nothing here needs a gym login. */
export function Join() {
  const { slug = '' } = useParams();
  const now = useMemo(() => new Date(), []);
  const gymQ = useQuery({ queryKey: ['join-gym', slug], queryFn: () => getJoinGym(slug), enabled: !!slug, retry: false });
  const [userId, setUserId] = useState<string | null | undefined>(undefined);
  const [step, setStep] = useState<StepId>('account');
  const [d, setD] = useState<JoinDetails>(() => loadDraft(slug));
  const [mode, setMode] = useState<'signup' | 'signin'>('signup');
  const [acct, setAcct] = useState({ email: '', password: '', confirm: '' });
  const [ticked, setTicked] = useState<Record<string, boolean>>({});
  const [answers, setAnswers] = useState<Answers>({});
  const [signName, setSignName] = useState('');
  const [signature, setSignature] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ text: string; good: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [checkEmail, setCheckEmail] = useState(false);
  const [joined, setJoined] = useState<{ planName: string; gymId: string } | null>(null);

  useEffect(() => {
    let live = true;
    currentUserId().then(
      (id) => {
        if (!live) return;
        setUserId(id);
        if (id) setStep((s) => (s === 'account' ? 'about' : s));
      },
      () => live && setUserId(null),
    );
    return () => {
      live = false;
    };
  }, []);

  const docsQ = useQuery({ queryKey: ['join-docs', slug, userId], queryFn: () => getSignupDocuments(slug), enabled: !!userId, retry: false });
  const docs = docsQ.data;
  const under18 = isUnder18(d.dob, now);
  const steps = stepsFor({ under18, hasDocuments: docs ? docs.length > 0 : false });
  const at = steps.indexOf(step);
  const gym = gymQ.data;

  const set = (patch: Partial<JoinDetails>) => {
    const next = { ...d, ...patch };
    setD(next);
    saveDraft(slug, next);
  };
  const go = (to: StepId) => {
    setMsg(null);
    setStep(to);
  };
  const next = () => go(steps[Math.min(at + 1, steps.length - 1)] ?? 'done');
  const back = () => go(steps[Math.max(at - 1, 0)] ?? 'account');
  const fail = (e: unknown) => setMsg({ text: e instanceof Error ? e.message : 'Something went wrong. Please try again.', good: false });

  const run = async (problem: string | null, work: () => Promise<void>) => {
    if (problem) return setMsg({ text: problem, good: false });
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

  const submitAccount = (e: FormEvent) => {
    e.preventDefault();
    if (!gym) return;
    void run(mode === 'signup' ? checkAccount(acct.email, acct.password, acct.confirm) : acct.email && acct.password ? null : 'Enter your email and password.', async () => {
      if (mode === 'signup') {
        const r = await createAccount(acct.email, acct.password, slug, gym.name);
        if (!r.signedIn) return setCheckEmail(true);
      } else {
        await signInToJoin(acct.email, acct.password);
      }
      setUserId(await currentUserId());
      setStep('about');
    });
  };

  const submitAbout = (e: FormEvent) => {
    e.preventDefault();
    void run(checkAbout(d, now), async () => next());
  };
  const submitAddress = (e: FormEvent) => {
    e.preventDefault();
    void run(checkAddress(d), async () => next());
  };
  const saveAll = async () => {
    await saveJoinDetails(toRpcArgs(d, now));
    next();
  };
  const submitEmergency = (e: FormEvent) => {
    e.preventDefault();
    void run(checkEmergency(d), async () => (under18 ? next() : saveAll()));
  };
  const submitGuardian = (e: FormEvent) => {
    e.preventDefault();
    void run(checkGuardian(d), saveAll);
  };
  const submitSign = (e: FormEvent) => {
    e.preventDefault();
    if (!docs) return;
    void run(checkSign({ docs, answers, ticked, name: signName, hasInk: !!signature }), async () => {
      const signatureId = await signDocuments(slug, signName, signature ?? '', answersPayload(docs, answers));
      void sendSignedCopies(signatureId);
      next();
    });
  };
  const choose = (planId: string) =>
    void run(null, async () => {
      const r = await joinWithPlan(slug, planId);
      try {
        sessionStorage.removeItem(draftKey(slug));
        sessionStorage.setItem('hybrid-gym-id', r.gymId);
      } catch {
        /* nothing to clear */
      }
      setJoined(r);
      setStep('done');
    });

  if (gymQ.isLoading || userId === undefined) return <div className="center muted">Loading…</div>;
  if (gymQ.isError || !gym) return <div className="center">This sign-up link is not valid. Ask your gym for a new one.</div>;

  const title = STEP_TITLES[step];
  const alertBox = msg && (
    <p className={`join-msg ${msg.good ? 'good' : 'bad'}`} role={msg.good ? 'status' : 'alert'}>{msg.text}</p>
  );
  const nav = (label = 'Continue', showBack = true) => (
    <div className="join-nav">
      {showBack && at > 0 && step !== 'done' ? <Button onClick={back} disabled={busy}>Back</Button> : <span />}
      <Button variant="primary" type="submit" disabled={busy}>{busy ? 'Saving…' : label}</Button>
    </div>
  );

  return (
    <main className="join">
      <header className="join-head">
        {gym.logoUrl ? <img src={gym.logoUrl} alt={gym.name} className="join-logo" /> : null}
        <h1>Join {gym.name}</h1>
        {step !== 'done' && <p className="muted">Step {Math.max(at, 0) + 1} of {steps.length - 1}: {title}</p>}
      </header>

      <Card>
        {step === 'account' && checkEmail && (
          <div>
            <h2>Check your email</h2>
            <p>We sent a link to <b>{acct.email}</b>. Open it on this device to carry on where you left off.</p>
          </div>
        )}

        {step === 'account' && !checkEmail && (
          <form onSubmit={submitAccount} noValidate>
            <h2>{mode === 'signup' ? 'Create your account' : 'Sign in to continue'}</h2>
            <Field label="Email" htmlFor="join-email"><Input id="join-email" type="email" autoComplete="email" value={acct.email} onChange={(e) => setAcct({ ...acct, email: e.target.value })} /></Field>
            <Field label="Password" htmlFor="join-password" hint={mode === 'signup' ? 'At least 8 characters.' : undefined}>
              <Input id="join-password" type="password" autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} value={acct.password} onChange={(e) => setAcct({ ...acct, password: e.target.value })} />
            </Field>
            {mode === 'signup' && (
              <Field label="Confirm password" htmlFor="join-confirm"><Input id="join-confirm" type="password" autoComplete="new-password" value={acct.confirm} onChange={(e) => setAcct({ ...acct, confirm: e.target.value })} /></Field>
            )}
            {alertBox}
            {nav(mode === 'signup' ? 'Create account' : 'Sign in', false)}
            <p><Button onClick={() => { setMsg(null); setMode(mode === 'signup' ? 'signin' : 'signup'); }}>{mode === 'signup' ? 'I already have an account' : 'Create a new account'}</Button></p>
          </form>
        )}

        {step === 'about' && (
          <form onSubmit={submitAbout} noValidate>
            <h2>About you</h2>
            <Row>
              <Field label="First name" htmlFor="join-first"><Input id="join-first" autoComplete="given-name" value={d.firstName} onChange={(e) => set({ firstName: e.target.value })} /></Field>
              <Field label="Last name" htmlFor="join-last"><Input id="join-last" autoComplete="family-name" value={d.lastName} onChange={(e) => set({ lastName: e.target.value })} /></Field>
            </Row>
            <Field label="Date of birth" htmlFor="join-dob"><DateInput id="join-dob" autoComplete="bday" value={d.dob} onChange={(e) => set({ dob: e.target.value })} /></Field>
            <Field label="Mobile number" htmlFor="join-phone" hint="UK numbers can start 07. For another country start with + and the country code."><Input id="join-phone" type="tel" autoComplete="tel" value={d.phone} onChange={(e) => set({ phone: e.target.value })} /></Field>
            {alertBox}
            {nav()}
          </form>
        )}

        {step === 'address' && (
          <form onSubmit={submitAddress} noValidate>
            <h2>Your address</h2>
            <Field label="Address line 1" htmlFor="join-line1"><Input id="join-line1" autoComplete="address-line1" value={d.line1} onChange={(e) => set({ line1: e.target.value })} /></Field>
            <Field label="Address line 2 (optional)" htmlFor="join-line2"><Input id="join-line2" autoComplete="address-line2" value={d.line2} onChange={(e) => set({ line2: e.target.value })} /></Field>
            <Row>
              <Field label="Town or city" htmlFor="join-town"><Input id="join-town" autoComplete="address-level2" value={d.town} onChange={(e) => set({ town: e.target.value })} /></Field>
              <Field label="Postcode" htmlFor="join-postcode"><Input id="join-postcode" autoComplete="postal-code" value={d.postcode} onChange={(e) => set({ postcode: e.target.value })} /></Field>
            </Row>
            {alertBox}
            {nav()}
          </form>
        )}

        {step === 'emergency' && (
          <form onSubmit={submitEmergency} noValidate>
            <h2>Emergency contact</h2>
            <p className="muted">Someone we can call if you are ill or hurt at the gym.</p>
            <Field label="Their name" htmlFor="join-ec-name"><Input id="join-ec-name" value={d.emergencyName} onChange={(e) => set({ emergencyName: e.target.value })} /></Field>
            <Field label="Their phone number" htmlFor="join-ec-phone"><Input id="join-ec-phone" type="tel" value={d.emergencyPhone} onChange={(e) => set({ emergencyPhone: e.target.value })} /></Field>
            <Field label="How they are related to you" htmlFor="join-ec-rel" hint="For example partner, parent, friend."><Input id="join-ec-rel" value={d.emergencyRelationship} onChange={(e) => set({ emergencyRelationship: e.target.value })} /></Field>
            {alertBox}
            {nav(under18 ? 'Continue' : 'Save and continue')}
          </form>
        )}

        {step === 'guardian' && (
          <form onSubmit={submitGuardian} noValidate>
            <h2>Parent or guardian</h2>
            <p className="muted">You are under 18, so we need a parent or guardian too.</p>
            <Field label="Their name" htmlFor="join-g-name"><Input id="join-g-name" value={d.guardianName} onChange={(e) => set({ guardianName: e.target.value })} /></Field>
            <Field label="Their phone number" htmlFor="join-g-phone"><Input id="join-g-phone" type="tel" value={d.guardianPhone} onChange={(e) => set({ guardianPhone: e.target.value })} /></Field>
            {alertBox}
            {nav('Save and continue')}
          </form>
        )}

        {step === 'sign' && (
          <form onSubmit={submitSign} noValidate>
            <h2>Read and sign</h2>
            {!docs ? <p className="muted">Loading…</p> : (
              <>
                <p className="muted">
                  {under18 ? 'You are under 18, so your parent or guardian reads and signs. ' : ''}
                  Read {docs.length === 1 ? 'this document' : 'these documents'}, answer any questions, then sign once at the bottom. You will be emailed a copy.
                </p>
                {docs.map((doc) => (
                  <section key={doc.id} className="join-doc" aria-label={doc.title}>
                    <h3>{doc.title}</h3>
                    {doc.source === 'pdf' && doc.filePath
                      ? <p><a href={publicPdfUrl(doc.filePath)} target="_blank" rel="noreferrer">Open the PDF to read it ({doc.fileName ?? 'document.pdf'})</a></p>
                      : <div className="join-terms" tabIndex={0}>{doc.body}</div>}
                    {doc.questions.map((q) => {
                      const a = answers[q.id] ?? { yes: null, text: '' };
                      const set = (patch: Partial<typeof a>) => setAnswers({ ...answers, [q.id]: { ...a, ...patch } });
                      return (
                        <div key={q.id} className="join-q">
                          <div className="join-q-text">{q.prompt}{q.required ? '' : ' (optional)'}</div>
                          {q.answerType === 'yes_no' && (
                            <Select aria-label={q.prompt} value={a.yes === null ? '' : a.yes ? 'yes' : 'no'} onChange={(e) => set({ yes: e.target.value === '' ? null : e.target.value === 'yes' })}>
                              <option value="">Choose…</option>
                              <option value="yes">Yes</option>
                              <option value="no">No</option>
                            </Select>
                          )}
                          {(q.answerType === 'text' || (q.detailsIfYes && a.yes === true)) && (
                            <Input aria-label={q.answerType === 'text' ? q.prompt : `Details: ${q.prompt}`} placeholder={q.answerType === 'text' ? '' : 'Please give details'} value={a.text} onChange={(e) => set({ text: e.target.value })} />
                          )}
                        </div>
                      );
                    })}
                    <Checkbox label={doc.acceptance} checked={!!ticked[doc.id]} onChange={(v) => setTicked({ ...ticked, [doc.id]: v })} />
                  </section>
                ))}
                <Field label={under18 ? "Parent or guardian's full name" : 'Your full name'} htmlFor="join-sign-name">
                  <Input id="join-sign-name" autoComplete="name" value={signName} onChange={(e) => setSignName(e.target.value)} />
                </Field>
                <SignaturePad onChange={setSignature} label={under18 ? 'Parent or guardian signature' : 'Your signature'} />
              </>
            )}
            {alertBox}
            {nav('Sign and continue')}
          </form>
        )}

        {step === 'plan' && (
          <div>
            <h2>Choose your membership</h2>
            {gym.plans.length === 0 ? <p className="muted">No public memberships are available right now.</p> : (
              <div className="join-plans">
                {gym.plans.map((p) => (
                  <article key={p.id} className="join-plan">
                    <h3>{p.name}</h3>
                    <div className="join-price">{planPrice(p)}</div>
                    <p className="muted">{p.description ?? (p.perks.join(' · ') || 'Membership')}</p>
                    <Button variant="primary" disabled={busy} onClick={() => choose(p.id)}>Choose {p.name}</Button>
                  </article>
                ))}
              </div>
            )}
            {alertBox}
            <div className="join-nav"><Button onClick={back} disabled={busy}>Back</Button><span /></div>
          </div>
        )}

        {step === 'done' && joined && (
          <div className="join-done">
            <h2>{joined.planName} is active</h2>
            <p>Welcome to {gym.name}, {d.firstName || 'and thanks for joining'}.</p>
            {docs && docs.length > 0 && <p className="muted">A signed copy of what you agreed is on its way to your email. If it does not arrive in a few minutes, check your spam folder or ask {gym.name}.</p>}
            <LinkButton variant="primary" href={`${siteUrl('member.html')}?gym_id=${encodeURIComponent(joined.gymId)}`}>Open the member app</LinkButton>
          </div>
        )}
      </Card>
    </main>
  );
}
