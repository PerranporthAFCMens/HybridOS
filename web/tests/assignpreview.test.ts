import { describe, expect, it } from 'vitest';
import { previewLines } from '../src/workouts/preview';
import { newActivity, newBlock, type BlockForm } from '../src/workouts/calc';
import type { StoredPb } from '../src/train/pb';

const pb = (name: string, metric: string, value: number): StoredPb => ({ id: name + metric + value, name, metric, dir: 'higher', value, unit: 'kg', achievedAt: '2026-10-01T00:00:00Z', notes: null });
const block = (...acts: { name: string; tracking?: string; sets: Record<string, string>[] }[]): BlockForm[] => [{ ...newBlock(), activities: acts.map((a) => ({ ...newActivity(), name: a.name, tracking: a.tracking ?? 'strength', sets: a.sets })) }];

describe('what a client will see for percentage weights', () => {
  const blocks = block(
    { name: 'Back Squat', sets: [{ reps: '5', weight: '80%' }, { reps: '5', weight: '80%' }, { reps: '5', weight: '80%' }] },
    { name: 'Bench Press', sets: [{ reps: '5', weight: '75%' }] },
    { name: 'Deadlift', sets: [{ reps: '3', weight: '100' }] },
    { name: 'Plank', tracking: 'time', sets: [{ time: '1:00' }] },
  );

  it('works out the kilos from that person\'s own best, in the words they will read', () => {
    const lines = previewLines(blocks, [pb('Back Squat', 'weight', 100), pb('Bench Press', 'weight', 62.5)]);
    expect(lines.map((l) => `${l.exercise}: ${l.text}`)).toEqual(['Back Squat: 3 sets: 5 × 80% (80 kg)', 'Bench Press: 5 × 75% (47 kg)']);
    expect(lines.every((l) => !l.missingBest)).toBe(true);
  });

  it('says so where they have no best, and flags it', () => {
    const lines = previewLines(blocks, [pb('Back Squat', 'weight', 100)]);
    expect(lines[1]).toEqual({ exercise: 'Bench Press', text: '5 × 75% (no best recorded yet)', missingBest: true });
    expect(lines[0]?.missingBest).toBe(false);
  });

  it('shows nothing for plain kilos or other kinds of exercise', () => {
    expect(previewLines(block({ name: 'Deadlift', sets: [{ reps: '3', weight: '100' }] }), [])).toEqual([]);
    expect(previewLines(block({ name: 'Plank', tracking: 'time', sets: [{ time: '1:00' }] }), [])).toEqual([]);
  });

  it('uses the heaviest weight best only, ignoring other kinds of best and the case of the name', () => {
    const lines = previewLines(block({ name: 'back squat', sets: [{ reps: '5', weight: '50%' }] }), [pb('Back Squat', 'reps', 40), pb('BACK SQUAT', 'weight', 120), pb('Back Squat', 'weight', 100)]);
    expect(lines[0]?.text).toBe('5 × 50% (60 kg)');
  });
});
