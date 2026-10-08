import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { NavLink, Outlet } from 'react-router-dom';
import { useReadyAuth } from '../auth/AuthProvider';
import { getProfileNames } from '../data/profile';
import { Button } from '../ui/Button';
import { fullName, roleLabel } from './account';
import { gymLogo } from './gymBrand';
import './shell.css';

export function Shell() {
  const auth = useReadyAuth();
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  const logo = gymLogo(auth.gym.gymId, auth.gym.logoUrl);
  const profile = useQuery({ queryKey: ['profile', auth.userId], queryFn: () => getProfileNames(auth.userId) });
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
          <NavLink to="/plans" onClick={close}>Membership plans</NavLink>
          <NavLink to="/classes" onClick={close}>Classes and workouts</NavLink>
          <NavLink to="/workouts" onClick={close}>Workout builder</NavLink>
          <NavLink to="/reports" onClick={close}>Reports</NavLink>
          <NavLink to="/community" onClick={close}>Community</NavLink>
          <NavLink to="/communications" onClick={close}>Communications</NavLink>
          <NavLink to="/settings" onClick={close}>Settings and staff</NavLink>
          <div className="section">Preview</div>
          <a href="../member.html?view=member">Preview as member</a>
          <NavLink to="/m/today" onClick={close}>Preview new member app</NavLink>
          <a href="../staff.html?view=staff">Preview as staff</a>
        </nav>
        <div className="account">
          <div className="who" title={auth.email}>
            {profile.isSuccess && <b className="who-name">{fullName(profile.data, auth.email)}</b>}
            <span className="who-role">{roleLabel(auth.gym.role)}</span>
          </div>
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
