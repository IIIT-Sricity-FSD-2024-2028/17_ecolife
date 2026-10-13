import { orgApi } from './apiClient';

export const departmentsService = {
  list: () => orgApi.get('/departments'),
  get: (id) => orgApi.get(`/departments/${id}`),
  create: (payload) => orgApi.post('/departments', payload),
  update: (id, payload) => orgApi.patch(`/departments/${id}`, payload),
  remove: (id) => orgApi.delete(`/departments/${id}`),
};

export const locationsService = {
  list: (departmentId) => orgApi.get(departmentId ? `/locations?departmentId=${departmentId}` : '/locations'),
  create: (payload) => orgApi.post('/locations', payload),
  update: (id, payload) => orgApi.patch(`/locations/${id}`, payload),
  remove: (id) => orgApi.delete(`/locations/${id}`),
};
