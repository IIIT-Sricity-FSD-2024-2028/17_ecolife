import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { commentsService, announcementsService } from '../services/miscServices';

export function useComments(entityType, entityId) {
  return useQuery({
    queryKey: ['comments', entityType, entityId],
    queryFn: () => commentsService.list(entityType, entityId),
    enabled: !!entityId,
  });
}

export function usePostComment(entityType, entityId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body) => commentsService.create({ entityType, entityId, body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['comments', entityType, entityId] }),
  });
}

export function useAnnouncements() {
  return useQuery({ queryKey: ['announcements'], queryFn: announcementsService.list });
}

export function useCreateAnnouncement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: announcementsService.create,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['announcements'] }),
  });
}

export function useRemoveAnnouncement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: announcementsService.remove,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['announcements'] }),
  });
}
