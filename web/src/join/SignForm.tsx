import { useState, type FormEvent } from 'react';
import { sendSignedCopies, signDocuments } from '../data/join';
import { publicPdfUrl } from '../data/signup';
import { Button } from '../ui/Button';
import { Checkbox, Field, Input, Select } from '../ui/Field';
import { answersPayload, checkSign, type Answers, type JoinDocument } from './calc';
import { SignaturePad } from './SignaturePad';

/**
 * Read and sign what the gym asks: its terms and waiver, with their questions, one signature at the bottom. Used on the full
 * sign-up journey and, under Quick join, from the "get ready" checklist after paying. It saves the signature and asks the server
 * to email the signed copies; the page that shows it decides what happens next.
 */
export function SignForm({ slug, docs, under18, submitLabel = 'Sign and continue', onSigned, onBack, backDisabled }: {
  slug: string;
  docs: JoinDocument[];
  under18: boolean;
  submitLabel?: string;
  onSigned: () => void;
  onBack?: () => void;
  backDisabled?: boolean;
}) {
  const [ticked, setTicked] = useState<Record<string, boolean>>({});
  const [answers, setAnswers] = useState<Answers>({});
  const [signName, setSignName] = useState('');
  const [signature, setSignature] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const problem = checkSign({ docs, answers, ticked, name: signName, hasInk: !!signature });
    if (problem) return setMsg(problem);
    setBusy(true);
    setMsg(null);
    signDocuments(slug, signName, signature ?? '', answersPayload(docs, answers)).then(
      (signatureId) => {
        void sendSignedCopies(signatureId);
        setBusy(false);
        onSigned();
      },
      (err: unknown) => {
        setMsg(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
        setBusy(false);
      },
    );
  };

  return (
    <form onSubmit={submit} noValidate>
      <p className="muted">
        {under18 ? 'You are under 18, so your parent or guardian reads and signs. ' : ''}
        Read {docs.length === 1 ? 'this document' : 'these documents'}, answer any questions, then sign once at the bottom. You will be emailed a copy.
      </p>
      {docs.map((doc) => (
        <section key={doc.id} className="join-doc" aria-label={doc.title}>
          <h3>{doc.title}</h3>
          {doc.source === 'pdf' && doc.filePath
            ? <p><a href={publicPdfUrl(doc.filePath)} target="_blank" rel="noreferrer">Open the PDF to read it ({doc.fileName ?? 'document.pdf'})</a></p>
            : <div className="join-terms" tabIndex={0}>{doc.body}</div>}
          {doc.questions.map((q) => {
            const a = answers[q.id] ?? { yes: null, text: '' };
            const set = (patch: Partial<typeof a>) => setAnswers({ ...answers, [q.id]: { ...a, ...patch } });
            return (
              <div key={q.id} className="join-q">
                <div className="join-q-text">{q.prompt}{q.required ? '' : ' (optional)'}</div>
                {q.answerType === 'yes_no' && (
                  <Select aria-label={q.prompt} value={a.yes === null ? '' : a.yes ? 'yes' : 'no'} onChange={(e) => set({ yes: e.target.value === '' ? null : e.target.value === 'yes' })}>
                    <option value="">Choose…</option>
                    <option value="yes">Yes</option>
                    <option value="no">No</option>
                  </Select>
                )}
                {(q.answerType === 'text' || (q.detailsIfYes && a.yes === true)) && (
                  <Input aria-label={q.answerType === 'text' ? q.prompt : `Details: ${q.prompt}`} placeholder={q.answerType === 'text' ? '' : 'Please give details'} value={a.text} onChange={(e) => set({ text: e.target.value })} />
                )}
              </div>
            );
          })}
          <Checkbox label={doc.acceptance} checked={!!ticked[doc.id]} onChange={(v) => setTicked({ ...ticked, [doc.id]: v })} />
        </section>
      ))}
      <Field label={under18 ? "Parent or guardian's full name" : 'Your full name'} htmlFor="join-sign-name">
        <Input id="join-sign-name" autoComplete="name" value={signName} onChange={(e) => setSignName(e.target.value)} />
      </Field>
      <SignaturePad onChange={setSignature} label={under18 ? 'Parent or guardian signature' : 'Your signature'} />
      {msg && <p className="join-msg bad" role="alert">{msg}</p>}
      <div className="join-nav">
        {onBack ? <Button onClick={onBack} disabled={busy || backDisabled}>Back</Button> : <span />}
        <Button variant="primary" type="submit" disabled={busy}>{busy ? 'Saving…' : submitLabel}</Button>
      </div>
    </form>
  );
}
