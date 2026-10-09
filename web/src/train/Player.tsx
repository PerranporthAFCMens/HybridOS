import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useReadyAuth } from '../auth/AuthProvider';
import { completeWorkout, getMyAssignment, listLastTimes, markStarted, removeExercise, saveExercise, type LastTime } from '../data/train';
import { Button } from '../ui/Button';
import { wonMessage, type Won } from './pb';
import { guessTracking } from './activities';
import { ExercisePicker } from './ExercisePicker';
import { Checkbox, Input, Select } from '../ui/Field';
import { FIELDS, SIDES, assignmentNote, blankSets, fromDbSet, prepareFinish, readSnapshot, setText, type PlayedActivity, type SetValues, type Tracking } from './calc';

interface Act extends PlayedActivity { key: string; plan: string; planNote: string; block: string; entryId?: string; savedText?: string }
interface Draft { acts: Act[]; rpe: string; notes: string; sessionId?: string | null }

const draftKey = (gymId: string, id: string) => `hybrid-train-draft:${gymId}:${id}`;
const readDraft = (key: string): Draft | null => {
  try {
    const raw = JSON.parse(localStorage.getItem(key) ?? 'null') as Draft | null;
    return raw && Array.isArray(raw.acts) ? raw : null;
  } catch {
    return null;
  }
};
const TRACK_CHOICES: [Tracking, string][] = [['strength', 'Weight and reps'], ['reps', 'Reps'], ['time', 'Time'], ['distance', 'Distance'], ['calories', 'Calories']];

/** Open a coach's workout (or start a blank one), fill in the numbers, finish. */
export function Player() {
  const { id = 'new' } = useParams();
  const { gym, userId } = useReadyAuth();
  const isNew = id === 'new';
  const plan = useQuery({ queryKey: ['m-assignment', gym.gymId, id], queryFn: () => getMyAssignment(userId, gym.gymId, id), enabled: !isNew });
  const last = useQuery({ queryKey: ['m-last', gym.gymId, userId], queryFn: () => listLastTimes(userId, gym.gymId) });
  if (!isNew && plan.isPending) return <div className="mem-screen"><div className="mem-card muted">Loading…</div></div>;
  if (!isNew && (plan.isError || !plan.data)) return <div className="mem-screen"><h1 className="mem-title">Workout not found</h1><div className="mem-card muted">It may have been finished or removed. <Link to="/m/train">Back to Train</Link></div></div>;
  if (last.isPending) return <div className="mem-screen"><div className="mem-card muted">Loading…</div></div>;
  return <Logger key={id} id={id} title={plan.data?.title ?? ''} snapshot={plan.data?.snapshot ?? null} source={plan.data?.source ?? ''} last={last.data ?? new Map()} />;
}

function Logger({ id, title, snapshot, source, last }: { id: string; title: string; snapshot: unknown; source: string; last: Map<string, LastTime> }) {
  const { gym, userId } = useReadyAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const isNew = id === 'new';
  const key = draftKey(gym.gymId, id);
  const initial = useMemo<Draft>(() => {
    const saved = readDraft(key);
    if (saved) return saved;
    const acts: Act[] = readSnapshot(snapshot).activities.map((a) => ({ key: a.key, name: a.name, originalName: a.name, tracking: a.tracking, sets: blankSets(a.tracking), done: false, skipped: false, note: '', plan: a.plan, planNote: a.note, block: a.block }));
    return { acts, rpe: '', notes: '' };
  }, [key, snapshot]);
  const [acts, setActs] = useState<Act[]>(initial.acts);
  const [rpe, setRpe] = useState(initial.rpe);
  const [notes, setNotes] = useState(initial.notes);
  const [swapping, setSwapping] = useState<string | null>(null);
  const [adding, setAdding] = useState({ name: '', tracking: 'strength' as Tracking });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(initial.sessionId ?? null);
  const [won, setWon] = useState<Won[]>([]);
  const [pbIssue, setPbIssue] = useState<string | null>(null);
  const [cardError, setCardError] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [manualTracking, setManualTracking] = useState(false);
  const own = useMemo(() => [...last.values()].map((l) => l.name), [last]);

  useEffect(() => { if (!isNew) void markStarted(id); }, [id, isNew]);
  useEffect(() => {
    try { localStorage.setItem(key, JSON.stringify({ acts, rpe, notes, sessionId } satisfies Draft)); } catch { /* the draft is a convenience */ }
  }, [key, acts, rpe, notes, sessionId]);

  const patch = (k: string, p: Partial<Act>) => setActs((list) => list.map((a) => (a.key === k ? { ...a, ...p } : a)));
  const setSet = (k: string, i: number, field: string, value: string) => setActs((list) => list.map((a) => (a.key === k ? { ...a, sets: a.sets.map((s, j) => (j === i ? { ...s, [field]: value } : s)) } : a)));
  /** Take one set out (at least one set always stays). */
  // An exercise the member added (not one the coach sent) can be taken out completely; the coach's can only be skipped.
  const isOwn = (a: Act) => a.originalName === '';
  const removeSet = (k: string, i: number) => setActs((list) => list.map((a) => (a.key === k && a.sets.length > 1 ? { ...a, sets: a.sets.filter((_, j) => j !== i) } : a)));
  const lastFor = (a: Act) => last.get(a.originalName.trim().toLowerCase());
  const copyLast = (a: Act) => {
    const l = lastFor(a);
    if (l) patch(a.key, { sets: l.sets.map((s) => fromDbSet(a.tracking, s)), sided: l.sets.some((s) => s.side) || a.sided });
  };
  const addExercise = () => {
    const name = adding.name.trim();
    if (!name) return;
    setActs((list) => [...list, { key: `n${Date.now()}`, name, originalName: '', tracking: adding.tracking, sets: blankSets(adding.tracking), done: false, skipped: false, note: '', plan: '', planNote: '', block: '' }]);
    setAdding({ name: '', tracking: adding.tracking });
    setManualTracking(false);
  };
  const typeName = (name: string) => setAdding((x) => ({ name, tracking: manualTracking ? x.tracking : guessTracking(name) }));

  const refresh = () => Promise.all([qc.invalidateQueries({ queryKey: ['m-assignments'] }), qc.invalidateQueries({ queryKey: ['m-week'] }), qc.invalidateQueries({ queryKey: ['m-sessions'] }), qc.invalidateQueries({ queryKey: ['m-last'] }), qc.invalidateQueries({ queryKey: ['m-pbs'] })]);
  const titleFor = (first: string) => title || first || 'Workout';

  /** Save one exercise now. */
  const saveOne = async (a: Act, quiet = false): Promise<boolean> => {
    setCardError((e) => ({ ...e, [a.key]: '' }));
    const r = prepareFinish([a]);
    if (!r.ok) { setCardError((e) => ({ ...e, [a.key]: r.message })); return false; }
    const entry = r.entries[0];
    if (!entry) { if (!quiet) setCardError((e) => ({ ...e, [a.key]: 'Add some numbers first.' })); return false; }
    setSaving(a.key);
    try {
      const res = await saveExercise({ gymId: gym.gymId, userId, sessionId, title: titleFor(entry.name), position: acts.filter((x) => x.entryId).length }, entry);
      setSessionId(res.sessionId);
      patch(a.key, { entryId: res.entryId, savedText: a.sets.map((s) => setText(a.tracking, s)).filter(Boolean).join(', ') });
      setWon((w) => [...w, ...res.won]);
      if (res.pbError) setPbIssue(res.pbError);
      return true;
    } catch (e) {
      setCardError((m) => ({ ...m, [a.key]: e instanceof Error ? e.message : 'Could not save that exercise.' }));
      return false;
    } finally {
      setSaving(null);
    }
  };

  /** Take a saved exercise back so it can be changed. */
  const change = async (a: Act) => {
    if (!a.entryId) return;
    setSaving(a.key);
    try {
      await removeExercise(a.entryId);
      patch(a.key, { entryId: undefined, savedText: undefined });
    } catch (e) {
      setCardError((m) => ({ ...m, [a.key]: e instanceof Error ? e.message : 'Could not change that exercise.' }));
    } finally {
      setSaving(null);
    }
  };

  /** Take an exercise the member added themselves out of the workout, saved or not. */
  const drop = async (a: Act) => {
    setSaving(a.key);
    try {
      if (a.entryId) await removeExercise(a.entryId);
      setActs((list) => list.filter((x) => x.key !== a.key));
    } catch (e) {
      setCardError((m) => ({ ...m, [a.key]: e instanceof Error ? e.message : 'Could not remove that exercise.' }));
    } finally {
      setSaving(null);
    }
  };

  const finish = async () => {
    setError('');
    const overview = prepareFinish(acts.map((a) => (a.entryId ? { ...a, sets: [] } : a)));
    if (!overview.ok) return setError(overview.message);
    const pending = acts.filter((a) => !a.entryId && !a.skipped);
    setBusy(true);
    let session = sessionId;
    const newWins: Won[] = [];
    try {
      let anySaved = acts.some((a) => a.entryId);
      for (const a of pending) {
        const r = prepareFinish([a]);
        if (!r.ok) return setError(r.message);
        const entry = r.entries[0];
        if (!entry) continue;
        const res = await saveExercise({ gymId: gym.gymId, userId, sessionId: session, title: titleFor(entry.name), position: acts.filter((x) => x.entryId).length + (anySaved ? 1 : 0) }, entry);
        session = res.sessionId;
        anySaved = true;
        newWins.push(...res.won);
        if (res.pbError) setPbIssue(res.pbError);
        patch(a.key, { entryId: res.entryId });
      }
      setSessionId(session);
      if (isNew && !anySaved) return setError('Add some numbers first, or go back.');
      const firstName = acts.find((a) => a.name.trim())?.name.trim() ?? '';
      const result = await completeWorkout({ sessionId: session, title: titleFor(firstName), notes: notes.trim() || null, assignment: isNew ? null : { id, rpe: rpe ? Number(rpe) : null, note: assignmentNote(notes, overview.skipped, overview.swapped) } });
      try { localStorage.removeItem(key); } catch { /* nothing to clear */ }
      await refresh();
      const pb = wonMessage([...won, ...newWins]);
      navigate('/m/train', { state: { saved: result.marked ? 'Workout saved and marked as done.' : 'Workout saved.', pb, pbError: pbIssue } });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save the workout.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mem-screen">
      <div>
        <Link to="/m/train" className="mem-back">‹ Workouts</Link>
        <h1 className="mem-title">{title || 'My workout'}</h1>
        {source && !isNew && <div className="mem-hi">From your coach. These are suggestions: change, swap or skip anything.</div>}
      </div>

      {acts.length === 0 && <div className="mem-card muted">No exercises yet. Add the first one below.</div>}
      {acts.map((a, idx) => {
        const l = lastFor(a);
        const fields = FIELDS[a.tracking];
        const prev = idx > 0 ? acts[idx - 1] : undefined;
        return (
          <section key={a.key} className={`mem-card tr-act${a.skipped ? ' skipped' : ''}`} aria-label={a.name}>
            {a.block && a.block !== prev?.block && <div className="mem-eyebrow">{a.block}</div>}
            <div className="mem-row">
              <div>
                <b className="tr-name">{a.name}</b>
                {a.originalName && a.originalName !== a.name && <div className="muted small">Swapped from {a.originalName}</div>}
                {a.plan && <div className="muted small">Suggested: {a.plan}</div>}
                {a.planNote && <div className="muted small">{a.planNote}</div>}
              </div>
              {a.skipped && <Button onClick={() => patch(a.key, { skipped: false })} aria-label={`Undo skip ${a.name}`}>Undo</Button>}
            </div>
            {a.skipped ? <div className="muted">Skipped. That is fine.</div> : a.entryId ? (
              <div className="tr-saved">
                <span className="tr-ok">Saved</span>
                {a.savedText && <div className="muted">{a.savedText}</div>}
                <Button disabled={saving === a.key} onClick={() => void change(a)} aria-label={`Change ${a.name}`}>Change</Button>
                {isOwn(a) && <Button disabled={saving === a.key} onClick={() => void drop(a)} aria-label={`Remove ${a.name}`}>Remove</Button>}
              </div>
            ) : a.tracking === 'instruction' ? (
              <Checkbox label="Done" checked={a.done} onChange={(v) => patch(a.key, { done: v })} />
            ) : (
              <>
                {l && l.sets.length > 0 && <div className="muted small">Last time: {l.sets.map((s) => setText(a.tracking, fromDbSet(a.tracking, s))).filter(Boolean).join(', ')}</div>}
                <div className="tr-sets">
                  {a.sets.map((s: SetValues, i) => (
                    <div className="tr-set-wrap" key={i}>
                      <div className="tr-set">
                        <span className="muted tr-n">{i + 1}</span>
                        {fields.map((f) => (
                          <Input key={f.id} className="tr-box" inputMode={f.id === 'time' ? 'text' : 'decimal'} aria-label={`${a.name} set ${i + 1} ${f.hint}`} placeholder={f.label}
                            value={s[f.id] ?? ''} onChange={(e) => setSet(a.key, i, f.id, e.target.value)} />
                        ))}
                        {a.sets.length > 1 && <button type="button" className="tr-del" aria-label={`Remove set ${i + 1} from ${a.name}`} onClick={() => removeSet(a.key, i)}>✕</button>}
                      </div>
                      {a.sided && (
                        <div className="tr-side" role="radiogroup" aria-label={`${a.name} set ${i + 1} side`}>
                          {SIDES.map(([v, label]) => (
                            <button key={v} type="button" role="radio" aria-checked={s.side === v} className={`tr-side-btn${s.side === v ? ' on' : ''}`} onClick={() => setSet(a.key, i, 'side', s.side === v ? '' : v)}>{label}</button>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                <div className="mem-actions tr-tools">
                  <Button onClick={() => patch(a.key, { sets: [...a.sets, {}] })} aria-label={`Add a set to ${a.name}`}>+ Set</Button>
                  <Button onClick={() => patch(a.key, { sided: !a.sided })} aria-pressed={!!a.sided} aria-label={`Left and right for ${a.name}`}>{a.sided ? 'Left / right: on' : 'Left / right'}</Button>
                  {l && l.sets.length > 0 && <Button onClick={() => copyLast(a)} aria-label={`Copy last time for ${a.name}`}>Copy last time</Button>}
                </div>
                <Button variant="primary" disabled={saving === a.key} onClick={() => void saveOne(a)} aria-label={`Save ${a.name}`}>{saving === a.key ? 'Saving…' : 'Save exercise'}</Button>
              </>
            )}
            {cardError[a.key] && <div className="mem-error" role="alert">{cardError[a.key]}</div>}
            {!a.skipped && !a.entryId && (
              <div className="mem-actions tr-tools">
                <Button onClick={() => setSwapping(swapping === a.key ? null : a.key)} aria-expanded={swapping === a.key} aria-label={`Swap ${a.name}`}>Swap</Button>
                {isOwn(a)
                  ? <Button onClick={() => void drop(a)} aria-label={`Remove ${a.name}`}>Remove</Button>
                  : <Button onClick={() => patch(a.key, { skipped: true })} aria-label={`Skip ${a.name}`}>Skip</Button>}
              </div>
            )}
            {swapping === a.key && !a.skipped && !a.entryId && (
              <ExercisePicker label={`Swap ${a.name} for`} placeholder="What did you do instead?" value={a.name} own={own} onChange={(v) => patch(a.key, { name: v })} onPick={(n) => patch(a.key, { name: n })} />
            )}
          </section>
        );
      })}

      <section className="mem-card" aria-label="Add an exercise">
        <h2>Add an exercise</h2>
        <ExercisePicker label="Exercise name" placeholder="Start typing, like squat or row" value={adding.name} own={own} onChange={typeName} onPick={typeName} />
        <Select aria-label="What to record" value={adding.tracking} onChange={(e) => { setManualTracking(true); setAdding({ ...adding, tracking: e.target.value as Tracking }); }}>
          {TRACK_CHOICES.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
        </Select>
        <Button disabled={!adding.name.trim()} onClick={addExercise}>Add exercise</Button>
      </section>

      <section className="mem-card" aria-label="Finish">
        {!isNew && (
          <Select aria-label="How hard was it" value={rpe} onChange={(e) => setRpe(e.target.value)}>
            <option value="">How hard was it? (optional)</option>
            {Array.from({ length: 10 }, (_, i) => <option key={i + 1} value={String(i + 1)}>{i + 1}{i === 0 ? ' · very easy' : i === 9 ? ' · all out' : ''}</option>)}
          </Select>
        )}
        <Input aria-label="Notes" placeholder="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} />
        {error && <div className="mem-error" role="alert">{error}</div>}
        {pbIssue && <div className="mem-error" role="alert">A personal best could not be saved: {pbIssue}</div>}
        <Button variant="primary" disabled={busy} onClick={() => void finish()}>{busy ? 'Saving…' : 'Finish workout'}</Button>
        <Link to="/m/train" className="btn secondary">Leave for now</Link>
      </section>
    </div>
  );
}
