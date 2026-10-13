import { orgApi, adminApi } from './apiClient';

export const profileService = {
  get: () => orgApi.get('/me'),
  update: (payload) => orgApi.patch('/me', payload),
  changePassword: (payload) => orgApi.post('/me/change-password', payload),
};

export const adminProfileService = {
  get: () => adminApi.get('/platform/me'),
  update: (payload) => adminApi.patch('/platform/me', payload),
  changePassword: (payload) => adminApi.post('/platform/me/change-password', payload),
};
