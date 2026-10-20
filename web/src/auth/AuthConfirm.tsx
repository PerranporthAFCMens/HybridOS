import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { confirmEmailLink, getPublicGymBrand } from '../data/auth';
import { Button, LinkButton } from '../ui/Button';
import { Card } from '../ui/Card';
import { parseConfirmParams } from './confirmLink';
import './signin.css';

/**
 * Where an email link lands when it opens on hybridone.co.uk. The person presses Continue, which confirms the link and signs them in.
 * Confirming only on a press (not on page load) stops mail scanners that open links from using up the one-time link.
 */
export function AuthConfirm() {
  const params = parseConfirmParams(window.location.search, window.location.origin);
  const gymId = params ? (new URL(params.next, window.location.origin).searchParams.get('gym_id') ?? '') : '';
  const brandQ = useQuery({ queryKey: ['gym-brand', gymId], queryFn: () => getPublicGymBrand(gymId), enabled: !!gymId, retry: false });
  const name = brandQ.data?.name ?? 'HybridOne';
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const go = async () => {
    if (!params) return;
    setBusy(true);
    setError('');
    try {
      await confirmEmailLink(params.tokenHash, params.type);
      window.location.replace(params.next);
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : 'Could not confirm this link.');
      setBusy(false);
    }
  };

  const heading = params?.type === 'recovery' ? 'Reset your password' : params?.type === 'invite' ? `Join ${name}` : 'Confirm your email';
  return (
    <main className="signin">
      <Card>
        <div className="eyebrow">{name}</div>
        {params ? (
          <>
            <h1>{heading}</h1>
            <p className="muted">Press Continue to finish. For your security, this link only works once.</p>
            <Button variant="primary" onClick={go} disabled={busy}>Continue</Button>
            {error && <p className="signin-msg" role="alert">{error}</p>}
            {error && <LinkButton href="/sign-in">Back to sign in</LinkButton>}
          </>
        ) : (
          <>
            <h1>This link is not valid</h1>
            <p className="muted">Open the latest HybridOne email or request another link.</p>
            <LinkButton href="/sign-in">Back to sign in</LinkButton>
          </>
        )}
      </Card>
    </main>
  );
}
