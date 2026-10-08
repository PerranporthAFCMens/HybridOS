import { useQuery } from '@tanstack/react-query';
import { useOutletContext } from 'react-router-dom';
import { useReadyAuth } from '../auth/AuthProvider';
import { getProfileNames } from '../data/profile';
import { fullName } from '../shell/account';
import { Button } from '../ui/Button';
import type { MemberCtx } from './useMember';

/** Who you are, what plan you are on, and the way out. */
export function Me() {
  const auth = useReadyAuth();
  const d = useOutletContext<MemberCtx>();
  const profile = useQuery({ queryKey: ['profile', auth.userId], queryFn: () => getProfileNames(auth.userId) });
  return (
    <div className="mem-screen">
      <h1 className="mem-title">Me</h1>
      <section className="mem-card">
        <b className="mem-big">{profile.isSuccess ? fullName(profile.data, auth.email) : auth.email}</b>
        <div className="muted">{auth.email}</div>
        <div className="muted">{auth.gym.gymName}</div>
      </section>
      <section className="mem-card" aria-label="Membership">
        <h2>Membership</h2>
        {d.plan ? (
          <>
            <div className="mem-line"><span>{d.plan.name}</span><span className="mem-pill">{d.plan.status}</span></div>
            <div className="muted small">{[d.plan.includesClasses && 'Classes', d.plan.includesOpenGym && 'Gym', d.plan.includesPt && 'Personal training'].filter(Boolean).join(' · ') || 'No services listed'}</div>
          </>
        ) : <div className="muted">No membership found for this gym.</div>}
      </section>
      <section className="mem-card">
        <h2>More</h2>
        <p className="muted small">Workouts, personal bests, community and billing are still in the classic app while they are rebuilt here.</p>
        <a className="btn secondary" href={`../member.html?gym_id=${encodeURIComponent(auth.gym.gymId)}`}>Open the classic app</a>
        {auth.gyms.length > 1 && <a className="btn secondary" href="../choose-gym.html?switch=1">Switch gym</a>}
      </section>
      <Button onClick={() => { void auth.signOut().then(() => window.location.assign('../login.html')); }}>Sign out</Button>
    </div>
  );
}
