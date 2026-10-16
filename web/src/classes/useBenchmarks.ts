import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { addBlockBenchmark, listBlockBenchmarks, removeBlockBenchmark } from '../data/benchmarks';
import type { Better } from './benchmarks';

export function useBlockBenchmarks(gymId: string, blockId: string) {
  return useQuery({ queryKey: ['block-benchmarks', gymId, blockId], queryFn: () => listBlockBenchmarks(gymId, blockId) });
}

/** Add or remove a benchmark. Everything that shows benchmarks refreshes afterwards. */
export function useBenchmarkWrites(gymId: string, userId: string, blockId: string) {
  const qc = useQueryClient();
  const refresh = () => Promise.all([qc.invalidateQueries({ queryKey: ['block-benchmarks', gymId] }), qc.invalidateQueries({ queryKey: ['m-benchmarks'] })]);
  return {
    add: useMutation({ mutationFn: (v: { movementId: string; startOn: string; endOn: string; better: Better }) => addBlockBenchmark(gymId, userId, blockId, v), onSettled: refresh }),
    remove: useMutation({ mutationFn: (id: string) => removeBlockBenchmark(id), onSettled: refresh }),
  };
}
