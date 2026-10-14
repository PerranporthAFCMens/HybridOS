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
import { DateInput, Field, FieldRow } from '../ui/Field';
import { money } from '../today/calc';
import { dateInputValue, initials, isTeam, ROLE_LABEL, formatDate, formatRegistered, labelStatus, nameOf, validateLifecycle } from './calc';
import { MemberAgreements } from './MemberAgreements';
import { EndMembership } from './EndMembership';
import { MemberDetailsCard } from './MemberDetailsCard';
import { MemberTraining } from './MemberTraining';
import { NotFinancial } from './NotFinancial';
import { useMemberDirectory, useMemberMemberships, useMemberWrites } from './useMembers';
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
  const writes = useMemberWrites(gymId, member.userId);

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

  const [statusMsg, setStatusMsg] = useState<Message>(null);

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

  const changeStatus = (membershipId: string, next: 'active' | 'paused' | 'cancelled') =>
    writes.setStatus.mutate(
      { membershipId, status: next },
      {
        onSuccess: () => setStatusMsg({ text: 'Membership updated.', tone: 'good' }),
        onError: (e) => setStatusMsg({ text: e.message, tone: 'error' }),
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
      {team && <div className="notice">This is a team login. To see the member app like any member (classes, workouts and so on), they join through your sign-up link.</div>}

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
              </div>
              <EndMembership gymId={gymId} userId={member.userId} membership={m} name={name} />
            </div>
          ))
        ) : (
          <Empty>No membership yet. A person joins through your sign-up link.</Empty>
        )}
        <div className="assign-msg"><Msg m={statusMsg} /></div>
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
