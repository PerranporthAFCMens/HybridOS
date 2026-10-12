import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useReadyAuth } from '../auth/AuthProvider';
import { loadClientTraining, removeWaiting, type ClientWorkout } from '../data/clientTraining';
import { hasPainFlag, resultSummary } from '../train/calc';
import { Button } from '../ui/Button';
import { Empty } from '../ui/Card';
import { Checkbox } from '../ui/Field';
import { AssignWorkoutsDialog, type AssignNote } from '../workouts/AssignWorkouts';
import { daysAgo } from './calc';
import { TrainingDetail } from './TrainingDetail';

const day = (iso: string) => new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Europe/London' }).format(new Date(iso));

/**
 * The Training part of a client's file: what is waiting for them, and every workout they have done. The ones a coach set are
 * outlined and tagged so they stand out; open any of them to see what was set beside what they did, and reply.
 */
export function MemberTraining({ userId, name }: { userId: string; name: string }) {
  const { gym } = useReadyAuth();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['client-training', gym.gymId, userId], queryFn: () => loadClientTraining(gym.gymId, userId) });
  const [assigning, setAssigning] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [onlyCoach, setOnlyCoach] = useState(false);
  const [taking, setTaking] = useState<string | null>(null);
  const [note, setNote] = useState<AssignNote | null>(null);
  const take = useMutation({
    mutationFn: (id: string) => removeWaiting(gym.gymId, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['client-training', gym.gymId, userId] }),
  });
  const data = q.data;
  const shown = (data?.workouts ?? []).filter((w) => !onlyCoach || w.setByCoach);
  const current = data?.workouts.find((w) => w.key === open) ?? null;
  const now = new Date();
  const status = (w: ClientWorkout) => (w.setByCoach && w.assignmentId ? (w.feedback.length === 0 ? 'Needs your feedback' : 'You replied') : '');
  return (
    <section className="record-section" aria-label="Training">
      <h3>Training</h3>
      <div className="muted small">Workouts you set wait in {name}'s app with no days. They do them in their own time and you can reply.</div>
      <div className="tr-actions"><Button variant="primary" onClick={() => { setNote(null); setAssigning(true); }}>Assign workouts</Button></div>
      {note && <div className={`msg ${note.good ? 'good' : 'error'}`} role="status">{note.text}</div>}
      {take.isError && <div className="msg error" role="alert">{take.error.message}</div>}
      {q.isPending && <Empty>Loading training…</Empty>}
      {q.isError && <Empty>Could not load training. Refresh to try again.</Empty>}
      {data && data.waiting.length > 0 && (
        <div className="tr-waiting" aria-label="Waiting">
          <b>Waiting for {name}</b>
          {data.waiting.map((x) => (
            <div className="tr-wait" key={x.id}>
              <div><span>{x.title}</span><div className="muted small">{x.status === 'in_progress' ? 'Started' : `Set ${daysAgo(x.createdAt, now)}`}</div></div>
              {x.status === 'todo' && (taking === x.id
                ? <span className="tr-confirm" role="alertdialog" aria-label={`Take back ${x.title}`}><Button variant="primary" disabled={take.isPending} onClick={() => take.mutate(x.id, { onSettled: () => setTaking(null) })}>Yes, take back</Button><Button onClick={() => setTaking(null)}>Keep</Button></span>
                : <Button onClick={() => setTaking(x.id)} aria-label={`Take back ${x.title}`}>Take back</Button>)}
            </div>
          ))}
        </div>
      )}
      {data && (
        <>
          <Checkbox label="Only workouts I set" checked={onlyCoach} onChange={setOnlyCoach} />
          {shown.length === 0 && <div className="muted small">{onlyCoach ? `${name} has not done a workout you set yet.` : `${name} has not logged a workout yet.`}</div>}
          {shown.map((w) => (
            <button type="button" key={w.key} className={`tr-item${w.setByCoach ? ' by-coach' : ''}`} onClick={() => setOpen(w.key)} aria-label={`${w.title}, ${day(w.at)}${w.setByCoach ? ', set by a coach' : ''}`}>
              <span className="tr-head"><b>{w.title}</b>{w.setByCoach && <span className="tag tr-tag">Set by {w.setBy ?? 'a coach'}</span>}</span>
              <span className="muted small">{day(w.at)}{w.rpe ? ` · effort ${w.rpe}` : ''}{w.setByCoach && resultSummary(w.result) ? ` · ${resultSummary(w.result)}` : ''}</span>
              {(status(w) || (w.setByCoach && hasPainFlag(w.result))) && (
                <span className="tr-flags">{status(w) && <span className={`tag${w.feedback.length === 0 ? ' good' : ''}`}>{status(w)}</span>}{w.setByCoach && hasPainFlag(w.result) && <span className="tag">Pain noted</span>}</span>
              )}
            </button>
          ))}
        </>
      )}
      {assigning && <AssignWorkoutsDialog memberId={userId} memberName={name} onClose={(n) => { setAssigning(false); if (n) setNote(n); }} />}
      {current && <TrainingDetail workout={current} clientName={name} onClose={() => setOpen(null)} />}
    </section>
  );
}
