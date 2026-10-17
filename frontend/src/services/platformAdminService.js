import { adminApi } from './apiClient';

export const platformAdminService = {
  listOrganizations: () => adminApi.get('/platform/organizations'),
  getOrganization: (id) => adminApi.get(`/platform/organizations/${id}`),
  createOrganization: (payload) => adminApi.post('/platform/organizations', payload),
  updateOrganization: (id, payload) => adminApi.patch(`/platform/organizations/${id}`, payload),
  deleteOrganization: (id) => adminApi.delete(`/platform/organizations/${id}`),
  restoreOrganization: (id) => adminApi.post(`/platform/organizations/${id}/restore`),
  purgeOrganization: (id) => adminApi.delete(`/platform/organizations/${id}/purge`),
  updateOrgStatus: (id, status, reason) => adminApi.patch(`/platform/organizations/${id}/status`, { status, ...(reason ? { reason } : {}) }),

  listOrgDepartments: (orgId) => adminApi.get(`/platform/organizations/${orgId}/departments`),
  createOrgDepartment: (orgId, payload) => adminApi.post(`/platform/organizations/${orgId}/departments`, payload),
  updateOrgDepartment: (orgId, deptId, payload) => adminApi.patch(`/platform/organizations/${orgId}/departments/${deptId}`, payload),
  deleteOrgDepartment: (orgId, deptId) => adminApi.delete(`/platform/organizations/${orgId}/departments/${deptId}`),

  listOrgUsers: (orgId) => adminApi.get(`/platform/organizations/${orgId}/users`),
  createOrgUser: (orgId, payload) => adminApi.post(`/platform/organizations/${orgId}/users`, payload),
  updateOrgUser: (orgId, userId, payload) => adminApi.patch(`/platform/organizations/${orgId}/users/${userId}`, payload),
  deactivateOrgUser: (orgId, userId) => adminApi.delete(`/platform/organizations/${orgId}/users/${userId}`),

  listAdmins: () => adminApi.get('/platform/admins'),
  getAdmin: (id) => adminApi.get(`/platform/admins/${id}`),
  inviteAdmin: (payload) => adminApi.post('/platform/admins', payload),
  updateAdmin: (id, payload) => adminApi.patch(`/platform/admins/${id}`, payload),
  removeAdmin: (id) => adminApi.delete(`/platform/admins/${id}`),
  restoreAdmin: (id) => adminApi.post(`/platform/admins/${id}/restore`),
  purgeAdmin: (id) => adminApi.delete(`/platform/admins/${id}/purge`),

  getSettings: () => adminApi.get('/platform/settings'),
  updateSettings: (payload) => adminApi.patch('/platform/settings', payload),

  createPlan: (payload) => adminApi.post('/plans', payload),
  updatePlan: (id, payload) => adminApi.patch(`/platform/plans/${id}`, payload),
  deletePlan: (id) => adminApi.delete(`/platform/plans/${id}`),

  overview: () => adminApi.get('/platform/overview'),
  organizationsOverview: () => adminApi.get('/platform/organizations-overview'),
  subscriptions: () => adminApi.get('/platform/subscriptions'),
  updateSubscription: (id, payload) => adminApi.patch(`/platform/subscriptions/${id}`, payload),
  invoices: () => adminApi.get('/platform/invoices'),
  plans: () => adminApi.get('/platform/plans'),

  resourceTypes: () => adminApi.get('/platform/resource-types'),
  createResourceType: (payload) => adminApi.post('/resource-types', payload),
  updateResourceType: (id, payload) => adminApi.patch(`/resource-types/${id}`, payload),
  deleteResourceType: (id) => adminApi.delete(`/resource-types/${id}`),

  factorSources: () => adminApi.get('/platform/factors/sources'),
  createFactorSource: (payload) => adminApi.post('/factors/sources', payload),
  updateFactorSource: (id, payload) => adminApi.patch(`/factors/sources/${id}`, payload),
  deleteFactorSource: (id) => adminApi.delete(`/factors/sources/${id}`),

  factorVersions: (resourceTypeId) => adminApi.get(`/platform/factors/versions/${resourceTypeId}`),
  createGlobalFactor: (payload) => adminApi.post('/factors/versions/global', payload),
  updateFactorVersion: (id, payload) => adminApi.patch(`/factors/versions/${id}`, payload),
  deleteFactorVersion: (id) => adminApi.delete(`/factors/versions/${id}`),
};
