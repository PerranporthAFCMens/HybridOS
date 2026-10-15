import { describe, expect, it } from 'vitest';
import { defaultLowerWins, inviteLink, parseDashboard, parseGroups, parsePreview, parseResult, rankEntries, unitFor, validateChallenge, validateGroup } from '../src/groups/calc';

describe('reading the database', () => {
  it('reads the group list and survives junk', () => {
    expect(parseGroups([{ id: 'g1', name: 'Squad', description: null, invite_code: 'abc', member_count: 3, challenge_count: '2' }])).toEqual([{ id: 'g1', name: 'Squad', description: '', inviteCode: 'abc', memberCount: 3, challengeCount: 2 }]);
    expect(parseGroups(null)).toEqual([]);
  });
  it('reads a dashboard with members, PBs and challenge entries', () => {
    const d = parseDashboard({
      group: { id: 'g1', name: 'Squad', invite_code: 'abc' },
      members: [{ user_id: 'u1', name: 'Amy', recent_workouts: [{ title: 'Legs', performed_at: '2026-10-01T10:00:00Z' }], recent_pbs: [{ exercise_name: 'Squat', value: 100, unit: 'kg', achieved_at: '2026-10-02T10:00:00Z' }] }],
      challenges: [{ id: 'c1', name: 'Squat-off', activity_name: 'Squat', metric_type: 'weight', unit: null, comparison_direction: 'higher', ends_at: null, entries: [{ user_id: 'u1', name: 'Amy', value: 100 }] }],
    });
    expect(d.members[0]?.pbs[0]?.value).toBe('100');
    expect(d.challenges[0]?.unit).toBe('kg');
    expect(d.challenges[0]?.entries[0]?.value).toBe(100);
    expect(parseDashboard(undefined).members).toEqual([]);
  });
  it('reads an invite preview', () => {
    expect(parsePreview({ id: 'g1', name: 'Squad', member_count: 2, owner_name: 'Amy', already_member: true })).toMatchObject({ memberCount: 2, ownerName: 'Amy', alreadyMember: true });
  });
});

describe('forms', () => {
  it('checks the group name', () => {
    expect(validateGroup(' A ').ok).toBe(false);
    expect(validateGroup('x'.repeat(81)).ok).toBe(false);
    expect(validateGroup('  Squad ')).toEqual({ ok: true, name: 'Squad' });
  });
  it('checks a challenge', () => {
    expect(validateChallenge('Squat-off', '').ok).toBe(false);
    expect(validateChallenge('Squat-off', ' Squat ')).toEqual({ ok: true, name: 'Squat-off', activity: 'Squat' });
  });
  it('accepts only real numbers as results', () => {
    expect(parseResult('')).toBeNull();
    expect(parseResult('abc')).toBeNull();
    expect(parseResult(' 82.5 ')).toBe(82.5);
  });
  it('defaults units and who wins', () => {
    expect(unitFor('weight')).toBe('kg');
    expect(unitFor('custom')).toBe('');
    expect(defaultLowerWins('time')).toBe(true);
    expect(defaultLowerWins('weight')).toBe(false);
  });
  it('builds an invite link inside the app, on live and on the dev sub-path', () => {
    expect(inviteLink('https://www.hybridone.co.uk', '/', 'a b')).toBe('https://www.hybridone.co.uk/m/groups/join?code=a%20b');
    expect(inviteLink('https://x.github.io', '/HybridOS/', 'c')).toBe('https://x.github.io/HybridOS/m/groups/join?code=c');
  });
});

describe('ranking', () => {
  const e = (userId: string, value: number) => ({ userId, name: userId, value, note: '' });
  it('ranks highest first and lets ties share a place', () => {
    expect(rankEntries([e('a', 80), e('b', 100), e('c', 80)], false).map((r) => [r.userId, r.rank])).toEqual([['b', 1], ['a', 2], ['c', 2]]);
  });
  it('ranks lowest first when lowest wins', () => {
    expect(rankEntries([e('a', 90), e('b', 60)], true).map((r) => r.userId)).toEqual(['b', 'a']);
  });
});
