// Every /api/mobile/* endpoint of the myQode server (myQode/app/api/mobile/**).
// Demo mode answers from src/api/demo.js; TEST_MODE blocks anything that could reach a real client.
import { Platform } from 'react-native';
import { api, ApiError } from './client';
import { demo } from './demo';
import { TEST_MODE } from './config';

export { ApiError, BASE_URL, onUnauthorized } from './client';
export { getToken, setToken, clearToken } from './session';
export { TEST_MODE, DEV_BYPASS, APP_VERSION, SHOW_UPDATE_BANNER } from './config';

let demoOn = false;
export const setDemo = v => { demoOn = !!v; };
export const isDemo = () => demoOn;
const mock = fn => new Promise((res, rej) => setTimeout(() => { try { res(fn()); } catch (e) { rej(e); } }, 350));
const call = (path, opts, fake) => (demoOn && fake ? mock(fake) : api(path, opts));
const inquiry = () => ({ success: true, inquiry_id: 'DEMO-' + Date.now().toString().slice(-6) });
const post = (path, body, fake = inquiry) => call(path, { method: 'POST', body }, fake);

// Actions that email/notify/charge the signed-in client, or change their credentials.
export class BlockedError extends ApiError {
  constructor(what) {
    super(`Blocked in test mode: ${what}. This would reach the real client. Turn EXPO_PUBLIC_TEST_MODE off for production.`, { status: 0, code: 'TEST_MODE' });
  }
}
// In demo mode these never touch the network (there is no real session): they just report success.
const guarded = (what, fn) => (...a) => (demoOn ? mock(() => ({ success: true, message: 'Done (demo — nothing was changed).' }))
  : TEST_MODE ? Promise.reject(new BlockedError(what)) : fn(...a));

const platform = Platform.OS === 'web' ? undefined : Platform.OS;

export const auth = {
  checkIdentifier: identifier => api('/auth/check-identifier', { method: 'POST', auth: false, body: { identifier } }),
  login: (username, password) => api('/auth/login', { method: 'POST', auth: false, body: { username, password, platform } }),
  // Dev-server only: NODE_ENV=development makes the password optional.
  loginBypass: username => api('/auth/login', { method: 'POST', auth: false, body: { username, platform } }),
  devClients: () => api('/dev/clients', { auth: false }),
  sendSetupOtp: guarded('sending a setup OTP email', email => api('/auth/send-setup-otp', { method: 'POST', auth: false, body: { email } })),
  verifySetupOtp: (email, otp) => api('/auth/verify-setup-otp', { method: 'POST', auth: false, body: { email, otp } }),
  completeOtpSetup: guarded('changing the client’s password', (email, otp, newPassword, confirmPassword) =>
    api('/auth/complete-otp-setup', { method: 'POST', auth: false, body: { email, otp, newPassword, confirmPassword } })),
  forgot: guarded('sending a password-reset email', email => api('/auth/forgot', { method: 'POST', auth: false, body: { email } })),
  me: () => api('/auth/me'),
};

export const meta = {
  appVersion: () => call('/app-version', { auth: false }, () => demo.appVersion()),
  // Nuvama primary-UCC notice (same data as the web's /api/primary-ucc)
  primaryUcc: () => call('/primary-ucc', {}, () => ({ success: true, dataAsOf: '2026-07-14', primaries: [{ uccCode: 'QAW0412', strategy: 'QODE ADVISORS LLP - QODE ALL WEATHER', groupName: 'MEHTA FAMILY' }] })),
};

// kind: 'account' → per-strategy routes; 'owner' | 'family' → pre-aggregated combined-* routes.
const pfx = kind => (kind === 'account' ? '/portfolio/' : '/portfolio/combined-');
export const portfolio = {
  snapshot: () => call('/portfolio/snapshot', {}, () => demo.snapshot()),
  performance: (accountId, kind = 'account') => call(pfx(kind) + 'performance', { query: { accountId } }, () => demo.performance(accountId)),
  nav: (accountId, period, kind = 'account') => call(pfx(kind) + 'nav', { query: { accountId, period } }, () => demo.nav(accountId, period)),
  drawdown: (accountId, period, kind = 'account') => call(pfx(kind) + 'drawdown', { query: { accountId, period } }, () => demo.drawdown(accountId, period)),
  monthlyPl: (accountId, kind = 'account') => call(pfx(kind) + 'monthly-pl', { query: { accountId } }, () => demo.monthlyPl(accountId)),
  quarterlyPl: (accountId, kind = 'account') => call(pfx(kind) + 'quarterly-pl', { query: { accountId } }, () => demo.quarterlyPl(accountId)),
  // Raw Nuvama + Orbis + benchmark rows for ONE strategy account (legacy Orbis views are built in src/webcalc.js).
  history: accountId => call('/portfolio/history', { query: { accountId } }, () => ({ accountId, nuvama: [], orbis: [], orbisMetrics: null, benchmark: [] })),
  cashflow: (accountId, kind = 'account') => call(pfx(kind) + 'cashflow', { query: { accountId } }, () => demo.cashflow(accountId)),
};

// Documents are S3 listings (one per category) — cached per account for the session so the tab and each
// section open instantly after the first visit. File links are 5-minute signed URLs, so file lists expire.
let docCache = {};
const FILES_FRESH_MS = 4 * 60 * 1000;
const cached = (key, ttl, fetcher) => {
  const hit = docCache[key];
  if (hit && Date.now() - hit.at < ttl) return hit.p;
  const p = fetcher().catch(e => { if (docCache[key] && docCache[key].p === p) delete docCache[key]; throw e; });
  docCache[key] = { p, at: Date.now() };
  return p;
};
export const documents = {
  list: accountId => cached('list:' + accountId, Infinity, () => call('/documents/list', { query: { accountId } }, () => demo.docList())),
  files: (category, accountId) => cached('files:' + category + ':' + accountId, FILES_FRESH_MS, () => call('/documents/files/' + category, { query: { accountId } }, () => demo.docFiles(category))),
  // Warm the category counts for an account while the user is elsewhere (errors are ignored, the tab retries).
  warm: accountId => { if (accountId) documents.list(accountId).catch(() => {}); },
  forget: () => { docCache = {}; },
};

export const engagement = {
  newsletters: () => call('/engagement/newsletters', {}, () => demo.articles('Newsletter')),
  perspectives: () => call('/engagement/perspectives', {}, () => demo.articles('Perspective')),
  events: () => call('/engagement/events', {}, () => demo.articles('Event')),
  portalGuide: () => call('/engagement/portal-guide', {}, () => ({ videos: [], snapshots: [], byReport: { snapshots: {}, videos: {} }, counts: { videos: 0, snapshots: 0 } })),
  referral: body => post('/engagement/referral', body),
  // Analytics only writes to pms_mobile_analytics; it never contacts the client.
  analytics: events => (demoOn ? Promise.resolve({ ok: true }) : api('/engagement/analytics', { method: 'POST', body: { events } })),
};

export const experience = {
  family: () => call('/experience/family', {}, () => demo.family()),
};

let bankCache = null;
let switchCache = null, switchPending = null;   // { data, at } — per signed-in client, see clearUserCaches()
const SWITCH_FRESH_MS = 60 * 1000;
// Drop everything cached for the current client. Call on sign-out and when impersonating someone else.
export const clearUserCaches = () => { switchCache = null; switchPending = null; documents.forget(); };
export const services = {
  // Qode's own bank account: static on the server. Cached after the first fetch so the Add Funds sheet is instant.
  bankDetails: () => {
    if (demoOn) return mock(() => demo.bank());
    if (!bankCache) bankCache = api('/services/bank-details').catch(e => { bankCache = null; throw e; });
    return bankCache;
  },
  transactions: accountId => call('/services/transactions', { query: { accountId } }, () => demo.transactions()),
  // These email Investor Relations only (to: investor.relations@qodeinvest.com), never the client.
  withdrawal: body => post('/services/withdrawal', body),
  switchStrategy: body => post('/services/switch', body),
  // Strategy switch requests, the Zoho CRM model (Strategy_Switch_Requests). Dev server = dry run, never creates.
  // The info call costs two Zoho round trips (~1 s on the server, more through a tunnel), so it is warmed at
  // app start and answered from memory: the sheet opens instantly, and when the copy is older than SWITCH_FRESH_MS
  // a background refresh calls `onFresh(data)` so the form can update in place. Cleared on sign-out and after a submit.
  switchRequestInfo: onFresh => {
    if (demoOn) return mock(() => demo.switchInfo());
    const fetchIt = () => api('/services/switch-request').then(d => { switchCache = { data: d, at: Date.now() }; return d; });
    if (switchCache) {
      if (Date.now() - switchCache.at > SWITCH_FRESH_MS && !switchPending) {
        switchPending = fetchIt().then(d => { switchPending = null; onFresh && onFresh(d); }, () => { switchPending = null; });
      }
      return Promise.resolve(switchCache.data);
    }
    if (!switchPending) switchPending = fetchIt().finally(() => { switchPending = null; });
    return switchPending;
  },
  warmSwitchInfo: () => { if (!demoOn && !switchCache) services.switchRequestInfo().catch(() => {}); },
  submitSwitchRequest: body => call('/services/switch-request', { method: 'POST', body }, () => ({ success: true, dryRun: false, requestId: 'DEMO-' + Date.now().toString().slice(-6) }))
    .then(r => { switchCache = null; return r; }),
  strategyInquiry: body => post('/services/strategy-inquiry', body),
  discussion: body => post('/services/discussion', body),
  accountRequest: body => post('/services/account-request', body),
  registerPushToken: guarded('registering a push token (enables push notifications to the client)',
    pushToken => api('/services/register-push-token', { method: 'POST', body: { pushToken, platform } })),
  unregisterPushToken: pushToken => api('/services/register-push-token', { method: 'DELETE', body: { pushToken } }),
  // SIP (Razorpay Subscriptions, app/api/mobile/services/{setup,verify,pause-resume,cancel}-sip). Not
  // TEST_MODE-guarded — same reasoning as payments.razorpay below: test keys, no client contact, no
  // notification unless RAZORPAY_NOTIFY_CLIENT=true on the server. This lets a SIP mandate be tested
  // end-to-end against a real client account, same as the one-time payment flow.
  setupSip: body => call('/services/setup-sip', { method: 'POST', body }, () => demo.setupSip(body)),
  // The client's registered bank account (masked) — what a SIP mandate is allowed to debit.
  registeredBank: accountId => call('/services/registered-bank', { query: { accountId } }, () => demo.registeredBank()),
  verifySip: subscriptionId => call('/services/verify-sip', { query: { subscriptionId } }, () => demo.verifySip(subscriptionId)),
  pauseResumeSip: (subscription_id, accountId, action) =>
    call('/services/pause-resume-sip', { method: 'POST', body: { subscription_id, accountId, action } }, () => demo.pauseResumeSip(action)),
  cancelSip: (subscription_id, accountId) =>
    call('/services/cancel-sip', { method: 'POST', body: { subscription_id, accountId } }, () => demo.cancelSip()),
};

export const payments = {
  // Razorpay one-time top-up (app/api/mobile/payments/razorpay/*). Not TEST_MODE-guarded on purpose: with the
  // server's test keys nobody is charged, the client's contact details are never sent to the gateway, and the
  // routes never notify the client. Demo mode answers locally.
  razorpay: {
    createOrder: body => call('/payments/razorpay/create-order', { method: 'POST', body }, () => demo.rzOrder(body)),
    verify: body => call('/payments/razorpay/verify', { method: 'POST', body }, () => demo.rzVerify(body)),
    // Long-poll (server holds ≤ 20 s) used while the browser tab is open — see autoReturn in screens/pay.js.
    wait: query => api('/payments/razorpay/wait', { query, timeout: 30000 }),
  },
  createOrder: guarded('creating a Cashfree payment order', body => api('/payments/create-order', { method: 'POST', body })),
  verify: orderId => call('/payments/verify', { query: { orderId } }, () => demo.verifyOrder(orderId)),
  investmentStatus: accountId => call('/payments/investment-status', { query: { accountId } }, () => demo.investmentStatus()),
};

// Super-admin only (token must carry isSuperAdmin and not be an impersonation token).
export const admin = {
  clients: (search = '', page = 1, limit = 200) => api('/admin/clients', { query: { search, page, limit } }),
  impersonate: clientCode => api('/admin/impersonate', { method: 'POST', body: { clientCode } }),
  analytics: (days = 30) => api('/admin/analytics', { query: { days } }),
};
