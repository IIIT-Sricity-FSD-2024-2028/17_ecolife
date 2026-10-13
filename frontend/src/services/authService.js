import { orgApi, adminApi } from './apiClient';

export const authService = {
  registerOrganization: (payload) => orgApi.post('/auth/register-organization', payload),
  login: (payload) => orgApi.post('/auth/login', payload),
  forgotPassword: (payload) => orgApi.post('/auth/forgot-password', payload),
  resetPassword: (payload) => orgApi.post('/auth/reset-password', payload),

  adminLogin: (payload) => adminApi.post('/admin-auth/login', payload),
  adminForgotPassword: (payload) => adminApi.post('/admin-auth/forgot-password', payload),
  adminResetPassword: (payload) => adminApi.post('/admin-auth/reset-password', payload),
};
