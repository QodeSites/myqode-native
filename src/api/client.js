import { getToken, hasViewToken } from './session';

// Point at a local myQode dev server (e.g. http://192.168.x.x:2069) with EXPO_PUBLIC_API_BASE_URL.
// The web build (served at /app by the myQode server itself) uses "/": same origin, so requests are relative.
export const BASE_URL = (process.env.EXPO_PUBLIC_API_BASE_URL || 'https://myqode.qodeinvest.com').replace(/\/$/, '');

export class ApiError extends Error {
  constructor(message, { status = 0, code, data } = {}) {
    super(message);
    this.status = status; this.code = code; this.data = data;
  }
}

let unauthorizedHandler = null;
export const onUnauthorized = fn => { unauthorizedHandler = fn; };

// base: the route prefix — '/api/mobile' for the app's own API, '/api/admin/bo' for the backoffice (adminApi).
export async function api(path, { method = 'GET', query, body, auth = true, timeout = 25000, base = '/api/mobile' } = {}) {
  // Viewing an investor's account as their partner is read-only (the server refuses it too).
  if (auth && method !== 'GET' && hasViewToken()) throw new ApiError('You are viewing this account. Changes are not available.', { status: 403, code: 'VIEW_ONLY' });
  let url = BASE_URL + base + path;
  if (query) {
    const qs = Object.entries(query).filter(([, v]) => v != null && v !== '')
      .map(([k, v]) => encodeURIComponent(k) + '=' + encodeURIComponent(v)).join('&');
    if (qs) url += '?' + qs;
  }
  const headers = { Accept: 'application/json', 'X-Client-Type': 'mobile' };
  // Dev tunnels can answer with an anti-phishing HTML page instead of the API response.
  if (BASE_URL.includes('.devtunnels.ms')) headers['X-Tunnel-Skip-AntiPhishing-Page'] = 'true';
  if (body) headers['Content-Type'] = 'application/json';
  let token = null;
  if (auth) {
    token = await getToken();
    if (token) headers.Authorization = 'Bearer ' + token;
  }
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeout);
  let res;
  try {
    res = await fetch(url, { cache: 'no-store', method, headers, body: body ? JSON.stringify(body) : undefined, signal: ctl.signal });
  } catch {
    throw new ApiError('Unable to reach Qode. Check your connection and try again.');
  } finally {
    clearTimeout(timer);
  }
  let data = null;
  try { data = await res.json(); } catch {}
  if (!res.ok) {
    // Only a 401 for the token still in use counts: a late reply for an expired view/impersonation token must not
    // sign out the session that replaced it.
    if (res.status === 401 && auth && token && unauthorizedHandler && token === await getToken()) unauthorizedHandler();
    throw new ApiError((data && data.error) || `Something went wrong (${res.status}).`, { status: res.status, code: data && data.code, data });
  }
  return data;
}

// Backoffice routes (/api/admin/bo/*, myQode/docs/admin-backoffice-api.md): same fetch, timeout and errors, with the
// app admin's own Bearer token (a normal mobile JWT carrying isAdmin).
export const adminApi = (path, opts = {}) => api(path, { ...opts, base: '/api/admin/bo' });
