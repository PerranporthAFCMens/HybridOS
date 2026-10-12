import { useState } from 'react';
import { useReadyAuth } from '../auth/AuthProvider';
import type { TemplateRow } from '../data/workouts';
import { Button } from '../ui/Button';
import { Select } from '../ui/Field';
import { useTemplates } from '../workouts/useWorkouts';
import { Editor } from '../workouts/Workouts';
import { blockLabel, blockWeek, gymDay } from './blocks';
import { useBlockOfClass } from './useBlocks';
import { useClassWorkout, useClassWorkoutWrites } from './useClassWorkout';

/**
 * The workout for one class. The coach picks one from the library (or builds a new one right here), and then makes it
 * available. Until then it is a draft nobody else can see. Once available, the people booked into the class, or marked
 * attended, can open it in their app and record their own weights, reps and times.
 */
export function ClassWorkoutPanel({ sessionId, startsAt, onBuilding }: { sessionId: string; startsAt: string; onBuilding: (building: boolean) => void }) {
  const { gym, userId } = useReadyAuth();
  const q = useClassWorkout(sessionId);
  const library = useTemplates(gym.gymId);
  const w = useClassWorkoutWrites(gym.gymId, userId, sessionId);
  const blockQ = useBlockOfClass(sessionId);
  const [picking, setPicking] = useState(false);
  const [building, setBuilding] = useState(false);
  const [chosen, setChosen] = useState('');
  const [error, setError] = useState('');
  const [removing, setRemoving] = useState(false);
  const fail = (e: Error) => setError(e.message);
  const startBuilding = (b: boolean) => { setBuilding(b); onBuilding(b); };

  if (building) {
    return (
      <Editor
        template={null}
        onClose={() => startBuilding(false)}
        onSaved={(t: TemplateRow) => w.attach.mutate(t, { onSuccess: () => { setError(''); startBuilding(false); setPicking(false); }, onError: fail })}
      />
    );
  }

  const cw = q.data;
  const choose = () => {
    const t = library.data?.find((x) => x.id === chosen);
    if (!t) return setError('Choose a workout first.');
    setError('');
    w.attach.mutate(t, { onSuccess: () => { setPicking(false); setChosen(''); }, onError: fail });
  };
  const picker = (
    <div className="cw-pick">
      <Select aria-label="Workout from your library" value={chosen} onChange={(e) => setChosen(e.target.value)}>
        <option value="">Choose a workout…</option>
        {library.data?.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
      </Select>
      <div className="cw-actions">
        <Button variant="primary" disabled={w.attach.isPending} onClick={choose}>{w.attach.isPending ? 'Adding…' : cw ? 'Use this one instead' : 'Add to this class'}</Button>
        <Button onClick={() => startBuilding(true)}>Build a new workout</Button>
        {cw && <Button onClick={() => { setPicking(false); setError(''); }}>Cancel</Button>}
      </div>
    </div>
  );

  return (
    <section className="cw-panel" aria-label="Class workout">
      <h4 className="detail-heading">Workout for this class</h4>
      {blockQ.data && <p className="muted small">{blockLabel(blockQ.data.name, blockWeek(blockQ.data.startsOn, blockQ.data.weeks, gymDay(startsAt)), blockQ.data.weeks)}</p>}
      {q.isPending && <p className="muted small">Loading…</p>}
      {q.isError && <p className="muted small">Could not load this class's workout. Close and open the class to try again.</p>}
      {q.data === null && !picking && (
        <>
          <p className="muted small">No workout yet. Add one, then make it available when you want the class to see it.</p>
          {picker}
        </>
      )}
      {cw && (
        <>
          <div className="cw-line">
            <b>{cw.title}</b>
            <span className={`tag ${cw.availableAt ? 'good' : ''}`.trim()}>{cw.availableAt ? 'Available' : 'Draft'}</span>
          </div>
          <p className="muted small">
            {cw.availableAt
              ? 'People booked into this class, or marked attended, can open it in their app and record what they did.'
              : 'A draft: nobody else can see it yet. Make it available when the class is ready for it.'}
          </p>
          {!picking && (
            <div className="cw-actions">
              <Button variant={cw.availableAt ? 'secondary' : 'primary'} disabled={w.available.isPending} onClick={() => { setError(''); w.available.mutate(!cw.availableAt, { onError: fail }); }}>
                {cw.availableAt ? 'Take it back' : 'Make available to the class'}
              </Button>
              <Button onClick={() => { setPicking(true); setError(''); }}>Change workout</Button>
              {!removing
                ? <Button onClick={() => setRemoving(true)}>Remove</Button>
                : (
                  <>
                    <Button variant="primary" onClick={() => w.remove.mutate(undefined, { onSuccess: () => setRemoving(false), onError: fail })}>Yes, remove it</Button>
                    <Button onClick={() => setRemoving(false)}>Keep</Button>
                  </>
                )}
            </div>
          )}
          {picking && picker}
        </>
      )}
      {error && <div className="msg error" role="alert">{error}</div>}
    </section>
  );
}
