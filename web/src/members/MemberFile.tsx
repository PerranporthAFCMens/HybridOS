import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { useReadyAuth } from '../auth/AuthProvider';
import type { MemberRow } from '../data/members';
import { getMemberAgreements, makeSignedCopies } from '../data/signup';
import { fileBase, save } from '../reports/download';
import { fetchSignedCopy, signedPaths } from './signedCopy';
import { Button } from '../ui/Button';
import { Empty } from '../ui/Card';
import { DateInput, Field, FieldRow, Select } from '../ui/Field';
import { money } from '../today/calc';
import { dateInputValue, initials, isTeam, ROLE_LABEL, formatDate, formatRegistered, labelStatus, nameOf, paymentHint, validateLifecycle } from './calc';
import { MemberAgreements } from './MemberAgreements';
import { MemberDetailsCard } from './MemberDetailsCard';
import { MemberTraining } from './MemberTraining';
import { NotFinancial } from './NotFinancial';
import { useMemberDirectory, useMemberMemberships, useMemberWrites, usePlans } from './useMembers';
import '../staff/staff.css';
import './members.css';

type Message = { text: string; tone: 'good' | 'error' } | null;

function Msg({ m }: { m: Message }) {
  return m ? <span className={`msg ${m.tone}`} role="status">{m.text}</span> : null;
}

/** One person's file, as a page: everything about them in one place, opened from the Members list. */
export function MemberFile() {
  const { gym } = useReadyAuth();
  const { userId = '' } = useParams();
  const directory = useMemberDirectory(gym.gymId);
  const member = directory.data?.find((m) => m.userId === userId);
  if (directory.isError) return <Empty>Could not load this member. Refresh to try again.</Empty>;
  if (!directory.data) return <Empty>Loading…</Empty>;
  if (!member) return <Empty>That person is not in this gym.</Empty>;
  return <MemberFileBody key={member.userId} member={member} gymId={gym.gymId} />;
}

function MemberFileBody({ member, gymId }: { member: MemberRow; gymId: string }) {
  const name = nameOf(member);
  const team = isTeam(member);
  const memberships = useMemberMemberships(gymId, member.userId);
  const plans = usePlans(gymId);
  const writes = useMemberWrites(gymId, member.userId);
  const activePlans = (plans.data ?? []).filter((p) => p.isActive);

  // The file as a PDF to download, and the signed copy emailed to the person on request.
  const { gym } = useReadyAuth();
  const qc = useQueryClient();
  const agreements = useQuery({ queryKey: ['member-agreements', gymId, member.userId], queryFn: () => getMemberAgreements(gymId, member.userId) });
  const [busy, setBusy] = useState<'pdf' | 'send' | null>(null);
  const [asking, setAsking] = useState(false);
  const [fileMsg, setFileMsg] = useState<Message>(null);
  // Download PDF hands over the signed copy made when they signed (the original record). If that was never made, it is made now, then handed over.
  const download = async () => {
    setBusy('pdf');
    setFileMsg(null);
    try {
      let latest = (await qc.ensureQueryData({ queryKey: ['member-agreements', gymId, member.userId], queryFn: () => getMemberAgreements(gymId, member.userId) }))[0];
      if (!latest) throw new Error(`${name} has not signed anything yet.`);
      if (!signedPaths(latest).length) {
        await makeSignedCopies(latest.id, { email: false });
        latest = (await qc.fetchQuery({ queryKey: ['member-agreements', gymId, member.userId], queryFn: () => getMemberAgreements(gymId, member.userId), staleTime: 0 }))[0];
      }
      if (!latest) throw new Error('Could not find the signed copy.');
      save(await fetchSignedCopy(latest), `${fileBase(gym.gymName, `${name} signed copy`, new Date(latest.signedAt))}.pdf`);
    } catch (e) {
      setFileMsg({ text: e instanceof Error ? e.message : 'Could not get the signed copy. Try again.', tone: 'error' });
    } finally {
      setBusy(null);
    }
  };
  const latestSigned = agreements.data?.[0];
  const sendCopy = async () => {
    if (!latestSigned) return;
    setBusy('send');
    setFileMsg(null);
    try {
      await makeSignedCopies(latestSigned.id, { email: true, resend: !!latestSigned.emailedAt });
      setAsking(false);
      setFileMsg({ text: `Sent the signed copy to ${name}.`, tone: 'good' });
      await qc.invalidateQueries({ queryKey: ['member-agreements', gymId, member.userId] });
    } catch (e) {
      setFileMsg({ text: e instanceof Error ? e.message : 'Could not send it. Try again.', tone: 'error' });
    } finally {
      setBusy(null);
    }
  };

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

  const latest = member.latest;
  return (
    <>
      <header className="file-head">
        <span className="avatar big" aria-hidden="true">{initials(name)}</span>
        <div>
          <h1>{name}</h1>
          <div className="file-sub">
            <span className="chip">{ROLE_LABEL[member.role] ?? 'Member'}</span>
            {latest && <span className={`chip ${latest.status === 'active' ? 'good' : latest.status === 'paused' ? 'warn' : ''}`}>{labelStatus(latest.status)}</span>}
            <NotFinancial gymId={gymId} userId={member.userId} />
          </div>
        </div>
        <div className="file-actions">
          <Button variant="primary" onClick={() => void download()} disabled={busy !== null}>{busy === 'pdf' ? 'Getting it…' : 'Download PDF'}</Button>
          <Button onClick={() => setAsking(true)} disabled={busy !== null || !latestSigned}>Send to customer</Button>
        </div>
      </header>
      {asking && latestSigned && (
        <div className="notice file-ask" role="alertdialog" aria-label="Send to customer">
          Email the signed copy to {name}, at the email address on their account?{' '}
          <Button variant="primary" onClick={() => void sendCopy()} disabled={busy !== null}>{busy === 'send' ? 'Sending…' : 'Send'}</Button>{' '}
          <Button onClick={() => setAsking(false)} disabled={busy !== null}>Cancel</Button>
        </div>
      )}
      <div className="file-msg"><Msg m={fileMsg} /></div>
      {team && <div className="notice">This is a team login. Give them a membership below so they see the member app like any member (classes, workouts and so on).</div>}

      <div className="file-strip">
        <div><small>Plan</small><b>{latest ? latest.planName || 'Membership' : 'None'}</b></div>
        <div><small>Status</small><b>{latest ? labelStatus(latest.status) : 'No membership'}</b></div>
        <div><small>Member since</small><b>{formatRegistered(member.joinedAt)}</b></div>
      </div>

      <div className="file-cols">
        <div>
          <MemberDetailsCard gymId={gymId} member={member} team={team} />

          <h3 className="file-heading">Membership</h3>
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

      <section className="record-section">
      <h3>Assign membership</h3>
      <Field label="Membership plan" htmlFor="planSelect">
        <Select id="planSelect" value={chosenPlan} onChange={(e) => setPlanId(e.target.value)}>
          {activePlans.length ? (
            activePlans.map((p) => (
              <option key={p.id} value={p.id}>{p.name} — {money(p.priceInPence)} / {p.interval}</option>
            ))
          ) : (
            <option value="">No active plans</option>
          )}
        </Select>
      </Field>
      <FieldRow>
        <Field label="Start date" htmlFor="startDate">
          <DateInput id="startDate" value={startsOn} onChange={(e) => setStartsOn(e.target.value)} />
        </Field>
        <Field label="Status" htmlFor="statusSelect">
          <Select id="statusSelect" value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
            <option value="active">Active</option>
            <option value="pending">Pending</option>
            <option value="paused">Paused</option>
          </Select>
        </Field>
      </FieldRow>
      <Field label="Payment method" htmlFor="paymentSelect">
        <Select id="paymentSelect" value={payment} onChange={(e) => setPayment(e.target.value as typeof payment)}>
          <option value="manual">Manual / recorded outside HybridOne</option>
          <option value="gocardless">GoCardless ready — connect later</option>
        </Select>
      </Field>
      <div className="notice">{paymentHint(payment)}</div>
      <div className="assign-msg"><Msg m={assignMsg} /></div>
      <Button variant="primary" className="wide-btn" onClick={assign} disabled={writes.assign.isPending}>
        {writes.assign.isPending ? 'Assigning…' : 'Assign membership'}
      </Button>
      </section>
        </div>
        <div>
          <MemberAgreements gymId={gymId} userId={member.userId} name={name} />
          <MemberTraining userId={member.userId} name={name} />

      {!team && <section className="record-section">
        <h3>Customer lifecycle</h3>
        <div className="muted small">Joined date drives new customer reporting. Add an attrition date when they leave.</div>
        <FieldRow>
          <Field label="Joined date" htmlFor="joinedDate">
            <DateInput id="joinedDate" value={joined} onChange={(e) => setJoined(e.target.value)} />
          </Field>
          <Field label="Attrition date" htmlFor="attritionDate" hint="Leave blank while the customer is live.">
            <DateInput id="attritionDate" value={attrition} onChange={(e) => setAttrition(e.target.value)} />
          </Field>
        </FieldRow>
        <Button onClick={saveLifecycle} disabled={writes.saveLifecycle.isPending}>
          {writes.saveLifecycle.isPending ? 'Saving…' : 'Save lifecycle dates'}
        </Button>{' '}
        <Msg m={lifecycleMsg} />
      </section>}
        </div>
      </div>
    </>
  );
}
