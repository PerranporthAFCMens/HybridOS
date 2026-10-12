import { supabase } from './client';
import { asKind, type Comment, type Post, type PostKind, type Profile, type Reaction } from '../community/calc';

export interface CommunityData { posts: Post[]; comments: Comment[]; reactions: Reaction[]; profiles: Map<string, Profile> }

export const FEED_LIMIT = 100;
/** Broadcasts are loaded on their own, so a busy feed can never push an announcement out of view. */
export const BROADCAST_LIMIT = 50;

/** The latest posts of a gym with their comments and reactions, and the names/pictures of the people involved. */
export async function loadCommunity(gymId: string): Promise<CommunityData> {
  const cols = 'id, user_id, body, created_at, kind';
  const [p, bc] = await Promise.all([
    supabase.from('social_posts').select(cols).eq('gym_id', gymId).eq('kind', 'post').order('created_at', { ascending: false }).limit(FEED_LIMIT),
    supabase.from('social_posts').select(cols).eq('gym_id', gymId).eq('kind', 'broadcast').order('created_at', { ascending: false }).limit(BROADCAST_LIMIT),
  ]);
  if (p.error) throw p.error;
  if (bc.error) throw bc.error;
  const posts = [...(p.data ?? []), ...(bc.data ?? [])].map((r): Post => ({ id: r.id, userId: r.user_id, body: r.body, createdAt: r.created_at, kind: asKind(r.kind) }));
  const ids = posts.map((x) => x.id);
  const c = ids.length
    ? await supabase.from('social_comments').select('id, post_id, user_id, parent_comment_id, body, created_at').eq('gym_id', gymId).in('post_id', ids).order('created_at')
    : { data: [], error: null };
  if (c.error) throw c.error;
  const commentIds = (c.data ?? []).map((x) => x.id);
  const [postLikes, commentLikes] = await Promise.all([
    ids.length ? supabase.from('social_reactions').select('post_id, comment_id, user_id').eq('gym_id', gymId).in('post_id', ids) : { data: [], error: null },
    commentIds.length ? supabase.from('social_reactions').select('post_id, comment_id, user_id').eq('gym_id', gymId).in('comment_id', commentIds) : { data: [], error: null },
  ]);
  if (postLikes.error) throw postLikes.error;
  if (commentLikes.error) throw commentLikes.error;
  const likes = [...(postLikes.data ?? []), ...(commentLikes.data ?? [])];
  const comments = (c.data ?? []).map((x): Comment => ({ id: x.id, postId: x.post_id, userId: x.user_id, parentId: x.parent_comment_id, body: x.body, createdAt: x.created_at }));
  const people = [...new Set([...posts.map((x) => x.userId), ...comments.map((x) => x.userId)])];
  const profiles = new Map<string, Profile>();
  if (people.length) {
    const pr = await supabase.from('profiles').select('id, display_name, first_name, last_name, avatar_url').in('id', people);
    if (pr.error) throw pr.error;
    for (const x of pr.data ?? []) profiles.set(x.id, { id: x.id, displayName: x.display_name, firstName: x.first_name, lastName: x.last_name, avatarUrl: x.avatar_url });
  }
  return { posts, comments, reactions: likes.map((x): Reaction => ({ postId: x.post_id, commentId: x.comment_id, userId: x.user_id })), profiles };
}

export async function createPost(gymId: string, userId: string, body: string, kind: PostKind = 'post'): Promise<void> {
  // Only owners and admins may send a broadcast; the database refuses anyone else.
  const { error } = await supabase.from('social_posts').insert({ gym_id: gymId, user_id: userId, body, kind });
  if (error) throw error;
}

export async function createComment(gymId: string, userId: string, postId: string, parentId: string | null, body: string): Promise<void> {
  const { error } = await supabase.from('social_comments').insert({ gym_id: gymId, post_id: postId, user_id: userId, parent_comment_id: parentId, body });
  if (error) throw error;
}

export async function deletePost(gymId: string, id: string): Promise<void> {
  const { error } = await supabase.from('social_posts').delete().eq('id', id).eq('gym_id', gymId);
  if (error) throw error;
}

export async function deleteComment(gymId: string, id: string): Promise<void> {
  const { error } = await supabase.from('social_comments').delete().eq('id', id).eq('gym_id', gymId);
  if (error) throw error;
}

/** Like or unlike a post or a comment. One like per person per target (the database enforces it). */
export async function setLike(gymId: string, userId: string, target: { postId: string } | { commentId: string }, liked: boolean): Promise<void> {
  const post = 'postId' in target;
  const id = post ? target.postId : target.commentId;
  const { error } = liked
    ? await supabase.from('social_reactions').insert(post ? { gym_id: gymId, user_id: userId, reaction: 'like', post_id: id } : { gym_id: gymId, user_id: userId, reaction: 'like', comment_id: id })
    : await supabase.from('social_reactions').delete().eq('user_id', userId).eq(post ? 'post_id' : 'comment_id', id);
  if (error) throw error;
}
