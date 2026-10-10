import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useReadyAuth } from '../auth/AuthProvider';
import { gymSlug, listDocuments, listFlagged, listSignatures, publicPdfUrl, removeDocument, saveDocument, signedCopyUrl, uploadPdf, type SignatureRow, type SignupDoc } from '../data/signup';
import { Button } from '../ui/Button';
import { Card, Empty, SectionTitle } from '../ui/Card';
import { Checkbox, Field, FileInput, Input, Select, Textarea } from '../ui/Field';
import { Modal } from '../ui/Modal';
import { DEFAULT_ACCEPTANCE, KIND_LABEL, MAX_QUESTIONS, checkDraft, describeDoc, emptyDraft, joinLink, newQuestion, signerLine, toRpcQuestions, type DocDraft, type DocKind, type DocSource } from './calc';
import '../members/members.css';
import '../staff/staff.css';
import './signup.css';

const KINDS: DocKind[] = ['terms', 'waiver'];
const when = (iso: string) => new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London' });

function draftFrom(kind: DocKind, d: SignupDoc | undefined): DocDraft {
  if (!d) return emptyDraft(kind);
  return {
    title: d.title, source: d.source, body: d.body ?? '', acceptance: d.acceptance,
    file: d.source === 'pdf' && d.fileName ? { name: d.fileName, size: d.fileSize ?? 1, type: 'application/pdf' } : null,
    questions: d.questions.map((q) => ({ key: q.id, prompt: q.prompt, answerType: q.answerType === 'text' ? 'text' : 'yes_no', detailsIfYes: q.detailsIfYes, required: q.required, flagOnYes: q.flagOnYes })),
  };
}

/** Settings › Sign-up process: the terms and waiver new members read and sign, the questions they answer, and who has signed. */
export function SignupProcess() {
  const { gym } = useReadyAuth();
  const qc = useQueryClient();
  const docs = useQuery({ queryKey: ['signup-docs', gym.gymId], queryFn: () => listDocuments(gym.gymId) });
  const slug = useQuery({ queryKey: ['gym-slug', gym.gymId], queryFn: () => gymSlug(gym.gymId) });
  const sigs = useQuery({ queryKey: ['signup-signatures', gym.gymId], queryFn: () => listSignatures(gym.gymId) });
  const flagged = useQuery({ queryKey: ['signup-flagged', gym.gymId, sigs.data?.length ?? 0], queryFn: () => listFlagged(gym.gymId, sigs.data ?? []), enabled: !!sigs.data });
  const [editing, setEditing] = useState<DocKind | null>(null);
  const [note, setNote] = useState<{ text: string; good: boolean } | null>(null);
  const current = (k: DocKind) => docs.data?.find((d) => d.kind === k && d.isCurrent);
  const stop = useMutation({
    mutationFn: (k: DocKind) => removeDocument(gym.gymId, k),
    onSuccess: () => { setNote({ text: 'Members will no longer be asked to sign it. Anyone who already signed keeps their record.', good: true }); return qc.invalidateQueries({ queryKey: ['signup-docs', gym.gymId] }); },
    onError: (e) => setNote({ text: e instanceof Error ? e.message : 'Could not do that.', good: false }),
  });
  const link = slug.data ? joinLink(window.location.origin, slug.data) : '';
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setNote({ text: 'Link copied.', good: true });
    } catch {
      setNote({ text: 'Could not copy. Select the link and copy it.', good: false });
    }
  };

  return (
    <>
      <header className="page-top">
        <div>
          <div className="eyebrow">Settings and staff</div>
          <h1>Sign-up process</h1>
          <div className="muted">What new members read, answer and sign before they join {gym.gymName}.</div>
        </div>
      </header>
      {note && <p className={`signup-note ${note.good ? 'good' : 'bad'}`} role={note.good ? 'status' : 'alert'}>{note.text}</p>}

      <Card>
        <SectionTitle title="Your sign-up link" action={link ? <Button onClick={() => void copy()}>Copy link</Button> : undefined} />
        <p className="muted">Send this to new members. They create an account, give their details, sign your documents and choose a membership.</p>
        <p className="signup-link">{link || 'Loading…'}</p>
      </Card>

      {docs.isError && <Card><Empty>Could not load your documents. Refresh to try again.</Empty></Card>}
      {KINDS.map((k) => {
        const d = current(k);
        return (
          <Card key={k}>
            <SectionTitle title={KIND_LABEL[k]} />
            {!d ? (
              <>
                <p className="muted">Not set up. New members are not asked to sign a {k === 'terms' ? 'terms and conditions document' : 'waiver'}.</p>
                <Button variant="primary" onClick={() => setEditing(k)}>Set up {KIND_LABEL[k].toLowerCase()}</Button>
              </>
            ) : (
              <>
                <p><b>{d.title}</b></p>
                <p className="muted">{describeDoc(d, d.questions.length)}. Added {when(d.uploadedAt)}.</p>
                <p className="muted">Tick-box: “{d.acceptance}”</p>
                {d.source === 'pdf' && d.filePath && <p><a href={publicPdfUrl(d.filePath)} target="_blank" rel="noreferrer">Open the PDF ({d.fileName})</a></p>}
                {d.questions.length > 0 && (
                  <ol className="signup-qs">{d.questions.map((q) => <li key={q.id}>{q.prompt}{q.flagOnYes ? ' (flagged to staff if yes)' : ''}</li>)}</ol>
                )}
                <div className="signup-actions">
                  <Button variant="primary" onClick={() => setEditing(k)}>Change {KIND_LABEL[k].toLowerCase()}</Button>
                  <Button disabled={stop.isPending} onClick={() => { if (window.confirm(`Stop asking new members to sign the ${KIND_LABEL[k].toLowerCase()}?`)) stop.mutate(k); }}>Stop requiring it</Button>
                </div>
                <p className="muted small">Changing it creates a new version. Members who already signed keep their signed copy of the old one.</p>
              </>
            )}
          </Card>
        );
      })}

      <Card>
        <SectionTitle title="Answers to look at" />
        {flagged.data && flagged.data.length > 0 ? (
          <ul className="settings-list">
            {flagged.data.map((f, i) => (
              <li key={`${f.signatureId}-${i}`}><div><b>{f.member}</b><div className="muted">{f.prompt}: yes{f.details ? ` (${f.details})` : ''}</div></div><span className="muted">{when(f.signedAt)}</span></li>
            ))}
          </ul>
        ) : <Empty>Nothing flagged. Questions you mark “show staff when yes” appear here.</Empty>}
      </Card>

      <Card>
        <SectionTitle title="Who has signed" />
        {sigs.isError && <Empty>Could not load signatures. Refresh to try again.</Empty>}
        {sigs.data && sigs.data.length === 0 && <Empty>No one has signed yet.</Empty>}
        {sigs.data && sigs.data.length > 0 && (
          <ul className="settings-list">
            {sigs.data.map((s) => <SignatureItem key={s.id} s={s} onProblem={(text) => setNote({ text, good: false })} />)}
          </ul>
        )}
      </Card>

      {editing && (
        <Editor key={editing} gymId={gym.gymId} kind={editing} existing={current(editing)} onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); setNote({ text: `${KIND_LABEL[editing]} saved. New members will see it from now on.`, good: true }); void qc.invalidateQueries({ queryKey: ['signup-docs', gym.gymId] }); }} />
      )}
    </>
  );
}

function SignatureItem({ s, onProblem }: { s: SignatureRow; onProblem: (text: string) => void }) {
  const open = async (path: string) => {
    try {
      window.open(await signedCopyUrl(path), '_blank', 'noopener');
    } catch (e) {
      onProblem(e instanceof Error ? e.message : 'Could not open the signed copy.');
    }
  };
  const versions = [s.termsVersion != null ? `terms v${s.termsVersion}` : '', s.waiverVersion != null ? `waiver v${s.waiverVersion}` : ''].filter(Boolean).join(', ');
  return (
    <li>
      <div>
        <b>{s.name}</b>
        <div className="muted">Signed by {signerLine({ signerName: s.signerName, isGuardian: s.isGuardian }, s.name)}, {when(s.signedAt)} ({versions})</div>
        <div className="muted small">{s.emailedAt ? `Copy emailed ${when(s.emailedAt)}.` : s.emailError ? `Email failed: ${s.emailError}` : 'Signed copy not emailed yet.'}</div>
      </div>
      <div className="signup-actions">
        {s.termsPath && <Button onClick={() => void open(s.termsPath ?? '')}>Terms copy</Button>}
        {s.waiverPath && <Button onClick={() => void open(s.waiverPath ?? '')}>Waiver copy</Button>}
      </div>
    </li>
  );
}

function Editor({ gymId, kind, existing, onClose, onSaved }: { gymId: string; kind: DocKind; existing: SignupDoc | undefined; onClose: () => void; onSaved: () => void }) {
  const [d, setD] = useState<DocDraft>(() => draftFrom(kind, existing));
  const [newFile, setNewFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [counter, setCounter] = useState(0);
  const save = useMutation({
    mutationFn: async () => {
      let filePath: string | null = null;
      let fileName: string | null = null;
      let fileSize: number | null = null;
      if (d.source === 'pdf') {
        if (newFile) {
          filePath = await uploadPdf(gymId, kind, newFile);
          fileName = newFile.name;
          fileSize = newFile.size;
        } else if (existing?.source === 'pdf' && existing.filePath) {
          filePath = existing.filePath;
          fileName = existing.fileName;
          fileSize = existing.fileSize;
        }
      }
      await saveDocument({
        gymId, kind, title: d.title, source: d.source, filePath, fileName, fileSize,
        body: d.source === 'text' ? d.body : null, acceptance: d.acceptance, questions: toRpcQuestions(d.questions),
      });
    },
    onSuccess: onSaved,
    onError: (e) => setError(e instanceof Error ? e.message : 'Could not save that.'),
  });
  const set = (patch: Partial<DocDraft>) => { setError(null); setD((x) => ({ ...x, ...patch })); };
  const setQ = (i: number, patch: Partial<DocDraft['questions'][number]>) => set({ questions: d.questions.map((q, j) => (j === i ? { ...q, ...patch } : q)) });
  const move = (i: number, by: -1 | 1) => {
    const j = i + by;
    if (j < 0 || j >= d.questions.length) return;
    const qs = [...d.questions];
    [qs[i], qs[j]] = [qs[j] as typeof qs[number], qs[i] as typeof qs[number]];
    set({ questions: qs });
  };
  const submit = () => {
    const problem = checkDraft(d);
    if (problem) return setError(problem);
    setError(null);
    save.mutate();
  };
  return (
    <Modal title={`${existing ? 'Change' : 'Set up'} ${KIND_LABEL[kind].toLowerCase()}`} onClose={onClose}>
      <h2>{existing ? 'Change' : 'Set up'} {KIND_LABEL[kind].toLowerCase()}</h2>
      <Field label="Title" htmlFor="doc-title"><Input id="doc-title" value={d.title} onChange={(e) => set({ title: e.target.value })} /></Field>
      <Field label="How do you want to add it?" htmlFor="doc-source">
        <Select id="doc-source" value={d.source} onChange={(e) => set({ source: (e.target.value === 'pdf' ? 'pdf' : 'text') as DocSource })}>
          <option value="text">Type or paste the wording</option>
          <option value="pdf">Upload a PDF</option>
        </Select>
      </Field>
      {d.source === 'text' ? (
        <Field label="Wording" htmlFor="doc-body" hint="Members read this on screen, and it is printed into their signed copy.">
          <Textarea id="doc-body" rows={10} value={d.body} onChange={(e) => set({ body: e.target.value })} />
        </Field>
      ) : (
        <Field label="PDF" htmlFor="doc-file" hint={d.file ? `Current file: ${d.file.name}. Choose another to replace it.` : 'Up to 10 MB.'}>
          <FileInput id="doc-file" accept="application/pdf,.pdf" onChange={(e) => { const f = e.target.files?.[0] ?? null; setNewFile(f); set({ file: f ? { name: f.name, size: f.size, type: f.type } : d.file }); }} />
        </Field>
      )}
      <Field label="Tick-box sentence" htmlFor="doc-accept" hint="What the member ticks to agree. It is saved with their signature.">
        <Input id="doc-accept" value={d.acceptance} onChange={(e) => set({ acceptance: e.target.value })} placeholder={DEFAULT_ACCEPTANCE} />
      </Field>

      <h3>Questions (optional)</h3>
      <p className="muted small">For example a health questionnaire. Members must answer before they can sign. Answers are only visible to the member and your owners, admins and staff.</p>
      {d.questions.map((q, i) => (
        <div key={q.key} className="signup-q">
          <Field label={`Question ${i + 1}`} htmlFor={`q-${q.key}`}><Input id={`q-${q.key}`} value={q.prompt} onChange={(e) => setQ(i, { prompt: e.target.value })} /></Field>
          <Field label="Answer" htmlFor={`qt-${q.key}`}>
            <Select id={`qt-${q.key}`} value={q.answerType} onChange={(e) => setQ(i, { answerType: e.target.value === 'text' ? 'text' : 'yes_no' })}>
              <option value="yes_no">Yes or no</option>
              <option value="text">Written answer</option>
            </Select>
          </Field>
          <Checkbox label="Must be answered" checked={q.required} onChange={(v) => setQ(i, { required: v })} />
          {q.answerType === 'yes_no' && <Checkbox label="Ask for details if yes" checked={q.detailsIfYes} onChange={(v) => setQ(i, { detailsIfYes: v })} />}
          {q.answerType === 'yes_no' && <Checkbox label="Show staff when the answer is yes" checked={q.flagOnYes} onChange={(v) => setQ(i, { flagOnYes: v })} />}
          <div className="signup-actions">
            <Button disabled={i === 0} onClick={() => move(i, -1)}>Move up</Button>
            <Button disabled={i === d.questions.length - 1} onClick={() => move(i, 1)}>Move down</Button>
            <Button onClick={() => set({ questions: d.questions.filter((_, j) => j !== i) })}>Remove</Button>
          </div>
        </div>
      ))}
      <Button disabled={d.questions.length >= MAX_QUESTIONS} onClick={() => { setCounter(counter + 1); set({ questions: [...d.questions, newQuestion(`new-${counter}`)] }); }}>Add a question</Button>

      {error && <p className="signup-note bad" role="alert">{error}</p>}
      <div className="signup-actions signup-footer">
        <Button onClick={onClose} disabled={save.isPending}>Cancel</Button>
        <Button variant="primary" onClick={submit} disabled={save.isPending}>{save.isPending ? 'Saving…' : 'Save'}</Button>
      </div>
      {existing && <p className="muted small">Saving creates a new version. New members sign the new one; people who already signed are not asked again.</p>}
    </Modal>
  );
}
