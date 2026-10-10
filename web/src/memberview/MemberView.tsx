import { siteUrl } from '../app/site';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useReadyAuth } from '../auth/AuthProvider';
import { loadMemberView, saveMemberView, type MemberViewSaved } from '../data/memberView';
import { Button, LinkButton } from '../ui/Button';
import { Card, Empty, SectionTitle } from '../ui/Card';
import { Checkbox, Field, FieldRow, Input, Select, Textarea } from '../ui/Field';
import { DEFAULT_LAYOUT, TARGETS, TILES, moveTile, setVisible, tileTitle, validateCta, type Cta, type TileSetting } from './calc';
import '../members/members.css';
import './memberview.css';

export function MemberView() {
  const { gym } = useReadyAuth();
  const q = useQuery({ queryKey: ['member-view', gym.gymId], queryFn: () => loadMemberView(gym.gymId) });
  return (
    <>
      <header className="page-top">
        <div>
          <div className="eyebrow">Settings and staff</div>
          <h1>What members see</h1>
          <div className="muted">Choose and order the tiles on the member home screen, and write the promo panel at the top. Changes apply to the live member app.</div>
        </div>
      </header>
      {q.isError && <Card><Empty>Could not load the member view. Refresh to try again.</Empty></Card>}
      {q.isPending && <Card><Empty>Loading…</Empty></Card>}
      {q.isSuccess && <Editor key={gym.gymId} saved={q.data} />}
    </>
  );
}

function Editor({ saved }: { saved: MemberViewSaved }) {
  const { gym, userId } = useReadyAuth();
  const qc = useQueryClient();
  const [layout, setLayout] = useState<TileSetting[]>(saved.layout);
  const [cta, setCta] = useState<Cta>(saved.cta);
  const [note, setNote] = useState<{ text: string; good: boolean } | null>(null);
  const save = useMutation({
    mutationFn: (v: MemberViewSaved) => saveMemberView(gym.gymId, userId, v),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['member-view', gym.gymId] }),
  });
  const touch = () => setNote(null);
  const setC = <K extends keyof Cta>(k: K, v: Cta[K]) => { touch(); setCta((c) => ({ ...c, [k]: v })); };

  const submit = () => {
    const check = validateCta(cta);
    if (!check.ok) return setNote({ text: check.message, good: false });
    save.mutate({ layout, cta: check.cta }, {
      onSuccess: () => setNote({ text: 'Saved. The member home now uses this order and promo.', good: true }),
      onError: (e) => setNote({ text: e.message, good: false }),
    });
  };

  return (
    <div className="mv-grid">
      <Card>
        <SectionTitle title="Home screen tiles" />
        <ul className="mv-tiles">
          {layout.map((t, i) => (
            <li key={t.key} className="mv-tile">
              <div className="mv-name"><b>{TILES[t.key]?.label}</b><span className="muted small">{TILES[t.key]?.desc}</span></div>
              <Checkbox label="Show" checked={t.visible} onChange={(on) => { touch(); setLayout((l) => setVisible(l, t.key, on)); }} />
              <div className="mv-move">
                <Button aria-label={`Move ${TILES[t.key]?.label} up`} disabled={i === 0} onClick={() => { touch(); setLayout((l) => moveTile(l, t.key, -1)); }}>Up</Button>
                <Button aria-label={`Move ${TILES[t.key]?.label} down`} disabled={i === layout.length - 1} onClick={() => { touch(); setLayout((l) => moveTile(l, t.key, 1)); }}>Down</Button>
              </div>
            </li>
          ))}
        </ul>

        <SectionTitle title="Promo panel at the top" />
        <p className="muted small">The full-width panel at the top of the member home. Use it for what matters most to members right now.</p>
        <Checkbox label="Show the promo panel" checked={cta.enabled} onChange={(on) => setC('enabled', on)} />
        <FieldRow>
          <Field label="Small label" htmlFor="cta-eyebrow"><Input id="cta-eyebrow" maxLength={60} value={cta.eyebrow} onChange={(e) => setC('eyebrow', e.target.value)} /></Field>
          <Field label="Headline" htmlFor="cta-title"><Input id="cta-title" maxLength={120} value={cta.title} onChange={(e) => setC('title', e.target.value)} /></Field>
        </FieldRow>
        <Field label="Supporting text" htmlFor="cta-body"><Textarea id="cta-body" maxLength={300} value={cta.body} onChange={(e) => setC('body', e.target.value)} /></Field>
        <FieldRow>
          <Field label="First button label" htmlFor="cta-p-label"><Input id="cta-p-label" maxLength={40} value={cta.primary_label} onChange={(e) => setC('primary_label', e.target.value)} /></Field>
          <Field label="First button goes to" htmlFor="cta-p-target">
            <Select id="cta-p-target" value={cta.primary_target} onChange={(e) => setC('primary_target', e.target.value)}>
              {TARGETS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </Select>
          </Field>
        </FieldRow>
        {cta.primary_target === 'external' && <Field label="First button link" htmlFor="cta-p-url"><Input id="cta-p-url" type="url" placeholder="https://" value={cta.primary_url} onChange={(e) => setC('primary_url', e.target.value)} /></Field>}
        <FieldRow>
          <Field label="Second button label" htmlFor="cta-s-label"><Input id="cta-s-label" maxLength={40} value={cta.secondary_label} onChange={(e) => setC('secondary_label', e.target.value)} /></Field>
          <Field label="Second button goes to" htmlFor="cta-s-target">
            <Select id="cta-s-target" value={cta.secondary_target} onChange={(e) => setC('secondary_target', e.target.value)}>
              <option value="">No second button</option>
              {TARGETS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </Select>
          </Field>
        </FieldRow>
        {cta.secondary_target === 'external' && <Field label="Second button link" htmlFor="cta-s-url"><Input id="cta-s-url" type="url" placeholder="https://" value={cta.secondary_url} onChange={(e) => setC('secondary_url', e.target.value)} /></Field>}

        {note && <div className={`msg ${note.good ? '' : 'error'}`} role={note.good ? 'status' : 'alert'}>{note.text}</div>}
        <div className="membership-actions">
          <Button variant="primary" disabled={save.isPending} onClick={submit}>{save.isPending ? 'Saving…' : 'Save member view'}</Button>
          <Button onClick={() => { setNote({ text: 'Order reset here only. Press Save member view to publish it.', good: true }); setLayout(DEFAULT_LAYOUT.map((t) => ({ ...t }))); }}>Reset order</Button>
          <LinkButton href={`${siteUrl('member.html')}?view=member`}>View as member</LinkButton>
        </div>
      </Card>

      <div className="mv-phone" aria-label="Preview of the member home">
        <div className="mv-screen">
          <div className="mv-top"><span className="muted small">MEMBER HOME</span><b>{gym.gymName}</b></div>
          {layout.map((t) => (
            <div key={t.key} className={`mv-mini${t.visible ? '' : ' off'}${t.key === 'hero' ? ' hero' : ''}`} data-tile={t.key}>
              <b>{tileTitle(t.key, cta)}</b>
              {t.key === 'hero' && !cta.enabled && <span className="muted small">Promo panel hidden</span>}
              <i /><i />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
