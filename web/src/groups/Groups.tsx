import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useReadyAuth } from '../auth/AuthProvider';
import { createChallenge, createGroup, joinByCode, listGroups, loadGroup, previewInvite, submitResult } from '../data/groups';
import { SITE } from '../app/site';
import { Button } from '../ui/Button';
import { Field, Input, Select, DateInput, Textarea } from '../ui/Field';
import { Modal } from '../ui/Modal';
import { METRICS, defaultLowerWins, inviteLink, parseResult, rankEntries, unitFor, validateChallenge, validateGroup, NAME_MAX, type Challenge, type GroupMember, type Metric } from './calc';

const day = (iso: string) => (iso ? new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'Europe/London' }).format(new Date(iso)) : '');
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;
const link = (code: string) => inviteLink(window.location.origin, SITE, code);

function CopyInvite({ code }: { code: string }) {
  const [done, setDone] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(link(code)); setDone(true); setTimeout(() => setDone(false), 1500); } catch { window.prompt('Copy this link', link(code)); }
  };
  return <Button onClick={copy}>{done ? 'Copied' : 'Copy invite link'}</Button>;
}

/** The member's private training groups: make one, share the invite link, post results in challenges. */
export function GroupList() {
  const { gym } = useReadyAuth();
  const nav = useNavigate();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['groups', gym.gymId], queryFn: () => listGroups(gym.gymId) });
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [error, setError] = useState('');
  const make = useMutation({
    mutationFn: () => { const v = validateGroup(name); if (!v.ok) throw new Error(v.message); return createGroup(gym.gymId, v.name, desc); },
    onSuccess: (id) => { void qc.invalidateQueries({ queryKey: ['groups', gym.gymId] }); setOpen(false); setName(''); setDesc(''); nav(`/m/groups/${id}`); },
    onError: (e: Error) => setError(e.message),
  });
  return (
    <div className="mem-screen">
      <div>
        <Link to="/m/community" className="mem-back">‹ Community</Link>
        <h1 className="mem-title">Training groups</h1>
        <div className="mem-hi">Private groups to share training, PBs and challenges with friends.</div>
      </div>
      <div className="mem-actions"><Button variant="primary" onClick={() => { setError(''); setOpen(true); }}>New group</Button></div>
      {q.isPending && <div className="muted">Loading…</div>}
      {q.isError && <div className="mem-error" role="alert">Could not load your groups. Refresh to try again.</div>}
      {q.data?.length === 0 && <section className="mem-card"><div className="muted">You are not in any groups yet. Make one, or open an invite link from a friend.</div></section>}
      {q.data?.map((g) => (
        <section key={g.id} className="mem-card" aria-label={g.name}>
          <span className="mem-eyebrow">Private training group</span>
          <h2>{g.name}</h2>
          {g.description && <div className="muted">{g.description}</div>}
          <div className="muted small">{plural(g.memberCount, 'member')} · {plural(g.challengeCount, 'active challenge')}</div>
          <div className="mem-actions"><Button onClick={() => nav(`/m/groups/${g.id}`)}>Open group</Button><CopyInvite code={g.inviteCode} /></div>
        </section>
      ))}
      {open && (
        <Modal title="New group" onClose={() => setOpen(false)}>
          <h2>New group</h2>
          <Field label="Group name" htmlFor="grp-name"><Input id="grp-name" maxLength={NAME_MAX} value={name} onChange={(e) => { setError(''); setName(e.target.value); }} /></Field>
          <Field label="Description (optional)" htmlFor="grp-desc"><Textarea id="grp-desc" rows={3} value={desc} onChange={(e) => setDesc(e.target.value)} /></Field>
          {error && <div className="mem-error" role="alert">{error}</div>}
          <div className="mem-actions"><Button onClick={() => setOpen(false)}>Cancel</Button><Button variant="primary" disabled={make.isPending} onClick={() => make.mutate()}>{make.isPending ? 'Creating…' : 'Create group'}</Button></div>
        </Modal>
      )}
    </div>
  );
}

function ChallengeCard({ c, groupId, me }: { c: Challenge; groupId: string; me: string }) {
  const qc = useQueryClient();
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const send = useMutation({
    mutationFn: (v: number) => submitResult(c.id, v),
    onSuccess: () => { setText(''); void qc.invalidateQueries({ queryKey: ['group', groupId] }); },
    onError: (e: Error) => setError(e.message),
  });
  const ranked = rankEntries(c.entries, c.lowerWins);
  const submit = () => {
    const v = parseResult(text);
    if (v === null) return setError('Enter a number first.');
    setError('');
    send.mutate(v);
  };
  return (
    <section className="mem-card" aria-label={c.name}>
      <span className="mem-eyebrow">{c.activity}</span>
      <h2>{c.name}</h2>
      <div className="muted small">{c.lowerWins ? 'Lowest' : 'Highest'} {c.metric} wins{c.endsAt ? ` · ends ${day(c.endsAt)}` : ''}</div>
      {ranked.length === 0 && <div className="muted">No results yet. Be the first to post one.</div>}
      {ranked.length > 0 && (
        <ol className="tr-board">
          {ranked.map((e) => (
            <li key={e.userId} className={e.userId === me ? 'me' : ''}><span className="tr-rank">{e.rank}</span><span className="tr-bname">{e.userId === me ? `${e.name} (you)` : e.name}</span><b>{e.value} {c.unit}</b></li>
          ))}
        </ol>
      )}
      <div className="cm-composer">
        <Input aria-label={`Your result for ${c.name}`} inputMode="decimal" placeholder="Your result" value={text} onChange={(e) => { setError(''); setText(e.target.value); }} />
        <Button variant="primary" disabled={send.isPending} onClick={submit}>{send.isPending ? 'Saving…' : 'Submit result'}</Button>
      </div>
      {error && <div className="mem-error" role="alert">{error}</div>}
    </section>
  );
}

function MemberCard({ m }: { m: GroupMember }) {
  return (
    <section className="mem-card" aria-label={m.name}>
      <h2>{m.name}</h2>
      <span className="mem-eyebrow">Recent workouts</span>
      {m.workouts.length === 0 ? <div className="muted small">No workouts shared yet</div> : m.workouts.map((w, i) => <div key={i} className="small"><b>{w.title}</b> <span className="muted">{day(w.at)}</span></div>)}
      <span className="mem-eyebrow">Recent PBs</span>
      {m.pbs.length === 0 ? <div className="muted small">No PBs shared yet</div> : m.pbs.map((p, i) => <div key={i} className="small"><b>{p.exercise}</b> <span className="muted">{p.value} {p.unit} · {day(p.at)}</span></div>)}
    </section>
  );
}

export function GroupDetail() {
  const { id = '' } = useParams();
  const { userId } = useReadyAuth();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['group', id], queryFn: () => loadGroup(id), enabled: id !== '' });
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [activity, setActivity] = useState('');
  const [metric, setMetric] = useState<Metric>('weight');
  const [unit, setUnit] = useState('kg');
  const [lower, setLower] = useState(false);
  const [endsOn, setEndsOn] = useState('');
  const [error, setError] = useState('');
  const pick = (m: Metric) => { setMetric(m); setUnit(unitFor(m)); setLower(defaultLowerWins(m)); };
  const make = useMutation({
    mutationFn: () => { const v = validateChallenge(name, activity); if (!v.ok) throw new Error(v.message); return createChallenge(id, { name: v.name, activity: v.activity, metric, unit, lowerWins: lower, endsOn }); },
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['group', id] }); void qc.invalidateQueries({ queryKey: ['groups'] }); setOpen(false); setName(''); setActivity(''); },
    onError: (e: Error) => setError(e.message),
  });
  const g = q.data;
  return (
    <div className="mem-screen">
      <div>
        <Link to="/m/groups" className="mem-back">‹ Training groups</Link>
        <h1 className="mem-title">{g?.name ?? 'Training group'}</h1>
        <div className="mem-hi">{g?.description || 'Private training group'}</div>
      </div>
      {q.isPending && <div className="muted">Loading…</div>}
      {q.isError && <div className="mem-error" role="alert">Could not open this group. You may not be a member of it.</div>}
      {g && (
        <>
          <div className="mem-actions"><CopyInvite code={g.inviteCode} /><Button variant="primary" onClick={() => { setError(''); setOpen(true); }}>New challenge</Button></div>
          <h2>Challenges</h2>
          {g.challenges.length === 0 && <section className="mem-card"><div className="muted">No challenges yet.</div></section>}
          {g.challenges.map((c) => <ChallengeCard key={c.id} c={c} groupId={id} me={userId} />)}
          <h2>Members · {g.members.length}</h2>
          {g.members.map((m) => <MemberCard key={m.userId} m={m} />)}
        </>
      )}
      {open && (
        <Modal title="New challenge" onClose={() => setOpen(false)}>
          <h2>New challenge</h2>
          <Field label="Challenge name" htmlFor="ch-name"><Input id="ch-name" maxLength={100} value={name} onChange={(e) => { setError(''); setName(e.target.value); }} /></Field>
          <Field label="Activity" htmlFor="ch-act"><Input id="ch-act" placeholder="e.g. Back squat" value={activity} onChange={(e) => { setError(''); setActivity(e.target.value); }} /></Field>
          <Field label="What is measured" htmlFor="ch-metric"><Select id="ch-metric" value={metric} onChange={(e) => pick(e.target.value as Metric)}>{METRICS.map((m) => <option key={m} value={m}>{m.charAt(0).toUpperCase() + m.slice(1)}</option>)}</Select></Field>
          <Field label="Unit" htmlFor="ch-unit"><Input id="ch-unit" value={unit} onChange={(e) => setUnit(e.target.value)} /></Field>
          <Field label="Who wins" htmlFor="ch-dir"><Select id="ch-dir" value={lower ? 'lower' : 'higher'} onChange={(e) => setLower(e.target.value === 'lower')}><option value="higher">Highest wins</option><option value="lower">Lowest wins</option></Select></Field>
          <Field label="Ends on (optional)" htmlFor="ch-end"><DateInput id="ch-end" value={endsOn} onChange={(e) => setEndsOn(e.target.value)} /></Field>
          {error && <div className="mem-error" role="alert">{error}</div>}
          <div className="mem-actions"><Button onClick={() => setOpen(false)}>Cancel</Button><Button variant="primary" disabled={make.isPending} onClick={() => make.mutate()}>{make.isPending ? 'Creating…' : 'Create challenge'}</Button></div>
        </Modal>
      )}
    </div>
  );
}

/** What an invite link opens: who invited you, then Join. Members are already signed in to reach it. */
export function JoinGroup() {
  const [params] = useSearchParams();
  const code = params.get('code') ?? '';
  const nav = useNavigate();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['group-invite', code], queryFn: () => previewInvite(code), enabled: code !== '', retry: false });
  const [error, setError] = useState('');
  const join = useMutation({
    mutationFn: () => joinByCode(code),
    onSuccess: (id) => { void qc.invalidateQueries({ queryKey: ['groups'] }); nav(`/m/groups/${id}`); },
    onError: (e: Error) => setError(e.message),
  });
  const p = q.data;
  return (
    <div className="mem-screen">
      <div>
        <Link to="/m/groups" className="mem-back">‹ Training groups</Link>
        <h1 className="mem-title">Join a group</h1>
      </div>
      {code === '' && <div className="mem-error" role="alert">This invite link is incomplete.</div>}
      {q.isPending && code !== '' && <div className="muted">Loading…</div>}
      {q.isError && <div className="mem-error" role="alert">This invite could not be opened. It may be out of date, or from a different gym.</div>}
      {p && (
        <section className="mem-card" aria-label="Invite">
          <span className="mem-eyebrow">You have been invited to</span>
          <h2>{p.name}</h2>
          {p.description && <div className="muted">{p.description}</div>}
          <div className="muted small">{plural(p.memberCount, 'member')} · created by {p.ownerName}</div>
          {p.alreadyMember
            ? <Button variant="primary" onClick={() => nav(`/m/groups/${p.id}`)}>Open group</Button>
            : <Button variant="primary" disabled={join.isPending} onClick={() => join.mutate()}>{join.isPending ? 'Joining…' : 'Join group'}</Button>}
          {error && <div className="mem-error" role="alert">{error}</div>}
        </section>
      )}
    </div>
  );
}
