import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  listMemberDirectory,
  listMemberMemberships,
  setMembershipStatus,
  updateMemberLifecycle,
} from '../data/members';
import { listPlans } from '../data/plans';
import { getContactVisibility, getMemberDetails, saveMemberDetails, setContactVisibility, type ContactVisibility } from '../data/memberDetails';
import type { JoinDetails } from '../join/calc';

export function useMemberDirectory(gymId: string) {
  return useQuery({ queryKey: ['members', gymId], queryFn: () => listMemberDirectory(gymId) });
}

export function useMemberMemberships(gymId: string, userId: string) {
  return useQuery({ queryKey: ['member-memberships', gymId, userId], queryFn: () => listMemberMemberships(gymId, userId) });
}

export function useMemberDetails(gymId: string, userId: string) {
  return useQuery({ queryKey: ['member-details', gymId, userId], queryFn: () => getMemberDetails(gymId, userId) });
}

/** Saving a member's details refreshes their details, the directory (names) and the "missing details" list. */
export function useSaveMemberDetails(gymId: string, userId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (d: JoinDetails) => saveMemberDetails(gymId, userId, d, new Date()),
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['member-details', gymId, userId] }),
        qc.invalidateQueries({ queryKey: ['members', gymId] }),
        qc.invalidateQueries({ queryKey: ['missing-details', gymId] }),
      ]);
    },
  });
}

export function useContactVisibility(gymId: string) {
  const qc = useQueryClient();
  const query = useQuery({ queryKey: ['contact-visibility', gymId], queryFn: () => getContactVisibility(gymId) });
  const save = useMutation({
    mutationFn: (v: ContactVisibility) => setContactVisibility(gymId, v),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['contact-visibility', gymId] });
      await qc.invalidateQueries({ queryKey: ['member-details', gymId] });
    },
  });
  return { query, save };
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
  };
}
