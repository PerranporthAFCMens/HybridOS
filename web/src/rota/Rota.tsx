import { useMemo, useState } from 'react';
import { useReadyAuth } from '../auth/AuthProvider';
import { londonParts } from '../classes/calc';
import { Button } from '../ui/Button';
import { Card, Empty, SectionTitle } from '../ui/Card';
import { Checkbox, DateInput, Field, FieldRow, Input, Select } from '../ui/Field';
import { Modal } from '../ui/Modal';
import { Clashes } from './Clashes';
import { isActiveMember, roleLabel, type TeamRow } from '../staff/calc';
import { useStaffData } from '../staff/useStaff';
import { BLOCK_KINDS, addDays, blockText, cellFor, dayHeading, dayRange, emptyBlockForm, longDay, validateBlock, weekDates, weekLabel, weekStart, type BlockForm, type BlockKind, type BlockRow, type ClosedRow } from './calc';
import { useRota, useRotaWrites } from './useRota';
import '../members/members.css';
import './rota.css';

type Dialog = { kind: 'time-off'; userId: string; date: string } | { kind: 'closed'; date: string } | null;

/** The week at a glance: a row per team member, a column per day, with time off and closed days laid over their weekly hours. */
export function Rota() {
  const { gym } = useReadyAuth();
  const today = londonParts(new Date()).date;
  const [start, setStart] = useState(() => weekStart(today));
  const [search, setSearch] = useState('');
  const [dialog, setDialog] = useState<Dialog>(null);
  const [message, setMessage] = useState('');
  const staff = useStaffData(gym.gymId);
  const rota = useRota(gym.gymId, start);
  const days = useMemo(() => weekDates(start), [start]);

  const people = useMemo(() => (staff.data?.team ?? []).filter((m) => isActiveMember(m) && m.role !== 'member').filter((m) => m.name.toLowerCase().includes(search.trim().toLowerCase())), [staff.data, search]);
  const allPeople = useMemo(() => (staff.data?.team ?? []).filter((m) => isActiveMember(m)), [staff.data]);
  const closedOn = (date: string) => rota.data?.closed.find((c) => c.closedOn === date);
  const blocksFor = (userId: string) => (rota.data?.blocks ?? []).filter((b) => b.userId === userId);

  return (
    <>
      <header className="page-top">
        <div>
          <div className="eyebrow">Settings and staff</div>
          <h1>Rota and time off</h1>
          <div className="muted">Who is working when at {gym.gymName}. Each day starts from the person's weekly hours; tap a day to block out time or mark leave. Coaches and PTs block their own time from the Time off tab in the staff app.</div>
        </div>
        <div className="staff-top rota-top">
          <Button variant="primary" disabled={allPeople.length === 0} onClick={() => { setMessage(''); setDialog({ kind: 'time-off', userId: allPeople[0]?.userId ?? '', date: today >= start && today <= addDays(start, 6) ? today : start }); }}>Add time off</Button>
        </div>
      </header>

      <Card>
        <div className="rota-tools">
          <div className="rota-nav">
            <Button aria-label="Previous week" onClick={() => setStart(addDays(start, -7))}>‹</Button>
            <Button onClick={() => setStart(weekStart(today))}>This week</Button>
            <Button aria-label="Next week" onClick={() => setStart(addDays(start, 7))}>›</Button>
            <b className="rota-week">{weekLabel(start)}</b>
          </div>
          <div className="rota-find">
            <Input aria-label="Search the team" placeholder="Search the team" value={search} onChange={(e) => setSearch(e.target.value)} />
            <DateInput aria-label="Go to date" value={start} onChange={(e) => e.target.value && setStart(weekStart(e.target.value))} />
          </div>
        </div>

        {message && <div className="msg" role="status">{message}</div>}
        {(staff.isError || rota.isError) && <Empty>Could not load the rota. Refresh to try again.</Empty>}
        {(staff.isPending || rota.isPending) && !(staff.isError || rota.isError) && <Empty>Loading the rota…</Empty>}

        {staff.data && rota.data && (
          <>
            <div className="rota-scroll table-wrap">
              <table className="rota">
                <thead>
                  <tr>
                    <th scope="col" className="rota-name">Team</th>
                    {days.map((d) => <th key={d} scope="col" className={d === today ? 'rota-today' : ''}>{dayHeading(d)}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {people.length === 0 && <tr><td colSpan={8}><Empty>{search ? 'Nobody matches that search.' : 'No team members yet.'}</Empty></td></tr>}
                  {people.map((m) => {
                    const hours = (staff.data?.hours ?? []).filter((h) => h.userId === m.userId);
                    return (
                      <tr key={m.userId}>
                        <th scope="row" className="rota-name">{m.name}<small>{roleLabel(m.role)}</small></th>
                        {days.map((d) => {
                          const c = cellFor(d, hours, blocksFor(m.userId), closedOn(d));
                          return (
                            <td key={d}>
                              <button type="button" className={`rota-cell ${c.state}`} aria-label={`${m.name}, ${longDay(d)}: ${c.text}${c.detail ? `, ${c.detail}` : ''}. Open`} onClick={() => { setMessage(''); setDialog({ kind: 'time-off', userId: m.userId, date: d }); }}>
                                <b>{c.text}</b>
                                {c.detail && <span>{c.detail}</span>}
                              </button>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                  <tr>
                    <th scope="row" className="rota-name">Gym closed</th>
                    {days.map((d) => {
                      const c = closedOn(d);
                      return (
                        <td key={d}>
                          <button type="button" className={`rota-cell ${c ? 'closed' : 'empty'}`} aria-label={`${longDay(d)}: ${c ? `gym closed${c.reason ? `, ${c.reason}` : ''}` : 'gym open'}. Open`} onClick={() => { setMessage(''); setDialog({ kind: 'closed', date: d }); }}>
                            <b>{c ? 'Closed' : '+'}</b>
                            {c?.reason && <span>{c.reason}</span>}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                </tbody>
              </table>
            </div>
            <ul className="rota-legend" aria-label="Key">
              <li><i className="working" />Normal hours</li>
              <li><i className="part" />Part of the day blocked</li>
              <li><i className="away" />Away all day</li>
              <li><i className="off" />Not working</li>
              <li><i className="closed" />Gym closed</li>
            </ul>
          </>
        )}
      </Card>

      {staff.data && <Clashes names={new Map(staff.data.team.map((m) => [m.userId, m.name]))} />}

      {dialog?.kind === 'time-off' && staff.data && rota.data && (
        <TimeOffDialog people={allPeople} start={dialog.date} userId={dialog.userId} blocks={rota.data.blocks} onClose={() => setDialog(null)} onDone={(t) => { setMessage(t); }} />
      )}
      {dialog?.kind === 'closed' && rota.data && (
        <ClosedDialog date={dialog.date} closed={closedOn(dialog.date)} onClose={() => setDialog(null)} onDone={(t) => { setDialog(null); setMessage(t); }} />
      )}
    </>
  );
}

function TimeOffDialog({ people, start, userId, blocks, onClose, onDone }: { people: TeamRow[]; start: string; userId: string; blocks: BlockRow[]; onClose: () => void; onDone: (message: string) => void }) {
  const { gym } = useReadyAuth();
  const writes = useRotaWrites(gym.gymId);
  const [who, setWho] = useState(userId);
  const [form, setForm] = useState<BlockForm>(() => emptyBlockForm(userId, start));
  const [problem, setProblem] = useState('');
  const [removing, setRemoving] = useState<string | null>(null);
  const set = <K extends keyof BlockForm>(k: K, v: BlockForm[K]) => setForm((f) => ({ ...f, [k]: v }));
  const person = people.find((p) => p.userId === who);
  // What this person already has on the chosen day (the list the owner can remove from).
  const shown = dayRange(/^\d{4}-\d{2}-\d{2}$/.test(form.fromDate) ? form.fromDate : start);
  const existing = blocks.filter((b) => b.userId === who && new Date(b.startsAt) < shown.end && new Date(b.endsAt) > shown.start);

  const save = () => {
    setProblem('');
    const check = validateBlock({ ...form, userId: who });
    if (!check.ok) return setProblem(check.message);
    writes.addBlock.mutate({ userId: who, startsAt: check.startsAt, endsAt: check.endsAt, kind: form.kind, reason: check.reason }, {
      onSuccess: () => { onDone(`Saved for ${person?.name ?? 'them'}. Classes already booked with them were not changed.`); onClose(); },
      onError: (e) => setProblem(`Could not save: ${e.message}`),
    });
  };
  const remove = (b: BlockRow) =>
    writes.removeBlock.mutate(b.id, { onSuccess: () => { setRemoving(null); onDone(`Removed for ${person?.name ?? 'them'}.`); }, onError: (e) => { setRemoving(null); setProblem(`Could not remove: ${e.message}`); } });

  return (
    <Modal title="Time off" onClose={onClose}>
      <SectionTitle title="Time off" action={<Button onClick={onClose}>Close</Button>} />
      <div className="rota-stack">
        <Field label="Who" htmlFor="rota-who">
          <Select id="rota-who" value={who} onChange={(e) => setWho(e.target.value)}>
            {people.map((p) => <option key={p.userId} value={p.userId}>{p.name}</option>)}
          </Select>
        </Field>
        {existing.length > 0 && (
          <div className="rota-existing">
            <b className="small">Already blocked around {longDay(form.fromDate || start)}</b>
            <ul>
              {existing.map((b) => (
                <li key={b.id}>
                  <span>{BLOCK_KINDS.find(([k]) => k === b.kind)?.[1] ?? 'Blocked out'}: {blockText(b)}{b.reason ? ` (${b.reason})` : ''}</span>
                  {removing === b.id ? (
                    <span className="rota-confirm"><Button variant="primary" disabled={writes.removeBlock.isPending} onClick={() => remove(b)}>Yes, remove</Button><Button onClick={() => setRemoving(null)}>Keep</Button></span>
                  ) : (
                    <Button aria-label={`Remove ${blockText(b)}`} onClick={() => setRemoving(b.id)}>Remove</Button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
        <Field label="What is it" htmlFor="rota-kind">
          <Select id="rota-kind" value={form.kind} onChange={(e) => set('kind', e.target.value as BlockKind)}>
            {BLOCK_KINDS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </Select>
        </Field>
        <Checkbox label="Whole days" checked={form.wholeDay} onChange={(v) => set('wholeDay', v)} />
        <FieldRow>
          <Field label={form.wholeDay ? 'First day' : 'Day'} htmlFor="rota-from"><DateInput id="rota-from" value={form.fromDate} onChange={(e) => set('fromDate', e.target.value)} /></Field>
          {form.wholeDay && <Field label="Last day" htmlFor="rota-to"><DateInput id="rota-to" value={form.toDate} onChange={(e) => set('toDate', e.target.value)} /></Field>}
        </FieldRow>
        {!form.wholeDay && (
          <FieldRow>
            <Field label="From" htmlFor="rota-from-time"><Input id="rota-from-time" type="time" value={form.fromTime} onChange={(e) => set('fromTime', e.target.value)} /></Field>
            <Field label="To" htmlFor="rota-to-time"><Input id="rota-to-time" type="time" value={form.toTime} onChange={(e) => set('toTime', e.target.value)} /></Field>
          </FieldRow>
        )}
        <Field label="Reason (optional)" htmlFor="rota-reason" hint="Only the owner and this person see it.">
          <Input id="rota-reason" maxLength={200} value={form.reason} onChange={(e) => set('reason', e.target.value)} />
        </Field>
        {problem && <div className="field-error" role="alert">{problem}</div>}
        <div className="small muted">While this is in place they cannot be put on a class or booked for personal training. Anything already booked stays as it is.</div>
        <div className="rota-actions"><Button variant="primary" disabled={writes.addBlock.isPending} onClick={save}>{writes.addBlock.isPending ? 'Saving…' : 'Save'}</Button><Button onClick={onClose}>Cancel</Button></div>
      </div>
    </Modal>
  );
}

function ClosedDialog({ date, closed, onClose, onDone }: { date: string; closed: ClosedRow | undefined; onClose: () => void; onDone: (message: string) => void }) {
  const { gym } = useReadyAuth();
  const writes = useRotaWrites(gym.gymId);
  const [reason, setReason] = useState('');
  const [problem, setProblem] = useState('');
  const mark = () => writes.addClosed.mutate({ day: date, reason: reason.trim().slice(0, 200) || null }, { onSuccess: () => onDone(`${longDay(date)} is marked closed. No classes can be scheduled with a coach that day.`), onError: (e) => setProblem(`Could not save: ${e.message}`) });
  const reopen = () => closed && writes.removeClosed.mutate(closed.id, { onSuccess: () => onDone(`${longDay(date)} is open again.`), onError: (e) => setProblem(`Could not save: ${e.message}`) });
  return (
    <Modal title="Gym closed" onClose={onClose}>
      <SectionTitle title={longDay(date)} action={<Button onClick={onClose}>Close</Button>} />
      <div className="rota-stack">
        {closed ? (
          <>
            <div>The gym is marked closed{closed.reason ? `: ${closed.reason}` : ''}.</div>
            {problem && <div className="field-error" role="alert">{problem}</div>}
            <div className="rota-actions"><Button variant="primary" disabled={writes.removeClosed.isPending} onClick={reopen}>Open this day again</Button><Button onClick={onClose}>Keep closed</Button></div>
          </>
        ) : (
          <>
            <Field label="Reason (optional)" htmlFor="closed-reason" hint="For example Bank holiday or Halloween event.">
              <Input id="closed-reason" maxLength={200} value={reason} onChange={(e) => setReason(e.target.value)} />
            </Field>
            {problem && <div className="field-error" role="alert">{problem}</div>}
            <div className="small muted">No class can be scheduled with a coach on a closed day, and personal training cannot be booked. Anything already booked stays as it is.</div>
            <div className="rota-actions"><Button variant="primary" disabled={writes.addClosed.isPending} onClick={mark}>Mark as closed</Button><Button onClick={onClose}>Cancel</Button></div>
          </>
        )}
      </div>
    </Modal>
  );
}
