import { useState, type FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getPublicGymBrand, updatePassword } from '../data/auth';
import { Button, LinkButton } from '../ui/Button';
import { Card } from '../ui/Card';
import { Field, PasswordInput } from '../ui/Field';
import { useAuth } from './AuthProvider';
import { setSelectedGymId } from './gymStorage';
import { landingFor } from './signin';
import './signin.css';

/** Where an email link lands: a password reset form, or a "link verified" page that continues to the right gym. */
export function AuthReturn() {
  const auth = useAuth();
  const params = new URLSearchParams(window.location.search);
  const mode = params.get('mode') ?? 'return';
  const gymId = params.get('gym_id') ?? '';
  const brandQ = useQuery({ queryKey: ['gym-brand', gymId], queryFn: () => getPublicGymBrand(gymId), enabled: !!gymId, retry: false });
  const name = brandQ.data?.name ?? 'HybridOne';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const signInHref = `/sign-in${gymId ? `?gym_id=${encodeURIComponent(gymId)}` : ''}`;
  const gyms = auth.status === 'ready' || auth.status === 'choose-gym' ? auth.gyms : [];
  const target = gyms.find((g) => g.gymId === gymId) ?? (auth.status === 'ready' ? auth.gym : undefined);
  const go = () => {
    if (target) {
      setSelectedGymId(target.gymId);
      window.location.replace(landingFor(target));
    } else {
      window.location.assign('/choose-gym');
    }
  };

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (password.length < 8) return setError('Use at least 8 characters.');
    if (password !== confirm) return setError('Passwords do not match.');
    setBusy(true);
    try {
      await updatePassword(password);
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : 'Could not update your password.');
    } finally {
      setBusy(false);
    }
  };

  const hasSession = auth.status === 'ready' || auth.status === 'choose-gym' || auth.status === 'no-access';
  let body;
  if (auth.status === 'loading') {
    body = (
      <>
        <h1>Checking your link…</h1>
        <p className="muted">Please keep this page open while we verify your secure link.</p>
      </>
    );
  } else if (!hasSession) {
    body = (
      <>
        <h1>{mode === 'recovery' ? 'This reset link is not active' : 'This secure link is not active'}</h1>
        <p className="muted">Open the latest HybridOne email or request another link.</p>
        <LinkButton href={signInHref}>Back to sign in</LinkButton>
      </>
    );
  } else if (mode === 'recovery' && !saved) {
    body = (
      <>
        <h1>Choose a new password</h1>
        <p className="muted">Set a new password for your HybridOne account.</p>
        <form onSubmit={save}>
          <Field label="New password" htmlFor="new-password">
            <PasswordInput id="new-password" autoComplete="new-password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} />
          </Field>
          <Field label="Confirm new password" htmlFor="confirm-password">
            <PasswordInput id="confirm-password" autoComplete="new-password" minLength={8} value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          </Field>
          <Button variant="primary" type="submit" disabled={busy}>Save new password</Button>
        </form>
        {error && <p className="signin-msg" role="alert">{error}</p>}
      </>
    );
  } else if (auth.status === 'no-access') {
    body = (
      <>
        <h1>{saved ? 'Password updated' : 'Secure link verified'}</h1>
        <p className="signin-msg">This account does not currently have active access to a gym.</p>
      </>
    );
  } else {
    body = (
      <>
        <h1>{saved ? 'Password updated' : 'Secure link verified'}</h1>
        <p className="muted">{saved ? 'Your new password is ready to use.' : 'Your secure sign-in link has been verified.'}</p>
        {saved && <p className="signin-msg good" role="status">Password saved.</p>}
        <Button variant="primary" onClick={go}>Continue</Button>
      </>
    );
  }

  return (
    <main className="signin">
      <Card>
        <div className="eyebrow">{name}</div>
        {body}
      </Card>
    </main>
  );
}
