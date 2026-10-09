import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useReadyAuth } from '../auth/AuthProvider';
import { getRules, saveRules, type RulesRow } from '../data/rules';
import { Button } from '../ui/Button';
import { Card, Empty } from '../ui/Card';
import { Checkbox, Field, FieldRow, Input, Select } from '../ui/Field';
import { formFromRow, validateRules, type Approval, type RulesForm } from './calc';
import '../members/members.css';
import './membership.css';

/** Settings › Membership rules: what members may do themselves, and which of it needs a person at the gym to say yes. */
export function Rules() {
  const { gym } = useReadyAuth();
  const q = useQuery({ queryKey: ['membership-rules', gym.gymId], queryFn: () => getRules(gym.gymId) });
  return (
    <>
      <header className="page-top">
        <div>
          <div className="eyebrow">Settings and staff</div>
          <h1>Membership rules</h1>
          <div className="muted">What members can do themselves from the member app. Everything starts switched off.</div>
        </div>
      </header>
      {q.isError && <Card><Empty>Could not load the rules. Refresh to try again.</Empty></Card>}
      {q.isPending && <Card><Empty>Loading…</Empty></Card>}
      {q.isSuccess && <RulesForm_ key={gym.gymId} saved={q.data} />}
    </>
  );
}

function ApprovalPick({ id, value, onChange }: { id: string; value: Approval; onChange: (v: Approval) => void }) {
  return (
    <Field label="Who decides" htmlFor={id} hint="Choose “The gym approves” to review each request before anything changes.">
      <Select id={id} value={value} onChange={(e) => onChange(e.target.value === 'auto' ? 'auto' : 'admin')}>
        <option value="admin">The gym approves each request</option>
        <option value="auto">It happens automatically</option>
      </Select>
    </Field>
  );
}

function RulesForm_({ saved }: { saved: RulesRow | null }) {
  const { gym, userId } = useReadyAuth();
  const qc = useQueryClient();
  const [form, setForm] = useState<RulesForm>(() => formFromRow(saved));
  const [note, setNote] = useState<{ text: string; good: boolean } | null>(null);
  const save = useMutation({
    mutationFn: (row: Parameters<typeof saveRules>[2]) => saveRules(gym.gymId, userId, row),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['membership-rules', gym.gymId] }),
  });
  const set = <K extends keyof RulesForm>(k: K, v: RulesForm[K]) => { setNote(null); setForm((f) => ({ ...f, [k]: v })); };
  const num = (id: string, label: string, k: keyof RulesForm, hint?: string) => (
    <Field label={label} htmlFor={id} hint={hint}>
      <Input id={id} type="number" inputMode="decimal" min="0" value={String(form[k])} onChange={(e) => set(k, e.target.value as never)} />
    </Field>
  );
  const submit = () => {
    const check = validateRules(form);
    if (!check.ok) return setNote({ text: check.message, good: false });
    save.mutate(check.row, {
      onSuccess: () => setNote({ text: 'Saved. Members see these rules straight away.', good: true }),
      onError: (e) => setNote({ text: e.message, good: false }),
    });
  };

  return (
    <>
      <Card className="rules-card" role="region" aria-label="Pausing">
        <h3>Pausing</h3>
        <Checkbox label="Members can ask to pause their membership" checked={form.pauseEnabled} onChange={(v) => set('pauseEnabled', v)} />
        {form.pauseEnabled && (
          <>
            <FieldRow>
              {num('r-pmin', 'Shortest pause (weeks)', 'pauseMin')}
              {num('r-pmax', 'Longest pause (weeks)', 'pauseMax')}
            </FieldRow>
            <FieldRow>
              {num('r-pnotice', 'Notice needed (days)', 'pauseNotice', 'How far ahead a pause must be asked for.')}
              {num('r-pyear', 'Pauses allowed in a year', 'pauseMaxYear')}
            </FieldRow>
            {num('r-pfee', 'Pause fee (£)', 'pauseFee', '0 for no fee. The fee is recorded on the request; someone at the gym collects it.')}
            <ApprovalPick id="r-papp" value={form.pauseApproval} onChange={(v) => set('pauseApproval', v)} />
          </>
        )}
      </Card>

      <Card className="rules-card" role="region" aria-label="Cancelling">
        <h3>Cancelling</h3>
        <Checkbox label="Members can ask to cancel their membership" checked={form.cancelEnabled} onChange={(v) => set('cancelEnabled', v)} />
        {form.cancelEnabled && (
          <>
            <FieldRow>
              {num('r-cnotice', 'Notice needed (days)', 'cancelNotice', 'The last day is this many days after they ask.')}
              {num('r-cterm', 'Minimum term (months)', 'cancelTerm', '0 for no minimum.')}
            </FieldRow>
            <Field label="Leaving inside the minimum term" htmlFor="r-cearly">
              <Select id="r-cearly" value={form.cancelEarly} onChange={(e) => set('cancelEarly', e.target.value === 'fee' ? 'fee' : 'wait')}>
                <option value="wait">They must wait until the term ends</option>
                <option value="fee">They can leave early for a fee</option>
              </Select>
            </Field>
            {form.cancelEarly === 'fee' && num('r-cfee', 'Early cancellation fee (£)', 'cancelFee')}
            <Checkbox label="Offer a pause before they cancel" checked={form.cancelOffer} onChange={(v) => set('cancelOffer', v)} />
            <Checkbox label="Ask why they are leaving" checked={form.cancelAsk} onChange={(v) => set('cancelAsk', v)} />
            <ApprovalPick id="r-capp" value={form.cancelApproval} onChange={(v) => set('cancelApproval', v)} />
          </>
        )}
      </Card>

      <Card className="rules-card" role="region" aria-label="Changing plan">
        <h3>Changing plan</h3>
        <div className="muted small">Members can only move between plans you have ticked “Members can switch to this plan themselves” on, in Plans.</div>
        <Checkbox label="Members can move to a more expensive plan" checked={form.upgrade} onChange={(v) => set('upgrade', v)} />
        <Checkbox label="Members can move to a cheaper plan" checked={form.downgrade} onChange={(v) => set('downgrade', v)} />
        {(form.upgrade || form.downgrade) && (
          <>
            {form.upgrade && (
              <Field label="A bigger plan starts" htmlFor="r-ustart">
                <Select id="r-ustart" value={form.upgradeStarts} onChange={(e) => set('upgradeStarts', e.target.value === 'now' ? 'now' : 'next_month')}>
                  <option value="now">Straight away</option>
                  <option value="next_month">At the start of next month</option>
                </Select>
              </Field>
            )}
            {form.downgrade && (
              <Field label="A cheaper plan starts" htmlFor="r-dstart">
                <Select id="r-dstart" value={form.downgradeStarts} onChange={(e) => set('downgradeStarts', e.target.value === 'now' ? 'now' : 'next_month')}>
                  <option value="now">Straight away</option>
                  <option value="next_month">At the start of next month</option>
                </Select>
              </Field>
            )}
            {num('r-cmin', 'Months between plan changes', 'changeMin', '0 lets them change as often as they like.')}
            <ApprovalPick id="r-chapp" value={form.changeApproval} onChange={(v) => set('changeApproval', v)} />
          </>
        )}
      </Card>

      <Card>
        <div className="muted small">Payments are not collected here yet. When a pause, plan change or leaving fee is approved, the request shows what to do with the direct debit.</div>
        {note && <div className={`msg ${note.good ? '' : 'error'}`} role={note.good ? 'status' : 'alert'}>{note.text}</div>}
        <Button variant="primary" className="wide-btn" disabled={save.isPending} onClick={submit}>{save.isPending ? 'Saving…' : 'Save membership rules'}</Button>
      </Card>
    </>
  );
}
