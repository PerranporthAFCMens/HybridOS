import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useReadyAuth } from '../auth/AuthProvider';
import { getLiftLeaderboard, listTrackedLifts } from '../data/lifts';
import { Select } from '../ui/Field';
import { LeaderboardChoice } from './LeaderboardChoice';

/** The heaviest recorded lift for each exercise the gym has ticked. Ties share a place; your own row is always shown to you. */
export function Leaderboard() {
  const { gym } = useReadyAuth();
  const lifts = useQuery({ queryKey: ['m-tracked-lifts', gym.gymId], queryFn: () => listTrackedLifts(gym.gymId) });
  const [pick, setPick] = useState('');
  const key = lifts.data?.find((l) => l.key === pick)?.key ?? lifts.data?.[0]?.key ?? '';
  const board = useQuery({ queryKey: ['m-lift-board', gym.gymId, key], queryFn: () => getLiftLeaderboard(gym.gymId, key), enabled: key !== '' });
  const name = lifts.data?.find((l) => l.key === key)?.name ?? '';
  return (
    <div className="mem-screen">
      <div>
        <Link to="/m/train" className="mem-back">‹ Workouts</Link>
        <h1 className="mem-title">Leaderboards</h1>
        <div className="mem-hi">The heaviest weight recorded for each big lift.</div>
      </div>
      {lifts.isPending && <div className="muted">Loading…</div>}
      {lifts.isError && <div className="mem-error" role="alert">Could not load the leaderboards.</div>}
      {lifts.data?.length === 0 && <section className="mem-card"><div className="muted">No lifts have a leaderboard yet.</div></section>}
      {lifts.data && lifts.data.length > 0 && (
        <section className="mem-card" aria-label="Leaderboard">
          <Select aria-label="Lift" value={key} onChange={(e) => setPick(e.target.value)}>
            {lifts.data.map((l) => <option key={l.key} value={l.key}>{l.name}</option>)}
          </Select>
          {board.isPending && <div className="muted">Loading…</div>}
          {board.isError && <div className="mem-error" role="alert">Could not load this leaderboard.</div>}
          {board.data?.length === 0 && <div className="muted">Nobody is on {name} yet. Record a {name} and your best will be here.</div>}
          {board.data && board.data.length > 0 && (
            <ol className="tr-board">
              {board.data.map((r, i) => (
                <li key={`${r.rank}-${i}`} className={r.isMe ? 'me' : ''}>
                  <span className="tr-rank">{r.rank}</span>
                  <span className="tr-bname">{r.isMe ? `${r.name} (you)` : r.name}</span>
                  <b>{r.kg} kg</b>
                </li>
              ))}
            </ol>
          )}
          {board.data && board.data.length > 0 && !board.data.some((r) => r.isMe) && <div className="muted small">You are not on this one yet.</div>}
        </section>
      )}
      <section className="mem-card" aria-label="Your choice">
        <h2>Your choice</h2>
        <LeaderboardChoice />
        <div className="muted small">Other members see your name shortened, like Priya N. You can change this at any time, and it is also in <Link to="/m/me">Me</Link>.</div>
      </section>
    </div>
  );
}
