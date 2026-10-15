import { Link, NavLink, Outlet } from 'react-router-dom';
import { useReadyAuth } from '../auth/AuthProvider';
import { gymLogo } from '../shell/gymBrand';
import { roleLabel } from '../shell/account';
import { can } from './calc';
import { useMyPermissions } from './useStaffApp';
import '../member/member.css';
import './staffapp.css';

export interface StaffCtx { gymId: string; userId: string; role: string; allowed: (key: string) => boolean }

const icon = (d: string) => (
  <svg viewBox="0 0 24 24" aria-hidden="true"><path d={d} /></svg>
);

/** The staff app's frame, the same shape as the member app: the gym's name on top, a few tabs at the bottom, one column in the middle. */
export function StaffShell() {
  const auth = useReadyAuth();
  const perms = useMyPermissions(auth.gym.gymId, auth.userId);
  const logo = gymLogo(auth.gym.gymId, auth.gym.logoUrl);
  const role = auth.gym.role;
  const previewing = role === 'owner' || role === 'admin';
  const ctx: StaffCtx = { gymId: auth.gym.gymId, userId: auth.userId, role, allowed: (key) => can(role, perms.data ?? {}, key) };
  return (
    <div className="mem staff">
      {previewing && (
        <div className="mem-preview">
          Previewing the staff app as {roleLabel(role).toLowerCase()}. <Link to="/today">Back to the admin</Link>
        </div>
      )}
      <header className="mem-top">
        {logo?.uploaded ? <img src={logo.src} alt="" className="mem-logo" /> : null}
        <b>{auth.gym.gymName}</b>
      </header>
      <main className="mem-main">
        {perms.isPending ? <p className="muted">Loading…</p> : <Outlet context={ctx} />}
      </main>
      <nav className="mem-tabs" aria-label="Staff">
        <NavLink to="/s/today">{icon('M3 11l9-8 9 8M5 10v10h14V10')}<span>My day</span></NavLink>
        {ctx.allowed('view_timetable') && <NavLink to="/s/timetable">{icon('M4 5h16v15H4zM4 10h16M9 3v4M15 3v4')}<span>Timetable</span></NavLink>}
        <NavLink to="/s/me">{icon('M12 12a4 4 0 100-8 4 4 0 000 8zM4 21c0-4 4-6 8-6s8 2 8 6')}<span>Me</span></NavLink>
      </nav>
    </div>
  );
}
