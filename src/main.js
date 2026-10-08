// myQode Curtain v2 — root stateful component. The state machine and computed
// values ("vals") are ported from the design's DCLogic class, adapted for
// React Native (text handlers instead of DOM events, active flags instead of
// inline CSS strings).
import DesktopShell, { DesktopAuthFrame } from './web/desktop';
import DesktopDistributor from './web/distributor';
import DesktopAuth from './web/auth';
import DesktopAdmin from './web/admin';
import React from 'react';
import { View, StatusBar, BackHandler, AppState, Platform, PanResponder } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as Linking from 'expo-linking';
import { Alert } from 'react-native';
import { biometricAvailable, biometricEnabled, setBiometricEnabled, biometricUnlock, inExpoGo } from './api/biometric';
import { LockScreen, UpdatePrompt } from './screens/gate';
import * as Network from 'expo-network';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { C, UICtx, Tx, runBack } from './ui';
import { readPendingPayment, hintFromReturnUrl } from './screens/pay';
import { storeGet, storeSet, storeDel } from './api/session';

// The primary-UCC pop-up is once per SIGN-IN, not per app start: Expo Go reloads the project on every
// payment/SIP return link, which reset the in-memory flag and showed it again after each transaction.
// So the dismissal is remembered on the device against the client code and cleared on sign-out.
const UCC_SEEN_KEY = 'myqode.uccSeen';
// Admin mode: while the admin views the app as a user, the admin's own token is kept here too, so an app restart
// (or a web reload) still offers "Back to admin" instead of stranding the admin inside the user's session.
const ADMIN_KEY = 'myqode.adminToken';
import {
  QUARTER_LABELS,
  QS, TYPES, FEES, RES,
} from './data';
import { irrPeriod, fmtIrr, irrLabel } from './irr';
import { BASE_URL, auth, portfolio, meta, admin, notifications, payments, backoffice, onAdminDenied, distributor, setViewToken, services, documents, clearUserCaches, ApiError, onUnauthorized, getToken, setToken, clearToken, setDemo, isDemo, TEST_MODE, DEV_BYPASS, APP_VERSION, SHOW_UPDATE_BANNER } from './api';
import { trackStart, trackStop, screen, track, flush as trackFlush } from './api/track';
import { perfFrom, navFrom, ddFrom, cashFrom, plFrom, combineFamily } from './webcalc';
import { buildScopes, buildFys, buildFysQ, buildPaths, niceAxis, navSeries, trailingRows, flowTotals, num, pct, ddPct, inr, sinr, fmtDate, fmtMonth, fmtDayMon, titleCase, semverLt, fmtD, fmtDM, historyDays, rangeHasData } from './adapt';
import Splash from './screens/splash';
import Carousel from './screens/carousel';
import { Login, OtpScreen, SetPassword } from './screens/login';
import Onboarding, { ResumeScreen } from './screens/onboarding';
import AppShell from './screens/appshell';
import { DistributorShell } from './screens/distributor';
import { AdminConsole, ImpersonationFrame } from './screens/admin';
import Curtain from './screens/curtain';
// Onboarding (account opening) — a separate, unauthenticated backend; see src/onboarding/config.js.
import OnboardingStore from './onboarding/store';
import * as obApiModule from './onboarding/api';
import { prefetchRm } from './rmName';
import { nativeFilePart } from './onboarding/file-native';
// Uploads read the picked file with expo-file-system (see file-native.js); everything else is the module as is.
const obApi = { ...obApiModule, uploadDocument: (id, fieldKey, file) => obApiModule.uploadDocument(id, fieldKey, file, nativeFilePart) };
import * as obStorage from './onboarding/storage';
import {
  accountTypeFor, accountLabelFor, accountTypeToOb, toBackendData, fromBackendData, stepIndexFor, resumeStepFor,
  lockedFieldsFor, verifiedSummary, maskAccount, docSlotsFor, resolveDocs, riskProfileFor, formatDobInput,
  isValidEmail, isValidMobile, validateBegin, validateIdentity, validateNominees, validateDocs, validateForSubmit,
  cleanName, validateAmount, ENTITY_LABELS,
} from './onboarding/mapping';
import { API_BASE, RESUME_HOSTS, UPLOAD } from './onboarding/config';
import { PAGE_ALIASES, openLink } from './nav';
import * as push from './push';
import { setPdfSummaries } from './screens/reportPdf';
import { userMessage } from './errors';
// Report summaries are a web feature; the phone app shows the figures and tables only.
setPdfSummaries(Platform.OS === 'web');

const MIME_BY_EXT = { pdf: 'application/pdf', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp' };
const guessMime = name => MIME_BY_EXT[(String(name || '').split('.').pop() || '').toLowerCase()] || 'application/octet-stream';

const PERIOD = { '1W': '1W', '10D': '10D', '1M': '1M', '6M': '6M', '1Y': '1Y', '3Y': '3Y', SI: 'ALL' };
const RANGE_IDS = ['1W', '10D', '1M', '6M', '1Y', '3Y', 'SI'];
// Runs fn when the JS thread is idle (requestIdleCallback, in React Native and most browsers); a short timer where
// it is missing (Safari).
const whenIdle = fn => (typeof requestIdleCallback === 'function' ? requestIdleCallback(() => fn(), { timeout: 2000 }) : setTimeout(fn, 50));
// How long the app may sit in the background before it asks for Face ID / fingerprint again (when the lock is on).
const RELOCK_MS = 60 * 1000;
const HOME_VIEW = 'nuvama';   // the data view Home always shows for an account with Orbis history (see applyView)
const RANGE_LABEL = { '1W': 'the last week', '10D': 'the last 10 days', '1M': 'the last month', '6M': 'the last 6 months', '1Y': 'the last year', '3Y': 'the last 3 years', SI: 'since inception' };
const normRange = r => (r === 'All' || r === 'ALL' || !PERIOD[r] ? 'SI' : r);   // 'All' was the old name of SI
// The API windows (nav / drawdown ?period=) are 1W, 1M, 3M, 6M, 1Y, 3Y, ALL. 10D isn't one of them: it is
// fetched as 1M and cut to the last 10 calendar days here.
const apiPeriod = p => (p === '10D' ? '1M' : p);
const CLIENT_DAYS = { '10D': 10 };
function cutRange(nav, dd, period) {
  const days = CLIENT_DAYS[period];
  if (!days) return { nav, dd };
  // Counted back from the latest date on record (as webcalc's windows are), so a lagging or demo series still fills.
  const all = (nav && nav.series) || [];
  const last = all.length ? new Date(String(all[all.length - 1].date).slice(0, 10) + 'T00:00:00Z') : null;
  if (last) last.setUTCDate(last.getUTCDate() - days);
  const cut = last ? last.toISOString().slice(0, 10) : '';
  const rows = all.filter(r => String(r.date).slice(0, 10) >= cut);
  if (!rows.length) return { nav: nav ? { ...nav, series: [] } : nav, dd: dd ? { ...dd, series: [] } : dd };
  // Re-anchor at the window start, the way the API anchors every window: growth rebased to 100, drawdown peak reset.
  const p0 = rows[0].portfolio, b0 = (rows.find(r => r.benchmark != null) || {}).benchmark;
  const series = rows.map(r => ({ ...r, portfolio: +((r.portfolio / p0) * 100).toFixed(4), benchmark: r.benchmark != null && b0 ? +((r.benchmark / b0) * 100).toFixed(4) : null }));
  let pk = -Infinity, bpk = -Infinity;
  const ddSeries = series.map(r => {
    pk = Math.max(pk, r.portfolio); if (r.benchmark != null) bpk = Math.max(bpk, r.benchmark);
    return { date: r.date, portfolio: +(((r.portfolio - pk) / pk) * 100).toFixed(4), benchmark: r.benchmark == null ? null : +(((r.benchmark - bpk) / bpk) * 100).toFixed(4) };
  });
  return { nav: { ...nav, period, series }, dd: { ...(dd || {}), period, series: ddSeries } };
}

// Server codes meaning the setup code can no longer be used (lib/mobileOtpAttempts.ts): only a new code helps.
const OTP_DEAD = ['OTP_LOCKED', 'OTP_EXPIRED'];

// Sign-in fields never take spaces (typed or pasted): an email, a client code and a password contain none.
const noSpace = t => String(t || '').replace(/\s+/g, '');

// Web: back to the bare /app address. Each console reads its first screen from the address (the investor dashboard from
// /app/<page>, the partner panel from /app/d/<section>), so one session's address must not open the next session: a
// user opened from admin mode landed on the previous user's Profile, or on a 404 for a partner address.
function cleanAddress() {
  if (Platform.OS !== 'web' || typeof window === 'undefined' || !window.history || !window.location) return;
  if (window.location.pathname !== '/app') window.history.replaceState(window.history.state, '', '/app');
}

// Chart geometry for one NAV / drawdown entry: series, rebased lines, axis and SVG paths. Cached per entry object;
// the view cache (viewNav) returns the same entry for the same view and period, so switching views, tabs or
// back to a range already seen reuses it instead of rebuilding thousands of points on every render.
const geomCache = new WeakMap();
function chartGeom(navEntry) {
  const hit = navEntry && geomCache.get(navEntry);
  if (hit) return hit;
  const navForChart = navEntry.nav && Array.isArray(navEntry.nav.series) ? { ...navEntry.nav, series: navEntry.nav.series.filter(p => !p.synthetic) } : navEntry.nav;
  const { pts, bench, dates, navs, bvals } = navSeries(navForChart);
  const rawByDate = {}; dates.forEach((d, i) => { rawByDate[d] = [navs[i], bvals[i]]; });
  const { pts: ddPts, bench: ddBench, dates: ddDates } = navSeries(navEntry.dd);
  const p3 = buildPaths(ddPts, ddBench, 330, 100, 0);
  // Plot in real NAV terms like the web chart: portfolio = raw NAV, benchmark scaled to start at the same NAV.
  const hasRaw = pts.length > 1 && navs.length === pts.length && navs.every(v => v != null && v > 0);
  // Every range is drawn from 10 (the PMS convention the full-history chart already used): portfolio and
  // benchmark are both rebased to 10 at the first date shown. The real NAV is still what the tooltip and the
  // "current NAV" figure show (rawLine / navs), only the drawing is rebased.
  const rawLine = hasRaw ? navs : pts;
  const cPts = rawLine.length ? rawLine.map(v => (v / rawLine[0]) * 10) : [];
  const cBench = bench && bench.length ? bench.map(b => (b / bench[0]) * 10) : null;
  // Axis: a rounded range around the data; its bottom is exactly 10 unless the line dips below 10. 10.00 is always
  // labelled — as the bottom tick, or at its own height when the axis goes lower. Labels carry two decimals.
  const axisVals = cBench ? cPts.concat(cBench) : cPts;
  let axis = { lo: 0, hi: 1, ticks: [] };
  if (cPts.length > 1) {
    const nice = niceAxis(axisVals);
    const lo = Math.min(...axisVals) >= 10 ? 10 : nice.lo, hi = Math.max(nice.hi, lo + 0.01);
    const at = v => ({ t: v.toFixed(2), f: (hi - v) / (hi - lo) });   // f: 0 = top, 1 = bottom
    let ticks = [at(hi), at((hi + lo) / 2), at(lo)];
    if (lo < 10 && hi > 10) {
      const ten = at(10);
      ticks = ticks.filter(k => Math.abs(k.f - ten.f) > 0.15).concat(ten);   // drop a tick that would crowd it
    }
    axis = { lo, hi, ticks };
  }
  const p1 = buildPaths(cPts, cBench, 330, 120, null, [axis.lo, axis.hi]);
  const p2 = buildPaths(cPts, cBench, 358, 110, null, [axis.lo, axis.hi]);
  const navNow = rawLine.length ? rawLine[rawLine.length - 1] : 0;   // the real NAV, not the rebased line
  const g = { pts, bench, dates, navs, bvals, rawByDate, ddPts, ddBench, ddDates, p1, p2, p3, hasRaw, rawLine, cPts, cBench, axis, navNow };
  if (navEntry) geomCache.set(navEntry, g);
  return g;
}

export default class MyQode extends React.Component {
  state = {
    phase: 'splash', tab: 'home', sheet: null, acct: 0, range: 'SI',
    amt: 500000, method: 0, success: null, otp: ['', '', '', '', '', ''],
    email: '', pw: '', loading: false, lifting: false, cu: 1, ob: null, car: 0,
    ts: 1, hc: false, rm: false,
    pnlFy: 0, pnlOpen: null, pnlSeg: 0, docQ: '', docCat: 0, det: false, cred: null,
    snap: null, scopes: null, d: null, dl: false, sl: false, dErr: '', hold: {}, navs: {},
    authErr: '', authInfo: '', busy: false, setupEmail: '', np: '', np2: '', user: null, page: null,
    refreshing: false, rk: 0, toast: '',
    hist: null, dv: 'nuvama',   // hist = raw rows of an account with legacy Orbis data; dv = which of the web's three views
    update: null, devOpen: false, devClients: null, devErr: '', devQ: '',
    resume: null,      // { token, source, loading, error, code } while a resume link / saved draft is being opened
    distributor: null, // ?d=<code> from a distributor link
    loginAs: 'client', // login screen switch: 'client' | 'distributor'
    bio: null,         // { label } when Face ID / fingerprint is available on this device
    bioOn: false,      // user turned the start-up lock on
    lockResume: null,   // phase to return to after a re-lock on return from the background
    lockErr: '', lockBusy: false, lockGone: false,   // lockGone: lock was on but this phone no longer has biometrics
  };

  go(t) {
    if (this.state.tab === t) return;
    if (t === 'services' && this.state.viewing) return;   // a distributor viewing a client: no services, payments or requests
    clearTimeout(this.goT);
    screen(t);
    this.setState({ tab: t, loading: true });
    this.goT = setTimeout(() => this.setState({ loading: false }), 380);
  }

  obDefault() {
    return {
      step: 'begin', name: '', email: '', mobile: '', dob: '', addr: '', pan: '', fatherName: '', aadhaar: '', err: '',
      type: 0, subRes: 0, entitySub: 0, res: 0, gender: 0, marital: 0, mobBel: 0, emailBel: 0, pep: 1,
      occ: 1, src: 1, income: 2, edu: 2, h2: false, h2Name: '', h2Email: '', h2Mobile: '', h2Pan: '', h2Dob: '', mode: 0,
      noms: [{ name: '', rel: '', mob: '', alloc: '100', minor: false, guardian: '' }], nomErr: '', nomOptOut: false,
      fee: 0, qi: 0, ans: [null, null, null, null, null, null],
      manual: {}, verify: null, docErr: '',
      copied: false, fundOpen: false, fundDone: false, amt: 5000000,
    };
  }
  setOb(p) { this.setState({ ob: { ...this.state.ob, ...p } }, () => this.syncOb()); }
  // Push the current form state to the autosave queue (diffed in the store).
  syncOb() {
    const OB = this.state.ob;
    if (!OB || !this.store || this.state.phase !== 'ob') return;
    if (!this.store.hasSubmission() && !this.store.wantCreate) return;
    this.store.sync(toBackendData(OB, this.store.s.server), stepIndexFor(OB.step));
  }
  chips(list, cur, on) {
    return list.map((l, i) => ({ label: l, pick: () => on(i), active: cur === i }));
  }

  componentDidMount() {
    this.otpRefs = [0, 1, 2, 3, 4, 5].map(() => React.createRef());
    this.obRefs = [0, 1, 2, 3, 4, 5].map(() => React.createRef());
    this.seq = 0;
    onUnauthorized(() => this.expire());
    onAdminDenied(e => this.adminDenied(e));
    this.backSub = BackHandler.addEventListener('hardwareBackPress', () => this.handleBack());

    // Razorpay's return page deep-links to …/payment-return. Normally the payment sheet's auth session consumes
    // it; this catches the link when the sheet is gone (project reloaded, app relaunched) and resumes the order.
    this.linkSub = Linking.addEventListener('url', ({ url }) => this.onDeepLink(url));
    // Onboarding store: lazy draft creation, autosave with offline retry, Digio polling, uploads, resume.
    this.store = new OnboardingStore({ api: obApi, storage: obStorage, onChange: () => { if (!this.unmounted) this.forceUpdate(); } });
    Network.getNetworkStateAsync().then(st => this.store.setOffline(!(st.isConnected && st.isInternetReachable !== false))).catch(() => {});
    this.netSub = Network.addNetworkStateListener(st => this.store.setOffline(!(st.isConnected && st.isInternetReachable !== false)));
    Linking.getInitialURL().then(url => { if (url) this.handleResumeUrl(url); }).catch(() => {});
    this.store.loadSaved().then(saved => (saved && saved.resumeToken ? this.store.peekProgress(saved.resumeToken) : null)).catch(() => {});
    // Browser back button (web build): keep one history entry ahead so "back" comes to us instead of leaving the app.
    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.history) {
      window.history.pushState({ myqode: 1 }, '');
      this.onPop = () => { if (this.handleBack()) window.history.pushState({ myqode: 1 }, ''); else window.history.back(); };
      window.addEventListener('popstate', this.onPop);
    }
    this.appSub = AppState.addEventListener('change', st => {
      // Face ID / fingerprint lock also on return from the background (not only at a cold start): after RELOCK_MS
      // away, a signed-in app shows the lock screen before any content, and the rest of this handler waits for it.
      if (st === 'background') this.bgAt = Date.now();
      if (st === 'active' && this.shouldRelock()) { this.relock(); return; }
      // Not while a full-screen page is open (e.g. Reports): coming back from the share sheet must not reset its lists.
      if (st === 'active' && this.state.phase === 'app' && !this.state.page && Date.now() - (this.lastLoad || 0) > 60000) this.refresh();
      if (st === 'active' && this.state.phase === 'app') { this.loadNotifs(); this.pushSync(); }
      // Back from Settings with notifications turned on: register this phone at once (admin mode too).
      if (st === 'active' && this.state.phase === 'admin') { this.setState({ pushOffer: false }); this.pushSync(); }
      // A release can land while the app sits in the background: look again when it comes back, at most every 30 min.
      if (st === 'active' && Date.now() - (this.lastVersionCheck || 0) > 30 * 60 * 1000) this.checkVersion();
      if (this.store) { if (st === 'active') this.store.onForeground(); else if (st === 'background') this.store.onBackground(); }
    });
    // Notifications: popups arriving while the app is open refresh the bell; a tap opens its destination (a tap that
    // launched the app waits in pendingTap until the app is ready).
    this.pushOff = push.listen({
      onReceive: () => this.loadNotifs(),
      onTap: (link, id) => this.onNoteTap(link, id),
      onToken: () => this.pushSync(),
    });
    this.boot();
  }
  componentWillUnmount() {
    if (this.pushOff) this.pushOff();
    this.unmounted = true;
    if (this.backSub) this.backSub.remove();
    if (this.linkSub) this.linkSub.remove();
    if (this.onPop) window.removeEventListener('popstate', this.onPop);
    clearTimeout(this.toastT);
    if (this.appSub) this.appSub.remove();
    if (this.netSub) this.netSub.remove();
    if (this.store) this.store.dispose();
    clearTimeout(this.splashT); clearTimeout(this.goT);
    if (this.raf) cancelAnimationFrame(this.raf);
  }

  // Back button: close what is on top, then go to Home, and only leave the app
  // after a second press on the first screen. Returns true when the press was handled here.
  // (Bottom sheets are native Modals: they close themselves on back via onRequestClose.)
  // iOS has no back button: a swipe in from the left edge does what Android's back does (sheets are native
  // modals and close by their own swipe / buttons). Captured only for a clear rightward edge swipe, so taps and
  // vertical scrolling underneath are untouched.
  edgeSwipe = PanResponder.create({
    onMoveShouldSetPanResponderCapture: (_, g) => Platform.OS === 'ios' && g.x0 < 28 && g.dx > 14 && Math.abs(g.dy) < Math.abs(g.dx) * 0.6,
    onPanResponderRelease: (_, g) => { if (g.dx > 70 || (g.dx > 30 && g.vx > 0.5)) this.handleBack(true); },
    onPanResponderTerminationRequest: () => false,
  });

  // soft: the iOS edge swipe — it only ever goes back, never arms "press back again to exit".
  handleBack(soft = false) {
    const S = this.state;
    if (runBack()) return true;
    if (S.sheet) { this.setState({ sheet: null }); return true; }
    if (S.page) { this.setState({ page: null }); return true; }
    if (S.phase === 'app') {
      // Tabs are top-level destinations, not a stack: from any tab, back goes straight to Home.
      if (S.tab !== 'home') { this.go('home'); return true; }
      if (S.viewing) { this.exitView(); return true; }   // a partner viewing an investor: back to the partner panel
      if (S.imp && !S.imp.backoffice) { this.backToAdmin(); return true; }   // admin viewing as this user
      return soft ? false : this.confirmExit();
    }
    if (S.phase === 'partner' && S.imp && !S.imp.backoffice) { this.backToAdmin(); return true; }
    if (S.phase === 'partner' || S.phase === 'lock' || S.phase === 'admin') return soft ? false : this.confirmExit();
    if (S.phase === 'resume') { this.setState({ phase: this.leaveOb(), resume: null }); return true; }
    if (S.phase === 'ob') { this.obVals().obBack(); return true; }
    if (S.phase === 'otp' || S.phase === 'setpw') { this.setState({ phase: 'login', authErr: '', authInfo: '', busy: false }); return true; }
    if (S.phase === 'carousel' && S.car > 0) { this.setState({ car: S.car - 1 }); return true; }
    if (S.phase === 'login' || S.phase === 'carousel') return soft ? false : this.confirmExit();
    return true;   // splash / transitions: ignore
  }

  confirmExit() {
    if (this.exitArmed && Date.now() - this.exitArmed < 2000) return false;   // second press: let the system exit
    this.exitArmed = Date.now();
    this.toast('Press back again to exit');
    return true;
  }

  toast(msg) {
    clearTimeout(this.toastT);
    this.setState({ toast: msg });
    this.toastT = setTimeout(() => this.setState({ toast: '' }), 2000);
  }

  async boot(unlocked = false) {
    // Whether this device can use Face ID / fingerprint, and whether the user turned it on — for the More card.
    biometricAvailable().then(bio => this.setState({ bio })).catch(() => {});
    biometricEnabled().then(on => this.setState({ bioOn: !!on })).catch(() => {});
    const minSplash = new Promise(r => { this.splashT = setTimeout(r, 1200); });
    let ok = false, partner = false, offline = false, adminOn = false;
    const token = await getToken();
    if (token) {
      // Stay signed in: a token more than a day old is swapped for a fresh 30-day one. Best effort and in the
      // background — the current token stays valid for the calls below, so opening the app never waits on it.
      try {
        const iat = JSON.parse(globalThis.atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).iat;
        if (iat && Date.now() / 1000 - iat > 86400) {
          auth.refresh().then(r => (r && r.token && getToken().then(cur => (cur === token ? setToken(r.token) : null)))).catch(() => {});
        }
      } catch {}
      // Face ID / fingerprint gate: the session is intact, the user just has to unlock the app.
      if (!unlocked && await biometricEnabled()) {
        const bio = await biometricAvailable();
        if (bio) {
          this.setState({ bio, bioOn: true });
          const r = await biometricUnlock(bio.label);
          if (!r.ok) { await minSplash; this.setState({ phase: 'lock', lockErr: r.message, lockGone: false }); return; }
        } else {
          // The lock is on but the fingerprints / face were removed from the phone: never open unlocked —
          // the password is the only way in.
          await minSplash;
          this.setState({ phase: 'lock', lockGone: true, lockErr: 'Fingerprint / face unlock is no longer set up on this phone. Sign in with your password to continue.' });
          return;
        }
      }
    }
    if (token) {
      // Load what the Home screen needs while the splash is showing, so the dashboard usually appears filled in.
      // Capped at 2.5 s (it was 8 s — after Face ID that read as a frozen app): a slower load carries on behind
      // the Home skeleton and fills it in.
      const cap = new Promise(r => setTimeout(r, 2500));
      try {
        const me = await auth.me({ timeout: 10000 });   // start-up: the offline screen beats a long frozen splash
        await new Promise(r => this.setState({ user: me }, r));
        if (me && me.isImpersonated) {
          // A token issued by the backoffice to view the app as this user. The admin's own token is saved when the
          // app's admin mode opened it; without one it came from the web backoffice (/admin), which has its own "Close".
          const adminToken = await storeGet(ADMIN_KEY);
          if (adminToken) this.origToken = adminToken;
          this.setState({ imp: { name: me.name || me.email || 'this user', email: me.email || '', backoffice: !adminToken } });
        }
        if (me && me.isAdmin && !me.isImpersonated) { adminOn = true; this.adminUser = me; trackStart('a:' + me.email, 'admin'); }   // admin mode: the backoffice console
        else if (me && me.isDistributor) { partner = true; if (!me.isImpersonated) trackStart('d:' + me.email, 'distributor'); }   // partner login: no investor accounts, no portfolio load
        else {
        if (!me.isImpersonated) trackStart(me.clientCode);   // an admin viewing as the client is not the client's usage
        storeGet(UCC_SEEN_KEY).then(v => { if (v && v === String(me.clientCode)) this.setState({ uccSeen: true }); });
        services.bankDetails().catch(() => {});
        services.warmSwitchInfo();
        await Promise.race([this.openPortfolio(), cap]);
        }
        ok = true;
      } catch (e) {
        if (e.status === 401) await clearToken();
        else if (MyQode.transient(e)) offline = true;   // signed in, server unreachable: never drop to the carousel
      }
    }
    this.checkVersion();
    await minSplash;
    if (this.unmounted || this.state.phase !== 'splash') return;
    if (offline) { this.setState({ phase: 'lock', lockOffline: true, lockErr: '', lockGone: false, lockBusy: false }); return; }
    if (ok && adminOn) this.setState({ phase: 'admin' }, () => { this.pushSync(); this.applyPendingTap(); });
    else if (ok && partner) this.setState({ phase: 'partner' });
    // Desktop web: the brand panel next to the form already introduces the app, so sign-in comes first.
    else if (ok) this.startApp(); else this.setState({ phase: this.props.desktop ? 'login' : 'carousel' });
  }

  async checkVersion() {
    // The web always serves the latest build: an "update the app" prompt only belongs in the phone app.
    if (!SHOW_UPDATE_BANNER || Platform.OS === 'web') return;
    try {
      const v = await meta.appVersion();
      this.lastVersionCheck = Date.now();
      // Forced: below the minimum version, or the server's APP_FORCE_UPDATE=true (everyone must update).
      if (v && ((v.minVersion && semverLt(APP_VERSION, v.minVersion)) || (v.forceUpdate && v.latestVersion && semverLt(APP_VERSION, v.latestVersion)))) this.setState({ update: { force: true, ...v } });
      else if (v && v.latestVersion && semverLt(APP_VERSION, v.latestVersion)) { if (!this.updateDismissed) this.setState({ update: { force: false, ...v } }); }
      else this.setState({ update: null });
    } catch {}
  }

  curScope(S = this.state) {
    const sc = S.scopes;
    if (!sc) return null;
    if (typeof S.acct === 'string') {       // 'a:<accountCode>' = one strategy account, like picking it in the web dropdown
      const code = S.acct.slice(2);
      for (const o of [...sc.owners, ...(sc.closedOwners || [])]) {
        const a = (o.accounts || []).find(x => String(x.id) === code) || (o.closedAccounts || []).find(x => String(x.id) === code);
        // shown as member + strategy: the member's initials, "<member> · <strategy prefix>"
        if (a) return { id: String(a.id), kind: 'account', name: o.name, initials: o.initials, tag: a.strategyPrefix || a.strategyName || '', code: a.id + ' · ' + (a.strategyName || a.id), value: num(a.portfolioValue) || 0, accounts: [a], closed: !!a.isClosed, closedOn: a.closedOn || null };
      }
    }
    return (S.acct === -1 ? sc.family : sc.owners[S.acct]) || sc.owners[0] || null;
  }

  // A closed account in the Family accounts sheet: greyed, "Closed on 23 Sep 2026", still opens its history.
  closedSubOf(x) {
    return {
      id: String(x.id), name: x.strategyName || x.id, code: x.id, color: C.gray, closed: true,
      closedText: x.closedOn ? 'Closed on ' + fmtDate(x.closedOn) : 'Closed',
      value: this.fmt(num(x.portfolioValue) || 0), pick: () => this.pickScope('a:' + x.id), active: this.state.acct === 'a:' + x.id,
    };
  }

  codes() { return isDemo() ? null : (this.state.user && this.state.user.accountCodes) || null; }

  async loadSnapshot() {
    if (this.state.user && this.state.user.email) prefetchRm(this.state.user.email);   // the profile's RM (Zoho, slow): ready before it is opened
    const snap = await portfolio.snapshot();
    const scopes = buildScopes(snap, this.codes());
    this.fellBack = {};
    // Every account closed: open the most recently closed one (its history, with the "closed on" banner).
    const lastClosed = !scopes.owners.length && (scopes.closedOwners || []).flatMap(o => o.closedAccounts)
      .sort((a, b) => String(b.closedOn || '').localeCompare(String(a.closedOn || '')))[0];
    await new Promise(r => this.setState({ snap, scopes, acct: lastClosed ? 'a:' + lastClosed.id : scopes.family ? -1 : 0, d: null, hold: {}, navs: {}, dErr: '' }, r));
    await this.loadScope();
  }

  // A failure worth retrying by ourselves: no answer at all (tunnel / Wi-Fi hiccup, cold server) or a 5xx.
  // 401/403/404 and validation errors are real answers and are shown at once.
  static transient(e) { return !e || e.status == null || e.status === 0 || e.status >= 500; }
  static wait(ms) { return new Promise(r => setTimeout(r, ms)); }

  // Signing in must never be blocked by portfolio data: open the app and show the problem there, with a retry.
  // `sl` (snapshot loading) keeps the skeleton up for the whole of loadSnapshot → loadScope; before it the
  // dashboard showed "We couldn't load your portfolio" for the gap between the app opening and the first
  // request answering, then filled in — an error that was never real.
  async openPortfolio() {
    this.setState({ sl: true, dErr: '' });
    try {
      for (let attempt = 0; ; attempt++) {
        try { await this.loadSnapshot(); return; }
        catch (e) {
          if (e.status === 401) throw e;
          if (attempt < 2 && MyQode.transient(e)) { await MyQode.wait(1500 * (attempt + 1)); continue; }
          this.setState({ snap: null, scopes: null, d: null, dl: false, dErr: userMessage(e, 'We couldn’t load your accounts.') });
          return;
        }
      }
    } finally { this.setState({ sl: false }); }
  }

  async loadScope(attempt = 0) {
    if (!this.state.scopes) return this.openPortfolio();
    const scope = this.curScope();
    if (!scope) {
      this.setState({ dl: false, d: null, dErr: 'There is no active portfolio on this login yet. If you have just invested, it appears once your account is funded. For anything else, please contact Investor Relations.' });
      return;
    }
    const seq = ++this.seq, period = PERIOD[normRange(this.state.range)];
    this.setState({ dl: true, dErr: '' });
    try {
      const k = scope.kind;
      if (k === 'local-family' || k === 'local-owner') {   // local-owner: an owner's open accounts (adapt.js)
        // one raw-history call per member, combined locally
        // an owner's open accounts are measured against NIFTY 50 together, like every combined view
        const got = await Promise.allSettled(scope.members.map(id => portfolio.history(id, k === 'local-owner' ? 'NIFTY 50' : undefined)));
        if (seq !== this.seq) return;
        const fam = combineFamily(got.map(x => (x.status === 'fulfilled' ? x.value : null)));
        if (!fam || got.some(x => x.status === 'rejected')) {
          const e = (got.find(x => x.status === 'rejected') || {}).reason || {};
          if (e.status === 401) throw e;
          if (this.stepDown(scope)) return;       // can't build the family total: fall back to the first member
          throw new Error(userMessage(e, 'We couldn’t build the family total.'));
        }
        this.setState({ hist: fam, dv: 'nuvama', led: null }, () => this.applyView('nuvama', true));
        this.lastLoad = Date.now();
        this.loadLedger(scope.members.map(id => portfolio.cashflow(String(id), k === 'local-owner' ? 'account' : 'owner')), seq);
        this.loadHoldings(scope, seq); this.loadIrr(scope, seq); this.loadMetrics(scope, seq);
        return;
      }
      // Performance is required; every other part is optional so one failing endpoint can't blank the portfolio.
      const parts = await Promise.allSettled([
        portfolio.performance(scope.id, k), portfolio.nav(scope.id, apiPeriod(period), k), portfolio.drawdown(scope.id, apiPeriod(period), k),
        portfolio.cashflow(scope.id, k), portfolio.monthlyPl(scope.id, k), portfolio.quarterlyPl(scope.id, k),
      ]);
      if (seq !== this.seq) return;
      if (parts[0].status === 'rejected') {
        const e = parts[0].reason || {};
        if (e.status === 401) throw e;
        // This aggregate isn't readable (403) or has no rows (404): step down family -> person -> single account.
        if ((e.status === 403 || e.status === 404) && this.stepDown(scope)) return;
        throw e;
      }
      const [perf, nav0, dd0, cash, monthly, quarterly] = parts.map(x => (x.status === 'fulfilled' ? x.value : null));
      const { nav, dd } = cutRange(nav0, dd0, period);
      // Accounts with legacy Orbis rows: the web computes everything in the browser from raw rows, with three
      // views. Do the same (src/webcalc.js) so every figure matches whichever view is picked.
      let hist = null;
      // A person with exactly one strategy is the same thing as that strategy account: the web shows the
      // Nuvama / Orbis / Combined toggle there too, so look the legacy history up for both.
      const legacyId = k === 'account' ? scope.id : k === 'owner' && scope.accounts.length === 1 ? String(scope.accounts[0].id) : null;
      if (legacyId) {
        try { const h = await portfolio.history(legacyId); if (h && h.orbis && h.orbis.length) hist = h; } catch {}
        if (seq !== this.seq) return;
      }
      if (hist) { this.setState({ hist, led: cash && cash.transactions ? cash.transactions : null }, () => this.applyView(this.state.dv, true)); this.lastLoad = Date.now(); this.loadHoldings(scope, seq); this.loadIrr(scope, seq); this.loadMetrics(scope, seq); return; }
      this.setState({ hist: null, homeD: null, homeNavs: null, d: { id: scope.id, kind: k, perf, cash, fys: buildFys(monthly), fysQ: buildFysQ(quarterly) }, navs: { [period]: { nav, dd } }, dl: false, pnlFy: 0, pnlOpen: null });
      this.lastLoad = Date.now();
      this.loadHoldings(scope, seq); this.loadIrr(scope, seq); this.loadMetrics(scope, seq);
    } catch (e) {
      if (seq !== this.seq) return;
      // Transient failure: keep the skeleton and try again (twice) before showing an error — a tunnel or
      // Wi-Fi hiccup on the first request must not flash "couldn't load" over a portfolio that loads fine.
      if (attempt < 2 && MyQode.transient(e)) { await MyQode.wait(1500 * (attempt + 1)); if (seq === this.seq) return this.loadScope(attempt + 1); return; }
      this.setState({ dl: false, dErr: userMessage(e) });
    }
  }

  // Returns true when it switched to a narrower scope (and started loading it).
  stepDown(scope) {
    const sc = this.state.scopes;
    this.fellBack = this.fellBack || {};
    if (this.fellBack[scope.id]) return false;
    this.fellBack[scope.id] = true;
    let next = null;
    if (scope.kind === 'family' || scope.kind === 'local-family') {
      this.setState({ scopes: { ...sc, family: null } });   // unusable for this login: stop offering it
      next = 0;
    } else if ((scope.kind === 'owner' || scope.kind === 'local-owner') && scope.accounts && scope.accounts[0]) {
      next = 'a:' + scope.accounts[0].id;
    }
    if (next == null) return false;
    this.setState({ acct: next, d: null, hist: null, hold: {}, navs: {} }, () => this.loadScope());
    return true;
  }

  // Money-weighted return (IRR) for the scope, next to the NAV-based TWRR. Optional: failures leave it blank.
  async loadIrr(scope, seq) {
    const codes = scope.kind === 'local-family' || scope.kind === 'local-owner' ? scope.members : [scope.id];
    this.setState({ irr: null });
    try { const r = await portfolio.irr(codes.map(String)); if (seq === this.seq) this.setState({ irr: r }); } catch {}
  }

  // Key metrics (CAGR, Sharpe, volatility, alpha, beta, best month…) from the server's full NAV history. Optional.
  // The app-built Entire Family view has no single server id, so it has none.
  // Views built on the device from raw history (Entire Family, Orbis accounts) only have the daily net cash figure,
  // unlabelled and with TDS and adjustments in it. Their activity lists use the server's custodian-ledger entries
  // instead (state.led, labelled and flagged `own`); totals still come from the history. Added 8 Oct 2026.
  async loadLedger(calls, seq) {
    const got = await Promise.allSettled(calls);
    if (seq !== this.seq || got.some(x => x.status === 'rejected')) return;   // keep the history list if one fails
    this.setState({ led: got.flatMap(x => (x.value && x.value.transactions) || []) });
  }

  async loadMetrics(scope, seq) {
    this.setState({ metrics: null });
    if (!scope) return;
    // views combined on the device: the server combines the same ids (a comma list) the same way
    const id = scope.kind === 'local-family' || scope.kind === 'local-owner' ? scope.members.map(String).join(',') : String(scope.id);
    try { const r = await portfolio.metrics(id); if (seq === this.seq) this.setState({ metrics: (r && r.metrics) || null }); } catch {}
  }

  async loadHoldings(scope, seq) {
    const res = await Promise.allSettled(scope.accounts.map(a => portfolio.performance(a.id)));
    if (seq !== this.seq) return;
    const hold = {};
    res.forEach((r, i) => { if (r.status === 'fulfilled') hold[scope.accounts[i].id] = r.value; });
    this.setState({ hold });
  }

  // Build the whole portfolio state locally for one of the web's views: 'nuvama' | 'orbis' | 'consolidated'.
  // The Nuvama / Orbis / Orbis + Nuvama toggle belongs to the Portfolio page: it replaces `d` / `navs` only. Home keeps
  // its own copy (homeD / homeNavs) in the default view, built when the account loads (withHome), so switching the
  // toggle never changes a figure on Home.
  //
  // A view is costly to build on a phone (the whole history is re-derived: up to a second on Hermes), so each is built
  // once per history and kept: the portfolio per view, the NAV / drawdown per view and period. A new history (another
  // account, a refresh) starts a fresh cache. After a load the other views are built in the background (warmViews),
  // one piece at a time while the app is idle, so even the first switch is instant.
  viewCache(h) { if (this.vcFor !== h) { this.vcFor = h; this.vc = new Map(); } return this.vc; }
  memoView(h, key, make) { const c = this.viewCache(h); if (!c.has(key)) c.set(key, make()); return c.get(key); }
  viewD(h, dv) {
    return this.memoView(h, 'd:' + dv, () => {
      const pl = plFrom(h, dv);
      return { id: h.accountId, kind: 'account', local: true, perf: perfFrom(h, dv), cash: cashFrom(h, dv), fys: buildFys(pl.monthly), fysQ: buildFysQ(pl.quarterly) };
    });
  }
  viewNav(h, dv, period) { return this.memoView(h, `n:${dv}:${period}`, () => ({ nav: navFrom(h, dv, period), dd: ddFrom(h, dv, period) })); }
  viewData(h, dv) {
    const period = PERIOD[normRange(this.state.range)];
    return { d: this.viewD(h, dv), navs: { [period]: this.viewNav(h, dv, period) } };
  }
  viewReady(h, dv) { const c = this.viewCache(h); return c.has('d:' + dv) && c.has(`n:${dv}:${PERIOD[normRange(this.state.range)]}`); }
  // now: build immediately. A tap on a view not built yet highlights its button first (dvPending) and builds on the
  // next tick, so the tap answers at once; of several quick taps only the last one is built.
  applyView(dv, withHome = false, now = false) {
    const h = this.state.hist;
    if (!h) return;
    if (!withHome && !now && !this.viewReady(h, dv)) {
      this.setState({ dvPending: dv }, () => setTimeout(() => { if (this.state.hist === h && this.state.dvPending === dv) this.applyView(dv, false, true); }, 16));
      return;
    }
    const home = withHome ? this.viewData(h, HOME_VIEW) : null;
    this.setState({ dv, dvPending: null, dl: false, pnlFy: 0, pnlOpen: null, ...this.viewData(h, dv), ...(home ? { homeD: home.d, homeNavs: home.navs } : {}) });
    if (withHome) this.warmViews(h);
  }
  warmViews(h) {
    const period = PERIOD[normRange(this.state.range)];
    const jobs = ['nuvama', 'orbis', 'consolidated'].flatMap(dv => [() => this.viewD(h, dv), () => this.viewNav(h, dv, period)]);
    const next = () => {
      if (this.state.hist !== h || !jobs.length) return;
      whenIdle(() => { if (this.state.hist !== h) return; jobs.shift()(); setTimeout(next, 30); });
    };
    setTimeout(next, 300);
  }

  // `shownRange` = the last range whose data is on screen; vals() keeps drawing it until the new one has loaded.
  // Days of history behind the portfolio on screen (inception → latest value date); null while unknown.
  histDays(S = this.state) {
    const p = S.d && S.d.perf;
    return p ? historyDays(p.inceptionDate, p.dataAsOf || p.asOf || null) : null;
  }
  // A period button is offered only when the account has that much history (a client onboarded last month sees
  // no 1Y / 3Y). SI is always there.
  rangeOk(id, S = this.state) { return rangeHasData(id, this.histDays(S)); }

  componentDidUpdate(_, prev) {
    // A newly loaded portfolio without enough history for the chosen period falls back to Since inception.
    if (this.state.d && this.state.d !== prev.d && !this.rangeOk(this.state.range)) this.pickRange('SI');
  }

  async pickRange(id) {
    id = normRange(id);
    const period = PERIOD[id], d = this.state.d;
    const shownRange = this.state.navs[period] ? id : (this.state.shownRange || this.state.range);
    this.setState({ range: id, shownRange });
    if (d && d.local && this.state.hist) {
      const h = this.state.hist, dv = this.state.dv;
      this.setState(s => ({ shownRange: id, navs: { ...s.navs, [period]: this.viewNav(h, dv, period) },
        ...(s.homeD ? { homeNavs: { ...s.homeNavs, [period]: this.viewNav(h, HOME_VIEW, period) } } : {}) }));
      return;
    }
    if (!d || this.state.navs[period]) return;
    try {
      const [nav0, dd0] = await Promise.all([portfolio.nav(d.id, apiPeriod(period), d.kind), portfolio.drawdown(d.id, apiPeriod(period), d.kind)]);
      const { nav, dd } = cutRange(nav0, dd0, period);
      if (this.state.d && this.state.d.id === d.id) this.setState(s => ({ navs: { ...s.navs, [period]: { nav, dd } }, shownRange: s.range === id ? id : s.shownRange }));
    } catch {}
  }

  pickScope(i) {
    this.setState({ acct: i, sheet: null, d: null, hist: null, dv: 'nuvama', hold: {}, navs: {}, pnlFy: 0, pnlOpen: null }, () => this.loadScope());
  }

  // Refresh button / return-to-foreground: refetch everything on screen.
  refresh = async () => {
    if (this.state.refreshing || this.state.phase !== 'app') return;
    this.loadInFlight();
    const seq = this.seq;   // signOut bumps seq: a reply that lands after it must not write the old user's data back
    this.setState(s => ({ refreshing: true, rk: s.rk + 1 }));
    try {
      const snap = await portfolio.snapshot();
      if (seq !== this.seq || this.state.phase !== 'app') { this.setState({ refreshing: false }); return; }
      const scopes = buildScopes(snap, this.codes());
      if (this.state.scopes && !this.state.scopes.family) scopes.family = null;   // keep an earlier step-down
      await new Promise(r => this.setState({ snap, scopes }, r));
    } catch {}
    await this.loadScope();
    this.lastLoad = Date.now();
    this.setState({ refreshing: false });
  };

  authFail(e) {
    const msg = {
      USER_NOT_FOUND: 'We couldn’t find an account with those details.',
      ACCOUNT_CLOSED: 'This account has been closed. Please contact investor relations.',
    }[e.code] || (e.status === 401 ? 'Incorrect password. Please try again.' : userMessage(e));
    this.setState({ busy: false, authErr: msg });
  }

  doLogin = async () => {
    const { email, pw, busy } = this.state;
    const id = email.trim();
    if (busy) return;
    if (!id || !pw) return this.setState({ authErr: 'Enter your email or account code and your password.' });
    this.setState({ busy: true, authErr: '', authInfo: '' });
    try {
      { const r = await auth.login(id, pw, this.state.loginAs); await this.finishLogin(r.token, r.user); }
    } catch (e) {
      if (e.code === 'PASSWORD_SETUP_REQUIRED') return this.beginSetup(id);
      if (e.code === 'ROLE_MISMATCH' && e.data && e.data.role) { this.setState({ loginAs: e.data.role, busy: false, authErr: userMessage(e) }); return; }
      this.authFail(e);
    }
  };

  async finishLogin(token, user) {
    await setToken(token);
    this.setState({ user: user || null });
    this.offerBiometric();
    // The app admin (isAdmin on the login or on auth/me) opens the backoffice console, not the investor app.
    let isAdmin = !!(user && user.isAdmin);
    if (!isAdmin && user && user.isSuperAdmin) { try { const me = await auth.me(); isAdmin = !!(me && me.isAdmin); if (isAdmin) user = { ...user, ...me }; } catch {} }
    if (isAdmin) {
      this.adminUser = user;
      trackStart('a:' + user.email, 'admin');
      this.setState({ user, busy: false, pw: '', np: '', np2: '', otp: ['', '', '', '', '', ''], authErr: '', phase: 'admin', adm: null }, () => { this.pushSync(); this.applyPendingTap(); });
      return;
    }
    if (user && user.isDistributor) {
      trackStart('d:' + user.email, 'distributor');
      this.setState({ busy: false, pw: '', np: '', np2: '', otp: ['', '', '', '', '', ''], authErr: '', phase: 'partner' });
      return;
    }
    trackStart(user && user.clientCode);
    await new Promise(r => this.setState({}, r));   // user (accountCodes) must be in state before scopes are built
    try { await this.openPortfolio(); } catch (e) { await clearToken(); throw e; }
    this.setState({ busy: false, pw: '', np: '', np2: '', otp: ['', '', '', '', '', ''], authErr: '' });
    this.startApp();
  }

  // After a password sign-in: one-time offer to unlock with Face ID / fingerprint from now on.
  async offerBiometric() {
    try {
      if (await biometricEnabled()) { this.setState({ bioOn: true, bio: await biometricAvailable() }); return; }
      const bio = await biometricAvailable();
      this.setState({ bio });
      if (!bio || (await storeGet('myqode.biometricAsked'))) return;
      await storeSet('myqode.biometricAsked', '1');
      Alert.alert('Unlock with ' + bio.label + '?', 'Open myQode with ' + bio.label + ' instead of typing your password each time. You can change this under Settings.', [
        { text: 'Not now', style: 'cancel' },
        { text: 'Turn on', onPress: () => this.setBiometric(true) },
      ]);
    } catch {}
  }
  setBiometric = async on => {
    if (on) { const r = await biometricUnlock((this.state.bio || {}).label); if (!r.ok) { if (r.message) this.toast(r.message); return; } }
    await setBiometricEnabled(on);
    track('event', on ? 'biometric_enabled' : 'biometric_disabled', {});
    this.setState({ bioOn: on });
  };
  shouldRelock() {
    const S = this.state, away = this.bgAt ? Date.now() - this.bgAt : 0;
    return Platform.OS !== 'web' && S.bioOn && (S.phase === 'app' || S.phase === 'partner') && !S.lockResume && away > RELOCK_MS;
  }
  // Locks a signed-in app that came back from the background: the lock screen replaces the content at once, then the
  // system prompt opens. Unlocking returns to the same place (lockResume) with nothing reloaded.
  relock = async () => {
    this.bgAt = 0;
    this.setState({ phase: 'lock', lockResume: this.state.phase, lockErr: '', lockGone: false, lockOffline: false, lockBusy: false });
    const bio = await biometricAvailable();
    if (!bio) {
      // Fingerprints / face removed from the phone while away: never reopen unlocked — the password is the way in.
      this.setState({ lockGone: true, lockErr: 'Fingerprint / face unlock is no longer set up on this phone. Sign in with your password to continue.' });
      return;
    }
    this.setState({ bio });
    this.lockRetry();
  };
  lockRetry = async () => {
    if (this.state.lockBusy) return;
    if (this.state.lockOffline) { this.setState({ lockOffline: false, phase: 'splash' }); this.boot(true); return; }   // already unlocked: just try the server again
    this.setState({ lockBusy: true, lockErr: '' });
    const r = await biometricUnlock((this.state.bio || {}).label);
    if (!r.ok) { this.setState({ lockBusy: false, lockErr: r.message }); return; }
    if (this.state.lockResume) {
      const back = this.state.lockResume;
      this.setState({ lockBusy: false, lockResume: null, phase: back });
      if (back === 'app' && !this.state.page && Date.now() - (this.lastLoad || 0) > 60000) this.refresh();
      if (back === 'app') { this.loadNotifs(); this.pushSync(); }
      return;
    }
    this.setState({ lockBusy: false, phase: 'splash' });
    this.boot(true);
  };
  lockUsePassword = async () => { await setBiometricEnabled(false); this.setState({ bioOn: false, lockResume: null }); this.signOut(); };

  async beginSetup(id) {
    try {
      const email = id.includes('@') ? id : (await auth.checkIdentifier(id)).email;
      if (!email) throw new ApiError('There is no email on file for this account. Please contact investor relations.');
      await auth.sendSetupOtp(email);
      this.setState({ busy: false, phase: 'otp', setupEmail: email, otp: ['', '', '', '', '', ''], otpLocked: false, authErr: '', authInfo: '' });
    } catch (e) { this.authFail(e); }
  }

  verifyOtp = async () => {
    const { setupEmail, otp, busy } = this.state, code = otp.join('');
    if (busy) return;
    if (code.length < 6) return this.setState({ authErr: 'Enter the 6-digit code from your email.' });
    this.setState({ busy: true, authErr: '' });
    try {
      await auth.verifySetupOtp(setupEmail, code);
      this.setState({ busy: false, phase: 'setpw', authInfo: '' });
    } catch (e) {
      // Five wrong codes, or an expired one: this code is finished, so the screen offers a new code instead of Verify.
      this.setState({ otp: ['', '', '', '', '', ''], otpLocked: OTP_DEAD.includes(e.code) });
      this.authFail(e);
      if (!OTP_DEAD.includes(e.code) && this.otpRefs[0].current) this.otpRefs[0].current.focus();
    }
  };

  resendOtp = async () => {
    if (this.state.busy) return;
    this.setState({ busy: true });
    try {
      await auth.sendSetupOtp(this.state.setupEmail);
      this.setState({ busy: false, otp: ['', '', '', '', '', ''], otpLocked: false, authErr: '', authInfo: 'A new code is on its way.' });
      if (this.otpRefs[0].current) this.otpRefs[0].current.focus();
    } catch (e) { this.authFail(e); }
  };

  savePassword = async () => {
    const { setupEmail, otp, np, np2, busy } = this.state;
    if (busy) return;
    const bad = this.pwProblem(np, np2);
    if (bad) return this.setState({ authErr: bad });
    this.setState({ busy: true, authErr: '' });
    try {
      await auth.completeOtpSetup(setupEmail, otp.join(''), np, np2);
      { const r = await auth.login(setupEmail, np); await this.finishLogin(r.token, r.user); }
    } catch (e) {
      if (OTP_DEAD.includes(e.code)) this.setState({ phase: 'otp', otp: ['', '', '', '', '', ''], otpLocked: true });
      this.authFail(e);
    }
  };

  pwProblem(a, b) {
    if (a.length < 8) return 'Use at least 8 characters.';
    if (!/[a-z]/.test(a) || !/[A-Z]/.test(a) || !/[0-9]/.test(a) || !/[^A-Za-z0-9]/.test(a))
      return 'Include upper and lower case letters, a number and a symbol.';
    if (a === 'Qode@123') return 'Please choose a different password.';
    if (a !== b) return 'The two passwords don’t match.';
    return '';
  }

  doForgot = async () => {
    if (this.state.busy) return;   // a second tap would issue a second link and cancel the first
    const id = this.state.email.trim();
    if (!id.includes('@')) return this.setState({ authErr: 'Enter your registered email above, then tap Forgot password.', authInfo: '' });
    this.setState({ busy: true, authErr: '', authInfo: '' });
    try {
      await auth.forgot(id);
      this.setState({ busy: false, authInfo: 'If that email is registered, we’ve sent a link to set a new password.' });
    } catch (e) { this.authFail(e); }
  };

  // Dev bypass: POST /auth/login without a password (server must run NODE_ENV=development).
  bypassLogin = async (id) => {
    const username = (id || this.state.email).trim();
    if (this.state.busy) return;
    if (!username) return this.setState({ authErr: 'Enter an email or account code.' });
    this.setState({ busy: true, authErr: '', authInfo: '' });
    try {
      const r = await auth.loginBypass(username);
      await this.finishLogin(r.token, r.user);
    } catch (e) {
      // a non-development server demands the password: 400 "Fields required…" (or 401 on older builds)
      if (e.status === 400 || (e.status === 401 && /credentials/i.test((e.data && e.data.error) || ''))) e.message = 'The server refused a passwordless login. It must run with NODE_ENV=development (npm run dev in myQode/).';
      this.authFail(e);
    }
  };

  toggleDev = async () => {
    const open = !this.state.devOpen;
    this.setState({ devOpen: open });
    if (open && !(this.state.devClients && this.state.devClients.length)) this.loadDevClients();
  };
  loadDevClients = async () => {
    this.setState({ devClients: null, devErr: '' });
    try { const r = await auth.devClients(); this.setState({ devClients: r.clients || [], devErr: (r.clients || []).length ? '' : 'The server returned no Discretionary investors.' }); }
    catch (e) { this.setState({ devClients: [], devErr: (e.status === 404 ? 'Investor list is only available when the server runs in development.' : userMessage(e)) + ' (' + BASE_URL + ')' }); }
  };

  startDemo = async () => {
    if (this.state.busy) return;
    this.setState({ busy: true, authErr: '', authInfo: '' });
    setDemo(true);
    this.setState({ user: { name: 'Rohan Mehta', email: 'rohan.mehta@example.com', clientCode: 'QAW0412' } });
    try { await this.loadSnapshot(); this.setState({ busy: false }); this.startApp(); }
    catch (e) { setDemo(false); this.authFail(e); }
  };

  signOut = async (msg = '') => {
    if (!this.origToken && !isDemo() && !(this.state.user && this.state.user.isImpersonated)) {
      track('event', 'logout', { reason: msg ? 'expired' : 'user' }); trackFlush();
      await auth.logout();   // the server's sign-in log (never throws)
    }
    if (!this.origToken && !isDemo()) await push.unregister();   // before the session goes: this phone stops getting their popups
    this.origToken = null; this.adminUser = null;
    storeDel(ADMIN_KEY);
    setViewToken(null); this.partnerUser = null; this.partnerNav = null;
    trackStop();
    setDemo(false);
    clearUserCaches();
    storeDel(UCC_SEEN_KEY);   // next sign-in sees the UCC pop-up once again
    this.obReturn = null;
    this.seq++;
    await clearToken();
    this.counted = false;
    cleanAddress();
    this.setState({
      phase: 'login', tab: 'home', sheet: null, page: null, user: null, acct: 0, hist: null, dv: 'nuvama', snap: null, scopes: null, d: null, hold: {}, navs: {},
      dErr: '', dl: false, pw: '', busy: false, otp: ['', '', '', '', '', ''], authErr: msg, authInfo: '', uccSeen: false, payRecover: null, viewing: null,
      imp: null, adm: null, notes: null, inFlight: [], pushOffer: false,
    });
  };
  expire() {
    if (this.state.phase === 'partner' && this.origToken && !this.state.viewing) return this.backToAdmin('The session for that user has ended.');
    if (this.state.phase === 'partner') return this.signOut('Your session has expired. Please sign in again.');
    if (this.state.phase !== 'app') return;
    if (this.state.viewing) this.exitView('Your view of that account has timed out. Open it again from your investors.');
    else if (this.origToken) this.exitImpersonation();
    else this.signOut('Your session has expired. Please sign in again.');
  }

  // Super admin: swap in a 4h client-scoped token; keep the admin token to come back.
  impersonate = async clientCode => {
    const r = await admin.impersonate(clientCode);
    trackStop();   // an admin viewing a client is not the client's usage
    cleanAddress();
    if (!this.origToken) this.origToken = await getToken();
    await setToken(r.token);
    clearUserCaches();
    services.warmSwitchInfo();
    this.seq++;
    await new Promise(res => this.setState({ user: r.user, page: null, tab: 'home', inFlight: [], notes: null }, res));
    await this.openPortfolio();
  };
  exitImpersonation = async () => {
    if (this.state.imp && !this.state.imp.backoffice) return this.backToAdmin();
    if (this.state.imp && this.state.imp.backoffice) return this.closeBackoffice();
    const t = this.origToken; this.origToken = null;
    if (!t) return this.signOut();
    await setToken(t);
    this.seq++;
    try { const me = await auth.me(); await new Promise(res => this.setState({ user: me, page: null, tab: 'home', inFlight: [], notes: null }, res)); await this.openPortfolio(); }
    catch { this.signOut('Your admin session has expired. Please sign in again.'); }
  };

  // ── Admin mode ────────────────────────────────────────────────────────────────────────────────────────────
  // A 401 / 403 from a backoffice route: the admin session is gone (or never had access). Back to sign-in.
  adminDenied = e => {
    if (this.state.phase !== 'admin') return;
    this.signOut(e && e.status === 403 ? 'This account does not have admin access. Sign in with an admin account.' : 'Your admin session has expired. Please sign in again.');
  };

  // "Open as user": a 4-hour token for that user, issued by the backoffice. The admin token stays in this.origToken
  // (and on the device, see ADMIN_KEY); the user is loaded exactly like a normal sign-in.
  openAsUser = async ({ email, name } = {}) => {
    if (!email) return;
    const r = await backoffice.impersonate({ email, target: 'app' });
    if (!r || !r.token) throw new ApiError('The server did not return a session for this user.');
    trackStop();   // an admin viewing a user is not that user's usage
    const adminToken = this.origToken || await getToken();
    this.origToken = adminToken;
    await storeSet(ADMIN_KEY, adminToken);
    await setToken(r.token);
    setViewToken(null); this.partnerUser = null; this.partnerNav = null;
    clearUserCaches();
    this.seq++;
    const user = { ...(r.user || {}), isImpersonated: true };
    const imp = { name: user.name || name || email, email, backoffice: false };
    cleanAddress();
    const reset = { user, imp, page: null, sheet: null, tab: 'home', acct: 0, hist: null, dv: 'nuvama', snap: null, scopes: null, d: null, hold: {}, navs: {}, dErr: '', viewing: null, uccSeen: true, inFlight: [], notes: null };
    if (user.isDistributor) { this.setState({ ...reset, phase: 'partner' }); return; }
    await new Promise(res => this.setState(reset, res));
    await this.openPortfolio();
    this.startApp();
  };

  // "Back to admin": drop the user's session and restore the admin token and console (where the admin left it).
  backToAdmin = async (msg = '') => {
    const t = this.origToken || await storeGet(ADMIN_KEY);
    this.origToken = null;
    storeDel(ADMIN_KEY);
    if (!t) return this.signOut('Please sign in again.');
    setViewToken(null); this.partnerUser = null; this.partnerNav = null;
    clearUserCaches();
    this.seq++;
    await setToken(t);
    { const au = this.adminUser || this.state.user; if (au && au.email) trackStart('a:' + au.email, 'admin'); }   // tracking resumes as the admin
    cleanAddress();
    this.seq++;
    this.setState({ phase: 'admin', user: this.adminUser || this.state.user, imp: null, viewing: null, page: null, sheet: null, tab: 'home', inFlight: [], notes: null,
      acct: 0, hist: null, dv: 'nuvama', snap: null, scopes: null, d: null, hold: {}, navs: {}, dErr: '', lifting: false },
      () => this.pushSync());   // once the admin's own session is in state: register this phone for the admin's test sends
    if (msg) this.toast(msg);
    try {
      const me = await auth.me();
      if (!me || !me.isAdmin) return this.signOut('This account does not have admin access. Sign in with an admin account.');
      this.adminUser = me;
      if (this.state.phase === 'admin') this.setState({ user: me });
    } catch (e) {
      if (e.status === 401 || e.status === 403) this.signOut('Your admin session has expired. Please sign in again.');
    }
  };

  // Web: a session opened from the web backoffice (/admin). "Close" ends it and returns to that user in /admin.
  closeBackoffice = async () => {
    const email = (this.state.imp && this.state.imp.email) || (this.state.user && this.state.user.email) || '';
    await clearToken();
    storeDel(ADMIN_KEY);
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const to = email ? '/admin/users/' + encodeURIComponent(email) : '/admin';
      try { window.close(); } catch {}
      setTimeout(() => { if (!window.closed) window.location.assign(to); }, 150);
      return;
    }
    this.signOut();
  };

  // Partner "View account" (web: distributors/investors → View account): the investor's own app, read-only, on a
  // 2-hour token held in memory only. The partner's token stays saved, so back / exit / an app restart all return
  // to the partner panel, to the screen the partner left (partnerNav).
  viewInvestor = async (clientCode, nav = null) => {
    const r = await distributor.viewAccount(clientCode);
    this.partnerUser = this.state.user;
    this.partnerNav = nav;
    setViewToken(r.token);
    clearUserCaches();
    this.seq++;
    try {
      await new Promise(res => this.setState({ user: r.user, viewing: r.user.name || 'Investor', page: null, sheet: null, tab: 'home',
        acct: 0, hist: null, dv: 'nuvama', snap: null, scopes: null, d: null, hold: {}, navs: {}, dErr: '' }, res));
      await this.openPortfolio();
    } catch (e) {
      // Never leave the partner panel holding the investor's read-only token.
      this.exitView();
      throw e;
    }
    this.startApp();
  };
  exitView = (msg = '') => {
    if (!this.partnerUser) return;   // already back on the partner panel (several 401s can land together)
    setViewToken(null);
    clearUserCaches();
    this.seq++;
    const user = this.partnerUser; this.partnerUser = null;
    this.setState({ user, viewing: null, phase: 'partner', page: null, sheet: null, tab: 'home', acct: 0, hist: null, dv: 'nuvama', snap: null, scopes: null, d: null, hold: {}, navs: {}, dErr: '' });
    if (msg) this.toast(msg);
  };

  // Money formatting lives in src/adapt.js (inr / sinr) so every screen shows the same figures.
  fmt(v) { return inr(v); }
  fmt0(v) { return inr(v); }   // two decimals, like every figure
  sfmt(v) { return sinr(v); }

  // ── Notifications (server: myQode lib/appNotify.ts; device: src/push.js) ─────────────────────────────────────
  // The login's own session only: never while admin views a client, a distributor views an investor, or in demo.
  ownSession() { return !isDemo() && !this.origToken && !this.state.viewing && !(this.state.user && this.state.user.isImpersonated); }
  // The iPhone's own permission prompt appears by itself the first time the app is in use (any mode: permission
  // belongs to the phone, not to a login). The phone is registered for popups only in the login's own session.
  pushSync = async () => {
    if (Platform.OS === 'web' || isDemo() || this.pushBusy) return;
    this.pushBusy = true;
    try {
      await push.reportStart(this.state.phase + (this.ownSession() ? '' : ' (viewing)'));
      if (await push.shouldAskNow()) { await new Promise(r => setTimeout(r, 1200)); const p = await push.ask(); track('event', 'notification_permission', { result: p, via: 'prompt' }); }
      if (this.ownSession()) await push.register();
      if ((this.state.phase === 'app' || this.state.phase === 'admin') && !this.state.pushOffer) { const k = await push.shouldOffer(); if (k) this.setState({ pushOffer: k }); }
    } finally { this.pushBusy = false; }
  };
  // Payments received but not in the portfolio yet (Home's "On its way" card).
  loadInFlight = async () => {
    if (this.state.viewing || this.state.phase === 'admin' || this.state.phase === 'partner') return;   // called as the app opens, before phase flips to 'app'
    const seq = this.seq;   // a switch of user while this is in flight makes the answer someone else's: drop it
    try { const r = await payments.inFlight(); if (seq === this.seq) this.setState({ inFlight: (r && r.items) || [] }); } catch {}
  };
  loadNotifs = async () => {
    if (this.state.phase !== 'app' || this.notesBusy) return;
    this.notesBusy = true;
    const cur = this.state.notes;
    this.setState({ notes: { ...(cur || { items: [], unread: 0 }), loading: true, err: '' } });
    try {
      const seq = this.seq;
      const r = await notifications.list();
      if (seq !== this.seq) return;   // the user changed while this was loading
      this.setState({ notes: { items: r.items || [], unread: r.unread || 0, hasMore: !!r.hasMore, loading: false, err: '' } });
      if (this.ownSession()) push.setBadge(r.unread || 0);
    } catch (e) {
      this.setState({ notes: { ...(cur || { items: [], unread: 0 }), loading: false, err: userMessage(e, 'We couldn’t load your notifications.') } });
    } finally { this.notesBusy = false; }
  };
  markNotes = (ids, all) => {
    const n = this.state.notes;
    if (!n || !this.ownSession()) return;
    const items = n.items.map(x => (all || ids.includes(x.id) ? { ...x, read: true } : x));
    const unread = items.filter(x => !x.read).length;
    this.setState({ notes: { ...n, items, unread } });
    push.setBadge(unread);
    notifications.read(all ? { all: true } : { ids }).then(r => { if (r && typeof r.unread === 'number') push.setBadge(r.unread); }).catch(() => {});
  };
  // A tap on a notification (popup or inbox). A web link opens straight away in any mode. In admin mode it opens
  // the admin Notifications tab (there is no investor screen to go to); while admin views a client it goes to the
  // screen in that client's view, read-only (their notification is not marked read). A tap that launched the app
  // waits in pendingTap until the app or the admin console is ready.
  onNoteTap = (link, id) => {
    { const l = String(link || ''); const n = ((this.state.notes && this.state.notes.items) || []).find(x => x.id === id); track('event', 'notification_open', { category: n ? n.category : undefined, link: l.startsWith('url:') ? 'url' : l.split(':')[0] || 'home' }); }
    if (/^url:https:\/\//i.test(String(link || ''))) { if (this.ownSession() && id) this.markNotes([id]); openLink(this.vals(), link); return; }
    const { phase } = this.state;
    if (phase === 'admin') { this.setState(s => ({ sheet: null, adm: { ...(s.adm || {}), tab: 'notifications', email: null } })); return; }
    if (phase !== 'app') { this.pendingTap = { link, id }; return; }   // before sign-in finished
    if (id && this.ownSession()) this.markNotes([id]);
    this.setState({ sheet: null });
    openLink(this.vals(), link);
    this.loadNotifs();
  };
  applyPendingTap = () => { if (this.pendingTap) { const t = this.pendingTap; this.pendingTap = null; setTimeout(() => this.onNoteTap(t.link, t.id), 600); } };

  startApp = () => {
    const first = !this.counted; this.counted = true;
    const ready = !!this.state.d;
    this.setState({ phase: 'app', tab: 'home', lifting: true, loading: !ready, cu: first ? 0 : 1 });
    if (!ready) setTimeout(() => this.setState({ loading: false }), 950);
    services.bankDetails().catch(() => {});
    services.warmSwitchInfo();
    const sc = this.curScope(); if (sc && sc.accounts[0]) documents.warm(sc.accounts[0].id);   // Documents tab: category counts
    this.loadNotifs(); this.pushSync(); this.loadInFlight();
    this.applyPendingTap();
    if (!first || this.state.viewing) return;
    this.resumePayment();
    const t0 = Date.now(), D = 400;
    const step = () => {
      const p = Math.min((Date.now() - t0) / D, 1), e = 1 - Math.pow(1 - p, 3);
      this.setState({ cu: e });
      if (p < 1) this.raf = requestAnimationFrame(step);
    };
    this.raf = requestAnimationFrame(step);
  };

  // A payment that was in progress when the app last closed (Expo Go reloads the project on an exp:// link,
  // Android can kill the app behind the browser): reopen the sheet and let it verify the order.
  resumePayment = async (url = null) => {
    const p = await readPendingPayment();
    if (!p || this.unmounted) return;
    const initial = url || (await Linking.getInitialURL().catch(() => null)) || '';
    const hint = /payment-return/.test(initial) ? hintFromReturnUrl(initial) : '';
    // Back to where the client started: same tab and same account scope (a reload lands on Home / the
    // default scope otherwise), then the Add Funds sheet with the result on top of it.
    const sc = this.state.scopes;
    const scopeOk = p.scope != null && sc && (p.scope === -1 ? !!sc.family : typeof p.scope === 'string' ? sc.owners.some(o => o.accounts.some(a => 'a:' + a.id === p.scope)) : !!sc.owners[p.scope]);
    if (scopeOk && p.scope !== this.state.acct) this.pickScope(p.scope);
    if (p.tab && p.tab !== this.state.tab) { this.setState({ tab: p.tab }); screen(p.tab); }
    // kind decides which Add Funds tab opens in recovery mode: 'sip' → SetupSip, otherwise PayOnline
    this.setState({ sheet: 'r-add', payRecover: p.subscriptionId
      ? { kind: 'sip', sub: { subscriptionId: p.subscriptionId, accountId: p.accountId }, hint }
      : { kind: 'order', order: { orderId: p.orderId }, hint } });
  };
  onDeepLink = url => {
    if (this.handleResumeUrl(url)) return;
    if (!/payment-return/.test(url || '') || this.state.phase !== 'app' || this.state.sheet === 'r-add') return;
    this.resumePayment(url);
  };

  // Onboarding resume links: https://onboarding.qodeinvest.com/onboard/{token} and myqode://onboard/{token}.
  // Returns true when the url was an onboarding link (consumed here).
  handleResumeUrl(url) {
    let parsed;
    if (!url) return false;
    try { parsed = Linking.parse(url); } catch (e) { return false; }
    const host = (parsed.hostname || '').toLowerCase();
    const path = (parsed.path || '').replace(/^\/+|\/+$/g, '');
    const q = parsed.queryParams || {};
    // myqode://onboard/{token} parses as hostname "onboard", path "{token}".
    let token = null;
    if (host === 'onboard' && path) token = path.split('/')[0];
    else if (/^onboard\//.test(path)) token = path.split('/')[1];
    if (q.d) this.setState({ distributor: String(q.d) });
    if (token && (host === 'onboard' || RESUME_HOSTS.includes(host) || !host)) { this.resumeFrom(token, 'link'); return true; }
    return false;
  }

  leaveOb() { const p = this.obReturn || 'login'; this.obReturn = null; return p; }
  async resumeFrom(token, source) {
    clearTimeout(this.splashT);
    // A signed-in client or partner who opens a resume link goes back to where they were afterwards, not to sign-in.
    if (this.state.phase === 'app' || this.state.phase === 'partner') this.obReturn = this.state.phase;
    this.setState({ phase: 'resume', resume: { token, source, loading: true, error: null } });
    try {
      const sub = await this.store.hydrate(token);
      const server = sub.data || {};
      let ob = fromBackendData(server, this.obDefault());
      ob = accountTypeToOb(sub.accountType, ob);
      ob.step = resumeStepFor(server, sub.currentStep, sub.status);
      ob.qi = 0;
      this.store.setBaseline(toBackendData(ob, server));
      this.setState({ phase: 'ob', ob, resume: null });
    } catch (e) {
      this.setState({ resume: { token, source, loading: false, error: userMessage(e), code: e.code } });
    }
  }

  // ---- document pickers (all in-app system sheets) -------------------------
  async pickFile(kind) {
    const S = this.store;
    try {
      if (kind === 'file') {
        const r = await DocumentPicker.getDocumentAsync({ type: UPLOAD.allowedMime, copyToCacheDirectory: true, multiple: false });
        if (r.canceled || !r.assets || !r.assets[0]) return null;
        const a = r.assets[0];
        return { uri: a.uri, name: a.name || 'document', mimeType: a.mimeType || guessMime(a.name), size: a.size };
      }
      if (kind === 'camera') {
        const p = await ImagePicker.requestCameraPermissionsAsync();
        if (!p.granted) { S.notice('warn', 'Camera access is off. Allow it in Settings, or choose a photo from your library.'); return null; }
        const r = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.8 });
        if (r.canceled || !r.assets || !r.assets[0]) return null;
        const a = r.assets[0];
        return { uri: a.uri, name: a.fileName || `photo_${Date.now()}.jpg`, mimeType: a.mimeType || 'image/jpeg', size: a.fileSize };
      }
      const p = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!p.granted) { S.notice('warn', 'Photo access is off. Allow it in Settings, or take a photo with the camera.'); return null; }
      const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
      if (r.canceled || !r.assets || !r.assets[0]) return null;
      const a = r.assets[0];
      return { uri: a.uri, name: a.fileName || `photo_${Date.now()}.jpg`, mimeType: a.mimeType || 'image/jpeg', size: a.fileSize };
    } catch (e) {
      S.notice('err', 'We couldn’t open that picker. Please try another option.');
      return null;
    }
  }
  async pickAndUpload(fieldKey, kind) {
    const file = await this.pickFile(kind);
    if (!file) return;
    await this.store.upload(fieldKey, file);
  }

  otpBoxSet(otp, refs, i, t, done) {
    const d = t.replace(/\D/g, '').slice(-1);
    const next = otp.slice(); next[i] = d;
    if (d && i < 5 && refs[i + 1].current) refs[i + 1].current.focus();
    if (d && i === 5 && next.every(x => x)) setTimeout(done, 250);
    return next;
  }

  vals() {
    const st = this.state, set = p => this.setState(p);
    const homeCopy = st.tab === 'home' && st.homeD && st.d && st.homeD.id === st.d.id;
    const S = homeCopy ? { ...st, d: st.homeD, navs: st.homeNavs, dv: HOME_VIEW } : st;
    const scope = this.curScope();
    const perf = S.d && S.d.perf;
    const hasData = !!perf;
    const busy = S.loading || S.dl || S.sl;   // sl: snapshot / scopes still loading (see openPortfolio)
    const green = C.pos, red = C.red;
    const c = v => (v < 0 ? red : v > 0 ? green : C.muted);   // same rule as the web table: green / red / neutral
    const ddColor = v => (v != null && Math.abs(v) >= 0.005 ? red : C.muted);   // drawdown: red below the peak, neutral at a new high
    const asOf = perf && perf.dataAsOf ? fmtDate(perf.dataAsOf) : '';
    const benchName = titleCase(perf && perf.strategy && perf.strategy.benchmark) || 'Nifty 50';
    // A closed account (fully withdrawn): nothing is held and nothing stays invested, so its current value and invested
    // amount show ₹0 (a closing often leaves a few rupees behind in the custodian's value).
    const closed = !!(scope && scope.kind === 'account' && scope.closed === true);
    const value = closed ? 0 : perf ? perf.currentValue : scope ? scope.value : 0;
    const totalReturns = perf ? perf.totalReturns : 0;

    // NAV chart (the API series is rebased to 100; plotted below in real NAV terms)
    // While a newly picked range is still loading, keep drawing the last range that has data — the charts never
    // blank out for the round trip. Everything range-dependent below uses `shownRange`, not `S.range`.
    const entryFor = r => S.navs[PERIOD[r]];
    const shownRange = entryFor(S.range) ? S.range : entryFor(S.shownRange) ? S.shownRange
      : (Object.keys(PERIOD).find(r => entryFor(r)) || S.range);
    const rangeLoading = shownRange !== S.range;
    const navEntry = entryFor(shownRange) || {};
    // The NAV chart plots real days only: the web's synthetic NAV=10 anchor (one day before inception, added when
    // the first NAV isn't 10 — e.g. Orbis series start at 100) would put a jump at the left edge and, with both
    // lines rebased to 10 from it, squash the benchmark flat under a 100-scale series. Returns and drawdown keep it.
    const { pts, bench, dates, navs, bvals, rawByDate, ddPts, ddBench, ddDates, p1, p2, p3, hasRaw, rawLine, cPts, cBench, axis, navNow } = chartGeom(navEntry);
    // Short windows (a few trading days, weekends skipped) label days, longer ones months.
    const shortSpan = dates.length > 1 && new Date(dates[dates.length - 1]) - new Date(dates[0]) < 62 * 864e5;
    const xFmt = shortSpan ? fmtDayMon : fmtMonth;
    const xDates = dates.length > 1 ? [...new Set([dates[0], dates[Math.floor((dates.length - 1) / 2)], dates[dates.length - 1]].map(xFmt))] : [];
    // Growth anchor for the full-history chart = the web's: NAV 10 (the PMS starting point) when the first
    // NAV isn't exactly 10, else the first NAV. Shorter ranges are anchored at the window start.
    const isAll = shownRange === 'SI';
    const rawFirst = hasRaw ? navs[0] : null;
    const growthBase = isAll && rawFirst != null && rawFirst !== 10 ? 10 : null;   // null → relative to the first point
    const growthAt = i => (growthBase != null ? (navs[i] / growthBase - 1) * 100 : (pts[i] / pts[0] - 1) * 100);

    // Recent activity from cashflow
    const dateFmt = fmtDate;
    // The server sends the custodian's money-movement entries (myQode lib/ledgerFlows: corpus deposits / withdrawals,
    // securities in / out, full switches; no TDS, fees or partial switches). Recent Activity shows only what the
    // investor did himself (`own`: first investment, top-ups, corpus deposits and withdrawals), decided 8 Oct 2026;
    // a server without the flag shows everything.
    const minorFlow = t => t.own === false;
    const cashTx = ((S.d && S.d.local && S.dv === 'nuvama' && S.led) || (S.d && S.d.cash && S.d.cash.transactions) || []).slice()   // led: loadLedger
      .sort((a, b) => new Date(b.date) - new Date(a.date));
    const tx = t => {
      const out = t.type === 'outflow', amt = Math.abs(num(t.amount) || 0);
      return {
        // label / detail: the custodian's entry type and the strategy (myQode lib/ledgerFlows)
        title: t.label || (out ? 'Withdrawal' : 'Invested'), sub: dateFmt(t.date) + (t.detail ? ' · ' + t.detail : ''),
        amt: this.sfmt(out ? -amt : amt), color: out ? red : green, status: 'COMPLETED', stColor: C.green,
      };
    };

    // Profit & Loss — calendar years like the web table; year totals come from the API
    const fys = (S.d && S.d.fys) || [];
    const allIdx = Math.min(fys.length, 3);
    const pnlIsYear = S.pnlFy < allIdx, pnlIsAll = S.pnlFy === allIdx && fys.length > 0;
    const fy = fys[Math.min(S.pnlFy, Math.max(allIdx - 1, 0))] || { label: '', m: [] };
    const spct = p => pct(p);
    // Rupees for the P&L table and bars: the full amount, signed, two decimals (+₹21,55,123.40, −₹2,27,410.00).
    const rs = v => {
      if (v == null || !isFinite(v)) return '–';
      const a = Math.abs(v), sg = v > 0 ? '+' : v < 0 ? '−' : '';
      return sg + '₹' + a.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };
    const fySum = f => (f.tv != null ? f.tv : f.m.reduce((s, x) => s + x[1], 0));
    const fyQ = ((S.d && S.d.fysQ) || []).find(f => f.label === fy.label);
    const qtr = (fyQ ? fyQ.q : []).map(a => ({ m: QUARTER_LABELS[a[4]][0] + ' ' + fy.label, note: QUARTER_LABELS[a[4]][1], v: a[1], p: a[2] }));

    // Holdings = strategy accounts inside the selected scope
    const accts = scope ? scope.accounts : [];
    const holdTotal = accts.reduce((s, a) => s + (num(a.portfolioValue) || 0), 0) || 1;
    // Charts take the strategy's colour when the view holds one strategy; mixed views keep the brand green.
    const stratColors = [...new Set(accts.map(a => a.strategyColor).filter(Boolean))];
    const chartColor = stratColors.length === 1 ? stratColors[0] : C.green;
    // Which family member holds an account: the web Portfolio page groups its account picker by member.
    const ownerOf = id => { const o = ((S.scopes && S.scopes.owners) || []).find(x => (x.accounts || []).some(y => String(y.id) === String(id))); return o ? o.name : ''; };
    const holdRows = accts.map(a => {
      const hp = S.hold[a.id], v = a.isClosed ? 0 : num(a.portfolioValue) || 0;   // closed: ₹0
      return {
        id: a.id, name: a.strategyName, tag: a.type || a.id, owner: ownerOf(a.id), alloc: (holdTotal ? v / holdTotal * 100 : 0).toFixed(2), w: v / holdTotal * 100, color: a.strategyColor || C.gray,
        value: this.fmt(v),
        gain: hp ? pct(hp.returnsPercent) + ' SI' : '',
        ret: hp ? pct(hp.returnsPercent) : '', retColor: c(hp ? hp.returnsPercent : 0), mdd: hp ? ddPct(hp.trailingReturns.portfolio.maxDD) : '', hasM: !!hp,
        raw: v, retNum: hp ? num(hp.returnsPercent) : null, tr: hp && hp.trailingReturns ? hp.trailingReturns.portfolio : null,   // web dashboard: totals and per-account returns
      };
    });

    const P = (perf && perf.trailingReturns && perf.trailingReturns.portfolio) || {};
    const B = (perf && perf.trailingReturns && perf.trailingReturns.benchmark) || {};
    const flows = flowTotals(S.d && S.d.cash);
    const owners = S.scopes ? S.scopes.owners : [];
    const family = S.scopes ? S.scopes.family : null;

    const saved = this.store ? this.store.s.saved : null;
    const savedProg = this.store ? this.store.s.progress : null;
    return {
      isSplash: S.phase === 'splash', isLogin: S.phase === 'login', isOtp: S.phase === 'otp', isSetPw: S.phase === 'setpw', isApp: S.phase === 'app',
      isCarousel: S.phase === 'carousel', isResume: S.phase === 'resume', isPartner: S.phase === 'partner', isLock: S.phase === 'lock',
      loginAs: S.loginAs, setLoginAs: r => set({ loginAs: r, authErr: '', authInfo: '' }),
      bio: S.bio, bioOn: S.bioOn, bioToggle: () => this.setBiometric(!S.bioOn),
      lockRetry: this.lockRetry, lockOffline: !!S.lockOffline, lockUsePassword: this.lockUsePassword, lockErr: S.lockErr, lockBusy: S.lockBusy, lockGone: S.lockGone, lockLabel: (S.bio && S.bio.label) || 'fingerprint',
      // Expo Go on iPhone can't use Face ID (the prompt falls back to the passcode); a real build can.
      bioNote: S.bio && S.bio.iosFace && inExpoGo ? 'In Expo Go, iPhone asks for your passcode instead of Face ID. Face ID works in the installed app.' : '',
      carIdx: S.car,
      carNext: () => set({ car: Math.min(S.car + 1, 2) }), carPrev: () => set({ car: Math.max(S.car - 1, 0) }),
      carSkip: () => set({ phase: 'login' }), carDone: () => set({ phase: 'login' }),
      carProg: (S.car + 1) / 3, carHasPrev: S.car > 0, carLast: S.car === 2,
      // auth
      email: S.email, pw: S.pw, onEmail: t => set({ email: noSpace(t), authErr: /\s/.test(t) ? 'Spaces aren’t allowed in your email or account code.' : '' }),
      onPw: t => set({ pw: noSpace(t), authErr: /\s/.test(t) ? 'Spaces aren’t allowed in a password.' : '' }),
      doLogin: this.doLogin, doForgot: this.doForgot, startDemo: this.startDemo, isDemo: isDemo(),
      testMode: TEST_MODE && !isDemo(), devBypass: DEV_BYPASS,
      devOpen: S.devOpen, toggleDev: this.toggleDev, bypassLogin: this.bypassLogin, devErr: S.devErr, reloadDev: this.loadDevClients, apiBase: BASE_URL,
      devQ: S.devQ, onDevQ: t => set({ devQ: t }),
      // Dev picker follows the login switch: Client shows investor accounts, Distributor shows partner logins.
      devClients: (S.devClients || []).filter(c => (S.loginAs === 'distributor') === !!c.isDistributor).filter(c => { const q = S.devQ.trim().toLowerCase().replace(/[^a-z0-9@.]/g, ''); return !q || [c.name, c.email, c.clientCode].some(x => String(x || '').toLowerCase().replace(/[^a-z0-9@.]/g, '').includes(q)); }).slice(0, 40),
      devLoaded: S.devClients !== null,
      update: S.update, dismissUpdate: () => { this.updateDismissed = true; set({ update: null }); },   // "Later" holds until the next app start
      authErr: S.authErr, authInfo: S.authInfo, authBusy: S.busy,
      otpEmailMask: S.setupEmail.replace(/^(.).*(.@)/, '$1•••$2'),
      otpBoxes: S.otp.map((v, i) => ({
        val: v, ref: this.otpRefs ? this.otpRefs[i] : null,
        change: t => this.setState({ otp: this.otpBoxSet(S.otp, this.otpRefs, i, t, this.verifyOtp), authErr: '' }),
        back: () => { if (!S.otp[i] && i > 0 && this.otpRefs[i - 1].current) this.otpRefs[i - 1].current.focus(); },
      })),
      verifyOtp: this.verifyOtp, resendOtp: this.resendOtp, otpLocked: !!S.otpLocked,
      backToLogin: () => set({ phase: 'login', authErr: '', authInfo: '', busy: false }),
      np: S.np, np2: S.np2, onNp: t => set({ np: noSpace(t), authErr: /\s/.test(t) ? 'Spaces aren’t allowed in a password.' : '' }), onNp2: t => set({ np2: noSpace(t), authErr: /\s/.test(t) ? 'Spaces aren’t allowed in a password.' : '' }),
      savePassword: this.savePassword,
      // Saved application banner on sign-in
      hasResume: !!(saved && saved.resumeToken && S.phase === 'login'),
      resumeInfo: savedProg ? {
        name: savedProg.primaryName || '', status: savedProg.status,
        stepText: savedProg.status === 'submitted' ? 'Submitted · track your application' : `Step ${(savedProg.currentStep || 0) + 1} of ${savedProg.totalSteps || 6}`,
        pct: Math.max(0, Math.min(100, Math.round(savedProg.progressPct || 0))),
      } : { name: '', status: 'draft', stepText: 'Pick up where you left off', pct: 0 },
      resumeGo: () => { if (saved && saved.resumeToken) this.resumeFrom(saved.resumeToken, 'saved'); },
      resumeDiscard: () => { this.store.forget(); },
      // Resume screen (from a link or the banner)
      resumeLoading: !!(S.resume && S.resume.loading),
      resumeError: S.resume ? S.resume.error : null,
      resumeErrorCode: S.resume ? S.resume.code : null,
      resumeRetry: () => { if (S.resume) this.resumeFrom(S.resume.token, S.resume.source); },
      resumeStartNew: () => { this.store.forget(); set({ phase: 'ob', ob: this.obDefault(), resume: null }); },
      resumeToLogin: () => set({ phase: this.leaveOb(), resume: null }),
      startApp: this.startApp,
      lifting: S.lifting, liftDone: () => set({ lifting: false }),
      loading: busy, ready: !busy && hasData,
      hasData, dataErr: !busy && !hasData ? (S.dErr || '') : '', retry: () => this.loadScope(0),
      refresh: this.refresh, refreshing: S.refreshing, rk: S.rk,
      doLogout: () => this.signOut(),
      acctName: scope ? scope.name : '', acctInitials: scope ? scope.initials : '', acctTag: (scope && scope.tag) || '', acctCode: scope ? scope.code : '',
      isFamily: S.acct === -1 && !!family,
      multiAcct: owners.length > 0,   // owner aggregate vs its strategy accounts are different views, so the switcher always applies
      // notifications: the bell's inbox and the "turn on notifications" card
      needsYou: false, needsYouMsg: '',
      hasNotif: !!(S.notes && S.notes.unread), notifUnread: (S.notes && S.notes.unread) || 0,
      openNotifs: () => { set({ sheet: 'notifs' }); this.loadNotifs(); },
      sheetNotifs: S.sheet === 'notifs',
      notes: (S.notes && S.notes.items) || [], notesLoading: !!(S.notes && S.notes.loading) && !(S.notes.items || []).length,
      notesErr: (S.notes && S.notes.err) || '', notesRetry: () => this.loadNotifs(),
      noteOpen: nt => this.onNoteTap(nt.link, nt.id),
      notesMarkAll: () => this.markNotes([], true), notesCanMark: this.ownSession(),
      openNotifSettings: () => { set({ sheet: null }); screen('page:notifications'); set({ page: 'notifications' }); },
      inFlight: S.viewing ? [] : (S.inFlight || []), reloadInFlight: () => this.loadInFlight(),
      pushOffer: !!S.pushOffer && !S.viewing, pushOfferSettings: S.pushOffer === 'settings', adminMode: S.phase === 'admin',
      pushOfferYes: async () => { if (S.pushOffer === 'settings') { set({ pushOffer: false }); track('event', 'notification_permission', { result: 'settings', via: 'card' }); push.openSettings(); return; } set({ pushOffer: false }); const p = await push.ask(); track('event', 'notification_permission', { result: p, via: 'card' }); if (p === 'granted') this.pushSync(); },
      pushOfferNo: () => { set({ pushOffer: false }); push.snooze(); },
      svcPending: false, svcNone: true, svcPendingSub: '',
      tab: S.tab, scopeKey: S.acct,
      isHome: S.tab === 'home', isPortfolio: S.tab === 'portfolio', isHoldings: S.tab === 'holdings',
      isDocs: S.tab === 'docs', isServices: S.tab === 'services', isMore: S.tab === 'more', isReports: S.tab === 'reports',
      goHome: () => this.go('home'), goPortfolio: () => this.go('portfolio'),
      isPfGroup: S.tab === 'portfolio' || S.tab === 'holdings',
      segPerf: () => this.go('portfolio'), segHold: () => this.go('holdings'),
      goDocs: () => this.go('docs'), goServices: () => this.go('services'), svcJump: S.svcJump || 0,
      goServicesTx: () => { screen('page:transactions'); set({ page: 'transactions' }); },   // "View all" transactions: their own page
      goMore: () => this.go('more'), goReports: () => this.go('reports'),
      vPortfolio: S.tab === 'portfolio' && !busy && hasData, vHoldings: S.tab === 'holdings' && !busy && hasData,
      vDocs: S.tab === 'docs' && !S.loading, vServices: S.tab === 'services' && !S.loading, vMore: S.tab === 'more' && !S.loading, vReports: S.tab === 'reports' && !S.loading,
      skelOther: S.tab !== 'home' && (['portfolio', 'holdings'].includes(S.tab) ? busy : S.loading),
      navIdx: { home: 0, portfolio: 1, holdings: 1, reports: 2, services: 3, more: 4, docs: 4 }[S.tab],   // Documents opens from More
      heroValue: this.fmt(value * (0.35 + 0.65 * S.cu)),
      rangeLabel: RANGE_LABEL[shownRange] || shownRange, rangePhrase: shownRange === 'SI' ? 'since inception' : 'over ' + (RANGE_LABEL[shownRange] || shownRange), rangeLoading, asOf, benchName, sinceLbl: perf && perf.inceptionDate ? 'Since ' + fmtDate(perf.inceptionDate) : '',
      growthNow: navNow.toFixed(2), navNow: navNow.toFixed(2),
      yTicks: axis.ticks, xDates,
      hasViews: !!S.hist && !S.hist.family,
      viewChips: [['nuvama', 'Nuvama'], ['orbis', 'Orbis (Legacy)'], ['consolidated', 'Orbis + Nuvama']].map(([id, label]) => ({ label, active: (S.dvPending || S.dv) === id, pick: () => this.applyView(id) })),
      // Web note under the returns table: in the Orbis and Combined views the invested / current figures come from Orbis' latest records.
      orbisNote: !!(S.hist && !S.hist.family && S.hist.orbisMetrics && (S.dv === 'orbis' || S.dv === 'consolidated')),
      // What the investor put in: gross (the round figure they remember, e.g. ₹1,00,00,000; the server's grossInvested —
      // every day's money in, before withdrawals and tax) and the net. Dashboard / Performance show net, gross under it.
      invested: (() => {
        if (closed) return { gross: this.fmt(0), net: this.fmt(0), note: null };   // closed: nothing stays invested
        const gross = perf && perf.grossInvested != null ? perf.grossInvested : flows.inflow;
        const net = perf ? perf.amountInvested : flows.inflow - flows.outflow;
        const note = gross - net >= 0.5 ? 'Net of withdrawals ' + this.fmt(net) : null;
        return { gross: this.fmt(gross), net: this.fmt(net), note };
      })(),
      tiles: [
        { label: 'TOTAL RETURNS', value: this.sfmt(totalReturns), color: c(totalReturns) },
        // annualised: the server's returnsPercent is a CAGR once the account is a year old (returnsAnnualised)
        { label: 'RETURN (SI)', value: pct(perf && perf.returnsPercent), color: c(perf ? perf.returnsPercent : 0), annualised: !!(perf && perf.returnsAnnualised) },
        { label: '1Y RETURN', value: pct(P.y1), color: c(P.y1 || 0) },
        { label: 'CURRENT DRAWDOWN', value: ddPct(P.currentDD), color: ddColor(P.currentDD) },
      ],
      perfHead: [
        ['RETURN (SI)', pct(perf && perf.returnsPercent), c(perf ? perf.returnsPercent : 0)],
        ['1Y RETURN', pct(P.y1), c(P.y1 || 0)],
        ['CURRENT DD', ddPct(P.currentDD), ddColor(P.currentDD)],
        ['EXCESS (SI)', P.sinceInception != null && B.sinceInception != null ? pct(P.sinceInception - B.sinceInception) : '–', c((P.sinceInception || 0) - (B.sinceInception || 0))],
      ],
      linePath: p1.line, areaPath: p1.area, benchPath: p1.bench,
      // touch tooltips: growth charts show % change since the start of the window (series is rebased to 100)
      navTip: { kind: 'growth', dates, pts, bench, navs, bvals, growthBase, xy: p1.xy, bxy: p1.bxy, benchName },
      perfTip: { kind: 'growth', dates, pts, bench, navs, bvals, growthBase, xy: p2.xy, bxy: p2.bxy, benchName },
      ddTip: { kind: 'dd', dates: ddDates, pts: ddPts, bench: ddBench, navs: ddDates.map(d => (rawByDate[d] || [])[0]), bvals: ddDates.map(d => (rawByDate[d] || [])[1]), xy: p3.xy, bxy: p3.bxy, benchName },
      ddLine: p3.line, ddArea: p3.area, ddBench: p3.bench, hasDd: ddPts.length > 1, ddNow: ddPts.length ? ddPts[ddPts.length - 1] : 0,
      perfLine: p2.line, perfBench: p2.bench, hasBench: !!bench,
      ranges: RANGE_IDS.map(id => { const off = !this.rangeOk(id, S); return { label: id, disabled: off, pick: () => { if (!off) this.pickRange(id); }, active: S.range === id, loading: rangeLoading && S.range === id }; }),
      // Home's recent activity: the investor's own movements only (minorFlow); txAll keeps the full list.
      tx3: cashTx.filter(t => !minorFlow(t)).slice(0, 3).map(tx), txRecent: cashTx.filter(t => !minorFlow(t)).map(tx),
      txAll: cashTx.map(tx), hasTx: cashTx.length > 0,
      holdings: holdRows, chartColor,
      // IRR (money-weighted) beside TWRR: [{ period, label, value, color }] for SI / 1Y / 3Y when available.
      // Key metrics grid (Performance): server figures + the money-weighted IRR since inception as XIRR
      keyMetrics: (() => {
        const m = S.metrics; if (!m) return [];
        const pc = x => (x == null ? '–' : (x > 0 ? '+' : x < 0 ? '−' : '') + Math.abs(x * 100).toFixed(2) + '%');   // 2 decimals, like every % in the app
        const plain = x => (x == null ? '–' : (x < 0 ? '−' : '') + Math.abs(x * 100).toFixed(2) + '%');
        const si = irrPeriod(S.irr, 'SI');
        const mon = ym => { const [y, mo] = String(ym || '').split('-'); return mo ? ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][+mo - 1] + ' ' + y : ''; };
        const under = m.cagr == null ? 'Shown after a full year' : null;
        // Under a year the server annualises the return since inception for alpha / Sharpe / Sortino (from 3 months:
        // lib/portfolioMetrics.ts ANNUALISE_MIN_DAYS); the note says so. CAGR itself still waits for a full year.
        const mo = Math.max(1, Math.round((m.years || 0) * 12));
        const annNote = m.annualised ? `Annualised from ${mo} month${mo > 1 ? 's' : ''}` : null;
        const wait = 'Shown after 3 months';
        // Under a year (the money-weighted figure is for the period, not a year) the return rows share one basis:
        // "Return on your money" over the period, and alpha = that minus the benchmark's on the same cash flows.
        const per = !!(si && si.irr != null && !si.annualised);
        const pAlpha = per && si.benchIrr != null ? (si.irr - si.benchIrr) / 100 : null;
        return [
          { label: 'CAGR', value: pc(m.cagr), color: m.cagr == null ? C.muted : c(m.cagr), note: under || `${m.years} years since inception` },
          { label: per ? 'Return on Your Money' : 'XIRR', value: si && si.irr != null ? fmtIrr(si) : '–', color: si && si.irr != null ? c(si.irr) : C.muted, note: per ? 'Since inception, over the period' : 'Money-weighted, since inception' },
          { label: 'Sharpe Ratio', value: m.sharpe == null ? '–' : m.sharpe.toFixed(2), color: C.ink, note: m.sharpe == null ? (m.years < 1 ? wait : under) : annNote || `Risk-free rate ${(m.riskFree * 100).toFixed(2)}%` },
          { label: 'Max Drawdown', value: plain(m.maxDrawdown), color: m.maxDrawdown ? red : C.muted, note: 'Deepest fall from a peak' },
          { label: 'Volatility (ann.)', value: plain(m.volatility), color: C.ink, note: 'Annualised, daily returns' },
          per
            ? { label: 'Alpha vs ' + titleCase(m.benchmark), value: pc(pAlpha), color: pAlpha == null ? C.muted : c(pAlpha), note: 'Over the period, on your own money' }
            : { label: 'Alpha vs ' + titleCase(m.benchmark), value: pc(m.alpha), color: m.alpha == null ? C.muted : c(m.alpha), note: m.alpha == null ? under : 'CAGR above the benchmark' },
          { label: 'Beta', value: m.beta == null ? '–' : m.beta.toFixed(2), color: C.ink, note: 'Against ' + titleCase(m.benchmark) },
          { label: 'Best Month', value: m.bestMonth ? pc(m.bestMonth.ret) : '–', color: m.bestMonth ? c(m.bestMonth.ret) : C.muted, note: m.bestMonth ? mon(m.bestMonth.month) : '' },
        ];
      })(),
      // The Performance page's Metrics, since inception, the portfolio beside its benchmark (lib/portfolioMetrics.ts),
      // each with its explanation (def: qodeinvest.com's strategy dashboard wording): three return measures (XIRR,
      // alpha, best month), then seven risk measures. Under a year the ratios use the annualised return since inception (from 3 months).
      riskMetrics: (() => {
        const m = S.metrics; if (!m) return [];
        const b = m.bench || {}, bn = titleCase(m.benchmark || benchName);
        const pc1 = x => (x == null ? '–' : (x * 100).toFixed(2) + '%');
        const n2 = x => (x == null ? '–' : (x < 0 ? '−' : '') + Math.abs(x).toFixed(2));
        const cap = x => (x == null ? '–' : x.toFixed(2) + '%');
        const sg = x => (x == null ? C.muted : x < 0 ? red : green);
        // Under a year: Sharpe / Sortino annualised (lib/portfolioMetrics.ts), shown from 3 months with a note saying
        // so; the information ratio from 3 months too. Alpha: see `per` below.
        const young = m.years < 1 ? 'Shown after 3 months' : null;
        const mo = Math.max(1, Math.round((m.years || 0) * 12));
        const ann = m.annualised ? `Annualised from ${mo} month${mo > 1 ? 's' : ''}` : null;
        const spc = x => (x == null ? '–' : (x > 0 ? '+' : x < 0 ? '−' : '') + Math.abs(x * 100).toFixed(2) + '%');
        const mon = ym => { const [y, mo] = String(ym || '').split('-'); return mo ? ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][+mo - 1] + ' ' + y : ''; };
        const xi = irrPeriod(S.irr, 'SI');
        // Under a year the money-weighted figure is the return over the period, not a yearly rate: the row is
        // "Return on your money" and Alpha is that minus the benchmark's on the same cash flows, so the two rows
        // agree. Sharpe / Sortino / IR stay annualised from daily returns, labelled (decided 8 Oct 2026).
        const per = !!(xi && xi.irr != null && !xi.annualised);
        const pAlpha = per && xi.benchIrr != null ? (xi.irr - xi.benchIrr) / 100 : null;
        // u: the unit (% measures, then ratios): the Returns & Risk page's two columns. In each, the measures without
        // a benchmark figure come first, those with one last.
        return [
          // Benchmark column: the same money, on the same dates, in the benchmark instead (server: lib/irr.ts benchmarkWindowIrr).
          { u: '%', k: per ? 'Return on Your Money' : 'XIRR', note: per ? 'Since inception, over the period, money-weighted' : 'Per year (p.a.), money-weighted, since inception',
            pf: xi && xi.irr != null ? fmtIrr(xi).replace(/\s*p\.a\.$/i, '') : '–', pc: xi && xi.irr != null ? sg(xi.irr) : C.muted,
            bm: xi && xi.benchIrr != null ? spc(xi.benchIrr / 100) : 'n/a', bc: xi && xi.benchIrr != null ? sg(xi.benchIrr) : C.muted, bnote: xi && xi.benchIrr != null ? null : 'Not available',
            def: per ? `Return on your money is what your own investment has earned since you started, taking into account when you added or withdrew money. Your account is under a year old, so it is shown for the period, not as a yearly rate. The ${bn} figure is what the same money would have earned in ${bn} on the same dates.` : `XIRR is your own yearly return, taking into account when you added or withdrew money. Unlike the NAV-based figures, it reflects the timing and size of your investments. Example: money added just before a rally earns a higher XIRR than the same amount added just after it. The ${bn} figure is what the same money would have earned in ${bn}: each amount you invested bought the index on that day, each withdrawal sold it, and what is left is valued today.` },
          { u: '%', k: 'Alpha vs ' + bn, note: per ? 'Over the period, on your own money' : m.alpha == null && young ? young : 'CAGR above the benchmark',
            pf: spc(per ? pAlpha : m.alpha), pc: sg(per ? pAlpha : m.alpha), bm: '–',
            def: `Alpha is how much more (or less) the portfolio earned a year than ${bn} over the same dates: its CAGR minus the benchmark's. Example: a portfolio compounding at 15% while the benchmark compounded at 11% has an alpha of +4%. For an account under a year old it is not annualised: it is the return on your own money over the period minus what the same money earned in the benchmark. ${bn}\'s own alpha is 0% by definition.` },
          { u: '%', k: 'Upside Capture', note: `% of ${bn}'s gains on its up days`, pf: cap(m.upsideCapture), pc: m.upsideCapture == null ? C.muted : m.upsideCapture >= 100 ? green : C.ink, bm: '100.00%', bc: C.muted,
            def: `Upside Capture measures how much of ${bn}'s gains the portfolio captured on the days the benchmark rose. Above 100% means it did better than the benchmark in rising markets. Example: 110% means that when the benchmark gained 10% over its up days, the portfolio gained about 11%. ${bn}\'s own capture is 100% by definition.` },
          { u: '%', k: 'Downside Capture', note: `% of ${bn}'s losses on its down days`, pf: cap(m.downsideCapture), pc: m.downsideCapture == null ? C.muted : m.downsideCapture <= 100 ? green : red, bm: '100.00%', bc: C.muted,
            def: `Downside Capture measures how much of ${bn}'s losses the portfolio took on the days the benchmark fell. Below 100% means it lost less than the benchmark in falling markets, protecting capital better. Example: 80% means that when the benchmark fell 10% over its down days, the portfolio fell only about 8%. ${bn}\'s own capture is 100% by definition.` },
          // Best Month is only in Monthly Returns (monthRows), not here: removed 8 Oct 2026.
          { u: '%', k: 'Volatility', note: 'Annualised, from daily returns', pf: pc1(m.volatility), bm: pc1(b.volatility),
            def: 'Volatility measures how widely returns move around their average, expressed on an annualised basis (standard deviation). Lower volatility means a smoother, more consistent ride. Example: an annualised volatility of 12% means returns have typically varied by about ±12% around the average in a year; a portfolio at 18% has seen larger swings than one at 12%.' },
          { k: 'Information Ratio', note: m.informationRatio == null ? 'Shown after 3 months' : 'Alpha generated per unit of tracking error', pf: n2(m.informationRatio), pc: sg(m.informationRatio), bm: '–',
            def: 'The Information Ratio measures how consistently the portfolio beats its benchmark: the alpha (return above the benchmark) divided by the tracking error (how much its returns differ from the benchmark\'s). Higher signals reliable, repeatable outperformance rather than one-off luck. Example: 4% a year of alpha with 5% tracking error gives 0.8; above 0.5 is generally regarded as good. It is measured against ' + bn + ' itself, so there is no benchmark figure.' },
          { k: 'Sharpe Ratio', note: m.sharpe == null && young ? young : ann ? ann + ' · 6.5% RF' : 'Excess return per unit of total risk (6.5% RF)', pf: n2(m.sharpe), pc: sg(m.sharpe), bm: n2(b.sharpe), bc: sg(b.sharpe),
            def: 'The Sharpe Ratio measures the return earned above the risk-free rate (6.5% a year) for each unit of total risk, where risk is the volatility of returns. Higher means more reward for the risk taken. Example: a portfolio returning 16% with 12% volatility has a Sharpe of about (16 − 6.5) ÷ 12 ≈ 0.79; above 1.0 is generally considered strong.' },
          { k: 'Sortino Ratio', note: m.sortino == null && young ? young : ann || 'Excess return per unit of downside risk', pf: n2(m.sortino), pc: sg(m.sortino), bm: n2(b.sortino), bc: sg(b.sortino),
            def: 'The Sortino Ratio refines the Sharpe Ratio by counting only downside volatility (losses) and ignoring upside swings, which benefit investors. Higher means stronger returns relative to the risk of losing money. Example: two portfolios with the same Sharpe can have very different Sortino values; the one whose swings come mostly from up days scores higher.' },
          { k: 'Beta', note: `Sensitivity to ${bn}'s daily moves`, pf: m.beta == null ? '–' : m.beta.toFixed(2), bm: '–',
            def: `Beta measures how much the portfolio tends to move for a given move in ${bn}, from their daily returns. 1.0 moves in line with the benchmark; above 1.0 swings more; below 1.0 swings less. Example: a Beta of 0.6 means that when the benchmark moved 1% in a day, the portfolio has on average moved about 0.6% the same way.` },
        ];
      })(),
      // Monthly figures since inception, the portfolio beside its benchmark (lib/portfolioMetrics.ts): best and worst
      // calendar month (with the month) and how many months were positive.
      monthRows: (() => {
        const m = S.metrics; if (!m || !m.bestMonth) return [];
        // A year picked (S.monthYr): that calendar year's months only, from the monthly series; else since inception.
        const yr = S.monthYr && (m.months || []).some(x => x.month.startsWith(S.monthYr + '-')) ? S.monthYr : null;
        const stats = list => {
          const xs = (list || []).filter(x => !yr || x.month.startsWith(yr + '-'));
          if (!xs.length) return { bestMonth: null, worstMonth: null, positiveMonths: null };
          return { bestMonth: xs.reduce((a, x) => (x.ret > a.ret ? x : a)), worstMonth: xs.reduce((a, x) => (x.ret < a.ret ? x : a)), positiveMonths: { up: xs.filter(x => x.ret > 0).length, total: xs.length } };
        };
        const pc = x => (x == null ? '–' : (x > 0 ? '+' : x < 0 ? '−' : '') + Math.abs(x * 100).toFixed(2) + '%');
        const mon = ym => { const [y, mo] = String(ym || '').split('-'); return mo ? ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][+mo - 1] + ' ' + y : ''; };
        const P = yr ? stats(m.months) : m, b = yr ? stats((m.bench || {}).months) : (m.bench || {});
        const ret = x => ({ v: x ? pc(x.ret) : '–', note: x ? mon(x.month) : '', color: x ? c(x.ret) : C.muted });
        const pos = x => ({ v: x ? x.up + '/' + x.total : '–', note: x && x.total ? Math.round(x.up / x.total * 100) + '% of months' : '', color: C.ink });
        return [
          { k: 'Best Month', note: 'Best single calendar month return', pf: ret(P.bestMonth), bm: ret(b.bestMonth) },
          { k: 'Worst Month', note: 'Worst single calendar month return', pf: ret(P.worstMonth), bm: ret(b.worstMonth) },
          { k: 'Positive Months', note: 'Months with a positive return', pf: pos(P.positiveMonths), bm: pos(b.positiveMonths) },
        ];
      })(),
      // Year picker for Monthly returns: Since inception, then each calendar year with months, latest first.
      monthYears: (() => {
        const ys = [...new Set(((S.metrics && S.metrics.months) || []).map(x => x.month.slice(0, 4)))].sort().reverse();
        const cur = S.monthYr && ys.includes(S.monthYr) ? S.monthYr : null;
        return ys.length ? [{ id: null, label: 'Since inception', active: !cur, pick: () => set({ monthYr: null }) }]
          .concat(ys.map(y => ({ id: y, label: y, active: cur === y, pick: () => set({ monthYr: y }) }))) : [];
      })(),
      irrRows: ['SI', '1Y', '3Y'].map(p => { const x = irrPeriod(S.irr, p); return x && x.irr != null && this.rangeOk(p, S) ? { period: p, label: irrLabel(x), value: fmtIrr(x), color: c(x.irr) } : null; }).filter(Boolean),
      // One slice per strategy, as on the web (strategySlices in src/web/desktop.js): a family can hold the same strategy
      // in several accounts. The ring draws exact shares (pct): rounded shares can total 99 and leave a gap. The legend
      // shows `alloc` to 2 decimals, like the other holdings percentages.
      holdSlices: [...holdRows.reduce((by, h) => {
        const k = h.name || h.id, g = by.get(k);
        if (g) { g.pct += h.w || 0; g.n += 1; } else by.set(k, { id: k, name: k, color: h.color, pct: h.w || 0, n: 1 });
        return by;
      }, new Map()).values()].sort((a, b) => b.pct - a.pct).map(g => ({ ...g, alloc: g.pct.toFixed(2) })),
      holdCount: holdRows.length,
      // "Your capital" tiles (web Performance): withdrawals and the tax / small debits left out of the movement list together,
      // so the four figures still add up: contributions − withdrawals & tax = net invested.
      capitalTiles: perf ? [
        { label: 'Contributions', value: this.fmt(flows.inflow), color: C.ink },
        { label: 'Withdrawals & Tax', value: this.fmt(flows.inflow - perf.amountInvested), color: C.ink },
        { label: 'Net Invested', value: this.fmt(closed ? 0 : perf.amountInvested), color: C.ink },
        { label: 'Total Returns', value: this.sfmt(totalReturns), color: c(totalReturns) },
      ] : [],
      flows: [
        { label: 'TOTAL CONTRIBUTIONS', value: this.fmt(flows.inflow), color: C.ink },
        { label: 'TOTAL WITHDRAWALS', value: this.fmt(flows.outflow), color: C.ink },
        // The portfolio's net invested also deducts TDS on interest and other small debits that the movement list leaves
        // out (under ₹1,000): shown as its own line so contributions − withdrawals − this = net invested.
        ...(perf && Math.abs(flows.inflow - flows.outflow - perf.amountInvested) >= 0.5
          ? [{ label: 'TAX DEDUCTED & SMALL ADJUSTMENTS', value: this.fmt(flows.inflow - flows.outflow - perf.amountInvested), color: C.ink }] : []),
        { label: 'NET INVESTED', value: this.fmt(perf && !closed ? perf.amountInvested : 0), color: C.ink },
        { label: 'TOTAL RETURNS', value: this.sfmt(totalReturns), color: c(totalReturns) },
      ],
      // Detailed metrics (Portfolio)
      detOpen: S.det, toggleDet: () => set({ det: !S.det }),
      detHint: S.det ? '' : 'Trailing · drawdown · flows',
      trailing: trailingRows(perf),
      riskRows: [
        { k: 'MAX DRAWDOWN', v: ddPct(P.maxDD), vc: ddColor(P.maxDD), note: B.maxDD != null ? benchName + ' ' + ddPct(B.maxDD) : '' },
        { k: 'CURRENT DRAWDOWN', v: ddPct(P.currentDD), vc: ddColor(P.currentDD), note: B.currentDD != null ? benchName + ' ' + ddPct(B.currentDD) : '' },
      ],
      credItems: [],
      // Profit & Loss (Portfolio)
      pnlRows: S.pnlSeg === 0
        ? fy.m.map(a => ({ m: a[0], note: a[3] || 'Net of fees', v: this.sfmt(a[1]), vc: rs(a[1]), p: spct(a[2]), color: c(a[1]), pcolor: c(a[2]) }))
        : qtr.map(q => ({ m: q.m, note: q.note, v: this.sfmt(q.v), vc: rs(q.v), p: spct(q.p), color: c(q.v), pcolor: c(q.p) })),
      pnlSegChips: ['MONTHLY', 'QUARTERLY'].map((l, i) => ({ label: l, pick: () => set({ pnlSeg: i }), active: S.pnlSeg === i })),
      fyLabel: fy.label.toUpperCase(), fyTotal: this.sfmt(fySum(fy)), fyColor: c(fySum(fy)), fyTotalPct: fy.tp != null ? spct(fy.tp) : '',
      pnlPills: fys.slice(0, 3).map(f => f.label).concat(fys.length > 3 ? ['All Years'] : []).map((lbl, i) => ({
        label: lbl, pick: () => set({ pnlFy: i, pnlOpen: null }), active: S.pnlFy === i,
      })),
      // One P&L dropdown: each of the last three years by month or by quarter, then every year's total (Yearly).
      pnlOptions: fys.slice(0, 3).flatMap((f, i) => ['Monthly', 'Quarterly'].map((p, seg) => ({
        label: f.label + ' - ' + p, active: pnlIsYear && S.pnlFy === i && S.pnlSeg === seg, pick: () => set({ pnlFy: i, pnlSeg: seg, pnlOpen: null }),
      }))).concat(fys.length ? [{ label: 'All years - Yearly', active: !pnlIsYear, pick: () => set({ pnlFy: allIdx, pnlOpen: null }) }] : []),
      pnlFy: S.pnlFy, pnlIsYear, pnlIsAll: pnlIsAll && fys.length > 3, hasPnl: fys.length > 0,
      // P&L as a table: one row per year (latest first), the twelve months' returns % and the year's total.
      // In rupees too (rcells / rtotal: the profit, net of fees), for the % | ₹ switch.
      pnlGrid: fys.map(f => {
        const cells = Array(12).fill(null), amts = Array(12).fill(null);
        f.m.forEach(a => { cells[a[4]] = a[2]; amts[a[4]] = a[1]; });
        const tv = fySum(f);
        return { id: f.label, year: f.label, cells: cells.map(p => (p == null ? '–' : spct(p))), colors: cells.map(p => (p == null ? C.muted : c(p))),
          total: f.tp != null ? spct(f.tp) : '–', tcolor: f.tp != null ? c(f.tp) : C.muted,
          rcells: amts.map(rs), rcolors: amts.map(v => (v == null ? C.muted : c(v))), rtotal: rs(tv), rtcolor: c(tv) };
      }),
      // …and by quarter: Q1–Q4 and the year's total.
      pnlGridQ: ((S.d && S.d.fysQ) || []).map(f => {
        const cells = Array(4).fill(null), amts = Array(4).fill(null);
        f.q.forEach(a => { cells[a[4]] = a[2]; amts[a[4]] = a[1]; });
        const tv = f.tv != null ? f.tv : f.q.reduce((t, a) => t + (a[1] || 0), 0);
        return { id: f.label, year: f.label, cells: cells.map(p => (p == null ? '–' : spct(p))), colors: cells.map(p => (p == null ? C.muted : c(p))),
          total: f.tp != null ? spct(f.tp) : '–', tcolor: f.tp != null ? c(f.tp) : C.muted,
          rcells: amts.map(rs), rcolors: amts.map(v => (v == null ? C.muted : c(v))), rtotal: rs(tv), rtcolor: c(tv) };
      }),
      allYears: fys.map((f, i) => ({
        label: f.label, total: this.sfmt(fySum(f)), totalC: rs(fySum(f)), color: c(fySum(f)), pct: f.tp != null ? spct(f.tp) : '', pcolor: c(f.tp || 0),
        open: S.pnlOpen === i, pick: () => set({ pnlOpen: S.pnlOpen === i ? null : i }),
        rows: f.m.map(a => ({ m: a[0], v: this.sfmt(a[1]), color: c(a[1]) })),
      })),
      impersonate: this.impersonate, exitImpersonation: this.exitImpersonation,
      // admin mode
      isAdmin: S.phase === 'admin', adm: S.adm || {}, setAdm: p => this.setState(s => ({ adm: { ...(s.adm || {}), ...p } })),
      openAsUser: this.openAsUser, backToAdmin: () => this.backToAdmin(), imp: S.imp || null, closeBackoffice: this.closeBackoffice,
      toast: m => this.toast(m),
      viewing: S.viewing, viewInvestor: this.viewInvestor, exitView: () => this.exitView(), partnerNav: this.partnerNav || null,
      user: S.user, isSuperAdmin: !!(S.user && S.user.isSuperAdmin), impersonated: !!(S.user && S.user.isImpersonated),
      page: S.page, openPage: k => { k = PAGE_ALIASES[k] || k; screen('page:' + k); set({ page: k }); }, closePage: () => set({ page: null }),
      // The strategies the investor holds (open accounts, any family member): the Strategy page marks them.
      myStrategies: [...new Set(((S.scopes && S.scopes.owners) || []).flatMap(o => (o.accounts || []).filter(a => !a.isClosed).map(a => a.strategyPrefix)).filter(Boolean))],
      acctOptions: (scope ? scope.accounts : []).map(a => ({ id: a.id, label: a.strategyPrefix ? a.strategyPrefix + ' · ' + a.id : a.id })),
      // closed accounts of the scope's people, for Reports only (Nuvama's statements include them)
      reportClosed: !scope || (scope.kind === 'account' && !scope.ownerView) ? []
        : (scope.kind === 'owner' || scope.ownerView ? scope.closedAccounts || [] : ((S.scopes && S.scopes.owners) || []).flatMap(o => o.closedAccounts || []))
          .map(a => ({ id: String(a.id), name: a.strategyName || '' })),
      // QFH accounts: never listed, but part of "All accounts" in Reports
      reportHidden: !scope || (scope.kind === 'account' && !scope.ownerView) ? []
        : scope.kind === 'owner' || scope.ownerView ? scope.hiddenAccounts || [] : ((S.scopes && S.scopes.owners) || []).flatMap(o => o.hiddenAccounts || []),
      openReq: (k, preset) => { if (!S.viewing) set({ sheet: k, sheetPreset: preset || null }); }, sheetPreset: S.sheetPreset || null,   // no requests in a client's name while a distributor views the account
      bumpRefresh: () => set(s => ({ rk: s.rk + 1 })),
      openAdd: () => { if (!S.viewing) set({ sheet: 'r-add' }); },
      openSwitchStrategy: () => { if (!S.viewing) set({ sheet: 'r-switch' }); },
      // every strategy account in the current scope, with its current value (snapshot) for the switch form
      switchAccounts: (scope ? scope.accounts : []).filter(a => a.strategyPrefix).map(a => ({
        id: String(a.id), prefix: a.strategyPrefix, name: a.strategyName || a.id,
        value: num((S.hold[a.id] && S.hold[a.id].currentValue) != null ? S.hold[a.id].currentValue : a.portfolioValue) || 0,
      })),
      openSettings: () => set({ sheet: 'settings' }),
      sheet: S.sheet,
      sheetSettings: S.sheet === 'settings',
      tsChips: this.chips(['S', 'M', 'L', 'XL'], S.ts, i => set({ ts: i })),
      hcOn: S.hc, rmOn: S.rm,
      hcToggle: () => set({ hc: !S.hc }), rmToggle: () => set({ rm: !S.rm }),
      sheetOpen: !!S.sheet, sheetSwitch: S.sheet === 'switch',
      openSwitch: () => set({ sheet: 'switch' }), closeSheet: () => set({ sheet: null, sheetPreset: null, payRecover: null }),
      payRecover: S.payRecover || null,
      // primary-UCC pop-up: once per sign-in, over Home, after the dashboard has loaded and while no sheet/page is open
      showUcc: S.tab === 'home' && !S.uccSeen && !busy && hasData && !S.sheet && !S.page && !isDemo() && S.phase === 'app' && !S.lifting,
      dismissUcc: () => { set({ uccSeen: true }); storeSet(UCC_SEEN_KEY, String((S.user && S.user.clientCode) || '')); },
      reshowUcc: () => { storeDel(UCC_SEEN_KEY); set({ uccSeen: false, tab: 'home', sheet: null, page: null }); screen('home'); },
      acctList: owners.map((a, i) => ({
        id: a.id + ':' + i, name: a.name, code: a.code, role: a.role, crown: a.crown, initials: a.initials,
        value: this.fmt(a.value), pick: () => this.pickScope(i), active: S.acct === i,
        subs: a.accounts.map(x => ({
          id: String(x.id), name: x.strategyName || x.id, code: x.id, color: x.strategyColor || C.gray,
          orbis: !!x.hasOrbis,   // web: "Orbis+Nuvama" badge on accounts with legacy Orbis rows
          value: this.fmt(num(x.portfolioValue) || 0), pick: () => this.pickScope('a:' + x.id), active: S.acct === 'a:' + x.id,
        })).concat((a.closedAccounts || []).map(x => this.closedSubOf(x))),
      })).concat(((S.scopes && S.scopes.closedOwners) || []).map(o => ({
        id: o.id + ':closed', name: o.name, code: o.closedAccounts.length + (o.closedAccounts.length === 1 ? ' account' : ' accounts'), role: 'CLOSED', crown: false,
        initials: o.initials, closedOwner: true, value: '', pick: () => this.pickScope('a:' + o.closedAccounts[0].id), active: false,
        subs: o.closedAccounts.map(x => this.closedSubOf(x)),
      }))),
      // A closed account on screen: one line at the top of the dashboard.
      // The pop-up on opening a closed account (web and phone), once per account per session.
      closedPopup: closed && !(S.closedSeen || {})[scope.id] ? { id: scope.id, name: scope.tag || scope.id, closedOn: scope.closedOn ? fmtDate(scope.closedOn) : '' } : null,
      dismissClosed: () => { const sc = this.curScope(); if (sc) set({ closedSeen: { ...(this.state.closedSeen || {}), [sc.id]: true } }); },
      closedNote: scope && scope.kind === 'account' && scope.closed === true ? `This account was closed${scope.closedOn ? ' on ' + fmtDate(scope.closedOn) : ''} after a full withdrawal. Figures are as of closing.` : '',
      hasFamily: !!family,
      pickFamily: () => this.pickScope(-1),
      famActive: S.acct === -1 && !!family,
      familyTotal: this.fmt(family ? family.value : 0),
      ...this.obVals(),
    };
  }

  obVals() {
    const S = this.state, set = p => this.setState(p);
    const OB = S.ob || this.obDefault();
    const setOb = p => this.setOb(p);
    const store = this.store;
    const SS = store ? store.s : null;
    const server = SS ? SS.server : {};
    const locked = !!(SS && SS.locked);
    // A submitted application is read-only: every form step collapses to the tracker.
    const st = locked && OB.step !== 'opened' ? 'tracker' : OB.step;
    const accountType = (SS && SS.accountType) || accountTypeFor(OB);
    const individual = OB.type === 0;
    const nri = individual && OB.subRes > 0;
    const risk = riskProfileFor(OB.ans) || 'Moderate-Aggressive';
    const refShort = SS && SS.id ? SS.id.slice(-8).toUpperCase() : '';
    const TITLES = {
      begin: ['Begin your journey', 'STEP 1 OF 8 · DETAILS'],
      type: ['Choose your account', 'STEP 1 OF 8 · DETAILS'],
      identity: ['Identity details', 'STEP 2 OF 8 · IDENTITY'],
      q: [QS[OB.qi].q, 'STEP 3 OF 8 · QUESTION ' + (OB.qi + 1) + ' OF 6'],
      result: ['Your risk profile', 'STEP 3 OF 8 · RISK'],
      fee: ['Fees, stated plainly', 'STEP 4 OF 8 · FEES'],
      fin: ['Financial profile', 'STEP 5 OF 8 · FINANCIAL PROFILE'],
      noms: ['Nominees', 'STEP 6 OF 8 · NOMINEES · OPTIONAL'],
      docs: ['Documents', 'STEP 7 OF 8 · DOCUMENTS'],
      review: ['Review & submit', 'STEP 8 OF 8 · REVIEW'],
      tracker: ['Your journey is underway', refShort ? 'APPLICATION ' + refShort : 'APPLICATION SUBMITTED'],
      opened: ['Your account is open, ' + ((OB.name || 'there').split(' ')[0]), 'WELCOME TO QODE'],
    };
    const PROG = { begin: 0.04, type: 0.125, identity: 0.25, q: 0.3 + OB.qi * 0.018, result: 0.42, fee: 0.5, fin: 0.625, noms: 0.75, docs: 0.875, review: 0.96, tracker: 1, opened: 1 };
    const BACK = { type: 'begin', identity: 'type', result: 'q', fee: 'result', fin: 'fee', noms: 'fin', docs: 'noms', review: 'docs' };
    const allocSum = OB.noms.reduce((s, n) => s + (parseInt(n.alloc, 10) || 0), 0);
    // Nominee inputs are sanitised as typed: names letters-only, mobile 10 digits, share 1–3 digits.
    const NOM_CLEAN = { name: cleanName, rel: cleanName, guardian: cleanName, mob: t => t.replace(/\D/g, '').slice(0, 10), alloc: t => t.replace(/\D/g, '').slice(0, 3) };
    const upd = (i, f) => t => { const v = NOM_CLEAN[f] ? NOM_CLEAN[f](t) : t; const noms = OB.noms.map((n, j) => j === i ? { ...n, [f]: v } : n); setOb({ noms, nomErr: '' }); };

    // ---- verification helpers ----------------------------------------------
    const lockedP = lockedFieldsFor(server, 'primary');
    const lockedS = lockedFieldsFor(server, 'second');
    const verP = verifiedSummary(server, 'primary');
    const verS = verifiedSummary(server, 'second');
    const digioOn = !SS || SS.digio !== 'disabled';
    const checkOf = (subject, purpose) => (store ? store.check(subject, purpose) : null);
    const checkView = (subject, purpose, verified) => {
      const ch = checkOf(subject, purpose);
      const active = ch && ch.checkId && !ch.done && !ch.failed && !ch.timedOut;
      let status = 'NOT VERIFIED', tone = 'muted';
      if (verified || (ch && ch.done)) { status = 'VERIFIED'; tone = 'gold'; }
      else if (ch && ch.starting) { status = 'STARTING'; tone = 'muted'; }
      else if (active) { status = ch.slow ? 'TAKING A WHILE' : 'IN PROGRESS'; tone = 'muted'; }
      else if (ch && (ch.failed || ch.timedOut || ch.error || ch.sdkError)) { status = 'NEEDS ATTENTION'; tone = 'red'; }
      return { status, tone, active: !!active, done: verified || !!(ch && ch.done), error: ch ? (ch.error || ch.sdkError) : null, manual: !!OB.manual[subject + '_' + purpose] };
    };
    const contactOk = subject => (subject === 'primary' ? (isValidEmail(OB.email) || isValidMobile(OB.mobile)) : (isValidEmail(OB.h2Email) || isValidMobile(OB.h2Mobile)));
    const startCheck = async (subject, purpose) => {
      if (!contactOk(subject)) { setOb({ err: `Add a valid email or mobile for ${subject === 'primary' ? 'holder 1' : 'the second holder'} before verifying.` }); return; }
      const existing = checkOf(subject, purpose);
      setOb({ verify: { subject, purpose }, err: '' });
      if (existing && (existing.done || (existing.checkId && !existing.failed && !existing.timedOut))) { store.resumePolling(); return; }
      if (purpose === 'identity') {
        // Selfie liveness needs the camera; ask up front so the web window can use it.
        try { await ImagePicker.requestCameraPermissionsAsync(); } catch (e) { /* the window will prompt again */ }
      }
      if (existing && (existing.failed || existing.timedOut || existing.error)) store.retryVerification(subject, purpose);
      else store.startVerification(subject, purpose);
    };
    const verifyOpen = !!OB.verify;
    const verifyCheck = OB.verify ? checkOf(OB.verify.subject, OB.verify.purpose) : null;
    const verifyPurpose = OB.verify ? OB.verify.purpose : 'identity';

    // ---- documents ---------------------------------------------------------
    const slots = docSlotsFor({ accountType, nri, holders: OB.h2 ? 2 : 1, holderNames: [OB.name || 'Holder 1', OB.h2Name || 'Holder 2'] });
    const docRows = resolveDocs(slots, SS ? SS.uploads : [], SS ? SS.satisfied : []).map(r => ({
      ...r,
      uploading: !!(SS && SS.uploading[r.key]),
      err: SS ? SS.uploadErrors[r.key] : null,
      fileName: r.upload ? r.upload.originalName : '',
      sizeText: r.upload && r.upload.sizeBytes ? (r.upload.sizeBytes / (1024 * 1024)).toFixed(1) + ' MB' : '',
      pickCamera: () => this.pickAndUpload(r.key, 'camera'),
      pickPhotos: () => this.pickAndUpload(r.key, 'library'),
      pickFile: () => this.pickAndUpload(r.key, 'file'),
      dismissErr: () => store && store.clearUploadError(r.key),
    }));
    const docGroups = [];
    docRows.forEach(r => { let g = docGroups.find(x => x.holder === r.holder); if (!g) { g = { holder: r.holder, rows: [] }; docGroups.push(g); } g.rows.push(r); });
    const docCounts = { fetched: docRows.filter(r => r.state === 'fetched').length, uploaded: docRows.filter(r => r.state === 'uploaded').length, waived: docRows.filter(r => r.state === 'waived').length, pending: docRows.filter(r => r.state === 'pending' && r.required).length };

    // ---- save status -------------------------------------------------------
    const saveLabels = { idle: '', dirty: 'UNSAVED', saving: 'SAVING…', saved: 'SAVED', offline: 'OFFLINE · WILL SAVE', error: 'SAVE FAILED · RETRYING' };
    const saveState = SS ? SS.saveState : 'idle';
    const inForm = !['begin', 'type', 'tracker', 'opened'].includes(st);
    const tracker = (() => {
      if (!SS) return [];
      const sub = SS.submittedAt ? new Date(SS.submittedAt) : null;
      const when = sub ? sub.toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }).replace(/\bSept\b/, 'Sep') : 'Just now';
      const idV = verP && verP.verified;
      const bankV = !!(verP && verP.bank);
      const esign = checkOf('primary', 'esign');
      return [
        { title: 'Application submitted', sub: when, state: 'done' },
        { title: idV ? 'Identity verified' : 'Identity documents received', sub: idV ? 'DigiLocker · PAN and Aadhaar fetched' : 'Uploaded by you · under review', state: 'done' },
        { title: bankV ? 'Bank account verified' : 'Bank details received', sub: bankV ? `${verP.bank.bankName || 'Bank'} · ₹1 penny drop matched` : 'From your cancelled cheque', state: 'done' },
        { title: 'Under review by Qode', sub: 'Usually within 1 working day', state: 'active' },
        { title: 'Sign your PMS agreement', sub: esign && esign.done ? 'Signed' : 'We’ll notify you when it’s ready', state: esign && esign.done ? 'done' : 'pending' },
        { title: 'Account opened', sub: 'Custodian confirmation', state: 'pending' },
      ];
    })();

    return {
      isOb: S.phase === 'ob',
      startOb: () => { if (this.store) this.store.reset(); set({ phase: 'ob', ob: this.obDefault() }); },
      obStep: st,
      obTitle: TITLES[st] ? TITLES[st][0] : '', obStepLabel: TITLES[st] ? TITLES[st][1] : '',
      obTitleSize: st === 'q' ? 22 : 26,
      obTall: st === 'tracker' || st === 'opened',
      obProg: PROG[st] ?? 0,
      obShowBack: st !== 'tracker' && st !== 'opened',
      obBack: () => {
        if (st === 'begin') { set({ phase: 'login' }); return; }
        if (st === 'q') { OB.qi > 0 ? setOb({ qi: OB.qi - 1 }) : setOb({ step: 'identity' }); return; }
        setOb({ step: BACK[st] || 'begin', err: '' });
      },
      obSaveExit: () => { if (store) store.flush(); set({ phase: 'login' }); },
      obSaveLabel: inForm ? saveLabels[saveState] || '' : '',
      obOffline: !!(SS && SS.offline),
      obOfflineMsg: 'You’re offline. Keep going. Everything is kept on this device and saved the moment you’re back online.',
      obCreateError: SS && !SS.id && SS.createError && !SS.offline ? SS.createError : null,
      obRetrySave: () => store && store.kick(),
      obNotice: SS ? SS.notice : null,
      obDismissNotice: () => store && store.clearNotice(),
      obLocked: locked,
      obBegin: st === 'begin', obType: st === 'type', obIdentity: st === 'identity', obFin: st === 'fin',
      obNoms: st === 'noms', obFeeStep: st === 'fee', obQ: st === 'q', obResult: st === 'result',
      obDocsStep: st === 'docs', obReview: st === 'review', obTracker: st === 'tracker', obOpened: st === 'opened',
      obName: OB.name, obEmail: OB.email, obMobile: OB.mobile,
      onObName: t => setOb({ name: cleanName(t), err: '' }),
      onObEmail: t => setOb({ email: t.replace(/\s/g, '').slice(0, 254), err: '' }),
      onObMobile: t => setOb({ mobile: t.replace(/\D/g, '').slice(0, 10), err: '' }),
      obHasErr: !!OB.err, obErr: OB.err,
      obBeginNext: () => {
        const err = validateBegin(OB);
        if (err) return setOb({ err });
        setOb({ step: 'type', err: '' });
      },
      obTypes: TYPES.map((t, i) => ({
        name: t.name, sub: t.sub, pick: () => setOb({ type: i }),
        active: OB.type === i, showRes: i === 0 && OB.type === 0, showEntity: i === 2 && OB.type === 2,
      })),
      obResChips: this.chips(RES, OB.subRes, i => setOb({ subRes: i, res: i > 0 ? 1 : 0 })),
      obEntityChips: this.chips(ENTITY_LABELS, OB.entitySub, i => setOb({ entitySub: i })),
      obTypeNote: OB.type === 0
        ? 'Individual accounts can verify identity and bank details online in a couple of minutes.'
        : 'For this account type we collect documents for the entity and its signatories. Our team completes verification with you.',
      obTypeNext: () => {
        const at = accountTypeFor(OB);
        const next = { ...OB, step: 'identity', err: '' };
        if (store) store.requestCreate(at, toBackendData(next, server));
        set({ ob: next }, () => this.syncOb());
      },
      obIsIndividual: individual,
      obResidency: this.chips(['RESIDENT', 'NRI / OCI / PIO'], OB.res, i => setOb({ res: i, subRes: i === 0 ? 0 : Math.max(1, OB.subRes) })),
      obGender: this.chips(['Female', 'Male', 'Other'], OB.gender, i => setOb({ gender: i })),
      obMarital: this.chips(['Single', 'Married', 'Other'], OB.marital, i => setOb({ marital: i })),
      obMobBelongs: this.chips(['Self', 'Spouse'], OB.mobBel, i => setOb({ mobBel: i })),
      obEmailBelongs: this.chips(['Self', 'Spouse'], OB.emailBel, i => setOb({ emailBel: i })),
      obPep: this.chips(['Yes', 'No'], OB.pep, i => setOb({ pep: i })),
      obOcc: this.chips(['Salaried', 'Business', 'Professional', 'Retired'], OB.occ, i => setOb({ occ: i })),
      obSrc: this.chips(['Salary', 'Business income', 'Investments', 'Inheritance'], OB.src, i => setOb({ src: i })),
      obIncome: this.chips(['Under ₹25 L', '₹25 L – 1 Cr', '₹1 – 5 Cr', 'Over ₹5 Cr'], OB.income, i => setOb({ income: i })),
      obEdu: this.chips(['Graduate', 'Post-graduate', 'Professional', 'Other'], OB.edu, i => setOb({ edu: i })),
      obDob: OB.dob, onObDob: t => setOb({ dob: formatDobInput(t), err: '' }),
      obAddr: OB.addr, onObAddr: t => setOb({ addr: t.slice(0, 500), err: '' }),
      obPan: OB.pan, onObPan: t => setOb({ pan: t.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10), err: '' }),
      // Verified (locked) fields for holder 1
      obLockedFields: lockedP,
      obVerified: verP && verP.verified ? verP : null,
      obVerifiedRows: verP && verP.verified ? [
        ['NAME AS PER PAN', verP.fullName], ['PAN', verP.pan], ['AADHAAR', verP.aadhaar], ['DATE OF BIRTH', verP.dob],
        ['GENDER', verP.gender ? verP.gender[0].toUpperCase() + verP.gender.slice(1) : ''], ['FATHER’S NAME', verP.fatherName], ['ADDRESS AS PER AADHAAR', verP.address],
      ].filter(r => r[1]) : [],
      obFaceMatch: verP && verP.faceMatch != null ? String(verP.faceMatch) + '%' : '',
      obBank: verP && verP.bank ? { ...verP.bank, masked: maskAccount(verP.bank.accountNumber) } : null,
      obDigioOn: digioOn && individual,
      obDigioOffMsg: SS && SS.digio === 'disabled' ? 'Online verification isn’t switched on at ' + API_BASE.split('//').pop() + ' right now. Fill in your details below and upload documents on the Documents step. Our team verifies them for you.' : null,
      obIdCheck: checkView('primary', 'identity', !!(verP && verP.verified)),
      obBankCheck: checkView('primary', 'bank', !!(verP && verP.bank)),
      obH2Check: checkView('second', 'identity', !!(verS && verS.verified)),
      obStartIdentity: () => startCheck('primary', 'identity'),
      obStartBank: () => startCheck('primary', 'bank'),
      obStartH2Identity: () => startCheck('second', 'identity'),
      obSkipVerify: (subject, purpose) => setOb({ manual: { ...OB.manual, [subject + '_' + purpose]: true }, verify: null }),
      // Verification sheet
      obVerifyOpen: verifyOpen,
      obVerifyCheck: verifyCheck,
      obVerifyTitle: verifyPurpose === 'bank' ? 'Verify your bank account' : 'Verify with DigiLocker',
      obVerifySub: verifyPurpose === 'bank' ? 'Secure ₹1 penny drop by Digio' : 'Secure window from Digio · stays inside myQode',
      obVerifyClose: () => setOb({ verify: null }),
      obVerifyManual: () => { if (OB.verify) setOb({ manual: { ...OB.manual, [OB.verify.subject + '_' + OB.verify.purpose]: true }, verify: null }); },
      obVerifyRetry: () => { if (OB.verify) store.retryVerification(OB.verify.subject, OB.verify.purpose); },
      obVerifyKeepWaiting: () => { if (OB.verify) store.keepWaiting(OB.verify.subject, OB.verify.purpose); },
      obVerifyEvent: msg => { if (OB.verify) store.sdkEvent(OB.verify.subject, OB.verify.purpose, msg); },
      // Holder 2
      obNoH2: !OB.h2 && individual, obH2: OB.h2, obAddH2: () => setOb({ h2: true }), obRemoveH2: () => setOb({ h2: false }),
      obH2Name: OB.h2Name, onObH2Name: t => setOb({ h2Name: cleanName(t), err: '' }),
      obH2Email: OB.h2Email, onObH2Email: t => setOb({ h2Email: t.replace(/\s/g, '').slice(0, 254), err: '' }),
      obH2Mobile: OB.h2Mobile, onObH2Mobile: t => setOb({ h2Mobile: t.replace(/\D/g, '').slice(0, 10), err: '' }),
      obH2Pan: OB.h2Pan, onObH2Pan: t => setOb({ h2Pan: t.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10), err: '' }),
      obH2Dob: OB.h2Dob, onObH2Dob: t => setOb({ h2Dob: formatDobInput(t), err: '' }),
      obH2Locked: lockedS,
      obH2Verified: verS && verS.verified ? verS : null,
      obMode: this.chips(['Single', 'Jointly'], OB.mode, i => setOb({ mode: i })),
      obIdentityNext: () => {
        const err = validateIdentity(OB, server);
        if (err) return setOb({ err });
        setOb({ step: 'q', qi: 0, err: '' });
      },
      obFinNext: () => setOb({ step: 'noms' }),
      obNomList: OB.noms.map((n, i) => ({
        n: i + 1, name: n.name, rel: n.rel, mob: n.mob, alloc: n.alloc, guardian: n.guardian,
        onName: upd(i, 'name'), onRel: upd(i, 'rel'), onMob: upd(i, 'mob'), onAlloc: upd(i, 'alloc'), onGuardian: upd(i, 'guardian'),
        isMinor: n.minor,
        toggleMinor: () => setOb({ noms: OB.noms.map((x, j) => j === i ? { ...x, minor: !x.minor } : x) }),
        remove: () => setOb({ noms: OB.noms.filter((x, j) => j !== i), nomErr: '' }),
      })),
      obCanAddNom: OB.noms.length < 3,
      obAddNom: () => setOb({ noms: OB.noms.concat({ name: '', rel: '', mob: '', alloc: '0', minor: false, guardian: '' }), nomOptOut: false }),
      obNomErr: !!OB.nomErr, obNomErrMsg: OB.nomErr,
      obNomsNext: () => {
        const err = validateNominees(OB);
        if (err) return setOb({ nomErr: err });
        setOb({ step: 'docs', nomErr: '', nomOptOut: false });
      },
      obOptOut: () => setOb({ noms: [], nomOptOut: true, step: 'docs', nomErr: '' }),
      obSkipNoms: () => setOb({ step: 'docs', nomErr: '' }),
      obFees: FEES.map((f, i) => ({ name: f.name, sub: f.sub, pick: () => setOb({ fee: i }), active: OB.fee === i })),
      obFeeNext: () => setOb({ step: 'fin' }),
      obRiskLabel: risk,
      obAnswers: QS[OB.qi].a.map((a, i) => ({
        label: a,
        pick: () => {
          const ans = OB.ans.slice(); ans[OB.qi] = i;
          this.setOb({ ans });
          if (OB.qi < 5) setTimeout(() => this.setOb({ ans, qi: OB.qi + 1 }), 220);
          else setTimeout(() => this.setOb({ ans, step: 'result' }), 220);
        },
        active: OB.ans[OB.qi] === i,
      })),
      obResultNext: () => setOb({ step: 'fee' }),
      // Documents
      obDocGroups: docGroups,
      obDocErr: OB.docErr,
      obIsNri: nri,
      obDocsNext: () => {
        const err = validateDocs(docRows);
        if (err) return setOb({ docErr: err });
        setOb({ step: 'review', docErr: '' });
      },
      obDocsSkipToReview: () => setOb({ step: 'review', docErr: '' }),
      // Review
      obReviewGroups: [
        { title: 'DETAILS', edit: () => setOb({ step: 'begin' }), rows: [
          { k: 'Name', v: OB.name || '–' },
          { k: 'Account', v: accountLabelFor(accountType) + (individual ? ' · ' + RES[OB.subRes] : '') },
          { k: 'Contact', v: (OB.mobile ? '+91 ' + OB.mobile : '') + (OB.email ? (OB.mobile ? ' · ' : '') + OB.email : '') || '–' },
        ] },
        { title: 'IDENTITY', edit: () => setOb({ step: 'identity' }), badge: verP && verP.verified ? 'VERIFIED VIA DIGILOCKER' : null, rows: [
          { k: 'PAN', v: (verP && verP.pan) || OB.pan || '–' },
          ...(verP && verP.aadhaar ? [{ k: 'Aadhaar', v: verP.aadhaar }] : []),
          { k: 'Date of birth', v: (verP && verP.dob) || OB.dob || '–' },
          { k: 'Holders', v: OB.h2 ? '2 · ' + ['Single', 'Jointly'][OB.mode] : '1' },
        ] },
        ...(verP && verP.bank ? [{ title: 'BANK', edit: () => setOb({ step: 'identity' }), badge: 'PENNY DROP VERIFIED', rows: [
          { k: 'Bank', v: (verP.bank.bankName || 'Bank') + ' · ' + maskAccount(verP.bank.accountNumber) },
          { k: 'Name on account', v: verP.bank.beneficiary || '–' },
        ] }] : []),
        { title: 'NOMINEES', edit: () => setOb({ step: 'noms' }), rows: OB.noms.length ? OB.noms.map(n => ({ k: n.name || 'Nominee', v: (n.rel || '–') + ' · ' + (parseInt(n.alloc, 10) || 0) + '%' })) : [{ k: OB.nomOptOut ? 'Opted out (SEBI declaration)' : 'None added', v: '–' }] },
        { title: 'RISK & FEE', edit: () => setOb({ step: 'fee' }), rows: [{ k: 'Fee structure', v: FEES[OB.fee].name }, { k: 'Risk profile', v: risk }] },
        { title: 'DOCUMENTS', edit: () => setOb({ step: 'docs' }), rows: [
          { k: 'Fetched automatically', v: String(docCounts.fetched) },
          { k: 'Uploaded by you', v: String(docCounts.uploaded) },
          ...(docCounts.waived ? [{ k: 'Waived (bank verified)', v: String(docCounts.waived) }] : []),
          ...(docCounts.pending ? [{ k: 'Still needed', v: String(docCounts.pending) }] : []),
        ] },
      ],
      obSubmitting: !!(SS && SS.submitting),
      obSubmitError: SS ? SS.submitError : null,
      obSubmit: async () => {
        if (!store || SS.submitting) return;
        const err = validateForSubmit(OB, server, docRows);
        if (err) return setOb({ err });
        const ok = await store.submit({ appStep: 'tracker', submittedFrom: 'myqode-native' });
        if (ok) setOb({ step: 'tracker', err: '' });
      },
      obTrack: tracker.map((t, i, arr) => ({
        title: t.title, sub: t.sub,
        done: t.state === 'done', active: t.state === 'active', pending: t.state === 'pending',
        titleColor: t.state === 'pending' ? C.muted : C.ink,
        notLast: i < arr.length - 1,
        railColor: t.state === 'done' ? C.green : (t.state === 'active' ? C.gold : 'rgba(55,88,79,0.25)'),
      })),
      obTrackNote: 'Your details are locked now that they’re submitted. Need a correction? Your relationship manager can request changes.',
      obRefresh: () => store && store.refreshProgress(),
      obToOpened: () => setOb({ step: 'opened', copied: false }),
      obCopy: () => { Clipboard.setStringAsync('PMS 00891').catch(() => {}); setOb({ copied: true }); },
      obCopyLabel: OB.copied ? 'COPIED' : 'TAP TO COPY',
      obOpenFund: () => setOb({ fundOpen: true, fundDone: false }),
      obCloseFund: () => setOb({ fundOpen: false }),
      obFundOpen: OB.fundOpen, obFundForm: !OB.fundDone, obFundDone: OB.fundDone,
      obAmtStr: OB.amt ? OB.amt.toLocaleString('en-IN') : '',
      onObAmt: t => setOb({ amt: parseInt(t.replace(/\D/g, '').slice(0, 12) || '0', 10), fundErr: '' }),
      obAmtFmt: this.fmt(OB.amt || 0),
      obFundErr: OB.fundErr || '',
      obFundConfirm: () => { const err = validateAmount(OB.amt); if (err) return setOb({ fundErr: err }); setOb({ fundDone: true, fundErr: '' }); },
      obFinish: () => set({ ob: null, phase: this.leaveOb() }),
      obExitToLogin: () => set({ phase: this.leaveOb() }),
    };
  }

  render() {
    const V = this.vals();
    const U = {
      z: [0.92, 1, 1.08, 1.16][this.state.ts],
      hc: this.state.hc, rm: this.state.rm,
    };
    // Web on a wide screen: the signed-in app is the desktop dashboard; every other phase (sign-in, onboarding,
    // partner panel) keeps the phone layout in a centred column.
    const toastEl = !!this.state.toast && (
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: this.props.desktop ? 40 : 110, alignItems: 'center', pointerEvents: 'none' }}>
        <View style={{ backgroundColor: 'rgba(0,32,23,0.92)', borderRadius: 999, paddingVertical: 10, paddingHorizontal: 18 }}>
          <Tx w={700} s={12} c={C.cream}>{this.state.toast}</Tx>
        </View>
      </View>
    );
    // Admin mode on desktop web: the backoffice console (src/web/admin.js).
    if (this.props.desktop && V.isAdmin) {
      return (
        <UICtx.Provider value={U}>
          <View style={{ flex: 1 }}>
            <DesktopAdmin V={V} />
            {toastEl}
          </View>
        </UICtx.Provider>
      );
    }
    if (this.props.desktop && V.isApp) {
      return (
        <UICtx.Provider value={U}>
          <View style={{ flex: 1 }}>
            <ImpersonationFrame V={V} desktop><DesktopShell V={V} /></ImpersonationFrame>
            <UpdatePrompt V={V} />
            {!!this.state.toast && (
              <View style={{ position: 'absolute', left: 0, right: 0, bottom: 40, alignItems: 'center', pointerEvents: 'none' }}>
                <View style={{ backgroundColor: 'rgba(0,32,23,0.92)', borderRadius: 999, paddingVertical: 10, paddingHorizontal: 18 }}>
                  <Tx w={700} s={12} c={C.cream}>{this.state.toast}</Tx>
                </View>
              </View>
            )}
          </View>
        </UICtx.Provider>
      );
    }
    // Distributor on desktop: the full-width distributor dashboard (src/web/distributor.js), with the admin
    // "Viewing as … / Back to admin" bar when an admin opened it.
    if (this.props.desktop && V.isPartner) {
      return (
        <UICtx.Provider value={U}>
          <View style={{ flex: 1 }}>
            <ImpersonationFrame V={V} desktop><DesktopDistributor V={V} /></ImpersonationFrame>
            <UpdatePrompt V={V} />
            {V.lifting && <Curtain onDone={V.liftDone} rm={this.state.rm} />}
            {toastEl}
          </View>
        </UICtx.Provider>
      );
    }
    // Signed-out phases on desktop: the purpose-built split-screen sign-in (src/web/auth.js).
    if (this.props.desktop && !V.isPartner) {
      return (
        <UICtx.Provider value={U}>
          <View style={{ flex: 1 }}>
            <DesktopAuth V={V} />
            <UpdatePrompt V={V} />
            {V.lifting && <Curtain onDone={V.liftDone} rm={this.state.rm} />}
            {!!this.state.toast && (
              <View style={{ position: 'absolute', left: 0, right: 0, bottom: 40, alignItems: 'center', pointerEvents: 'none' }}>
                <View style={{ backgroundColor: 'rgba(0,32,23,0.92)', borderRadius: 999, paddingVertical: 10, paddingHorizontal: 18 }}>
                  <Tx w={700} s={12} c={C.cream}>{this.state.toast}</Tx>
                </View>
              </View>
            )}
          </View>
        </UICtx.Provider>
      );
    }
    // Phone layout (and the phone partner panel). Desktop phases all return above, so the frame is not used here.
    const framed = this.props.desktop;
    const Frame = framed ? DesktopAuthFrame : React.Fragment;
    return (
      <UICtx.Provider value={U}>
        <Frame>
        <View style={{ flex: 1 }}>
        <View style={{ flex: 1, backgroundColor: this.state.phase === 'app' || this.state.phase === 'partner' || this.state.phase === 'admin' ? C.cream : '#001008' }} {...this.edgeSwipe.panHandlers}>
          <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
          {V.isSplash && <Splash V={V} />}
          {V.isCarousel && <Carousel V={V} />}
          {V.isLogin && <Login V={V} />}
          {V.isOtp && <OtpScreen V={V} />}
          {V.isSetPw && <SetPassword V={V} />}
          {V.isResume && <ResumeScreen V={V} />}
          {V.isOb && <Onboarding V={V} />}
          {V.isApp && <ImpersonationFrame V={V}><AppShell V={V} /></ImpersonationFrame>}
          {V.isPartner && <ImpersonationFrame V={V}><DistributorShell V={V} /></ImpersonationFrame>}
          {V.isAdmin && <AdminConsole V={V} />}
          {V.isLock && <LockScreen V={V} />}
          <UpdatePrompt V={V} />
          {V.lifting && <Curtain onDone={V.liftDone} rm={this.state.rm} />}
          {!!this.state.toast && (
            <View style={{ position: 'absolute', left: 0, right: 0, bottom: 110, alignItems: 'center', pointerEvents: 'none' }}>
              <View style={{ backgroundColor: 'rgba(0,32,23,0.92)', borderRadius: 999, paddingVertical: 10, paddingHorizontal: 18 }}>
                <Tx w={700} s={12} c={C.cream}>{this.state.toast}</Tx>
              </View>
            </View>
          )}
        </View>
        </View>
        </Frame>
      </UICtx.Provider>
    );
  }
}
