import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { loadRooms, saveQualification, saveResource, setQualificationActive, setResourceActive } from '../data/resources';
import type { ResourceInput } from './calc';

export function useRooms(gymId: string) {
  return useQuery({ queryKey: ['rooms', gymId], queryFn: () => loadRooms(gymId) });
}

/** Writes refresh this screen plus Class setup, Staff and the scheduling checks that read these lists. */
export function useRoomsWrites(gymId: string) {
  const qc = useQueryClient();
  const refresh = async () => {
    await Promise.all(['rooms', 'class-setup', 'staff', 'scheduling-rules', 'class-staff'].map((k) => qc.invalidateQueries({ queryKey: [k, gymId] })));
  };
  return {
    saveResource: useMutation({ mutationFn: (v: { id: string | null; input: ResourceInput }) => saveResource(gymId, v.id, v.input), onSuccess: refresh }),
    toggleResource: useMutation({ mutationFn: (v: { id: string; isActive: boolean }) => setResourceActive(gymId, v.id, v.isActive), onSuccess: refresh }),
    saveQualification: useMutation({ mutationFn: (v: { id: string | null; name: string; description: string | null }) => saveQualification(gymId, v.id, v.name, v.description), onSuccess: refresh }),
    toggleQualification: useMutation({ mutationFn: (v: { id: string; isActive: boolean }) => setQualificationActive(gymId, v.id, v.isActive), onSuccess: refresh }),
  };
}
