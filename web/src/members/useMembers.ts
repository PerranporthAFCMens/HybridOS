import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  assignMembership,
  listMemberDirectory,
  listMemberMemberships,
  setMembershipStatus,
  updateMemberLifecycle,
} from '../data/members';
import { listPlans } from '../data/plans';

export function useMemberDirectory(gymId: string) {
  return useQuery({ queryKey: ['members', gymId], queryFn: () => listMemberDirectory(gymId) });
}

export function useMemberMemberships(gymId: string, userId: string) {
  return useQuery({ queryKey: ['member-memberships', gymId, userId], queryFn: () => listMemberMemberships(gymId, userId) });
}

export function usePlans(gymId: string) {
  return useQuery({ queryKey: ['today', 'plans', gymId], queryFn: () => listPlans(gymId) });
}

/** Writes refresh the directory, this member's memberships, and the Today figures. */
export function useMemberWrites(gymId: string, userId: string) {
  const qc = useQueryClient();
  const refresh = async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ['members', gymId] }),
      qc.invalidateQueries({ queryKey: ['member-memberships', gymId, userId] }),
      qc.invalidateQueries({ queryKey: ['today'] }),
    ]);
  };
  return {
    saveLifecycle: useMutation({
      mutationFn: (v: { joinedOn: string; attritionOn: string | null }) => updateMemberLifecycle({ gymId, userId, ...v }),
      onSuccess: refresh,
    }),
    setStatus: useMutation({
      mutationFn: (v: { membershipId: string; status: 'active' | 'paused' | 'cancelled' }) => setMembershipStatus({ gymId, ...v }),
      onSuccess: refresh,
    }),
    assign: useMutation({
      mutationFn: (v: { planId: string; status: 'active' | 'pending' | 'paused'; startsOn: string | null; payment: 'manual' | 'gocardless' }) =>
        assignMembership({ gymId, userId, ...v }),
      onSuccess: refresh,
    }),
  };
}
