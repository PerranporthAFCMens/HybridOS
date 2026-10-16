import { describe, expect, it } from 'vitest';
import type { Movement } from '../src/data/movements';
import { anyLevels, helpFor, isLevel, movementIndex } from '../src/train/levels';

const mv = (name: string, patch: Partial<Movement> = {}): Movement => ({ id: name, name, videoUrl: '', cue: '', tracking: 'strength', isActive: true, levels: { rx: '', scaled: '', foundations: '' }, ...patch });

describe('movement help in the player', () => {
  const index = movementIndex([
    mv('Sled Push', { cue: 'Drive', videoUrl: 'https://x.test/v', levels: { rx: '4 x 20 m', scaled: '2 x 20 m', foundations: '' } }),
    mv('Plank'),
    mv('Old Move', { isActive: false, cue: 'old' }),
  ]);
  it('matches by name ignoring case and spaces', () => {
    expect(helpFor(index, '  sled PUSH ', null)).toEqual({ cue: 'Drive', videoUrl: 'https://x.test/v', levelText: '' });
  });
  it('adds the chosen level wording', () => {
    expect(helpFor(index, 'Sled Push', 'scaled')?.levelText).toBe('2 x 20 m');
    expect(helpFor(index, 'Sled Push', 'foundations')?.levelText).toBe('');
  });
  it('says nothing for unknown, empty or switched-off movements', () => {
    expect(helpFor(index, 'Burpee', 'rx')).toBeNull();
    expect(helpFor(index, 'Plank', 'rx')).toBeNull();
    expect(helpFor(index, 'Old Move', 'rx')).toBeNull();
  });
  it('shows the level choice only when a level has wording', () => {
    expect(anyLevels(index, ['Plank', 'Sled Push'])).toBe(true);
    expect(anyLevels(index, ['Plank', 'Burpee'])).toBe(false);
  });
  it('only the three fixed levels are accepted', () => {
    expect(isLevel('rx')).toBe(true);
    expect(isLevel('elite')).toBe(false);
    expect(isLevel(null)).toBe(false);
  });
});
