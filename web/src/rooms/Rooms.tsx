import { useState } from 'react';
import { useReadyAuth } from '../auth/AuthProvider';
import type { RoomsData } from '../data/resources';
import { Button } from '../ui/Button';
import { Card, Empty, SectionTitle } from '../ui/Card';
import { Field, FieldRow, Input, Select, Textarea } from '../ui/Field';
import { Modal } from '../ui/Modal';
import { RESOURCE_TYPES, emptyResourceForm, formFromResource, resourceFacts, usedBy, validateQualification, validateResource, type QualificationRow, type ResourceForm, type ResourceRow } from './calc';
import { useRooms, useRoomsWrites } from './useRooms';
import '../members/members.css';
import '../classsetup/classsetup.css';
import '../staff/staff.css';

type Editing = { kind: 'resource'; item: ResourceRow | null } | { kind: 'qualification'; item: QualificationRow | null };

export function Rooms() {
  const { gym } = useReadyAuth();
  const q = useRooms(gym.gymId);
  const writes = useRoomsWrites(gym.gymId);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [showOff, setShowOff] = useState(false);
  const [message, setMessage] = useState('');
  const d = q.data;

  const fail = (e: Error) => setMessage(e.message);
  const toggleResource = (r: ResourceRow) => {
    setMessage('');
    writes.toggleResource.mutate({ id: r.id, isActive: !r.isActive }, { onError: fail });
  };
  const toggleQual = (c: QualificationRow) => {
    setMessage('');
    writes.toggleQualification.mutate({ id: c.id, isActive: !c.isActive }, { onError: fail });
  };

  const resources = d?.resources.filter((r) => r.isActive) ?? [];
  const qualifications = d?.qualifications.filter((c) => c.isActive) ?? [];
  const offResources = d?.resources.filter((r) => !r.isActive) ?? [];
  const offQuals = d?.qualifications.filter((c) => !c.isActive) ?? [];
  const offCount = offResources.length + offQuals.length;

  return (
    <>
      <header className="page-top">
        <div>
          <div className="eyebrow">Settings and staff</div>
          <h1>Rooms and equipment</h1>
          <div className="muted">The rooms, kit and qualifications that classes depend on. Class setup says which class needs which.</div>
        </div>
      </header>

      {q.isError && <Card><Empty>Could not load rooms and equipment. Refresh to try again.</Empty></Card>}
      {q.isPending && <Card><Empty>Loading…</Empty></Card>}
      {message && <div className="msg error" role="alert">{message}</div>}

      {d && (
        <>
          <Card>
            <SectionTitle title="Rooms and equipment" action={<Button variant="primary" onClick={() => { setMessage(''); setEditing({ kind: 'resource', item: null }); }}>Add room or equipment</Button>} />
            {resources.length === 0 && <Empty>Nothing set up yet. Add your first room.</Empty>}
            <ul className="team-list">
              {resources.map((r) => <ResourceItem key={r.id} r={r} d={d} busy={writes.toggleResource.isPending} onEdit={() => { setMessage(''); setEditing({ kind: 'resource', item: r }); }} onToggle={() => toggleResource(r)} />)}
            </ul>
          </Card>

          <Card>
            <SectionTitle title="Qualifications" action={<Button variant="primary" onClick={() => { setMessage(''); setEditing({ kind: 'qualification', item: null }); }}>Add qualification</Button>} />
            <p className="muted small">A qualification is something a coach needs to run a class, for example Spin instructor. Tick them on each person in Staff.</p>
            {qualifications.length === 0 && <Empty>No qualifications yet.</Empty>}
            <ul className="team-list">
              {qualifications.map((c) => <QualItem key={c.id} c={c} d={d} busy={writes.toggleQualification.isPending} onEdit={() => { setMessage(''); setEditing({ kind: 'qualification', item: c }); }} onToggle={() => toggleQual(c)} />)}
            </ul>
          </Card>

          {offCount > 0 && (
            <div className="archived-bar">
              <Button onClick={() => setShowOff((v) => !v)}>{showOff ? 'Hide' : 'Show'} switched-off items ({offCount})</Button>
            </div>
          )}
          {showOff && (
            <Card>
              <SectionTitle title="Switched off" />
              <ul className="team-list">
                {offResources.map((r) => <ResourceItem key={r.id} r={r} d={d} busy={writes.toggleResource.isPending} onEdit={() => { setMessage(''); setEditing({ kind: 'resource', item: r }); }} onToggle={() => toggleResource(r)} />)}
                {offQuals.map((c) => <QualItem key={c.id} c={c} d={d} busy={writes.toggleQualification.isPending} onEdit={() => { setMessage(''); setEditing({ kind: 'qualification', item: c }); }} onToggle={() => toggleQual(c)} />)}
              </ul>
            </Card>
          )}
        </>
      )}

      {editing?.kind === 'resource' && d && (
        <ResourceEditor item={editing.item} d={d} saving={writes.saveResource.isPending} onClose={() => setEditing(null)}
          onSave={(input, onError) => writes.saveResource.mutate({ id: editing.item?.id ?? null, input }, { onSuccess: () => setEditing(null), onError: (e) => onError(e.message) })} />
      )}
      {editing?.kind === 'qualification' && d && (
        <QualificationEditor item={editing.item} d={d} saving={writes.saveQualification.isPending} onClose={() => setEditing(null)}
          onSave={(v, onError) => writes.saveQualification.mutate({ id: editing.item?.id ?? null, ...v }, { onSuccess: () => setEditing(null), onError: (e) => onError(e.message) })} />
      )}
    </>
  );
}

function ResourceItem({ r, d, busy, onEdit, onToggle }: { r: ResourceRow; d: RoomsData; busy: boolean; onEdit: () => void; onToggle: () => void }) {
  const used = usedBy(r.id, 'resource', d.requirements, d.types);
  return (
    <li className="team-item">
      <div className="team-main">
        <b>{r.name}</b>
        <div className="muted">{resourceFacts(r)}</div>
        {r.notes && <div className="muted small">{r.notes}</div>}
        <div className="muted small">{used.length ? `Needed by: ${used.join(', ')}` : 'Not needed by any class type yet'}</div>
      </div>
      <div className="team-actions">
        <Button aria-label={`Edit ${r.name}`} onClick={onEdit}>Edit</Button>
        <Button aria-label={`${r.isActive ? 'Switch off' : 'Switch on'} ${r.name}`} disabled={busy} onClick={onToggle}>{r.isActive ? 'Switch off' : 'Switch on'}</Button>
      </div>
    </li>
  );
}

function QualItem({ c, d, busy, onEdit, onToggle }: { c: QualificationRow; d: RoomsData; busy: boolean; onEdit: () => void; onToggle: () => void }) {
  const used = usedBy(c.id, 'capability', d.requirements, d.types);
  return (
    <li className="team-item">
      <div className="team-main">
        <b>{c.name}</b>
        {c.description && <div className="muted">{c.description}</div>}
        <div className="muted small">{used.length ? `Needed by: ${used.join(', ')}` : 'Not needed by any class type yet'}</div>
      </div>
      <div className="team-actions">
        <Button aria-label={`Edit ${c.name}`} onClick={onEdit}>Edit</Button>
        <Button aria-label={`${c.isActive ? 'Switch off' : 'Switch on'} ${c.name}`} disabled={busy} onClick={onToggle}>{c.isActive ? 'Switch off' : 'Switch on'}</Button>
      </div>
    </li>
  );
}

function ResourceEditor({ item, d, saving, onClose, onSave }: { item: ResourceRow | null; d: RoomsData; saving: boolean; onClose: () => void; onSave: (i: import('./calc').ResourceInput, onError: (m: string) => void) => void }) {
  const [form, setForm] = useState<ResourceForm>(() => (item ? formFromResource(item) : emptyResourceForm));
  const [error, setError] = useState('');
  const set = <K extends keyof ResourceForm>(k: K, v: ResourceForm[K]) => setForm((f) => ({ ...f, [k]: v }));
  const submit = () => {
    const check = validateResource(form, d.resources, item?.id ?? null);
    if (!check.ok) return setError(check.message);
    setError('');
    onSave(check.input, setError);
  };
  const title = item ? 'Edit room or equipment' : 'Add room or equipment';
  return (
    <Modal title={title} onClose={onClose}>
      <SectionTitle title={title} action={<Button onClick={onClose}>Close</Button>} />
      <FieldRow>
        <Field label="Name" htmlFor="res-name"><Input id="res-name" placeholder="Studio A" value={form.name} onChange={(e) => set('name', e.target.value)} /></Field>
        <Field label="Type" htmlFor="res-type">
          <Select id="res-type" value={form.type} onChange={(e) => set('type', e.target.value)}>
            {RESOURCE_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </Select>
        </Field>
        <Field label="Max occupancy" htmlFor="res-capacity" hint="Leave blank if there is no limit.">
          <Input id="res-capacity" type="number" inputMode="numeric" min="1" value={form.capacity} onChange={(e) => set('capacity', e.target.value)} />
        </Field>
        <Field label="Double booking" htmlFor="res-overlap">
          <Select id="res-overlap" value={form.overlap} onChange={(e) => set('overlap', e.target.value === 'shared' ? 'shared' : 'exclusive')}>
            <option value="exclusive">Prevent overlap</option>
            <option value="shared">Allow overlap</option>
          </Select>
        </Field>
      </FieldRow>
      <Field label="Notes" htmlFor="res-notes"><Textarea id="res-notes" value={form.notes} onChange={(e) => set('notes', e.target.value)} /></Field>
      <div className="assign-msg">{error && <span className="msg error" role="alert">{error}</span>}</div>
      <Button variant="primary" className="wide-btn" disabled={saving} onClick={submit}>{saving ? 'Saving…' : 'Save'}</Button>
    </Modal>
  );
}

function QualificationEditor({ item, d, saving, onClose, onSave }: { item: QualificationRow | null; d: RoomsData; saving: boolean; onClose: () => void; onSave: (v: { name: string; description: string | null }, onError: (m: string) => void) => void }) {
  const [name, setName] = useState(item?.name ?? '');
  const [description, setDescription] = useState(item?.description ?? '');
  const [error, setError] = useState('');
  const submit = () => {
    const check = validateQualification({ name, description }, d.qualifications, item?.id ?? null);
    if (!check.ok) return setError(check.message);
    setError('');
    onSave({ name: check.name, description: check.description }, setError);
  };
  const title = item ? 'Edit qualification' : 'Add qualification';
  return (
    <Modal title={title} onClose={onClose}>
      <SectionTitle title={title} action={<Button onClick={onClose}>Close</Button>} />
      <Field label="Name" htmlFor="qual-name"><Input id="qual-name" placeholder="Spin instructor" value={name} onChange={(e) => setName(e.target.value)} /></Field>
      <Field label="Description" htmlFor="qual-desc"><Input id="qual-desc" value={description} onChange={(e) => setDescription(e.target.value)} /></Field>
      <div className="assign-msg">{error && <span className="msg error" role="alert">{error}</span>}</div>
      <Button variant="primary" className="wide-btn" disabled={saving} onClick={submit}>{saving ? 'Saving…' : 'Save'}</Button>
    </Modal>
  );
}
