import { useState } from 'react';
import { useReadyAuth } from '../auth/AuthProvider';
import { money } from '../today/calc';
import { Button } from '../ui/Button';
import { SectionTitle } from '../ui/Card';
import { Checkbox, DateInput, Field, FieldRow, Input, Select, Textarea } from '../ui/Field';
import { Modal } from '../ui/Modal';
import { RELEASE_OPTIONS, emptyClassForm, reservedExample, validateClass, type ClassForm as Form } from './calc';
import { useActivePlans, useCreateClass, useStaffOptions } from './useClasses';

/** Add a class to the timetable. `onSaved` receives the class's start so the timetable can jump to its week. */
export function ClassForm({ onClose, onSaved }: { onClose: () => void; onSaved: (startsAt: Date) => void }) {
  const { gym } = useReadyAuth();
  const staff = useStaffOptions(gym.gymId);
  const plans = useActivePlans(gym.gymId);
  const create = useCreateClass(gym.gymId);
  const [form, setForm] = useState<Form>(() => emptyClassForm(new Date()));
  const [pickedStaff, setPickedStaff] = useState<string[]>([]);
  const [pickedPlans, setPickedPlans] = useState<string[]>([]);
  const [error, setError] = useState('');
  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm((f) => ({ ...f, [key]: value }));
  const toggle = (list: string[], id: string, on: boolean) => (on ? [...list, id] : list.filter((x) => x !== id));

  const submit = () => {
    const check = validateClass(form);
    if (!check.ok) {
      setError(check.message);
      return;
    }
    setError('');
    const chosen = (staff.data ?? []).filter((p) => pickedStaff.includes(p.userId));
    // keep the order people were ticked in: the first is the lead
    chosen.sort((a, b) => pickedStaff.indexOf(a.userId) - pickedStaff.indexOf(b.userId));
    create.mutate(
      { ...check.values, reservedPlanIds: pickedPlans, staff: chosen },
      { onSuccess: () => onSaved(new Date(check.values.startsAt)), onError: (e) => setError(e.message) },
    );
  };

  const capacity = Number(form.capacity);
  const reserved = Number(form.reserved);

  return (
    <Modal title="Add to timetable" onClose={onClose}>
      <SectionTitle title="Add to timetable" action={<Button onClick={onClose}>Close</Button>} />
      <FieldRow>
        <Field label="Class name" htmlFor="class-name">
          <Input id="class-name" placeholder="Hybrid Conditioning" value={form.name} onChange={(e) => set('name', e.target.value)} />
        </Field>
        <Field label="Date" htmlFor="class-date">
          <DateInput id="class-date" value={form.date} onChange={(e) => set('date', e.target.value)} />
        </Field>
        <Field label="Start time" htmlFor="class-start">
          <Input id="class-start" type="time" value={form.start} onChange={(e) => set('start', e.target.value)} />
        </Field>
        <Field label="Duration (minutes)" htmlFor="class-duration">
          <Input id="class-duration" type="number" inputMode="numeric" min="5" max="480" value={form.duration} onChange={(e) => set('duration', e.target.value)} />
        </Field>
        <Field label="Total capacity" htmlFor="class-capacity">
          <Input id="class-capacity" type="number" inputMode="numeric" min="1" value={form.capacity} onChange={(e) => set('capacity', e.target.value)} />
        </Field>
        <Field label="Reserved spaces" htmlFor="class-reserved">
          <Input id="class-reserved" type="number" inputMode="numeric" min="0" value={form.reserved} onChange={(e) => set('reserved', e.target.value)} />
        </Field>
      </FieldRow>
      <Field label="Release reserved spaces" htmlFor="class-release">
        <Select id="class-release" value={form.release} onChange={(e) => set('release', e.target.value)}>
          {RELEASE_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </Select>
      </Field>
      <Field label="Description" htmlFor="class-description">
        <Textarea id="class-description" placeholder="Optional class details" value={form.description} onChange={(e) => set('description', e.target.value)} />
      </Field>

      <fieldset className="check-group">
        <legend>Assign gym staff</legend>
        {staff.isPending && <div className="muted small">Loading…</div>}
        {staff.data?.length === 0 && <div className="muted small">No staff or coaches have been added yet.</div>}
        {staff.data?.map((p) => (
          <Checkbox key={p.userId} label={`${p.name} · ${p.role}`} checked={pickedStaff.includes(p.userId)} onChange={(on) => setPickedStaff((l) => toggle(l, p.userId, on))} />
        ))}
      </fieldset>

      <fieldset className="check-group">
        <legend>Memberships allowed to use reserved spaces</legend>
        {plans.isPending && <div className="muted small">Loading…</div>}
        {plans.data?.length === 0 && <div className="muted small">No active membership plans yet.</div>}
        {plans.data?.map((p) => (
          <Checkbox key={p.id} label={`${p.name} · ${money(p.priceInPence)}`} checked={pickedPlans.includes(p.id)} onChange={(on) => setPickedPlans((l) => toggle(l, p.id, on))} />
        ))}
      </fieldset>

      <div className="notice">
        {Number.isInteger(capacity) && Number.isInteger(reserved) && reserved > 0 && reserved <= capacity
          ? reservedExample(capacity, reserved)
          : reservedExample(20, 5)}
      </div>
      <div className="assign-msg">{error && <span className="msg error" role="alert">{error}</span>}</div>
      <Button variant="primary" className="wide-btn" disabled={create.isPending} onClick={submit}>Save class</Button>
    </Modal>
  );
}
