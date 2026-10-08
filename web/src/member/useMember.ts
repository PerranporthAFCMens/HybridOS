import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { londonParts } from '../classes/calc';
import { useReadyAuth } from '../auth/AuthProvider';
import { countMyWorkouts, getMyPlan, listMyClasses, listMyPt, type ClassRow, type MyPlan, type PtRow } from '../data/member';
import { flagsFor, weekStartInstant, type Flags } from './calc';

export interface MemberCtx {
  classes: { data: ClassRow[]; isPending: boolean; isError: boolean };
  pt: PtRow[];
  plan: MyPlan | null;
  flags: Flags;
  workoutsThisWeek: number;
  today: string;
  now: Date;
}

/** Everything the member screens share, loaded once for the signed-in member and the selected gym. */
export function useMemberData(): MemberCtx {
  const { gym, userId } = useReadyAuth();
  const now = useMemo(() => new Date(), []);
  const today = londonParts(now).date;
  const classes = useQuery({ queryKey: ['m-classes', gym.gymId], queryFn: () => listMyClasses(gym.gymId, now, new Date(now.getTime() + 28 * 86400000)) });
  const plan = useQuery({ queryKey: ['m-plan', gym.gymId, userId], queryFn: () => getMyPlan(userId, gym.gymId) });
  const pt = useQuery({ queryKey: ['m-pt', gym.gymId, userId], queryFn: () => listMyPt(userId, gym.gymId, now) });
  const week = useQuery({ queryKey: ['m-week', gym.gymId, userId, today], queryFn: () => countMyWorkouts(userId, gym.gymId, weekStartInstant(today)) });
  const ptRows = pt.data ?? [];
  return {
    classes: { data: classes.data ?? [], isPending: classes.isPending, isError: classes.isError },
    pt: ptRows,
    plan: plan.data ?? null,
    flags: flagsFor(plan.data ?? null, ptRows.length > 0),
    workoutsThisWeek: week.data ?? 0,
    today,
    now,
  };
}
