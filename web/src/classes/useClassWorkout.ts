import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getClassWorkout, removeClassWorkout, setClassWorkout, setClassWorkoutAvailable, setClassWorkoutScore } from '../data/classWorkouts';
import type { ScoreMetric } from '../train/calc';
import type { TemplateRow } from '../data/workouts';

export function useClassWorkout(sessionId: string) {
  return useQuery({ queryKey: ['class-workout', sessionId], queryFn: () => getClassWorkout(sessionId) });
}

/** Put a workout on a class, make it available or take it back, or remove it. The class's workout refreshes after each. */
export function useClassWorkoutWrites(gymId: string, userId: string, sessionId: string) {
  const qc = useQueryClient();
  const refresh = () => qc.invalidateQueries({ queryKey: ['class-workout', sessionId] });
  return {
    attach: useMutation({ mutationFn: (t: TemplateRow) => setClassWorkout(gymId, userId, sessionId, t), onSettled: refresh }),
    available: useMutation({ mutationFn: (available: boolean) => setClassWorkoutAvailable(sessionId, userId, available), onSettled: refresh }),
    score: useMutation({ mutationFn: (score: { exercise: string; metric: ScoreMetric } | null) => setClassWorkoutScore(sessionId, score), onSettled: refresh }),
    remove: useMutation({ mutationFn: () => removeClassWorkout(sessionId), onSettled: refresh }),
  };
}
