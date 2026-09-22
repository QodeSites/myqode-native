import { getToken } from './session';

// Point at a local myQode dev server (e.g. http://192.168.x.x:2069) with EXPO_PUBLIC_API_BASE_URL.
export const BASE_URL = (process.env.EXPO_PUBLIC_API_BASE_URL || 'https://myqode.qodeinvest.com').replace(/\/$/, '');

export class ApiError extends Error {
  constructor(message, { status = 0, code, data } = {}) {
    super(message);
    this.status = status; this.code = code; this.data = data;
  }
}

let unauthorizedHandler = null;
export const onUnauthorized = fn => { unauthorizedHandler = fn; };

export async function api(path, { method = 'GET', query, body, auth = true, timeout = 25000 } = {}) {
  let url = BASE_URL + '/api/mobile' + path;
  if (query) {
    const qs = Object.entries(query).filter(([, v]) => v != null && v !== '')
      .map(([k, v]) => encodeURIComponent(k) + '=' + encodeURIComponent(v)).join('&');
    if (qs) url += '?' + qs;
  }
  const headers = { Accept: 'application/json', 'X-Client-Type': 'mobile' };
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
    if (res.status === 401 && auth && token && unauthorizedHandler) unauthorizedHandler();
    throw new ApiError((data && data.error) || `Something went wrong (${res.status}).`, { status: res.status, code: data && data.code, data });
  }
  return data;
}
