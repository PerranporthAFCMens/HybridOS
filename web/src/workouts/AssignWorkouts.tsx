import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useReadyAuth } from '../auth/AuthProvider';
import { assignWorkouts, loadAssignableMembers } from '../data/workouts';
import { loadClientTraining } from '../data/clientTraining';
import { Button } from '../ui/Button';
import { Empty, SectionTitle } from '../ui/Card';
import { Checkbox, Field, Select, Textarea } from '../ui/Field';
import { Modal } from '../ui/Modal';
import { useTemplates } from './useWorkouts';

export type AssignNote = { text: string; good: boolean };

/**
 * A coach gives a client one or several workouts. No days and no deadlines: they wait in the client's "From your coach"
 * list and the client does them in their own time. Opened from the Workout builder (one workout ticked, any client) or
 * from a client's file (that client fixed, nothing ticked).
 */
export function AssignWorkoutsDialog({ memberId, memberName, preselect, onClose }: { memberId?: string; memberName?: string; preselect?: string; onClose: (n?: AssignNote) => void }) {
  const { gym, userId } = useReadyAuth();
  const qc = useQueryClient();
  const templates = useTemplates(gym.gymId);
  const people = useQuery({ queryKey: ['assignable-members', gym.gymId], queryFn: () => loadAssignableMembers(gym.gymId), enabled: !memberId });
  const [member, setMember] = useState('');
  const [picked, setPicked] = useState<string[]>(preselect ? [preselect] : []);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const chosen = memberId ?? (member || people.data?.[0]?.userId || '');
  const who = memberName ?? people.data?.find((m) => m.userId === chosen)?.name ?? 'the client';
  const waiting = useQuery({ queryKey: ['client-training', gym.gymId, chosen], queryFn: () => loadClientTraining(gym.gymId, chosen), enabled: !!chosen });
  const send = useMutation({
    mutationFn: () => assignWorkouts(gym.gymId, userId, (templates.data ?? []).filter((t) => picked.includes(t.id)), chosen, note.trim() || null),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['client-training', gym.gymId, chosen] }),
  });
  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const go = () => {
    if (!chosen) return setError('Choose a client.');
    if (picked.length === 0) return setError('Tick at least one workout.');
    setError('');
    send.mutate(undefined, {
      onSuccess: () => onClose({ text: `${picked.length === 1 ? 'Workout' : `${picked.length} workouts`} sent to ${who}.`, good: true }),
      onError: (e) => setError(e.message),
    });
  };
  const waitingCount = waiting.data?.waiting.length ?? 0;
  return (
    <Modal title="Assign workouts" onClose={() => onClose()}>
      <SectionTitle title="Assign workouts" action={<Button onClick={() => onClose()}>Close</Button>} />
      <p className="muted small">Tick as many as you like. They go into {memberId ? `${who}'s` : "the client's"} From your coach list with no days set. They do them in their own time, and you can look at what they did and reply.</p>
      {!memberId && people.isPending && <Empty>Loading clients…</Empty>}
      {!memberId && people.isError && <Empty>Could not load clients.</Empty>}
      {!memberId && people.data && people.data.length === 0 && <Empty>No active members with an app login yet.</Empty>}
      {(memberId || (people.data && people.data.length > 0)) && (
        <>
          {!memberId && <Field label="Client" htmlFor="as-member"><Select id="as-member" value={chosen} onChange={(e) => setMember(e.target.value)}>{(people.data ?? []).map((m) => <option key={m.userId} value={m.userId}>{m.name}</option>)}</Select></Field>}
          {templates.isPending && <Empty>Loading workouts…</Empty>}
          {templates.data && templates.data.length === 0 && <Empty>No saved workouts yet. Build one in the Workout builder first.</Empty>}
          {templates.data && templates.data.length > 0 && (
            <div role="group" aria-label="Workouts to assign" className="assign-list">
              {templates.data.map((t) => <Checkbox key={t.id} label={`${t.title}${t.estimatedMinutes ? ` · ${t.estimatedMinutes} min` : ''}`} checked={picked.includes(t.id)} onChange={() => toggle(t.id)} />)}
            </div>
          )}
          <Field label="Note (optional)" htmlFor="as-note"><Textarea id="as-note" maxLength={500} placeholder="Take them in any order. Slow on the way down." value={note} onChange={(e) => setNote(e.target.value)} /></Field>
          {waitingCount > 0 && <p className="muted small" role="status">{who} already has {waitingCount} waiting from you.</p>}
          <div className="assign-msg">{error && <span className="msg error" role="alert">{error}</span>}</div>
          <Button variant="primary" className="wide-btn" disabled={send.isPending} onClick={go}>{send.isPending ? 'Sending…' : picked.length > 1 ? `Send ${picked.length} workouts` : 'Send workout'}</Button>
        </>
      )}
    </Modal>
  );
}
