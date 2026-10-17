import { orgApi } from './apiClient';

export const resourceRecordsService = {
  list: () => orgApi.get('/resource-records'),
  get: (id) => orgApi.get(`/resource-records/${id}`),
  create: (payload) => orgApi.post('/resource-records', payload),
  update: (id, payload) => orgApi.patch(`/resource-records/${id}`, payload),
  delete: (id) => orgApi.delete(`/resource-records/${id}`),
  submit: (id) => orgApi.post(`/resource-records/${id}/submit`),
  approve: (id, comment) => orgApi.post(`/resource-records/${id}/approve`, { comment }),
  reject: (id, comment) => orgApi.post(`/resource-records/${id}/reject`, { comment }),
  requestChanges: (id, comment) => orgApi.post(`/resource-records/${id}/request-changes`, { comment }),
  claim: (id) => orgApi.post(`/resource-records/${id}/claim`),
  release: (id) => orgApi.post(`/resource-records/${id}/release`),
  recalculate: (id) => orgApi.post(`/resource-records/${id}/recalculate`),
  downloadEvidence: (recordId, evidence) =>
    orgApi.download(`/resource-records/${recordId}/evidence/${evidence.id}/download`, evidence.fileName),
  getEvidenceBlob: (recordId, evidenceId) =>
    orgApi.getBlob(`/resource-records/${recordId}/evidence/${evidenceId}/download`),
  listEvidence: (recordId) => orgApi.get(`/resource-records/${recordId}/evidence`),
  uploadEvidence: (recordId, file) => {
    const formData = new FormData();
    formData.append('file', file);
    return orgApi.postForm(`/resource-records/${recordId}/evidence`, formData);
  },
  deleteEvidence: (recordId, evidenceId) =>
    orgApi.delete(`/resource-records/${recordId}/evidence/${evidenceId}`),
  listAmendments: (recordId) => orgApi.get(`/resource-records/${recordId}/amendments`),
  proposeAmendment: (recordId, payload) => orgApi.post(`/resource-records/${recordId}/amendments`, payload),
  approveAmendment: (amendmentId, comment) => orgApi.post(`/amendments/${amendmentId}/approve`, { comment }),
  rejectAmendment: (amendmentId, comment) => orgApi.post(`/amendments/${amendmentId}/reject`, { comment }),
};

export const resourceTypesService = {
  list: () => orgApi.get('/resource-types'),
  get: (id) => orgApi.get(`/resource-types/${id}`),
};
