import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { departmentsService, locationsService } from '../services/departmentsService';
import { orgUsersService } from '../services/orgUsersService';
import { alertsService, targetsService, billingService } from '../services/miscServices';
import { reportsService } from '../services/reportsService';

export function useDepartments() {
  return useQuery({ queryKey: ['departments'], queryFn: departmentsService.list });
}
export function useCreateDepartment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: departmentsService.create,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['departments'] }),
  });
}
export function useLocations(departmentId) {
  return useQuery({
    queryKey: ['locations', departmentId],
    queryFn: () => locationsService.list(departmentId),
  });
}

export function useOrgUsers() {
  return useQuery({ queryKey: ['org-users'], queryFn: orgUsersService.list });
}
export function useInviteOrgUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: orgUsersService.invite,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['org-users'] }),
  });
}
export function useDeactivateOrgUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: orgUsersService.deactivate,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['org-users'] }),
  });
}

export function useAlerts() {
  return useQuery({ queryKey: ['alerts'], queryFn: alertsService.list });
}
export function useRespondToAlert() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }) => alertsService.respond(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['alerts'] }),
  });
}
export function useAcknowledgeAlert() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => alertsService.acknowledge(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['alerts'] }),
  });
}
export function useCloseAlert() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, comment }) => alertsService.close(id, comment),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['alerts'] }),
  });
}

export function useTargets() {
  return useQuery({ queryKey: ['targets'], queryFn: targetsService.list });
}
export function useCreateTarget() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: targetsService.create,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['targets'] }),
  });
}
export function useUpdateTarget() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }) => targetsService.update(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['targets'] }),
  });
}
export function useDeleteTarget() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => targetsService.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['targets'] }),
  });
}

export function useReports() {
  return useQuery({ queryKey: ['reports'], queryFn: reportsService.list });
}
export function useReport(id) {
  return useQuery({ queryKey: ['reports', id], queryFn: () => reportsService.get(id), enabled: !!id });
}
export function useGenerateReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: reportsService.generate,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['reports'] }),
  });
}
export function useUpdateReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...payload }) => reportsService.update(id, payload),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ['reports'] });
      qc.invalidateQueries({ queryKey: ['reports', id] });
    },
  });
}
export function useDeleteReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: reportsService.delete,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reports'] });
    },
  });
}
export function useReportActions() {
  const qc = useQueryClient();
  const invalidate = (id) => {
    qc.invalidateQueries({ queryKey: ['reports'] });
    qc.invalidateQueries({ queryKey: ['reports', id] });
  };
  const submit = useMutation({ mutationFn: ({ id, note }) => reportsService.submit(id, note), onSuccess: (_, { id }) => invalidate(id) });
  const approve = useMutation({
    mutationFn: ({ id, comment }) => reportsService.approve(id, comment),
    onSuccess: (_, { id }) => invalidate(id),
  });
  const requestRevision = useMutation({
    mutationFn: ({ id, comment }) => reportsService.requestRevision(id, comment),
    onSuccess: (_, { id }) => invalidate(id),
  });
  const remove = useMutation({
    mutationFn: (id) => reportsService.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['reports'] }),
  });
  return { submit, approve, requestRevision, remove };
}

export function useSubscription() {
  return useQuery({ queryKey: ['subscription'], queryFn: billingService.getSubscription });
}
export function usePlans() {
  return useQuery({ queryKey: ['plans'], queryFn: billingService.listPlans });
}
