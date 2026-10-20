import { useState } from 'react';
import { useReadyAuth } from '../auth/AuthProvider';
import type { PackType, PackTypeInput } from '../data/classPacks';
import { money } from '../today/calc';
import { Button } from '../ui/Button';
import { Card, Empty, SectionTitle } from '../ui/Card';
import { Field, FieldRow, Input } from '../ui/Field';
import { Modal } from '../ui/Modal';
import { emptyPackForm, formFromPack, packSummary, perClassText, validatePackType, validityText, type PackForm } from './calc';
import { usePackTypes, usePackTypeWrites } from './usePacks';
import '../members/members.css';
import '../plans/plans.css';

/** Owners and admins: the class packs the gym sells (a number of classes for a price, with an optional expiry). */
export function ClassPacks() {
  const { gym } = useReadyAuth();
  const q = usePackTypes(gym.gymId);
  const writes = usePackTypeWrites(gym.gymId);
  // null = closed; { pack: null } = a new pack; { pack } = editing that pack
  const [editing, setEditing] = useState<{ pack: PackType | null } | null>(null);
  const [toggleError, setToggleError] = useState('');
  const types = q.data ?? [];

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

      <p className="muted small">A class pack is a number of classes sold for a price, such as 10 classes for £60. Members cannot buy them yet: paying by card and giving a pack to a member are coming next.</p>
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
