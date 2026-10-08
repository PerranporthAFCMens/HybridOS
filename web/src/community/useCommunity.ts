import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as api from '../data/community';

export function useCommunity(gymId: string) {
  return useQuery({ queryKey: ['community', gymId], queryFn: () => api.loadCommunity(gymId) });
}

export function useCommunityWrites(gymId: string, userId: string) {
  const qc = useQueryClient();
  const onSuccess = () => qc.invalidateQueries({ queryKey: ['community', gymId] });
  return {
    post: useMutation({ mutationFn: (body: string) => api.createPost(gymId, userId, body), onSuccess }),
    comment: useMutation({ mutationFn: (v: { postId: string; parentId: string | null; body: string }) => api.createComment(gymId, userId, v.postId, v.parentId, v.body), onSuccess }),
    removePost: useMutation({ mutationFn: (id: string) => api.deletePost(gymId, id), onSuccess }),
    removeComment: useMutation({ mutationFn: (id: string) => api.deleteComment(gymId, id), onSuccess }),
  };
}
