import { useState } from 'react';
import { useReadyAuth } from '../auth/AuthProvider';
import { nameOf } from '../members/calc';
import { useMemberDirectory } from '../members/useMembers';
import type { PackType, PackTypeInput } from '../data/classPacks';
import { money } from '../today/calc';
import { Button } from '../ui/Button';
import { Card, Empty, SectionTitle } from '../ui/Card';
import { Field, FieldRow, Input, Select } from '../ui/Field';
import { Modal } from '../ui/Modal';
import { emptyPackForm, formFromPack, heldExpiryText, heldLeftText, heldState, heldStateLabel, heldSummary, packSummary, perClassText, sortHeld, validatePackType, validityText, type PackForm } from './calc';
import { useHeldPackWrites, useHeldPacks, usePackTypes, usePackTypeWrites } from './usePacks';
import '../members/members.css';
import '../plans/plans.css';
import './packs.css';

/** Owners and admins: the class packs the gym sells (a number of classes for a price, with an optional expiry). */
export function ClassPacks() {
  const { gym } = useReadyAuth();
  const q = usePackTypes(gym.gymId);
  const writes = usePackTypeWrites(gym.gymId);
  // null = closed; { pack: null } = a new pack; { pack } = editing that pack
  const [editing, setEditing] = useState<{ pack: PackType | null } | null>(null);
  const [toggleError, setToggleError] = useState('');
  const types = q.data ?? [];
  const members = useMemberDirectory(gym.gymId);
  const held = useHeldPacks(gym.gymId);
  const heldWrites = useHeldPackWrites(gym.gymId);
  // null = closed; the pack being given
  const [giving, setGiving] = useState<PackType | null>(null);
  // The held pack waiting for "Yes, cancel it", and any error from cancelling
  const [confirmCancel, setConfirmCancel] = useState<string | null>(null);
  const [heldError, setHeldError] = useState('');
  const [notice, setNotice] = useState('');
  const now = new Date();
  const nameFor = (userId: string) => {
    const m = members.data?.find((x) => x.userId === userId);
    return m ? nameOf(m) : 'Former member';
  };

  return (
    <>
      <header className="page-top">
        <div>
          <div className="eyebrow">Membership products</div>
          <h1>Class packs</h1>
        </div>
        <div className="plans-top">
          {q.data && <span className="muted">{packSummary(types)}</span>}
          <Button variant="primary" onClick={() => setEditing({ pack: null })}>New pack</Button>
        </div>
      </header>

      <p className="muted small">A class pack is a number of classes sold for a price, such as 10 classes for £60. Members cannot buy them yet, but you can give one to a member below.</p>
      {q.isError && <Card><Empty>Could not load class packs. Refresh to try again.</Empty></Card>}
      {toggleError && <div className="msg error" role="alert">{toggleError}</div>}
      {q.isPending && <Card><Empty>Loading class packs…</Empty></Card>}
      {q.data && types.length === 0 && <Card><Empty>No class packs yet. Create your first one.</Empty></Card>}

      <div className="plan-grid">
        {types.map((t) => (
          <Card key={t.id} className={`plan${t.isActive ? '' : ' inactive'}`}>
            <div className="plan-head">
              <div>
                <span className={`tag${t.isActive ? ' good' : ''}`}>{t.isActive ? 'On sale' : 'Off sale'}</span>
                <h3>{t.name}</h3>
              </div>
            </div>
            <div className="plan-price">{money(t.pricePence)} <span className="muted">for {t.credits} {t.credits === 1 ? 'class' : 'classes'}</span></div>
            <div className="muted plan-text">{perClassText(t)}</div>
            <div className="muted small plan-text">{validityText(t.validDays)}</div>
            <div className="membership-actions">
              {t.isActive && <Button variant="primary" onClick={() => { setNotice(''); setGiving(t); }}>Give to a member</Button>}
              <Button onClick={() => setEditing({ pack: t })}>Edit</Button>
              <Button
                disabled={writes.toggle.isPending}
                onClick={() => {
                  setToggleError('');
                  writes.toggle.mutate({ id: t.id, isActive: !t.isActive }, { onError: (e) => setToggleError(e.message) });
                }}
              >
                {t.isActive ? 'Take off sale' : 'Put on sale'}
              </Button>
            </div>
          </Card>
        ))}
      </div>

      <header className="page-top packs-held-top">
        <div>
          <div className="eyebrow">Packs members hold</div>
          <h2>Given and bought</h2>
        </div>
        {held.data && <span className="muted">{heldSummary(held.data, now)}</span>}
      </header>
      {notice && <div className="msg good" role="status">{notice}</div>}
      {heldError && <div className="msg error" role="alert">{heldError}</div>}
      {held.isError && <Card><Empty>Could not load the packs members hold. Refresh to try again.</Empty></Card>}
      {held.isPending && <Card><Empty>Loading…</Empty></Card>}
      {held.data && held.data.length === 0 && <Card><Empty>No member holds a class pack yet.</Empty></Card>}
      {held.data && held.data.length > 0 && (
        <Card>
          <ul className="held-list">
            {sortHeld(held.data, now).map((p) => {
              const state = heldState(p, now);
              return (
                <li key={p.id} className="held">
                  <div className="held-main">
                    <strong>{nameFor(p.userId)}</strong>
                    <div>{p.name}</div>
                    <div className="muted small">{heldLeftText(p)} · {heldExpiryText(p.expiresAt)} · {p.source === 'purchase' ? 'Bought' : 'Given by the gym'}</div>
                  </div>
                  <div className="held-side">
                    <span className={`tag${state === 'active' ? ' good' : ''}`}>{heldStateLabel[state]}</span>
                    {state === 'active' && confirmCancel !== p.id && <Button onClick={() => { setHeldError(''); setConfirmCancel(p.id); }}>Cancel pack</Button>}
                    {state === 'active' && confirmCancel === p.id && (
                      <>
                        <Button
                          variant="primary"
                          disabled={heldWrites.cancel.isPending}
                          onClick={() => heldWrites.cancel.mutate(p.id, { onSuccess: () => setConfirmCancel(null), onError: (e) => setHeldError(e.message) })}
                        >
                          Yes, cancel it
                        </Button>
                        <Button onClick={() => setConfirmCancel(null)}>Keep it</Button>
                      </>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      {giving && (
        <GivePack
          pack={giving}
          people={(members.data ?? []).map((m) => ({ userId: m.userId, name: nameOf(m) })).sort((a, b) => a.name.localeCompare(b.name))}
          loading={members.isPending}
          saving={heldWrites.give.isPending}
          onClose={() => setGiving(null)}
          onGive={(userId, onError) =>
            heldWrites.give.mutate(
              { userId, packTypeId: giving.id },
              {
                onSuccess: () => {
                  setNotice(`Gave ${nameFor(userId)} the ${giving.name}.`);
                  setGiving(null);
                },
                onError: (e) => onError(e.message),
              },
            )
          }
        />
      )}

      {editing && (
        <PackEditor
          pack={editing.pack}
          saving={writes.save.isPending}
          onClose={() => setEditing(null)}
          onSave={(input, onError) => writes.save.mutate({ id: editing.pack?.id ?? null, input }, { onSuccess: () => setEditing(null), onError: (e) => onError(e.message) })}
        />
      )}
    </>
  );
}

function PackEditor({ pack, saving, onClose, onSave }: { pack: PackType | null; saving: boolean; onClose: () => void; onSave: (input: PackTypeInput, onError: (message: string) => void) => void }) {
  const [form, setForm] = useState<PackForm>(pack ? formFromPack(pack) : emptyPackForm);
  const [error, setError] = useState('');
  const set = <K extends keyof PackForm>(key: K, value: PackForm[K]) => setForm((f) => ({ ...f, [key]: value }));

  const submit = () => {
    const check = validatePackType(form);
    if (!check.ok) return setError(check.message);
    setError('');
    onSave(check.input, setError);
  };

  return (
    <Modal title={pack ? 'Edit class pack' : 'New class pack'} onClose={onClose}>
      <SectionTitle title={pack ? 'Edit class pack' : 'New class pack'} action={<Button onClick={onClose}>Close</Button>} />
      <FieldRow>
        <Field label="Name" htmlFor="pack-name">
          <Input id="pack-name" placeholder="10 class pack" value={form.name} onChange={(e) => set('name', e.target.value)} />
        </Field>
        <Field label="Number of classes" htmlFor="pack-credits">
          <Input id="pack-credits" type="number" inputMode="numeric" min="1" step="1" value={form.credits} onChange={(e) => set('credits', e.target.value)} />
        </Field>
        <Field label="Price (£)" htmlFor="pack-price">
          <Input id="pack-price" type="number" inputMode="decimal" min="0" step="0.01" placeholder="60.00" value={form.price} onChange={(e) => set('price', e.target.value)} />
        </Field>
        <Field label="Days it lasts" htmlFor="pack-days" hint="How long a member has to use it, counted from when they get it. Leave blank if it never expires.">
          <Input id="pack-days" type="number" inputMode="numeric" min="1" step="1" placeholder="90" value={form.validDays} onChange={(e) => set('validDays', e.target.value)} />
        </Field>
      </FieldRow>
      {pack && <p className="muted small">Changing a pack does not change packs members already have.</p>}
      <div className="assign-msg">{error && <span className="msg error" role="alert">{error}</span>}</div>
      <Button variant="primary" className="wide-btn" disabled={saving} onClick={submit}>Save class pack</Button>
    </Modal>
  );
}

function GivePack({ pack, people, loading, saving, onClose, onGive }: { pack: PackType; people: { userId: string; name: string }[]; loading: boolean; saving: boolean; onClose: () => void; onGive: (userId: string, onError: (message: string) => void) => void }) {
  const [userId, setUserId] = useState('');
  const [error, setError] = useState('');
  return (
    <Modal title="Give a class pack" onClose={onClose}>
      <SectionTitle title="Give a class pack" action={<Button onClick={onClose}>Close</Button>} />
      <p className="muted small">{pack.name}: {pack.credits} {pack.credits === 1 ? 'class' : 'classes'}, {validityText(pack.validDays).toLowerCase()}. Nothing is charged.</p>
      <Field label="Member" htmlFor="give-member">
        <Select id="give-member" value={userId} onChange={(e) => setUserId(e.target.value)} disabled={loading}>
          <option value="">{loading ? 'Loading members…' : 'Choose a member'}</option>
          {people.map((p) => <option key={p.userId} value={p.userId}>{p.name}</option>)}
        </Select>
      </Field>
      <div className="assign-msg">{error && <span className="msg error" role="alert">{error}</span>}</div>
      <Button
        variant="primary"
        className="wide-btn"
        disabled={saving}
        onClick={() => {
          if (!userId) return setError('Choose who to give it to.');
          setError('');
          onGive(userId, setError);
        }}
      >
        Give class pack
      </Button>
    </Modal>
  );
}
