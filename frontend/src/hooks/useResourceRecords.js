import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { resourceRecordsService, resourceTypesService } from '../services/resourceRecordsService';

export function useResourceRecords() {
  return useQuery({ queryKey: ['resource-records'], queryFn: resourceRecordsService.list });
}

export function useResourceRecord(id) {
  return useQuery({
    queryKey: ['resource-records', id],
    queryFn: () => resourceRecordsService.get(id),
    enabled: !!id,
  });
}

export function useResourceTypes() {
  return useQuery({ queryKey: ['resource-types'], queryFn: resourceTypesService.list });
}

export function useCreateResourceRecord() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: resourceRecordsService.create,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['resource-records'] }),
  });
}

export function useUpdateResourceRecord() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }) => resourceRecordsService.update(id, payload),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['resource-records'] });
      queryClient.invalidateQueries({ queryKey: ['resource-records', id] });
    },
  });
}

export function useSubmitResourceRecord() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: resourceRecordsService.submit,
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['resource-records'] });
      queryClient.invalidateQueries({ queryKey: ['resource-records', id] });
    },
  });
}

export function useReviewResourceRecord() {
  const queryClient = useQueryClient();
  const invalidate = (id) => {
    queryClient.invalidateQueries({ queryKey: ['resource-records'] });
    queryClient.invalidateQueries({ queryKey: ['resource-records', id] });
  };
  const approve = useMutation({
    mutationFn: ({ id, comment }) => resourceRecordsService.approve(id, comment),
    onSuccess: (_, { id }) => invalidate(id),
  });
  const reject = useMutation({
    mutationFn: ({ id, comment }) => resourceRecordsService.reject(id, comment),
    onSuccess: (_, { id }) => invalidate(id),
  });
  const requestChanges = useMutation({
    mutationFn: ({ id, comment }) => resourceRecordsService.requestChanges(id, comment),
    onSuccess: (_, { id }) => invalidate(id),
  });
  return { approve, reject, requestChanges };
}
