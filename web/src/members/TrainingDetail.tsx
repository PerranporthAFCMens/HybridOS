import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useReadyAuth } from '../auth/AuthProvider';
import { addFeedback, loadLoggedExercises, type ClientWorkout } from '../data/clientTraining';
import { emailNote, notifyTraining, type EmailResult } from '../data/notify';
import { hasPainFlag, reasonLabel, statusLabel } from '../train/calc';
import { Button } from '../ui/Button';
import { SectionTitle } from '../ui/Card';
import { Textarea } from '../ui/Field';
import { Modal } from '../ui/Modal';

const when = (iso: string) => new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London' }).format(new Date(iso));

/**
 * One workout from a client's history. For a coach's workout: what was set beside what they did, how each exercise went and
 * why, and a box for the coach to reply. For the client's own: just what they logged. Colours stay calm; nothing is a warning.
 */
export function TrainingDetail({ workout: w, clientName, onClose }: { workout: ClientWorkout; clientName: string; onClose: () => void }) {
  const { gym, userId } = useReadyAuth();
  const qc = useQueryClient();
  const logged = useQuery({ queryKey: ['logged', w.sessionId], queryFn: () => loadLoggedExercises(w.sessionId ?? ''), enabled: !!w.sessionId });
  const [reply, setReply] = useState('');
  const [error, setError] = useState('');
  const [sent, setSent] = useState<EmailResult | null>(null);
  const send = useMutation({
    mutationFn: async (body: string) => {
      const id = await addFeedback(gym.gymId, userId, w.assignmentId ?? '', body);
      // The reply is saved and the client has an in-app notice either way; the email is a bonus and may fail on its own.
      return await notifyTraining({ kind: 'feedback', feedback_id: id });
    },
    onSuccess: async (mail) => {
      setSent(mail);
      setReply('');
      await Promise.all([qc.invalidateQueries({ queryKey: ['client-training'] }), qc.invalidateQueries({ queryKey: ['needs-feedback'] })]);
    },
  });
  const submit = (body: string) => {
    if (!body.trim()) return setError('Write a line first, or tap Looks good.');
    setError('');
    setSent(null);
    send.mutate(body.trim(), { onError: (e) => setError(e.message) });
  };
  const didFor = (name: string) => logged.data?.find((l) => l.name.trim().toLowerCase() === name.trim().toLowerCase());
  const covered = new Set(w.result.map((r) => (r.swappedTo ?? r.name).trim().toLowerCase()));
  const extra = (logged.data ?? []).filter((l) => !covered.has(l.name.trim().toLowerCase()));
  return (
    <Modal title={`${w.title} by ${clientName}`} onClose={onClose}>
      <SectionTitle title={w.title} action={<Button onClick={onClose}>Close</Button>} />
      <p className="muted small">{clientName} · {when(w.at)}{w.rpe ? ` · effort ${w.rpe} of 10` : ''}{w.setByCoach ? ` · set by ${w.setBy ?? 'a coach'}` : ' · their own workout'}</p>
      {w.setByCoach && hasPainFlag(w.result) && <div className="notice tr-calm">{clientName} noted pain or discomfort on at least one exercise. Worth a conversation.</div>}
      {w.result.map((r) => {
        const did = didFor(r.swappedTo ?? r.name);
        return (
          <div className="tr-row" key={`${r.name}-${r.status}`}>
            <div className="tr-head"><b>{r.swappedTo ? `${r.name} → ${r.swappedTo}` : r.name}</b><span className={`tag tr-${r.status}`}>{statusLabel(r.status)}</span></div>
            {r.plan && <div className="muted small">Set: {r.plan}</div>}
            <div className="small">They did: {did?.text || (r.status === 'not_this_time' ? 'not this time' : 'nothing logged')}</div>
            {(r.reason || r.note) && <div className="muted small">{[reasonLabel(r.reason), r.note].filter(Boolean).join(': ')}</div>}
          </div>
        );
      })}
      {extra.length > 0 && (
        <div className="tr-row">
          <div className="tr-head"><b>{w.result.length > 0 ? 'Also logged' : 'Logged'}</b></div>
          {extra.map((l) => <div className="small" key={l.name}>{l.name}: {l.text || 'no numbers'}</div>)}
        </div>
      )}
      {logged.isPending && w.sessionId && <div className="muted small">Loading what they logged…</div>}
      {w.result.length === 0 && extra.length === 0 && !logged.isPending && <div className="muted small">Nothing was logged against this workout.</div>}
      {w.note && <div className="small">Their note: {w.note}</div>}

      {w.assignmentId && (
        <section className="tr-feedback" aria-label="Feedback">
          <h3 className="file-heading">Feedback</h3>
          {w.feedback.length === 0 && <div className="muted small">No reply yet.</div>}
          {w.feedback.map((f) => <div className="tr-reply" key={f.id}><b>{f.authorName}</b> <span className="muted small">{when(f.createdAt)}</span><div>{f.body}</div></div>)}
          <Textarea aria-label={`Feedback for ${clientName}`} maxLength={2000} placeholder={`A line for ${clientName}…`} value={reply} onChange={(e) => { setError(''); setReply(e.target.value); }} />
          <div className="assign-msg">{error && <span className="msg error" role="alert">{error}</span>}{sent && !error && <span className="msg good" role="status">Sent.{emailNote(sent, clientName)}</span>}</div>
          <div className="tr-actions">
            <Button variant="primary" disabled={send.isPending} onClick={() => submit(reply)}>{send.isPending ? 'Sending…' : 'Send feedback'}</Button>
            <Button disabled={send.isPending} onClick={() => submit('Looks good')}>Looks good</Button>
          </div>
        </section>
      )}
    </Modal>
  );
}
