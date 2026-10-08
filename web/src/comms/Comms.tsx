import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useReadyAuth } from '../auth/AuthProvider';
import { loadComms, removeLogo, saveSender, saveTemplate, uploadLogo, type CommsData } from '../data/comms';
import { Button } from '../ui/Button';
import { Card, Empty, SectionTitle } from '../ui/Card';
import { ColorInput, Field, FieldRow, FileInput, Input, Textarea } from '../ui/Field';
import { DEFAULT_TEMPLATE, checkLogoFile, fillTokens, senderFormFrom, senderStatusText, templateFormFrom, validateSender, validateTemplate, type SenderForm, type TemplateForm } from './calc';
import '../members/members.css';
import './comms.css';

type Note = { text: string; good: boolean } | null;

export function Comms() {
  const { gym } = useReadyAuth();
  const q = useQuery({ queryKey: ['comms', gym.gymId], queryFn: () => loadComms(gym.gymId) });
  return (
    <>
      <header className="page-top">
        <div>
          <div className="eyebrow">Messages and community</div>
          <h1>Communications</h1>
          <div className="muted">Control how your gym speaks to members, staff and administrators.</div>
        </div>
      </header>
      {q.isError && <Card><Empty>Could not load communications. Refresh to try again.</Empty></Card>}
      {q.isPending && <Card><Empty>Loading…</Empty></Card>}
      {q.isSuccess && <Panels key={gym.gymId} data={q.data} />}
    </>
  );
}

function Panels({ data }: { data: CommsData }) {
  const { gym } = useReadyAuth();
  const [tpl, setTpl] = useState<TemplateForm>(() => templateFormFrom(data.template));
  const [accent, setAccent] = useState<string>(() => senderFormFrom(data.sender, gym.gymName).accent);
  return (
    <div className="cx-grid">
      <div>
        <LogoCard url={data.logoUrl} />
        <SenderCard data={data} onAccent={setAccent} />
        <TemplateCard tpl={tpl} setTpl={setTpl} />
        <Card><SectionTitle title="Campaigns" /><p className="muted small">Newsletters, audiences and campaign results are planned. They will use a separate sending stream so promotional emails cannot affect sign-in and invitation emails.</p></Card>
      </div>
      <aside className="cx-preview">
        <Card>
          <SectionTitle title="Live preview: invitation email" />
          <div className="muted small">Sample recipient · Admin role</div>
          <div className="cx-email" aria-label="Preview of the invitation email">
            <div className="cx-head" style={{ background: accent }}>HybridOne</div>
            <div className="cx-body">
              <div className="muted small">Access invitation</div>
              <h3>{fillTokens(tpl.heading, gym.gymName)}</h3>
              <p>{fillTokens(tpl.body, gym.gymName)}</p>
              <span className="cx-button" style={{ background: accent }}>{tpl.button || DEFAULT_TEMPLATE.button}</span>
            </div>
            <div className="cx-foot muted small">System access invitation · {gym.gymName} · HybridOne</div>
          </div>
        </Card>
      </aside>
    </div>
  );
}

function LogoCard({ url }: { url: string | null }) {
  const { gym } = useReadyAuth();
  const qc = useQueryClient();
  const file = useRef<HTMLInputElement>(null);
  const [note, setNote] = useState<Note>(null);
  const [asking, setAsking] = useState(false);
  const refresh = async () => { await Promise.all([qc.invalidateQueries({ queryKey: ['comms', gym.gymId] }), qc.invalidateQueries({ queryKey: ['gyms'] })]); };
  const up = useMutation({ mutationFn: (f: File) => uploadLogo(gym.gymId, f), onSuccess: refresh });
  const rm = useMutation({ mutationFn: () => removeLogo(gym.gymId), onSuccess: refresh });
  const pick = (f: File | undefined) => {
    if (!f) return;
    setNote(null);
    const bad = checkLogoFile(f.type, f.size);
    if (bad) { setNote({ text: bad, good: false }); if (file.current) file.current.value = ''; return; }
    up.mutate(f, { onSuccess: () => setNote({ text: 'Logo saved. It now shows across your gym.', good: true }), onError: (e) => setNote({ text: e.message, good: false }), onSettled: () => { if (file.current) file.current.value = ''; } });
  };
  return (
    <Card>
      <SectionTitle title="Gym logo" />
      <p className="muted small">Upload once. It appears on your sign-in and join pages, the member portal, the gym chooser and your emails.</p>
      <div className="cx-logo">
        <div className="cx-logo-box">{url ? <img src={url} alt="Gym logo" /> : <span className="muted small">No logo yet</span>}</div>
        <div className="cx-logo-actions">
          <FileInput ref={file} aria-label="Choose a logo image" accept="image/png,image/jpeg,image/webp" disabled={up.isPending} onChange={(e) => pick(e.target.files?.[0])} />
          {url && !asking && <Button disabled={rm.isPending} onClick={() => { setNote(null); setAsking(true); }}>Remove logo</Button>}
          {asking && (
            <span className="cx-ask"><span className="small">Remove your gym logo?</span>
              <Button variant="primary" onClick={() => { setAsking(false); rm.mutate(undefined, { onSuccess: () => setNote({ text: 'Logo removed.', good: true }), onError: (e) => setNote({ text: e.message, good: false }) }); }}>Yes, remove</Button>
              <Button onClick={() => setAsking(false)}>Keep</Button></span>
          )}
        </div>
      </div>
      <div className="muted small">PNG, JPG or WebP, up to 2 MB. A wide logo on a transparent or white background works best.</div>
      {up.isPending && <div className="muted small" role="status">Uploading…</div>}
      {note && <div className={`msg ${note.good ? '' : 'error'}`} role={note.good ? 'status' : 'alert'}>{note.text}</div>}
    </Card>
  );
}

function SenderCard({ data, onAccent }: { data: CommsData; onAccent: (c: string) => void }) {
  const { gym } = useReadyAuth();
  const qc = useQueryClient();
  const [f, setF] = useState<SenderForm>(() => senderFormFrom(data.sender, gym.gymName));
  const [status, setStatus] = useState<string | null>(data.sender?.status ?? 'unverified');
  const [note, setNote] = useState<Note>(null);
  const save = useMutation({ mutationFn: (p: Parameters<typeof saveSender>[1]) => saveSender(gym.gymId, p), onSuccess: () => qc.invalidateQueries({ queryKey: ['comms', gym.gymId] }) });
  const set = <K extends keyof SenderForm>(k: K, v: SenderForm[K]) => { setNote(null); setF((x) => ({ ...x, [k]: v })); if (k === 'accent') onAccent(String(v)); if (k === 'from') setStatus('unverified'); };
  const submit = () => {
    const c = validateSender(f, gym.gymName);
    if (!c.ok) return setNote({ text: c.message, good: false });
    save.mutate(c.payload, {
      onSuccess: () => { setStatus(c.payload.sender_domain_status); setNote({ text: c.payload.sender_domain_status === 'verified' ? 'Sender details saved and ready to use.' : 'Sender details saved. This sending domain still needs verification.', good: true }); },
      onError: (e) => setNote({ text: e.message, good: false }),
    });
  };
  return (
    <Card>
      <SectionTitle title="Gym sender details" />
      <p className="muted small">For customer and member emails. The gym is the main brand, with a discreet "Powered by HybridOne" line that cannot be replaced.</p>
      <Field label="Email brand name" htmlFor="cx-name"><Input id="cx-name" maxLength={100} value={f.name} onChange={(e) => set('name', e.target.value)} /></Field>
      <FieldRow>
        <Field label="From email" htmlFor="cx-from"><Input id="cx-from" type="email" maxLength={254} placeholder="noreply@hybridone.co.uk" value={f.from} onChange={(e) => set('from', e.target.value)} /></Field>
        <Field label="Reply-to email (optional)" htmlFor="cx-reply"><Input id="cx-reply" type="email" maxLength={254} placeholder="Leave blank for no replies" value={f.replyTo} onChange={(e) => set('replyTo', e.target.value)} /></Field>
      </FieldRow>
      <div className="notice" role="status">{senderStatusText(f.from, status)}</div>
      <FieldRow>
        <Field label="Brand colour" htmlFor="cx-accent"><ColorInput id="cx-accent" value={f.accent} onChange={(e) => set('accent', e.target.value)} /></Field>
        <Field label="Logo link (optional)" htmlFor="cx-logo"><Input id="cx-logo" type="url" placeholder="https://" value={f.logoUrl} onChange={(e) => set('logoUrl', e.target.value)} /></Field>
      </FieldRow>
      <Field label="Optional member footer text" htmlFor="cx-footer"><Input id="cx-footer" maxLength={240} placeholder="Any extra gym-specific footer text" value={f.footer} onChange={(e) => set('footer', e.target.value)} /></Field>
      {note && <div className={`msg ${note.good ? '' : 'error'}`} role={note.good ? 'status' : 'alert'}>{note.text}</div>}
      <Button variant="primary" disabled={save.isPending} onClick={submit}>{save.isPending ? 'Saving…' : 'Save sender details'}</Button>
    </Card>
  );
}

function TemplateCard({ tpl, setTpl }: { tpl: TemplateForm; setTpl: (f: TemplateForm) => void }) {
  const { gym } = useReadyAuth();
  const [note, setNote] = useState<Note>(null);
  const [asking, setAsking] = useState(false);
  const save = useMutation({ mutationFn: (v: Parameters<typeof saveTemplate>[1]) => saveTemplate(gym.gymId, v) });
  const set = <K extends keyof TemplateForm>(k: K, v: string) => { setNote(null); setTpl({ ...tpl, [k]: v }); };
  const submit = () => {
    const c = validateTemplate(tpl);
    if (!c.ok) return setNote({ text: c.message, good: false });
    save.mutate(c.value, { onSuccess: () => setNote({ text: 'Access invitation template saved.', good: true }), onError: (e) => setNote({ text: e.message, good: false }) });
  };
  return (
    <Card>
      <SectionTitle title="Access invitation email" />
      <p className="muted small">Sent when your gym gives an owner, admin, staff member or coach access to HybridOne. HybridOne branding is deliberately prominent on these emails.</p>
      <div className="tags">{['{{gym_name}}', '{{invited_by}}', '{{role}}'].map((t) => <span className="tag" key={t}>{t}</span>)}</div>
      <Field label="Subject" htmlFor="cx-subject"><Input id="cx-subject" maxLength={180} value={tpl.subject} onChange={(e) => set('subject', e.target.value)} /></Field>
      <Field label="Preheader" htmlFor="cx-pre"><Input id="cx-pre" maxLength={220} value={tpl.preheader} onChange={(e) => set('preheader', e.target.value)} /></Field>
      <Field label="Heading" htmlFor="cx-heading"><Input id="cx-heading" maxLength={180} value={tpl.heading} onChange={(e) => set('heading', e.target.value)} /></Field>
      <Field label="Body" htmlFor="cx-body"><Textarea id="cx-body" maxLength={1600} value={tpl.body} onChange={(e) => set('body', e.target.value)} /></Field>
      <Field label="Button text" htmlFor="cx-button"><Input id="cx-button" maxLength={60} value={tpl.button} onChange={(e) => set('button', e.target.value)} /></Field>
      {asking && (
        <div className="notice cx-ask-row" role="alertdialog" aria-label="Confirm"><span>Put the HybridOne default wording into the boxes? You can review it before saving.</span>
          <Button variant="primary" onClick={() => { setAsking(false); setNote(null); setTpl({ ...DEFAULT_TEMPLATE }); }}>Yes, restore</Button><Button onClick={() => setAsking(false)}>Cancel</Button></div>
      )}
      {note && <div className={`msg ${note.good ? '' : 'error'}`} role={note.good ? 'status' : 'alert'}>{note.text}</div>}
      <div className="membership-actions">
        <Button variant="primary" disabled={save.isPending} onClick={submit}>{save.isPending ? 'Saving…' : 'Save template'}</Button>
        <Button onClick={() => setAsking(true)}>Restore HybridOne default</Button>
      </div>
    </Card>
  );
}
