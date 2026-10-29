import { useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useReadyAuth } from '../auth/AuthProvider';
import { listTargets, saveTarget, type TargetRow } from '../data/targets';
import type { LibraryData } from '../data/reportLibrary';
import { Button } from '../ui/Button';
import { Card, Empty, SectionTitle } from '../ui/Card';
import { Field, Input } from '../ui/Field';
import { GYM_METRICS, STAFF_METRICS, gymProgress, parseTarget, staffProgress, targetInput, type MetricInfo, type Progress } from './targets';
import { useLibraryData } from './useReports';

export function ProgressBar({ p }: { p: Progress }): ReactNode {
  return (
    <div className="target-progress">
      <div className="target-progress-text"><span>{p.label}</span><b>{p.doneText} of {p.targetText} ({p.pct}%)</b></div>
      <div className="track" role="progressbar" aria-label={`${p.label}: ${p.pct}% of the goal`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(100, p.pct)}>
        <span className="fill" style={{ width: `${Math.min(100, p.pct)}%` }} />
      </div>
    </div>
  );
}

function TargetBox({ info, who, whoName, existing }: { info: MetricInfo; who: string; whoName: string; existing: TargetRow | undefined }) {
  const { gym } = useReadyAuth();
  const qc = useQueryClient();
  const initial = targetInput(info.key, existing?.value);
  const [typed, setTyped] = useState(initial);
  const [message, setMessage] = useState('');
  const id = `target-${who || 'gym'}-${info.key}`;
  const save = useMutation({
    mutationFn: (value: number | null) => saveTarget(gym.gymId, who, info.key, value, existing?.id),
    onSuccess: async () => { setMessage('Saved.'); await qc.invalidateQueries({ queryKey: ['targets', gym.gymId] }); },
    onError: (e: Error) => setMessage(e.message),
  });
  const submit = () => {
    const v = parseTarget(info.key, typed);
    if (v === 'bad') { setMessage('Enter a whole number, or leave it empty for no goal.'); return; }
    setMessage('');
    save.mutate(v);
  };
  return (
    <div className="target-edit">
      <Field label={`${info.label}${whoName ? ` for ${whoName}` : ''} (${info.unit})`} htmlFor={id} error={message && message !== 'Saved.' ? message : null} hint={message === 'Saved.' ? 'Saved.' : undefined}>
        <Input id={id} inputMode="decimal" value={typed} onChange={(e) => { setTyped(e.target.value); setMessage(''); }} placeholder="No goal" />
      </Field>
      <Button onClick={submit} disabled={save.isPending || typed === initial}>Save<span className="visually-hidden"> {info.label}{whoName ? ` for ${whoName}` : ''}</span></Button>
    </div>
  );
}

/** Targets: set a monthly goal for the gym and for each staff member, and see how this month is going. */
export function Targets() {
  const { gym } = useReadyAuth();
  const t = useQuery({ queryKey: ['targets', gym.gymId], queryFn: () => listTargets(gym.gymId) });
  const lib = useLibraryData(gym.gymId, 90, true);
  if (t.isPending || lib.isPending) return <Card><Empty>Loading…</Empty></Card>;
  if (t.isError || lib.isError) return <Card><Empty>Could not load targets. Refresh to try again.</Empty></Card>;
  return <TargetsBody d={lib.data} targets={t.data} />;
}

function TargetsBody({ d, targets }: { d: LibraryData; targets: TargetRow[] }) {
  const now = new Date();
  const team = d.staff.filter((s) => s.role === 'coach' || s.role === 'staff' || s.role === 'admin');
  const find = (userId: string, metric: string) => targets.find((x) => x.userId === userId && x.metric === metric);
  const gymRows = gymProgress(d, now, targets);
  return (
    <>
      <p className="muted">Goals are monthly and repeat every month until you change them. Leave a box empty for no goal.</p>
      <Card>
        <SectionTitle title="The gym, this month" />
        {gymRows.length === 0 ? <Empty>No gym goals yet. Set one below.</Empty> : gymRows.map((p) => <ProgressBar key={p.metric} p={p} />)}
        <div className="target-grid">
          {GYM_METRICS.map((m) => <TargetBox key={m.key} info={m} who="" whoName="" existing={find('', m.key)} />)}
        </div>
      </Card>
      {team.length === 0 ? <Card><Empty>No coaches or staff yet.</Empty></Card> : team.map((s) => {
        const rows = staffProgress(d, s.userId, now, targets);
        return (
          <Card key={s.userId} aria-label={s.name}>
            <SectionTitle title={s.name} action={<span className="muted">{s.jobTitle || s.role}</span>} />
            {rows.length === 0 ? <p className="muted">No goals set for {s.name}.</p> : rows.map((p) => <ProgressBar key={p.metric} p={p} />)}
            <div className="target-grid">
              {STAFF_METRICS.map((m) => <TargetBox key={m.key} info={m} who={s.userId} whoName={s.name} existing={find(s.userId, m.key)} />)}
            </div>
          </Card>
        );
      })}
    </>
  );
}
