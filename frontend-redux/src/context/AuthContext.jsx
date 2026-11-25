import React, { useEffect, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { bootstrapAuth, organizationUpdated, selectAuth, signOut, signedIn } from '../store/slices/app/authSlice';

/** Loads who is signed in once, when the app starts. The state itself lives in the store (auth slice). */
export function AuthProvider({ children }) {
  const dispatch = useDispatch();
  useEffect(() => { dispatch(bootstrapAuth()); }, [dispatch]);
  return children;
}

/** Same shape the pages already use, now read from the store. */
export function useAuth() {
  const dispatch = useDispatch();
  const { booting, user, organization } = useSelector(selectAuth);
  const actions = useMemo(() => ({
    refreshMe: () => dispatch(bootstrapAuth()),
    loginSuccess: (token, u, org) => dispatch(signedIn({ token, user: u, organization: org })),
    logout: () => dispatch(signOut()),
    setOrganization: (organization) => dispatch(organizationUpdated(organization))
  }), [dispatch]);
  return { booting, user, organization, ...actions };
}
