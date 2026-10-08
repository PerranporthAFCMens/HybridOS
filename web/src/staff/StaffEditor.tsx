import { useState } from 'react';
import { useReadyAuth } from '../auth/AuthProvider';
import type { StaffData } from '../data/staff';
import { StepError } from '../data/staff';
import { Button } from '../ui/Button';
import { SectionTitle } from '../ui/Card';
import { Checkbox, DateInput, Field, FieldRow, Input, Select } from '../ui/Field';
import { Modal } from '../ui/Modal';
import { EMPLOYMENT, STAFF_ROLES, WEEK, changedHours, diffQuals, emptyStaffForm, formFromStaff, validateStaff, type StaffForm, type StaffRole, type TeamRow } from './calc';
import { useStaffWrites } from './useStaff';

/** Add a staff login, or edit one person's role, access level, details, hours and qualifications. */
export function StaffEditor({ data, person, onClose, onDone }: { data: StaffData; person: TeamRow | null; onClose: () => void; onDone: (message: string) => void }) {
  const { gym } = useReadyAuth();
  const writes = useStaffWrites(gym.gymId);
  const saved = person
    ? {
        role: person.role,
        accessLevelId: data.access.get(person.userId) ?? '',
        jobTitle: data.profiles.get(person.userId)?.jobTitle ?? null,
        payPence: data.profiles.get(person.userId)?.payPence ?? null,
        employment: data.profiles.get(person.userId)?.employment ?? null,
        hours: data.hours.filter((h) => h.userId === person.userId),
        quals: data.quals.filter((q) => q.userId === person.userId).map((q) => ({ capabilityId: q.capabilityId, expiresOn: q.expiresOn })),
      }
    : null;
  const [form, setForm] = useState<StaffForm>(() => (person && saved ? formFromStaff(person.name, person.email, saved) : emptyStaffForm()));
  const [problem, setProblem] = useState('');
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const set = <K extends keyof StaffForm>(k: K, v: StaffForm[K]) => setForm((f) => ({ ...f, [k]: v }));
  const setDay = (weekday: number, patch: Partial<StaffForm['hours'][number]>) => setForm((f) => ({ ...f, hours: { ...f.hours, [weekday]: { ...(f.hours[weekday] ?? { on: false, start: '09:00', end: '17:00' }), ...patch } } }));
  const setQual = (id: string, patch: Partial<{ on: boolean; expires: string }>) => setForm((f) => ({ ...f, quals: { ...f.quals, [id]: { on: false, expires: '', ...f.quals[id], ...patch } } }));
  const busy = writes.save.isPending || writes.create.isPending;

  const save = async () => {
    setProblem('');
    const check = validateStaff(form, !person);
    if (!check.ok) return setProblem(check.message);
    try {
      let userId = person?.userId ?? '';
      let password: string | null = null;
      if (!person) {
        const created = await writes.create.mutateAsync({ name: form.name.trim(), email: form.email.trim(), role: form.role, accessLevelId: form.accessLevelId });
        userId = created.userId;
        password = created.tempPassword;
      }
      await writes.save.mutateAsync({
        gymId: gym.gymId,
        userId,
        role: form.role,
        roleChanged: !!person && saved?.role !== form.role,
        accessLevelId: form.accessLevelId,
        accessChanged: !!person && saved?.accessLevelId !== form.accessLevelId,
        values: check.values,
        hoursToWrite: changedHours(saved?.hours ?? [], check.values.hours),
        qualChanges: diffQuals(saved?.quals ?? [], check.values.quals),
      });
      if (password) {
        setTempPassword(password);
        return;
      }
      onDone(person ? `${person.name} saved.` : `${form.name.trim()} added.`);
    } catch (e) {
      setProblem(e instanceof StepError || e instanceof Error ? e.message : 'Could not save. Please try again.');
    }
  };

  if (tempPassword) {
    return (
      <Modal title="Login created" onClose={() => onDone(`${form.name.trim()} added.`)}>
        <SectionTitle title="Login created" />
        <p>Give {form.name.trim()} this temporary password. They should change it the first time they sign in.</p>
        <p className="temp-password" aria-label="Temporary password">{tempPassword}</p>
        <Button variant="primary" className="wide-btn" onClick={() => onDone(`${form.name.trim()} added.`)}>Done</Button>
      </Modal>
    );
  }

  return (
    <Modal title={person ? `Edit ${person.name}` : 'Add staff login'} onClose={onClose}>
      <SectionTitle title={person ? `Edit ${person.name}` : 'Add staff login'} action={<Button onClick={onClose}>Close</Button>} />
      {!person && (
        <FieldRow>
          <Field label="Name" htmlFor="staff-name"><Input id="staff-name" value={form.name} onChange={(e) => set('name', e.target.value)} /></Field>
          <Field label="Email" htmlFor="staff-email"><Input id="staff-email" type="email" value={form.email} onChange={(e) => set('email', e.target.value)} /></Field>
        </FieldRow>
      )}
      <FieldRow>
        <Field label="Role" htmlFor="staff-role">
          <Select id="staff-role" value={form.role} onChange={(e) => set('role', e.target.value as StaffRole)}>
            {STAFF_ROLES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </Select>
        </Field>
        <Field label="Access level" htmlFor="staff-level" hint={data.levels.length ? undefined : 'Create an access level first (Settings, Staff access).'}>
          <Select id="staff-level" value={form.accessLevelId} disabled={!data.levels.length} onChange={(e) => set('accessLevelId', e.target.value)}>
            <option value="">Choose access level</option>
            {data.levels.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </Select>
        </Field>
        <Field label="Job title" htmlFor="staff-job"><Input id="staff-job" value={form.jobTitle} onChange={(e) => set('jobTitle', e.target.value)} /></Field>
        <Field label="Gross hourly pay (£)" htmlFor="staff-pay"><Input id="staff-pay" type="number" inputMode="decimal" min="0" step="0.01" value={form.pay} onChange={(e) => set('pay', e.target.value)} /></Field>
        <Field label="Employment type" htmlFor="staff-employment">
          <Select id="staff-employment" value={form.employment} onChange={(e) => set('employment', e.target.value)}>
            {EMPLOYMENT.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </Select>
        </Field>
      </FieldRow>

      <fieldset className="check-group">
        <legend>Normal working hours</legend>
        {WEEK.map((d) => {
          const h = form.hours[d.weekday] ?? { on: false, start: '09:00', end: '17:00' };
          return (
            <div className="day-row" key={d.weekday}>
              <Checkbox label={d.name} checked={h.on} onChange={(on) => setDay(d.weekday, { on })} />
              <Input aria-label={`${d.name} start`} type="time" value={h.start} disabled={!h.on} onChange={(e) => setDay(d.weekday, { start: e.target.value })} />
              <Input aria-label={`${d.name} finish`} type="time" value={h.end} disabled={!h.on} onChange={(e) => setDay(d.weekday, { end: e.target.value })} />
            </div>
          );
        })}
      </fieldset>

      <fieldset className="check-group">
        <legend>Qualifications</legend>
        {data.capabilities.length === 0 && <div className="muted small">Add qualifications first (Settings, Rooms and equipment).</div>}
        {data.capabilities.map((c) => {
          const q = form.quals[c.id] ?? { on: false, expires: '' };
          return (
            <div className="qual-row" key={c.id}>
              <Checkbox label={c.name} checked={q.on} onChange={(on) => setQual(c.id, { on })} />
              {q.on && <DateInput aria-label={`${c.name} expires on`} value={q.expires} onChange={(e) => setQual(c.id, { expires: e.target.value })} />}
            </div>
          );
        })}
        <div className="muted small">Leave the date blank if a qualification does not expire. Classes that need it are refused once it has expired.</div>
      </fieldset>

      <div className="assign-msg">{problem && <span className="msg error" role="alert">{problem}</span>}</div>
      <Button variant="primary" className="wide-btn" disabled={busy} onClick={() => void save()}>{busy ? 'Saving…' : person ? 'Save changes' : 'Create login'}</Button>
    </Modal>
  );
}
