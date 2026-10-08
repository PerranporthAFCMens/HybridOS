import { NavLink, Outlet } from 'react-router-dom';
import { useReadyAuth } from '../auth/AuthProvider';
import { gymLogo } from '../shell/gymBrand';
import { roleLabel } from '../shell/account';
import { isPrivileged } from '../auth/access';
import { useMemberData } from './useMember';
import './member.css';

const icon = (d: string) => (
  <svg viewBox="0 0 24 24" aria-hidden="true"><path d={d} /></svg>
);

/** The member app's frame: the gym's name on top, four or fewer tabs at the bottom, one column in the middle. */
export function MemberShell() {
  const auth = useReadyAuth();
  const data = useMemberData();
  const logo = gymLogo(auth.gym.gymId, auth.gym.logoUrl);
  const previewing = isPrivileged(auth.gym.role);
  return (
    <div className="mem">
      {previewing && (
        <div className="mem-preview">
          Previewing the new member app as {roleLabel(auth.gym.role).toLowerCase()}. <a href="#/today">Back to the admin</a>
        </div>
      )}
      <header className="mem-top">
        {logo?.uploaded ? <img src={logo.src} alt="" className="mem-logo" /> : null}
        <b>{auth.gym.gymName}</b>
      </header>
      <main className="mem-main">
        <Outlet context={data} />
      </main>
      <nav className="mem-tabs" aria-label="Member">
        <NavLink to="/m/today">{icon('M3 11l9-8 9 8M5 10v10h14V10')}<span>Today</span></NavLink>
        {data.flags.classes && <NavLink to="/m/classes">{icon('M4 5h16v15H4zM4 10h16M9 3v4M15 3v4')}<span>Classes</span></NavLink>}
        <NavLink to="/m/me">{icon('M12 12a4 4 0 100-8 4 4 0 000 8zM4 21c0-4 4-6 8-6s8 2 8 6')}<span>Me</span></NavLink>
      </nav>
    </div>
  );
}
