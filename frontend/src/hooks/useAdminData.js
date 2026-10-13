import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { platformAdminService as api } from '../services/platformAdminService';
import { adminAuditLogService } from '../services/auditLogService';

export const useAdminOverview = () => useQuery({ queryKey: ['admin', 'overview'], queryFn: api.overview });
export const useAdminOrganizations = () => useQuery({ queryKey: ['admin', 'organizations'], queryFn: api.organizationsOverview });
export const useAdminSubscriptions = () => useQuery({ queryKey: ['admin', 'subscriptions'], queryFn: api.subscriptions });
export const useAdminPlans = () => useQuery({ queryKey: ['admin', 'plans'], queryFn: api.plans });
export const useAdminResourceTypes = () => useQuery({ queryKey: ['admin', 'resource-types'], queryFn: api.resourceTypes });
export const useAdminFactorSources = () => useQuery({ queryKey: ['admin', 'factor-sources'], queryFn: api.factorSources });
export const useAdminFactorVersions = (typeId) =>
  useQuery({ queryKey: ['admin', 'factor-versions', typeId], queryFn: () => api.factorVersions(typeId), enabled: !!typeId });
export const useAdminAuditLogs = (params) =>
  useQuery({ queryKey: ['admin', 'audit-logs', params], queryFn: () => adminAuditLogService.list(params), placeholderData: (p) => p });
export const useAdminAuditActions = () => useQuery({ queryKey: ['admin', 'audit-actions'], queryFn: adminAuditLogService.actions });

export function useAdminMutations() {
  const qc = useQueryClient();
  const inv = (...keys) => () => keys.forEach((k) => qc.invalidateQueries({ queryKey: ['admin', k] }));
  return {
    setOrgStatus: useMutation({ mutationFn: ({ id, status, reason }) => api.updateOrgStatus(id, status, reason), onSuccess: inv('organizations', 'overview') }),
    createPlan: useMutation({ mutationFn: api.createPlan, onSuccess: inv('plans', 'overview') }),
    updatePlan: useMutation({ mutationFn: ({ id, payload }) => api.updatePlan(id, payload), onSuccess: inv('plans', 'subscriptions') }),
    createResourceType: useMutation({ mutationFn: api.createResourceType, onSuccess: inv('resource-types', 'overview') }),
    createSource: useMutation({ mutationFn: api.createFactorSource, onSuccess: inv('factor-sources', 'overview') }),
    createGlobalFactor: useMutation({ mutationFn: api.createGlobalFactor, onSuccess: inv('factor-versions', 'resource-types', 'overview') }),
  };
}

export async function fetchAllAdminAuditLogs(params) {
  const items = [];
  let offset = 0;
  for (;;) {
    const res = await adminAuditLogService.list({ ...params, offset });
    items.push(...res.items);
    offset += res.items.length;
    if (offset >= res.total || res.items.length === 0) break;
  }
  return items;
}
