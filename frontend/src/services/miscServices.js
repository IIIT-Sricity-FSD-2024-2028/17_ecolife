import { orgApi } from './apiClient';

export const targetsService = {
  list: () => orgApi.get('/targets'),
  get: (id) => orgApi.get(`/targets/${id}`),
  create: (payload) => orgApi.post('/targets', payload),
};

export const alertsService = {
  list: () => orgApi.get('/alerts'),
  respond: (id, payload) => orgApi.post(`/alerts/${id}/respond`, payload),
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
