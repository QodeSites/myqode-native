// What a user sees when something fails. Never a status code, an exception name or a server's internal text:
// our own written messages pass through, anything technical becomes one of the plain messages below.
//   userMessage(error, fallback?) → the text to show (fallback replaces the generic "Something went wrong")
// Used by the API client (src/api/client.js), the error boxes and every screen that shows a caught error.

export const MSG = {
  offline: 'You’re offline or the connection is weak. Check your internet and try again.',
  slow: 'This is taking longer than usual. Check your internet and try again.',
  server: 'Something went wrong on our side. Please try again in a moment.',
  generic: 'Something went wrong. Please try again.',
  session: 'Your session has expired. Please sign in again.',
  forbidden: 'You don’t have access to this.',
  notFound: 'We couldn’t find what you were looking for.',
  tooMany: 'Too many attempts. Please wait a minute and try again.',
  invalid: 'Please check the details and try again.',
};

// Words and shapes that only appear in technical text (exception names, HTTP phrases, code identifiers, URLs).
const TECH = /\b(exception|undefined|null|NaN|stack|sql|econn\w*|enotfound|etimedout|typeerror|referenceerror|syntaxerror|rangeerror|internal server( error)?|forbidden|unauthori[sz]ed|bad request|json|fetch|aborted?|promise|function|object|cannot read|is not a|unexpected token|network request failed|status code|errno|eacces)\b|[{}<>\[\]=`|\\]|https?:\/\/|\(\d{3}\)|\b\d{3}\b(?= *(error|status))|\w+_\w+/i;
// Code identifiers (accountId, fetchOrder): case-sensitive, so ordinary words never match.
const CAMEL = /\b[a-z]+[A-Z][A-Za-z]*\b/;
// Brand and product words with inner capitals that are fine to show.
const SAFE_WORDS = /\b(myQode|iPhone|iPad|iOS|eSign|eKYC|DigiLocker|WhatsApp|PayPal)\b/g;

/** True for text written for people: a sentence, not a code, a stack or a server phrase. */
export function isFriendly(s) {
  const t = String(s == null ? '' : s).trim();
  if (t.length < 8 || t.length > 260 || !/\s/.test(t)) return false;
  if (!/^[A-Z₹0-9"“‘'(]/.test(t)) return false;
  const plain = t.replace(SAFE_WORDS, 'X');
  // A bare server phrase ("Order not found", "Request failed"): a few words, no sentence behind them.
  if (plain.split(/\s+/).length <= 4 && /\b(not found|failed|invalid|error|denied)\b/i.test(plain)) return false;
  return !TECH.test(plain) && !CAMEL.test(plain);
}

/** The message to show for an error (or a message string). fallback: shown instead of the generic one. */
export function userMessage(e, fallback) {
  const fb = fallback || MSG.generic;
  if (!e) return fb;
  if (typeof e === 'string') return isFriendly(e) ? e : fb;
  if (e.friendly && e.message) return e.message;       // already made safe by the API client
  return isFriendly(e.message) ? e.message : fb;
}

/** For an HTTP status with no usable message from the server. */
export function statusMessage(status) {
  if (status === 401) return MSG.session;
  if (status === 403) return MSG.forbidden;
  if (status === 404) return MSG.notFound;
  if (status === 429) return MSG.tooMany;
  if (status === 400 || status === 409 || status === 422) return MSG.invalid;
  if (status >= 500) return MSG.server;
  return MSG.generic;
}
