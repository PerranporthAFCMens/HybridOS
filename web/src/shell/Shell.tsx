import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useReadyAuth } from '../auth/AuthProvider';
import { Button } from '../ui/Button';
import { gymLogo } from './gymBrand';
import { links } from './legacy';
import './shell.css';

// Screens not yet moved open their old page inside the old Admin shell.
const OLD_SCREENS = [
  { label: 'Classes and workouts', href: links.classes },
  { label: 'Messages and community', href: links.communications },
  { label: 'Reports', href: links.reports },
  { label: 'Settings and staff', href: links.settings },
] as const;

export function Shell() {
  const auth = useReadyAuth();
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  const logo = gymLogo(auth.gym.gymId, auth.gym.logoUrl);
  return (
    <div className={`shell${open ? ' open' : ''}`}>
      <button type="button" className="menu-btn" aria-label="Open menu" onClick={() => setOpen(true)}>
        <span aria-hidden="true">☰</span>
      </button>
      <button type="button" className="backdrop" aria-label="Close menu" onClick={close} />
      <aside className="side">
        <div className="brand">
          <img src="../assets/brand/logo/svg/hybridone-logo-on-dark.svg" alt="HybridOne" height={34} />
        </div>
        <div className="gym">
          {logo?.uploaded && <img className="gym-tile" src={logo.src} alt="" />}
          <div className="gym-text">
            {logo && !logo.uploaded && <img className="gym-wordmark" src={logo.src} alt="" />}
            <small>Current gym</small>
            <b>{auth.gym.gymName}</b>
            {auth.gyms.length > 1 && <a href="../choose-gym.html?switch=1">Switch gym</a>}
          </div>
        </div>
        <nav className="nav" aria-label="Main">
          <NavLink to="/today" onClick={close}>Today</NavLink>
          <NavLink to="/members" onClick={close}>Members</NavLink>
          {OLD_SCREENS.map((s) => (
            <a key={s.label} href={s.href}>{s.label}</a>
          ))}
          <div className="section">Preview</div>
          <a href="../member.html?view=member">Preview as member</a>
          <a href="../staff.html?view=staff">Preview as staff</a>
        </nav>
        <div className="account">
          <span className="email">{auth.email}</span>
          <Button
            onClick={() => {
              void auth.signOut().then(() => window.location.assign('../login.html'));
            }}
          >
            Sign out
          </Button>
        </div>
      </aside>
      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}
