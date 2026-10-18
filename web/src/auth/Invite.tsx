import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { Session } from '@supabase/supabase-js';
import { siteUrl } from '../app/site';
import { claimAccessInvite, getAccessInvite, getSession, onSessionChange, signInWithPassword, signOut, signUpForInvite, updatePassword, type ClaimedInvite } from '../data/auth';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Field, Input, PasswordInput } from '../ui/Field';
import { inviteNotice, inviteReturnUrl, inviteUsable, roleLabel } from './invite';
import { setSelectedGymId } from './gymStorage';
import './signin.css';

/** An Admin or Owner invitation: create an account or sign in as the invited email, then accept. */
export function Invite() {
  const params = new URLSearchParams(window.location.search);
  const token = params.get('token') ?? params.get('access_invite') ?? '';
  const inviteQ = useQuery({ queryKey: ['access-invite', token], queryFn: () => getAccessInvite(token), enabled: !!token, retry: false });
  const invite = inviteQ.data ?? null;

  const [session, setSession] = useState<Session | null | undefined>(undefined);
  useEffect(() => {
    let live = true;
    getSession().then((s) => live && setSession(s), () => live && setSession(null));
    const off = onSessionChange((s) => live && setSession(s));
    return () => {
      live = false;
      off();
    };
  }, []);

  const [mode, setMode] = useState<'signup' | 'login'>('signup');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [passwordMsg, setPasswordMsg] = useState<{ text: string; good: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; good: boolean } | null>(null);
  const [claimed, setClaimed] = useState<ClaimedInvite | null>(null);
  const claimStarted = useRef(false);
  const say = (text: string, good = false) => setMsg({ text, good });

  const signedInEmail = session?.user.email?.toLowerCase() ?? '';
  const matches = !!invite && !!session && signedInEmail === invite.email.toLowerCase();
  const mismatch = !!invite && !!session && !matches;

  const claim = async () => {
    setBusy(true);
    setMsg(null);
    try {
      setClaimed(await claimAccessInvite(token));
    } catch (e) {
      say(e instanceof Error && e.message ? e.message : 'Could not accept invitation.');
    } finally {
      setBusy(false);
    }
  };
  // Signed in as the invited email with a usable invitation: accept it straight away, once.
  const autoClaim = matches && !claimed && !!invite && ['open', 'claimed', 'approved'].includes(invite.status);
  useEffect(() => {
    if (!autoClaim || claimStarted.current) return;
    claimStarted.current = true;
    void claim();
    // claim is stable enough for a one-shot; it only reads token.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoClaim]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!invite) return;
    if (!password) return say('Enter a password.');
    setBusy(true);
    setMsg(null);
    try {
      if (mode === 'signup') {
        const result = await signUpForInvite(invite.email, password, name.trim(), inviteReturnUrl(token));
        if (result === 'exists') {
          setMode('login');
          say('This email already has an account, so no confirmation email was sent. Sign in with your existing password to accept the invitation.');
        } else if (result === 'confirm') {
          say('Account created. Confirm your email, then return to this same invitation link.', true);
        }
      } else {
        await signInWithPassword(invite.email, password);
      }
    } catch (err) {
      say(err instanceof Error && err.message ? err.message : 'Could not continue.');
    } finally {
      setBusy(false);
    }
  };

  const switchAccount = async () => {
    setBusy(true);
    try {
      await signOut();
      setMode('login');
      say(`Signed out. Now sign in with ${invite?.email ?? 'the invited email'}.`, true);
    } catch (err) {
      say(err instanceof Error && err.message ? err.message : 'Could not sign out.');
    } finally {
      setBusy(false);
    }
  };

  const savePassword = async () => {
    setPasswordMsg(null);
    if (newPassword.length < 8) return setPasswordMsg({ text: 'Use at least 8 characters.', good: false });
    setBusy(true);
    try {
      await updatePassword(newPassword);
      setPasswordMsg({ text: 'Password set. You can use this email and password next time.', good: true });
      setNewPassword('');
    } catch (err) {
      setPasswordMsg({ text: err instanceof Error && err.message ? err.message : 'Could not set password.', good: false });
    } finally {
      setBusy(false);
    }
  };

  const open = () => {
    if (claimed) setSelectedGymId(claimed.gymId);
    window.location.assign(siteUrl('today'));
  };

  let body;
  if (!token) {
    body = <p className="signin-msg">This invitation link is incomplete.</p>;
  } else if (inviteQ.isLoading || session === undefined) {
    body = <p className="muted">Checking invitation…</p>;
  } else if (inviteQ.isError) {
    body = <p className="signin-msg" role="alert">Invitation could not be loaded.</p>;
  } else if (!invite) {
    body = <p className="signin-msg" role="alert">Invitation not found.</p>;
  } else {
    const label = roleLabel(invite.role);
    body = (
      <>
        <div className="eyebrow">{label} invitation</div>
        <h1>Join {invite.gymName} as {label}</h1>
        <p className="muted">This invitation is for {invite.email}.</p>
        <p className="notice">{inviteNotice(invite)}</p>
        {!inviteUsable(invite) ? (
          <p className="signin-msg" role="alert">This invitation can no longer be used.</p>
        ) : claimed ? (
          <>
            <p className="notice">
              {claimed.active
                ? `Access activated. You now have ${claimed.role === 'owner' ? 'equal Owner' : 'Admin'} access to ${invite.gymName}.`
                : 'Account linked. Your access is read-only until the required Owner approval is complete.'}
            </p>
            {session?.user.invited_at && (
              <div className="signin-pw">
                <Field label="Set a password for future sign-ins" htmlFor="new-password">
                  <PasswordInput id="new-password" autoComplete="new-password" minLength={8} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
                </Field>
                <Button onClick={() => void savePassword()} disabled={busy}>Set password</Button>
                {passwordMsg && <p className={`signin-msg${passwordMsg.good ? ' good' : ''}`} role="status">{passwordMsg.text}</p>}
              </div>
            )}
            <Button variant="primary" onClick={open}>Open {invite.gymName}</Button>
          </>
        ) : mismatch ? (
          <>
            <p className="notice">Different account signed in. You are currently signed in as {session?.user.email}. This invite is for {invite.email}.</p>
            <Button variant="primary" onClick={() => void switchAccount()} disabled={busy}>Sign out and continue with invited email</Button>
          </>
        ) : matches ? (
          <Button variant="primary" onClick={() => void claim()} disabled={busy}>Accept {invite.gymName} invite</Button>
        ) : (
          <form onSubmit={submit}>
            <div className="signin-links">
              <Button type="button" variant={mode === 'signup' ? 'primary' : 'secondary'} onClick={() => setMode('signup')}>Create account</Button>
              <Button type="button" variant={mode === 'login' ? 'primary' : 'secondary'} onClick={() => setMode('login')}>Sign in</Button>
            </div>
            {mode === 'signup' && (
              <Field label="Your name" htmlFor="invite-name">
                <Input id="invite-name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
              </Field>
            )}
            <Field label="Email" htmlFor="invite-email">
              <Input id="invite-email" type="email" readOnly value={invite.email} />
            </Field>
            <Field label="Password" htmlFor="invite-password">
              <PasswordInput id="invite-password" autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} value={password} onChange={(e) => setPassword(e.target.value)} />
            </Field>
            <Button variant="primary" type="submit" disabled={busy}>{mode === 'signup' ? 'Create account' : 'Sign in'}</Button>
          </form>
        )}
        {msg && <p className={`signin-msg${msg.good ? ' good' : ''}`} role="alert">{msg.text}</p>}
      </>
    );
  }

  return (
    <main className="signin">
      <Card>{body}</Card>
    </main>
  );
}
