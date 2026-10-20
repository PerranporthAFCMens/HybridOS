import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createPackType, giveClassPack, listHeldPacks, listPackTypes, setPackTypeActive, updatePackType, voidClassPack, type PackTypeInput } from '../data/classPacks';

export function usePackTypes(gymId: string) {
  return useQuery({ queryKey: ['pack-types', gymId], queryFn: () => listPackTypes(gymId) });
}

export function usePackTypeWrites(gymId: string) {
  const qc = useQueryClient();
  const refresh = () => qc.invalidateQueries({ queryKey: ['pack-types', gymId] });
  return {
    save: useMutation({
      mutationFn: (v: { id: string | null; input: PackTypeInput }) => (v.id ? updatePackType(gymId, v.id, v.input) : createPackType(gymId, v.input)),
      onSuccess: refresh,
    }),
    toggle: useMutation({ mutationFn: (v: { id: string; isActive: boolean }) => setPackTypeActive(gymId, v.id, v.isActive), onSuccess: refresh }),
  };
}

export function useHeldPacks(gymId: string) {
  return useQuery({ queryKey: ['held-packs', gymId], queryFn: () => listHeldPacks(gymId) });
}

export function useHeldPackWrites(gymId: string) {
  const qc = useQueryClient();
  const refresh = () => qc.invalidateQueries({ queryKey: ['held-packs', gymId] });
  return {
    give: useMutation({ mutationFn: (v: { userId: string; packTypeId: string }) => giveClassPack(gymId, v.userId, v.packTypeId), onSuccess: refresh }),
    cancel: useMutation({ mutationFn: (packId: string) => voidClassPack(packId), onSuccess: refresh }),
  };
}
