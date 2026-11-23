const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';

export function getToken() {
  return localStorage.getItem('tropos_token');
}

export function setToken(token) {
  if (token) localStorage.setItem('tropos_token', token);
  else localStorage.removeItem('tropos_token');
}

export async function apiFetch(path, init = {}) {
  const token = getToken();
  const headers = new Headers(init.headers);
  if (!(init.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const res = await fetch(`${API_BASE}${path}`, { ...init, headers });
  if (!res.ok) {
    let msg = `Request failed (${res.status})`;
    let details;
    try {
      const body = await res.json();
      if (body?.error) msg = body.error;
      details = body?.details;
    } catch {
      // keep default status message
    }
    const err = new Error(msg);
    err.status = res.status;
    err.details = details;
    throw err;
  }
  return res.json();
}

/** Downloads a protected file (needs the sign-in token, so a plain link will not work). */
export async function apiDownload(path, filename) {
  const token = getToken();
  const res = await fetch(`${API_BASE}${path}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  if (!res.ok) throw new Error(res.status === 404 ? 'The file could not be found.' : `Download failed (${res.status}).`);
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url);
}
