import { useQuery } from '@tanstack/react-query';
import { getMemberAgreements } from '../data/signup';
import { Empty } from '../ui/Card';
import { fullStamp, signerLine } from '../signup/calc';
import '../signup/signup.css';

/** What this person signed, in full, on their own file: when, who signed, what they agreed to, their answers and their signature. */
export function MemberAgreements({ gymId, userId, name }: { gymId: string; userId: string; name: string }) {
  const q = useQuery({ queryKey: ['member-agreements', gymId, userId], queryFn: () => getMemberAgreements(gymId, userId) });
  return (
    <section className="record-section" aria-label="Signed agreements">
      <h3>Signed agreements</h3>
      {q.isError ? <Empty>Could not load their signed agreements.</Empty> : !q.data ? <Empty>Loading…</Empty> : q.data.length === 0 ? <Empty>Nothing signed yet.</Empty> : q.data.map((a) => (
        <div className="agreement" key={a.id}>
          <div className="agreement-when"><b>{fullStamp(a.signedAt)}</b></div>
          <div className="muted small">Signed by {signerLine({ signerName: a.signerName, isGuardian: a.isGuardian }, name)}</div>
          {a.docs.map((d) => (
            <div className="agreement-doc" key={d.kind}>
              <h4>{d.title} <span className="muted">v{d.version}</span></h4>
              <div className="small">Agreed: <b>{d.acceptance}</b></div>
              {d.answers.map((x) => <div className="small muted" key={x.prompt}>{x.prompt} <b>{x.answer || 'No answer'}</b></div>)}
            </div>
          ))}
          {a.image ? <img className="signed-image" src={a.image} alt={`Signature of ${a.signerName}`} /> : <div className="muted small">No signature image was saved.</div>}
          <div className="muted small">{a.emailedAt ? `A signed copy was emailed ${fullStamp(a.emailedAt)}.` : a.emailError ? `The signed copy was not emailed: ${a.emailError}` : 'A signed copy has not been emailed.'}</div>
        </div>
      ))}
    </section>
  );
}
