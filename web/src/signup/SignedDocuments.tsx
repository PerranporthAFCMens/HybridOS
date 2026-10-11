import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useReadyAuth } from '../auth/AuthProvider';
import { listSignatures } from '../data/signup';
import { SignedDocumentItem } from './SignedDocumentItem';
import { Card, Empty } from '../ui/Card';
import { Input, Select } from '../ui/Field';
import { SIG_SORT_LABEL, filterSignatures, type SigSort } from './calc';
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
            {rows.map((s) => <SignedDocumentItem key={s.id} s={s} open={openId === s.id} onToggle={() => setOpenId(openId === s.id ? null : s.id)} onProblem={setProblem} onDone={setDone} gymId={gym.gymId} />)}
          </ul>
        )}
      </Card>
    </>
  );
}
