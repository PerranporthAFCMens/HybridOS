import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getSignatureDetail, makeSignedCopies, signedCopyUrl, type SignatureRow } from '../data/signup';
import { Button } from '../ui/Button';
import { fullStamp, signerLine } from './calc';
import './signup.css';

/** One signed terms and waiver: who signed, the exact moment, the signed copies, the signature, and (for the team) making or resending the copies. */
export function SignedDocumentItem({ s, gymId, open, onToggle, onProblem, onDone }: { s: SignatureRow; gymId: string; open: boolean; onToggle: () => void; onProblem: (text: string | null) => void; onDone: (text: string | null) => void }) {
  const qc = useQueryClient();
  const hasPdf = !!(s.termsPath || s.waiverPath);
  const make = useMutation({
    mutationFn: (opts: { email: boolean; resend?: boolean }) => makeSignedCopies(s.id, opts),
    onMutate: () => { onProblem(null); onDone(null); },
    onSuccess: (_d, opts) => { onDone(opts.email ? `Emailed the signed copies to ${s.name}.` : `Made the PDF for ${s.name}.`); return Promise.all([qc.invalidateQueries({ queryKey: ['signup-signatures', gymId] }), qc.invalidateQueries({ queryKey: ['member-signatures', gymId] })]); },
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
