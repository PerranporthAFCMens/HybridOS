import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as api from '../data/community';
import type { PostKind } from './calc';

export function useCommunity(gymId: string) {
  return useQuery({ queryKey: ['community', gymId], queryFn: () => api.loadCommunity(gymId) });
}

export function useCommunityWrites(gymId: string, userId: string) {
  const qc = useQueryClient();
  const onSuccess = () => qc.invalidateQueries({ queryKey: ['community', gymId] });
  return {
    post: useMutation({ mutationFn: (v: { body: string; kind: PostKind }) => api.createPost(gymId, userId, v.body, v.kind), onSuccess }),
    comment: useMutation({ mutationFn: (v: { postId: string; parentId: string | null; body: string }) => api.createComment(gymId, userId, v.postId, v.parentId, v.body), onSuccess }),
    like: useMutation({ mutationFn: (v: { target: { postId: string } | { commentId: string }; liked: boolean }) => api.setLike(gymId, userId, v.target, v.liked), onSuccess }),
    removePost: useMutation({ mutationFn: (id: string) => api.deletePost(gymId, id), onSuccess }),
    removeComment: useMutation({ mutationFn: (id: string) => api.deleteComment(gymId, id), onSuccess }),
  };
}
