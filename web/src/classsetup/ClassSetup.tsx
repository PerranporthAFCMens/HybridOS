import { useState } from 'react';
import { useReadyAuth } from '../auth/AuthProvider';
import type { ClassTypeFull, ClassTypeInput, RequirementInput, SetupData } from '../data/classSetup';
import { links } from '../shell/legacy';
import { Button, LinkButton } from '../ui/Button';
import { Card, Empty, SectionTitle } from '../ui/Card';
import { Checkbox, Field, FieldRow, Input, Select, Textarea } from '../ui/Field';
import { Modal } from '../ui/Modal';
import { LEVELS, emptyTypeForm, formFromType, levelLabel, needsText, typeFacts, validateType, type TypeForm } from './calc';
import { useClassSetup, useClassSetupWrites } from './useClassSetup';
import '../members/members.css';
import './classsetup.css';

export function ClassSetup() {
  const { gym } = useReadyAuth();
  const q = useClassSetup(gym.gymId);
  const writes = useClassSetupWrites(gym.gymId);
  // null = closed; { type: null } = a new class type; { type } = editing that one
  const [editing, setEditing] = useState<{ type: ClassTypeFull | null } | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [toggleError, setToggleError] = useState('');
  const data = q.data;
  const active = data?.types.filter((t) => t.isActive) ?? [];
  const archived = data?.types.filter((t) => !t.isActive) ?? [];

  const toggle = (t: ClassTypeFull) => {
    setToggleError('');
    writes.toggle.mutate({ typeId: t.id, isActive: !t.isActive }, { onError: (e) => setToggleError(e.message) });
  };

  return (
    <>
      <header className="page-top">
        <div>
          <div className="eyebrow">Services &amp; dependencies</div>
          <h1>Class setup</h1>
          <div className="muted">Define a class once. HybridOne then checks the qualified coach, room and equipment it needs every time it is scheduled.</div>
        </div>
        <Button variant="primary" onClick={() => setEditing({ type: null })}>New class type</Button>
      </header>

      {q.isError && <Card><Empty>Could not load class setup. Refresh to try again.</Empty></Card>}
      {q.isPending && <Card><Empty>Loading class types…</Empty></Card>}
      {toggleError && <div className="msg error" role="alert">{toggleError}</div>}

      {data && (
        <>
          {active.length === 0 && <Card><Empty>No class types yet. Create your first one.</Empty></Card>}
          <div className="type-grid">
            {active.map((t) => (
              <TypeCard key={t.id} t={t} data={data} onEdit={() => setEditing({ type: t })} onToggle={() => toggle(t)} busy={writes.toggle.isPending} />
            ))}
          </div>

          {archived.length > 0 && (
            <div className="archived-bar">
              <Button onClick={() => setShowArchived((v) => !v)}>{showArchived ? 'Hide' : 'Show'} switched-off class types ({archived.length})</Button>
            </div>
          )}
          {showArchived && (
            <div className="type-grid">
              {archived.map((t) => (
                <TypeCard key={t.id} t={t} data={data} onEdit={() => setEditing({ type: t })} onToggle={() => toggle(t)} busy={writes.toggle.isPending} />
              ))}
            </div>
          )}

          <Card>
            <SectionTitle title="Qualifications, rooms and equipment" />
            <p className="muted">
              {data.capabilities.length} qualification{data.capabilities.length === 1 ? '' : 's'} and {data.resources.length} room{data.resources.length === 1 ? '' : 's'} or
              {' '}piece{data.resources.length === 1 ? '' : 's'} of equipment are set up. They, and staff qualifications and working hours, are managed under Rooms and equipment; staff qualifications and working hours under Staff.
            </p>
            <LinkButton href={links.resources}>Open rooms and equipment</LinkButton>
          </Card>
        </>
      )}

      {editing && data && (
        <TypeEditor
          type={editing.type}
          data={data}
          saving={writes.save.isPending}
          onClose={() => setEditing(null)}
          onSave={(args, onError) => writes.save.mutate({ typeId: editing.type?.id ?? null, ...args }, { onSuccess: () => setEditing(null), onError: (e) => onError(e.message) })}
        />
      )}
    </>
  );
}

function TypeCard({ t, data, onEdit, onToggle, busy }: { t: ClassTypeFull; data: SetupData; onEdit: () => void; onToggle: () => void; busy: boolean }) {
  return (
    <Card className={`type-card${t.isActive ? '' : ' inactive'}`}>
      <div className="plan-head">
        <h3>{t.name}</h3>
        <span className="tag">{levelLabel(t.level)}</span>
      </div>
      <div className="muted">{typeFacts(t)}</div>
      <div className="muted small type-needs">{needsText(t.id, data)}</div>
      {t.description && <div className="muted small type-needs">{t.description}</div>}
      <div className="membership-actions">
        <Button onClick={onEdit}>Edit</Button>
        <Button onClick={onToggle} disabled={busy}>{t.isActive ? 'Switch off' : 'Switch on'}</Button>
      </div>
    </Card>
  );
}

function TypeEditor({ type, data, saving, onClose, onSave }: {
  type: ClassTypeFull | null;
  data: SetupData;
  saving: boolean;
  onClose: () => void;
  onSave: (args: { input: ClassTypeInput; needs: RequirementInput[] }, onError: (message: string) => void) => void;
}) {
  const [form, setForm] = useState<TypeForm>(() => (type ? formFromType(type, data.requirements) : emptyTypeForm));
  const [error, setError] = useState('');
  const set = <K extends keyof TypeForm>(key: K, value: TypeForm[K]) => setForm((f) => ({ ...f, [key]: value }));

  const submit = () => {
    const check = validateType(form);
    if (!check.ok) {
      setError(check.message);
      return;
    }
    setError('');
    onSave({ input: check.input, needs: check.needs }, setError);
  };

  const title = type ? 'Edit class type' : 'New class type';
  return (
    <Modal title={title} onClose={onClose}>
      <SectionTitle title={title} action={<Button onClick={onClose}>Close</Button>} />
      <FieldRow>
        <Field label="Name" htmlFor="type-name"><Input id="type-name" placeholder="Spin" value={form.name} onChange={(e) => set('name', e.target.value)} /></Field>
        <Field label="Level" htmlFor="type-level">
          <Select id="type-level" value={form.level} onChange={(e) => set('level', e.target.value)}>
            {LEVELS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </Select>
        </Field>
        <Field label="Default duration (minutes)" htmlFor="type-duration"><Input id="type-duration" type="number" inputMode="numeric" min="5" max="480" value={form.duration} onChange={(e) => set('duration', e.target.value)} /></Field>
        <Field label="Default capacity" htmlFor="type-capacity"><Input id="type-capacity" type="number" inputMode="numeric" min="1" value={form.capacity} onChange={(e) => set('capacity', e.target.value)} /></Field>
        <Field label="Drop-in price (£)" htmlFor="type-dropin" hint="Charged when a member's plan does not include classes. Leave blank to require a membership upgrade.">
          <Input id="type-dropin" type="number" inputMode="decimal" min="0" step="0.01" placeholder="e.g. 8.00" value={form.dropIn} onChange={(e) => set('dropIn', e.target.value)} />
        </Field>
      </FieldRow>
      <Field label="Member-facing description" htmlFor="type-description">
        <Textarea id="type-description" placeholder="What should members expect from this class?" value={form.description} onChange={(e) => set('description', e.target.value)} />
      </Field>

      <fieldset className="check-group">
        <legend>Qualifications the coach needs</legend>
        {data.capabilities.length === 0 && <div className="muted small">No qualifications yet. Add them under Rooms and equipment.</div>}
        {data.capabilities.map((c) => (
          <Checkbox
            key={c.id}
            label={c.description ? `${c.name} · ${c.description}` : c.name}
            checked={form.capabilityIds.includes(c.id)}
            onChange={(on) => set('capabilityIds', on ? [...form.capabilityIds, c.id] : form.capabilityIds.filter((x) => x !== c.id))}
          />
        ))}
      </fieldset>

      <fieldset className="check-group">
        <legend>Room and equipment needed</legend>
        {data.resources.length === 0 && <div className="muted small">No rooms or equipment yet. Add them under Rooms and equipment.</div>}
        {data.resources.map((r) => {
          const on = r.id in form.resources;
          return (
            <div className="resource-pick" key={r.id}>
              <Checkbox
                label={`${r.name} · ${r.type}${r.capacity ? ` · capacity ${r.capacity}` : ''}`}
                checked={on}
                onChange={(v) => setForm((f) => ({
                  ...f,
                  resources: v ? { ...f.resources, [r.id]: '1' } : Object.fromEntries(Object.entries(f.resources).filter(([id]) => id !== r.id)),
                }))}
              />
              {on && (
                <label className="how-many">
                  <span>How many</span>
                  <Input aria-label={`How many ${r.name}`} type="number" inputMode="numeric" min="1" value={form.resources[r.id] ?? '1'} onChange={(e) => setForm((f) => ({ ...f, resources: { ...f.resources, [r.id]: e.target.value } }))} />
                </label>
              )}
            </div>
          );
        })}
      </fieldset>

      <div className="notice">
        {summaryLine(form, data) || 'No dependencies selected. This class can be scheduled with any coach, in any room.'}
      </div>
      <div className="assign-msg">{error && <span className="msg error" role="alert">{error}</span>}</div>
      <Button variant="primary" className="wide-btn" disabled={saving} onClick={submit}>Save class type</Button>
    </Modal>
  );
}

function summaryLine(form: TypeForm, data: SetupData): string {
  const quals = form.capabilityIds.flatMap((id) => data.capabilities.filter((c) => c.id === id).map((c) => c.name));
  const things = Object.entries(form.resources).flatMap(([id, n]) => data.resources.filter((r) => r.id === id).map((r) => (Number(n) > 1 ? `${n} × ${r.name}` : r.name)));
  return [quals.length ? `Qualification: ${quals.join(', ')}` : '', things.length ? `Needs: ${things.join(', ')}` : ''].filter(Boolean).join(' · ');
}

