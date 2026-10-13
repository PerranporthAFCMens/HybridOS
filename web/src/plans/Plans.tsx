import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getRules } from '../data/rules';
import { applyPlanTerms } from '../data/terms';
import { useReadyAuth } from '../auth/AuthProvider';
import type { PlanDetail, PlanInput } from '../data/plans';
import { money } from '../today/calc';
import { Button } from '../ui/Button';
import { Card, Empty, SectionTitle } from '../ui/Card';
import { Checkbox, Field, FieldRow, Input, Select, Textarea } from '../ui/Field';
import { Modal } from '../ui/Modal';
import { ACCESS_TYPES, INTERVALS, emptyForm, formFromPlan, includesText, planSummary, validatePlan, type PlanForm } from './calc';
import { DEFAULT_NOTICE_DAYS, DEFAULT_TERM_MONTHS, parseWhole, termWarnings, termsSentence } from './terms';
import { usePlanDetails, usePlanWrites } from './usePlans';
import '../members/members.css';
import './plans.css';

export function Plans() {
  const { gym } = useReadyAuth();
  const q = usePlanDetails(gym.gymId);
  const writes = usePlanWrites(gym.gymId);
  // The gym's usual terms: what a plan with none of its own uses (shown so nobody has to remember what they set).
  const rulesQ = useQuery({ queryKey: ['rules', gym.gymId], queryFn: () => getRules(gym.gymId), retry: false });
  const usualTerm = rulesQ.data?.cancel_min_term_months ?? DEFAULT_TERM_MONTHS;
  const usualNotice = rulesQ.data?.cancel_notice_days ?? DEFAULT_NOTICE_DAYS;
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
            <div className="muted small plan-text">{termsSentence(p.minTermMonths, p.noticeDays) || `Your usual terms: ${termsSentence(usualTerm, usualNotice)}`}</div>
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
          usual={{ term: usualTerm, notice: usualNotice }}
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

function PlanEditor({ plan, saving, usual, onClose, onSave }: {
  plan: PlanDetail | null;
  usual: { term: number; notice: number };
  saving: boolean;
  onClose: () => void;
  onSave: (input: PlanInput, onError: (message: string) => void) => void;
}) {
  const [form, setForm] = useState<PlanForm>(plan ? formFromPlan(plan) : emptyForm);
  const [error, setError] = useState('');
  const set = <K extends keyof PlanForm>(key: K, value: PlanForm[K]) => setForm((f) => ({ ...f, [key]: value }));
  const typedTerm = parseWhole(form.minTerm, 0, 60);
  const typedNotice = parseWhole(form.notice, 0, 365);
  const warnings = termWarnings(typedTerm === 'bad' ? null : typedTerm, typedNotice === 'bad' ? null : typedNotice);

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
      <FieldRow>
        <Field label="Minimum term (months)" htmlFor="plan-term" hint={`How long a member signs up for. 0 means none. Leave blank to use your usual terms (${termsSentence(usual.term, usual.notice)}).`}>
          <Input id="plan-term" type="number" inputMode="numeric" min="0" max="60" step="1" placeholder={`Usual: ${usual.term}`} value={form.minTerm} onChange={(e) => set('minTerm', e.target.value)} />
        </Field>
        <Field label="Notice to leave (days)" htmlFor="plan-notice" hint="Days of notice a member gives. 30 is one month. Leave blank to use your usual terms.">
          <Input id="plan-notice" type="number" inputMode="numeric" min="0" max="365" step="1" placeholder={`Usual: ${usual.notice}`} value={form.notice} onChange={(e) => set('notice', e.target.value)} />
        </Field>
      </FieldRow>
      {warnings.map((w) => <div key={w} className="notice" role="note">{w}</div>)}
      <Field label="Description" htmlFor="plan-description">
        <Textarea id="plan-description" placeholder="What is included in this membership?" value={form.description} onChange={(e) => set('description', e.target.value)} />
      </Field>
      <Checkbox label="Includes open gym" checked={form.includesOpenGym} onChange={(v) => set('includesOpenGym', v)} />
      <Checkbox label="Includes classes" checked={form.includesClasses} onChange={(v) => set('includesClasses', v)} />
      <Checkbox label="Includes PT" checked={form.includesPt} onChange={(v) => set('includesPt', v)} />
      <Checkbox label="Visible for new members to join" checked={form.isPublic} onChange={(v) => set('isPublic', v)} />
      <Checkbox label="Members can switch to this plan themselves" checked={form.canSwitchTo} onChange={(v) => set('canSwitchTo', v)} />
      <div className="assign-msg">{error && <span className="msg error" role="alert">{error}</span>}</div>
      {plan && (plan.minTermMonths !== null || plan.noticeDays !== null) && <PassOnTerms plan={plan} unsaved={form.minTerm !== (plan.minTermMonths === null ? '' : String(plan.minTermMonths)) || form.notice !== (plan.noticeDays === null ? '' : String(plan.noticeDays))} />}
      <Button variant="primary" className="wide-btn" disabled={saving} onClick={submit}>Save membership plan</Button>
    </Modal>
  );
}

/** Members keep the terms they joined on. This passes the plan's saved terms to them, but only where that is the same or better for them. */
function PassOnTerms({ plan, unsaved }: { plan: PlanDetail; unsaved: boolean }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; tone: 'good' | 'error' } | null>(null);
  const go = async () => {
    if (reason.trim().length < 3) return setMsg({ text: 'Give a reason (a few words is fine).', tone: 'error' });
    setBusy(true);
    setMsg(null);
    try {
      const n = await applyPlanTerms(plan.id, reason);
      setMsg({ text: n === 0 ? 'No one needed changing. Members only get terms that are the same or better for them.' : `${n} ${n === 1 ? 'member now has' : 'members now have'} these terms.`, tone: 'good' });
      setOpen(false);
      setReason('');
    } catch (e) {
      setMsg({ text: e instanceof Error ? e.message : 'Could not do that. Try again.', tone: 'error' });
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="record-section" aria-label="Current members">
      <h4>Current members</h4>
      <div className="muted small">Members keep the terms they joined on. If this plan's saved terms are now better for them (a shorter term or less notice), you can pass them on. Worse terms are never passed on.</div>
      {unsaved && <div className="muted small">You have unsaved changes: save them first, because this uses the saved terms.</div>}
      {!open ? (
        <Button onClick={() => { setMsg(null); setOpen(true); }} disabled={unsaved}>Pass these terms to current members</Button>
      ) : (
        <>
          <Field label="Reason (kept on the record)" htmlFor="plan-pass-reason">
            <Input id="plan-pass-reason" placeholder="e.g. We shortened the notice for everyone" value={reason} onChange={(e) => setReason(e.target.value)} />
          </Field>
          <Button variant="primary" disabled={busy} onClick={() => void go()}>{busy ? 'Passing on…' : 'Pass them on'}</Button>{' '}
          <Button disabled={busy} onClick={() => setOpen(false)}>Not now</Button>
        </>
      )}
      {msg && <div className={`msg ${msg.tone}`} role={msg.tone === 'error' ? 'alert' : 'status'}>{msg.text}</div>}
    </section>
  );
}
