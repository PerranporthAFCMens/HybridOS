import { useState } from 'react';
import { useReadyAuth } from '../auth/AuthProvider';
import type { Movement } from '../data/movements';
import { ACTIVITIES } from '../train/activities';
import { Button } from '../ui/Button';
import { Card, Empty, SectionTitle } from '../ui/Card';
import { Field, FieldRow, Input, Select, Textarea } from '../ui/Field';
import { Modal } from '../ui/Modal';
import { LEVELS, LEVEL_LABEL, MOVEMENT_TRACKING, emptyMovement, missingStarters, movementKey, validateMovement, type MovementForm } from './calc';
import { useMovements, useMovementWrites } from './useMovements';
import '../members/members.css';
import '../staff/staff.css';

/** The gym's movement list: a name, a video link, a coaching cue and the Rx, Scaled and Foundations wording for each. */
export function Movements() {
  const { gym } = useReadyAuth();
  const q = useMovements(gym.gymId);
  const writes = useMovementWrites(gym.gymId);
  const [editing, setEditing] = useState<{ item: Movement | null } | null>(null);
  const [search, setSearch] = useState('');
  const [showOff, setShowOff] = useState(false);
  const [message, setMessage] = useState('');
  const all = q.data ?? [];
  const missing = q.data ? missingStarters(all.map((m) => m.name), ACTIVITIES) : [];
  const term = search.trim().toLowerCase();
  const shown = all.filter((m) => m.isActive === !showOff && (!term || m.name.toLowerCase().includes(term)));
  const offCount = all.filter((m) => !m.isActive).length;
  const fail = (e: Error) => setMessage(e.message);

  return (
    <>
      <header className="page-top">
        <div>
          <div className="eyebrow">Classes and workouts</div>
          <h1>Movements</h1>
          <div className="muted">Your gym's list of movements. The workout builder offers these as you type. Add a video, a coaching cue and what Rx, Scaled and Foundations mean for each one.</div>
        </div>
      </header>

      {q.isError && <Card><Empty>Could not load the movements. Refresh to try again.</Empty></Card>}
      {q.isPending && <Card><Empty>Loading…</Empty></Card>}
      {message && <div className="msg error" role="alert">{message}</div>}

      {q.data && (
        <Card>
          <SectionTitle title={showOff ? 'Switched off' : 'Your movements'} action={<Button variant="primary" onClick={() => { setMessage(''); setEditing({ item: null }); }}>Add movement</Button>} />
          {missing.length > 0 && !showOff && (
            <div className="msg" role="status">
              {all.length === 0 ? 'Your list is empty. ' : ''}{missing.length} standard movements (squats, rows, the Hyrox stations and more) are not in your list yet.{' '}
              <Button disabled={writes.fill.isPending} onClick={() => { setMessage(''); writes.fill.mutate(missing, { onError: fail }); }}>{writes.fill.isPending ? 'Adding…' : `Add the ${missing.length} standard movements`}</Button>
            </div>
          )}
          <Field label="Search" htmlFor="mv-search"><Input id="mv-search" placeholder="Start typing, like sled" value={search} onChange={(e) => setSearch(e.target.value)} /></Field>
          {shown.length === 0 && <Empty>{all.length === 0 ? 'No movements yet.' : 'Nothing matches.'}</Empty>}
          <ul className="team-list">
            {shown.map((m) => (
              <li key={m.id} className="team-item">
                <div className="team-main">
                  <b>{m.name}</b>
                  <div className="muted small">
                    {MOVEMENT_TRACKING.find(([v]) => v === m.tracking)?.[1] ?? m.tracking}
                    {LEVELS.filter((l) => m.levels[l]).map((l) => ` · ${LEVEL_LABEL[l]}`).join('')}
                    {m.videoUrl ? ' · Video' : ''}
                  </div>
                  {m.cue && <div className="muted small">{m.cue}</div>}
                </div>
                <div className="team-actions">
                  <Button aria-label={`Edit ${m.name}`} onClick={() => { setMessage(''); setEditing({ item: m }); }}>Edit</Button>
                  <Button aria-label={`${m.isActive ? 'Switch off' : 'Switch on'} ${m.name}`} disabled={writes.toggle.isPending} onClick={() => { setMessage(''); writes.toggle.mutate({ id: m.id, isActive: !m.isActive }, { onError: fail }); }}>{m.isActive ? 'Switch off' : 'Switch on'}</Button>
                </div>
              </li>
            ))}
          </ul>
          {offCount > 0 && <div className="archived-bar"><Button onClick={() => setShowOff((v) => !v)}>{showOff ? 'Back to your movements' : `Show switched-off movements (${offCount})`}</Button></div>}
        </Card>
      )}

      {editing && (
        <MovementEditor
          item={editing.item}
          others={all.filter((m) => m.id !== editing.item?.id).map((m) => movementKey(m.name))}
          saving={writes.save.isPending}
          onClose={() => setEditing(null)}
          onSave={(form, onError) => writes.save.mutate({ id: editing.item?.id ?? null, form }, { onSuccess: () => setEditing(null), onError: (e) => onError(e.message) })}
        />
      )}
    </>
  );
}

function MovementEditor({ item, others, saving, onClose, onSave }: { item: Movement | null; others: string[]; saving: boolean; onClose: () => void; onSave: (f: MovementForm, onError: (m: string) => void) => void }) {
  const [form, setForm] = useState<MovementForm>(item ? { name: item.name, videoUrl: item.videoUrl, cue: item.cue, tracking: item.tracking, levels: { ...item.levels } } : emptyMovement());
  const [error, setError] = useState('');
  const title = item ? `Edit ${item.name}` : 'Add a movement';
  const submit = () => {
    const problem = validateMovement(form, others);
    setError(problem);
    if (!problem) onSave(form, setError);
  };
  return (
    <Modal title={title} onClose={onClose}>
      <SectionTitle title={title} action={<Button onClick={onClose}>Close</Button>} />
      <FieldRow>
        <Field label="Name" htmlFor="mv-name"><Input id="mv-name" placeholder="Sled Push" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
        <Field label="How it is recorded" htmlFor="mv-track">
          <Select id="mv-track" value={form.tracking} onChange={(e) => setForm({ ...form, tracking: e.target.value })}>
            {MOVEMENT_TRACKING.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </Select>
        </Field>
      </FieldRow>
      <Field label="Video link" htmlFor="mv-video" hint="Optional. Must start with https://."><Input id="mv-video" inputMode="url" placeholder="https://" value={form.videoUrl} onChange={(e) => setForm({ ...form, videoUrl: e.target.value })} /></Field>
      <Field label="Coaching cue" htmlFor="mv-cue" hint="One or two lines members see beside the movement."><Textarea id="mv-cue" value={form.cue} onChange={(e) => setForm({ ...form, cue: e.target.value })} /></Field>
      <p className="muted small">What each level means for this movement. Leave a level blank if you do not use it.</p>
      {LEVELS.map((l) => (
        <Field key={l} label={LEVEL_LABEL[l]} htmlFor={`mv-${l}`}>
          <Input id={`mv-${l}`} placeholder={l === 'rx' ? '4 x 20 m at 152 kg' : l === 'scaled' ? '4 x 20 m at 102 kg' : '2 x 20 m, empty sled'} value={form.levels[l]} onChange={(e) => setForm({ ...form, levels: { ...form.levels, [l]: e.target.value } })} />
        </Field>
      ))}
      <div className="assign-msg">{error && <span className="msg error" role="alert">{error}</span>}</div>
      <Button variant="primary" className="wide-btn" disabled={saving} onClick={submit}>{saving ? 'Saving…' : 'Save'}</Button>
    </Modal>
  );
}
