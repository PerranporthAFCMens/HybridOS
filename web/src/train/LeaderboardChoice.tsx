import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useReadyAuth } from '../auth/AuthProvider';
import { getMyLiftChoice, getShowByDefault, setMyLiftChoice } from '../data/lifts';
import { choiceText, effectiveShow } from '../lifts/calc';
import { Checkbox } from '../ui/Field';

/** The member's own switch for the lift leaderboards. If they never chose, the gym's switch decides; saying so is part of the wording. */
export function LeaderboardChoice() {
  const { gym, userId } = useReadyAuth();
  const qc = useQueryClient();
  const mine = useQuery({ queryKey: ['m-lift-choice', gym.gymId, userId], queryFn: () => getMyLiftChoice(gym.gymId, userId) });
  const def = useQuery({ queryKey: ['m-lift-default', gym.gymId], queryFn: () => getShowByDefault(gym.gymId) });
  const [error, setError] = useState('');
  // The tick moves at once; it goes back only if saving fails.
  const [now, setNow] = useState<boolean | null>(null);
  if (mine.isPending || def.isPending) return <div className="muted small">Loading…</div>;
  const choice = now ?? mine.data ?? null;
  const showByDefault = def.data !== false;
  const change = async (on: boolean) => {
    setError('');
    setNow(on);
    try {
      await setMyLiftChoice(gym.gymId, userId, on);
      await qc.invalidateQueries({ queryKey: ['m-lift-choice'] });
      await qc.invalidateQueries({ queryKey: ['m-lift-board'] });
    } catch (e) {
      setNow(null);
      setError(e instanceof Error ? e.message : 'Could not save that.');
    }
  };
  return (
    <>
      <Checkbox label="Show me on the lift leaderboards" checked={effectiveShow(choice, showByDefault)} onChange={(on) => void change(on)} />
      <div className="muted small" role="status">{choiceText(choice, showByDefault)}</div>
      {error && <div className="mem-error" role="alert">{error}</div>}
    </>
  );
}
