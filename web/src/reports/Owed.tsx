import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useReadyAuth } from '../auth/AuthProvider';
import { listDebtors, listMissedPayments, reopenPayment, settlePayment, type Debtor, type MissedPayment, type SettleHow } from '../data/arrears';
import { Button } from '../ui/Button';
import { Card, Empty, SectionTitle } from '../ui/Card';
import { Input } from '../ui/Field';
import { Modal } from '../ui/Modal';
import { DownloadButtons } from './DownloadButtons';
import { DataTable } from './DataTable';
import { daysLate, findDebtors, HOW_WORDS, missedTable, missedText, owedOf, owedTable, reasonWords, shortDate, stateWords, totalMissed, totalOwed } from './owed';
import { pounds } from './library';

/** Money owed: everyone who is "not financial", what they owe, and (click a name) which payments they missed. */
export function Owed() {
  const { gym } = useReadyAuth();
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState<Debtor | null>(null);
  const q = useQuery({ queryKey: ['owed', gym.gymId], queryFn: () => listDebtors(gym.gymId) });
  const rows = useMemo(() => findDebtors(q.data ?? [], search), [q.data, search]);
  const ctx = () => ({ gymName: gym.gymName, rangeLabel: 'Right now', now: new Date() });

  return (
    <>
      <div className="stat-grid">
        <div className="card stat"><span className="muted">Owed in total</span><span className="stat-num" data-testid="owed-total">{pounds(totalOwed(q.data ?? []))}</span></div>
        <div className="card stat"><span className="muted">People not financial</span><span className="stat-num">{(q.data ?? []).length}</span></div>
        <div className="card stat"><span className="muted">Missed payments</span><span className="stat-num">{totalMissed(q.data ?? [])}</span></div>
      </div>

      <Card>
        <SectionTitle title="Members who are not financial" action={q.data && q.data.length > 0 ? <DownloadButtons gymName={gym.gymName} build={() => owedTable(ctx(), rows)} /> : undefined} />
        <p className="muted small">A member is not financial while they have a missed payment: a payment that failed, was charged back, or has not arrived a week after it was due. Pay it, waive it or write it off and they are financial again.</p>
        {q.isPending && <div className="muted">Loading…</div>}
        {q.isError && <div className="error" role="alert">{/owner or admin/i.test((q.error as { message?: string } | null)?.message ?? '') ? 'Only owners and admins can see money owed.' : 'Could not load money owed. Refresh to try again.'}</div>}
        {q.data && q.data.length === 0 && <Empty>Everyone is financial. Nobody has a missed payment.</Empty>}
        {q.data && q.data.length > 0 && (
          <>
            <div className="owed-find"><Input aria-label="Find a member" placeholder="Find a member or plan" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
            <ul className="owed-list" aria-label="Members who are not financial">
              {rows.map((r) => (
                <li key={r.userId}>
                  <button type="button" className="owed-row" onClick={() => setOpen(r)} aria-label={`${r.name}, owes ${pounds(r.owedPence)}, ${missedText(r.missedCount)}. Show their missed payments.`}>
                    <span className="owed-who"><b>{r.name}</b><span className="muted small">{[r.planName, r.membershipStatus && r.membershipStatus !== 'active' ? `membership ${r.membershipStatus}` : ''].filter(Boolean).join(' · ')}</span></span>
                    <span className="owed-sum"><b>{pounds(r.owedPence)}</b><span className="muted small">{missedText(r.missedCount)}{r.oldestMissed ? ` · oldest ${shortDate(r.oldestMissed)}` : ''}</span></span>
                  </button>
                </li>
              ))}
              {rows.length === 0 && <li className="muted">Nobody matches.</li>}
            </ul>
          </>
        )}
      </Card>

      {open && <MissedModal debtor={open} onClose={() => setOpen(null)} />}
    </>
  );
}

function MissedModal({ debtor, onClose }: { debtor: Debtor; onClose: () => void }) {
  const { gym } = useReadyAuth();
  const qc = useQueryClient();
  const key = ['missed', gym.gymId, debtor.userId];
  const q = useQuery({ queryKey: key, queryFn: () => listMissedPayments(gym.gymId, debtor.userId) });
  const [message, setMessage] = useState('');
  const [acting, setActing] = useState<{ id: string; how: SettleHow } | null>(null);
  const [note, setNote] = useState('');
  const done = async () => { await qc.invalidateQueries({ queryKey: ['owed', gym.gymId] }); await qc.invalidateQueries({ queryKey: key }); };
  const settle = useMutation({
    mutationFn: (v: { id: string; how: SettleHow }) => settlePayment(gym.gymId, v.id, v.how, note),
    onSuccess: async () => { setActing(null); setNote(''); setMessage(''); await done(); },
    onError: (e: Error) => setMessage(e.message),
  });
  const reopen = useMutation({
    mutationFn: (id: string) => reopenPayment(gym.gymId, id),
    onSuccess: async () => { setMessage(''); await done(); },
    onError: (e: Error) => setMessage(e.message),
  });
  const rows = q.data ?? [];
  const owing = owedOf(rows);
  const ctx = () => ({ gymName: gym.gymName, rangeLabel: 'Right now', now: new Date() });

  return (
    <Modal title={`Missed payments: ${debtor.name}`} onClose={onClose}>
      <SectionTitle title={debtor.name} action={<Button onClick={onClose}>Close</Button>} />
      <div className="muted small">{[debtor.planName, debtor.membershipStatus ? `membership ${debtor.membershipStatus}` : ''].filter(Boolean).join(' · ')}</div>
      <div className="owed-now" role="status">{owing > 0 ? <>Owes <b>{pounds(owing)}</b></> : <>Nothing owed now: they are financial.</>}</div>
      {message && <div className="error" role="alert">{message}</div>}
      {q.isPending && <div className="muted">Loading…</div>}
      {q.isError && <div className="error" role="alert">Could not load their payments.</div>}
      {rows.length > 0 && <div className="drill-actions"><DownloadButtons gymName={gym.gymName} build={() => missedTable(ctx(), debtor.name, rows)} /></div>}
      <ul className="missed-list" aria-label="Missed payments">
        {rows.map((r) => (
          <MissedRow key={r.id} r={r} acting={acting?.id === r.id ? acting.how : null} note={note} setNote={setNote} busy={settle.isPending || reopen.isPending}
            onStart={(how) => { setMessage(''); setNote(''); setActing({ id: r.id, how }); }}
            onCancel={() => setActing(null)}
            onConfirm={(how) => settle.mutate({ id: r.id, how })}
            onUndo={() => reopen.mutate(r.id)} />
        ))}
      </ul>
      {rows.length > 0 && (
        <details className="owed-table">
          <summary>Show as a table</summary>
          <DataTable table={missedTable(ctx(), debtor.name, rows)} />
        </details>
      )}
    </Modal>
  );
}

function MissedRow({ r, acting, note, setNote, busy, onStart, onCancel, onConfirm, onUndo }: {
  r: MissedPayment; acting: SettleHow | null; note: string; setNote: (v: string) => void; busy: boolean;
  onStart: (how: SettleHow) => void; onCancel: () => void; onConfirm: (how: SettleHow) => void; onUndo: () => void;
}) {
  const late = daysLate(r.chargeDate, new Date());
  return (
    <li className={`missed${r.outstanding ? '' : ' settled'}`}>
      <div className="missed-top">
        <span><b>{pounds(r.amountPence)}</b> due {shortDate(r.chargeDate) || 'on an unknown date'}{r.outstanding && late > 0 ? <span className="muted small"> · {late} day{late === 1 ? '' : 's'} ago</span> : null}</span>
        <span className={`tag ${r.outstanding ? 'bad' : ''}`.trim()}>{r.outstanding ? stateWords(r.state) : r.settledHow ? HOW_WORDS[r.settledHow] : ''}</span>
      </div>
      <div className="muted small">{[reasonWords(r.reason), r.planName].filter(Boolean).join(' · ') || stateWords(r.state)}</div>
      {!r.outstanding && (
        <div className="muted small">{[r.settledBy ? `By ${r.settledBy}` : '', r.settledAt ? shortDate(r.settledAt) : '', r.settledNote ? `“${r.settledNote}”` : ''].filter(Boolean).join(' · ')}</div>
      )}
      {r.outstanding && !acting && (
        <div className="missed-actions">
          <Button onClick={() => onStart('paid')}>Mark paid</Button>
          <Button onClick={() => onStart('waived')}>Waive</Button>
          <Button onClick={() => onStart('written_off')}>Write off</Button>
        </div>
      )}
      {r.outstanding && acting && (
        <div className="missed-form">
          <label htmlFor={`note-${r.id}`} className="small"><b>{acting === 'paid' ? 'Mark as paid another way' : acting === 'waived' ? 'Waive this payment' : 'Write this payment off'}</b>. Add a note so the next person knows why (only owners and admins see it).</label>
          <Input id={`note-${r.id}`} placeholder={acting === 'paid' ? 'e.g. Cash at the desk' : 'Optional note'} value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} />
          <div className="missed-actions">
            <Button variant="primary" onClick={() => onConfirm(acting)} disabled={busy}>{busy ? 'Saving…' : 'Confirm'}</Button>
            <Button onClick={onCancel} disabled={busy}>Cancel</Button>
          </div>
        </div>
      )}
      {!r.outstanding && <div className="missed-actions"><Button onClick={onUndo} disabled={busy}>Undo</Button></div>}
    </li>
  );
}
