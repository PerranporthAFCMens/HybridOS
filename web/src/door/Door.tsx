import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useReadyAuth } from '../auth/AuthProvider';
import { loadDoor, saveDoor } from '../data/door';
import { Button } from '../ui/Button';
import { Card, Empty } from '../ui/Card';
import { Checkbox, Field, Input, Textarea } from '../ui/Field';
import { formFromSaved, previewOf, sameAsSaved, validateDoor, type DoorForm, type DoorSaved } from './calc';
import '../members/members.css';
import './door.css';

export function Door() {
  const { gym } = useReadyAuth();
  const q = useQuery({ queryKey: ['door', gym.gymId], queryFn: () => loadDoor(gym.gymId) });
  return (
    <>
      <header className="page-top">
        <div>
          <div className="eyebrow">Settings and staff</div>
          <h1>Door access</h1>
          <div className="muted">Control the PIN members can reveal in their HybridOne member view.</div>
        </div>
      </header>
      {q.isError && <Card><Empty>Could not load door access. Refresh to try again.</Empty></Card>}
      {q.isPending && <Card><Empty>Loading…</Empty></Card>}
      {q.isSuccess && <DoorForm key={gym.gymId} saved={q.data} />}
    </>
  );
}

function DoorForm({ saved }: { saved: DoorSaved | null }) {
  const { gym, userId } = useReadyAuth();
  const qc = useQueryClient();
  const [form, setForm] = useState<DoorForm>(() => formFromSaved(saved));
  const [note, setNote] = useState<{ text: string; good: boolean } | null>(null);
  const save = useMutation({
    mutationFn: (v: DoorSaved) => saveDoor(gym.gymId, userId, v),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['door', gym.gymId] }),
  });
  const set = <K extends keyof DoorForm>(k: K, v: DoorForm[K]) => { setNote(null); setForm((f) => ({ ...f, [k]: v })); };
  const preview = previewOf(form);
  const submit = () => {
    const check = validateDoor(form);
    if (!check.ok) return setNote({ text: check.message, good: false });
    save.mutate(check.value, {
      onSuccess: () => setNote({ text: 'Saved. Members now see this setting.', good: true }),
      onError: (e) => setNote({ text: e.message, good: false }),
    });
  };
  return (
    <Card>
      <Checkbox label="Show door access to members" checked={form.enabled} onChange={(on) => set('enabled', on)} />
      <div className="muted small door-hint">Turn this off to hide the access card completely.</div>
      <Field label="Door PIN / access code" htmlFor="door-code" hint="This is the code members reveal. Change it here whenever the physical door code changes.">
        <Input id="door-code" inputMode="numeric" autoComplete="off" maxLength={12} placeholder="4826" value={form.code} onChange={(e) => set('code', e.target.value)} />
      </Field>
      <Field label="Label members see" htmlFor="door-label"><Input id="door-label" maxLength={40} value={form.label} onChange={(e) => set('label', e.target.value)} /></Field>
      <Field label="Note for members" htmlFor="door-note"><Textarea id="door-note" maxLength={200} placeholder="Use this PIN at the main entrance." value={form.note} onChange={(e) => set('note', e.target.value)} /></Field>
      <div className="door-preview" aria-label="What members see">
        <div className="muted small">{preview.label}</div>
        <div className={`door-pin${preview.visible ? '' : ' off'}`}>{preview.code}</div>
        <div className="muted small">{preview.visible ? preview.note : 'Hidden from members: door access is switched off.'}</div>
      </div>
      {note && <div className={`msg ${note.good ? '' : 'error'}`} role={note.good ? 'status' : 'alert'}>{note.text}</div>}
      <Button variant="primary" className="wide-btn" disabled={save.isPending || sameAsSaved(form, saved)} onClick={submit}>{save.isPending ? 'Saving…' : 'Save door access'}</Button>
    </Card>
  );
}
