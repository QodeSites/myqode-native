// Thin fetch wrapper for the onboarding backend (not the myQode investor API;
// that one is src/api/client.js and carries a Bearer token).
//
// Every error becomes an OnboardingError with a stable `code` the UI can
// branch on and a `message` that is safe to show to an investor. The
// backend's route handlers reply with JSON { error } but its Basic-Auth
// middleware replies with plain text, so the body is parsed defensively.
import { API_BASE, TIMINGS } from './config.js';

export class OnboardingError extends Error {
  constructor(message, { status = 0, code = 'unknown', body = null, retryable = false } = {}) {
    super(message);
    this.name = 'OnboardingError';
    this.status = status;
    this.code = code;
    this.body = body;
    this.retryable = retryable;
  }
}

const GENERIC = 'Something went wrong on our side. Please try again in a moment.';

async function parseBody(res) {
  let text = '';
  try { text = await res.text(); } catch (e) { return null; }
  if (!text) return null;
  try { return JSON.parse(text); } catch (e) { return { error: text.trim() }; }
}

function serverMessage(body) {
  if (body && typeof body.error === 'string' && body.error.trim()) return body.error.trim();
  return null;
}

export function toOnboardingError(status, body) {
  const msg = serverMessage(body);
  switch (status) {
    case 400: return new OnboardingError(msg || 'Some details need attention before we can continue.', { status, code: 'bad_request', body });
    case 401: return new OnboardingError('You are not allowed to do that.', { status, code: 'unauthorized', body });
    case 404: return new OnboardingError('We could not find that application. The link may have expired.', { status, code: 'not_found', body });
    case 409: return new OnboardingError('This application has already been submitted and can no longer be changed.', { status, code: 'locked', body });
    case 413: return new OnboardingError('That file is too large. Please keep uploads under 10 MB.', { status, code: 'too_large', body });
    case 415: return new OnboardingError('That file type is not supported. Use a PDF, PNG, JPG or WebP.', { status, code: 'bad_type', body });
    case 429: return new OnboardingError('Too many requests. Please wait a moment and try again.', { status, code: 'rate_limited', body, retryable: true });
    case 503: return new OnboardingError(msg || 'This service is temporarily unavailable.', { status, code: 'unavailable', body, retryable: true });
    default:
      if (status >= 500) return new OnboardingError(GENERIC, { status, code: 'server', body, retryable: true });
      return new OnboardingError(msg || GENERIC, { status, code: 'unknown', body });
  }
}

export function isOffline(err) { return !!err && (err.code === 'offline' || err.code === 'timeout'); }

/**
 * request(path, options)
 *   method, body (JSON), formData (multipart), timeoutMs, headers
 * Resolves with the parsed JSON body, rejects with OnboardingError.
 */
export async function request(path, { method = 'GET', body, formData, headers = {}, timeoutMs } = {}) {
  const url = API_BASE + path;
  const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = setTimeout(() => ctrl && ctrl.abort(), timeoutMs || TIMINGS.requestTimeoutMs);
  const init = {
    method,
    cache: 'no-store',
    headers: { Accept: 'application/json', ...(formData ? {} : { 'Content-Type': 'application/json' }), ...headers },
    body: formData ? formData : (body !== undefined ? JSON.stringify(body) : undefined),
    signal: ctrl ? ctrl.signal : undefined,
  };
  let res;
  const startedAt = Date.now();
  try {
    res = await fetch(url, init);
  } catch (e) {
    clearTimeout(timer);
    // The investor-facing message cannot say why; the console line can. RN reports every
    // native failure (DNS, TLS, an unreadable file:// part, a dropped tunnel) as the same
    // "Network request failed", so the elapsed time and the request shape matter.
    if (typeof console !== 'undefined' && console.warn) {
      console.warn(`[onboarding] ${method} ${url} failed after ${Date.now() - startedAt} ms: ${e && e.name}: ${e && e.message}` + (formData ? ' (multipart)' : ''));
    }
    if (e && e.name === 'AbortError') {
      throw new OnboardingError('That took too long. Check your connection and try again.', { code: 'timeout', retryable: true });
    }
    throw new OnboardingError('You appear to be offline. We will keep your progress and retry when you are back.', { code: 'offline', retryable: true, body: { cause: e && e.message } });
  }
  clearTimeout(timer);
  const parsed = await parseBody(res);
  if (res.ok) return parsed;
  throw toOnboardingError(res.status, parsed);
}
