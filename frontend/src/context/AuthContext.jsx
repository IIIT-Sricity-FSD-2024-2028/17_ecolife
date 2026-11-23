import React, { createContext, useCallback, useContext, useEffect, useReducer } from 'react';
import { apiFetch, getToken, setToken } from '../services/apiClient';

const initialState = {
  booting: true,
  user: null,
  organization: null
};

function authReducer(state, action) {
  switch (action.type) {
    case 'BOOTSTRAP_SUCCESS':
      return { booting: false, user: action.user, organization: action.organization };
    case 'BOOTSTRAP_EMPTY':
      return { booting: false, user: null, organization: null };
    case 'UPDATE_ORG':
      return { ...state, organization: action.organization };
    case 'LOGOUT':
      return { booting: false, user: null, organization: null };
    default:
      return state;
  }
}

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [state, dispatch] = useReducer(authReducer, initialState);

  const refreshMe = useCallback(async () => {
    if (!getToken()) {
      dispatch({ type: 'BOOTSTRAP_EMPTY' });
      return;
    }
    try {
      const me = await apiFetch('/auth/me');
      dispatch({ type: 'BOOTSTRAP_SUCCESS', user: me, organization: me.organization ?? null });
    } catch {
      setToken(null);
      dispatch({ type: 'BOOTSTRAP_EMPTY' });
    }
  }, []);

  useEffect(() => {
    refreshMe();
  }, [refreshMe]);

  const loginSuccess = useCallback((token, user, org) => {
    setToken(token);
    dispatch({ type: 'BOOTSTRAP_SUCCESS', user, organization: org ?? user?.organization ?? null });
  }, []);

  const logout = useCallback(async () => {
    await apiFetch('/auth/logout', { method: 'POST' }).catch(() => {});
    setToken(null);
    dispatch({ type: 'LOGOUT' });
  }, []);

  const setOrganization = useCallback((organization) => {
    dispatch({ type: 'UPDATE_ORG', organization });
  }, []);

  return (
    <AuthContext.Provider value={{ ...state, refreshMe, loginSuccess, logout, setOrganization }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
