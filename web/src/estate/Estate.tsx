import { useQuery } from '@tanstack/react-query';
import { BASENAME } from '../app/site';
import { useReadyAuth } from '../auth/AuthProvider';
import { setSelectedGymId } from '../auth/gymStorage';
import { loadEstate } from '../data/estate';
import { DownloadButtons } from '../reports/DownloadButtons';
import { Button } from '../ui/Button';
import { Card, Empty } from '../ui/Card';
import { money } from '../today/calc';
import { NEW_MEMBER_DAYS, buildEstate, estateGyms, estateTable, runsEstate } from './calc';
import './estate.css';

/** One row per gym the person owns or administers, with a total. Looking only: changes are made inside each gym. */
export function Estate() {
  const { gym, gyms } = useReadyAuth();
  const mine = estateGyms(gyms);
  const q = useQuery({ queryKey: ['estate', mine.map((g) => g.gymId).join(',')], queryFn: () => loadEstate(mine), enabled: runsEstate(gyms) });
  if (!runsEstate(gyms)) {
    return (
      <div className="page">
        <h1>Estate</h1>
        <Card><Empty>The estate view is for owners and admins of two or more gyms.</Empty></Card>
      </div>
    );
  }
  const e = q.data ? buildEstate(q.data, new Date()) : null;
  const open = (gymId: string) => { setSelectedGymId(gymId); window.location.assign(`${BASENAME}/today`); };
  return (
    <div className="page">
      <h1>Estate</h1>
      <p className="muted">All your gyms side by side. To change anything, open the gym.</p>
      {q.isPending && <div className="muted">Loading…</div>}
      {q.isError && <div className="msg error" role="alert">Could not load the estate. Refresh to try again.</div>}
      {e && (
        <>
          <Card>
            <div className="est-total" aria-label="All gyms">
              <div><span>Members</span><b>{e.total.members}</b></div>
              <div><span>Active memberships</span><b>{e.total.activeMemberships}</b></div>
              <div><span>Estimated monthly income</span><b>{money(e.total.monthlyIncome)}</b></div>
              <div><span>New members ({NEW_MEMBER_DAYS} days)</span><b>{e.total.newMembers}</b></div>
              <div><span>Team</span><b>{e.total.staff}</b></div>
            </div>
          </Card>
          <div className="est-grid">
            {e.gyms.map((g) => (
              <Card key={g.gymId} aria-label={g.gymName}>
                <h2>{g.gymName}{g.gymId === gym.gymId ? ' (current)' : ''}</h2>
                <dl className="est-fig">
                  <div><dt>Members</dt><dd>{g.members}</dd></div>
                  <div><dt>Active memberships</dt><dd>{g.activeMemberships}</dd></div>
                  <div><dt>Monthly income</dt><dd>{money(g.monthlyIncome)}</dd></div>
                  <div><dt>New ({NEW_MEMBER_DAYS} days)</dt><dd>{g.newMembers}</dd></div>
                  <div><dt>Team</dt><dd>{g.staff}</dd></div>
                </dl>
                <Button onClick={() => open(g.gymId)}>Open {g.gymName}</Button>
              </Card>
            ))}
          </div>
          <DownloadButtons gymName="Estate" build={() => estateTable({ gymName: 'All gyms', now: new Date() }, e)} />
        </>
      )}
    </div>
  );
}
