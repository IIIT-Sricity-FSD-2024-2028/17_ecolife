import { orgApi } from './apiClient';

const qs = (params = {}) => {
  const p = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => v && p.set(k, v));
  const s = p.toString();
  return s ? `?${s}` : '';
};

export const analyticsService = {
  emissions: (params) => orgApi.get(`/analytics/emissions${qs(params)}`),
};

export const amendmentsService = {
  list: () => orgApi.get('/amendments'),
};

export const factorsService = {
  listSources: () => orgApi.get('/factors/sources'),
  listVersions: (resourceTypeId) => orgApi.get(resourceTypeId ? `/factors/versions/${resourceTypeId}` : '/factors/versions'),
  createOverride: (payload) => orgApi.post('/factors/versions/override', payload),
};
