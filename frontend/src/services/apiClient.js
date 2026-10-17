import { queryClient } from '../app/queryClient';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const ORG_TOKEN_KEY = 'tropos_org_token';
const ADMIN_TOKEN_KEY = 'tropos_admin_token';
const ORG_USER_KEY = 'tropos_org_user';
const ADMIN_USER_KEY = 'tropos_admin_user';
const SESSION_NOTICE_KEY = 'tropos_session_notice';

// Message left behind by a forced sign-out, shown once on the login page.
export function consumeSessionNotice() {
  try {
    const msg = sessionStorage.getItem(SESSION_NOTICE_KEY);
    sessionStorage.removeItem(SESSION_NOTICE_KEY);
    return msg;
  } catch {
    return null;
  }
}
export function setSessionNotice(message) {
  try { sessionStorage.setItem(SESSION_NOTICE_KEY, message); } catch { /* storage unavailable */ }
}

// "Remember me" decides where the org token lives: localStorage survives
// closing the browser, sessionStorage is wiped when the tab closes. The token
// itself still expires on the platform's session timeout either way.
export function getOrgToken() {
  return sessionStorage.getItem(ORG_TOKEN_KEY) ?? localStorage.getItem(ORG_TOKEN_KEY);
}
export function setOrgToken(token, remember = true) {
  clearOrgToken();
  (remember ? localStorage : sessionStorage).setItem(ORG_TOKEN_KEY, token);
}
export function clearOrgToken() {
  sessionStorage.removeItem(ORG_TOKEN_KEY);
  localStorage.removeItem(ORG_TOKEN_KEY);
  clearStoredOrgUser();
}

export function getStoredOrgUser() {
  try {
    const raw = sessionStorage.getItem(ORG_USER_KEY) ?? localStorage.getItem(ORG_USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
export function setStoredOrgUser(user, remember = true) {
  clearStoredOrgUser();
  try {
    (remember ? localStorage : sessionStorage).setItem(ORG_USER_KEY, JSON.stringify(user));
  } catch { /* storage unavailable */ }
}
export function clearStoredOrgUser() {
  sessionStorage.removeItem(ORG_USER_KEY);
  localStorage.removeItem(ORG_USER_KEY);
}

// After a password change the server issues a fresh token (the old ones stop
// working). Keep it in whichever storage already held the session.
export function replaceOrgToken(token) {
  const storage = sessionStorage.getItem(ORG_TOKEN_KEY) !== null ? sessionStorage : localStorage;
  storage.setItem(ORG_TOKEN_KEY, token);
}

export function getAdminToken() {
  return localStorage.getItem(ADMIN_TOKEN_KEY);
}
export function setAdminToken(token) {
  localStorage.setItem(ADMIN_TOKEN_KEY, token);
}
export function replaceAdminToken(token) {
  localStorage.setItem(ADMIN_TOKEN_KEY, token);
}
export function clearAdminToken() {
  localStorage.removeItem(ADMIN_TOKEN_KEY);
  clearStoredAdminUser();
}

export function getStoredAdminUser() {
  try {
    const raw = localStorage.getItem(ADMIN_USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
export function setStoredAdminUser(user) {
  try {
    localStorage.setItem(ADMIN_USER_KEY, JSON.stringify(user));
  } catch { /* storage unavailable */ }
}
export function clearStoredAdminUser() {
  localStorage.removeItem(ADMIN_USER_KEY);
}

/**
 * A structured error thrown for any non-2xx response. Carries the field
 * errors array from the backend's { success, message, errors } envelope so
 * forms can map them onto individual fields.
 */
export class ApiError extends Error {
  constructor(message, status, fieldErrors = []) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.fieldErrors = fieldErrors;
  }
}

/**
 * Core request function. `portal` selects which token to attach — 'org' or
 * 'admin' — so a request can never accidentally cross the two token spaces.
 * Returns the unwrapped `data` from the backend's envelope on success.
 */
async function request(portal, path, { method = 'GET', body, isFormData = false } = {}) {
  const token = portal === 'admin' ? getAdminToken() : getOrgToken();

  const headers = {};
  if (!isFormData) headers['Content-Type'] = 'application/json';
  if (token) headers['Authorization'] = `Bearer ${token}`;

  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      body: isFormData ? body : body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new ApiError('Unable to connect to the server. Please check your network connection and try again.', 0);
  }

  let json = null;
  try {
    json = await response.json();
  } catch {
    // Non-JSON response (rare — e.g. a raw 502 from infra in front of the API)
  }

  // An authenticated request that comes back 401 means the session is over
  // (token expired, password changed elsewhere, account deactivated). Public
  // auth endpoints also use 401 for bad credentials, so they are excluded.
  if (response.status === 401 && token && !path.startsWith('/auth/') && !path.startsWith('/admin-auth/')) {
    if (portal === 'admin') clearAdminToken(); else clearOrgToken();
    queryClient.clear();
    try { sessionStorage.setItem(SESSION_NOTICE_KEY, json?.message || 'Your session has ended. Please sign in again.'); } catch { /* storage unavailable */ }
    window.location.assign(portal === 'admin' ? '/admin/login' : '/login');
  }

  // If maintenance mode turns on while an org user is logged in, cleanly route them back to login
  if (response.status === 503 && portal === 'org' && token && !path.startsWith('/auth/')) {
    clearOrgToken();
    queryClient.clear();
    try {
      sessionStorage.setItem(
        SESSION_NOTICE_KEY,
        json?.message || 'Tropos is currently undergoing scheduled platform maintenance. Please check back shortly.',
      );
    } catch { /* storage unavailable */ }
    window.location.assign('/login');
  }

  if (!response.ok) {
    const message = json?.message || `Request failed with status ${response.status}`;
    throw new ApiError(message, response.status, json?.errors || []);
  }

  return json?.data;
}

/** Fetches a binary file with the org token and hands it to the browser as a download. */
async function downloadOrgFile(path, fallbackName) {
  const token = getOrgToken();
  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  } catch {
    throw new ApiError('Unable to connect to the server to download file. Please check your connection.', 0);
  }
  if (!response.ok) {
    let json = null;
    try { json = await response.json(); } catch { /* not JSON */ }
    throw new ApiError(json?.message || `Download failed with status ${response.status}`, response.status, json?.errors || []);
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fallbackName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Fetches a binary file as a Blob with auth headers for in-app viewing. */
async function fetchOrgBlob(path) {
  const token = getOrgToken();
  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  } catch {
    throw new ApiError('Unable to connect to the server to load file. Please check your connection.', 0);
  }
  if (!response.ok) {
    let json = null;
    try { json = await response.json(); } catch { /* not JSON */ }
    throw new ApiError(json?.message || `Failed to load file with status ${response.status}`, response.status, json?.errors || []);
  }
  return await response.blob();
}

export const orgApi = {
  download: downloadOrgFile,
  getBlob: fetchOrgBlob,
  get: (path) => request('org', path),
  post: (path, body) => request('org', path, { method: 'POST', body }),
  patch: (path, body) => request('org', path, { method: 'PATCH', body }),
  delete: (path) => request('org', path, { method: 'DELETE' }),
  postForm: (path, formData) => request('org', path, { method: 'POST', body: formData, isFormData: true }),
};

export const adminApi = {
  get: (path) => request('admin', path),
  post: (path, body) => request('admin', path, { method: 'POST', body }),
  patch: (path, body) => request('admin', path, { method: 'PATCH', body }),
  delete: (path) => request('admin', path, { method: 'DELETE' }),
};
