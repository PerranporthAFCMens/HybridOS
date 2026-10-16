import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { addStarterMovements, loadMovements, saveMovement, setMovementActive } from '../data/movements';
import type { MovementForm } from './calc';

export function useMovements(gymId: string) {
  return useQuery({ queryKey: ['movements', gymId], queryFn: () => loadMovements(gymId) });
}

export function useMovementWrites(gymId: string) {
  const qc = useQueryClient();
  const refresh = () => qc.invalidateQueries({ queryKey: ['movements', gymId] });
  return {
    save: useMutation({ mutationFn: (v: { id: string | null; form: MovementForm }) => saveMovement(gymId, v.id, v.form), onSuccess: refresh }),
    toggle: useMutation({ mutationFn: (v: { id: string; isActive: boolean }) => setMovementActive(gymId, v.id, v.isActive), onSuccess: refresh }),
    fill: useMutation({ mutationFn: (items: { name: string; tracking: string }[]) => addStarterMovements(gymId, items), onSuccess: refresh }),
  };
}
