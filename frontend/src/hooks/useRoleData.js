import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { profileService } from '../services/profileService';
import { analyticsService, amendmentsService, factorsService } from '../services/analyticsService';
import { importsService } from '../services/miscServices';
import { resourceRecordsService } from '../services/resourceRecordsService';
import { auditLogService } from '../services/auditLogService';
import { departmentsService, locationsService } from '../services/departmentsService';
import { orgUsersService } from '../services/orgUsersService';

export function useProfile() {
  return useQuery({ queryKey: ['me'], queryFn: profileService.get });
}
export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: profileService.update, onSuccess: () => qc.invalidateQueries({ queryKey: ['me'] }) });
}
export function useChangePassword() {
  return useMutation({ mutationFn: profileService.changePassword });
}

export function useEmissions(params) {
  return useQuery({ queryKey: ['analytics', 'emissions', params], queryFn: () => analyticsService.emissions(params) });
}

export function useAmendments() {
  return useQuery({ queryKey: ['amendments'], queryFn: amendmentsService.list });
}
export function useProposeAmendment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ recordId, payload }) => resourceRecordsService.proposeAmendment(recordId, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['amendments'] }),
  });
}

export function useFactorSources() {
  return useQuery({ queryKey: ['factor-sources'], queryFn: factorsService.listSources });
}
export function useFactorVersions(resourceTypeId) {
  return useQuery({
    queryKey: ['factor-versions', resourceTypeId || 'all'],
    queryFn: () => factorsService.listVersions(resourceTypeId),
  });
}
export function useCreateFactorOverride() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: factorsService.createOverride,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['factor-versions'] }),
  });
}

export function useEvidence(recordId) {
  return useQuery({
    queryKey: ['evidence', recordId],
    queryFn: () => resourceRecordsService.listEvidence(recordId),
    enabled: !!recordId,
  });
}

export function useImportBatches() {
  return useQuery({ queryKey: ['imports'], queryFn: importsService.list });
}
export function useImportCsv() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: importsService.importCsv,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['imports'] });
      qc.invalidateQueries({ queryKey: ['resource-records'] });
    },
  });
}

export function useRecalculate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: resourceRecordsService.recalculate,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['resource-records'] });
      qc.invalidateQueries({ queryKey: ['analytics'] });
    },
  });
}

export function useAuditLogs(params) {
  return useQuery({ queryKey: ['audit-logs', params], queryFn: () => auditLogService.list(params), placeholderData: (prev) => prev });
}
export function useAuditActions() {
  return useQuery({ queryKey: ['audit-actions'], queryFn: auditLogService.actions });
}

export function useAmendmentDecision() {
  const qc = useQueryClient();
  const done = () => {
    qc.invalidateQueries({ queryKey: ['amendments'] });
    qc.invalidateQueries({ queryKey: ['reports'] });
    qc.invalidateQueries({ queryKey: ['resource-records'] });
    qc.invalidateQueries({ queryKey: ['analytics'] });
  };
  const approve = useMutation({ mutationFn: ({ id, comment }) => resourceRecordsService.approveAmendment(id, comment), onSuccess: done });
  const reject = useMutation({ mutationFn: ({ id, comment }) => resourceRecordsService.rejectAmendment(id, comment), onSuccess: done });
  return { approve, reject };
}

/** Department / location / staff mutations used by the Org Admin pages. */
export function useOrgAdminActions() {
  const qc = useQueryClient();
  const inv = (...keys) => () => keys.forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
  return {
    updateDepartment: useMutation({ mutationFn: ({ id, payload }) => departmentsService.update(id, payload), onSuccess: inv('departments') }),
    deleteDepartment: useMutation({ mutationFn: departmentsService.remove, onSuccess: inv('departments', 'locations', 'org-users') }),
    createLocation: useMutation({ mutationFn: locationsService.create, onSuccess: inv('locations') }),
    updateLocation: useMutation({ mutationFn: ({ id, payload }) => locationsService.update(id, payload), onSuccess: inv('locations') }),
    deleteLocation: useMutation({ mutationFn: locationsService.remove, onSuccess: inv('locations') }),
    updateUser: useMutation({ mutationFn: ({ id, payload }) => orgUsersService.update(id, payload), onSuccess: inv('org-users') }),
  };
}
