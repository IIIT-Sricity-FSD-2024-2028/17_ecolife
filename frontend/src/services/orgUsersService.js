import { orgApi } from './apiClient';

export const orgUsersService = {
  list: () => orgApi.get('/org-users'),
  get: (id) => orgApi.get(`/org-users/${id}`),
  invite: (payload) => orgApi.post('/org-users', payload),
  update: (id, payload) => orgApi.patch(`/org-users/${id}`, payload),
  deactivate: (id) => orgApi.delete(`/org-users/${id}`),
};
