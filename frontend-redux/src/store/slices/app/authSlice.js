import { createAsyncThunk } from '@reduxjs/toolkit';
import { apiFetch, getToken, setToken } from '../../../services/apiClient';
import { apiThunk } from '../../apiThunk';
import { createResourceSlice } from '../../resourceSlice';

/** Who is signed in. Replaces the old AuthContext. */
export const bootstrapAuth = createAsyncThunk('auth/bootstrap', async () => {
  if (!getToken()) return null;
  try { return await apiFetch('/auth/me'); } catch { setToken(null); return null; }
});

/** Called by the sign-in pages once the backend has accepted the credentials. */
export const signedIn = createAsyncThunk('auth/signedIn', async ({ token, user, organization }) => {
  setToken(token);
  return { user, organization: organization ?? user?.organization ?? null };
});

export const signOut = createAsyncThunk('auth/signOut', async () => {
  await apiFetch('/auth/logout', { method: 'POST' }).catch(() => {});
  setToken(null);
});

// Sign-in, account and invitation calls. Pages show the backend's reason inline, so these stay silent (no toast).
const quiet = { silent: true };
export const loginRequested = apiThunk('auth/login', (a) => ({ path: '/auth/login', method: 'POST', body: { email: a.email, password: a.password, totpCode: a.totpCode || undefined } }), quiet);
export const registerRequested = apiThunk('auth/register', (a) => ({ path: '/auth/register', method: 'POST', body: a.body }), quiet);
export const forgotPasswordRequested = apiThunk('auth/forgotPassword', (a) => ({ path: '/auth/forgot-password', method: 'POST', body: { email: a.email } }), quiet);
export const passwordReset = apiThunk('auth/resetPassword', (a) => ({ path: '/auth/reset-password', method: 'POST', body: { token: a.token.trim(), newPassword: a.newPassword } }), quiet);
export const emailVerified = apiThunk('auth/verifyEmail', (a) => ({ path: '/auth/verify-email', method: 'POST', body: { token: a.token.trim() } }), quiet);
export const invitationLoaded = apiThunk('auth/invitation', (a) => ({ path: `/auth/invitations/${a.token}` }), quiet);
export const invitationAccepted = apiThunk('auth/acceptInvitation', (a) => ({ path: `/auth/invitations/${a.token}/accept`, method: 'POST', body: { fullName: a.fullName, password: a.password } }), quiet);
export const publicInfoLoaded = apiThunk('auth/publicInfo', () => ({ path: '/meta/public' }), quiet);

const slice = createResourceSlice('auth', {
  initialState: { booting: true, user: null, organization: null, publicInfo: null, invitation: null },
  reducers: {
    organizationUpdated(state, action) { state.organization = action.payload; }
  },
  extraReducers: (b) => {
    b.addCase(bootstrapAuth.fulfilled, (s, a) => { s.booting = false; s.user = a.payload; s.organization = a.payload?.organization ?? null; });
    b.addCase(bootstrapAuth.rejected, (s) => { s.booting = false; s.user = null; s.organization = null; });
    b.addCase(signedIn.fulfilled, (s, a) => { s.booting = false; s.user = a.payload.user; s.organization = a.payload.organization; });
    b.addCase(invitationLoaded.pending, (s) => { s.invitation = null; });
    b.addCase(invitationLoaded.fulfilled, (s, a) => { s.invitation = a.payload; });
    b.addCase(publicInfoLoaded.fulfilled, (s, a) => { s.publicInfo = a.payload; });
    b.addCase(signOut.fulfilled, (s) => { s.booting = false; s.user = null; s.organization = null; });
  }
});

export const { organizationUpdated } = slice.actions;
export const selectAuth = (s) => s.auth;
export const selectInvitation = (s) => s.auth.invitation;
export const selectPublicInfo = (s) => s.auth.publicInfo;
export default slice.reducer;
