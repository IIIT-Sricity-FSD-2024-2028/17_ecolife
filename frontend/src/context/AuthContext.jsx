import { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { authService } from '../services/authService';
import { getOrgToken, setOrgToken, clearOrgToken, getStoredOrgUser, setStoredOrgUser, clearStoredOrgUser } from '../services/apiClient';
import { queryClient } from '../app/queryClient';

export const AuthContext = createContext(null);

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

/**
 * Provides the current org-portal user + auth actions to the whole app.
 * State lives here (lifted to the top of the org portal tree) because
 * every page and the sidebar/topbar all need to know who's logged in and
 * what role they have — a textbook "lift state to the common parent" case.
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const token = getOrgToken();
    if (!token) return null;
    const payload = decodeJwtPayload(token);
    const stored = getStoredOrgUser();
    return stored ? { ...payload, ...stored } : payload;
  });

  const login = useCallback(async (email, password, remember = false) => {
    const result = await authService.login({ email, password, remember });
    queryClient.clear();
    setOrgToken(result.token, remember);
    if (result.user) {
      setStoredOrgUser(result.user, remember);
    }
    const payload = decodeJwtPayload(result.token);
    const fullUser = { ...payload, ...(result.user || {}) };
    setUser(fullUser);
    if (result.user) {
      queryClient.setQueryData(['me'], result.user);
    }
    return result;
  }, []);

  const registerOrganization = useCallback(async (payload) => {
    // Registration intentionally does not create a session; the owner signs
    // in from the normal login screen after the account is created.
    return authService.registerOrganization(payload);
  }, []);

  const logout = useCallback(() => {
    clearOrgToken();
    clearStoredOrgUser();
    queryClient.clear();
    setUser(null);
  }, []);

  const updateUser = useCallback((patch) => {
    setUser((prev) => {
      if (!prev) return prev;
      const next = { ...prev, ...patch };
      const remember = localStorage.getItem('tropos_org_token') !== null;
      setStoredOrgUser(next, remember);
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({ user, isAuthenticated: !!user, login, registerOrganization, logout, updateUser }),
    [user, login, registerOrganization, logout, updateUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
