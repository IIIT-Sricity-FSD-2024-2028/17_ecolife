import { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { authService } from '../services/authService';
import { getAdminToken, setAdminToken, clearAdminToken, getStoredAdminUser, setStoredAdminUser, clearStoredAdminUser } from '../services/apiClient';
import { queryClient } from '../app/queryClient';

const AdminAuthContext = createContext(null);

function decodeJwtPayload(token) {
  try {
    const payload = token.split('.')[1];
    const padded = payload.padEnd(payload.length + ((4 - (payload.length % 4)) % 4), '=');
    const decoded = atob(padded.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

export function AdminAuthProvider({ children }) {
  const [admin, setAdmin] = useState(() => {
    const token = getAdminToken();
    if (!token) return null;
    const payload = decodeJwtPayload(token);
    const stored = getStoredAdminUser();
    return stored ? { ...payload, ...stored } : payload;
  });

  const login = useCallback(async (email, password) => {
    const result = await authService.adminLogin({ email, password });
    queryClient.clear();
    setAdminToken(result.token);
    if (result.user) {
      setStoredAdminUser(result.user);
    }
    const payload = decodeJwtPayload(result.token);
    const fullAdmin = { ...payload, ...(result.user || {}) };
    setAdmin(fullAdmin);
    if (result.user) {
      queryClient.setQueryData(['admin-me'], result.user);
    }
    return result;
  }, []);

  const logout = useCallback(() => {
    clearAdminToken();
    clearStoredAdminUser();
    queryClient.clear();
    setAdmin(null);
  }, []);

  const updateAdmin = useCallback((patch) => {
    setAdmin((prev) => {
      if (!prev) return prev;
      const next = { ...prev, ...patch };
      setStoredAdminUser(next);
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({ admin, isAuthenticated: !!admin, login, logout, updateAdmin }),
    [admin, login, logout, updateAdmin],
  );

  return <AdminAuthContext.Provider value={value}>{children}</AdminAuthContext.Provider>;
}

export function useAdminAuth() {
  const ctx = useContext(AdminAuthContext);
  if (!ctx) throw new Error('useAdminAuth must be used within AdminAuthProvider');
  return ctx;
}
