import { orgApi } from './apiClient';

export const targetsService = {
  list: () => orgApi.get('/targets'),
  get: (id) => orgApi.get(`/targets/${id}`),
  create: (payload) => orgApi.post('/targets', payload),
  update: (id, payload) => orgApi.patch(`/targets/${id}`, payload),
  remove: (id) => orgApi.delete(`/targets/${id}`),
};

export const alertsService = {
  list: () => orgApi.get('/alerts'),
  respond: (id, payload) => orgApi.post(`/alerts/${id}/respond`, payload),
  acknowledge: (id) => orgApi.post(`/alerts/${id}/acknowledge`),
  close: (id, comment) => orgApi.post(`/alerts/${id}/close`, { comment }),
};

export const billingService = {
  getSubscription: () => orgApi.get('/billing/subscription'),
  getInvoices: () => orgApi.get('/billing/invoices'),
  listPlans: () => orgApi.get('/plans'),
  changePlan: (planId) => orgApi.post('/billing/change-plan', { planId }),
};

export const importsService = {
  list: () => orgApi.get('/imports'),
  get: (id) => orgApi.get(`/imports/${id}`),
  importCsv: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return orgApi.postForm('/imports/resource-records', formData);
  },
};

export const commentsService = {
  list: (entityType, entityId) => orgApi.get(`/comments?entityType=${encodeURIComponent(entityType)}&entityId=${encodeURIComponent(entityId)}`),
  create: (payload) => orgApi.post('/comments', payload),
};

export const announcementsService = {
  list: () => orgApi.get('/announcements'),
  create: (payload) => orgApi.post('/announcements', payload),
  remove: (id) => orgApi.delete(`/announcements/${id}`),
};
