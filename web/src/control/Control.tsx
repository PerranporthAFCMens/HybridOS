import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { BASENAME } from '../app/site';
import { listAddons, listAudit, listControlGyms, setGymAddon } from '../data/control';
import { ukDateTime } from '../reports/calc';
import { Button } from '../ui/Button';
import { Card, Empty } from '../ui/Card';
import { Checkbox } from '../ui/Field';
import { addonStates, auditLine, newestFirst, offSummary, type ControlGym } from './calc';
import './control.css';

/** HybridOne Control: for the HybridOne team only. The database refuses anyone else, so a refusal is shown as "not allowed". */
export function Control() {
  const gyms = useQuery({ queryKey: ['control-gyms'], queryFn: listControlGyms, retry: false });
  const addons = useQuery({ queryKey: ['control-addons'], queryFn: listAddons, retry: false });
  const audit = useQuery({ queryKey: ['control-audit'], queryFn: () => listAudit(100), retry: false, enabled: gyms.isSuccess });
  const [openId, setOpenId] = useState<string | null>(null);
  const qc = useQueryClient();
  const toggle = useMutation({
    mutationFn: (v: { gymId: string; key: string; enabled: boolean }) => setGymAddon(v.gymId, v.key, v.enabled),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['control-gyms'] }); void qc.invalidateQueries({ queryKey: ['control-audit'] }); },
  });

  const header = (
    <header className="page-top">
      <div>
        <div className="eyebrow">HybridOne team</div>
        <h1>HybridOne Control</h1>
        <div className="muted">Every gym, and which parts of HybridOne each one has.</div>
      </div>
      <a className="btn" href={`${BASENAME}/today`}>Back to the admin</a>
    </header>
  );

  if (gyms.isPending || addons.isPending) return <div className="page">{header}<div className="muted">Loading…</div></div>;
  if (gyms.isError || addons.isError) {
    return <div className="page">{header}<Card><Empty>This area is not allowed for your account.</Empty></Card></div>;
  }

  const catalogue = addons.data;
  const gymNames = new Map(gyms.data.map((g) => [g.gymId, g.name]));
  const addonNames = new Map(catalogue.map((a) => [a.key, a.name]));
  const open: ControlGym | undefined = gyms.data.find((g) => g.gymId === openId);

  return (
    <div className="page">
      {header}
      {toggle.isError && <div className="msg error" role="alert">{toggle.error instanceof Error ? toggle.error.message : 'That change did not save.'}</div>}
      {open ? (
        <Card aria-label={open.name}>
          <h2>{open.name}</h2>
          <p className="muted">{open.members} members · {open.ownerEmail || 'no owner email'}</p>
          <div className="ctl-addons">
            {addonStates(catalogue, open).map((a) => (
              <div key={a.key} className="ctl-addon">
                <Checkbox label={a.name} checked={a.on} disabled={a.locked || toggle.isPending} onChange={(on) => toggle.mutate({ gymId: open.gymId, key: a.key, enabled: on })} />
                <div className="muted small">{a.locked ? 'Always on. ' : ''}{a.description}</div>
              </div>
            ))}
          </div>
          <Button onClick={() => setOpenId(null)}>Back to all gyms</Button>
        </Card>
      ) : (
        <div className="ctl-gyms">
          {gyms.data.length === 0 && <Card><Empty>No gyms yet.</Empty></Card>}
          {gyms.data.map((g) => (
            <Card key={g.gymId} aria-label={g.name}>
              <h2>{g.name}</h2>
              <p className="muted small">{g.members} members · {g.ownerEmail || 'no owner email'}</p>
              <p className="small">{offSummary(catalogue, g)}</p>
              <Button onClick={() => setOpenId(g.gymId)}>Manage {g.name}</Button>
            </Card>
          ))}
        </div>
      )}
      <Card aria-label="Recent changes">
        <h2>Recent changes</h2>
        {audit.isError && <Empty>Could not load the log.</Empty>}
        {audit.data && audit.data.length === 0 && <Empty>Nothing has been changed yet.</Empty>}
        <ul className="ctl-log">
          {newestFirst(audit.data ?? []).map((e) => (
            <li key={e.id}><span>{auditLine(e, gymNames, addonNames)}</span><span className="muted small">{ukDateTime(e.at)}</span></li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
