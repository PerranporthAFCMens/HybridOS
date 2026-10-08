import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createStaffLogin, loadStaff, removeStaffAccess, saveStaff, type NewLogin, type SaveStaffArgs } from '../data/staff';

export function useStaffData(gymId: string) {
  return useQuery({ queryKey: ['staff', gymId], queryFn: () => loadStaff(gymId) });
}

/** Every write refreshes the team (and the figures that use staff). */
export function useStaffWrites(gymId: string) {
  const qc = useQueryClient();
  const refresh = async () => {
    await Promise.all([qc.invalidateQueries({ queryKey: ['staff', gymId] }), qc.invalidateQueries({ queryKey: ['class-staff', gymId] }), qc.invalidateQueries({ queryKey: ['scheduling-rules', gymId] })]);
  };
  return {
    save: useMutation({ mutationFn: (a: SaveStaffArgs) => saveStaff(a), onSettled: refresh }),
    create: useMutation({ mutationFn: (n: NewLogin) => createStaffLogin(gymId, n), onSettled: refresh }),
    remove: useMutation({ mutationFn: (userId: string) => removeStaffAccess(gymId, userId), onSettled: refresh }),
  };
}
