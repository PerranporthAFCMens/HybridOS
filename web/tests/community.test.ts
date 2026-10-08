import { describe, expect, it } from 'vitest';
import { buildFeed, initials, nameOf, plural, rootOf, safeAvatar, validateComment, validatePost, type Comment, type Post } from '../src/community/calc';

const post = (id: string, createdAt: string): Post => ({ id, userId: 'u', body: 'b', createdAt });
const comment = (id: string, postId: string, parentId: string | null, createdAt: string): Comment => ({ id, postId, userId: 'u', parentId, body: id, createdAt });

describe('names', () => {
  it('uses the display name, then first and last, then Member', () => {
    expect(nameOf({ id: '1', displayName: ' Sam Jones ', firstName: null, lastName: null, avatarUrl: null })).toBe('Sam Jones');
    expect(nameOf({ id: '1', displayName: '', firstName: 'Sam', lastName: 'Jones', avatarUrl: null })).toBe('Sam Jones');
    expect(nameOf({ id: '1', displayName: null, firstName: 'Sam', lastName: null, avatarUrl: null })).toBe('Sam');
    expect(nameOf({ id: '1', displayName: null, firstName: null, lastName: null, avatarUrl: null })).toBe('Member');
    expect(nameOf(undefined)).toBe('Member');
  });
  it('makes initials', () => {
    expect(initials('sam jones')).toBe('SJ');
    expect(initials('Madonna')).toBe('M');
    expect(initials('  ')).toBe('H');
  });
  it('shows only https pictures', () => {
    expect(safeAvatar('https://x.co/a.png')).toBe('https://x.co/a.png');
    expect(safeAvatar('http://x.co/a.png')).toBeNull();
    expect(safeAvatar('javascript:alert(1)')).toBeNull();
    expect(safeAvatar(null)).toBeNull();
  });
});

describe('threads', () => {
  const comments = [
    comment('c1', 'p1', null, '2026-10-01T10:00:00Z'),
    comment('c2', 'p1', 'c1', '2026-10-01T11:00:00Z'),
    comment('c3', 'p1', 'c2', '2026-10-01T12:00:00Z'),
    comment('c4', 'p1', null, '2026-10-01T09:00:00Z'),
    comment('x1', 'p2', null, '2026-10-02T09:00:00Z'),
  ];
  it('finds the top-level comment of a reply to a reply', () => {
    expect(rootOf(comments, 'c3')).toBe('c1');
    expect(rootOf(comments, 'c1')).toBe('c1');
    expect(rootOf(comments, 'nope')).toBe('nope');
  });
  it('does not loop on a broken parent chain', () => {
    const loop = [comment('a', 'p', 'b', '1'), comment('b', 'p', 'a', '2')];
    expect(typeof rootOf(loop, 'a')).toBe('string');
  });
  it('orders posts newest first and threads oldest first, keeping replies to replies in view', () => {
    const feed = buildFeed([post('p1', '2026-10-01T08:00:00Z'), post('p2', '2026-10-02T08:00:00Z')], comments, [{ postId: 'p1', commentId: null }, { postId: 'p1', commentId: null }, { postId: 'p2', commentId: null }]);
    expect(feed.map((f) => f.post.id)).toEqual(['p2', 'p1']);
    const p1 = feed[1];
    expect(p1?.threads.map((t) => t.comment.id)).toEqual(['c4', 'c1']);
    expect(p1?.threads[1]?.replies.map((r) => r.id)).toEqual(['c2', 'c3']);
    expect(p1?.commentCount).toBe(4);
    expect(p1?.reactionCount).toBe(2);
    expect(feed[0]?.commentCount).toBe(1);
  });
  it('treats a comment whose parent is missing as top-level', () => {
    const feed = buildFeed([post('p', '1')], [comment('orphan', 'p', 'gone', '2')], []);
    expect(feed[0]?.threads.map((t) => t.comment.id)).toEqual(['orphan']);
  });
});

describe('validation', () => {
  it('posts', () => {
    expect(validatePost('  Hello  ')).toEqual({ ok: true, body: 'Hello' });
    expect(validatePost('   ')).toMatchObject({ ok: false });
    expect(validatePost('x'.repeat(2001))).toMatchObject({ ok: false });
  });
  it('comments', () => {
    expect(validateComment(' ok ')).toEqual({ ok: true, body: 'ok' });
    expect(validateComment('')).toMatchObject({ ok: false });
    expect(validateComment('x'.repeat(1001))).toMatchObject({ ok: false });
  });
  it('pluralises', () => {
    expect(plural(1, 'comment')).toBe('1 comment');
    expect(plural(0, 'reaction')).toBe('0 reactions');
  });
});
