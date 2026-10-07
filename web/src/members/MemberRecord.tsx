import { useState } from 'react';
import type { MemberRow } from '../data/members';
import { Button } from '../ui/Button';
import { Empty, SectionTitle } from '../ui/Card';
import { Modal } from '../ui/Modal';
import { money } from '../today/calc';
import { dateInputValue, formatDate, formatRegistered, labelStatus, nameOf, nameParts, paymentHint, validateLifecycle } from './calc';
import { useMemberMemberships, useMemberWrites, usePlans } from './useMembers';

type Message = { text: string; tone: 'good' | 'error' } | null;

function Msg({ m }: { m: Message }) {
  return m ? <span className={`msg ${m.tone}`} role="status">{m.text}</span> : null;
}

export function MemberRecord({ member, gymId, onClose }: { member: MemberRow; gymId: string; onClose: () => void }) {
  const name = nameOf(member);
  const parts = nameParts(member);
  const memberships = useMemberMemberships(gymId, member.userId);
  const plans = usePlans(gymId);
  const writes = useMemberWrites(gymId, member.userId);
  const activePlans = (plans.data ?? []).filter((p) => p.isActive);

  const [joined, setJoined] = useState(dateInputValue(member.joinedAt));
  const [attrition, setAttrition] = useState(member.attritionOn ?? '');
  const [lifecycleMsg, setLifecycleMsg] = useState<Message>(null);

  const [planId, setPlanId] = useState('');
  const [startsOn, setStartsOn] = useState(new Date().toISOString().slice(0, 10));
  const [status, setStatus] = useState<'active' | 'pending' | 'paused'>('active');
  const [payment, setPayment] = useState<'manual' | 'gocardless'>('manual');
  const [assignMsg, setAssignMsg] = useState<Message>(null);
  const chosenPlan = planId || activePlans[0]?.id || '';

  const saveLifecycle = () => {
    const problem = validateLifecycle(joined, attrition);
    if (problem) return setLifecycleMsg({ text: problem, tone: 'error' });
    writes.saveLifecycle.mutate(
      { joinedOn: joined, attritionOn: attrition || null },
      {
        onSuccess: () => setLifecycleMsg({ text: 'Saved.', tone: 'good' }),
        onError: (e) => setLifecycleMsg({ text: e.message, tone: 'error' }),
      },
    );
  };

  const assign = () => {
    if (!chosenPlan) return setAssignMsg({ text: 'Create an active membership plan first.', tone: 'error' });
    writes.assign.mutate(
      { planId: chosenPlan, status, startsOn: startsOn || null, payment },
      {
        onSuccess: () =>
          setAssignMsg({
            text: payment === 'gocardless' ? 'Membership created and ready for future GoCardless setup.' : 'Membership assigned.',
            tone: 'good',
          }),
        onError: (e) => setAssignMsg({ text: e.message, tone: 'error' }),
      },
    );
  };

  const changeStatus = (membershipId: string, next: 'active' | 'paused' | 'cancelled') =>
    writes.setStatus.mutate(
      { membershipId, status: next },
      {
        onSuccess: () => setAssignMsg({ text: 'Membership updated.', tone: 'good' }),
        onError: (e) => setAssignMsg({ text: e.message, tone: 'error' }),
      },
    );

  return (
    <Modal title={`Member record: ${name}`} onClose={onClose}>
      <SectionTitle
        title={name}
        action={<Button onClick={onClose}>Close</Button>}
      />
      <div className="muted">Gym role: member</div>

      <div className="profile">
        <div><small>Name</small><b>{name}</b></div>
        <div><small>Joined</small><b>{formatRegistered(member.joinedAt)}</b></div>
        <div><small>First name</small><b>{member.firstName || '—'}</b></div>
        <div><small>Surname</small><b>{member.lastName || parts.surname || '—'}</b></div>
      </div>

      <section className="record-section">
        <h3>Customer lifecycle</h3>
        <div className="muted small">Joined date drives new customer reporting. Add an attrition date when they leave.</div>
        <div className="form-grid">
          <div className="field">
            <label htmlFor="joinedDate">Joined date</label>
            <input id="joinedDate" type="date" value={joined} onChange={(e) => setJoined(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="attritionDate">Attrition date</label>
            <input id="attritionDate" type="date" value={attrition} onChange={(e) => setAttrition(e.target.value)} />
            <div className="muted small">Leave blank while the customer is live.</div>
          </div>
        </div>
        <Button onClick={saveLifecycle} disabled={writes.saveLifecycle.isPending}>
          {writes.saveLifecycle.isPending ? 'Saving…' : 'Save lifecycle dates'}
        </Button>{' '}
        <Msg m={lifecycleMsg} />
      </section>

      <section className="record-section">
        {memberships.isError ? (
          <Empty>Could not load memberships.</Empty>
        ) : !memberships.data ? (
          <Empty>Loading memberships…</Empty>
        ) : memberships.data.length ? (
          memberships.data.map((m) => (
            <div className="membership-card" key={m.id}>
              <h4>{m.planName || 'Membership'}</h4>
              <div className="muted">
                {m.planPricePence !== null ? `${money(m.planPricePence)} / ${m.planInterval ?? ''}` : 'No plan'}
              </div>
              <div className="tags">
                <span className={`tag ${m.status === 'active' ? 'good' : m.status === 'paused' ? 'warn' : ''}`}>{labelStatus(m.status)}</span>{' '}
                <span className="tag">{m.paymentProvider || 'manual'}</span>{' '}
                <span className={`tag ${['failed', 'charged_back'].includes(m.paymentStatus) ? 'bad' : ''}`}>{labelStatus(m.paymentStatus)}</span>
              </div>
              <div className="muted small">
                Starts {formatDate(m.startsOn)}
                {m.endsOn ? ` · Ends ${formatDate(m.endsOn)}` : ''}
              </div>
              <div className="membership-actions">
                {m.status !== 'active' && <Button disabled={writes.setStatus.isPending} onClick={() => changeStatus(m.id, 'active')}>Activate</Button>}
                {m.status !== 'paused' && <Button disabled={writes.setStatus.isPending} onClick={() => changeStatus(m.id, 'paused')}>Pause</Button>}
                {m.status !== 'cancelled' && (
                  <Button className="danger" disabled={writes.setStatus.isPending} onClick={() => changeStatus(m.id, 'cancelled')}>Cancel</Button>
                )}
              </div>
            </div>
          ))
        ) : (
          <Empty>No membership assigned yet.</Empty>
        )}
      </section>

      <hr className="rule" />
      <h3>Assign membership</h3>
      <div className="field">
        <label htmlFor="planSelect">Membership plan</label>
        <select id="planSelect" value={chosenPlan} onChange={(e) => setPlanId(e.target.value)}>
          {activePlans.length ? (
            activePlans.map((p) => (
              <option key={p.id} value={p.id}>{p.name} — {money(p.priceInPence)} / {p.interval}</option>
            ))
          ) : (
            <option value="">No active plans</option>
          )}
        </select>
      </div>
      <div className="form-grid">
        <div className="field">
          <label htmlFor="startDate">Start date</label>
          <input id="startDate" type="date" value={startsOn} onChange={(e) => setStartsOn(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="statusSelect">Status</label>
          <select id="statusSelect" value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
            <option value="active">Active</option>
            <option value="pending">Pending</option>
            <option value="paused">Paused</option>
          </select>
        </div>
      </div>
      <div className="field">
        <label htmlFor="paymentSelect">Payment method</label>
        <select id="paymentSelect" value={payment} onChange={(e) => setPayment(e.target.value as typeof payment)}>
          <option value="manual">Manual / recorded outside HybridOne</option>
          <option value="gocardless">GoCardless ready — connect later</option>
        </select>
      </div>
      <div className="notice">{paymentHint(payment)}</div>
      <div className="assign-msg"><Msg m={assignMsg} /></div>
      <Button variant="primary" className="wide-btn" onClick={assign} disabled={writes.assign.isPending}>
        {writes.assign.isPending ? 'Assigning…' : 'Assign membership'}
      </Button>
    </Modal>
  );
}
