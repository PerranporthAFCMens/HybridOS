import { siteUrl } from '../app/site';
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useOutletContext } from 'react-router-dom';
import { useReadyAuth } from '../auth/AuthProvider';
import { changeMyEmail, changeMyPassword, getMyBirthday, getProfileNames, saveMyBirthday, updateMyName } from '../data/profile';
import { fullName } from '../shell/account';
import { Link } from 'react-router-dom';
import { Button } from '../ui/Button';
import { DateInput, Input } from '../ui/Field';
import { checkBirthday, checkEmail, checkName, checkPassword } from './account';
import type { MemberCtx } from './useMember';

type Section = 'name' | 'email' | 'password' | 'birthday' | null;

/** Who you are and how to change it, what plan you are on, and the way out. */
export function Me() {
  const auth = useReadyAuth();
  const d = useOutletContext<MemberCtx>();
  const qc = useQueryClient();
  const profile = useQuery({ queryKey: ['profile', auth.userId], queryFn: () => getProfileNames(auth.userId) });
  const birthday = useQuery({ queryKey: ['birthday', auth.userId], queryFn: () => getMyBirthday(auth.userId) });
  const [dob, setDob] = useState('');
  const [open, setOpen] = useState<Section>(null);
  const [name, setName] = useState({ display: '', first: '', last: '' });
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState({ a: '', b: '' });
  const [msg, setMsg] = useState<{ text: string; good: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

  const start = (s: Exclude<Section, null>) => {
    setMsg(null);
    if (s === 'name') setName({ display: profile.data?.displayName ?? fullName(profile.data, auth.email), first: profile.data?.firstName ?? '', last: profile.data?.lastName ?? '' });
    if (s === 'birthday') setDob(birthday.data ?? '');
    if (s === 'email') setEmail('');
    if (s === 'password') setPw({ a: '', b: '' });
    setOpen(open === s ? null : s);
  };
  const run = async (check: string | null, work: () => Promise<string>) => {
    if (check) return setMsg({ text: check, good: false });
    setBusy(true);
    setMsg(null);
    try {
      const text = await work();
      setMsg({ text, good: true });
      setOpen(null);
    } catch (e) {
      setMsg({ text: e instanceof Error ? e.message : 'Could not save that.', good: false });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mem-screen">
      <h1 className="mem-title">Me</h1>
      {msg && <div className={msg.good ? 'mem-card mem-ok' : 'mem-error'} role={msg.good ? 'status' : 'alert'}>{msg.text}</div>}

      <section className="mem-card" aria-label="Your details">
        <b className="mem-big">{profile.isSuccess ? fullName(profile.data, auth.email) : auth.email}</b>
        <div className="muted">{auth.email}</div>
        <div className="muted">{auth.gym.gymName}</div>
        {birthday.data && <div className="muted">Birthday {new Date(`${birthday.data}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })}</div>}
        <div className="mem-actions">
          <Button aria-expanded={open === 'name'} onClick={() => start('name')}>Change name</Button>
          <Button aria-expanded={open === 'birthday'} onClick={() => start('birthday')}>{birthday.data ? 'Change birthday' : 'Add birthday'}</Button>
          <Button aria-expanded={open === 'email'} onClick={() => start('email')}>Change email</Button>
          <Button aria-expanded={open === 'password'} onClick={() => start('password')}>Change password</Button>
        </div>
      </section>

      {open === 'name' && (
        <section className="mem-card" aria-label="Change name">
          <h2>Change name</h2>
          <Input aria-label="Name shown to others" placeholder="Name shown to others" value={name.display} onChange={(e) => setName({ ...name, display: e.target.value })} />
          <Input aria-label="First name" placeholder="First name" value={name.first} onChange={(e) => setName({ ...name, first: e.target.value })} />
          <Input aria-label="Last name" placeholder="Last name" value={name.last} onChange={(e) => setName({ ...name, last: e.target.value })} />
          <Button variant="primary" disabled={busy} onClick={() => void run(checkName(name.display, name.first, name.last), async () => {
            await updateMyName(auth.userId, { displayName: name.display.trim(), firstName: name.first.trim(), lastName: name.last.trim() });
            await qc.invalidateQueries({ queryKey: ['profile'] });
            return 'Your name has been updated.';
          })}>Save name</Button>
        </section>
      )}

      {open === 'birthday' && (
        <section className="mem-card" aria-label="Your birthday">
          <h2>Your birthday</h2>
          <p className="muted small">We use it to say happy birthday, and for the gym's records.</p>
          <DateInput aria-label="Date of birth" max={new Date().toISOString().slice(0, 10)} value={dob} onChange={(e) => setDob(e.target.value)} />
          <Button variant="primary" disabled={busy} onClick={() => void run(checkBirthday(dob, new Date()), async () => {
            await saveMyBirthday(auth.userId, dob);
            await qc.invalidateQueries({ queryKey: ['birthday'] });
            return 'Your birthday has been saved.';
          })}>Save birthday</Button>
        </section>
      )}

      {open === 'email' && (
        <section className="mem-card" aria-label="Change email">
          <h2>Change email</h2>
          <p className="muted small">We send a message to the new address. Your email stays as it is now until you open it and confirm.</p>
          <Input aria-label="New email address" type="email" inputMode="email" autoComplete="email" placeholder="New email address" value={email} onChange={(e) => setEmail(e.target.value)} />
          <Button variant="primary" disabled={busy} onClick={() => void run(checkEmail(email, auth.email), async () => {
            await changeMyEmail(email.trim());
            return `Check ${email.trim()} for a message and open it to confirm. Until then you sign in with ${auth.email}.`;
          })}>Send confirmation</Button>
        </section>
      )}

      {open === 'password' && (
        <section className="mem-card" aria-label="Change password">
          <h2>Change password</h2>
          <Input aria-label="New password" type="password" autoComplete="new-password" placeholder="New password (8 or more characters)" value={pw.a} onChange={(e) => setPw({ ...pw, a: e.target.value })} />
          <Input aria-label="New password again" type="password" autoComplete="new-password" placeholder="New password again" value={pw.b} onChange={(e) => setPw({ ...pw, b: e.target.value })} />
          <Button variant="primary" disabled={busy} onClick={() => void run(checkPassword(pw.a, pw.b), async () => {
            await changeMyPassword(pw.a);
            return 'Your password has been changed.';
          })}>Save password</Button>
        </section>
      )}

      <section className="mem-card" aria-label="Membership">
        <h2>Membership</h2>
        {d.plan ? (
          <>
            <div className="mem-line"><span>{d.plan.name}</span><span className="mem-pill">{d.plan.status}</span></div>
            <div className="muted small">{[d.plan.includesClasses && 'Classes', d.plan.includesOpenGym && 'Gym', d.plan.includesPt && 'Personal training'].filter(Boolean).join(' · ') || 'No services listed'}</div>
          </>
        ) : <div className="muted">{auth.gym.role !== 'member' ? 'You are on the team, so you have no membership yet. An owner can give you one from Members.' : 'No membership found for this gym.'}</div>}
        {d.plan && <Link className="btn secondary" to="/m/membership">Pause, change or cancel</Link>}
      </section>
      <section className="mem-card">
        <h2>More</h2>
        <p className="muted small">Community and billing are still in the classic app while they are rebuilt here.</p>
        <a className="btn secondary" href={`${siteUrl('member.html')}?gym_id=${encodeURIComponent(auth.gym.gymId)}`}>Open the classic app</a>
        {auth.gyms.length > 1 && <a className="btn secondary" href={`${siteUrl('choose-gym.html')}?switch=1`}>Switch gym</a>}
      </section>
      <Button onClick={() => { void auth.signOut().then(() => window.location.assign(siteUrl('login.html'))); }}>Sign out</Button>
    </div>
  );
}
