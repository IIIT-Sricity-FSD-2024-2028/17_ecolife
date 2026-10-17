import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { platformAdminService as api } from '../services/platformAdminService';
import { adminAuditLogService } from '../services/auditLogService';

export const useAdminOverview = () => useQuery({ queryKey: ['admin', 'overview'], queryFn: api.overview });
export const useAdminOrganizations = () => useQuery({ queryKey: ['admin', 'organizations'], queryFn: api.organizationsOverview });
export const useAdminSubscriptions = () => useQuery({ queryKey: ['admin', 'subscriptions'], queryFn: api.subscriptions });
export const useAdminInvoices = () => useQuery({ queryKey: ['admin', 'invoices'], queryFn: api.invoices });
export const useAdminPlans = () => useQuery({ queryKey: ['admin', 'plans'], queryFn: api.plans });
export const useAdminResourceTypes = () => useQuery({ queryKey: ['admin', 'resource-types'], queryFn: api.resourceTypes });
export const useAdminFactorSources = () => useQuery({ queryKey: ['admin', 'factor-sources'], queryFn: api.factorSources });
export const useAdminFactorVersions = (typeId) =>
  useQuery({ queryKey: ['admin', 'factor-versions', typeId], queryFn: () => api.factorVersions(typeId), enabled: !!typeId });
export const useAdminOrgDepartments = (orgId) =>
  useQuery({ queryKey: ['admin', 'org-departments', orgId], queryFn: () => api.listOrgDepartments(orgId), enabled: !!orgId });
export const useAdminOrgUsers = (orgId) =>
  useQuery({ queryKey: ['admin', 'org-users', orgId], queryFn: () => api.listOrgUsers(orgId), enabled: !!orgId });
export const useAdminAuditLogs = (params) =>
  useQuery({ queryKey: ['admin', 'audit-logs', params], queryFn: () => adminAuditLogService.list(params), placeholderData: (p) => p });
export const useAdminAuditActions = () => useQuery({ queryKey: ['admin', 'audit-actions'], queryFn: adminAuditLogService.actions });
export const useAdminTeam = () => useQuery({ queryKey: ['admin', 'team'], queryFn: api.listAdmins });

export function useAdminMutations() {
  const qc = useQueryClient();
  const inv = (...keys) => () => keys.forEach((k) => qc.invalidateQueries({ queryKey: ['admin', k] }));
  return {
    createOrganization: useMutation({ mutationFn: api.createOrganization, onSuccess: inv('organizations', 'overview') }),
    updateOrganization: useMutation({ mutationFn: ({ id, payload }) => api.updateOrganization(id, payload), onSuccess: inv('organizations', 'overview') }),
    deleteOrganization: useMutation({ mutationFn: (id) => api.deleteOrganization(id), onSuccess: inv('organizations', 'overview') }),
    restoreOrganization: useMutation({ mutationFn: (id) => api.restoreOrganization(id), onSuccess: inv('organizations', 'overview') }),
    purgeOrganization: useMutation({ mutationFn: (id) => api.purgeOrganization(id), onSuccess: inv('organizations', 'overview') }),
    setOrgStatus: useMutation({ mutationFn: ({ id, status, reason }) => api.updateOrgStatus(id, status, reason), onSuccess: inv('organizations', 'overview') }),

    createOrgDepartment: useMutation({
      mutationFn: ({ orgId, payload }) => api.createOrgDepartment(orgId, payload),
      onSuccess: (_res, vars) => qc.invalidateQueries({ queryKey: ['admin', 'org-departments', vars.orgId] }),
    }),
    updateOrgDepartment: useMutation({
      mutationFn: ({ orgId, deptId, payload }) => api.updateOrgDepartment(orgId, deptId, payload),
      onSuccess: (_res, vars) => qc.invalidateQueries({ queryKey: ['admin', 'org-departments', vars.orgId] }),
    }),
    deleteOrgDepartment: useMutation({
      mutationFn: ({ orgId, deptId }) => api.deleteOrgDepartment(orgId, deptId),
      onSuccess: (_res, vars) => {
        qc.invalidateQueries({ queryKey: ['admin', 'org-departments', vars.orgId] });
        qc.invalidateQueries({ queryKey: ['admin', 'org-users', vars.orgId] });
      },
    }),

    createOrgUser: useMutation({
      mutationFn: ({ orgId, payload }) => api.createOrgUser(orgId, payload),
      onSuccess: (_res, vars) => {
        qc.invalidateQueries({ queryKey: ['admin', 'org-users', vars.orgId] });
        qc.invalidateQueries({ queryKey: ['admin', 'org-departments', vars.orgId] });
        qc.invalidateQueries({ queryKey: ['admin', 'organizations'] });
      },
    }),
    updateOrgUser: useMutation({
      mutationFn: ({ orgId, userId, payload }) => api.updateOrgUser(orgId, userId, payload),
      onSuccess: (_res, vars) => {
        qc.invalidateQueries({ queryKey: ['admin', 'org-users', vars.orgId] });
        qc.invalidateQueries({ queryKey: ['admin', 'org-departments', vars.orgId] });
      },
    }),
    deactivateOrgUser: useMutation({
      mutationFn: ({ orgId, userId }) => api.deactivateOrgUser(orgId, userId),
      onSuccess: (_res, vars) => {
        qc.invalidateQueries({ queryKey: ['admin', 'org-users', vars.orgId] });
        qc.invalidateQueries({ queryKey: ['admin', 'org-departments', vars.orgId] });
      },
    }),

    createPlan: useMutation({ mutationFn: api.createPlan, onSuccess: inv('plans', 'overview') }),
    updatePlan: useMutation({ mutationFn: ({ id, payload }) => api.updatePlan(id, payload), onSuccess: inv('plans', 'subscriptions') }),
    deletePlan: useMutation({ mutationFn: (id) => api.deletePlan(id), onSuccess: inv('plans', 'overview') }),
    updateSubscription: useMutation({
      mutationFn: ({ id, payload }) => api.updateSubscription(id, payload),
      onSuccess: inv('subscriptions', 'overview', 'organizations'),
    }),
    createResourceType: useMutation({ mutationFn: api.createResourceType, onSuccess: inv('resource-types', 'overview') }),
    updateResourceType: useMutation({ mutationFn: ({ id, payload }) => api.updateResourceType(id, payload), onSuccess: inv('resource-types', 'overview') }),
    deleteResourceType: useMutation({ mutationFn: (id) => api.deleteResourceType(id), onSuccess: inv('resource-types', 'overview') }),

    createSource: useMutation({ mutationFn: api.createFactorSource, onSuccess: inv('factor-sources', 'overview') }),
    updateFactorSource: useMutation({ mutationFn: ({ id, payload }) => api.updateFactorSource(id, payload), onSuccess: inv('factor-sources', 'overview') }),
    deleteFactorSource: useMutation({ mutationFn: (id) => api.deleteFactorSource(id), onSuccess: inv('factor-sources', 'overview') }),

    createGlobalFactor: useMutation({ mutationFn: api.createGlobalFactor, onSuccess: inv('factor-versions', 'resource-types', 'overview') }),
    updateFactorVersion: useMutation({ mutationFn: ({ id, payload }) => api.updateFactorVersion(id, payload), onSuccess: inv('factor-versions', 'resource-types', 'overview') }),
    deleteFactorVersion: useMutation({ mutationFn: (id) => api.deleteFactorVersion(id), onSuccess: inv('factor-versions', 'resource-types', 'overview') }),

    inviteAdmin: useMutation({ mutationFn: api.inviteAdmin, onSuccess: inv('team') }),
    updateAdmin: useMutation({ mutationFn: ({ id, payload }) => api.updateAdmin(id, payload), onSuccess: inv('team') }),
    removeAdmin: useMutation({ mutationFn: (id) => api.removeAdmin(id), onSuccess: inv('team') }),
    restoreAdmin: useMutation({ mutationFn: (id) => api.restoreAdmin(id), onSuccess: inv('team') }),
    purgeAdmin: useMutation({ mutationFn: (id) => api.purgeAdmin(id), onSuccess: inv('team') }),
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
