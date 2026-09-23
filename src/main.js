// myQode Curtain v2 — root stateful component. The state machine and computed
// values ("vals") are ported from the design's DCLogic class, adapted for
// React Native (text handlers instead of DOM events, active flags instead of
// inline CSS strings).
import React from 'react';
import { View, StatusBar, BackHandler, AppState, Platform } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as Linking from 'expo-linking';
import * as Network from 'expo-network';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { C, UICtx, Tx } from './ui';
import { readPendingPayment, hintFromReturnUrl } from './screens/pay';
import { storeGet, storeSet, storeDel } from './api/session';

// The primary-UCC pop-up is once per SIGN-IN, not per app start: Expo Go reloads the project on every
// payment/SIP return link, which reset the in-memory flag and showed it again after each transaction.
// So the dismissal is remembered on the device against the client code and cleared on sign-out.
const UCC_SEEN_KEY = 'myqode.uccSeen';
import {
  QUARTER_LABELS,
  QS, TYPES, FEES, RES,
} from './data';
import { BASE_URL, auth, portfolio, meta, admin, services, documents, clearUserCaches, ApiError, onUnauthorized, getToken, setToken, clearToken, setDemo, isDemo, TEST_MODE, DEV_BYPASS, APP_VERSION, SHOW_UPDATE_BANNER } from './api';
import { trackStart, trackStop, screen } from './api/track';
import { perfFrom, navFrom, ddFrom, cashFrom, plFrom, combineFamily } from './webcalc';
import { buildScopes, buildFys, buildFysQ, buildPaths, niceAxis, navSeries, trailingRows, flowTotals, num, pct, titleCase, semverLt } from './adapt';
import Splash from './screens/splash';
import Carousel from './screens/carousel';
import { Login, OtpScreen, SetPassword } from './screens/login';
import Onboarding, { ResumeScreen } from './screens/onboarding';
import AppShell from './screens/appshell';
import Curtain from './screens/curtain';
// Onboarding (account opening) — a separate, unauthenticated backend; see src/onboarding/config.js.
import OnboardingStore from './onboarding/store';
import * as obApi from './onboarding/api';
import * as obStorage from './onboarding/storage';
import {
  accountTypeFor, accountLabelFor, accountTypeToOb, toBackendData, fromBackendData, stepIndexFor, resumeStepFor,
  lockedFieldsFor, verifiedSummary, maskAccount, docSlotsFor, resolveDocs, riskProfileFor, formatDobInput,
  isValidEmail, isValidMobile, validateBegin, validateIdentity, validateNominees, validateDocs, validateForSubmit,
  ENTITY_LABELS,
} from './onboarding/mapping';
import { API_BASE, RESUME_HOSTS, UPLOAD } from './onboarding/config';

const MIME_BY_EXT = { pdf: 'application/pdf', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp' };
const guessMime = name => MIME_BY_EXT[(String(name || '').split('.').pop() || '').toLowerCase()] || 'application/octet-stream';

const PERIOD = { '1M': '1M', '6M': '6M', '1Y': '1Y', '3Y': '3Y', All: 'ALL' };

export default class MyQode extends React.Component {
  state = {
    phase: 'splash', tab: 'home', sheet: null, acct: 0, range: 'All',
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
  };

  go(t) {
    if (this.state.tab === t) return;
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
      if (st === 'active' && this.state.phase === 'app' && Date.now() - (this.lastLoad || 0) > 60000) this.refresh();
      if (this.store) { if (st === 'active') this.store.onForeground(); else if (st === 'background') this.store.onBackground(); }
    });
    this.boot();
  }
  componentWillUnmount() {
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
  handleBack() {
    const S = this.state;
    if (S.sheet) { this.setState({ sheet: null }); return true; }
    if (S.page) { this.setState({ page: null }); return true; }
    if (S.phase === 'app') {
      // Tabs are top-level destinations, not a stack: from any tab, back goes straight to Home.
      if (S.tab !== 'home') { this.go('home'); return true; }
      return this.confirmExit();
    }
    if (S.phase === 'resume') { this.setState({ phase: 'login', resume: null }); return true; }
    if (S.phase === 'ob') { this.obVals().obBack(); return true; }
    if (S.phase === 'otp' || S.phase === 'setpw') { this.setState({ phase: 'login', authErr: '', authInfo: '', busy: false }); return true; }
    if (S.phase === 'carousel' && S.car > 0) { this.setState({ car: S.car - 1 }); return true; }
    if (S.phase === 'login' || S.phase === 'carousel') return this.confirmExit();
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

  async boot() {
    const minSplash = new Promise(r => { this.splashT = setTimeout(r, 1200); });
    let ok = false;
    if (await getToken()) {
      // Load everything the Home screen needs while the splash is showing, so the dashboard appears filled
      // in. Capped at 8 s: after that the app opens anyway and the skeleton takes over.
      const cap = new Promise(r => setTimeout(r, 8000));
      try {
        const me = await auth.me();
        await new Promise(r => this.setState({ user: me }, r));
        trackStart(me.clientCode);
        storeGet(UCC_SEEN_KEY).then(v => { if (v && v === String(me.clientCode)) this.setState({ uccSeen: true }); });
        services.bankDetails().catch(() => {});
        services.warmSwitchInfo();
        await Promise.race([this.openPortfolio(), cap]);
        ok = true;
      } catch (e) { if (e.status === 401) await clearToken(); }
    }
    this.checkVersion();
    await minSplash;
    if (this.unmounted || this.state.phase !== 'splash') return;
    if (ok) this.startApp(); else this.setState({ phase: 'carousel' });
  }

  async checkVersion() {
    if (!SHOW_UPDATE_BANNER) return;
    try {
      const v = await meta.appVersion();
      if (v && v.minVersion && semverLt(APP_VERSION, v.minVersion)) this.setState({ update: { force: true, ...v } });
      else if (v && v.latestVersion && semverLt(APP_VERSION, v.latestVersion)) this.setState({ update: { force: false, ...v } });
    } catch {}
  }

  curScope(S = this.state) {
    const sc = S.scopes;
    if (!sc) return null;
    if (typeof S.acct === 'string') {       // 'a:<accountCode>' = one strategy account, like picking it in the web dropdown
      const code = S.acct.slice(2);
      for (const o of sc.owners) {
        const a = o.accounts.find(x => String(x.id) === code);
        if (a) return { id: String(a.id), kind: 'account', name: a.strategyName || a.id, initials: (a.strategyPrefix || 'Q').slice(0, 3), code: a.id + ' · ' + o.name, value: num(a.portfolioValue) || 0, accounts: [a] };
      }
    }
    return (S.acct === -1 ? sc.family : sc.owners[S.acct]) || sc.owners[0] || null;
  }

  codes() { return isDemo() ? null : (this.state.user && this.state.user.accountCodes) || null; }

  async loadSnapshot() {
    const snap = await portfolio.snapshot();
    const scopes = buildScopes(snap, this.codes());
    this.fellBack = {};
    await new Promise(r => this.setState({ snap, scopes, acct: scopes.family ? -1 : 0, d: null, hold: {}, navs: {}, dErr: '' }, r));
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
          this.setState({ snap: null, scopes: null, d: null, dl: false, dErr: e.message || 'We couldn’t load your accounts.' });
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
    const seq = ++this.seq, period = PERIOD[this.state.range];
    this.setState({ dl: true, dErr: '' });
    try {
      const k = scope.kind;
      if (k === 'local-family') {
        // one raw-history call per member, combined locally
        const got = await Promise.allSettled(scope.members.map(id => portfolio.history(id)));
        if (seq !== this.seq) return;
        const fam = combineFamily(got.map(x => (x.status === 'fulfilled' ? x.value : null)));
        if (!fam || got.some(x => x.status === 'rejected')) {
          const e = (got.find(x => x.status === 'rejected') || {}).reason || {};
          if (e.status === 401) throw e;
          if (this.stepDown(scope)) return;       // can't build the family total: fall back to the first member
          throw new Error(e.message || 'We couldn’t build the family total.');
        }
        this.setState({ hist: fam, dv: 'nuvama' }, () => this.applyView('nuvama'));
        this.lastLoad = Date.now();
        this.loadHoldings(scope, seq);
        return;
      }
      // Performance is required; every other part is optional so one failing endpoint can't blank the portfolio.
      const parts = await Promise.allSettled([
        portfolio.performance(scope.id, k), portfolio.nav(scope.id, period, k), portfolio.drawdown(scope.id, period, k),
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
      const [perf, nav, dd, cash, monthly, quarterly] = parts.map(x => (x.status === 'fulfilled' ? x.value : null));
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
      if (hist) { this.setState({ hist }, () => this.applyView(this.state.dv)); this.lastLoad = Date.now(); this.loadHoldings(scope, seq); return; }
      this.setState({ hist: null, d: { id: scope.id, kind: k, perf, cash, fys: buildFys(monthly), fysQ: buildFysQ(quarterly) }, navs: { [period]: { nav, dd } }, dl: false, pnlFy: 0, pnlOpen: null });
      this.lastLoad = Date.now();
      this.loadHoldings(scope, seq);
    } catch (e) {
      if (seq !== this.seq) return;
      // Transient failure: keep the skeleton and try again (twice) before showing an error — a tunnel or
      // Wi-Fi hiccup on the first request must not flash "couldn't load" over a portfolio that loads fine.
      if (attempt < 2 && MyQode.transient(e)) { await MyQode.wait(1500 * (attempt + 1)); if (seq === this.seq) return this.loadScope(attempt + 1); return; }
      this.setState({ dl: false, dErr: e.message });
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
    } else if (scope.kind === 'owner' && scope.accounts && scope.accounts[0]) {
      next = 'a:' + scope.accounts[0].id;
    }
    if (next == null) return false;
    this.setState({ acct: next, d: null, hist: null, hold: {}, navs: {} }, () => this.loadScope());
    return true;
  }

  async loadHoldings(scope, seq) {
    const res = await Promise.allSettled(scope.accounts.map(a => portfolio.performance(a.id)));
    if (seq !== this.seq) return;
    const hold = {};
    res.forEach((r, i) => { if (r.status === 'fulfilled') hold[scope.accounts[i].id] = r.value; });
    this.setState({ hold });
  }

  // Build the whole portfolio state locally for one of the web's views: 'nuvama' | 'orbis' | 'consolidated'.
  applyView(dv) {
    const h = this.state.hist;
    if (!h) return;
    const period = PERIOD[this.state.range], pl = plFrom(h, dv);
    this.setState({
      dv, dl: false, pnlFy: 0, pnlOpen: null,
      d: { id: h.accountId, kind: 'account', local: true, perf: perfFrom(h, dv), cash: cashFrom(h, dv), fys: buildFys(pl.monthly), fysQ: buildFysQ(pl.quarterly) },
      navs: { [period]: { nav: navFrom(h, dv, period), dd: ddFrom(h, dv, period) } },
    });
  }

  // `shownRange` = the last range whose data is on screen; vals() keeps drawing it until the new one has loaded.
  async pickRange(id) {
    const period = PERIOD[id], d = this.state.d;
    const shownRange = this.state.navs[period] ? id : (this.state.shownRange || this.state.range);
    this.setState({ range: id, shownRange });
    if (d && d.local && this.state.hist) {
      const h = this.state.hist, dv = this.state.dv;
      this.setState(s => ({ shownRange: id, navs: { ...s.navs, [period]: { nav: navFrom(h, dv, period), dd: ddFrom(h, dv, period) } } }));
      return;
    }
    if (!d || this.state.navs[period]) return;
    try {
      const [nav, dd] = await Promise.all([portfolio.nav(d.id, period, d.kind), portfolio.drawdown(d.id, period, d.kind)]);
      if (this.state.d && this.state.d.id === d.id) this.setState(s => ({ navs: { ...s.navs, [period]: { nav, dd } }, shownRange: s.range === id ? id : s.shownRange }));
    } catch {}
  }

  pickScope(i) {
    this.setState({ acct: i, sheet: null, d: null, hist: null, dv: 'nuvama', hold: {}, navs: {}, pnlFy: 0, pnlOpen: null }, () => this.loadScope());
  }

  // Refresh button / return-to-foreground: refetch everything on screen.
  refresh = async () => {
    if (this.state.refreshing || this.state.phase !== 'app') return;
    this.setState(s => ({ refreshing: true, rk: s.rk + 1 }));
    try {
      const snap = await portfolio.snapshot();
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
    }[e.code] || (e.status === 401 ? 'Incorrect password. Please try again.' : e.message);
    this.setState({ busy: false, authErr: msg });
  }

  doLogin = async () => {
    const { email, pw, busy } = this.state;
    const id = email.trim();
    if (busy) return;
    if (!id || !pw) return this.setState({ authErr: 'Enter your email or client code and your password.' });
    this.setState({ busy: true, authErr: '', authInfo: '' });
    try {
      { const r = await auth.login(id, pw); await this.finishLogin(r.token, r.user); }
    } catch (e) {
      if (e.code === 'PASSWORD_SETUP_REQUIRED') return this.beginSetup(id);
      this.authFail(e);
    }
  };

  async finishLogin(token, user) {
    await setToken(token);
    this.setState({ user: user || null });
    trackStart(user && user.clientCode);
    await new Promise(r => this.setState({}, r));   // user (accountCodes) must be in state before scopes are built
    try { await this.openPortfolio(); } catch (e) { await clearToken(); throw e; }
    this.setState({ busy: false, pw: '', np: '', np2: '', otp: ['', '', '', '', '', ''], authErr: '' });
    this.startApp();
  }

  async beginSetup(id) {
    try {
      const email = id.includes('@') ? id : (await auth.checkIdentifier(id)).email;
      if (!email) throw new ApiError('There is no email on file for this account. Please contact investor relations.');
      await auth.sendSetupOtp(email);
      this.setState({ busy: false, phase: 'otp', setupEmail: email, otp: ['', '', '', '', '', ''], authErr: '', authInfo: '' });
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
      this.setState({ otp: ['', '', '', '', '', ''] });
      this.authFail(e);
      if (this.otpRefs[0].current) this.otpRefs[0].current.focus();
    }
  };

  resendOtp = async () => {
    try {
      await auth.sendSetupOtp(this.state.setupEmail);
      this.setState({ authErr: '', authInfo: 'A new code is on its way.' });
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
    } catch (e) { this.authFail(e); }
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
    if (!username) return this.setState({ authErr: 'Enter an email or client code.' });
    this.setState({ busy: true, authErr: '', authInfo: '' });
    try {
      const r = await auth.loginBypass(username);
      await this.finishLogin(r.token, r.user);
    } catch (e) {
      // a non-development server demands the password: 400 "Fields required…" (or 401 on older builds)
      if (e.status === 400 || (e.status === 401 && /credentials/i.test(e.message))) e.message = 'The server refused a passwordless login. It must run with NODE_ENV=development (npm run dev in myQode/).';
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
    try { const r = await auth.devClients(); this.setState({ devClients: r.clients || [], devErr: (r.clients || []).length ? '' : 'The server returned no Discretionary clients.' }); }
    catch (e) { this.setState({ devClients: [], devErr: (e.status === 404 ? 'Client list is only available when the server runs in development.' : e.message) + ' (' + BASE_URL + ')' }); }
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
    this.origToken = null;
    trackStop();
    setDemo(false);
    clearUserCaches();
    storeDel(UCC_SEEN_KEY);   // next sign-in sees the UCC pop-up once again
    this.seq++;
    await clearToken();
    this.counted = false;
    this.setState({
      phase: 'login', tab: 'home', sheet: null, page: null, user: null, acct: 0, hist: null, dv: 'nuvama', snap: null, scopes: null, d: null, hold: {}, navs: {},
      dErr: '', dl: false, pw: '', busy: false, otp: ['', '', '', '', '', ''], authErr: msg, authInfo: '', uccSeen: false, payRecover: null,
    });
  };
  expire() {
    if (this.state.phase !== 'app') return;
    if (this.origToken) this.exitImpersonation();
    else this.signOut('Your session has expired. Please sign in again.');
  }

  // Super admin: swap in a 4h client-scoped token; keep the admin token to come back.
  impersonate = async clientCode => {
    const r = await admin.impersonate(clientCode);
    if (!this.origToken) this.origToken = await getToken();
    await setToken(r.token);
    clearUserCaches();
    services.warmSwitchInfo();
    await new Promise(res => this.setState({ user: r.user, page: null, tab: 'home' }, res));
    await this.openPortfolio();
  };
  exitImpersonation = async () => {
    const t = this.origToken; this.origToken = null;
    if (!t) return this.signOut();
    await setToken(t);
    try { const me = await auth.me(); await new Promise(res => this.setState({ user: me, page: null, tab: 'home' }, res)); await this.openPortfolio(); }
    catch { this.signOut('Your admin session has expired. Please sign in again.'); }
  };

  fmt(v) { return '₹' + v.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  fmt0(v) { return '₹' + v.toLocaleString('en-IN'); }
  sfmt(v) { return (v < 0 ? '−' : '+') + this.fmt(Math.abs(v)); }

  startApp = () => {
    const first = !this.counted; this.counted = true;
    const ready = !!this.state.d;
    this.setState({ phase: 'app', tab: 'home', lifting: true, loading: !ready, cu: first ? 0 : 1 });
    if (!ready) setTimeout(() => this.setState({ loading: false }), 950);
    services.bankDetails().catch(() => {});
    services.warmSwitchInfo();
    const sc = this.curScope(); if (sc && sc.accounts[0]) documents.warm(sc.accounts[0].id);   // Documents tab: category counts
    if (!first) return;
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

  async resumeFrom(token, source) {
    clearTimeout(this.splashT);
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
      this.setState({ resume: { token, source, loading: false, error: e.message, code: e.code } });
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
    const S = this.state, set = p => this.setState(p);
    const scope = this.curScope();
    const perf = S.d && S.d.perf;
    const hasData = !!perf;
    const busy = S.loading || S.dl || S.sl;   // sl: snapshot / scopes still loading (see openPortfolio)
    const green = C.pos, red = C.red;
    const c = v => (v < 0 ? red : v > 0 ? green : C.muted);   // same rule as the web table: green / red / neutral
    const asOf = perf ? perf.dataAsOf : '';
    const benchName = titleCase(perf && perf.strategy && perf.strategy.benchmark) || 'Nifty 50';
    const value = perf ? perf.currentValue : scope ? scope.value : 0;
    const totalReturns = perf ? perf.totalReturns : 0;

    // NAV chart (the API series is rebased to 100; plotted below in real NAV terms)
    // While a newly picked range is still loading, keep drawing the last range that has data — the charts never
    // blank out for the round trip. Everything range-dependent below uses `shownRange`, not `S.range`.
    const entryFor = r => S.navs[PERIOD[r]];
    const shownRange = entryFor(S.range) ? S.range : entryFor(S.shownRange) ? S.shownRange
      : (Object.keys(PERIOD).find(r => entryFor(r)) || S.range);
    const rangeLoading = shownRange !== S.range;
    const navEntry = entryFor(shownRange) || {};
    const { pts, bench, dates, navs, bvals } = navSeries(navEntry.nav);
    const rawByDate = {}; dates.forEach((d, i) => { rawByDate[d] = [navs[i], bvals[i]]; });
    const { pts: ddPts, bench: ddBench, dates: ddDates } = navSeries(navEntry.dd);
    const p3 = buildPaths(ddPts, ddBench, 330, 100, 0);
    // Plot in real NAV terms like the web chart: portfolio = raw NAV, benchmark scaled to start at the same NAV.
    const hasRaw = pts.length > 1 && navs.length === pts.length && navs.every(v => v != null && v > 0);
    const cPts = hasRaw ? navs : pts;
    // Web chart = full history with the benchmark rebased to 10 (PMS convention). Shorter ranges start both lines together.
    const cBench = bench ? bench.map(b => (b / bench[0]) * (hasRaw && shownRange === 'All' ? 10 : cPts[0])) : null;
    // "All" uses the web's y-axis domain (calculateYDomain: min/max padded 5%, floored/ceiled to whole NAV units);
    // the shorter, mobile-only ranges use a rounded axis.
    const webDomain = vs => { const min = Math.min(...vs), max = Math.max(...vs), pad = (max - min) * 0.05, lo = Math.floor(min - pad), hi = Math.ceil(max + pad); return { lo, hi, ticks: [hi, (lo + hi) / 2, lo].map(v => v.toFixed(1)) }; };
    const axisVals = cBench ? cPts.concat(cBench) : cPts;
    const axis = cPts.length > 1 ? (shownRange === 'All' && hasRaw ? webDomain(axisVals) : niceAxis(axisVals)) : { lo: 0, hi: 1, ticks: [] };
    const p1 = buildPaths(cPts, cBench, 330, 120, null, [axis.lo, axis.hi]);
    const p2 = buildPaths(cPts, cBench, 358, 110, null, [axis.lo, axis.hi]);
    const navNow = cPts.length ? cPts[cPts.length - 1] : 0;
    const dmy = d => { const t = new Date(d); return isNaN(t) ? '' : t.getDate() + '/' + (t.getMonth() + 1) + '/' + t.getFullYear(); };
    const xDates = dates.length > 1 ? [dates[0], dates[Math.floor((dates.length - 1) / 2)], dates[dates.length - 1]].map(dmy) : [];
    // Growth anchor for the full-history chart = the web's: NAV 10 (the PMS starting point) when the first
    // NAV isn't exactly 10, else the first NAV. Shorter ranges are anchored at the window start.
    const isAll = shownRange === 'All';
    const rawFirst = hasRaw ? navs[0] : null;
    const growthBase = isAll && rawFirst != null && rawFirst !== 10 ? 10 : null;   // null → relative to the first point
    const growthAt = i => (growthBase != null ? (navs[i] / growthBase - 1) * 100 : (pts[i] / pts[0] - 1) * 100);

    // Recent activity from cashflow
    const dateFmt = d => {
      const t = new Date(d);
      return isNaN(t) ? String(d) : t.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    };
    const cashTx = ((S.d && S.d.cash && S.d.cash.transactions) || []).slice()
      .sort((a, b) => new Date(b.date) - new Date(a.date));
    const tx = t => {
      const out = t.type === 'outflow', amt = Math.abs(num(t.amount) || 0);
      return {
        title: out ? 'Withdrawal' : 'Contribution', sub: dateFmt(t.date),
        amt: this.sfmt(out ? -amt : amt), color: out ? red : green, status: 'COMPLETED', stColor: C.green,
      };
    };

    // Profit & Loss — calendar years like the web table; year totals come from the API
    const fys = (S.d && S.d.fys) || [];
    const allIdx = Math.min(fys.length, 3);
    const pnlIsYear = S.pnlFy < allIdx, pnlIsAll = S.pnlFy === allIdx && fys.length > 0;
    const fy = fys[Math.min(S.pnlFy, Math.max(allIdx - 1, 0))] || { label: '', m: [] };
    const spct = p => (p < 0 ? '−' : '+') + Math.abs(p).toFixed(2) + '%';
    const fySum = f => (f.tv != null ? f.tv : f.m.reduce((s, x) => s + x[1], 0));
    const fyQ = ((S.d && S.d.fysQ) || []).find(f => f.label === fy.label);
    const qtr = (fyQ ? fyQ.q : []).map(a => ({ m: QUARTER_LABELS[a[4]][0] + ' ' + fy.label, note: QUARTER_LABELS[a[4]][1], v: a[1], p: a[2] }));

    // Holdings = strategy accounts inside the selected scope
    const accts = scope ? scope.accounts : [];
    const holdTotal = accts.reduce((s, a) => s + (num(a.portfolioValue) || 0), 0) || 1;
    const holdRows = accts.map(a => {
      const hp = S.hold[a.id], v = num(a.portfolioValue) || 0;
      return {
        id: a.id, name: a.strategyName, tag: a.type || a.id, alloc: Math.round(v / holdTotal * 100), color: a.strategyColor || C.gray,
        value: this.fmt(v),
        gain: hp ? pct(hp.returnsPercent) + ' SI' : '',
        ret: hp ? pct(hp.returnsPercent) : '', retColor: c(hp ? hp.returnsPercent : 0), mdd: hp ? pct(hp.trailingReturns.portfolio.maxDD) : '', hasM: !!hp,
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
      isCarousel: S.phase === 'carousel', isResume: S.phase === 'resume',
      carIdx: S.car,
      carNext: () => set({ car: Math.min(S.car + 1, 2) }), carPrev: () => set({ car: Math.max(S.car - 1, 0) }),
      carSkip: () => set({ phase: 'login' }), carDone: () => set({ phase: 'login' }),
      carProg: (S.car + 1) / 3, carHasPrev: S.car > 0, carLast: S.car === 2,
      // auth
      email: S.email, pw: S.pw, onEmail: t => set({ email: t, authErr: '' }), onPw: t => set({ pw: t, authErr: '' }),
      doLogin: this.doLogin, doForgot: this.doForgot, startDemo: this.startDemo, isDemo: isDemo(),
      testMode: TEST_MODE && !isDemo(), devBypass: DEV_BYPASS,
      devOpen: S.devOpen, toggleDev: this.toggleDev, bypassLogin: this.bypassLogin, devErr: S.devErr, reloadDev: this.loadDevClients, apiBase: BASE_URL,
      devQ: S.devQ, onDevQ: t => set({ devQ: t }),
      devClients: (S.devClients || []).filter(c => { const q = S.devQ.trim().toLowerCase().replace(/[^a-z0-9@.]/g, ''); return !q || [c.name, c.email, c.clientCode].some(x => String(x || '').toLowerCase().replace(/[^a-z0-9@.]/g, '').includes(q)); }).slice(0, 40),
      devLoaded: S.devClients !== null,
      update: S.update, dismissUpdate: () => set({ update: null }),
      authErr: S.authErr, authInfo: S.authInfo, authBusy: S.busy,
      otpEmailMask: S.setupEmail.replace(/^(.).*(.@)/, '$1•••$2'),
      otpBoxes: S.otp.map((v, i) => ({
        val: v, ref: this.otpRefs ? this.otpRefs[i] : null,
        change: t => this.setState({ otp: this.otpBoxSet(S.otp, this.otpRefs, i, t, this.verifyOtp), authErr: '' }),
        back: () => { if (!S.otp[i] && i > 0 && this.otpRefs[i - 1].current) this.otpRefs[i - 1].current.focus(); },
      })),
      verifyOtp: this.verifyOtp, resendOtp: this.resendOtp,
      backToLogin: () => set({ phase: 'login', authErr: '', authInfo: '', busy: false }),
      np: S.np, np2: S.np2, onNp: t => set({ np: t, authErr: '' }), onNp2: t => set({ np2: t, authErr: '' }),
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
      resumeToLogin: () => set({ phase: 'login', resume: null }),
      startApp: this.startApp,
      lifting: S.lifting, liftDone: () => set({ lifting: false }),
      loading: busy, ready: !busy && hasData,
      hasData, dataErr: !busy && !hasData ? (S.dErr || '') : '', retry: () => this.loadScope(0),
      refresh: this.refresh, refreshing: S.refreshing, rk: S.rk,
      doLogout: () => this.signOut(),
      acctName: scope ? scope.name : '', acctInitials: scope ? scope.initials : '', acctCode: scope ? scope.code : '',
      isFamily: S.acct === -1 && !!family,
      multiAcct: owners.length > 0,   // owner aggregate vs its strategy accounts are different views, so the switcher always applies
      // notifications (no inbox API yet)
      needsYou: false, needsYouMsg: '',
      hasNotif: false, openNotifs: () => set({ sheet: 'notifs' }),
      sheetNotifs: S.sheet === 'notifs', notifEmpty: true, notifHas: false,
      notifList: [],
      svcPending: false, svcNone: true, svcPendingSub: '',
      tab: S.tab, scopeKey: S.acct,
      isHome: S.tab === 'home', isPortfolio: S.tab === 'portfolio', isHoldings: S.tab === 'holdings',
      isDocs: S.tab === 'docs', isServices: S.tab === 'services', isMore: S.tab === 'more',
      goHome: () => this.go('home'), goPortfolio: () => this.go('portfolio'),
      isPfGroup: S.tab === 'portfolio' || S.tab === 'holdings',
      segPerf: () => this.go('portfolio'), segHold: () => this.go('holdings'),
      goDocs: () => this.go('docs'), goServices: () => this.go('services'), goMore: () => this.go('more'),
      vPortfolio: S.tab === 'portfolio' && !busy && hasData, vHoldings: S.tab === 'holdings' && !busy && hasData,
      vDocs: S.tab === 'docs' && !S.loading, vServices: S.tab === 'services' && !S.loading, vMore: S.tab === 'more' && !S.loading,
      skelOther: S.tab !== 'home' && (['portfolio', 'holdings'].includes(S.tab) ? busy : S.loading),
      navIdx: { home: 0, portfolio: 1, holdings: 1, docs: 2, services: 3, more: 4 }[S.tab],
      heroValue: this.fmt(value * (0.35 + 0.65 * S.cu)),
      rangeLabel: shownRange === 'All' ? 'all time' : shownRange, rangeLoading, asOf, benchName, sinceLbl: perf ? 'Since ' + perf.inceptionDate : '',
      growthNow: navNow.toFixed(hasRaw ? 4 : 2), navNow: navNow.toFixed(hasRaw ? 4 : 2),
      yTicks: axis.ticks, xDates,
      hasViews: !!S.hist && !S.hist.family,
      viewChips: [['nuvama', 'Nuvama'], ['orbis', 'Orbis (Legacy)'], ['consolidated', 'Combined']].map(([id, label]) => ({ label, active: S.dv === id, pick: () => this.applyView(id) })),
      tiles: [
        { label: 'TOTAL RETURNS', value: this.sfmt(totalReturns), color: c(totalReturns) },
        { label: 'RETURN (SI)', value: pct(perf && perf.returnsPercent), color: c(perf ? perf.returnsPercent : 0) },
        { label: '1Y RETURN', value: pct(P.y1), color: c(P.y1 || 0) },
        { label: 'CURRENT DRAWDOWN', value: pct(P.currentDD), color: red },
      ],
      perfHead: [
        ['RETURN (SI)', pct(perf && perf.returnsPercent), c(perf ? perf.returnsPercent : 0)],
        ['1Y RETURN', pct(P.y1), c(P.y1 || 0)],
        ['CURRENT DD', pct(P.currentDD), red],
        ['EXCESS (SI)', P.sinceInception != null && B.sinceInception != null ? pct(P.sinceInception - B.sinceInception) : '—', c((P.sinceInception || 0) - (B.sinceInception || 0))],
      ],
      linePath: p1.line, areaPath: p1.area, benchPath: p1.bench,
      // touch tooltips: growth charts show % change since the start of the window (series is rebased to 100)
      navTip: { kind: 'growth', dates, pts, bench, navs, bvals, growthBase, xy: p1.xy, bxy: p1.bxy, benchName },
      perfTip: { kind: 'growth', dates, pts, bench, navs, bvals, growthBase, xy: p2.xy, bxy: p2.bxy, benchName },
      ddTip: { kind: 'dd', dates: ddDates, pts: ddPts, bench: ddBench, navs: ddDates.map(d => (rawByDate[d] || [])[0]), bvals: ddDates.map(d => (rawByDate[d] || [])[1]), xy: p3.xy, bxy: p3.bxy, benchName },
      ddLine: p3.line, ddArea: p3.area, ddBench: p3.bench, hasDd: ddPts.length > 1, ddNow: ddPts.length ? ddPts[ddPts.length - 1] : 0,
      perfLine: p2.line, perfBench: p2.bench, hasBench: !!bench,
      ranges: ['1M', '6M', '1Y', '3Y', 'All'].map(id => ({ label: id, pick: () => this.pickRange(id), active: S.range === id, loading: rangeLoading && S.range === id })),
      tx3: cashTx.slice(0, 3).map(tx), txAll: cashTx.map(tx), hasTx: cashTx.length > 0,
      holdings: holdRows,
      holdSlices: holdRows.map(h => ({ id: h.id, pct: h.alloc, color: h.color, name: h.name })),
      holdCount: holdRows.length,
      flows: [
        { label: 'TOTAL CONTRIBUTIONS', value: this.fmt(flows.inflow), color: C.ink },
        { label: 'TOTAL WITHDRAWALS', value: this.fmt(flows.outflow), color: C.ink },
        { label: 'NET INVESTED', value: this.fmt(perf ? perf.amountInvested : 0), color: C.ink },
        { label: 'TOTAL RETURNS', value: this.sfmt(totalReturns), color: c(totalReturns) },
      ],
      // Detailed metrics (Portfolio)
      detOpen: S.det, toggleDet: () => set({ det: !S.det }),
      detHint: S.det ? '' : 'Trailing · drawdown · flows',
      trailing: trailingRows(perf),
      riskRows: [
        { k: 'MAX DRAWDOWN', v: pct(P.maxDD), vc: red, note: B.maxDD != null ? benchName + ' ' + pct(B.maxDD) : '' },
        { k: 'CURRENT DRAWDOWN', v: pct(P.currentDD), vc: red, note: B.currentDD != null ? benchName + ' ' + pct(B.currentDD) : '' },
      ],
      credItems: [],
      // Profit & Loss (Portfolio)
      pnlRows: S.pnlSeg === 0
        ? fy.m.map(a => ({ m: a[0], note: a[3] || 'Net of fees', v: this.sfmt(a[1]), p: spct(a[2]), color: c(a[1]), pcolor: c(a[2]) }))
        : qtr.map(q => ({ m: q.m, note: q.note, v: this.sfmt(q.v), p: spct(q.p), color: c(q.v), pcolor: c(q.p) })),
      pnlSegChips: ['MONTHLY', 'QUARTERLY'].map((l, i) => ({ label: l, pick: () => set({ pnlSeg: i }), active: S.pnlSeg === i })),
      fyLabel: fy.label.toUpperCase(), fyTotal: this.sfmt(fySum(fy)), fyColor: c(fySum(fy)), fyTotalPct: fy.tp != null ? spct(fy.tp) : '',
      pnlPills: fys.slice(0, 3).map(f => f.label).concat(fys.length > 3 ? ['All Years'] : []).map((lbl, i) => ({
        label: lbl, pick: () => set({ pnlFy: i, pnlOpen: null }), active: S.pnlFy === i,
      })),
      pnlFy: S.pnlFy, pnlIsYear, pnlIsAll: pnlIsAll && fys.length > 3, hasPnl: fys.length > 0,
      allYears: fys.map((f, i) => ({
        label: f.label, total: this.sfmt(fySum(f)), color: c(fySum(f)),
        open: S.pnlOpen === i, pick: () => set({ pnlOpen: S.pnlOpen === i ? null : i }),
        rows: f.m.map(a => ({ m: a[0], v: this.sfmt(a[1]), color: c(a[1]) })),
      })),
      impersonate: this.impersonate, exitImpersonation: this.exitImpersonation,
      user: S.user, isSuperAdmin: !!(S.user && S.user.isSuperAdmin), impersonated: !!(S.user && S.user.isImpersonated),
      page: S.page, openPage: k => { screen('page:' + k); set({ page: k }); }, closePage: () => set({ page: null }),
      acctOptions: (scope ? scope.accounts : []).map(a => ({ id: a.id, label: a.strategyPrefix ? a.strategyPrefix + ' · ' + a.id : a.id })),
      openReq: k => set({ sheet: k }),
      bumpRefresh: () => set(s => ({ rk: s.rk + 1 })),
      openAdd: () => set({ sheet: 'r-add' }), openWithdraw: () => set({ sheet: 'r-withdraw' }),
      openSwitchStrategy: () => set({ sheet: 'r-switch' }),
      // every strategy account in the current scope, with its current value (snapshot) for the switch form
      switchAccounts: (scope ? scope.accounts : []).filter(a => a.strategyPrefix && a.strategyPrefix !== 'QLF').map(a => ({
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
      openSwitch: () => set({ sheet: 'switch' }), closeSheet: () => set({ sheet: null, payRecover: null }),
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
          value: this.fmt(num(x.portfolioValue) || 0), pick: () => this.pickScope('a:' + x.id), active: S.acct === 'a:' + x.id,
        })),
      })),
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
    const upd = (i, f) => t => { const noms = OB.noms.map((n, j) => j === i ? { ...n, [f]: t } : n); setOb({ noms, nomErr: '' }); };

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
      const when = sub ? sub.toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : 'Just now';
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
      obOfflineMsg: 'You’re offline. Keep going — everything is kept on this device and saved the moment you’re back online.',
      obCreateError: SS && !SS.id && SS.createError && !SS.offline ? SS.createError : null,
      obRetrySave: () => store && store.kick(),
      obNotice: SS ? SS.notice : null,
      obDismissNotice: () => store && store.clearNotice(),
      obLocked: locked,
      obBegin: st === 'begin', obType: st === 'type', obIdentity: st === 'identity', obFin: st === 'fin',
      obNoms: st === 'noms', obFeeStep: st === 'fee', obQ: st === 'q', obResult: st === 'result',
      obDocsStep: st === 'docs', obReview: st === 'review', obTracker: st === 'tracker', obOpened: st === 'opened',
      obName: OB.name, obEmail: OB.email, obMobile: OB.mobile,
      onObName: t => setOb({ name: t, err: '' }),
      onObEmail: t => setOb({ email: t, err: '' }),
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
      obAddr: OB.addr, onObAddr: t => setOb({ addr: t, err: '' }),
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
      obDigioOffMsg: SS && SS.digio === 'disabled' ? 'Online verification isn’t switched on at ' + API_BASE.split('//').pop() + ' right now. Fill in your details below and upload documents on the Documents step — our team verifies them for you.' : null,
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
      obH2Name: OB.h2Name, onObH2Name: t => setOb({ h2Name: t, err: '' }),
      obH2Email: OB.h2Email, onObH2Email: t => setOb({ h2Email: t, err: '' }),
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
          { k: 'Name', v: OB.name || '—' },
          { k: 'Account', v: accountLabelFor(accountType) + (individual ? ' · ' + RES[OB.subRes] : '') },
          { k: 'Contact', v: (OB.mobile ? '+91 ' + OB.mobile : '') + (OB.email ? (OB.mobile ? ' · ' : '') + OB.email : '') || '—' },
        ] },
        { title: 'IDENTITY', edit: () => setOb({ step: 'identity' }), badge: verP && verP.verified ? 'VERIFIED VIA DIGILOCKER' : null, rows: [
          { k: 'PAN', v: (verP && verP.pan) || OB.pan || '—' },
          ...(verP && verP.aadhaar ? [{ k: 'Aadhaar', v: verP.aadhaar }] : []),
          { k: 'Date of birth', v: (verP && verP.dob) || OB.dob || '—' },
          { k: 'Holders', v: OB.h2 ? '2 · ' + ['Single', 'Jointly'][OB.mode] : '1' },
        ] },
        ...(verP && verP.bank ? [{ title: 'BANK', edit: () => setOb({ step: 'identity' }), badge: 'PENNY DROP VERIFIED', rows: [
          { k: 'Bank', v: (verP.bank.bankName || 'Bank') + ' · ' + maskAccount(verP.bank.accountNumber) },
          { k: 'Name on account', v: verP.bank.beneficiary || '—' },
        ] }] : []),
        { title: 'NOMINEES', edit: () => setOb({ step: 'noms' }), rows: OB.noms.length ? OB.noms.map(n => ({ k: n.name || 'Nominee', v: (n.rel || '—') + ' · ' + (parseInt(n.alloc, 10) || 0) + '%' })) : [{ k: OB.nomOptOut ? 'Opted out (SEBI declaration)' : 'None added', v: '—' }] },
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
      onObAmt: t => setOb({ amt: parseInt(t.replace(/\D/g, '') || '0', 10) }),
      obAmtFmt: this.fmt(OB.amt || 0),
      obFundConfirm: () => setOb({ fundDone: true }),
      obFinish: () => set({ ob: null, phase: 'login' }),
      obExitToLogin: () => set({ phase: 'login' }),
    };
  }

  render() {
    const V = this.vals();
    const U = {
      z: [0.92, 1, 1.08, 1.16][this.state.ts],
      hc: this.state.hc, rm: this.state.rm,
    };
    return (
      <UICtx.Provider value={U}>
        <View style={{ flex: 1, backgroundColor: this.state.phase === 'app' ? C.cream : '#001008' }}>
          <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
          {V.isSplash && <Splash V={V} />}
          {V.isCarousel && <Carousel V={V} />}
          {V.isLogin && <Login V={V} />}
          {V.isOtp && <OtpScreen V={V} />}
          {V.isSetPw && <SetPassword V={V} />}
          {V.isResume && <ResumeScreen V={V} />}
          {V.isOb && <Onboarding V={V} />}
          {V.isApp && <AppShell V={V} />}
          {V.lifting && <Curtain onDone={V.liftDone} rm={this.state.rm} />}
          {!!this.state.toast && (
            <View style={{ position: 'absolute', left: 0, right: 0, bottom: 110, alignItems: 'center', pointerEvents: 'none' }}>
              <View style={{ backgroundColor: 'rgba(0,32,23,0.92)', borderRadius: 999, paddingVertical: 10, paddingHorizontal: 18 }}>
                <Tx w={700} s={12} c={C.cream}>{this.state.toast}</Tx>
              </View>
            </View>
          )}
        </View>
      </UICtx.Provider>
    );
  }
}
