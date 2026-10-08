import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { loadClassSetup, saveClassType, setClassTypeActive, type ClassTypeInput, type RequirementInput } from '../data/classSetup';
import { diffRequirements } from './calc';

export function useClassSetup(gymId: string) {
  return useQuery({ queryKey: ['class-setup', gymId], queryFn: () => loadClassSetup(gymId) });
}

/** Writes refresh this screen and the class type choices in Add class. */
export function useClassSetupWrites(gymId: string) {
  const qc = useQueryClient();
  const refresh = async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ['class-setup', gymId] }),
      qc.invalidateQueries({ queryKey: ['class-types', gymId] }),
      qc.invalidateQueries({ queryKey: ['scheduling-rules', gymId] }),
    ]);
  };
  return {
    save: useMutation({
      mutationFn: (v: { typeId: string | null; input: ClassTypeInput; needs: RequirementInput[] }) =>
        saveClassType(gymId, v.typeId, v.input, (existing) => diffRequirements(existing, v.needs)),
      onSuccess: refresh,
    }),
    toggle: useMutation({
      mutationFn: (v: { typeId: string; isActive: boolean }) => setClassTypeActive(gymId, v.typeId, v.isActive),
      onSuccess: refresh,
    }),
  };
}
