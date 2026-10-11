import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useReadyAuth } from '../auth/AuthProvider';
import { getSignatureDetail, listSignatures, makeSignedCopies, signedCopyUrl, type SignatureRow } from '../data/signup';
import { Button } from '../ui/Button';
import { Card, Empty } from '../ui/Card';
import { Input, Select } from '../ui/Field';
import { SIG_SORT_LABEL, filterSignatures, fullStamp, signerLine, type SigSort } from './calc';
import '../members/members.css';
import '../staff/staff.css';
import './signup.css';

/** Everyone who has signed the gym's terms and waiver: searchable, sortable, with the exact time and the signed copies. */
export function SignedDocuments() {
  const { gym } = useReadyAuth();
  const sigs = useQuery({ queryKey: ['signup-signatures', gym.gymId], queryFn: () => listSignatures(gym.gymId) });
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SigSort>('newest');
  const [openId, setOpenId] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const rows = filterSignatures(sigs.data ?? [], search, sort);

  return (
    <>
      <header className="page-top">
        <div>
          <div className="eyebrow">People &amp; subscriptions</div>
          <h1>Signed documents</h1>
          <div className="muted">Who has signed the terms and waiver at {gym.gymName}, and exactly when.</div>
        </div>
        <span className="muted">{sigs.data ? (rows.length === sigs.data.length ? `${rows.length} signed` : `${rows.length} of ${sigs.data.length}`) : ''}</span>
      </header>

      <Card>
        <div className="member-directory-tools">
          <Input type="search" placeholder="Search by member or signer name…" autoComplete="off" aria-label="Search signed documents" value={search} onChange={(e) => setSearch(e.target.value)} />
          <label className="member-sort">
            <span className="muted">Sort</span>
            <Select aria-label="Sort" value={sort} onChange={(e) => setSort(e.target.value as SigSort)}>
              {(Object.keys(SIG_SORT_LABEL) as SigSort[]).map((k) => <option key={k} value={k}>{SIG_SORT_LABEL[k]}</option>)}
            </Select>
          </label>
        </div>
        {problem && <p className="join-msg bad" role="alert">{problem}</p>}
        {done && <p className="join-msg good" role="status">{done}</p>}
        {sigs.isError && <Empty>Could not load signed documents. Refresh to try again.</Empty>}
        {sigs.data && sigs.data.length === 0 && <Empty>No one has signed yet.</Empty>}
        {sigs.data && sigs.data.length > 0 && rows.length === 0 && <Empty>No signed documents match your search.</Empty>}
        {rows.length > 0 && (
          <ul className="settings-list">
            {rows.map((s) => <Item key={s.id} s={s} open={openId === s.id} onToggle={() => setOpenId(openId === s.id ? null : s.id)} onProblem={setProblem} onDone={setDone} gymId={gym.gymId} />)}
          </ul>
        )}
      </Card>
    </>
  );
}

function Item({ s, gymId, open, onToggle, onProblem, onDone }: { s: SignatureRow; gymId: string; open: boolean; onToggle: () => void; onProblem: (text: string | null) => void; onDone: (text: string | null) => void }) {
  const qc = useQueryClient();
  const hasPdf = !!(s.termsPath || s.waiverPath);
  const make = useMutation({
    mutationFn: (opts: { email: boolean; resend?: boolean }) => makeSignedCopies(s.id, opts),
    onMutate: () => { onProblem(null); onDone(null); },
    onSuccess: (_d, opts) => { onDone(opts.email ? `Emailed the signed copies to ${s.name}.` : `Made the PDF for ${s.name}.`); return qc.invalidateQueries({ queryKey: ['signup-signatures', gymId] }); },
    onError: (e) => onProblem(e instanceof Error ? e.message : 'Could not do that. Try again.'),
  });
  const detail = useQuery({ queryKey: ['signature-detail', s.id], queryFn: () => getSignatureDetail(s.id), enabled: open });
  const copy = async (path: string) => {
    onProblem(null);
    try {
      window.open(await signedCopyUrl(path), '_blank', 'noopener');
    } catch (e) {
      onProblem(e instanceof Error ? e.message : 'Could not open the signed copy.');
    }
  };
  const versions = [s.termsVersion != null ? `terms v${s.termsVersion}` : '', s.waiverVersion != null ? `waiver v${s.waiverVersion}` : ''].filter(Boolean).join(', ');
  return (
    <li className="signed-item">
      <div className="signed-main">
        <div>
          <b>{s.name}</b>
          <div className="muted">Signed by {signerLine({ signerName: s.signerName, isGuardian: s.isGuardian }, s.name)} · {fullStamp(s.signedAt)}</div>
          <div className="muted small">{versions}. {s.emailedAt ? `Copy emailed ${fullStamp(s.emailedAt)}.` : s.emailError ? `Email failed: ${s.emailError}` : 'Signed copy not emailed yet.'}</div>
        </div>
        <div className="signup-actions">
          {s.termsPath && <Button onClick={() => void copy(s.termsPath ?? '')}>Terms PDF</Button>}
          {s.waiverPath && <Button onClick={() => void copy(s.waiverPath ?? '')}>Waiver PDF</Button>}
          {!hasPdf && <span className="muted small">No PDF made yet</span>}
          {!hasPdf && <Button onClick={() => make.mutate({ email: false })} disabled={make.isPending}>{make.isPending ? 'Making…' : 'Make PDF'}</Button>}
          {hasPdf && <Button onClick={() => make.mutate({ email: true, resend: !!s.emailedAt })} disabled={make.isPending}>{make.isPending ? 'Sending…' : s.emailedAt ? 'Resend email' : 'Send email'}</Button>}
          <Button onClick={onToggle} aria-expanded={open}>{open ? 'Hide signature' : 'View signature'}</Button>
        </div>
      </div>
      {open && (
        <div className="signed-detail">
          {detail.isLoading && <p className="muted">Loading…</p>}
          {detail.isError && <p className="join-msg bad" role="alert">Could not load the signature.</p>}
          {detail.data && (
            <>
              {detail.data.image ? <img className="signed-image" src={detail.data.image} alt={`Signature of ${s.signerName}`} /> : <p className="muted">No signature image was saved.</p>}
              <dl className="signed-facts">
                <dt>Signed by</dt><dd>{signerLine({ signerName: s.signerName, isGuardian: s.isGuardian }, s.name)}</dd>
                <dt>Date and time</dt><dd>{fullStamp(s.signedAt)}</dd>
                <dt>Documents</dt><dd>{versions || 'None recorded'}</dd>
                {detail.data.agreedText && (<><dt>They agreed to</dt><dd>{detail.data.agreedText}</dd></>)}
              </dl>
            </>
          )}
        </div>
      )}
    </li>
  );
}
