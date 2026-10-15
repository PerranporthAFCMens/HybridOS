import { useEffect, type ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { LEGACY_CHOOSER, LEGACY_LOGIN, useAuth } from '../auth/AuthProvider';
import { Shell } from '../shell/Shell';
import { Today } from '../today/Today';
import { Members } from '../members/Members';
import { MemberFile } from '../members/MemberFile';
import { Plans } from '../plans/Plans';
import { Classes } from '../classes/Classes';
import { Reports } from '../reports/Reports';
import { Estate } from '../estate/Estate';
import { ClassSetup } from '../classsetup/ClassSetup';
import { Lifts } from '../lifts/Lifts';
import { Payments } from '../payments/Payments';
import { Staff } from '../staff/Staff';
import { Settings } from '../staff/Settings';
import { Rooms } from '../rooms/Rooms';
import { Access } from '../access/Access';
import { Owners } from '../owners/Owners';
import { Door } from '../door/Door';
import { MemberView } from '../memberview/MemberView';
import { Community } from '../community/Community';
import { Review } from '../training/Review';
import { Comms } from '../comms/Comms';
import { Workouts } from '../workouts/Workouts';
import { homeFor } from '../auth/access';
import { MemberShell } from '../member/MemberShell';
import { MemberCommunity } from '../member/MemberCommunity';
import { Today as MemberToday } from '../member/Today';
import { MemberClasses } from '../member/MemberClasses';
import { Me } from '../member/Me';
import { Train } from '../train/Train';
import { Player } from '../train/Player';
import { TrainDone } from '../train/TrainDone';
import { Leaderboard } from '../train/Leaderboard';
import { Pbs } from '../train/Pbs';
import { Pt } from '../member/Pt';
import { GroupDetail, GroupList, JoinGroup } from '../groups/Groups';
import { Membership } from '../member/Membership';
import { Rules } from '../membership/Rules';
import { Requests } from '../membership/Requests';
import { SignupProcess } from '../signup/SignupProcess';
import { Privacy } from '../members/Privacy';
import { Join } from '../join/Join';
import { Finish } from '../member/Finish';
import { Strava } from '../member/Strava';
import { BASENAME } from './site';

function Leave({ to }: { to: string }) {
  useEffect(() => {
    window.location.replace(to);
  }, [to]);
  return <div className="center muted">Loading…</div>;
}

function Gate({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const { pathname } = useLocation();
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
      // The new member app opens for anyone signed in to a gym; real members are still sent to the classic app until the cutover.
      if (pathname.startsWith('/m/')) return <>{children}</>;
      const home = homeFor(auth.gym.role, auth.gym.gymId);
      return home === 'admin' ? <>{children}</> : <Leave to={home} />;
    }
  }
}

function Main() {
  const wanted = new URLSearchParams(window.location.search).get('join');
  // Back from the confirmation email: carry on with the sign-up link the person started from.
  if (wanted && /^[a-z0-9-]+$/i.test(wanted)) return <Navigate to={`/join/${wanted}`} replace />;
  return (
      <Gate>
        <Routes>
          <Route element={<MemberShell />}>
            <Route path="/m/today" element={<MemberToday />} />
            <Route path="/m/classes" element={<MemberClasses />} />
            <Route path="/m/train" element={<Train />} />
            <Route path="/m/train/pbs" element={<Pbs />} />
            <Route path="/m/train/leaderboard" element={<Leaderboard />} />
            <Route path="/m/train/pt" element={<Pt />} />
            <Route path="/m/train/done/:id" element={<TrainDone />} />
            <Route path="/m/train/class/:sessionId" element={<Player />} />
            <Route path="/m/train/:id" element={<Player />} />
            <Route path="/m/community" element={<MemberCommunity />} />
            <Route path="/m/groups" element={<GroupList />} />
            <Route path="/m/groups/join" element={<JoinGroup />} />
            <Route path="/m/groups/:id" element={<GroupDetail />} />
            <Route path="/m/me" element={<Me />} />
            <Route path="/m/membership" element={<Membership />} />
            <Route path="/m/finish" element={<Finish />} />
            <Route path="/m/strava" element={<Strava />} />
            <Route path="/m/*" element={<Navigate to="/m/today" replace />} />
          </Route>
          <Route element={<Shell />}>
            <Route path="/today" element={<Today />} />
            <Route path="/members" element={<Members />} />
            <Route path="/members/:userId" element={<MemberFile />} />
            <Route path="/plans" element={<Plans />} />
            <Route path="/classes" element={<Classes />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/estate" element={<Estate />} />
            <Route path="/staff" element={<Staff />} />
            <Route path="/rooms" element={<Rooms />} />
            <Route path="/access" element={<Access />} />
            <Route path="/owners" element={<Owners />} />
            <Route path="/door" element={<Door />} />
            <Route path="/member-view" element={<MemberView />} />
            <Route path="/community" element={<Community />} />
            <Route path="/training" element={<Review />} />
            <Route path="/communications" element={<Comms />} />
            <Route path="/workouts" element={<Workouts />} />
            <Route path="/membership-rules" element={<Rules />} />
            <Route path="/membership-requests" element={<Requests />} />
            <Route path="/signup-process" element={<SignupProcess />} />
            <Route path="/member-privacy" element={<Privacy />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/class-setup" element={<ClassSetup />} />
            <Route path="/lifts" element={<Lifts />} />
            <Route path="/payments" element={<Payments />} />
            <Route path="*" element={<Navigate to="/today" replace />} />
          </Route>
        </Routes>
      </Gate>
  );
}

export function App() {
  return (
    <BrowserRouter basename={BASENAME}>
      <Routes>
        <Route path="/join/:slug" element={<Join />} />
        <Route path="*" element={<Main />} />
      </Routes>
    </BrowserRouter>
  );
}
