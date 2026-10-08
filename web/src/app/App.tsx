import { useEffect, type ReactNode } from 'react';
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { LEGACY_CHOOSER, LEGACY_LOGIN, useAuth } from '../auth/AuthProvider';
import { Shell } from '../shell/Shell';
import { Today } from '../today/Today';
import { Members } from '../members/Members';
import { Plans } from '../plans/Plans';
import { Classes } from '../classes/Classes';
import { Reports } from '../reports/Reports';
import { ClassSetup } from '../classsetup/ClassSetup';
import { Staff } from '../staff/Staff';
import { Settings } from '../staff/Settings';
import { Rooms } from '../rooms/Rooms';
import { Access } from '../access/Access';
import { Owners } from '../owners/Owners';
import { Door } from '../door/Door';
import { MemberView } from '../memberview/MemberView';
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
            <Route path="/classes" element={<Classes />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/staff" element={<Staff />} />
            <Route path="/rooms" element={<Rooms />} />
            <Route path="/access" element={<Access />} />
            <Route path="/owners" element={<Owners />} />
            <Route path="/door" element={<Door />} />
            <Route path="/member-view" element={<MemberView />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/class-setup" element={<ClassSetup />} />
            <Route path="*" element={<Navigate to="/today" replace />} />
          </Route>
        </Routes>
      </Gate>
    </HashRouter>
  );
}
