// Every /api/mobile/* endpoint of the myQode server (myQode/app/api/mobile/**).
// Demo mode answers from src/api/demo.js; TEST_MODE blocks anything that could reach a real client.
import { Platform } from 'react-native';
import { api, adminApi, ApiError } from './client';
import { demo } from './demo';
import { demoReports } from './demoReports';
import { demoSecurities } from './demoHoldings';
import { TEST_MODE } from './config';

export { ApiError, BASE_URL, onUnauthorized } from './client';
export { getToken, setToken, clearToken, setViewToken, hasViewToken } from './session';
export { TEST_MODE, DEV_BYPASS, APP_VERSION, SHOW_UPDATE_BANNER } from './config';
import { APP_VERSION } from './config';

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
    super(`Blocked in test mode: ${what}. This would reach the real investor. Turn EXPO_PUBLIC_TEST_MODE off for production.`, { status: 0, code: 'TEST_MODE' });
  }
}
// In demo mode these never touch the network (there is no real session): they just report success.
const guarded = (what, fn) => (...a) => (demoOn ? mock(() => ({ success: true, message: 'Done (demo: nothing was changed).' }))
  : TEST_MODE ? Promise.reject(new BlockedError(what)) : fn(...a));

const platform = Platform.OS === 'web' ? undefined : Platform.OS;

export const auth = {
  checkIdentifier: identifier => api('/auth/check-identifier', { method: 'POST', auth: false, body: { identifier } }),
  // role: 'client' | 'distributor' from the login screen's switch — the server turns a wrong pick into a clear message.
  login: (username, password, role) => api('/auth/login', { method: 'POST', auth: false, body: { username, password, platform, role } }),
  // Re-issues a 30-day token for a valid one (called on start-up once the token is a day old) — the client stays signed in.
  refresh: () => api('/auth/refresh', { method: 'POST' }),
  // Signed-in user (investor or partner) sets a new password; the server checks the current one.
  changePassword: (currentPassword, newPassword) => api('/auth/change-password', { method: 'POST', body: { currentPassword, newPassword } }),
  // Dev-server only: NODE_ENV=development makes the password optional.
  loginBypass: username => api('/auth/login', { method: 'POST', auth: false, body: { username, platform } }),
  devClients: () => api('/dev/clients', { auth: false }),
  // Test builds send these with testRedirect: the server mails MOBILE_AUTH_EMAIL_OVERRIDE (the tester) instead of the
  // client, or refuses when no override is set.
  sendSetupOtp: email => (demoOn ? mock(() => ({ success: true })) : api('/auth/send-setup-otp', { method: 'POST', auth: false, body: { email, ...(TEST_MODE ? { testRedirect: true } : {}) } })),
  verifySetupOtp: (email, otp) => api('/auth/verify-setup-otp', { method: 'POST', auth: false, body: { email, otp } }),
  // Not blocked in test mode (decided 2026-09-24, to test the flow as a real user): the OTP only reaches the tester
  // via the server's MOBILE_AUTH_EMAIL_OVERRIDE, and completing this REALLY sets that account's password.
  completeOtpSetup: (email, otp, newPassword, confirmPassword) => (demoOn ? mock(() => ({ success: true }))
    : api('/auth/complete-otp-setup', { method: 'POST', auth: false, body: { email, otp, newPassword, confirmPassword } })),
  forgot: email => (demoOn ? mock(() => ({ success: true })) : api('/auth/forgot', { method: 'POST', auth: false, body: { email, ...(TEST_MODE ? { testRedirect: true } : {}) } })),
  me: (opts = {}) => api('/auth/me', opts),
  // Sign-out, for the server's sign-in log. Never throws: signing out must work offline too.
  logout: () => (demoOn ? Promise.resolve() : api('/auth/logout', { method: 'POST', body: { os: Platform.OS }, timeout: 5000 }).catch(() => {})),
};

export const meta = {
  appVersion: () => call('/app-version', { auth: false }, () => demo.appVersion()),
  // Nuvama primary-UCC notice (same data as the web's /api/primary-ucc)
  primaryUcc: () => call('/primary-ucc', {}, () => ({ success: true, dataAsOf: '2026-07-14', primaries: [{ uccCode: 'QAW0412', strategy: 'QODE ADVISORS LLP - QODE ALL WEATHER', groupName: 'MEHTA FAMILY' }] })),
  // What Nuvama holds for the investor: primary UCC, accounts, registered contact and bank (masked).
  nuvamaDetails: () => call('/nuvama-details', {}, () => ({
    success: true, portalUrl: 'https://eclientreporting.nuvamaassetservices.com/wealthspectrum/app/', dataAsOf: '2026-07-14',
    primary: { uccCode: 'QAW0412', strategy: 'QODE ADVISORS LLP - QODE ALL WEATHER', groupName: 'MEHTA FAMILY' },
    accounts: [
      { code: 'QAW0412', holder: 'Mr Rohan Mehta', scheme: 'QODE ADVISORS LLP - QODE ALL WEATHER', accountType: 'Individual', openedOn: '2023-07-01', inceptionDate: '2023-07-01', maturityDate: null, active: true, rm: 'Qode Investor Relations', distributor: 'QODE ADVISORS LLP INT', family: 'MEHTA FAMILY' },
      { code: 'QGF0412', holder: 'Mr Rohan Mehta', scheme: 'QODE ADVISORS LLP - QODE GROWTH FUND', accountType: 'Individual', openedOn: '2024-01-27', inceptionDate: '2024-01-27', maturityDate: null, active: true, rm: 'Qode Investor Relations', distributor: 'QODE ADVISORS LLP INT', family: 'MEHTA FAMILY' },
    ],
    holders: [{ name: 'Mr Rohan Mehta', pan: '••••••382F', email: 'rohan.mehta@example.com', mobile: '••••••8801', city: 'Mumbai', state: 'Maharashtra', pincode: '400013', accounts: ['QAW0412', 'QGF0412'] }],
    banks: [{ code: 'QAW0412', account: '••••••4321', ifsc: 'HDFC0000060', status: 'verified', updatedAt: '2026-06-02' }],
  })),
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
  // Security-level holdings (stocks, ETFs, mutual funds, derivatives, cash) of strategy accounts, combined across
  // them: accounts = one code, an array of codes, or omitted for every account on the token. See lib/securities.ts.
  securities: accounts => {
    const accountId = Array.isArray(accounts) ? accounts.join(',') : accounts || undefined;
    return call('/portfolio/securities', { query: { accountId } }, () => demoSecurities(accountId));
  },
  // Money-weighted return (XIRR) of the SUM of the given accounts (one code, an array, or omitted = every strategy
  // account on the token): { asOf, accounts, periods: [{ period: '1Y'|'3Y'|'SI', irr (percent|null), annualised, from, to }] }.
  // Pass a scope's strategy codes, or its owner / group id — never an owner id together with its own accounts
  // (counted twice). SI under a year is the period's own return (annualised: false). Formatting: src/irr.js.
  irr: accounts => {
    const list = Array.isArray(accounts) ? accounts.join(',') : accounts || undefined;
    return call('/portfolio/irr', { query: { accounts: list } }, () => demoIrr(list));
  },
  // Key metrics since inception for one strategy account or an owner / group id (myQode lib/portfolioMetrics.ts):
  // { metrics: { cagr, benchCagr, alpha, volatility, sharpe, beta, maxDrawdown, bestMonth, worstMonth, years, benchmark,
  // riskFree } } — fractions (0.226 = 22.6%); null where not meaningful (CAGR under a year).
  metrics: accountId => call('/portfolio/metrics', { query: { accountId } }, () => ({ metrics: null })),
};

// Demo IRR: plausible figures a little under the demo's NAV returns (top-ups came in after the early gains).
const demoIrr = list => {
  const asOf = new Date(Date.now() + 5.5 * 3600000).toISOString().slice(0, 10);
  const back = y => { const d = new Date(asOf + 'T00:00:00Z'); d.setUTCFullYear(d.getUTCFullYear() - y); return d.toISOString().slice(0, 10); };
  return {
    asOf, accounts: list ? String(list).split(',') : [],
    periods: [
      { period: '1Y', irr: 15.42, annualised: true, from: back(1), to: asOf },
      { period: '3Y', irr: 17.08, annualised: true, from: back(3), to: asOf },
      { period: 'SI', irr: 18.61, annualised: true, from: '2023-07-01', to: asOf },
    ],
  };
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
  // "Request document": emails Investor Relations (and an acknowledgement to the investor)
  request: body => post('/documents/request', body),
};

export const engagement = {
  newsletters: () => call('/engagement/newsletters', {}, () => demo.articles('Newsletter')),
  perspectives: () => call('/engagement/perspectives', {}, () => demo.articles('Perspective')),
  events: () => call('/engagement/events', {}, () => demo.articles('Event')),
  portalGuide: () => call('/engagement/portal-guide', {}, () => ({ videos: [], snapshots: [], byReport: { snapshots: {}, videos: {} }, counts: { videos: 0, snapshots: 0 } })),
  referral: body => post('/engagement/referral', body),
  // "Your Voice Matters": { recommend, satisfaction, clarity, ease: 1–5, comment? ≤ 2000 }. Stored on the server and
  // emailed to Investor Relations only (never the client), so — like the service requests — not TEST_MODE-blocked.
  // The server refuses it (403) for partner view-only and impersonation tokens.
  feedback: body => call('/engagement/feedback', { method: 'POST', body: { ...body, platform: Platform.OS, appVersion: APP_VERSION } },
    () => ({ ok: true, success: true, id: 0 })),
  referrals: () => (demoOn ? mock(() => ({ referrals: [] })) : api('/engagement/referral/list')),   // past referrals, newest first
  // Analytics only writes to pms_mobile_analytics; it never contacts the client.
  analytics: events => (demoOn ? Promise.resolve({ ok: true }) : api('/engagement/analytics', { method: 'POST', body: { events } })),
};

export const experience = {
  family: () => call('/experience/family', {}, () => demo.family()),
};

let bankCache = null;
let switchCache = null, switchPending = null;   // { data, at } — per signed-in client, see clearUserCaches()
let switchGen = 0;   // bumped by clearUserCaches(): replies from an earlier session are dropped
const SWITCH_FRESH_MS = 60 * 1000;
// Drop everything cached for the current client. Call on sign-out and when impersonating someone else.
export const clearUserCaches = () => { switchGen++; switchCache = null; switchPending = null; documents.forget(); partnerMemo.clear(); };
// In-app notifications (the bell) and their settings: app/api/mobile/notifications/*. Popups arrive by push (src/push.js).
const demoNotes = () => {
  const h = x => new Date(Date.now() - x * 3600000).toISOString();
  return { items: [
    { id: 3, category: 'portfolio', title: 'Your August update', body: 'Your portfolio returned +2.1% in August and was worth ₹48.2 L at month end.', link: 'tab:portfolio', createdAt: h(20), read: false },
    { id: 2, category: 'reading', title: 'New newsletter', body: 'Our latest newsletter is ready to read in the app.', link: 'page:newsletters', createdAt: h(70), read: true },
    { id: 1, category: 'money', title: 'Investment recorded', body: '₹5 L was added to your Qode All Weather account on 12 Aug.', link: 'page:transactions', createdAt: h(300), read: true },
  ], unread: 1, hasMore: false };
};
export const notifications = {
  list: (before = 0) => call('/notifications', { query: { limit: 50, ...(before ? { before } : {}) } }, demoNotes),
  read: body => call('/notifications/read', { method: 'POST', body }, () => ({ unread: 0 })),
  prefs: () => call('/notifications/prefs', {}, () => ({ money: true, portfolio: true, reading: true, updates: true })),
  savePrefs: body => call('/notifications/prefs', { method: 'PUT', body }, () => ({ money: true, portfolio: true, reading: true, updates: true, ...body })),
};

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
    const gen = switchGen;
    const fetchIt = () => api('/services/switch-request').then(d => { if (gen === switchGen) switchCache = { data: d, at: Date.now() }; return d; });
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
    .then(r => { switchCache = null; return r; }, e => { switchCache = null; throw e; }),
  strategyInquiry: body => post('/services/strategy-inquiry', body),
  discussion: body => post('/services/discussion', body),
  accountRequest: body => post('/services/account-request', body),
  registerPushToken: guarded('registering a push token (enables push notifications to the investor)',
    pushToken => api('/services/register-push-token', { method: 'POST', body: { pushToken, platform, app: 'myqode', appVersion: APP_VERSION } })),
  unregisterPushToken: pushToken => api('/services/register-push-token', { method: 'DELETE', body: { pushToken, app: 'myqode' } }),
  // What happened on this phone when it tried to set up popups (server logs it as [push diag]). Never throws.
  pushDiag: diag => api('/services/register-push-token', { method: 'POST', body: { app: 'myqode', diag: { ...diag, platform, appVersion: APP_VERSION } } }).catch(() => {}),
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
  // Received but not in the portfolio yet, with the dates it will be invested and become visible.
  inFlight: () => call('/payments/in-flight', {}, () => {   // demo: one payment on its way (tomorrow invested, the day after visible)
    const d = k => new Date(Date.now() + 330 * 60000 + k * 86400000).toISOString().slice(0, 10);
    return { items: [{ orderId: 'order_demo_2001', accountId: 'QAW0412', strategy: 'Qode All Weather', amount: 500000, paidAt: new Date().toISOString(), deployOn: d(1), visibleOn: d(2), late: false }] };
  }),
};

// Partner app: the fee periods, a period's fee rows and the market indicator are slow to build on the server
// (the fee calculator reads Zoho; the indicator is a large upstream file) and change rarely, so each answer is
// kept in memory for a while and shared — reopening a tab, the statement or the invoice is instant, and a request
// already in flight is reused rather than repeated. A failed request is not kept. Cleared on sign-out.
const partnerMemo = new Map();   // key → { p: Promise, at }
function memo(key, ttlMs, fn) {
  const hit = partnerMemo.get(key);
  if (hit && Date.now() - hit.at < ttlMs) return hit.p;
  const p = fn();
  partnerMemo.set(key, { p, at: Date.now() });
  p.catch(() => { if (partnerMemo.get(key) && partnerMemo.get(key).p === p) partnerMemo.delete(key); });
  return p;
}
const MIN = 60 * 1000;

// Partner (distributor) login only — the server re-checks the distributor role on every call.
// Read-only: a distributor never acts on an investor's account from the app.
export const distributor = {
  journey: () => api('/distributor/journey'),
  strategyAum: () => api('/distributor/strategy-aum'),
  // Fees & payouts — same figures as the web (the server calls the web calculator)
  feePeriods: () => memo('fee-periods', 10 * MIN, () => api('/distributor/fees')),
  feeRows: period => memo('fee-rows:' + period.label + ':' + period.startDate + ':' + period.endDate, 5 * MIN,
    () => api('/distributor/fees', { method: 'POST', body: { startDate: period.startDate, endDate: period.endDate, period: period.label }, timeout: 60000 })),
  invoiceProfile: () => api('/distributor/invoice-profile'),
  saveInvoiceProfile: body => api('/distributor/invoice-profile', { method: 'PUT', body }),
  invoices: () => api('/distributor/invoice-issue'),
  issueInvoice: body => api('/distributor/invoice-issue', { method: 'POST', body }),
  // Signed 5-minute link to a PDF (investor statement or deck), opened in the phone's viewer
  fileLink: body => api('/distributor/file-link', { method: 'POST', body }),
  indicator: () => memo('indicator', 30 * MIN, () => api('/distributor/indicator', { timeout: 45000 })),
  ticket: body => api('/distributor/ticket', { method: 'POST', body }),
  // "View account": a 2-hour read-only token for one investor in the partner's own book (web: investors page).
  viewAccount: clientCode => api('/distributor/view-account', { method: 'POST', body: { clientCode } }),
};

// Reports page (app/api/mobile/reports/*): one strategy account at a time. Transactions are synced daily; capital
// gains, expenses and the fact sheet come from Nuvama's report exports (their asOf is the export date).
// opts: transactions { group, from, to, limit, offset, export }, capitalGains { fy, term, limit, offset, export },
// expenses { type, limit, offset, export }. export: 1 returns up to 5000 rows (for the PDF). pnl / balanceSheet
// take one account or several (see below).
export const reports = {
  transactions: (accountId, opts = {}) => call('/reports/transactions', { query: { accountId, ...opts } }, () => demoReports.transactions(accountId, opts)),
  capitalGains: (accountId, opts = {}) => call('/reports/capital-gains', { query: { accountId, ...opts } }, () => demoReports.capitalGains(accountId, opts)),
  expenses: (accountId, opts = {}) => call('/reports/expenses', { query: { accountId, ...opts } }, () => demoReports.expenses(accountId, opts)),
  factsheet: (accountId, opts = {}) => call('/reports/factsheet', { query: { accountId, ...opts } }, () => demoReports.factsheet(accountId, opts)),
  // Profit and loss account - Balance sheet (Nuvama's layout; myQode/lib/plbsCompute.ts). accounts: one code or an
  // array of codes, summed on the server ("All accounts" is ONE call). pnl opts { from, to }: the P&L for the period
  // and the balance sheet at `to` (defaults: this financial year to the latest value date). balanceSheet opts { date }:
  // the balance sheet as of that date, its P&L from the start of that financial year. Same response shape.
  pnl: (accounts, opts = {}) => {
    const accountId = Array.isArray(accounts) ? accounts.join(',') : accounts;
    return call('/reports/pnl', { query: { accountId, ...opts } }, () => demoReports.pnl(accountId, opts));
  },
  balanceSheet: (accounts, opts = {}) => {
    const accountId = Array.isArray(accounts) ? accounts.join(',') : accounts;
    return call('/reports/balance-sheet', { query: { accountId, ...opts } }, () => demoReports.balanceSheet(accountId, opts));
  },
};

// Distributor "Download reports": one investor's statements (the five reports above) fetched with the distributor's
// read-only view token for that investor (POST /distributor/view-account: checks the investor is in the
// distributor's book, 2-hour viewOnly token scoped to the investor's accountCodes). The token is used per call
// (api opts.token) and never replaces the distributor's own session. Every request carries via=distributor so the
// server logs can tell these apart from the investor's own downloads. The token is kept for 90 minutes per
// investor (cleared on sign-out with the partner cache); a 401 fetches a fresh one once.
// Returns { user, accounts: [{ id, name, holder, closed }], reports } where reports has the same methods and
// arguments as `reports` above. Demo mode: the demo family's accounts and demo reports.
const VIEW_TOKEN_MS = 90 * MIN;
const viewKey = clientCode => 'view-token:' + clientCode;
const viewTokenFor = clientCode => memo(viewKey(clientCode), VIEW_TOKEN_MS, () => distributor.viewAccount(clientCode));
const snapshotAccounts = (snap, allowed) => {
  const seen = new Set(), out = [];
  ((snap && snap.owners) || []).forEach(o => (o.accounts || []).forEach(a => {
    const id = a && a.id != null ? String(a.id) : '';
    if (!id || seen.has(id) || (allowed && !allowed.has(id))) return;
    seen.add(id);
    out.push({ id, name: a.strategyName || '', holder: o.name || '', closed: !!a.isClosed });
  }));
  return out;
};
export async function clientReports(clientCode) {
  if (demoOn) {
    const snap = demo.snapshot();
    return { user: { name: (snap.owners[0] && snap.owners[0].name) || 'Demo investor', clientCode }, accounts: snapshotAccounts(snap), reports };
  }
  const first = await viewTokenFor(clientCode);
  const get = async (path, query) => {
    const run = async () => api(path, { query: { ...query, via: 'distributor' }, token: (await viewTokenFor(clientCode)).token, timeout: 60000 });
    try { return await run(); }
    catch (e) {
      if (e.status !== 401) throw e;
      partnerMemo.delete(viewKey(clientCode));   // expired: one fresh token, one retry
      return run();
    }
  };
  const list = a => (Array.isArray(a) ? a.join(',') : a);
  const bound = {
    transactions: (accountId, opts = {}) => get('/reports/transactions', { accountId, ...opts }),
    capitalGains: (accountId, opts = {}) => get('/reports/capital-gains', { accountId, ...opts }),
    expenses: (accountId, opts = {}) => get('/reports/expenses', { accountId, ...opts }),
    factsheet: (accountId, opts = {}) => get('/reports/factsheet', { accountId, ...opts }),
    pnl: (accounts, opts = {}) => get('/reports/pnl', { accountId: list(accounts), ...opts }),
    balanceSheet: (accounts, opts = {}) => get('/reports/balance-sheet', { accountId: list(accounts), ...opts }),
  };
  const user = first.user || {};
  // Strategy accounts with their names: the investor's own snapshot, limited to the codes on the view token (the
  // report routes answer 403 for anything else). Without it, the investor's own account code.
  const snap = await get('/portfolio/snapshot', {}).catch(() => null);
  let accounts = snapshotAccounts(snap, new Set((user.accountCodes || []).map(String)));
  if (!accounts.length && user.clientCode) accounts = [{ id: String(user.clientCode), name: '', holder: user.name || '', closed: false }];
  return { user, accounts, reports: bound };
}

// Super-admin only (token must carry isSuperAdmin and not be an impersonation token).
export const admin = {
  clients: (search = '', page = 1, limit = 200) => api('/admin/clients', { query: { search, page, limit } }),
  impersonate: clientCode => api('/admin/impersonate', { method: 'POST', body: { clientCode } }),
  analytics: (days = 30) => api('/admin/analytics', { query: { days } }),
};

// Backoffice (app admin mode). The admin token is a normal mobile JWT with isAdmin; these routes live under
// /api/admin/bo, not /api/mobile. A 401 / 403 means the admin session is gone or never had access: the handler set
// with onAdminDenied (the root component) returns to the sign-in screen.
let adminDenied = null;
export const onAdminDenied = fn => { adminDenied = fn; };
const bo = (path, opts) => adminApi(path, opts).catch(e => {
  if ((e.status === 401 || e.status === 403) && adminDenied) adminDenied(e);
  throw e;
});
export const backoffice = {
  overview: () => bo('/overview', { timeout: 40000 }),
  users: ({ q = '', type = 'all', status = 'all', page = 1, limit = 50 } = {}) => bo('/users', { query: { q, type, status, page, limit } }),
  userDetail: email => bo('/users/detail', { query: { email } }),
  setPassword: (email, password) => bo('/users/password', { method: 'POST', body: { email, password } }),
  // Emails the client: blocked in test mode like every other client-facing email.
  resetLink: email => (TEST_MODE ? Promise.reject(new BlockedError('emailing a password reset link')) : bo('/users/reset-link', { method: 'POST', body: { email } })),
  unlock: email => bo('/users/unlock', { method: 'POST', body: { email } }),
  impersonate: ({ email, target = 'app' }) => bo('/impersonate', { method: 'POST', body: { email, target } }),
  createDistributor: body => bo('/distributors', { method: 'POST', body }),
  deleteDistributor: email => bo('/distributors', { method: 'DELETE', query: { email } }),
  audit: (opts = {}) => bo('/audit', { query: { limit: 100, ...opts } }),
  // App notifications: campaigns and delivery health. A send other than 'test' needs PUSH_LIVE=1 on the server.
  notifications: () => bo('/notifications'),
  sendNotification: body => bo('/notifications', { method: 'POST', body }),
};
