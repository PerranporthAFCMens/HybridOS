import { describe, expect, it } from 'vitest';
import { MENU, SETTINGS_GROUP, groupFor, tabsFor } from '../src/shell/menu';

describe('side menu', () => {
  it('is the same short list as the old admin shell', () => {
    expect([...MENU, SETTINGS_GROUP].map((g) => g.label)).toEqual(['Today', 'Members', 'Classes and workouts', 'Messages and community', 'Reports', 'Settings and staff']);
  });

  it('puts each page under the line it belongs to', () => {
    expect(groupFor('/plans')?.key).toBe('members');
    expect(groupFor('/members/abc')?.key).toBe('members');
    expect(groupFor('/workouts')?.key).toBe('classes');
    expect(groupFor('/training')?.key).toBe('classes');
    expect(groupFor('/communications')?.key).toBe('messages');
    expect(groupFor('/community')?.key).toBe('messages');
  });

  it('puts everything else under Settings, and member preview under nothing', () => {
    for (const p of ['/settings', '/staff', '/door', '/access', '/rooms', '/payments', '/class-setup', '/signup-process']) expect(groupFor(p)?.key).toBe('settings');
    expect(groupFor('/m/today')).toBeNull();
  });

  it('shows tabs only on the main page of a line that has more than one page', () => {
    expect(tabsFor('/plans').map((t) => t.label)).toEqual(['Members', 'Membership plans', 'Class packs']);
    expect(tabsFor('/classes').map((t) => t.label)).toEqual(['Timetable', 'Programmes', 'Workout builder', 'Movements', 'Client training']);
    expect(tabsFor('/communications').map((t) => t.label)).toEqual(['Community', 'Communications']);
    expect(tabsFor('/today')).toEqual([]);
    expect(tabsFor('/members/abc')).toEqual([]);
    expect(tabsFor('/settings')).toEqual([]);
  });
});
