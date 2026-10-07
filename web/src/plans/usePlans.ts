import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createPlan, listPlanDetails, setPlanActive, updatePlan, type PlanInput } from '../data/plans';

export function usePlanDetails(gymId: string) {
  return useQuery({ queryKey: ['plans', gymId], queryFn: () => listPlanDetails(gymId) });
}

/** Writes refresh this list, the Today figures and the plan choices in a member's record. */
export function usePlanWrites(gymId: string) {
  const qc = useQueryClient();
  const refresh = async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ['plans', gymId] }),
      qc.invalidateQueries({ queryKey: ['today'] }),
    ]);
  };
  return {
    save: useMutation({
      mutationFn: (v: { planId: string | null; input: PlanInput }) =>
        v.planId ? updatePlan(gymId, v.planId, v.input) : createPlan(gymId, v.input),
      onSuccess: refresh,
    }),
    toggle: useMutation({
      mutationFn: (v: { planId: string; isActive: boolean }) => setPlanActive(gymId, v.planId, v.isActive),
      onSuccess: refresh,
    }),
  };
}
