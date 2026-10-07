import { NavLink, Outlet } from 'react-router-dom';
import { useReadyAuth } from '../auth/AuthProvider';
import { Button } from '../ui/Button';

export function Shell() {
  const auth = useReadyAuth();
  return (
    <div className="shell">
      <aside className="side">
        <strong>{auth.gym.gymName}</strong>
        <nav aria-label="Main">
          <NavLink to="/today">Today</NavLink>
        </nav>
        {auth.gyms.length > 1 && (
          <a href="../choose-gym.html?switch=1" className="muted">Switch gym</a>
        )}
        <span className="muted">{auth.email}</span>
        <Button
          onClick={() => {
            void auth.signOut().then(() => window.location.assign('../login.html'));
          }}
        >
          Sign out
        </Button>
      </aside>
      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}
