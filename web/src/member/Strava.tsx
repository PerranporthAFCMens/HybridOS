import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useReadyAuth } from '../auth/AuthProvider';
import { getMyStrava, listMyActivities, startStravaConnect, syncStrava } from '../data/strava';
import { Button } from '../ui/Button';
import { distance, stamp } from './calc';

/** The member's own Strava link: connect, bring in activities, see the latest ten. */
export function Strava() {
  const auth = useReadyAuth();
  const qc = useQueryClient();
  const conn = useQuery({ queryKey: ['strava', auth.gym.gymId, auth.userId], queryFn: () => getMyStrava(auth.gym.gymId, auth.userId) });
  const acts = useQuery({ queryKey: ['strava-activities', auth.userId], queryFn: () => listMyActivities(auth.userId) });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; good: boolean } | null>(null);
  const connected = conn.data?.status === 'connected';

  const connect = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const r = await startStravaConnect(auth.gym.gymId);
      if ('url' in r) window.location.assign(r.url);
      else setMsg({ text: r.message, good: false });
    } catch (e) {
      setMsg({ text: e instanceof Error ? e.message : 'Could not start the Strava connection.', good: false });
    } finally {
      setBusy(false);
    }
  };
  const sync = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const r = await syncStrava(auth.gym.gymId);
      if ('message' in r) setMsg({ text: r.message, good: false });
      else {
        setMsg({ text: `Imported or updated ${r.imported} ${r.imported === 1 ? 'activity' : 'activities'}.`, good: true });
        await Promise.all([qc.invalidateQueries({ queryKey: ['strava'] }), qc.invalidateQueries({ queryKey: ['strava-activities'] })]);
      }
    } catch (e) {
      setMsg({ text: e instanceof Error ? e.message : 'Sync failed.', good: false });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mem-screen">
      <Link className="mem-back" to="/m/me">‹ Me</Link>
      <h1 className="mem-title">Strava</h1>
      {msg && <div className={msg.good ? 'mem-card mem-ok' : 'mem-error'} role={msg.good ? 'status' : 'alert'}>{msg.text}</div>}
      <section className="mem-card" aria-label="Strava connection">
        <div className="mem-row">
          <b>{conn.isLoading ? 'Checking…' : connected ? 'Connected' : conn.data ? conn.data.status : 'Not connected'}</b>
          {connected ? <Button variant="primary" disabled={busy} onClick={() => void sync()}>{busy ? 'Syncing…' : 'Sync now'}</Button> : <Button variant="primary" disabled={busy} onClick={() => void connect()}>Connect Strava</Button>}
        </div>
        <div className="muted small">
          {connected ? (conn.data?.lastSyncedAt ? `Last synced ${stamp(conn.data.lastSyncedAt)}.` : 'Connected. Press Sync now to bring in your first activities.') : 'Connect to bring your runs, rides and other activities into HybridOne. You choose when anything is imported.'}
        </div>
      </section>
      <section className="mem-card" aria-label="Recent activities">
        <h2>Recent activities</h2>
        {acts.isLoading && <div className="muted small">Loading…</div>}
        {acts.data?.length === 0 && <div className="muted small">No imported activities yet.</div>}
        {acts.data?.map((a) => (
          <div className="mem-row" key={a.id}>
            <div>
              <b>{a.name}</b>
              <div className="muted small">{a.kind} · {stamp(a.startedAt)}</div>
            </div>
            <div>
              <b>{distance(a.distanceM)}</b>
              <div className="muted small">{a.movingSeconds ? `${Math.floor(a.movingSeconds / 60)} min` : ''}</div>
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
