import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { assignLevel, deleteLevel, loadAccess, saveLevel, type LevelInput } from '../data/access';

export function useAccess(gymId: string) {
  return useQuery({ queryKey: ['access', gymId], queryFn: () => loadAccess(gymId) });
}

/** Writes refresh this screen and the Staff screen, which shows each person's level. */
export function useAccessWrites(gymId: string, userId: string) {
  const qc = useQueryClient();
  const refresh = async () => {
    await Promise.all([qc.invalidateQueries({ queryKey: ['access', gymId] }), qc.invalidateQueries({ queryKey: ['staff', gymId] })]);
  };
  return {
    save: useMutation({ mutationFn: (v: { id: string | null; input: LevelInput }) => saveLevel(gymId, v.id, userId, v.input), onSuccess: refresh }),
    remove: useMutation({ mutationFn: (id: string) => deleteLevel(gymId, id), onSuccess: refresh }),
    assign: useMutation({ mutationFn: (v: { userId: string; levelId: string }) => assignLevel(gymId, v.userId, v.levelId), onSuccess: refresh }),
  };
}
