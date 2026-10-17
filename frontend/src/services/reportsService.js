import { orgApi } from './apiClient';

export const reportsService = {
  list: () => orgApi.get('/reports'),
  get: (id) => orgApi.get(`/reports/${id}`),
  generate: (payload) => orgApi.post('/reports', payload),
  preview: (periodStart, periodEnd) =>
    orgApi.get(`/reports/preview?periodStart=${encodeURIComponent(periodStart)}&periodEnd=${encodeURIComponent(periodEnd)}`),
  update: (id, payload) => orgApi.patch(`/reports/${id}`, payload),
  submit: (id, note) => orgApi.post(`/reports/${id}/submit`, note ? { note } : {}),
  approve: (id, comment) => orgApi.post(`/reports/${id}/approve`, { comment }),
  requestRevision: (id, comment) => orgApi.post(`/reports/${id}/request-revision`, { comment }),
  createNewVersion: (id) => orgApi.post(`/reports/${id}/new-version`),
  delete: (id) => orgApi.delete(`/reports/${id}`),
  exportPdf: (id, filename) => orgApi.download(`/reports/${id}/export/pdf`, filename || `tropos-report-${id}.pdf`),
};
