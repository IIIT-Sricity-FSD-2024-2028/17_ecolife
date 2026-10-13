import { orgApi, adminApi } from './apiClient';

const qs = (params = {}) => {
  const p = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => v !== '' && v != null && p.set(k, v));
  const s = p.toString();
  return s ? `?${s}` : '';
};

export const auditLogService = {
  list: (params) => orgApi.get(`/audit-logs${qs(params)}`),
  actions: () => orgApi.get('/audit-logs/actions'),
};

export const adminAuditLogService = {
  list: (params) => adminApi.get(`/platform/audit-logs${qs(params)}`),
  actions: () => adminApi.get('/platform/audit-logs/actions'),
};
