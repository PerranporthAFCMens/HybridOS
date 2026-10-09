import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useReadyAuth } from '../auth/AuthProvider';
import { listPlans } from '../data/plans';
import { listPersonNames } from '../data/reports';
import { decideRequest, listRequests, type RequestRow } from '../data/rules';
import { Button } from '../ui/Button';
import { Card, Empty } from '../ui/Card';
import { Input } from '../ui/Field';
import { describeRequest, KIND_LABEL, STATUS_LABEL } from './calc';
import '../members/members.css';
import './membership.css';

/** Membership requests: what is waiting for a decision, and what happened lately. */
export function Requests() {
  const { gym } = useReadyAuth();
  const q = useQuery({
    queryKey: ['membership-requests', gym.gymId],
    queryFn: async () => {
      const [rows, plans] = await Promise.all([listRequests(gym.gymId), listPlans(gym.gymId)]);
      const names = await listPersonNames(rows.map((r) => r.userId));
      return { rows, names, plans: new Map(plans.map((p) => [p.id, p.name])) };
    },
  });
  const waiting = q.data?.rows.filter((r) => r.status === 'pending') ?? [];
  const recent = q.data?.rows.filter((r) => r.status !== 'pending') ?? [];
  return (
    <>
      <header className="page-top">
        <div>
          <div className="eyebrow">Members</div>
          <h1>Membership requests</h1>
          <div className="muted">Pause, cancel and plan change requests from members.</div>
        </div>
      </header>
      {q.isError && <Card><Empty>Could not load requests. Refresh to try again.</Empty></Card>}
      {q.isPending && <Card><Empty>Loading…</Empty></Card>}
      {q.isSuccess && (
        <>
          <Card role="region" aria-label="Waiting for you">
            <h3>Waiting for you</h3>
            {waiting.length === 0 ? <Empty>Nothing is waiting.</Empty> : (
              <ul className="req-list">
                {waiting.map((r) => <Item key={r.id} r={r} name={q.data.names.get(r.userId) ?? 'Member'} plans={q.data.plans} decide />)}
              </ul>
            )}
          </Card>
          <Card role="region" aria-label="Recent">
            <h3>Recent</h3>
            {recent.length === 0 ? <Empty>No recent requests.</Empty> : (
              <ul className="req-list">
                {recent.map((r) => <Item key={r.id} r={r} name={q.data.names.get(r.userId) ?? 'Member'} plans={q.data.plans} />)}
              </ul>
            )}
          </Card>
        </>
      )}
    </>
  );
}

function Item({ r, name, plans, decide }: { r: RequestRow; name: string; plans: Map<string, string>; decide?: boolean }) {
  const { gym } = useReadyAuth();
  const qc = useQueryClient();
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const go = useMutation({
    mutationFn: (approve: boolean) => decideRequest(r.id, approve, note),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['membership-requests', gym.gymId] }),
    onError: (e) => setError(e.message),
  });
  return (
    <li className="req-item" aria-label={`${name} ${KIND_LABEL[r.kind] ?? r.kind}`}>
      <div className="req-head">
        <b>{name}</b>
        <span className="req-status">{STATUS_LABEL[r.status] ?? r.status}</span>
      </div>
      <div>{KIND_LABEL[r.kind] ?? r.kind}: {describeRequest(r, plans)}</div>
      {r.reason && <div className="muted small">Reason: {r.reason}</div>}
      {r.decisionNote && <div className="muted small">Note: {r.decisionNote}</div>}
      {decide && (
        <>
          <Input aria-label={`Note to ${name} (optional)`} placeholder="Note to the member (optional)" maxLength={300} value={note} onChange={(e) => { setError(null); setNote(e.target.value); }} />
          {error && <div className="msg error" role="alert">{error}</div>}
          <div className="req-actions">
            <Button variant="primary" disabled={go.isPending} onClick={() => go.mutate(true)}>Approve</Button>
            <Button disabled={go.isPending} onClick={() => go.mutate(false)}>Decline</Button>
          </div>
        </>
      )}
    </li>
  );
}
