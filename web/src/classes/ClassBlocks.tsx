import { useState } from 'react';
import { useReadyAuth } from '../auth/AuthProvider';
import type { BlockClass, ClassBlock } from '../data/classBlocks';
import { Button } from '../ui/Button';
import { Card, Empty, SectionTitle } from '../ui/Card';
import { Checkbox, DateInput, Field, Input } from '../ui/Field';
import { Modal } from '../ui/Modal';
import { blockLabel, blockLastDay, blockState, groupByWeek, validateBlock } from './blocks';
import { dayTitle, timeRange } from './calc';
import { useBlockClasses, useBlocks, useBlockWrites } from './useBlocks';

const todayDay = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London' }).format(new Date());
const dateText = (day: string) => new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${day}T12:00:00Z`));
const WORKOUT_TEXT: Record<BlockClass['workout'], string> = { none: 'No workout yet', draft: 'Draft', available: 'Available' };

/**
 * Blocks: a named run of weeks (like "Hybrid Uppers, 6 weeks"). The coach chooses which classes belong to it: one class, or
 * several a week. Each class keeps its own workout. A class can be in one block.
 */
export function ClassBlocks({ onClose }: { onClose: () => void }) {
  const { gym, userId } = useReadyAuth();
  const q = useBlocks(gym.gymId);
  const w = useBlockWrites(gym.gymId, userId);
  const [openId, setOpenId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', startsOn: todayDay(), weeks: '6' });
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState('');
  const open = q.data?.find((b) => b.id === openId) ?? null;

  const create = () => {
    const c = validateBlock(form);
    if (!c.ok) return setError(c.message);
    setError('');
    w.create.mutate(c, { onSuccess: (id) => { setAdding(false); setOpenId(id); setForm({ name: '', startsOn: todayDay(), weeks: '6' }); }, onError: (e) => setError(e.message) });
  };

  return (
    <Modal title="Blocks" onClose={onClose}>
      <SectionTitle title={open ? open.name : 'Blocks'} action={<Button onClick={open ? () => setOpenId(null) : onClose}>{open ? 'Back to blocks' : 'Close'}</Button>} />
      {open ? <BlockDetail key={open.id} block={open} onGone={() => setOpenId(null)} /> : (
        <>
          <p className="muted small">A block is a run of weeks, like six weeks of Hybrid Uppers. You choose which classes are in it; each class keeps its own workout.</p>
          {q.isPending && <p className="muted small">Loading…</p>}
          {q.isError && <Card><Empty>Could not load blocks. Close and open Blocks to try again.</Empty></Card>}
          {q.data?.length === 0 && !adding && <Empty>No blocks yet.</Empty>}
          <ul className="team-list">
            {q.data?.map((b) => {
              const st = blockState(b.startsOn, b.weeks, todayDay());
              return (
                <li className="team-item" key={b.id}>
                  <div className="team-main">
                    <b>{b.name}</b>
                    <div className="muted small">{dateText(b.startsOn)} to {dateText(blockLastDay(b.startsOn, b.weeks))} · {b.weeks} {b.weeks === 1 ? 'week' : 'weeks'}</div>
                    <div className="tags"><span className={`tag ${st.state === 'running' ? 'good' : ''}`.trim()}>{st.state === 'running' ? `Week ${st.week} of ${b.weeks}` : st.state === 'upcoming' ? 'Not started' : 'Finished'}</span></div>
                  </div>
                  <div className="team-actions"><Button aria-label={`Open ${b.name}`} onClick={() => setOpenId(b.id)}>Open</Button></div>
                </li>
              );
            })}
          </ul>
          {adding ? (
            <div className="block-form">
              <Field label="Block name" htmlFor="blk-name"><Input id="blk-name" maxLength={80} placeholder="Hybrid Uppers" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
              <Field label="Starts on" htmlFor="blk-start"><DateInput id="blk-start" value={form.startsOn} onChange={(e) => setForm({ ...form, startsOn: e.target.value })} /></Field>
              <Field label="Number of weeks" htmlFor="blk-weeks"><Input id="blk-weeks" type="number" inputMode="numeric" min="1" max="52" value={form.weeks} onChange={(e) => setForm({ ...form, weeks: e.target.value })} /></Field>
              <div className="cw-actions">
                <Button variant="primary" disabled={w.create.isPending} onClick={create}>{w.create.isPending ? 'Creating…' : 'Create block'}</Button>
                <Button onClick={() => { setAdding(false); setError(''); }}>Cancel</Button>
              </div>
            </div>
          ) : <Button variant="primary" className="wide-btn" onClick={() => { setAdding(true); setError(''); }}>New block</Button>}
          {error && <div className="msg error" role="alert">{error}</div>}
        </>
      )}
    </Modal>
  );
}

function BlockDetail({ block, onGone }: { block: ClassBlock; onGone: () => void }) {
  const { gym, userId } = useReadyAuth();
  const w = useBlockWrites(gym.gymId, userId);
  const q = useBlockClasses(gym.gymId, block);
  const [picked, setPicked] = useState<Set<string> | null>(null);
  const [form, setForm] = useState({ name: block.name, startsOn: block.startsOn, weeks: String(block.weeks) });
  const [note, setNote] = useState<{ text: string; good: boolean } | null>(null);
  const [asking, setAsking] = useState(false);
  const classes = q.data ?? [];
  const was = new Set(classes.filter((c) => c.inBlock).map((c) => c.session.session_id));
  // The ticks start as what is in the block now; once the coach changes one they are the coach's.
  const chosen = picked ?? was;
  const add = [...chosen].filter((id) => !was.has(id));
  const remove = [...was].filter((id) => !chosen.has(id));
  const dirtyClasses = add.length > 0 || remove.length > 0;
  const toggle = (id: string, on: boolean) => { setNote(null); setPicked((p) => { const n = new Set(p ?? was); if (on) n.add(id); else n.delete(id); return n; }); };
  const weeksOf = groupByWeek(block.startsOn, block.weeks, classes.map((c) => ({ ...c, startsAt: c.session.starts_at })));
  const dirtyDetails = form.name !== block.name || form.startsOn !== block.startsOn || form.weeks !== String(block.weeks);

  const saveClasses = () => {
    setNote(null);
    w.classes.mutate({ blockId: block.id, add, remove }, { onSuccess: () => setNote({ text: `Saved. ${chosen.size} ${chosen.size === 1 ? 'class is' : 'classes are'} in this block.`, good: true }), onError: (e) => setNote({ text: e.message, good: false }) });
  };
  const saveDetails = () => {
    const c = validateBlock(form);
    if (!c.ok) return setNote({ text: c.message, good: false });
    setNote(null);
    w.update.mutate({ id: block.id, ...c }, { onSuccess: () => setNote({ text: 'Block saved. Classes outside its new weeks stay in it until you untick them.', good: true }), onError: (e) => setNote({ text: e.message, good: false }) });
  };

  return (
    <>
      <p className="muted small">{dateText(block.startsOn)} to {dateText(blockLastDay(block.startsOn, block.weeks))}. Tick the classes that are part of this block. Each keeps its own workout.</p>
      <div className="block-form">
        <Field label="Block name" htmlFor="bd-name"><Input id="bd-name" maxLength={80} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
        <Field label="Starts on" htmlFor="bd-start"><DateInput id="bd-start" value={form.startsOn} onChange={(e) => setForm({ ...form, startsOn: e.target.value })} /></Field>
        <Field label="Number of weeks" htmlFor="bd-weeks"><Input id="bd-weeks" type="number" inputMode="numeric" min="1" max="52" value={form.weeks} onChange={(e) => setForm({ ...form, weeks: e.target.value })} /></Field>
        {dirtyDetails && <Button variant="primary" disabled={w.update.isPending} onClick={saveDetails}>{w.update.isPending ? 'Saving…' : 'Save block details'}</Button>}
      </div>

      <h4 className="detail-heading">Classes in this block</h4>
      {q.isPending && <p className="muted small">Loading classes…</p>}
      {q.isError && <p className="muted small">Could not load the classes. Go back and open the block again.</p>}
      {q.data?.length === 0 && <p className="muted small">There are no classes on the timetable in these weeks yet. Add them from Add class, then come back.</p>}
      {q.data && q.data.length > 0 && (
        <>
          <div className="cw-actions">
            <Button onClick={() => { setNote(null); setPicked(new Set(classes.map((c) => c.session.session_id))); }}>Tick every class</Button>
            <Button onClick={() => { setNote(null); setPicked(new Set()); }}>Untick all</Button>
          </div>
          {weeksOf.map((wk) => (
            <div className="block-week" key={wk.week}>
              <div className="eyebrow">Week {wk.week}</div>
              {wk.items.length === 0 && <p className="muted small">No classes this week.</p>}
              {wk.items.map((c) => (
                <div className="block-class" key={c.session.session_id}>
                  <Checkbox label={`${c.session.name} · ${dayTitle(new Date(c.session.starts_at))} · ${timeRange(c.session)}`} checked={chosen.has(c.session.session_id)} onChange={(on) => toggle(c.session.session_id, on)} />
                  <span className={`tag ${c.workout === 'available' ? 'good' : ''}`.trim()}>{WORKOUT_TEXT[c.workout]}{c.workoutTitle ? `: ${c.workoutTitle}` : ''}</span>
                </div>
              ))}
            </div>
          ))}
          <Button variant="primary" className="wide-btn" disabled={!dirtyClasses || w.classes.isPending} onClick={saveClasses}>{w.classes.isPending ? 'Saving…' : dirtyClasses ? `Save classes (${add.length} to add, ${remove.length} to remove)` : 'Classes saved'}</Button>
        </>
      )}
      {note && <div className={`msg ${note.good ? '' : 'error'}`} role={note.good ? 'status' : 'alert'}>{note.text}</div>}
      <div className="cw-actions block-end">
        {!asking ? <Button onClick={() => setAsking(true)}>Delete this block</Button> : (
          <>
            <span className="muted small">Delete {blockLabel(block.name, null, block.weeks)}? The classes and their workouts stay; they just stop being part of a block.</span>
            <Button variant="primary" onClick={() => w.remove.mutate(block.id, { onSuccess: onGone, onError: (e) => setNote({ text: e.message, good: false }) })}>Yes, delete it</Button>
            <Button onClick={() => setAsking(false)}>Keep</Button>
          </>
        )}
      </div>
    </>
  );
}
