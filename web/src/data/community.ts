import { supabase } from './client';
import type { Comment, Post, Profile, Reaction } from '../community/calc';

export interface CommunityData { posts: Post[]; comments: Comment[]; reactions: Reaction[]; profiles: Map<string, Profile> }

export const FEED_LIMIT = 100;

/** The latest posts of a gym with their comments and reactions, and the names/pictures of the people involved. */
export async function loadCommunity(gymId: string): Promise<CommunityData> {
  const p = await supabase.from('social_posts').select('id, user_id, body, created_at').eq('gym_id', gymId).order('created_at', { ascending: false }).limit(FEED_LIMIT);
  if (p.error) throw p.error;
  const posts = (p.data ?? []).map((r): Post => ({ id: r.id, userId: r.user_id, body: r.body, createdAt: r.created_at }));
  const ids = posts.map((x) => x.id);
  const [c, r] = ids.length
    ? await Promise.all([
        supabase.from('social_comments').select('id, post_id, user_id, parent_comment_id, body, created_at').eq('gym_id', gymId).in('post_id', ids).order('created_at'),
        supabase.from('social_reactions').select('post_id, comment_id').eq('gym_id', gymId).in('post_id', ids),
      ])
    : [{ data: [], error: null }, { data: [], error: null }];
  if (c.error) throw c.error;
  if (r.error) throw r.error;
  const comments = (c.data ?? []).map((x): Comment => ({ id: x.id, postId: x.post_id, userId: x.user_id, parentId: x.parent_comment_id, body: x.body, createdAt: x.created_at }));
  const people = [...new Set([...posts.map((x) => x.userId), ...comments.map((x) => x.userId)])];
  const profiles = new Map<string, Profile>();
  if (people.length) {
    const pr = await supabase.from('profiles').select('id, display_name, first_name, last_name, avatar_url').in('id', people);
    if (pr.error) throw pr.error;
    for (const x of pr.data ?? []) profiles.set(x.id, { id: x.id, displayName: x.display_name, firstName: x.first_name, lastName: x.last_name, avatarUrl: x.avatar_url });
  }
  return { posts, comments, reactions: (r.data ?? []).map((x): Reaction => ({ postId: x.post_id, commentId: x.comment_id })), profiles };
}

export async function createPost(gymId: string, userId: string, body: string): Promise<void> {
  const { error } = await supabase.from('social_posts').insert({ gym_id: gymId, user_id: userId, body });
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
