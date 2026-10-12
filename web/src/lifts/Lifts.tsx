import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useReadyAuth } from '../auth/AuthProvider';
import { getShowByDefault, listTrackedLifts, setLiftTracked, setShowByDefault } from '../data/lifts';
import { Button } from '../ui/Button';
import { Card, Empty } from '../ui/Card';
import { Checkbox, Input } from '../ui/Field';
import { pbKey } from '../train/pb';
import { defaultText, liftRows, STARTER_LIFTS, validateLiftName } from './calc';
import '../members/members.css';
import '../staff/staff.css';
import './lifts.css';

/** Which exercises get a leaderboard, and the one switch for whether people are shown until they opt out or only if they opt in. */
export function Lifts() {
  const { gym } = useReadyAuth();
  const qc = useQueryClient();
  const lifts = useQuery({ queryKey: ['tracked-lifts', gym.gymId], queryFn: () => listTrackedLifts(gym.gymId) });
  const def = useQuery({ queryKey: ['lift-default', gym.gymId], queryFn: () => getShowByDefault(gym.gymId) });
  const [find, setFind] = useState('');
  const [custom, setCustom] = useState('');
  const [message, setMessage] = useState('');

  const refresh = async () => { await qc.invalidateQueries({ queryKey: ['tracked-lifts'] }); await qc.invalidateQueries({ queryKey: ['m-tracked-lifts'] }); };
  const fail = (e: Error) => setMessage(e.message);
  const liftsKey = ['tracked-lifts', gym.gymId];
  const defKey = ['lift-default', gym.gymId];
  // Ticks and the switch move at once; they go back only if saving fails.
  const tick = useMutation({
    mutationFn: (v: { name: string; on: boolean }) => setLiftTracked(gym.gymId, v.name, v.on),
    onMutate: (v) => {
      void qc.cancelQueries({ queryKey: liftsKey });
      const before = qc.getQueryData<{ key: string; name: string }[]>(liftsKey);
      const key = pbKey(v.name);
      qc.setQueryData<{ key: string; name: string }[]>(liftsKey, (old = []) => (v.on ? [...old.filter((t) => t.key !== key), { key, name: v.name.trim() }] : old.filter((t) => t.key !== key)));
      return { before };
    },
    onSuccess: refresh,
    onError: (e, _v, ctx) => { qc.setQueryData(liftsKey, ctx?.before); fail(e); },
  });
  const starter = useMutation({
    mutationFn: async () => { for (const n of STARTER_LIFTS) await setLiftTracked(gym.gymId, n, true); },
    onSuccess: refresh,
    onError: fail,
  });
  const switchDefault = useMutation({
    mutationFn: (on: boolean) => setShowByDefault(gym.gymId, on),
    onMutate: (on) => {
      void qc.cancelQueries({ queryKey: defKey });
      const before = qc.getQueryData<boolean>(defKey);
      qc.setQueryData(defKey, on);
      return { before };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['lift-default'] }).then(() => qc.invalidateQueries({ queryKey: ['m-lift-default'] })),
    onError: (e, _on, ctx) => { qc.setQueryData(defKey, ctx?.before); fail(e); },
  });

  const ticked = lifts.data ?? [];
  const rows = liftRows(ticked, find);
  const addCustom = () => {
    const problem = validateLiftName(custom, ticked);
    if (problem) return setMessage(problem);
    setMessage('');
    tick.mutate({ name: custom, on: true }, { onSuccess: () => setCustom('') });
  };

  return (
    <>
      <header className="page-top">
        <div>
          <div className="eyebrow">Settings and staff</div>
          <h1>Lifts and leaderboards</h1>
          <div className="muted">Choose the big lifts that get a leaderboard, and whether people are on it until they opt out.</div>
        </div>
      </header>
      {message && <div className="error" role="alert">{message}</div>}

      <Card>
        <h3>Who is on the leaderboards</h3>
        {def.isPending ? <div className="muted">Loading…</div> : (
          <>
            <Checkbox label="Members are shown unless they opt out" checked={def.data !== false} onChange={(on) => { setMessage(''); switchDefault.mutate(on); }} />
            <div className="muted" role="status">{defaultText(def.data !== false)}</div>
            <div className="muted small">Untick it and only members who choose to be shown appear. Anyone who has already made their own choice keeps it; everyone else follows this. You can change it at any time. Names are shortened (Priya N.), and a member can change their own choice in the app.</div>
          </>
        )}
      </Card>

      <Card>
        <h3>Lifts with a leaderboard</h3>
        <div className="muted">Tick a lift and members see a ranking of the heaviest weight recorded for it. Names must match what members log, so tick each name your members use (for example both Bench Press and Barbell Bench Press).</div>
        {lifts.isPending && <div className="muted">Loading…</div>}
        {lifts.isError && <div className="error" role="alert">Could not load the list.</div>}
        {lifts.data && ticked.length === 0 && (
          <Empty>
            <div>No lifts are ticked yet.</div>
            <Button onClick={() => { setMessage(''); starter.mutate(); }} disabled={starter.isPending}>Tick the usual big lifts</Button>
            <div className="muted small">{STARTER_LIFTS.join(', ')}.</div>
          </Empty>
        )}
        <div className="lift-find">
          <Input aria-label="Find an exercise" placeholder="Find an exercise" value={find} onChange={(e) => setFind(e.target.value)} />
        </div>
        <ul className="lift-list" aria-label="Exercises">
          {rows.map((r) => (
            <li key={r.key} className={r.ticked ? 'on' : ''}>
              <Checkbox label={r.name} checked={r.ticked} onChange={(on) => { setMessage(''); tick.mutate({ name: r.name, on }); }} />
            </li>
          ))}
          {rows.length === 0 && <li className="muted">Nothing matches. Add it below.</li>}
        </ul>
        <div className="lift-add">
          <Input aria-label="Another exercise" placeholder="Another exercise, if it is not in the list" value={custom} onChange={(e) => setCustom(e.target.value)} />
          <Button variant="secondary" onClick={addCustom} disabled={tick.isPending}>Add</Button>
        </div>
      </Card>
    </>
  );
}
