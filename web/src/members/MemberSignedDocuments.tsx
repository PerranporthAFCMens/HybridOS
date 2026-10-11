import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { listSignatures } from '../data/signup';
import { Empty } from '../ui/Card';
import { SignedDocumentItem } from '../signup/SignedDocumentItem';

/** The terms and waiver this person signed, on their own file: the exact time, the signature, the signed copies, and (for the team) make or resend them. */
export function MemberSignedDocuments({ gymId, userId }: { gymId: string; userId: string }) {
  const sigs = useQuery({ queryKey: ['member-signatures', gymId, userId], queryFn: () => listSignatures(gymId, 50, userId) });
  const [openId, setOpenId] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  return (
    <section className="record-section" aria-label="Signed documents">
      <h3>Signed documents</h3>
      {problem && <p className="join-msg bad" role="alert">{problem}</p>}
      {done && <p className="join-msg good" role="status">{done}</p>}
      {sigs.isError ? <Empty>Could not load their signed documents.</Empty> : !sigs.data ? <Empty>Loading…</Empty> : sigs.data.length === 0 ? <Empty>Nothing signed yet.</Empty> : (
        <ul className="settings-list">
          {sigs.data.map((s) => <SignedDocumentItem key={s.id} s={s} gymId={gymId} open={openId === s.id} onToggle={() => setOpenId(openId === s.id ? null : s.id)} onProblem={setProblem} onDone={setDone} />)}
        </ul>
      )}
    </section>
  );
}
