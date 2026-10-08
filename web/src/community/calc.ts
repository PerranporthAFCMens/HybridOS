// Pure rules behind the Community feed: building threads from flat rows, who a name belongs to, and what a
// valid post or comment looks like.

export interface Post { id: string; userId: string; body: string; createdAt: string }
export interface Comment { id: string; postId: string; userId: string; parentId: string | null; body: string; createdAt: string }
export interface Reaction { postId: string | null; commentId: string | null }
export interface Profile { id: string; displayName: string | null; firstName: string | null; lastName: string | null; avatarUrl: string | null }

export interface Thread { comment: Comment; replies: Comment[] }
export interface FeedPost { post: Post; threads: Thread[]; commentCount: number; reactionCount: number }

export const POST_MAX = 2000;
export const COMMENT_MAX = 1000;

export function nameOf(p: Profile | undefined): string {
  if (!p) return 'Member';
  return p.displayName?.trim() || [p.firstName, p.lastName].filter(Boolean).join(' ').trim() || 'Member';
}

export function initials(name: string): string {
  const letters = name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w.charAt(0)).join('').toUpperCase();
  return letters || 'H';
}

/** Only https pictures are shown. */
export const safeAvatar = (url: string | null): string | null => (url && /^https:\/\//i.test(url) ? url : null);

/** The top-level comment a comment belongs to (a reply to a reply stays in the same thread). */
export function rootOf(comments: Comment[], id: string): string {
  const byId = new Map(comments.map((c) => [c.id, c]));
  let cur = byId.get(id);
  let guard = 0;
  while (cur?.parentId && byId.has(cur.parentId) && guard++ < 50) cur = byId.get(cur.parentId);
  return cur?.id ?? id;
}

/**
 * Posts newest first, each with its comments as threads (oldest first, replies under the top-level comment).
 * A reply to a reply is shown in the same thread (the old page lost those replies from view).
 */
export function buildFeed(posts: Post[], comments: Comment[], reactions: Reaction[]): FeedPost[] {
  const sorted = (a: Comment, b: Comment) => a.createdAt.localeCompare(b.createdAt);
  return posts
    .slice()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((post) => {
      const mine = comments.filter((c) => c.postId === post.id).sort(sorted);
      const tops = mine.filter((c) => !c.parentId || !mine.some((m) => m.id === c.parentId));
      const threads = tops.map((comment) => ({ comment, replies: mine.filter((c) => c.id !== comment.id && rootOf(mine, c.id) === comment.id) }));
      return { post, threads, commentCount: mine.length, reactionCount: reactions.filter((r) => r.postId === post.id).length };
    });
}

export type TextCheck = { ok: true; body: string } | { ok: false; message: string };

export function validatePost(text: string): TextCheck {
  const body = text.trim();
  if (!body) return { ok: false, message: 'Write something to post.' };
  if (body.length > POST_MAX) return { ok: false, message: `A post can be up to ${POST_MAX} characters.` };
  return { ok: true, body };
}

export function validateComment(text: string): TextCheck {
  const body = text.trim();
  if (!body) return { ok: false, message: 'Write a comment first.' };
  if (body.length > COMMENT_MAX) return { ok: false, message: `A comment can be up to ${COMMENT_MAX} characters.` };
  return { ok: true, body };
}

export const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
