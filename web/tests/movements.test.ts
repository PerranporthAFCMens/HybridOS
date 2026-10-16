import { describe, expect, it } from 'vitest';
import { emptyMovement, levelText, missingStarters, movementKey, validateMovement, withLevelText } from '../src/movements/calc';
import { addExercise } from '../src/workouts/calc';

const form = (patch: Partial<ReturnType<typeof emptyMovement>> = {}) => ({ ...emptyMovement(), name: 'Sled Push', ...patch });

describe('movement rules', () => {
  it('the key ignores case and spaces like the database', () => {
    expect(movementKey('  Sled PUSH ')).toBe('sled push');
  });
  it('a good movement passes', () => {
    expect(validateMovement(form({ videoUrl: 'https://example.test/v', cue: 'Drive through the legs' }), [])).toBe('');
  });
  it('needs a name, a new name, an https link and short wording', () => {
    expect(validateMovement(form({ name: '  ' }), [])).toMatch(/name/);
    expect(validateMovement(form({ name: 'SLED push' }), ['sled push'])).toMatch(/already/);
    expect(validateMovement(form({ videoUrl: 'http://x.test' }), [])).toMatch(/https/);
    expect(validateMovement(form({ videoUrl: 'www.x.test' }), [])).toMatch(/https/);
    expect(validateMovement(form({ cue: 'x'.repeat(501) }), [])).toMatch(/cue/);
    expect(validateMovement(form({ levels: { rx: '', scaled: 'x'.repeat(201), foundations: '' } }), [])).toMatch(/Scaled/);
  });
  it('finds the standard names a gym is missing, ignoring case', () => {
    const m = missingStarters(['sled push', 'WALL BALL'], ['Sled Push', 'Wall Ball', 'Burpee', 'Plank']);
    expect(m.map((x) => x.name)).toEqual(['Burpee', 'Plank']);
    expect(m.find((x) => x.name === 'Plank')?.tracking).toBe('time');
  });
  it('level wording keeps other saved parts', () => {
    expect(levelText({ display: '2 x 20 m' })).toBe('2 x 20 m');
    expect(levelText(null)).toBe('');
    expect(withLevelText({ display: 'old', sets: [{ reps: '10' }] }, ' new ')).toEqual({ display: 'new', sets: [{ reps: '10' }] });
    expect(withLevelText(null, 'x')).toEqual({ display: 'x' });
  });
  it('an exercise from the list can bring its own way of recording', () => {
    const [b] = addExercise([], 'Sled Push', 'distance');
    expect(b?.activities[0]?.tracking).toBe('distance');
    const [c] = addExercise([], 'Plank');
    expect(c?.activities[0]?.tracking).toBe('time');
  });
});
