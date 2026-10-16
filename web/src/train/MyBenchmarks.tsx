import { useQuery } from '@tanstack/react-query';
import { useReadyAuth } from '../auth/AuthProvider';
import { getMyBenchmarks } from '../data/memberBenchmarks';
import { blockState } from '../classes/blocks';
import { dayLabel } from '../member/calc';
import { pbValueText } from './pb';
import { progressFor, type TestProgress } from './benchmarkProgress';

interface Block { id: string; name: string; startsOn: string; weeks: number }

function testText(t: TestProgress, name: string): string {
  if (t.reading) return pbValueText(t.reading.metric, t.reading.unit, t.reading.value);
  if (t.state === 'soon') return `Opens ${dayLabel(t.day)}`;
  if (t.state === 'open') return `Open now: record ${name}`;
  return 'Not recorded';
}

/** On the Workouts tab: how the member is doing on the movements their class blocks test. Their own results only. */
export function MyBenchmarks({ blocks, today }: { blocks: Block[]; today: string }) {
  const { gym, userId } = useReadyAuth();
  const live = blocks.filter((b) => blockState(b.startsOn, b.weeks, today).state !== 'upcoming');
  const q = useQuery({ queryKey: ['m-benchmarks', gym.gymId, userId, live.map((b) => b.id).join(',')], queryFn: () => getMyBenchmarks(userId, gym.gymId, live), enabled: live.length > 0 });
  const sets = q.data ?? [];
  if (sets.length === 0) return null;
  return (
    <section className="mem-card" aria-label="Block benchmarks">
      <h2>Your progress</h2>
      <div className="muted small">Tested at the start and end of a block. Only you see these.</div>
      {sets.map((s) => {
        const block = live.find((b) => b.id === s.blockId);
        if (!block) return null;
        const st = blockState(block.startsOn, block.weeks, today);
        return (
          <div key={s.blockId} role="group" aria-label={block.name}>
            <div className="mem-row tr-block-head"><b>{block.name}</b><span className="muted small">{st.state === 'finished' ? `${block.weeks} weeks, finished` : `Week ${st.week} of ${block.weeks}`}</span></div>
            {s.defs.map((d) => {
              const p = progressFor(d, s.recorded, today);
              return (
                <div className="mem-line" key={d.id}>
                  <div>
                    <b>{d.movementName}</b>
                    <div className="muted small">Start: {testText(p.start, d.movementName)}</div>
                    <div className="muted small">End: {testText(p.end, d.movementName)}</div>
                  </div>
                  {p.change !== null && p.start.reading && (
                    <span className={`mem-tag${p.improved ? ' new' : ''}`}>{p.improved === null ? 'No change' : `${p.improved ? 'Better' : 'Worse'} by ${pbValueText(p.start.reading.metric, p.start.reading.unit, Math.abs(p.change))}`}</span>
                  )}
                </div>
              );
            })}
          </div>
        );
      })}
    </section>
  );
}
