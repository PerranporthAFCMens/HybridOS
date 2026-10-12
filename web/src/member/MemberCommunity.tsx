import { useState } from 'react';
import { useReadyAuth } from '../auth/AuthProvider';
import type { CommunityData } from '../data/community';
import { Button } from '../ui/Button';
import { Input, Textarea } from '../ui/Field';
import { COMMENT_MAX, POST_MAX, buildFeed, initials, nameOf, plural, reactionState, rootOf, safeAvatar, validateComment, validatePost, type Comment, type FeedPost } from '../community/calc';
import { useCommunity, useCommunityWrites } from '../community/useCommunity';
import '../community/community.css';

const when = (iso: string) => new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London' }).format(new Date(iso));

type Target = { postId: string } | { commentId: string };

/** The gym's feed: anyone can post, comment, reply and like. Members can delete their own; the team moderates from the admin. */
export function MemberCommunity() {
  const { gym, userId } = useReadyAuth();
  const q = useCommunity(gym.gymId);
  const w = useCommunityWrites(gym.gymId, userId);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const d = q.data;
  const feed = d ? buildFeed(d.posts, d.comments, d.reactions) : [];

  const publish = () => {
    const c = validatePost(draft);
    if (!c.ok) return setError(c.message);
    setError('');
    w.post.mutate(c.body, { onSuccess: () => setDraft(''), onError: (e) => setError(e.message) });
  };

  return (
    <div className="mem-screen">
      <h1 className="mem-title">Community</h1>
      <section className="mem-card" aria-label="Write a post">
        <Textarea aria-label="Share something with the gym" maxLength={POST_MAX} placeholder="Share something with the gym…" value={draft} onChange={(e) => { setError(''); setDraft(e.target.value); }} />
        <Button variant="primary" disabled={w.post.isPending} onClick={publish}>{w.post.isPending ? 'Posting…' : 'Post'}</Button>
        {error && <div className="mem-error" role="alert">{error}</div>}
      </section>
      {q.isError && <div className="mem-error" role="alert">Could not load the feed. Refresh to try again.</div>}
      {q.isPending && <div className="muted">Loading the feed…</div>}
      {d && feed.length === 0 && <div className="mem-card muted">No posts yet. Be the first to say something.</div>}
      {d && feed.map((f) => <Post key={f.post.id} f={f} d={d} />)}
      {d && d.posts.length >= 100 && <p className="muted small">Showing the latest 100 posts.</p>}
    </div>
  );
}

function Avatar({ id, d }: { id: string; d: CommunityData }) {
  const p = d.profiles.get(id);
  const src = safeAvatar(p?.avatarUrl ?? null);
  return <div className="cm-avatar" aria-hidden="true">{src ? <img src={src} alt="" /> : initials(nameOf(p))}</div>;
}

function Post({ f, d }: { f: FeedPost; d: CommunityData }) {
  const { gym, userId } = useReadyAuth();
  const w = useCommunityWrites(gym.gymId, userId);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [replyTo, setReplyTo] = useState<Comment | null>(null);
  const [error, setError] = useState('');
  const [confirm, setConfirm] = useState<{ kind: 'post' | 'comment'; id: string } | null>(null);
  const allComments = f.threads.flatMap((t) => [t.comment, ...t.replies]);
  const author = nameOf(d.profiles.get(f.post.userId));
  const fail = (e: Error) => setError(e.message);

  const like = (target: Target) => {
    const s = reactionState(d.reactions, target, userId);
    setError('');
    w.like.mutate({ target, liked: !s.mine }, { onError: fail });
  };
  const send = () => {
    const c = validateComment(text);
    if (!c.ok) return setError(c.message);
    setError('');
    const parent = replyTo ? rootOf(allComments, replyTo.id) : null;
    w.comment.mutate({ postId: f.post.id, parentId: parent, body: c.body }, { onSuccess: () => { setText(''); setReplyTo(null); }, onError: fail });
  };
  const remove = () => {
    const c = confirm;
    setConfirm(null);
    if (!c) return;
    (c.kind === 'post' ? w.removePost : w.removeComment).mutate(c.id, { onError: fail });
  };
  const likeButton = (target: Target, label: string) => {
    const s = reactionState(d.reactions, target, userId);
    return <Button aria-pressed={s.mine} aria-label={`${s.mine ? 'Unlike' : 'Like'} ${label}`} disabled={w.like.isPending} onClick={() => like(target)}>{s.mine ? 'Liked' : 'Like'}{s.count > 0 ? ` · ${s.count}` : ''}</Button>;
  };
  const row = (c: Comment, reply: boolean) => {
    const who = nameOf(d.profiles.get(c.userId));
    return (
      <div className={`cm-comment${reply ? ' reply' : ''}`} key={c.id}>
        <Avatar id={c.userId} d={d} />
        <div className="cm-main">
          <div className="cm-bubble"><b>{who}</b><div>{c.body}</div></div>
          <div className="cm-actions">
            {likeButton({ commentId: c.id }, `the comment by ${who}`)}
            <Button aria-label={`Reply to ${who}`} onClick={() => { setOpen(true); setReplyTo(c); }}>Reply</Button>
            {c.userId === userId && <Button aria-label={`Delete your comment`} onClick={() => setConfirm({ kind: 'comment', id: c.id })}>Delete</Button>}
          </div>
        </div>
      </div>
    );
  };

  return (
    <article className="mem-card cm-post" aria-label={`Post by ${author}`}>
      <div className="cm-head">
        <Avatar id={f.post.userId} d={d} />
        <div className="cm-meta"><b>{author}</b><span className="muted small">{when(f.post.createdAt)}</span></div>
        {f.post.userId === userId && <Button aria-label="Delete your post" onClick={() => setConfirm({ kind: 'post', id: f.post.id })}>Delete</Button>}
      </div>
      <div className="cm-body">{f.post.body}</div>
      <div className="cm-actions">
        {likeButton({ postId: f.post.id }, `the post by ${author}`)}
        <Button aria-expanded={open} onClick={() => setOpen(!open)}>{plural(f.commentCount, 'comment')}</Button>
      </div>
      {confirm && (
        <div className="cm-confirm" role="alertdialog" aria-label="Confirm delete">
          <span>{confirm.kind === 'post' ? 'Delete your post and all its comments?' : 'Delete your comment?'}</span>
          <Button variant="primary" onClick={remove}>Yes, delete</Button>
          <Button onClick={() => setConfirm(null)}>Keep</Button>
        </div>
      )}
      {open && (
        <>
          <div className="cm-comments">{f.threads.map((t) => <div key={t.comment.id}>{row(t.comment, false)}{t.replies.map((r) => row(r, true))}</div>)}</div>
          {replyTo && <div className="muted small cm-replying">Replying to {nameOf(d.profiles.get(replyTo.userId))} <Button onClick={() => setReplyTo(null)}>Cancel reply</Button></div>}
          <div className="cm-composer">
            <Input aria-label={`Add a comment to the post by ${author}`} maxLength={COMMENT_MAX} placeholder="Add a comment…" value={text}
              onChange={(e) => { setError(''); setText(e.target.value); }} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }} />
            <Button disabled={w.comment.isPending} aria-label={`Post comment on the post by ${author}`} onClick={send}>Post</Button>
          </div>
        </>
      )}
      {error && <div className="mem-error" role="alert">{error}</div>}
    </article>
  );
}
