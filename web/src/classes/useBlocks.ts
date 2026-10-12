import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createBlock, deleteBlock, getBlockOfClass, listBlocks, loadBlockClasses, setBlockClasses, updateBlock, type ClassBlock } from '../data/classBlocks';

export function useBlocks(gymId: string) {
  return useQuery({ queryKey: ['class-blocks', gymId], queryFn: () => listBlocks(gymId) });
}

export function useBlockClasses(gymId: string, block: ClassBlock | null) {
  return useQuery({ queryKey: ['block-classes', gymId, block?.id, block?.startsOn, block?.weeks], queryFn: () => loadBlockClasses(gymId, block as ClassBlock), enabled: !!block });
}

export function useBlockOfClass(sessionId: string) {
  return useQuery({ queryKey: ['block-of-class', sessionId], queryFn: () => getBlockOfClass(sessionId) });
}

/** Make, change or remove a block, and put classes in it. Everything that shows blocks refreshes afterwards. */
export function useBlockWrites(gymId: string, userId: string) {
  const qc = useQueryClient();
  const refresh = () => Promise.all([qc.invalidateQueries({ queryKey: ['class-blocks', gymId] }), qc.invalidateQueries({ queryKey: ['block-classes', gymId] }), qc.invalidateQueries({ queryKey: ['block-of-class'] }), qc.invalidateQueries({ queryKey: ['m-class-blocks'] })]);
  return {
    create: useMutation({ mutationFn: (v: { name: string; startsOn: string; weeks: number }) => createBlock(gymId, userId, v), onSettled: refresh }),
    update: useMutation({ mutationFn: (v: { id: string; name: string; startsOn: string; weeks: number }) => updateBlock(v.id, v), onSettled: refresh }),
    remove: useMutation({ mutationFn: (id: string) => deleteBlock(id), onSettled: refresh }),
    classes: useMutation({ mutationFn: (v: { blockId: string; add: string[]; remove: string[] }) => setBlockClasses(gymId, v.blockId, v.add, v.remove), onSettled: refresh }),
  };
}
