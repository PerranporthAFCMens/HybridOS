import { useMemo, useState } from 'react';
import { useReadyAuth } from '../auth/AuthProvider';
import type { ScheduleProposal } from '../data/classes';
import { money } from '../today/calc';
import { Button } from '../ui/Button';
import { SectionTitle } from '../ui/Card';
import { Checkbox, DateInput, Field, FieldRow, Input, Select, Textarea } from '../ui/Field';
import { Modal } from '../ui/Modal';
import {
  RELEASE_OPTIONS, STAFF_STATUS_TEXT, emptyClassForm, requirementsText, reservedExample, staffStatus, validateClass, type ClassForm as Form,
} from './calc';
import { useActivePlans, useClassTypes, useCreateClass, useSchedulingRules, useScheduleCheck, useStaffOptions } from './useClasses';

/** Add a class to the timetable. `onSaved` receives the class's start so the timetable can jump to its week. */
export function ClassForm({ onClose, onSaved }: { onClose: () => void; onSaved: (startsAt: Date) => void }) {
  const { gym } = useReadyAuth();
  const staff = useStaffOptions(gym.gymId);
  const plans = useActivePlans(gym.gymId);
  const types = useClassTypes(gym.gymId);
  const rules = useSchedulingRules(gym.gymId);
  const create = useCreateClass(gym.gymId);
  const [form, setForm] = useState<Form>(() => emptyClassForm(new Date()));
  const [pickedStaff, setPickedStaff] = useState<string[]>([]);
  const [pickedPlans, setPickedPlans] = useState<string[]>([]);
  const [problems, setProblems] = useState<string[]>([]);
  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm((f) => ({ ...f, [key]: value }));
  const toggle = (list: string[], id: string, on: boolean) => (on ? [...list, id] : list.filter((x) => x !== id));

  const parsed = useMemo(() => validateClass(form), [form]);
  const start = parsed.ok ? new Date(parsed.values.startsAt) : null;
  const end = parsed.ok ? new Date(parsed.values.endsAt) : null;
  const typeId = form.classTypeId || null;

  // Anyone ticked who stops being available (a different time or class type) drops out, as in the old form.
  const status = (userId: string) => (rules.data && start && end ? staffStatus(userId, typeId, start, end, rules.data) : 'ok');
  const picked = pickedStaff.filter((id) => status(id) === 'ok');

  const ordered = (staff.data ?? []).filter((p) => picked.includes(p.userId)).sort((a, b) => picked.indexOf(a.userId) - picked.indexOf(b.userId));
  const proposal: ScheduleProposal | null = parsed.ok
    ? { classTypeId: typeId, startsAt: parsed.values.startsAt, endsAt: parsed.values.endsAt, capacity: parsed.values.capacity, staffIds: ordered.map((p) => p.userId) }
    : null;
  const check = useScheduleCheck(gym.gymId, typeId ? proposal : null);

  const pickType = (id: string) => {
    const t = types.data?.find((x) => x.id === id);
    setForm((f) => ({
      ...f,
      classTypeId: id,
      ...(t ? { name: f.name.trim() ? f.name : t.name, description: t.description ?? '', duration: String(t.durationMinutes), capacity: String(t.defaultCapacity) } : {}),
    }));
  };

  const submit = () => {
    if (!parsed.ok) {
      setProblems([parsed.message]);
      return;
    }
    setProblems([]);
    create.mutate(
      { ...parsed.values, classTypeId: typeId, staffIds: ordered.map((p) => p.userId), reservedPlanIds: pickedPlans },
      { onSuccess: (v) => (v.ok ? onSaved(new Date(parsed.values.startsAt)) : setProblems(v.errors.length ? v.errors : ['The class could not be scheduled.'])), onError: (e) => setProblems([e.message]) },
    );
  };

  const capacity = Number(form.capacity);
  const reserved = Number(form.reserved);
  const verdict = check.data;

  return (
    <Modal title="Add to timetable" onClose={onClose}>
      <SectionTitle title="Add to timetable" action={<Button onClick={onClose}>Close</Button>} />
      <Field label="Class type" htmlFor="class-type" hint={rules.data ? requirementsText(typeId, rules.data) : undefined}>
        <Select id="class-type" value={form.classTypeId} onChange={(e) => pickType(e.target.value)}>
          <option value="">Custom class (no checks)</option>
          {types.data?.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </Select>
      </Field>
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
        {staff.data?.map((p) => {
          const st = status(p.userId);
          return (
            <div className={`staff-pick${st === 'ok' ? '' : ' unavailable'}`} key={p.userId}>
              <Checkbox label={`${p.name} · ${p.role}`} checked={picked.includes(p.userId)} onChange={(on) => setPickedStaff((l) => toggle(l.filter((id) => picked.includes(id)), p.userId, on))} disabled={st !== 'ok'} />
              {st !== 'ok' && <span className="staff-why">{STAFF_STATUS_TEXT[st]}</span>}
            </div>
          );
        })}
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
        {Number.isInteger(capacity) && Number.isInteger(reserved) && reserved > 0 && reserved <= capacity ? reservedExample(capacity, reserved) : reservedExample(20, 5)}
      </div>

      <div className={`schedule-check${verdict ? (verdict.ok ? ' good' : ' bad') : ''}`} role="status" aria-live="polite">
        {!typeId && 'Custom class: nothing to check against. Pick a class type to check coaches, rooms and equipment.'}
        {typeId && !proposal && 'Fill in the date, time, duration and capacity to check this class.'}
        {typeId && proposal && check.isFetching && 'Checking coaches, rooms and equipment…'}
        {typeId && proposal && !check.isFetching && check.isError && 'Could not run the check. You can still try to save; the database will check again.'}
        {typeId && proposal && !check.isFetching && verdict?.ok && 'Coaches, working hours, rooms, equipment and clashes all check out.'}
        {typeId && proposal && !check.isFetching && verdict && !verdict.ok && (
          <>
            <b>Cannot schedule this class yet:</b>
            <ul>{verdict.errors.map((m) => <li key={m}>{m}</li>)}</ul>
          </>
        )}
      </div>

      <div className="assign-msg">
        {problems.length > 0 && (
          <span className="msg error" role="alert">
            {problems.length === 1 ? problems[0] : <>Cannot schedule this class yet:<ul>{problems.map((m) => <li key={m}>{m}</li>)}</ul></>}
          </span>
        )}
      </div>
      <Button variant="primary" className="wide-btn" disabled={create.isPending || (!!verdict && !verdict.ok)} onClick={submit}>Save class</Button>
    </Modal>
  );
}
