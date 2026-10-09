import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as api from '../data/workouts';
import type { BlockInput, WorkoutInput } from './calc';

export function useTemplates(gymId: string) {
  return useQuery({ queryKey: ['workouts', gymId], queryFn: () => api.loadTemplates(gymId) });
}

export function useWorkoutWrites(gymId: string, userId: string) {
  const qc = useQueryClient();
  const refresh = () => qc.invalidateQueries({ queryKey: ['workouts', gymId] });
  return {
    save: useMutation({ mutationFn: (v: { id: string | null; input: WorkoutInput; blocks: BlockInput[] }) => api.saveWorkout(gymId, userId, v.id, v.input, v.blocks), onSuccess: refresh }),
    archive: useMutation({ mutationFn: (id: string) => api.archiveWorkout(gymId, id), onSuccess: refresh }),
    assign: useMutation({ mutationFn: (v: { t: api.TemplateRow; member: string; dues: (string | null)[] }) => api.assignWorkout(gymId, userId, v.t, v.member, v.dues) }),
    wod: useMutation({ mutationFn: (v: { id: string; date: string; message: string | null }) => api.publishWod(gymId, userId, v.id, v.date, v.message) }),
  };
}
