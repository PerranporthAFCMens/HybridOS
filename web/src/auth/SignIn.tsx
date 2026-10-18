import { useEffect, useState, type FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Navigate } from 'react-router-dom';
import { siteUrl, SITE } from '../app/site';
import { getPublicGymBrand, sendPasswordReset, sendSignInLink, signInWithPassword } from '../data/auth';
import { Button, LinkButton } from '../ui/Button';
import { Card } from '../ui/Card';
import { Field, Input, PasswordInput } from '../ui/Field';
import { useAuth } from './AuthProvider';
import { setSelectedGymId } from './gymStorage';
import { authReturnUrl, landingFor, safeReturn } from './signin';
import './signin.css';

/** The one sign-in page. Works out what to do next from who is signed in, and never decides gym access itself. */
export function SignIn() {
  const auth = useAuth();
  const params = new URLSearchParams(window.location.search);
  const hintGymId = params.get('gym_id') ?? '';
  const returnTo = safeReturn(params.get('return_to'), window.location.origin, SITE);
  const brandQ = useQuery({ queryKey: ['gym-brand', hintGymId], queryFn: () => getPublicGymBrand(hintGymId), enabled: !!hintGymId, retry: false });

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; good: boolean } | null>(null);
  const say = (text: string, good = false) => setMsg({ text, good });

  // Signed in: go where this person belongs. A gym named in the link must be one they have access to.
  const signedInGyms = auth.status === 'ready' || auth.status === 'choose-gym' ? auth.gyms : null;
  const chosen = signedInGyms ? (hintGymId ? signedInGyms.find((g) => g.gymId === hintGymId) : auth.status === 'ready' ? auth.gym : undefined) : undefined;
  const denied = !!signedInGyms && !!hintGymId && !chosen;
  useEffect(() => {
    if (!chosen) return;
    setSelectedGymId(chosen.gymId);
    window.location.replace(returnTo || landingFor(chosen));
  }, [chosen, returnTo]);

  if (auth.status === 'choose-gym' && !hintGymId) {
    return <Navigate to={`/choose-gym${returnTo ? `?return_to=${encodeURIComponent(returnTo)}` : ''}`} replace />;
  }

  const wanted = email.trim().toLowerCase();
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setMsg(null);
    if (!wanted || !password) return say('Enter your email and password.');
    setBusy(true);
    try {
      await signInWithPassword(wanted, password);
    } catch {
      say('Email or password not recognised.');
    } finally {
      setBusy(false);
    }
  };
  const mail = async (send: () => Promise<void>, ok: string, bad: string) => {
    setMsg(null);
    if (!wanted) return say('Enter your email address first.');
    setBusy(true);
    try {
      await send();
      say(ok, true);
    } catch {
      say(bad);
    } finally {
      setBusy(false);
    }
  };

  const brand = brandQ.data;
  return (
    <main className="signin">
      <Card>
        {brand?.logoUrl && <img className="signin-logo" src={brand.logoUrl} alt={brand.name ?? ''} />}
        <div className="eyebrow">{brand?.name ?? 'HybridOne'}</div>
        <h1>Sign in</h1>
        <p className="muted">Use the email address and password linked to your HybridOne account. If your account has more than one gym, you choose where to go next.</p>
        {hintGymId && <p className="muted small">This link will open {brand?.name ?? 'that gym'} if your account has access.</p>}
        <form onSubmit={submit}>
          <Field label="Email" htmlFor="signin-email">
            <Input id="signin-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <Field label="Password" htmlFor="signin-password">
            <PasswordInput id="signin-password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </Field>
          <Button variant="primary" type="submit" disabled={busy || auth.status === 'loading'}>Sign in</Button>
        </form>
        <div className="signin-links">
          <Button disabled={busy} onClick={() => mail(() => sendPasswordReset(wanted, authReturnUrl('recovery')), 'Check your email for a password reset link.', 'Could not send a reset link.')}>Forgot password?</Button>
          <Button disabled={busy} onClick={() => mail(() => sendSignInLink(wanted, authReturnUrl('magic')), 'Check your email for a secure sign-in link.', 'Could not send a sign-in link.')}>Email me a sign-in link</Button>
        </div>
        {denied && <p className="signin-msg">This account does not have access to the gym in this link.</p>}
        {auth.status === 'no-access' && <p className="signin-msg">This account does not currently have active access to a gym.</p>}
        {msg && <p className={`signin-msg${msg.good ? ' good' : ''}`} role="status">{msg.text}</p>}
        <LinkButton href={siteUrl('')}>Back to HybridOne</LinkButton>
      </Card>
    </main>
  );
}
