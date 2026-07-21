// myQode Curtain v2 — root stateful component. The state machine and computed
// values ("vals") are ported from the design's DCLogic class, adapted for
// React Native (text handlers instead of DOM events, active flags instead of
// inline CSS strings).
import React from 'react';
import { View, StatusBar } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { C, UICtx } from './ui';
import {
  ACCTS, FAMILY, SERIES, RANGE_T, TX, FYS, QUARTER_LABELS, HOLD, METHODS,
  RISK_ROWS, CRED_ITEMS, DOCS, DOC_CATS, DOC_QUICK,
  QS, TYPES, FEES, RES, DOC_META, DOC_FILE, TRACK,
} from './data';
import Splash from './screens/splash';
import Carousel from './screens/carousel';
import { Login, OtpScreen } from './screens/login';
import Onboarding from './screens/onboarding';
import AppShell from './screens/appshell';
import Curtain from './screens/curtain';

export default class MyQode extends React.Component {
  state = {
    phase: 'splash', tab: 'home', sheet: null, acct: 0, range: '1Y', hide: false,
    amt: 500000, method: 0, success: null, otp: ['', '', '', '', '', ''],
    email: '', pw: '', loading: false, lifting: false, cu: 1, ob: null, car: 0,
    ts: 1, hc: false, rm: false,
    pnlFy: 0, pnlOpen: null, pnlSeg: 0, docQ: '', docCat: 0, det: false, cred: null,
  };

  go(t) {
    if (this.state.tab === t) return;
    clearTimeout(this.goT);
    this.setState({ tab: t, loading: true });
    this.goT = setTimeout(() => this.setState({ loading: false }), 380);
  }

  obDefault() {
    return {
      step: 'begin', name: '', email: '', mobile: '', dob: '', addr: '', otp: ['', '', '', '', '', ''], err: '',
      type: 0, subRes: 0, pw: '', res: 0, gender: 0, marital: 0, mobBel: 0, emailBel: 0, pep: 1,
      occ: 1, src: 1, income: 2, edu: 2, h2: false, h2Name: '', mode: 0,
      noms: [{ name: '', rel: '', mob: '', alloc: '100', minor: false, guardian: '' }], nomErr: '',
      fee: 0, qi: 0, ans: [null, null, null, null, null, null],
      docs: { pan: 'done', af: 'pending', ab: 'error', cheque: 'pending' },
      copied: false, fundOpen: false, fundDone: false, amt: 5000000,
    };
  }
  setOb(p) { this.setState({ ob: { ...this.state.ob, ...p } }); }
  chips(list, cur, on) {
    return list.map((l, i) => ({ label: l, pick: () => on(i), active: cur === i }));
  }

  componentDidMount() {
    this.otpRefs = [0, 1, 2, 3, 4, 5].map(() => React.createRef());
    this.obRefs = [0, 1, 2, 3, 4, 5].map(() => React.createRef());
    this.splashT = setTimeout(() => {
      if (this.state.phase === 'splash') this.setState({ phase: 'carousel' });
    }, 1500);
  }
  componentWillUnmount() {
    clearTimeout(this.splashT); clearTimeout(this.goT);
    if (this.raf) cancelAnimationFrame(this.raf);
  }

  fmt(v) { return '₹' + v.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  fmt0(v) { return '₹' + v.toLocaleString('en-IN'); }
  sfmt(v) { return (v < 0 ? '−' : '+') + this.fmt(Math.abs(v)); }
  hidden() { return this.state.hide; }

  startApp = () => {
    const first = !this.counted; this.counted = true;
    this.setState({ phase: 'app', tab: 'home', lifting: true, loading: true, cu: first ? 0 : 1 });
    setTimeout(() => this.setState({ loading: false }), 950);
    if (!first) return;
    const t0 = Date.now(), D = 400;
    const step = () => {
      const p = Math.min((Date.now() - t0) / D, 1), e = 1 - Math.pow(1 - p, 3);
      this.setState({ cu: e });
      if (p < 1) this.raf = requestAnimationFrame(step);
    };
    this.raf = requestAnimationFrame(step);
  };

  paths(pts, bench, w, h) {
    const all = pts.concat(bench), min = Math.min(...all), max = Math.max(...all), pad = 8;
    const xy = a => a.map((v, i) => [(i / (a.length - 1)) * w, pad + (1 - (v - min) / (max - min)) * (h - 2 * pad)]);
    const ln = a => 'M' + xy(a).map(p => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join('L');
    return { line: ln(pts), area: ln(pts) + `L${w},${h}L0,${h}Z`, bench: ln(bench) };
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
    const acct = S.acct === -1 ? FAMILY : ACCTS[S.acct];
    const k = acct.value / ACCTS[0].value, sc = v => Math.round(v * k);
    const pts = SERIES[S.range];
    const bench = pts.map((v, i) => pts[0] + (v - pts[0]) * 0.68 + Math.sin(i * 1.7) * (pts[pts.length - 1] - pts[0]) * 0.03);
    const p1 = this.paths(pts, bench, 330, 120);
    const p2 = this.paths(pts, bench, 358, 110);
    const green = C.green, red = C.red;
    const c = v => (v < 0 ? red : green);
    const tx = t => ({
      title: t.title,
      sub: t.st === 'PROCESSING' ? t.sub + ' · Expected 18 Jul 2026' : t.sub,
      amt: this.sfmt(sc(t.v)), color: c(t.v), status: t.st,
      stColor: t.st === 'PROCESSING' ? C.muted : C.green,
    });
    const txSorted = TX.slice().sort((a, b) => (b.st === 'PROCESSING') - (a.st === 'PROCESSING'));
    const heroFull = acct.value * (0.35 + 0.65 * S.cu);
    const amtStr = S.amt ? S.amt.toLocaleString('en-IN') : '';
    const isW = S.sheet === 'withdraw';
    const summary = (vs) => {
      const [pp, bp] = RANGE_T[S.range], lbl = S.range === 'All' ? 'since inception' : 'over ' + S.range;
      return 'Up ' + pp.toFixed(1) + '% ' + lbl + (vs ? ' vs ' : ' · ') + 'Nifty 50 up ' + bp.toFixed(1) + '%';
    };
    // Profit & Loss
    const spct = p => (p < 0 ? '−' : '+') + Math.abs(p).toFixed(2) + '%';
    const fySum = f => f.m.reduce((s, x) => s + x[1], 0);
    const fy = FYS[Math.min(S.pnlFy, 2)];
    const chron = fy.m.slice().reverse(), qtr = [];
    for (let i = 0; i < chron.length; i += 3) {
      const ch = chron.slice(i, i + 3), qi = Math.floor(i / 3);
      qtr.push({
        m: QUARTER_LABELS[qi][0] + ' ' + fy.label,
        note: QUARTER_LABELS[qi][1] + (ch.length < 3 ? ' · month to date' : ''),
        v: ch.reduce((s, x) => s + x[1], 0), p: ch.reduce((s, x) => s + x[2], 0),
      });
    }
    qtr.reverse();
    // Notifications / pending transfer
    const hasPending = S.acct === 0 || S.acct === -1;
    const notifs = hasPending ? [
      { title: 'Withdrawal processing', sub: '₹7,50,000 to HDFC ••4021 · Expected 18 Jul 2026', pick: () => { this.setState({ sheet: null }); this.go('services'); } },
      { title: 'Your June statement is ready', sub: 'Monthly statement · 05 Jul 2026', pick: () => { this.setState({ sheet: null }); this.go('docs'); } },
    ] : [];
    return {
      isSplash: S.phase === 'splash', isLogin: S.phase === 'login', isOtp: S.phase === 'otp', isApp: S.phase === 'app',
      isCarousel: S.phase === 'carousel',
      carIdx: S.car,
      carNext: () => set({ car: Math.min(S.car + 1, 2) }), carPrev: () => set({ car: Math.max(S.car - 1, 0) }),
      carSkip: () => set({ phase: 'login' }), carDone: () => set({ phase: 'login' }),
      carProg: (S.car + 1) / 3, carHasPrev: S.car > 0, carLast: S.car === 2,
      email: S.email, pw: S.pw, onEmail: t => set({ email: t }), onPw: t => set({ pw: t }),
      doLogin: () => set({ phase: 'otp' }),
      otpBoxes: S.otp.map((v, i) => ({
        val: v, ref: this.otpRefs ? this.otpRefs[i] : null,
        change: t => this.setState({ otp: this.otpBoxSet(S.otp, this.otpRefs, i, t, this.startApp) }),
        back: () => { if (!S.otp[i] && i > 0 && this.otpRefs[i - 1].current) this.otpRefs[i - 1].current.focus(); },
      })),
      startApp: this.startApp,
      lifting: S.lifting, liftDone: () => set({ lifting: false }),
      loading: S.loading, ready: !S.loading,
      refresh: () => { set({ loading: true }); setTimeout(() => set({ loading: false }), 600); },
      doLogout: () => set({ phase: 'login', otp: ['', '', '', '', '', ''], tab: 'home', acct: 0 }),
      acctName: acct.name, acctInitials: acct.initials, acctCode: acct.code,
      isFamily: S.acct === -1,
      multiAcct: true,
      hideOn: this.hidden(),
      toggleHide: () => set({ hide: !this.hidden() }),
      // notifications
      needsYou: hasPending && !S.loading,
      needsYouMsg: 'Withdrawal of ₹7,50,000 processing · expected 18 Jul',
      hasNotif: notifs.length > 0, openNotifs: () => set({ sheet: 'notifs' }),
      sheetNotifs: S.sheet === 'notifs', notifEmpty: notifs.length === 0, notifHas: notifs.length > 0,
      notifList: notifs,
      svcPending: hasPending, svcNone: !hasPending,
      svcPendingSub: 'Withdrawal of ₹7,50,000 · Expected 18 Jul 2026',
      tab: S.tab,
      isHome: S.tab === 'home', isPortfolio: S.tab === 'portfolio', isHoldings: S.tab === 'holdings',
      isDocs: S.tab === 'docs', isServices: S.tab === 'services', isMore: S.tab === 'more',
      goHome: () => this.go('home'), goPortfolio: () => this.go('portfolio'),
      isPfGroup: S.tab === 'portfolio' || S.tab === 'holdings',
      segPerf: () => this.go('portfolio'), segHold: () => this.go('holdings'),
      goDocs: () => this.go('docs'), goServices: () => this.go('services'), goMore: () => this.go('more'),
      vPortfolio: S.tab === 'portfolio' && !S.loading, vHoldings: S.tab === 'holdings' && !S.loading,
      vDocs: S.tab === 'docs' && !S.loading, vServices: S.tab === 'services' && !S.loading, vMore: S.tab === 'more' && !S.loading,
      skelOther: S.loading && S.tab !== 'home',
      navIdx: { home: 0, portfolio: 1, holdings: 1, docs: 2, services: 3, more: 4 }[S.tab],
      heroValue: this.fmt(heroFull),
      dayChange: this.sfmt(sc(86420)) + ' (+0.47%)',
      growthNow: this.fmt(sc(15377000)),
      tiles: [
        { label: 'TOTAL RETURNS', value: this.sfmt(acct.value - acct.invested), color: green },
        { label: 'XIRR (SI)', value: '+24.3%', color: green },
        { label: '1Y RETURN', value: '+21.4%', color: green },
        { label: 'CURRENT DRAWDOWN', value: '−' + Math.abs(acct.dd).toFixed(2) + '%', color: red },
      ],
      linePath: p1.line, areaPath: p1.area, benchPath: p1.bench,
      perfLine: p2.line, perfBench: p2.bench,
      ranges: ['1M', '6M', '1Y', '3Y', 'All'].map(id => ({ label: id, pick: () => set({ range: id }), active: S.range === id })),
      navSummary: summary(false),
      perfSummary: summary(true),
      tx3: txSorted.slice(0, 3).map(tx), txAll: txSorted.map(tx),
      holdings: HOLD.map(h => ({
        name: h.name, tag: h.tag, alloc: h.alloc + '%', color: h.color,
        value: this.fmt(Math.round(acct.value * h.alloc / 100)),
        gain: '+' + h.gain.toFixed(1) + '% SI',
        xirr: h.xirr, mdd: h.mdd, hasM: h.hasM,
      })),
      flows: [
        { label: 'REALISED GAIN', value: this.sfmt(sc(984120)), color: green },
        { label: 'DIVIDENDS RECEIVED (SI)', value: this.sfmt(sc(112400)), color: green },
        { label: 'TOTAL WITHDRAWALS', value: this.fmt(sc(800000)), color: C.ink },
        { label: 'NET CONTRIBUTIONS', value: this.fmt(sc(11800000)), color: C.ink },
      ],
      // Detailed metrics (Portfolio)
      detOpen: S.det, toggleDet: () => set({ det: !S.det }),
      detHint: S.det ? '' : 'Trailing · risk · credibility',
      riskRows: RISK_ROWS.map(r => ({ ...r, vc: r.down ? red : r.up ? green : C.ink })),
      credItems: CRED_ITEMS.map((m, i) => ({
        label: m[0], value: m[1], def: m[2],
        open: S.cred === i, pick: () => set({ cred: S.cred === i ? null : i }),
      })),
      // Profit & Loss (Portfolio)
      pnlRows: S.pnlSeg === 0
        ? fy.m.map(a => ({ m: a[0], note: a[3] || 'Net of fees', v: this.sfmt(sc(a[1])), p: spct(a[2]), color: c(a[1]) }))
        : qtr.map(q => ({ m: q.m, note: q.note, v: this.sfmt(sc(q.v)), p: spct(q.p), color: c(q.v) })),
      pnlSegChips: ['MONTHLY', 'QUARTERLY'].map((l, i) => ({ label: l, pick: () => set({ pnlSeg: i }), active: S.pnlSeg === i })),
      fyLabel: fy.label.toUpperCase(), fyTotal: this.sfmt(sc(fySum(fy))), fyColor: c(fySum(fy)),
      pnlPills: FYS.map(f => f.label).concat('All Years').map((lbl, i) => ({
        label: lbl, pick: () => set({ pnlFy: i, pnlOpen: null }), active: S.pnlFy === i,
      })),
      pnlFy: S.pnlFy, pnlIsYear: S.pnlFy < 3, pnlIsAll: S.pnlFy === 3,
      allYears: FYS.map((f, i) => ({
        label: f.label, total: this.sfmt(sc(fySum(f))), color: c(fySum(f)),
        open: S.pnlOpen === i, pick: () => set({ pnlOpen: S.pnlOpen === i ? null : i }),
        rows: f.m.map(a => ({ m: a[0], v: this.sfmt(sc(a[1])), color: c(a[1]) })),
      })),
      ...this.docVals(),
      moreItems: [
        { title: 'Update bank & personal details', pick: () => {} },
        { title: 'Family accounts', pick: () => set({ sheet: 'switch' }) },
        { title: 'Display & accessibility', pick: () => set({ sheet: 'settings' }) },
        { title: 'Profile & KYC', pick: () => {} },
        { title: 'Risk profile', pick: () => {} },
        { title: 'Statement preferences', pick: () => {} },
        { title: 'Security & biometrics', pick: () => {} },
      ],
      sheetSettings: S.sheet === 'settings',
      tsChips: this.chips(['S', 'M', 'L', 'XL'], S.ts, i => set({ ts: i })),
      hcOn: S.hc, rmOn: S.rm,
      hcToggle: () => set({ hc: !S.hc }), rmToggle: () => set({ rm: !S.rm }),
      sheetOpen: !!S.sheet, sheetMoney: S.sheet === 'add' || S.sheet === 'withdraw', sheetSwitch: S.sheet === 'switch',
      sheetTitle: isW ? 'Withdraw Funds' : 'Add Funds',
      sheetSub: (isW ? 'Withdrawal from ' : 'Additional contribution to ') + acct.code,
      sheetNote: isW
        ? 'Proceeds are credited to HDFC ••4021 by 19 Jul 2026 (T+3 business days), subject to exit terms of your PMS agreement.'
        : 'Funds received before 2:00 PM IST are invested at the next available NAV. Contributions are subject to the terms of your PMS agreement.',
      sheetCta: (isW ? 'REQUEST WITHDRAWAL OF ' : 'CONTINUE TO PAY ') + this.fmt(S.amt || 0),
      openAdd: () => set({ sheet: 'add' }), openWithdraw: () => set({ sheet: 'withdraw' }),
      openSwitch: () => set({ sheet: 'switch' }), closeSheet: () => set({ sheet: null }),
      amtStr, onAmt: t => set({ amt: parseInt(t.replace(/\D/g, '') || '0', 10) }),
      amtChips: [100000, 500000, 1000000].map(v => ({ label: '+' + this.fmt0(v), pick: () => set({ amt: (S.amt || 0) + v }) })),
      methods: METHODS.map((m, i) => ({ label: m, pick: () => set({ method: i }), active: S.method === i })),
      confirmMoney: () => set({ sheet: null, success: { w: isW, amt: this.fmt(S.amt || 0), method: METHODS[S.method], acct: acct.name } }),
      acctList: ACCTS.map((a, i) => ({
        name: a.name, code: a.code, role: a.role, crown: a.crown, initials: a.initials,
        value: this.fmt(a.value), pick: () => set({ acct: i, sheet: null }), active: S.acct === i,
      })),
      pickFamily: () => set({ acct: -1, sheet: null }),
      famActive: S.acct === -1,
      familyTotal: this.fmt(FAMILY.value),
      isSuccess: !!S.success,
      successTitle: S.success && S.success.w ? 'Request Received' : 'Payment Successful',
      successAmt: S.success ? S.success.amt : '', successMethod: S.success ? S.success.method : '',
      successAcct: S.success ? S.success.acct : '',
      successNote: S.success && S.success.w
        ? 'Proceeds will be credited to HDFC ••4021 within T+3 business days. A confirmation has been sent to your registered email.'
        : 'Units will be allotted at the NAV of 15 Jul 2026. A confirmation has been sent to your registered email.',
      doneSuccess: () => set({ success: null, tab: 'home' }),
      ...this.obVals(),
    };
  }

  docVals() {
    const S = this.state, set = p => this.setState(p);
    const q = S.docQ.trim().toLowerCase();
    const filt = DOCS.filter(d => (S.docCat === 0 || d.cat === DOC_CATS[S.docCat]) && (!q || d.name.toLowerCase().includes(q)));
    return {
      docQuick: DOC_QUICK,
      docPills: DOC_CATS.map((lbl, i) => ({ label: lbl, pick: () => set({ docCat: i }), active: S.docCat === i })),
      docGroups: DOC_CATS.slice(1).map(cat => ({ title: cat.toUpperCase(), items: filt.filter(d => d.cat === cat) })).filter(g => g.items.length),
      docEmpty: filt.length === 0,
      docEmptyMsg: 'No documents match ‘' + S.docQ.trim() + '’. Try a different term or browse by category.',
      docQ: S.docQ, onDocQ: t => set({ docQ: t }),
    };
  }

  obVals() {
    const S = this.state, set = p => this.setState(p);
    const OB = S.ob || this.obDefault();
    const setOb = p => this.setOb(p);
    const st = OB.step;
    const TITLES = {
      begin: ['Begin your journey', 'STEP 1 OF 8 · DETAILS'],
      otp: ['Verify your mobile', 'STEP 1 OF 8 · DETAILS'],
      type: ['Choose your account', 'STEP 1 OF 8 · DETAILS'],
      identity: ['Identity details', 'STEP 2 OF 8 · IDENTITY'],
      q: [QS[OB.qi].q, 'STEP 3 OF 8 · QUESTION ' + (OB.qi + 1) + ' OF 6'],
      result: ['Your risk profile', 'STEP 3 OF 8 · RISK'],
      fee: ['Fees, stated plainly', 'STEP 4 OF 8 · FEES'],
      fin: ['Financial profile', 'STEP 5 OF 8 · FINANCIAL PROFILE'],
      noms: ['Nominees', 'STEP 6 OF 8 · NOMINEES · OPTIONAL'],
      docs: ['Documents', 'STEP 7 OF 8 · DOCUMENTS'],
      review: ['Review & submit', 'STEP 8 OF 8 · REVIEW'],
      tracker: ['Your journey is underway', 'APPLICATION QD-2026-08921'],
      opened: ['Your account is open, ' + ((OB.name || 'Rohan').split(' ')[0]), 'WELCOME TO QODE'],
    };
    const PROG = { begin: 0.04, otp: 0.08, type: 0.125, identity: 0.25, q: 0.3 + OB.qi * 0.018, result: 0.42, fee: 0.5, fin: 0.625, noms: 0.75, docs: 0.875, review: 0.96, tracker: 1, opened: 1 };
    const BACK = { otp: 'begin', type: 'otp', identity: 'type', result: 'q', fee: 'result', fin: 'fee', noms: 'fin', docs: 'noms', review: 'docs' };
    const pwScore = (OB.pw.length >= 8 ? 1 : 0) + (/[A-Z]/.test(OB.pw) ? 1 : 0) + (/[0-9]/.test(OB.pw) ? 1 : 0) + (/[^A-Za-z0-9]/.test(OB.pw) ? 1 : 0);
    const segColor = i => i >= pwScore ? 'rgba(55,88,79,0.18)' : (pwScore <= 1 ? C.red : pwScore <= 3 ? C.gold : C.green);
    const allocSum = OB.noms.reduce((s, n) => s + (parseInt(n.alloc, 10) || 0), 0);
    const upd = (i, f) => t => { const noms = OB.noms.map((n, j) => j === i ? { ...n, [f]: t } : n); setOb({ noms, nomErr: '' }); };
    return {
      isOb: S.phase === 'ob',
      startOb: () => set({ phase: 'ob', ob: this.obDefault() }),
      obStep: st,
      obTitle: TITLES[st] ? TITLES[st][0] : '', obStepLabel: TITLES[st] ? TITLES[st][1] : '',
      obTitleSize: st === 'q' ? 22 : 26,
      obTall: st === 'tracker' || st === 'opened',
      obProg: PROG[st] ?? 0,
      obShowBack: st !== 'tracker' && st !== 'opened',
      obBack: () => {
        if (st === 'begin') { set({ phase: 'login' }); return; }
        if (st === 'q') { OB.qi > 0 ? setOb({ qi: OB.qi - 1 }) : setOb({ step: 'identity' }); return; }
        setOb({ step: BACK[st] || 'begin' });
      },
      obSaveExit: () => set({ phase: 'login' }),
      obBegin: st === 'begin', obOtpStep: st === 'otp', obType: st === 'type', obIdentity: st === 'identity', obFin: st === 'fin',
      obNoms: st === 'noms', obFeeStep: st === 'fee', obQ: st === 'q', obResult: st === 'result',
      obDocsStep: st === 'docs', obReview: st === 'review', obTracker: st === 'tracker', obOpened: st === 'opened',
      obName: OB.name, obEmail: OB.email, obMobile: OB.mobile,
      onObName: t => setOb({ name: t, err: '' }),
      onObEmail: t => setOb({ email: t, err: '' }),
      onObMobile: t => setOb({ mobile: t.replace(/\D/g, '').slice(0, 10), err: '' }),
      obHasErr: !!OB.err, obErr: OB.err,
      obBeginNext: () => {
        if (!OB.name.trim()) return setOb({ err: 'Please add your name so we know what to call you.' });
        if (!/.+@.+\..+/.test(OB.email)) return setOb({ err: 'That email doesn’t look complete — mind checking it?' });
        if (OB.mobile.length !== 10) return setOb({ err: 'Your mobile number should be 10 digits.' });
        setOb({ step: 'otp', err: '' });
      },
      obMobileMask: OB.mobile ? '•••••' + OB.mobile.slice(5) : '•••••98801',
      obOtpBoxes: OB.otp.map((v, i) => ({
        val: v, ref: this.obRefs ? this.obRefs[i] : null,
        change: t => this.setOb({ otp: this.otpBoxSet(OB.otp, this.obRefs, i, t, () => this.setOb({ step: 'type' })) }),
        back: () => { if (!OB.otp[i] && i > 0 && this.obRefs[i - 1].current) this.obRefs[i - 1].current.focus(); },
      })),
      obOtpNext: () => setOb({ step: 'type' }),
      obEditNum: () => setOb({ step: 'begin' }),
      obTypes: TYPES.map((t, i) => ({
        name: t.name, sub: t.sub, pick: () => setOb({ type: i }),
        active: OB.type === i, showRes: i === 0 && OB.type === 0,
      })),
      obResChips: this.chips(RES, OB.subRes, i => setOb({ subRes: i })),
      obPw: OB.pw, onObPw: t => setOb({ pw: t }),
      obSegs: [segColor(0), segColor(1), segColor(2), segColor(3)],
      obPwLabel: OB.pw ? (pwScore <= 1 ? 'WEAK' : pwScore <= 3 ? 'FAIR' : 'STRONG') : '',
      obTypeNext: () => setOb({ step: 'identity' }),
      obResidency: this.chips(['RESIDENT', 'NRI / OCI / PIO'], OB.res, i => setOb({ res: i })),
      obGender: this.chips(['Female', 'Male', 'Other'], OB.gender, i => setOb({ gender: i })),
      obMarital: this.chips(['Single', 'Married', 'Other'], OB.marital, i => setOb({ marital: i })),
      obMobBelongs: this.chips(['Self', 'Spouse'], OB.mobBel, i => setOb({ mobBel: i })),
      obEmailBelongs: this.chips(['Self', 'Spouse'], OB.emailBel, i => setOb({ emailBel: i })),
      obPep: this.chips(['Yes', 'No'], OB.pep, i => setOb({ pep: i })),
      obOcc: this.chips(['Salaried', 'Business', 'Professional', 'Retired'], OB.occ, i => setOb({ occ: i })),
      obSrc: this.chips(['Salary', 'Business income', 'Investments', 'Inheritance'], OB.src, i => setOb({ src: i })),
      obIncome: this.chips(['Under ₹25 L', '₹25 L – 1 Cr', '₹1 – 5 Cr', 'Over ₹5 Cr'], OB.income, i => setOb({ income: i })),
      obEdu: this.chips(['Graduate', 'Post-graduate', 'Professional', 'Other'], OB.edu, i => setOb({ edu: i })),
      obDob: OB.dob, onObDob: t => setOb({ dob: t }),
      obAddr: OB.addr, onObAddr: t => setOb({ addr: t }),
      obNoH2: !OB.h2, obH2: OB.h2, obAddH2: () => setOb({ h2: true }), obRemoveH2: () => setOb({ h2: false }),
      obH2Name: OB.h2Name, onObH2Name: t => setOb({ h2Name: t }),
      obMode: this.chips(['Single', 'Jointly'], OB.mode, i => setOb({ mode: i })),
      obIdentityNext: () => setOb({ step: 'q', qi: 0 }),
      obFinNext: () => setOb({ step: 'noms' }),
      obNomList: OB.noms.map((n, i) => ({
        n: i + 1, name: n.name, rel: n.rel, mob: n.mob, alloc: n.alloc, guardian: n.guardian,
        onName: upd(i, 'name'), onRel: upd(i, 'rel'), onMob: upd(i, 'mob'), onAlloc: upd(i, 'alloc'), onGuardian: upd(i, 'guardian'),
        isMinor: n.minor,
        toggleMinor: () => setOb({ noms: OB.noms.map((x, j) => j === i ? { ...x, minor: !x.minor } : x) }),
        remove: () => setOb({ noms: OB.noms.filter((x, j) => j !== i), nomErr: '' }),
      })),
      obCanAddNom: OB.noms.length < 3,
      obAddNom: () => setOb({ noms: OB.noms.concat({ name: '', rel: '', mob: '', alloc: '0', minor: false, guardian: '' }) }),
      obNomErr: !!OB.nomErr, obNomErrMsg: OB.nomErr,
      obNomsNext: () => {
        if (OB.noms.length && allocSum !== 100) return setOb({ nomErr: 'Allocations should add up to 100%. They’re at ' + allocSum + '% now.' });
        setOb({ step: 'docs', nomErr: '' });
      },
      obOptOut: () => setOb({ noms: [], step: 'docs', nomErr: '' }),
      obSkipNoms: () => setOb({ step: 'docs', nomErr: '' }),
      obFees: FEES.map((f, i) => ({ name: f.name, sub: f.sub, pick: () => setOb({ fee: i }), active: OB.fee === i })),
      obFeeNext: () => setOb({ step: 'fin' }),
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
      obDocRows: ['pan', 'af', 'ab', 'cheque'].map(kk => ({
        label: DOC_META[kk], file: DOC_FILE[kk] + ' · Uploaded',
        err: 'Image was blurry — please retake in good light.',
        isDone: OB.docs[kk] === 'done', isErr: OB.docs[kk] === 'error', isPend: OB.docs[kk] === 'pending',
        act: () => setOb({ docs: { ...OB.docs, [kk]: 'done' } }),
      })),
      obIsNri: OB.res === 1 || OB.subRes > 0,
      obDocsNext: () => setOb({ step: 'review' }),
      obReviewGroups: [
        { title: 'DETAILS', edit: () => setOb({ step: 'begin' }), rows: [{ k: 'Name', v: OB.name || 'Rohan Mehta' }, { k: 'Account', v: TYPES[OB.type].name + (OB.type === 0 ? ' · ' + RES[OB.subRes] : '') }] },
        { title: 'IDENTITY', edit: () => setOb({ step: 'identity' }), rows: [{ k: 'Residency', v: OB.res === 0 ? 'Resident' : 'NRI / OCI / PIO' }, { k: 'Holders', v: OB.h2 ? '2 · ' + ['Single', 'Jointly'][OB.mode] : '1' }] },
        { title: 'NOMINEES', edit: () => setOb({ step: 'noms' }), rows: OB.noms.length ? OB.noms.map(n => ({ k: n.name || 'Nominee', v: (n.rel || '—') + ' · ' + (parseInt(n.alloc, 10) || 0) + '%' })) : [{ k: 'None added', v: '—' }] },
        { title: 'RISK & FEE', edit: () => setOb({ step: 'fee' }), rows: [{ k: 'Fee structure', v: FEES[OB.fee].name }, { k: 'Risk profile', v: 'Moderate-Aggressive' }] },
        { title: 'DOCUMENTS', edit: () => setOb({ step: 'docs' }), rows: [{ k: 'Uploaded', v: Object.values(OB.docs).filter(x => x === 'done').length + ' of 4' }] },
      ],
      obSubmit: () => setOb({ step: 'tracker' }),
      obTrack: TRACK.map((t, i, arr) => ({
        title: t.title, sub: t.sub,
        done: t.state === 'done', active: t.state === 'active', pending: t.state === 'pending',
        titleColor: t.state === 'pending' ? C.muted : C.ink,
        notLast: i < arr.length - 1,
        railColor: t.state === 'done' ? C.green : (t.state === 'active' ? C.gold : 'rgba(55,88,79,0.25)'),
      })),
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
      obFinish: () => { this.setState({ ob: null }); this.startApp(); },
    };
  }

  render() {
    const V = this.vals();
    const U = {
      z: [0.92, 1, 1.08, 1.16][this.state.ts],
      hc: this.state.hc, rm: this.state.rm, hidden: this.hidden(),
    };
    return (
      <UICtx.Provider value={U}>
        <View style={{ flex: 1, backgroundColor: this.state.phase === 'app' ? C.cream : '#001008' }}>
          <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
          {V.isSplash && <Splash V={V} />}
          {V.isCarousel && <Carousel V={V} />}
          {V.isLogin && <Login V={V} />}
          {V.isOtp && <OtpScreen V={V} />}
          {V.isOb && <Onboarding V={V} />}
          {V.isApp && <AppShell V={V} />}
          {V.lifting && <Curtain onDone={V.liftDone} rm={this.state.rm} />}
        </View>
      </UICtx.Provider>
    );
  }
}
