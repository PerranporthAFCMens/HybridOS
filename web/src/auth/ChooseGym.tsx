import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { SITE } from '../app/site';
import { signOut } from '../data/auth';
import type { GymAccess } from '../data/memberships';
import { Button } from '../ui/Button';
import { useAuth } from './AuthProvider';
import { clearSelectedGymId, setSelectedGymId } from './gymStorage';
import { landingFor, safeReturn } from './signin';
import './signin.css';

const ROLE_LABEL: Record<string, string> = { owner: 'Owner', admin: 'Admin', coach: 'Coach', staff: 'Staff' };
const roleLabel = (role: string) => ROLE_LABEL[role] ?? 'Member';
const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();

/** Pick one gym when the account has several (or when switching). The choice is stored, then the app opens for that gym. */
export function ChooseGym() {
  const auth = useAuth();
  const params = new URLSearchParams(window.location.search);
  const switching = params.get('switch') === '1';
  const returnTo = switching ? '' : safeReturn(params.get('return_to'), window.location.origin, SITE);
  const [out, setOut] = useState(false);
  const already = auth.status === 'ready' && !switching ? returnTo || landingFor(auth.gym) : '';
  useEffect(() => {
    if (already) window.location.replace(already);
  }, [already]);

  if (auth.status === 'loading') return <div className="center muted">Loading…</div>;
  if (auth.status === 'signed-out' || out) return <Navigate to="/sign-in" replace />;
  if (auth.status === 'no-access') return <div className="center">This account does not currently have active gym access.</div>;
  if (already) return <div className="center muted">Loading…</div>;

  const gyms = auth.gyms;
  const last = (() => {
    try {
      return localStorage.getItem('hybrid-last-gym-id') ?? '';
    } catch {
      return '';
    }
  })();
  const pick = (g: GymAccess) => {
    setSelectedGymId(g.gymId);
    window.location.replace(returnTo || landingFor(g));
  };
  const leave = async () => {
    await signOut();
    clearSelectedGymId();
    setOut(true);
  };

  return (
    <main className="choose">
      <div>
        <div className="eyebrow">Your account</div>
        <h1>Choose a gym</h1>
        <p className="muted">{switching ? 'Choose the gym you want to switch to.' : 'Your account has access to more than one gym. Choose where you want to go.'}</p>
      </div>
      {gyms.map((g) => (
        <button key={g.gymId} type="button" className="choose-gym" onClick={() => pick(g)}>
          <span className="choose-gym-logo">{g.logoUrl ? <img src={g.logoUrl} alt="" /> : initials(g.gymName)}</span>
          <span>
            <b>{g.gymName}</b>
            <small>{roleLabel(g.role)}{g.gymId === last ? ' · Last used' : ''}</small>
          </span>
        </button>
      ))}
      <div><Button onClick={leave}>Sign out</Button></div>
    </main>
  );
}
