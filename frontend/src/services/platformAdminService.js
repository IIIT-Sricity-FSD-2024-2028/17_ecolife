import { adminApi } from './apiClient';

export const platformAdminService = {
  listOrganizations: () => adminApi.get('/platform/organizations'),
  getOrganization: (id) => adminApi.get(`/platform/organizations/${id}`),
  updateOrgStatus: (id, status, reason) => adminApi.patch(`/platform/organizations/${id}/status`, { status, ...(reason ? { reason } : {}) }),

  listAdmins: () => adminApi.get('/platform/admins'),
  inviteAdmin: (payload) => adminApi.post('/platform/admins', payload),
  removeAdmin: (id) => adminApi.delete(`/platform/admins/${id}`),

  getSettings: () => adminApi.get('/platform/settings'),
  updateSettings: (payload) => adminApi.patch('/platform/settings', payload),

  createPlan: (payload) => adminApi.post('/plans', payload),
  updatePlan: (id, payload) => adminApi.patch(`/platform/plans/${id}`, payload),

  overview: () => adminApi.get('/platform/overview'),
  organizationsOverview: () => adminApi.get('/platform/organizations-overview'),
  subscriptions: () => adminApi.get('/platform/subscriptions'),
  plans: () => adminApi.get('/platform/plans'),

  resourceTypes: () => adminApi.get('/platform/resource-types'),
  createResourceType: (payload) => adminApi.post('/resource-types', payload),
  factorSources: () => adminApi.get('/platform/factors/sources'),
  createFactorSource: (payload) => adminApi.post('/factors/sources', payload),
  factorVersions: (resourceTypeId) => adminApi.get(`/platform/factors/versions/${resourceTypeId}`),
  createGlobalFactor: (payload) => adminApi.post('/factors/versions/global', payload),
};
