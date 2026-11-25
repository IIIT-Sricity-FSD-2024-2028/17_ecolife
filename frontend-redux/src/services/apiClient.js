const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';

const ACRONYM = { gstin: 'GSTIN', pan: 'PAN', url: 'Web address', pct: 'percentage', inr: 'rupees', tco2e: 'tCO₂e', id: 'ID' };
export const fieldName = (f) => { const w = String(f).replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_.]/g, ' ').toLowerCase().split(' ').map((x) => ACRONYM[x] || x).join(' '); return w.charAt(0).toUpperCase() + w.slice(1); };
export function plainProblem(m) {
  const t = String(m);
  let x;
  if (/^required$/i.test(t)) return 'is required';
  if ((x = t.match(/Expected (\w+), received (\w+)/i))) return x[1] === 'number' ? 'must be a number' : x[1] === 'string' ? 'must be text' : 'has the wrong kind of value';
  if (/Invalid enum value|Invalid option/i.test(t)) return 'needs one of the listed choices';
  if ((x = t.match(/at least (\d+) character/i))) return `needs at least ${x[1]} characters`;
  if ((x = t.match(/at most (\d+) character/i))) return `can be at most ${x[1]} characters`;
  if ((x = t.match(/greater than or equal to (-?[\d.]+)/i))) return `must be ${x[1]} or more`;
  if ((x = t.match(/less than or equal to (-?[\d.]+)/i))) return `must be ${x[1]} or less`;
  if (/Invalid email/i.test(t)) return 'must be a valid email address';
  if (/Invalid date|Invalid datetime/i.test(t)) return 'must be a valid date';
  return null;
}

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
    // "Validation failed" alone tells the person nothing: say which field needs what, in plain words.
    if (details && typeof details === 'object') {
      const why = Object.entries(details).flatMap(([field, list]) => [].concat(list).map((m) => { const p = plainProblem(m); return p ? `${fieldName(field)} ${p}` : `${fieldName(field)}: ${m}`; })).slice(0, 3).join('. ');
      if (why) msg = why.endsWith('.') ? why : `${why}.`;
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
