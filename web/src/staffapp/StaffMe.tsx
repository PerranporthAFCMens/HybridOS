import { useQuery } from '@tanstack/react-query';
import { useOutletContext } from 'react-router-dom';
import { siteUrl } from '../app/site';
import { useReadyAuth } from '../auth/AuthProvider';
import { getProfileNames } from '../data/profile';
import { fullName, roleLabel } from '../shell/account';
import { Button, LinkButton } from '../ui/Button';
import type { StaffCtx } from './StaffShell';

const CHIPS: [string, string][] = [['mark_attendance', 'Attendance'], ['view_timetable', 'Timetable'], ['view_member_notes', 'Member notes'], ['view_reporting', 'Reporting']];

/** Me: who is signed in, what their access level lets them do, and sign out. */
export function StaffMe() {
  const auth = useReadyAuth();
  const ctx = useOutletContext<StaffCtx>();
  const profile = useQuery({ queryKey: ['profile', auth.userId], queryFn: () => getProfileNames(auth.userId) });
  const chips = CHIPS.filter(([k]) => ctx.allowed(k));
  return (
    <div className="mem-screen">
      <h1 className="mem-title">Me</h1>
      <section className="mem-card">
        <h2>{profile.isSuccess ? fullName(profile.data, auth.email) : auth.email}</h2>
        <div className="muted">{roleLabel(auth.gym.role)} at {auth.gym.gymName}</div>
        {chips.length > 0 && <div className="staff-chips">{chips.map(([k, label]) => <span key={k} className="tag good">{label}</span>)}</div>}
      </section>
      <section className="mem-actions">
        {ctx.allowed('full_access') && <LinkButton href="/today">Open the admin</LinkButton>}
        {auth.gyms.length > 1 && <a className="btn secondary" href={`${siteUrl('choose-gym')}?switch=1`}>Switch gym</a>}
      </section>
      <Button onClick={() => { void auth.signOut().then(() => window.location.assign(siteUrl('sign-in'))); }}>Sign out</Button>
    </div>
  );
}
