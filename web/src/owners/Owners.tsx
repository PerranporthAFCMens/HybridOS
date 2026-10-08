import { useState } from 'react';
import { useReadyAuth } from '../auth/AuthProvider';
import type { OwnersData } from '../data/owners';
import { Button } from '../ui/Button';
import { Card, Empty, SectionTitle } from '../ui/Card';
import { Field, FieldRow, Input, Select } from '../ui/Field';
import { EXPIRY_DAYS, actionLabel, activeOwners, approvalText, approvalsRequired, inviteActions, inviteLink, inviteStatus, outcomeText, personActions, validateInvite, type Invite, type Outcome, type Person } from './calc';
import { useOwners, useOwnersWrites } from './useOwners';
import '../members/members.css';
import '../staff/staff.css';
import './owners.css';

type Pending = { key: string; text: string; run: () => void };
type Note = { text: string; good: boolean };

const fmt = (iso: string) => new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London' }).format(new Date(iso));

export function Owners() {
  const { gym, userId } = useReadyAuth();
  const isOwner = gym.role === 'owner';
  const q = useOwners(gym.gymId, isOwner);
  const w = useOwnersWrites(gym.gymId);
  const [confirming, setConfirming] = useState<Pending | null>(null);
  const [note, setNote] = useState<Note | null>(null);
  const [link, setLink] = useState('');
  const [copied, setCopied] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', role: 'admin' as 'admin' | 'owner', days: 7 });
  const d = q.data;
  const busy = Object.values(w).some((m) => m.isPending);

  const ok = (text: string) => setNote({ text, good: true });
  const bad = (e: unknown) => setNote({ text: e instanceof Error ? e.message : 'Something went wrong.', good: false });
  const ask = (key: string, text: string, run: () => void) => { setNote(null); setConfirming({ key, text, run }); };
  const go = () => { const c = confirming; setConfirming(null); c?.run(); };

  const outcome = (kind: Outcome) => (result: unknown) => ok(outcomeText(kind, result));
  const doApprove = (p: Person) => w.approveAccess.mutate(p.userId, { onSuccess: outcome('approve-access'), onError: bad });
  const doPromote = (p: Person) => w.promote.mutate(p.userId, { onSuccess: outcome('promote'), onError: bad });
  const doRemoval = (p: Person) => w.requestRemoval.mutate(p.userId, { onSuccess: outcome('remove-owner'), onError: bad });
  const doRemoveAdmin = (p: Person) => w.removeAdmin.mutate(p.userId, { onSuccess: () => ok(`${p.name} no longer has access to ${gym.gymName}. Their HybridOne login stays.`), onError: bad });
  const doApproveAction = (id: string) => w.approveAction.mutate(id, { onSuccess: outcome('approve-action'), onError: bad });

  const showLink = (token: string, email: string, role: string) => { setLink(inviteLink(window.location.href, token, email, gym.gymName, role)); setCopied(false); };
  const doApproveInvite = (i: Invite) => {
    const byLink = i.delivery === 'link';
    w.approveOwnerInvite.mutate({ id: i.id, link: byLink }, {
      onSuccess: (r) => {
        if (!r.ready) return ok('Your owner approval is recorded. Waiting for the remaining owner approval(s).');
        if (byLink && r.token) { showLink(r.token, i.email, i.role); return ok('Your approval completed the owner approval requirement. The secure invite link is ready to copy.'); }
        w.sendEmail.mutate(i.id, { onSuccess: () => ok('Your approval completed the owner approval requirement. The invitation email has now been sent.'), onError: bad });
      },
      onError: bad,
    });
  };
  const doSend = (i: Invite) => w.sendEmail.mutate(i.id, { onSuccess: (email) => ok(`Invitation email sent${email ? ` to ${email}` : ''}.`), onError: bad });

  const invite = (byLink: boolean) => {
    setNote(null);
    setLink('');
    const check = validateInvite(form.name, form.email);
    if (!check.ok) return setNote({ text: check.message, good: false });
    w.createInvite.mutate({ email: check.email, name: check.name, role: form.role, days: form.days, link: byLink }, {
      onSuccess: (r) => {
        setForm((f) => ({ ...f, name: '', email: '' }));
        const roleName = form.role === 'owner' ? 'Owner' : 'Admin';
        if (r.status !== 'open') return ok(`Owner invitation created. ${r.approvals} of ${r.required} owner approvals recorded. ${byLink ? 'The secure link' : 'The email'} will be available after final approval.`);
        if (byLink && r.token) { showLink(r.token, check.email, form.role); return ok(`Secure invite link created. Copy it and send it directly to ${check.email}.`); }
        w.sendEmail.mutate(r.inviteId, {
          onSuccess: () => ok(`${roleName} invitation emailed to ${check.email}.`),
          onError: (e) => setNote({ text: `${e.message} The invite has been saved below. Use Send / retry email to try again.`, good: false }),
        });
      },
      onError: bad,
    });
  };
  const copy = async () => {
    try { await navigator.clipboard.writeText(link); setCopied(true); } catch { setNote({ text: 'Could not copy. Select the link and copy it by hand.', good: false }); }
  };

  const owners = d ? activeOwners(d.people) : [];
  const now = new Date();

  return (
    <>
      <header className="page-top">
        <div>
          <div className="eyebrow">Settings and staff</div>
          <h1>Owners and admins</h1>
          <div className="muted">Invite and manage admins and equal owners. Changes to owners need every owner to approve.</div>
        </div>
      </header>

      {!isOwner && <Card><Empty>Only an active owner can manage admin and owner access.</Empty></Card>}
      {isOwner && q.isError && <Card><Empty>Could not load owners and admins. Refresh to try again.</Empty></Card>}
      {isOwner && q.isPending && <Card><Empty>Loading…</Empty></Card>}
      {note && <div className={`msg ${note.good ? '' : 'error'}`} role={note.good ? 'status' : 'alert'}>{note.text}</div>}
      {confirming && (
        <div className="notice owners-confirm" role="alertdialog" aria-label="Confirm">
          <span>{confirming.text}</span>
          <Button variant="primary" disabled={busy} onClick={go}>Yes, continue</Button>
          <Button onClick={() => setConfirming(null)}>Cancel</Button>
        </div>
      )}

      {isOwner && d && (
        <>
          <Card>
            <SectionTitle title="Invite access" />
            <div className="notice">Inviting to <b>{gym.gymName}</b>. Admin access starts when they accept. Owner invitations are sent only after every current owner has approved.</div>
            <FieldRow>
              <Field label="Their name" htmlFor="inv-name"><Input id="inv-name" maxLength={120} placeholder="Josh Smith" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} /></Field>
              <Field label="Email address" htmlFor="inv-email"><Input id="inv-email" type="email" placeholder="name@example.com" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} /></Field>
              <Field label="Access level" htmlFor="inv-role">
                <Select id="inv-role" value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value === 'owner' ? 'owner' : 'admin' }))}>
                  <option value="admin">Admin</option>
                  <option value="owner">Owner · equal ownership</option>
                </Select>
              </Field>
              <Field label="Invitation expires" htmlFor="inv-days">
                <Select id="inv-days" value={String(form.days)} onChange={(e) => setForm((f) => ({ ...f, days: Number(e.target.value) }))}>
                  {EXPIRY_DAYS.map((n) => <option key={n} value={n}>{n} days</option>)}
                </Select>
              </Field>
            </FieldRow>
            <div className="membership-actions">
              <Button variant="primary" disabled={busy} onClick={() => invite(false)}>Send invitation email</Button>
              <Button disabled={busy} onClick={() => invite(true)}>Generate secure invite link</Button>
            </div>
            {link && (
              <div className="owners-link">
                <b>Secure invite link ready</b>
                <div className="muted small">Send this link directly to the invited person. It is tied to their email address and expires automatically.</div>
                <Input aria-label="Secure invite link" readOnly value={link} onFocus={(e) => e.currentTarget.select()} />
                <Button onClick={() => void copy()}>{copied ? 'Copied' : 'Copy link'}</Button>
              </div>
            )}
          </Card>

          <Card>
            <SectionTitle title="Owners and admins" />
            {d.people.length === 0 && <Empty>No admin or owner accounts yet.</Empty>}
            <ul className="team-list">
              {d.people.map((p) => <PersonItem key={p.userId} p={p} ownerCount={owners.length} busy={busy} ask={ask}
                onApprove={() => doApprove(p)} onPromote={() => doPromote(p)} onRemoval={() => doRemoval(p)} onRemoveAdmin={() => doRemoveAdmin(p)} />)}
            </ul>
          </Card>

          <Card>
            <SectionTitle title="Ownership decisions" />
            <p className="muted small">With two or more owners, adding, promoting or removing an owner needs approval from every active owner. No owner can remove another on their own.</p>
            {d.actions.length === 0 && <Empty>No ownership decisions are waiting for approval.</Empty>}
            <ul className="team-list">
              {d.actions.map((a) => {
                const approvers = d.actionApprovals.get(a.id) ?? [];
                const mine = approvers.includes(userId);
                return (
                  <li className="team-item" key={a.id}>
                    <div className="team-main">
                      <b>{actionLabel(a.type)} · {a.targetUserId ? d.names.get(a.targetUserId) ?? 'Owner' : gym.gymName}</b>
                      <div className="muted small">{approvers.length} of {owners.length} owner approvals recorded</div>
                    </div>
                    <div className="team-actions">
                      {mine ? <span className="tag good">You approved</span> : <Button aria-label={`Approve decision: ${actionLabel(a.type)}`} disabled={busy} onClick={() => doApproveAction(a.id)}>Approve decision</Button>}
                    </div>
                  </li>
                );
              })}
            </ul>
          </Card>

          <Card>
            <SectionTitle title="Pending and previous invites" />
            {d.invites.length === 0 && <Empty>No access invitations yet.</Empty>}
            <ul className="team-list">
              {d.invites.map((i) => (
                <InviteItem key={i.id} i={i} d={d} userId={userId} ownerCount={owners.length} now={now} busy={busy} ask={ask}
                  onApprove={() => doApproveInvite(i)} onSend={() => doSend(i)}
                  onRevoke={() => w.revoke.mutate(i.id, { onSuccess: () => ok('Invite revoked.'), onError: bad })}
                  onDelete={() => w.remove.mutate(i.id, { onSuccess: () => ok('Invite deleted.'), onError: bad })} />
              ))}
            </ul>
          </Card>
        </>
      )}
    </>
  );
}

function PersonItem({ p, ownerCount, busy, ask, onApprove, onPromote, onRemoval, onRemoveAdmin }: {
  p: Person; ownerCount: number; busy: boolean; ask: (key: string, text: string, run: () => void) => void;
  onApprove: () => void; onPromote: () => void; onRemoval: () => void; onRemoveAdmin: () => void;
}) {
  const a = personActions(p, ownerCount);
  const label = p.role === 'owner' ? 'Owner' : 'Admin';
  return (
    <li className="team-item">
      <div className="team-main">
        <b>{p.name}</b>
        <div className="muted">{p.email || (p.role === 'owner' ? 'Owner account' : '')}</div>
        <div className="tags"><span className={`tag ${p.accessStatus === 'active' ? 'good' : 'warn'}`}>{label}{p.accessStatus === 'active' ? '' : ` · ${p.accessStatus}`}</span></div>
      </div>
      <div className="team-actions">
        {a.approve && <Button disabled={busy} aria-label={`Approve ${label} ${p.name}`} onClick={() => ask(`approve-${p.userId}`, `Approve this access request for ${p.name}?`, onApprove)}>Approve {label}</Button>}
        {a.promote && <Button disabled={busy} aria-label={`Promote ${p.name} to Owner`} onClick={() => ask(`promote-${p.userId}`, `Promote ${p.name} to an equal owner? If there is more than one current owner, every owner must approve.`, onPromote)}>Promote to Owner</Button>}
        {a.remove && <Button disabled={busy} aria-label={`Remove access for ${p.name}`} onClick={() => ask(`remove-${p.userId}`, `Remove ${p.name}? Their HybridOne login stays, but their access to this gym stops straight away.`, onRemoveAdmin)}>Remove access</Button>}
        {a.requestRemoval && <Button disabled={busy} aria-label={`Request Owner removal for ${p.name}`} onClick={() => ask(`removal-${p.userId}`, `Request removal of ${p.name} as an owner? Every active owner, including them, must approve before it happens.`, onRemoval)}>Request Owner removal</Button>}
      </div>
    </li>
  );
}

function InviteItem({ i, d, userId, ownerCount, now, busy, ask, onApprove, onSend, onRevoke, onDelete }: {
  i: Invite; d: OwnersData; userId: string; ownerCount: number; now: Date; busy: boolean; ask: (key: string, text: string, run: () => void) => void;
  onApprove: () => void; onSend: () => void; onRevoke: () => void; onDelete: () => void;
}) {
  const approvals = d.inviteApprovals.get(i.id) ?? [];
  const a = inviteActions(i, approvals.includes(userId));
  const status = inviteStatus(i, now);
  const who = i.inviteeName || i.email;
  const extra = [approvalText(i, approvals.length, approvalsRequired(i.role, ownerCount)), i.emailSentAt ? (i.delivery === 'link' ? `secure link issued ${fmt(i.emailSentAt)}` : `email sent ${fmt(i.emailSentAt)}`) : '', i.claimedBy ? 'accepted' : ''].filter(Boolean);
  return (
    <li className="team-item">
      <div className="team-main">
        <b>{who}</b>
        <div className="tags"><span className="tag">{status.replaceAll('_', ' ')}</span><span className="tag good">{i.role}</span></div>
        <div className="muted small">{[i.inviteeName ? i.email : '', `Created ${fmt(i.createdAt)}`, `expires ${fmt(i.expiresAt)}`, ...extra].filter(Boolean).join(' · ')}</div>
      </div>
      <div className="team-actions">
        {a.approveOwner && <Button disabled={busy} aria-label={`Approve Owner invite for ${who}`} onClick={onApprove}>Approve Owner invite</Button>}
        {a.sendEmail && <Button disabled={busy} aria-label={`${i.emailSentAt ? 'Resend' : 'Send'} email to ${who}`} onClick={onSend}>{i.emailSentAt ? 'Resend email' : 'Send / retry email'}</Button>}
        {a.revoke && <Button disabled={busy} aria-label={`Revoke invite for ${who}`} onClick={() => ask(`revoke-${i.id}`, `Revoke the invite for ${who}? It stops working immediately.`, onRevoke)}>Revoke invite</Button>}
        {a.remove && <Button disabled={busy} aria-label={`Delete invite for ${who}`} onClick={() => ask(`delete-${i.id}`, `Delete the invite record for ${who}? The link stops working immediately.`, onDelete)}>Delete invite</Button>}
      </div>
    </li>
  );
}
