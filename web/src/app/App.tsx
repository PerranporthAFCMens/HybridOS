import { useEffect, type ReactNode } from 'react';
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { LEGACY_CHOOSER, LEGACY_LOGIN, useAuth } from '../auth/AuthProvider';
import { Shell } from '../shell/Shell';
import { Today } from '../today/Today';
import { Members } from '../members/Members';
import { Plans } from '../plans/Plans';
import { homeFor } from '../auth/access';

function Leave({ to }: { to: string }) {
  useEffect(() => {
    window.location.replace(to);
  }, [to]);
  return <div className="center muted">Loading…</div>;
}

function Gate({ children }: { children: ReactNode }) {
  const auth = useAuth();
  switch (auth.status) {
    case 'loading':
      return <div className="center muted">Loading…</div>;
    case 'signed-out':
      return <Leave to={LEGACY_LOGIN} />;
    case 'choose-gym':
      return <Leave to={`${LEGACY_CHOOSER}`} />;
    case 'no-access':
      return <div className="center">You do not have access to a gym yet.</div>;
    case 'ready': {
      const home = homeFor(auth.gym.role, auth.gym.gymId);
      return home === 'admin' ? <>{children}</> : <Leave to={home} />;
    }
  }
}

export function App() {
  return (
    <HashRouter>
      <Gate>
        <Routes>
          <Route element={<Shell />}>
            <Route path="/today" element={<Today />} />
            <Route path="/members" element={<Members />} />
            <Route path="/plans" element={<Plans />} />
            <Route path="*" element={<Navigate to="/today" replace />} />
          </Route>
        </Routes>
      </Gate>
    </HashRouter>
  );
}
