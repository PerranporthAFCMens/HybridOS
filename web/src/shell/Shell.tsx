import { siteUrl } from '../app/site';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { MENU, SETTINGS_GROUP, groupFor, tabsFor } from './menu';
import { Icon } from './icons';
import { useReadyAuth } from '../auth/AuthProvider';
import { getProfileNames } from '../data/profile';
import { Button } from '../ui/Button';
import { fullName, roleLabel } from './account';
import { gymLogo } from './gymBrand';
import './shell.css';

/** The pages in the sidebar. Every other page was opened from one of them, so it gets a Back link. */
const TOP_PAGES = [...MENU.flatMap((g) => g.pages.map((p) => p.to)), SETTINGS_GROUP.to];

function BackLink() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  if (TOP_PAGES.includes(pathname)) return null;
  // Go back to wherever they came from; when the page was opened directly, go to its list (a member's file) or Settings (where most of these live).
  const canGoBack = typeof window.history.state?.idx === 'number' && window.history.state.idx > 0;
  return (
    <button type="button" className="back-link" onClick={() => { if (canGoBack) void navigate(-1); else void navigate(pathname.startsWith('/members/') ? '/members' : '/settings'); }}>
      ‹ Back
    </button>
  );
}

export function Shell() {
  const auth = useReadyAuth();
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  const { pathname } = useLocation();
  const group = groupFor(pathname);
  const tabs = tabsFor(pathname);
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
          <img src={siteUrl('assets/brand/logo/svg/hybridone-logo-on-dark.svg')} alt="HybridOne" height={34} />
        </div>
        <div className="gym">
          {logo?.uploaded && <img className="gym-tile" src={logo.src} alt="" />}
          <div className="gym-text">
            {logo && !logo.uploaded && <img className="gym-wordmark" src={logo.src} alt="" />}
            <small>Current gym</small>
            <b>{auth.gym.gymName}</b>
            {auth.gyms.length > 1 && <a href={`${siteUrl('choose-gym.html')}?switch=1`}>Switch gym</a>}
          </div>
        </div>
        <nav className="nav" aria-label="Main">
          {[...MENU, SETTINGS_GROUP].map((g) => (
            <NavLink key={g.key} to={g.to} className={group?.key === g.key ? 'active' : ''} onClick={close}><Icon name={g.icon} /><span>{g.label}</span></NavLink>
          ))}
          <div className="section">Preview</div>
          <NavLink to="/m/today" onClick={close}><Icon name="profile" /><span>Preview as member</span></NavLink>
          <NavLink to="/s/today" onClick={close}><Icon name="staff" /><span>Preview as staff</span></NavLink>
        </nav>
        <div className="account">
          <div className="who" title={auth.email}>
            {profile.isSuccess && <b className="who-name">{fullName(profile.data, auth.email)}</b>}
            <span className="who-role">{roleLabel(auth.gym.role)}</span>
          </div>
          <Button
            onClick={() => {
              void auth.signOut().then(() => window.location.assign(siteUrl('login.html')));
            }}
          >
            Sign out
          </Button>
        </div>
      </aside>
      <main className="main">
        <BackLink />
        {tabs.length > 0 && (
          <nav className="tabs" aria-label={group?.label}>
            {tabs.map((t) => <NavLink key={t.to} to={t.to}>{t.label}</NavLink>)}
          </nav>
        )}
        <Outlet />
        </main>
    </div>
  );
}
