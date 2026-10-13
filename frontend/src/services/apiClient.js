const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const ORG_TOKEN_KEY = 'tropos_org_token';
const ADMIN_TOKEN_KEY = 'tropos_admin_token';

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
}

export function getAdminToken() {
  return localStorage.getItem(ADMIN_TOKEN_KEY);
}
export function setAdminToken(token) {
  localStorage.setItem(ADMIN_TOKEN_KEY, token);
}
export function clearAdminToken() {
  localStorage.removeItem(ADMIN_TOKEN_KEY);
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

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    body: isFormData ? body : body !== undefined ? JSON.stringify(body) : undefined,
  });

  let json = null;
  try {
    json = await response.json();
  } catch {
    // Non-JSON response (rare — e.g. a raw 502 from infra in front of the API)
  }

  if (!response.ok) {
    const message = json?.message || `Request failed with status ${response.status}`;
    throw new ApiError(message, response.status, json?.errors || []);
  }

  return json?.data;
}

export const orgApi = {
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
