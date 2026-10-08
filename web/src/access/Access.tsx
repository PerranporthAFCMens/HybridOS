import { useState } from 'react';
import { useReadyAuth } from '../auth/AuthProvider';
import type { AccessData, LevelRow } from '../data/access';
import { Button, LinkButton } from '../ui/Button';
import { Card, Empty, SectionTitle } from '../ui/Card';
import { Checkbox, Field, Input, Select, Textarea } from '../ui/Field';
import { Modal } from '../ui/Modal';
import { links } from '../shell/legacy';
import { PERMISSIONS, canEditLevels, deleteBlocker, mergePermissions, permissionSummary, tickedKeys, validateLevel } from './calc';
import { useAccess, useAccessWrites } from './useAccess';
import '../members/members.css';
import '../staff/staff.css';
import './access.css';

export function Access() {
  const { gym, userId } = useReadyAuth();
  const q = useAccess(gym.gymId);
  const writes = useAccessWrites(gym.gymId, userId);
  const isOwner = canEditLevels(gym.role);
  // null = closed; { level: null } = new level; { level } = editing that one
  const [editing, setEditing] = useState<{ level: LevelRow | null } | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; good: boolean } | null>(null);
  const d = q.data;

  const remove = (l: LevelRow) =>
    writes.remove.mutate(l.id, {
      onSuccess: () => { setRemoving(null); setMessage({ text: `${l.name} deleted.`, good: true }); },
      onError: (e) => { setRemoving(null); setMessage({ text: e.message, good: false }); },
    });
  const assign = (userIdToSet: string, levelId: string, name: string) => {
    setMessage(null);
    writes.assign.mutate({ userId: userIdToSet, levelId }, {
      onSuccess: () => setMessage({ text: `${name} now has the new access level.`, good: true }),
      onError: (e) => setMessage({ text: e.message, good: false }),
    });
  };

  return (
    <>
      <header className="page-top">
        <div>
          <div className="eyebrow">Settings and staff</div>
          <h1>Access levels</h1>
          <div className="muted">Create access levels once, then give each staff member one. Changing a level changes it for everyone who has it.</div>
        </div>
        <div className="staff-top">
          <LinkButton href={links['admin-access']}>Owners and admins</LinkButton>
          {isOwner && <Button variant="primary" onClick={() => { setMessage(null); setEditing({ level: null }); }}>New access level</Button>}
        </div>
      </header>

      {!isOwner && <div className="notice"><b>Owner controlled:</b> you can see the access levels and give staff a level, but only an owner can create, change or delete a level.</div>}
      {q.isError && <Card><Empty>Could not load access levels. Refresh to try again.</Empty></Card>}
      {q.isPending && <Card><Empty>Loading access levels…</Empty></Card>}
      {message && <div className={`msg ${message.good ? '' : 'error'}`} role={message.good ? 'status' : 'alert'}>{message.text}</div>}

      {d && (
        <>
          <Card>
            <SectionTitle title="Access levels" />
            {d.levels.length === 0 && <Empty>No access levels yet.{isOwner ? ' Create the first one.' : ''}</Empty>}
            <ul className="team-list">
              {d.levels.map((l) => (
                <LevelItem key={l.id} l={l} d={d} isOwner={isOwner} confirming={removing === l.id} busy={writes.remove.isPending}
                  onEdit={() => { setMessage(null); setEditing({ level: l }); }}
                  onAskRemove={() => { const why = deleteBlocker([...d.assigned.values()].filter((v) => v === l.id).length); if (why) setMessage({ text: why, good: false }); else { setMessage(null); setRemoving(l.id); } }}
                  onCancelRemove={() => setRemoving(null)} onRemove={() => remove(l)} />
              ))}
            </ul>
          </Card>

          <Card>
            <SectionTitle title="Who has which level" />
            {d.staff.length === 0 && <Empty>No active staff or coaches yet. Add them under Staff.</Empty>}
            <ul className="team-list">
              {d.staff.map((s) => (
                <li className="team-item" key={s.userId}>
                  <div className="team-main"><b>{s.name}</b><div className="muted small">{s.role === 'coach' ? 'Coach / PT' : 'Staff'}</div></div>
                  <div className="team-actions">
                    <Select aria-label={`Access level for ${s.name}`} value={d.assigned.get(s.userId) ?? ''} disabled={writes.assign.isPending || d.levels.length === 0}
                      onChange={(e) => { if (e.target.value) assign(s.userId, e.target.value, s.name); }}>
                      <option value="">Choose access level</option>
                      {d.levels.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                    </Select>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        </>
      )}

      {editing && d && (
        <LevelEditor level={editing.level} d={d} saving={writes.save.isPending} onClose={() => setEditing(null)}
          onSave={(args, onError) => writes.save.mutate({ id: editing.level?.id ?? null, ...args }, {
            onSuccess: () => { setEditing(null); setMessage({ text: 'Access level saved. Everyone who has it now uses these permissions.', good: true }); },
            onError: (e) => onError(e.message),
          })} />
      )}
    </>
  );
}

function LevelItem({ l, d, isOwner, confirming, busy, onEdit, onAskRemove, onCancelRemove, onRemove }: {
  l: LevelRow; d: AccessData; isOwner: boolean; confirming: boolean; busy: boolean; onEdit: () => void; onAskRemove: () => void; onCancelRemove: () => void; onRemove: () => void;
}) {
  const people = d.staff.filter((s) => d.assigned.get(s.userId) === l.id);
  return (
    <li className="team-item">
      <div className="team-main">
        <b>{l.name}</b>
        <div className="muted">{l.description || 'No description'}</div>
        <div className="tags">
          <span className="tag">{permissionSummary(l.permissions)}</span>
          <span className="tag">{people.length} assigned</span>
        </div>
        {people.length > 0 && <div className="muted small">{people.map((p) => p.name).join(', ')}</div>}
      </div>
      <div className="team-actions">
        {!confirming && <Button aria-label={`${isOwner ? 'Edit' : 'View'} ${l.name}`} onClick={onEdit}>{isOwner ? 'Edit' : 'View'}</Button>}
        {isOwner && !confirming && <Button aria-label={`Delete ${l.name}`} onClick={onAskRemove}>Delete</Button>}
        {confirming && (
          <div className="confirm">
            <span className="small">Delete {l.name}? This cannot be undone.</span>
            <Button variant="primary" disabled={busy} onClick={onRemove}>Yes, delete</Button>
            <Button onClick={onCancelRemove}>Keep</Button>
          </div>
        )}
      </div>
    </li>
  );
}

function LevelEditor({ level, d, saving, onClose, onSave }: {
  level: LevelRow | null; d: AccessData; saving: boolean; onClose: () => void;
  onSave: (args: { input: { name: string; description: string | null; permissions: Record<string, boolean> } }, onError: (m: string) => void) => void;
}) {
  const { gym } = useReadyAuth();
  const locked = !canEditLevels(gym.role);
  const [name, setName] = useState(level?.name ?? '');
  const [description, setDescription] = useState(level?.description ?? '');
  const [ticked, setTicked] = useState<Set<string>>(() => (level ? tickedKeys(level.permissions) : new Set()));
  const [error, setError] = useState('');
  const toggle = (key: string, on: boolean) => setTicked((t) => { const n = new Set(t); if (on) n.add(key); else n.delete(key); return n; });
  const submit = () => {
    const check = validateLevel({ name, description, ticked: [...ticked] }, d.levels, level?.id ?? null);
    if (!check.ok) return setError(check.message);
    setError('');
    onSave({ input: { name: check.name, description: check.description, permissions: mergePermissions(level?.permissions ?? {}, ticked) } }, setError);
  };
  const title = level ? (locked ? level.name : 'Edit access level') : 'New access level';
  return (
    <Modal title={title} onClose={onClose}>
      <SectionTitle title={title} action={<Button onClick={onClose}>Close</Button>} />
      <Field label="Level name" htmlFor="lvl-name"><Input id="lvl-name" maxLength={80} placeholder="Manager" value={name} disabled={locked} onChange={(e) => setName(e.target.value)} /></Field>
      <Field label="Description (optional)" htmlFor="lvl-desc"><Textarea id="lvl-desc" maxLength={280} placeholder="What is this level for?" value={description} disabled={locked} onChange={(e) => setDescription(e.target.value)} /></Field>
      <fieldset className="check-group">
        <legend>Permissions</legend>
        {!locked && (
          <div className="perm-bulk">
            <Button onClick={() => setTicked(new Set(PERMISSIONS.map((p) => p.key)))}>Select all</Button>
            <Button onClick={() => setTicked(new Set())}>Clear all</Button>
          </div>
        )}
        {PERMISSIONS.map((p) => (
          <div className="perm" key={p.key}>
            <Checkbox label={p.label} checked={ticked.has(p.key)} disabled={locked} onChange={(on) => toggle(p.key, on)} />
            <div className="muted small perm-text">{p.text}</div>
          </div>
        ))}
      </fieldset>
      <div className="assign-msg">{error && <span className="msg error" role="alert">{error}</span>}</div>
      {!locked && <Button variant="primary" className="wide-btn" disabled={saving} onClick={submit}>{saving ? 'Saving…' : 'Save level'}</Button>}
    </Modal>
  );
}
