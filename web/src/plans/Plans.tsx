import { useState } from 'react';
import { useReadyAuth } from '../auth/AuthProvider';
import type { PlanDetail, PlanInput } from '../data/plans';
import { money } from '../today/calc';
import { Button } from '../ui/Button';
import { Card, Empty, SectionTitle } from '../ui/Card';
import { Checkbox, Field, FieldRow, Input, Select, Textarea } from '../ui/Field';
import { Modal } from '../ui/Modal';
import { ACCESS_TYPES, INTERVALS, emptyForm, formFromPlan, includesText, planSummary, validatePlan, type PlanForm } from './calc';
import { usePlanDetails, usePlanWrites } from './usePlans';
import '../members/members.css';
import './plans.css';

export function Plans() {
  const { gym } = useReadyAuth();
  const q = usePlanDetails(gym.gymId);
  const writes = usePlanWrites(gym.gymId);
  // null = closed; { plan: null } = a new plan; { plan } = editing that plan
  const [editing, setEditing] = useState<{ plan: PlanDetail | null } | null>(null);
  const [toggleError, setToggleError] = useState('');
  const plans = q.data ?? [];

  return (
    <>
      <header className="page-top">
        <div>
          <div className="eyebrow">Membership products</div>
          <h1>Membership plans</h1>
        </div>
        <div className="plans-top">
          {q.data && <span className="muted">{planSummary(plans)}</span>}
          <Button variant="primary" onClick={() => setEditing({ plan: null })}>New plan</Button>
        </div>
      </header>

      {q.isError && <Card><Empty>Could not load plans. Refresh to try again.</Empty></Card>}
      {toggleError && <div className="msg error" role="alert">{toggleError}</div>}
      {q.isPending && <Card><Empty>Loading plans…</Empty></Card>}
      {q.data && plans.length === 0 && <Card><Empty>No membership plans yet. Create your first one.</Empty></Card>}

      <div className="plan-grid">
        {plans.map((p) => (
          <Card key={p.id} className={`plan${p.isActive ? '' : ' inactive'}`}>
            <div className="plan-head">
              <div>
                <span className={`tag${p.isActive ? ' good' : ''}`}>{p.isActive ? 'Active' : 'Inactive'}</span>
                <h3>{p.name}</h3>
              </div>
              <span className="tag">{p.accessType}</span>
            </div>
            <div className="plan-price">{money(p.priceInPence)} <span className="muted">/ {p.interval}</span></div>
            {p.joiningFeeInPence > 0 && <div className="muted">+ {money(p.joiningFeeInPence)} joining fee</div>}
            <div className="muted plan-text">{p.description || 'No description yet.'}</div>
            <div className="muted small plan-text">{includesText(p)}{p.isPublic ? '' : ' · Hidden from new members'}</div>
            <div className="membership-actions">
              <Button onClick={() => setEditing({ plan: p })}>Edit</Button>
              <Button
                disabled={writes.toggle.isPending}
                onClick={() => {
                  setToggleError('');
                  writes.toggle.mutate({ planId: p.id, isActive: !p.isActive }, { onError: (e) => setToggleError(e.message) });
                }}
              >
                {p.isActive ? 'Deactivate' : 'Activate'}
              </Button>
            </div>
          </Card>
        ))}
      </div>

      {editing && (
        <PlanEditor
          plan={editing.plan}
          saving={writes.save.isPending}
          onClose={() => setEditing(null)}
          onSave={(input, onError) =>
            writes.save.mutate({ planId: editing.plan?.id ?? null, input }, { onSuccess: () => setEditing(null), onError: (e) => onError(e.message) })
          }
        />
      )}
    </>
  );
}

function PlanEditor({ plan, saving, onClose, onSave }: {
  plan: PlanDetail | null;
  saving: boolean;
  onClose: () => void;
  onSave: (input: PlanInput, onError: (message: string) => void) => void;
}) {
  const [form, setForm] = useState<PlanForm>(plan ? formFromPlan(plan) : emptyForm);
  const [error, setError] = useState('');
  const set = <K extends keyof PlanForm>(key: K, value: PlanForm[K]) => setForm((f) => ({ ...f, [key]: value }));

  const submit = () => {
    const check = validatePlan(form);
    if (!check.ok) {
      setError(check.message);
      return;
    }
    setError('');
    onSave(check.input, setError);
  };

  return (
    <Modal title={plan ? 'Edit membership' : 'New membership'} onClose={onClose}>
      <SectionTitle title={plan ? 'Edit membership' : 'New membership'} action={<Button onClick={onClose}>Close</Button>} />
      <FieldRow>
        <Field label="Name" htmlFor="plan-name">
          <Input id="plan-name" placeholder="Unlimited" value={form.name} onChange={(e) => set('name', e.target.value)} />
        </Field>
        <Field label="Price (£)" htmlFor="plan-price">
          <Input id="plan-price" type="number" inputMode="decimal" min="0" step="0.01" placeholder="42.00" value={form.price} onChange={(e) => set('price', e.target.value)} />
        </Field>
        <Field label="Billing" htmlFor="plan-interval">
          <Select id="plan-interval" value={form.interval} onChange={(e) => set('interval', e.target.value)}>
            {INTERVALS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </Select>
        </Field>
        <Field label="Access type" htmlFor="plan-access">
          <Select id="plan-access" value={form.accessType} onChange={(e) => set('accessType', e.target.value)}>
            {ACCESS_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </Select>
        </Field>
        <Field label="Joining fee (£)" htmlFor="plan-joining">
          <Input id="plan-joining" type="number" inputMode="decimal" min="0" step="0.01" value={form.joiningFee} onChange={(e) => set('joiningFee', e.target.value)} />
        </Field>
        <Field label="Classes per week" htmlFor="plan-classes" hint="Leave blank for unlimited.">
          <Input id="plan-classes" type="number" inputMode="numeric" min="0" step="1" value={form.classesPerWeek} onChange={(e) => set('classesPerWeek', e.target.value)} />
        </Field>
      </FieldRow>
      <Field label="Description" htmlFor="plan-description">
        <Textarea id="plan-description" placeholder="What is included in this membership?" value={form.description} onChange={(e) => set('description', e.target.value)} />
      </Field>
      <Checkbox label="Includes open gym" checked={form.includesOpenGym} onChange={(v) => set('includesOpenGym', v)} />
      <Checkbox label="Includes classes" checked={form.includesClasses} onChange={(v) => set('includesClasses', v)} />
      <Checkbox label="Includes PT" checked={form.includesPt} onChange={(v) => set('includesPt', v)} />
      <Checkbox label="Visible for new members to join" checked={form.isPublic} onChange={(v) => set('isPublic', v)} />
      <Checkbox label="Members can switch to this plan themselves" checked={form.canSwitchTo} onChange={(v) => set('canSwitchTo', v)} />
      <div className="assign-msg">{error && <span className="msg error" role="alert">{error}</span>}</div>
      <Button variant="primary" className="wide-btn" disabled={saving} onClick={submit}>Save membership plan</Button>
    </Modal>
  );
}
