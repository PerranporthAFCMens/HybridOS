import { useState } from 'react';
import { useReadyAuth } from '../auth/AuthProvider';
import type { CommunityData } from '../data/community';
import { Button } from '../ui/Button';
import { Card, Empty } from '../ui/Card';
import { Input, Textarea } from '../ui/Field';
import { COMMENT_MAX, POST_MAX, buildFeed, initials, nameOf, plural, rootOf, safeAvatar, validateComment, validatePost, type Comment, type FeedPost } from './calc';
import { useCommunity, useCommunityWrites } from './useCommunity';
import '../members/members.css';
import './community.css';

const when = (iso: string) => new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London' }).format(new Date(iso));

type Confirm = { kind: 'post' | 'comment'; id: string };
type Note = { text: string; good: boolean };

export function Community() {
  const { gym, userId } = useReadyAuth();
  const q = useCommunity(gym.gymId);
  const w = useCommunityWrites(gym.gymId, userId);
  const [draft, setDraft] = useState('');
  const [note, setNote] = useState<Note | null>(null);
  const [confirming, setConfirming] = useState<Confirm | null>(null);
  const d = q.data;
  const feed = d ? buildFeed(d.posts, d.comments, d.reactions) : [];
  const fail = (e: Error) => setNote({ text: e.message, good: false });

  const publish = () => {
    const c = validatePost(draft);
    if (!c.ok) return setNote({ text: c.message, good: false });
    setNote(null);
    w.post.mutate(c.body, { onSuccess: () => setDraft(''), onError: fail });
  };
  const remove = () => {
    const c = confirming;
    setConfirming(null);
    if (!c) return;
    if (c.kind === 'post') w.removePost.mutate(c.id, { onSuccess: () => setNote({ text: 'Post deleted.', good: true }), onError: fail });
    else w.removeComment.mutate(c.id, { onSuccess: () => setNote({ text: 'Comment deleted.', good: true }), onError: fail });
  };

  return (
    <>
      <header className="page-top">
        <div>
          <div className="eyebrow">Community</div>
          <h1>Community</h1>
          <div className="muted">See and manage the social feed your members use.</div>
        </div>
      </header>

      <Card>
        <Textarea aria-label="Post to your members" maxLength={POST_MAX} placeholder="Post an update to your members…" value={draft} onChange={(e) => { setNote(null); setDraft(e.target.value); }} />
        <div className="membership-actions"><Button variant="primary" disabled={w.post.isPending} onClick={publish}>{w.post.isPending ? 'Posting…' : 'Post to community'}</Button></div>
      </Card>

      {note && <div className={`msg ${note.good ? '' : 'error'}`} role={note.good ? 'status' : 'alert'}>{note.text}</div>}
      {confirming && (
        <div className="notice cm-confirm" role="alertdialog" aria-label="Confirm">
          <span>{confirming.kind === 'post' ? 'Delete this post and all its comments? This cannot be undone.' : 'Delete this comment? This cannot be undone.'}</span>
          <Button variant="primary" disabled={w.removePost.isPending || w.removeComment.isPending} onClick={remove}>Yes, delete</Button>
          <Button onClick={() => setConfirming(null)}>Keep</Button>
        </div>
      )}
      {q.isError && <Card><Empty>Could not load the community feed. Refresh to try again.</Empty></Card>}
      {q.isPending && <Card><Empty>Loading the feed…</Empty></Card>}
      {d && feed.length === 0 && <Card><Empty>No community posts yet.</Empty></Card>}
      {d && feed.map((f) => <PostCard key={f.post.id} f={f} d={d} ask={(c) => { setNote(null); setConfirming(c); }} />)}
      {d && d.posts.length >= 100 && <p className="muted small">Showing the latest 100 posts.</p>}
    </>
  );
}

function Avatar({ id, d }: { id: string; d: CommunityData }) {
  const p = d.profiles.get(id);
  const src = safeAvatar(p?.avatarUrl ?? null);
  return <div className="cm-avatar" aria-hidden="true">{src ? <img src={src} alt="" /> : initials(nameOf(p))}</div>;
}

function PostCard({ f, d, ask }: { f: FeedPost; d: CommunityData; ask: (c: Confirm) => void }) {
  const { gym, userId } = useReadyAuth();
  const w = useCommunityWrites(gym.gymId, userId);
  const [text, setText] = useState('');
  const [replyTo, setReplyTo] = useState<Comment | null>(null);
  const [error, setError] = useState('');
  const allComments = f.threads.flatMap((t) => [t.comment, ...t.replies]);

  const send = () => {
    const c = validateComment(text);
    if (!c.ok) return setError(c.message);
    setError('');
    const parent = replyTo ? rootOf(allComments, replyTo.id) : null;
    w.comment.mutate({ postId: f.post.id, parentId: parent, body: c.body }, { onSuccess: () => { setText(''); setReplyTo(null); }, onError: (e) => setError(e.message) });
  };
  const row = (c: Comment, reply: boolean) => (
    <div className={`cm-comment${reply ? ' reply' : ''}`} key={c.id}>
      <Avatar id={c.userId} d={d} />
      <div className="cm-main">
        <div className="cm-bubble"><b>{nameOf(d.profiles.get(c.userId))}</b><div>{c.body}</div></div>
        <div className="cm-actions">
          <Button aria-label={`Reply to ${nameOf(d.profiles.get(c.userId))}`} onClick={() => setReplyTo(c)}>Reply</Button>
          <Button aria-label={`Delete comment by ${nameOf(d.profiles.get(c.userId))}`} onClick={() => ask({ kind: 'comment', id: c.id })}>Delete</Button>
        </div>
      </div>
    </div>
  );

  return (
    <Card className="cm-post">
      <article>
        <div className="cm-head">
          <Avatar id={f.post.userId} d={d} />
          <div className="cm-meta"><b>{nameOf(d.profiles.get(f.post.userId))}</b><span className="muted small">{when(f.post.createdAt)}</span></div>
          <Button aria-label={`Delete post by ${nameOf(d.profiles.get(f.post.userId))}`} onClick={() => ask({ kind: 'post', id: f.post.id })}>Delete</Button>
        </div>
        <div className="cm-body">{f.post.body}</div>
        <div className="muted small">{plural(f.reactionCount, 'reaction')} · {plural(f.commentCount, 'comment')}</div>
        <div className="cm-comments">{f.threads.map((t) => <div key={t.comment.id}>{row(t.comment, false)}{t.replies.map((r) => row(r, true))}</div>)}</div>
        {replyTo && <div className="muted small cm-replying">Replying to {nameOf(d.profiles.get(replyTo.userId))} <Button onClick={() => setReplyTo(null)}>Cancel reply</Button></div>}
        <div className="cm-composer">
          <Input aria-label={`Add a comment to the post by ${nameOf(d.profiles.get(f.post.userId))}`} maxLength={COMMENT_MAX} placeholder="Add a comment…" value={text}
            onChange={(e) => { setError(''); setText(e.target.value); }} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }} />
          <Button disabled={w.comment.isPending} aria-label={`Post comment on the post by ${nameOf(d.profiles.get(f.post.userId))}`} onClick={send}>Post</Button>
        </div>
        {error && <div className="msg error" role="alert">{error}</div>}
      </article>
    </Card>
  );
}
