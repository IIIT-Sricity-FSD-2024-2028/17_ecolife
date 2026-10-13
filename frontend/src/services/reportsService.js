import { orgApi } from './apiClient';

export const reportsService = {
  list: () => orgApi.get('/reports'),
  get: (id) => orgApi.get(`/reports/${id}`),
  generate: (payload) => orgApi.post('/reports', payload),
  submit: (id, note) => orgApi.post(`/reports/${id}/submit`, note ? { note } : {}),
  approve: (id, comment) => orgApi.post(`/reports/${id}/approve`, { comment }),
  requestRevision: (id, comment) => orgApi.post(`/reports/${id}/request-revision`, { comment }),
  createNewVersion: (id) => orgApi.post(`/reports/${id}/new-version`),
};
