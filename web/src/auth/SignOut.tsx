import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { signOut } from '../data/auth';
import { clearSelectedGymId } from './gymStorage';

/** Ends the session, forgets the selected gym, then shows sign-in. */
export function SignOut() {
  const [done, setDone] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let live = true;
    clearSelectedGymId();
    signOut().then(
      () => live && setDone(true),
      () => live && setFailed(true),
    );
    return () => {
      live = false;
    };
  }, []);
  if (done) return <Navigate to="/sign-in" replace />;
  if (failed) return <div className="center">Could not sign out. Please try again.</div>;
  return <div className="center muted">Signing you out…</div>;
}
