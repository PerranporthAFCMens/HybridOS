import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as api from '../data/owners';

/** Only owners use this screen, so nothing is fetched for anyone else. */
export function useOwners(gymId: string, enabled: boolean) {
  return useQuery({ queryKey: ['owners', gymId], queryFn: () => api.loadOwners(gymId), enabled });
}

/** Every write (and every failure, since a half-done invite is saved) refreshes the lists, plus Staff and Access levels. */
export function useOwnersWrites(gymId: string) {
  const qc = useQueryClient();
  const refresh = async () => {
    await Promise.all(['owners', 'staff', 'access'].map((k) => qc.invalidateQueries({ queryKey: [k, gymId] })));
  };
  const opts = { onSettled: refresh };
  return {
    createInvite: useMutation({ mutationFn: (v: Parameters<typeof api.createInvite>[1]) => api.createInvite(gymId, v), ...opts }),
    sendEmail: useMutation({ mutationFn: (id: string) => api.sendInviteEmail(id), ...opts }),
    approveOwnerInvite: useMutation({ mutationFn: (v: { id: string; link: boolean }) => api.approveOwnerInvite(v.id, v.link), ...opts }),
    approveAccess: useMutation({ mutationFn: (userId: string) => api.approvePendingAccess(gymId, userId), ...opts }),
    promote: useMutation({ mutationFn: (userId: string) => api.proposeOwnerPromotion(gymId, userId), ...opts }),
    requestRemoval: useMutation({ mutationFn: (userId: string) => api.proposeOwnerRemoval(gymId, userId), ...opts }),
    approveAction: useMutation({ mutationFn: (id: string) => api.approveOwnershipAction(id), ...opts }),
    removeAdmin: useMutation({ mutationFn: (userId: string) => api.removeAdminAccess(gymId, userId), ...opts }),
    revoke: useMutation({ mutationFn: (id: string) => api.revokeInvite(id), ...opts }),
    remove: useMutation({ mutationFn: (id: string) => api.deleteInvite(id), ...opts }),
  };
}
