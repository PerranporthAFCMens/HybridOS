import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useReadyAuth } from '../auth/AuthProvider';
import { getProfileNames } from '../data/profile';
import { Button } from '../ui/Button';
import { fullName, roleLabel } from './account';
import { gymLogo } from './gymBrand';
import './shell.css';

/** The pages in the sidebar. Every other page was opened from one of them, so it gets a Back link. */
const TOP_PAGES = ['/today', '/members', '/plans', '/classes', '/workouts', '/reports', '/community', '/communications', '/settings'];

function BackLink() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  if (TOP_PAGES.includes(pathname)) return null;
  // Go back to wherever they came from; when the page was opened directly, go to Settings (where most of these live).
  const canGoBack = typeof window.history.state?.idx === 'number' && window.history.state.idx > 0;
  return (
    <button type="button" className="back-link" onClick={() => { if (canGoBack) void navigate(-1); else void navigate('/settings'); }}>
      ‹ Back
    </button>
  );
}

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
          <NavLink to="/m/today" onClick={close}>Preview as member</NavLink>
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
        <BackLink />
        <Outlet />
      </main>
    </div>
  );
}
