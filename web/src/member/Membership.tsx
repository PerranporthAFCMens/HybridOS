import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useReadyAuth } from '../auth/AuthProvider';
import { askToCancel, askToChange, askToPause, getMyOptions, withdrawRequest } from '../data/rules';
import { Button } from '../ui/Button';
import { DateInput, Input } from '../ui/Field';
import {
  cancelSentence, changeSentence, describeRequest, KIND_LABEL, money2, niceDay, pauseProblem, pauseSentence, readOptions, REASONS_CANCEL, REASONS_PAUSE, STATUS_LABEL,
  type Options,
} from '../membership/calc';

type Flow = 'pause' | 'cancel' | 'change' | null;

/** Pause, change plan or cancel, within the rules the gym has set. The database decides; this only asks and explains. */
export function Membership() {
  const { gym } = useReadyAuth();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['m-options', gym.gymId], queryFn: async () => readOptions(await getMyOptions(gym.gymId)) });
  const [flow, setFlow] = useState<Flow>(null);
  const [msg, setMsg] = useState<{ text: string; good: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async (work: () => Promise<void>, done: string) => {
    setBusy(true);
    setMsg(null);
    try {
      await work();
      setMsg({ text: done, good: true });
      setFlow(null);
      await Promise.all([qc.invalidateQueries({ queryKey: ['m-options', gym.gymId] }), qc.invalidateQueries({ queryKey: ['m-plan'] })]);
    } catch (e) {
      setMsg({ text: e instanceof Error ? e.message : 'Could not send that.', good: false });
    } finally {
      setBusy(false);
    }
  };

  const o = q.data;
  return (
    <div className="mem-screen">
      <Link className="muted" to="/m/me">‹ Me</Link>
      <h1 className="mem-title">My membership</h1>
      {msg && <div className={msg.good ? 'mem-card mem-ok' : 'mem-error'} role={msg.good ? 'status' : 'alert'}>{msg.text}</div>}
      {q.isPending && <div className="muted">Loading…</div>}
      {q.isError && <div className="mem-error" role="alert">Could not load your membership. Refresh to try again.</div>}
      {q.isSuccess && !o && <section className="mem-card"><div className="muted">No membership found for this gym.</div></section>}
      {o && (
        <>
          <section className="mem-card" aria-label="Current membership">
            <div className="mem-line"><b className="mem-big">{o.membership.planName}</b><span className="mem-pill">{o.membership.status}</span></div>
            <div className="muted">{money2(o.membership.pricePence)} {o.membership.interval}</div>
            {o.membership.endsOn && <div className="muted small">Ends {niceDay(o.membership.endsOn)}</div>}
          </section>

          <Requests o={o} busy={busy} onWithdraw={(id) => void run(() => withdrawRequest(id), 'Request withdrawn.')} />

          {flow === null && <Choices o={o} onPick={(f) => { setMsg(null); setFlow(f); }} />}
          {flow === 'pause' && <PauseFlow o={o} busy={busy} onBack={() => setFlow(null)} onSend={(a, b, r) => void run(() => askToPause(o.membership.id, a, b, r), o.pause.approval === 'admin' ? 'Sent. The gym will let you know.' : 'Your pause is booked.')} />}
          {flow === 'change' && <ChangeFlow o={o} busy={busy} onBack={() => setFlow(null)} onSend={(id) => void run(() => askToChange(o.membership.id, id), o.change.approval === 'admin' ? 'Sent. The gym will let you know.' : 'Your plan is changing.')} />}
          {flow === 'cancel' && <CancelFlow o={o} busy={busy} onBack={() => setFlow(null)} onPause={() => setFlow('pause')} onSend={(r) => void run(() => askToCancel(o.membership.id, r), o.cancel.approval === 'admin' ? 'Sent. The gym will be in touch.' : 'Your cancellation is booked.')} />}
        </>
      )}
    </div>
  );
}

function Requests({ o, busy, onWithdraw }: { o: Options; busy: boolean; onWithdraw: (id: string) => void }) {
  const live = o.requests.filter((r) => r.status === 'pending' || r.status === 'approved' || r.status === 'applied');
  if (live.length === 0) return null;
  const plans = new Map(o.change.plans.map((p) => [p.id, p.name]));
  return (
    <section className="mem-card" aria-label="Your requests">
      <h2>Your requests</h2>
      {live.map((r) => (
        <div key={r.id} className="mem-line">
          <div>
            <b>{KIND_LABEL[r.kind] ?? r.kind}</b> <span className="mem-pill">{STATUS_LABEL[r.status] ?? r.status}</span>
            <div className="muted small">{describeRequest(r, plans)}</div>
            {r.decisionNote && <div className="muted small">Note: {r.decisionNote}</div>}
          </div>
          {(r.status === 'pending' || r.status === 'approved') && <Button disabled={busy} aria-label={`Withdraw ${KIND_LABEL[r.kind] ?? r.kind} request`} onClick={() => onWithdraw(r.id)}>Withdraw</Button>}
        </div>
      ))}
    </section>
  );
}

function Choices({ o, onPick }: { o: Options; onPick: (f: Exclude<Flow, null>) => void }) {
  const row = (title: string, text: string, ok: boolean, why: string, flow: Exclude<Flow, null>) => (
    <div className="mem-line">
      <div>
        <b>{title}</b>
        <div className="muted small">{ok ? text : why}</div>
      </div>
      {ok && <Button aria-label={title} onClick={() => onPick(flow)}>Start</Button>}
    </div>
  );
  const any = o.pause.enabled || o.cancel.enabled || o.change.plans.length > 0 || o.change.allowed;
  return (
    <section className="mem-card" aria-label="What you can do">
      <h2>Need a change?</h2>
      {!any && <div className="muted">To pause, change or cancel your membership please ask at the gym.</div>}
      {o.pause.enabled && row('Pause my membership', pauseSentence(o.pause), o.pause.allowed, o.pause.reason, 'pause')}
      {(o.change.allowed || o.change.plans.length > 0) && row('Change my plan', changeSentence(o.change.approval), o.change.allowed, o.change.reason, 'change')}
      {o.cancel.enabled && row('Cancel my membership', cancelSentence(o.cancel), o.cancel.allowed, o.cancel.reason, 'cancel')}
    </section>
  );
}

function Reasons({ list, value, onChange }: { list: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="mem-actions" role="radiogroup" aria-label="Reason">
      {list.map((r) => <Button key={r} role="radio" aria-checked={value === r} variant={value === r ? 'primary' : 'secondary'} onClick={() => onChange(value === r ? '' : r)}>{r}</Button>)}
    </div>
  );
}

function PauseFlow({ o, busy, onBack, onSend }: { o: Options; busy: boolean; onBack: () => void; onSend: (from: string, to: string, reason: string) => void }) {
  const [from, setFrom] = useState(o.pause.earliestStart);
  const [to, setTo] = useState('');
  const [reason, setReason] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  return (
    <section className="mem-card" aria-label="Pause my membership">
      <h2>Pause my membership</h2>
      <p className="muted small">{pauseSentence(o.pause)} You have used {o.pause.used} of {o.pause.maxPerYear} pauses this year.</p>
      <label htmlFor="pause-from">Pause starts</label>
      <DateInput id="pause-from" min={o.pause.earliestStart} value={from} onChange={(e) => { setProblem(null); setFrom(e.target.value); }} />
      <label htmlFor="pause-to">Pause ends</label>
      <DateInput id="pause-to" min={from} value={to} onChange={(e) => { setProblem(null); setTo(e.target.value); }} />
      <Reasons list={REASONS_PAUSE} value={reason} onChange={setReason} />
      {o.pause.feePence > 0 && <p className="small">A fee of {money2(o.pause.feePence)} applies to a pause.</p>}
      {problem && <div className="mem-error" role="alert">{problem}</div>}
      <div className="mem-actions">
        <Button variant="primary" disabled={busy} onClick={() => { const p = pauseProblem(o.pause, from, to); if (p) setProblem(p); else onSend(from, to, reason); }}>{o.pause.approval === 'admin' ? 'Ask the gym' : 'Pause my membership'}</Button>
        <Button onClick={onBack}>Back</Button>
      </div>
    </section>
  );
}

function ChangeFlow({ o, busy, onBack, onSend }: { o: Options; busy: boolean; onBack: () => void; onSend: (planId: string) => void }) {
  return (
    <section className="mem-card" aria-label="Change my plan">
      <h2>Change my plan</h2>
      <p className="muted small">{changeSentence(o.change.approval)}</p>
      {o.change.plans.length === 0 && <div className="muted">There are no plans you can switch to right now.</div>}
      {o.change.plans.map((p) => (
        <div key={p.id} className="mem-line">
          <div>
            <b>{p.name}</b>
            <div className="muted small">{money2(p.pricePence)} {p.interval} · {p.direction === 'up' ? 'bigger plan' : 'cheaper plan'} · from {niceDay(p.startsOn)}</div>
          </div>
          <Button disabled={busy} aria-label={`Choose ${p.name}`} onClick={() => onSend(p.id)}>Choose</Button>
        </div>
      ))}
      <Button onClick={onBack}>Back</Button>
    </section>
  );
}

function CancelFlow({ o, busy, onBack, onPause, onSend }: { o: Options; busy: boolean; onBack: () => void; onPause: () => void; onSend: (reason: string) => void }) {
  const [reason, setReason] = useState('');
  const [other, setOther] = useState('');
  const [skipped, setSkipped] = useState(false);
  const c = o.cancel;
  if (c.offerPause && o.pause.enabled && o.pause.allowed && !skipped) {
    return (
      <section className="mem-card" aria-label="Before you go">
        <h2>Before you go</h2>
        <p>Would a break help? You can pause instead and come back when you are ready.</p>
        <p className="muted small">{pauseSentence(o.pause)}</p>
        <div className="mem-actions">
          <Button variant="primary" onClick={onPause}>Pause instead</Button>
          <Button onClick={() => setSkipped(true)}>No, I want to cancel</Button>
          <Button onClick={onBack}>Back</Button>
        </div>
      </section>
    );
  }
  return (
    <section className="mem-card" aria-label="Cancel my membership">
      <h2>Cancel my membership</h2>
      <p>Your last day would be <b>{niceDay(c.lastDay)}</b>.</p>
      {c.inTerm && c.earlyMode === 'wait' && <p className="muted small">You are in your minimum term, so it can only end from {niceDay(c.termEndsOn)}.</p>}
      {c.feePence > 0 && <p className="small">Leaving early costs {money2(c.feePence)}.</p>}
      {c.askReason && (
        <>
          <p className="muted small">Why are you leaving? (optional)</p>
          <Reasons list={REASONS_CANCEL} value={reason} onChange={setReason} />
          {reason === 'Other' && <Input aria-label="Tell us more" placeholder="Tell us more" maxLength={200} value={other} onChange={(e) => setOther(e.target.value)} />}
        </>
      )}
      <div className="mem-actions">
        <Button variant="primary" disabled={busy} onClick={() => onSend(reason === 'Other' && other.trim() ? `Other: ${other.trim()}` : reason)}>{c.approval === 'admin' ? 'Ask the gym to cancel' : 'Cancel my membership'}</Button>
        <Button onClick={onBack}>Keep my membership</Button>
      </div>
    </section>
  );
}
