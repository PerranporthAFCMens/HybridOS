import { useQuery } from '@tanstack/react-query';
import { getBlockResultRows } from '../data/benchmarkSettings';
import type { BlockBenchmark } from '../data/benchmarks';
import { groupMemberResults, progressFor } from '../train/benchmarkProgress';
import { pbValueText } from '../train/pb';

/** For the team, when the owner has switched it on: each member's start result, end result and change for every benchmark in the block. */
export function CoachBenchmarkResults({ blockId, gymId, today, list }: { blockId: string; gymId: string; today: string; list: BlockBenchmark[] }) {
  const q = useQuery({ queryKey: ['coach-benchmark-results', gymId, blockId], queryFn: () => getBlockResultRows(blockId), enabled: list.length > 0 });
  if (list.length === 0) return null;
  const people = groupMemberResults(q.data ?? []);
  return (
    <section aria-label="Member results">
      <h4 className="detail-heading">Member results</h4>
      {q.isPending && <p className="muted small">Loading results…</p>}
      {q.isError && <p className="muted small">Could not load the results. Go back and open the block again.</p>}
      {q.data && people.length === 0 && <p className="muted small">Nobody in this block has recorded a test yet. Members who have not recorded one are not listed.</p>}
      {people.length > 0 && list.map((b) => (
        <div key={b.id} role="group" aria-label={b.movementName}>
          <b>{b.movementName}</b>
          <ul className="team-list">
            {people.map((m) => {
              const p = progressFor(b, m.recorded, today);
              const read = (r: typeof p.start.reading) => (r ? pbValueText(r.metric, r.unit, r.value) : 'not yet');
              const change = p.change !== null && p.start.reading ? `${p.improved === null ? 'No change' : `${p.improved ? 'Better' : 'Worse'} by ${pbValueText(p.start.reading.metric, p.start.reading.unit, Math.abs(p.change))}`}` : '';
              return (
                <li className="team-item" key={m.userId}>
                  <div className="team-main"><b>{m.name}</b><div className="muted small">Start {read(p.start.reading)} · End {read(p.end.reading)}{change && ` · ${change}`}</div></div>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </section>
  );
}
