import { useState } from 'react';
import { useReadyAuth } from '../auth/AuthProvider';
import type { StaffData } from '../data/staff';
import { links } from '../shell/legacy';
import { notifyStaffWelcome, welcomeNote } from '../data/notify';
import { Button, LinkButton } from '../ui/Button';
import { Card, Empty, SectionTitle } from '../ui/Card';
import { StaffEditor } from './StaffEditor';
import { QUAL_TEXT, hoursSummary, isActiveMember, isOperational, payText, qualState, roleLabel, statusLabel, type TeamRow } from './calc';
import { useStaffData, useStaffWrites } from './useStaff';
import '../members/members.css';
import './staff.css';

export function Staff() {
  const { gym } = useReadyAuth();
  const q = useStaffData(gym.gymId);
  const writes = useStaffWrites(gym.gymId);
  // null = closed; 'new' = adding a login; a person = editing them
  const [editing, setEditing] = useState<TeamRow | 'new' | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const d = q.data;
  const now = new Date();

  // "Send the welcome again": a new link when the first one has run out, or the email went astray.
  const [sending, setSending] = useState<string | null>(null);
  const sendWelcome = (m: TeamRow) => {
    setMessage('');
    setSending(m.userId);
    void notifyStaffWelcome(gym.gymId, m.userId, true).then((r) => setMessage(welcomeNote(r, m.name))).finally(() => setSending(null));
  };

  const remove = (m: TeamRow) =>
    writes.remove.mutate(m.userId, {
      onSuccess: () => { setRemoving(null); setMessage(`${m.name} no longer has access to ${gym.gymName}. Their HybridOne login stays.`); },
      onError: (e) => { setRemoving(null); setMessage(e.message); },
    });

  return (
    <>
      <header className="page-top">
        <div>
          <div className="eyebrow">Settings and staff</div>
          <h1>Staff</h1>
          <div className="muted">The people who run {gym.gymName}: their access, hours and qualifications.</div>
          <div className="muted small">Staff and coaches use the staff app. Anyone who should run the whole gym (a senior manager, say) is added as an admin under Owners and admins, and gets the full admin panel.</div>
        </div>
        <div className="staff-top">
          <LinkButton href={links.owners}>Owners and admins</LinkButton>
          <LinkButton href={links.settings}>Settings</LinkButton>
          <Button variant="primary" onClick={() => { setMessage(''); setEditing('new'); }}>Add staff login</Button>
        </div>
      </header>

      {q.isError && <Card><Empty>Could not load the team. Refresh to try again.</Empty></Card>}
      {q.isPending && <Card><Empty>Loading the team…</Empty></Card>}
      {message && <div className="msg" role="status">{message}</div>}

      {d && (
        <>
          <div className="stat-grid">
            <div className="card stat"><span className="muted">Team accounts</span><span className="stat-num">{d.team.length}</span></div>
            <div className="card stat"><span className="muted">Qualifications</span><span className="stat-num">{d.capabilities.length}</span></div>
            <div className="card stat"><span className="muted">Days with hours set</span><span className="stat-num">{d.hours.filter((h) => h.isWorking).length}</span></div>
          </div>
          <Card>
            <SectionTitle title="Team accounts" />
            {d.team.length === 0 && <Empty>No team accounts yet.</Empty>}
            <ul className="team-list">
              {d.team.map((m) => (
                <TeamItem key={m.userId} m={m} d={d} now={now} confirming={removing === m.userId} busy={writes.remove.isPending}
                  onEdit={() => { setMessage(''); setEditing(m); }} sendingWelcome={sending === m.userId} onSendWelcome={() => sendWelcome(m)} onAskRemove={() => setRemoving(m.userId)} onCancelRemove={() => setRemoving(null)} onRemove={() => remove(m)} />
              ))}
            </ul>
          </Card>
        </>
      )}

      {editing && d && <StaffEditor data={d} person={editing === 'new' ? null : editing} onClose={() => setEditing(null)} onDone={(text) => { setEditing(null); if (text) setMessage(text); }} />}
    </>
  );
}

function TeamItem({ m, d, now, confirming, busy, sendingWelcome, onEdit, onSendWelcome, onAskRemove, onCancelRemove, onRemove }: {
  m: TeamRow; d: StaffData; now: Date; confirming: boolean; busy: boolean; sendingWelcome: boolean; onEdit: () => void; onSendWelcome: () => void; onAskRemove: () => void; onCancelRemove: () => void; onRemove: () => void;
}) {
  const operational = isOperational(m.role);
  const active = isActiveMember(m);
  const profile = d.profiles.get(m.userId);
  const quals = d.quals.filter((x) => x.userId === m.userId).map((x) => ({ ...x, name: d.capabilities.find((c) => c.id === x.capabilityId)?.name ?? 'Qualification' }));
  const hours = d.hours.filter((h) => h.userId === m.userId);
  const level = d.levels.find((l) => l.id === d.access.get(m.userId))?.name;
  return (
    <li className="team-item">
      <div className="team-main">
        <b>{m.name}</b>
        <div className="muted">{m.email ? `${m.email} · ` : ''}{roleLabel(m.role)}{level && operational ? ` · ${level}` : ''}</div>
        <div className="tags">
          <span className={`tag ${active ? 'good' : 'warn'}`}>{statusLabel(m)}</span>
          {quals.map((x) => {
            const st = qualState(x.expiresOn, now);
            return <span key={x.capabilityId} className={`tag ${st === 'valid' ? 'good' : 'warn'}`}>{x.name}{QUAL_TEXT[st] ? ` · ${QUAL_TEXT[st]}` : ''}</span>;
          })}
        </div>
        {operational ? (
          <div className="muted small">{[profile?.jobTitle, payText(profile?.payPence ?? null), hoursSummary(hours)].filter(Boolean).join(' · ')}</div>
        ) : (
          <div className="muted small">{hoursSummary(hours)}</div>
        )}
      </div>
      <div className="team-actions">
        {operational && active && !confirming && (
          <>
            <Button aria-label={`Edit ${m.name}`} onClick={onEdit}>Edit</Button>
            <Button aria-label={`Send the welcome email again to ${m.name}`} disabled={sendingWelcome} onClick={onSendWelcome}>{sendingWelcome ? 'Sending…' : 'Send welcome'}</Button>
            <Button aria-label={`Remove ${m.name}`} onClick={onAskRemove}>Remove</Button>
          </>
        )}
        {confirming && (
          <div className="confirm">
            <span className="small">Remove {m.name}? Their login stays, but their access to this gym stops straight away.</span>
            <Button variant="primary" disabled={busy} onClick={onRemove}>Yes, remove</Button>
            <Button onClick={onCancelRemove}>Keep</Button>
          </div>
        )}
        {!operational && active && !confirming && <Button aria-label={`Hours and qualifications for ${m.name}`} onClick={onEdit}>Hours and qualifications</Button>}
        {!operational && <LinkButton href={links.owners}>Manage access</LinkButton>}
      </div>
    </li>
  );
}
