// Offline demo data shaped exactly like the /api/mobile/portfolio/* responses,
// so the demo runs through the same code path as a real login.
const STRAT = {
  QAW: { name: 'Qode All Weather', color: '#008455', bench: 'NIFTY 50', cagr: 0.135, sd: 0.0048 },
  QGF: { name: 'Qode Growth Fund', color: '#0A3452', bench: 'NIFTY SMLCAP 250', cagr: 0.21, sd: 0.0085 },
  QTF: { name: 'Qode Tactical Fund', color: '#550E0E', bench: 'NIFTY MIDCAP 150', cagr: 0.155, sd: 0.006 },
  QLF: { name: 'Qode Liquid Fund', color: '#0E6B6B', bench: 'NIFTY 50', cagr: 0.075, sd: 0.0004 },
};
const BENCH = { 'NIFTY 50': [0.105, 0.0068], 'NIFTY SMLCAP 250': [0.17, 0.0095], 'NIFTY MIDCAP 150': [0.14, 0.0082] };

const OWNERS = [
  { id: 'OWN1001', name: 'Rohan Mehta', head: true, accts: [['QAW0412', 'QAW', 7565443], ['QGF0412', 'QGF', 5720213], ['QTF0412', 'QTF', 3321414], ['QLF0412', 'QLF', 1845230]] },
  { id: 'OWN1002', name: 'Anjali Mehta', head: false, accts: [['QAW0468', 'QAW', 5000000], ['QGF0468', 'QGF', 4210450]] },
  { id: 'OWN1003', name: 'Mehta Family Trust', head: false, accts: [['QAW0561', 'QAW', 20000000], ['QTF0561', 'QTF', 14108880]] },
];
const GROUP = 'GRP1001';
const DAY = 86400000;
const START = Date.UTC(2023, 6, 1), END = Date.UTC(2026, 6, 14);
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const fmtDate = t => { const d = new Date(t); return String(d.getUTCDate()).padStart(2, '0') + ' ' + MON[d.getUTCMonth()] + ' ' + d.getUTCFullYear(); };
const isoDate = t => new Date(t).toISOString().slice(0, 10);

function rng(seed) {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) { h = Math.imul(h ^ seed.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
  let a = h >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const gauss = r => Math.sqrt(-2 * Math.log(r() || 1e-9)) * Math.cos(2 * Math.PI * r());

// Brownian bridge: noisy path that ends exactly at the target CAGR.
function walk(seed, cagr, sd) {
  const r = rng(seed), n = Math.round((END - START) / DAY) + 1;
  const w = [0];
  for (let i = 1; i < n; i++) w.push(w[i - 1] + sd * gauss(r));
  const total = Math.log(Math.pow(1 + cagr, (n - 1) / 365.25));
  return w.map((v, i) => 100 * Math.exp((i / (n - 1)) * total + v - (i / (n - 1)) * w[n - 1]));
}

const allAccts = OWNERS.flatMap(o => o.accts.map(([id, p, v]) => ({ id, p, v, owner: o })));
function members(id) {
  if (id === GROUP) return allAccts;
  const o = OWNERS.find(x => x.id === id);
  return o ? allAccts.filter(a => a.owner === o) : allAccts.filter(a => a.id === id);
}

const cache = {};
function model(id) {
  if (cache[id]) return cache[id];
  const ms = members(id);
  if (!ms.length) throw Object.assign(new Error('No data found'), { status: 404 });
  const target = ms.reduce((s, a) => s + a.v, 0);
  const single = ms.length === 1 ? ms[0] : null;
  const prefix = single ? single.p : 'QAW';
  const S = STRAT[prefix];
  // scopes with several strategies blend their drift/vol
  const mu = ms.reduce((s, a) => s + STRAT[a.p].cagr * a.v, 0) / target;
  const sd = ms.reduce((s, a) => s + STRAT[a.p].sd * a.v, 0) / target;
  const nav = walk(id, mu, sd * (single ? 0.6 : 0.35));
  const benchName = single ? S.bench : 'NIFTY 50';
  const bench = walk(benchName, BENCH[benchName][0], BENCH[benchName][1] * 0.6);
  const n = nav.length;
  const dayOf = i => START + i * DAY;
  const idxOf = t => Math.max(0, Math.min(n - 1, Math.round((t - START) / DAY)));
  // contributions every ~7 months, one partial withdrawal
  const flowsRaw = [];
  [0, 210, 420, 640, 860].forEach((d, k) => flowsRaw.push({ i: Math.min(d, n - 1), a: k === 0 ? 1 : 0.22 }));
  flowsRaw.push({ i: 760, a: -0.08 });
  flowsRaw.sort((x, y) => x.i - y.i);
  const units0 = flowsRaw.reduce((s, f) => s + f.a / nav[f.i], 0);
  const k = target / (units0 * nav[n - 1]);
  const flows = flowsRaw.map(f => ({ i: f.i, amount: f.a * k }));
  const cum = new Array(n).fill(0);
  { let u = 0, j = 0;
    for (let i = 0; i < n; i++) { while (j < flows.length && flows[j].i === i) { u += flows[j].amount / nav[i]; j++; } cum[i] = u; } }
  const value = cum.map((u, i) => u * nav[i]);
  const peak = []; let pk = 0;
  const dd = nav.map((v, i) => { pk = Math.max(pk, v); peak[i] = pk; return (v / pk - 1) * 100; });
  return (cache[id] = { id, ms, single, S, prefix, benchName, nav, bench, n, dayOf, idxOf, flows, value, dd, target });
}

const r2 = v => +v.toFixed(2);
const ret = (a, b) => (b == null || b === 0 ? null : r2((a / b - 1) * 100));
const cagr = (a, b, y) => (b == null || b === 0 ? null : r2((Math.pow(a / b, 1 / y) - 1) * 100));

function trail(series, last, dds) {
  const at = days => series[Math.max(0, last - days)];
  const cur = series[last];
  const dd = dds || (() => { let p = 0; return series.map(v => { p = Math.max(p, v); return (v / p - 1) * 100; }); })();
  const years = last / 365.25;
  return {
    w1: ret(cur, at(7)), d10: ret(cur, at(14)), m1: ret(cur, at(30)), m3: ret(cur, at(91)), m6: ret(cur, at(182)),
    y1: cagr(cur, at(365), 1), y3: cagr(cur, at(1095), 3),
    currentDD: r2(dd[last]), maxDD: r2(Math.min(...dd.slice(0, last + 1))),
    sinceInception: years >= 1 ? cagr(cur, series[0], years) : ret(cur, series[0]),
  };
}

export const demo = {
  snapshot() {
    const owners = OWNERS.map(o => ({
      id: o.id, name: o.name, email: o.name.toLowerCase().replace(/\W+/g, '.') + '@example.com', groupId: GROUP,
      isHeadOfFamily: o.head, totalValue: o.accts.reduce((s, a) => s + a[2], 0),
      accounts: o.accts.map(([id, p, v]) => ({
        id, strategyPrefix: p, strategyName: STRAT[p].name, strategyColor: STRAT[p].color, type: 'Discretionary PMS',
        portfolioValue: v, status: 'Active', isClosed: false,
      })),
    }));
    return { owners, totalPortfolioValue: owners.reduce((s, o) => s + o.totalValue, 0), isHeadOfFamily: true, groupId: GROUP };
  },

  performance(id) {
    const m = model(id), last = m.n - 1;
    const invested = m.flows.reduce((s, f) => s + f.amount, 0);
    const P = trail(m.nav, last, m.dd), B = trail(m.bench, last);
    return {
      accountId: id, isClosed: false, closedAt: null,
      strategy: { prefix: m.prefix, name: m.single ? m.S.name : 'Combined', benchmark: m.benchName, color: m.S.color },
      amountInvested: r2(invested), currentValue: r2(m.value[last]), totalReturns: r2(m.value[last] - invested),
      returnsPercent: P.sinceInception, isNegative: m.value[last] < invested,
      inceptionDate: fmtDate(START), dataAsOf: fmtDate(END), grossValue: r2(m.value[last]),
      trailingReturns: { portfolio: P, benchmark: B, benchmarkUnavailable: false },
    };
  },

  nav(id, period = '1Y') {
    const m = model(id), last = m.n - 1;
    const days = { '1W': 7, '1M': 30, '3M': 91, '6M': 182, '1Y': 365, '3Y': 1095, ALL: last }[period] ?? 365;
    const from = Math.max(0, last - days), step = Math.max(1, Math.ceil((last - from) / 120));
    const series = [];
    for (let i = from; i <= last; i += step) {
      series.push({ date: isoDate(m.dayOf(i)), portfolio: r2(m.nav[i] / m.nav[from] * 100), benchmark: r2(m.bench[i] / m.bench[from] * 100) });
    }
    if ((last - from) % step) series.push({ date: isoDate(m.dayOf(last)), portfolio: r2(m.nav[last] / m.nav[from] * 100), benchmark: r2(m.bench[last] / m.bench[from] * 100) });
    const vals = series.map(s => s.portfolio);
    return { series, minValue: Math.min(...vals), maxValue: Math.max(...vals), isClosed: false, closedAt: null };
  },

  monthlyPl(id) {
    const m = model(id), keys = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
    const byYear = {};
    let y = 2023, mo = 6;
    while (Date.UTC(y, mo, 1) <= END) {
      const s = Date.UTC(y, mo, 1), e = Math.min(Date.UTC(y, mo + 1, 1) - DAY, END);
      const si = Math.max(0, m.idxOf(s) - 1), ei = m.idxOf(e);
      const flow = m.flows.filter(f => f.i > si && f.i <= ei).reduce((t, f) => t + f.amount, 0);
      const row = (byYear[y] = byYear[y] || { year: y, pct: {}, rup: {} });
      row.pct[keys[mo]] = r2((m.nav[ei] / m.nav[si] - 1) * 100);
      row.rup[keys[mo]] = r2(m.value[ei] - m.value[si] - flow);
      mo++; if (mo > 11) { mo = 0; y++; }
    }
    const yrs = Object.values(byYear);
    const fill = (row, src, total) => { const o = { year: row.year }; keys.forEach(k => { o[k] = src[k] ?? null; }); o.total = total; return o; };
    return {
      percentData: yrs.map(r => fill(r, r.pct, r2(Object.values(r.pct).reduce((t, v) => t * (1 + v / 100), 1) * 100 - 100))),
      rupeeData: yrs.map(r => fill(r, r.rup, r2(Object.values(r.rup).reduce((t, v) => t + v, 0)))),
      isClosed: false, closedAt: null,
    };
  },

  cashflow(id) {
    const m = model(id);
    const transactions = m.flows.map(f => ({
      date: isoDate(m.dayOf(f.i)), amount: r2(Math.abs(f.amount)), type: f.amount < 0 ? 'outflow' : 'inflow',
    }));
    const total = m.flows.reduce((s, f) => s + f.amount, 0);
    return { transactions, total: r2(total), isClosed: false, closedAt: null };
  },

  docList() {
    return { categories: [
      { id: 'pms-agreement', label: 'PMS Agreement', description: 'Your signed portfolio management agreement', fileCount: 1 },
      { id: 'account-opening', label: 'Account Opening Documents', description: 'Application, KYC and mandate forms', fileCount: 2 },
      { id: 'cml', label: 'Client Master List', description: 'Depository client master report', fileCount: 1 },
      { id: 'disclosures', label: 'Disclosures', description: 'Disclosure documents and risk information', fileCount: 2 },
    ] };
  },
  docFiles(category) {
    const f = {
      'pms-agreement': [['PMS Agreement.pdf', 2.8e6]],
      'account-opening': [['Account Opening Form.pdf', 1.4e6], ['KYC Acknowledgement.pdf', 3.1e5]],
      cml: [['Client Master List.pdf', 2.2e5]],
      disclosures: [['Disclosure Document.pdf', 1.9e6], ['Risk Factors.pdf', 6.4e5]],
    }[category] || [];
    return { category, accountId: 'DEMO', files: f.map(([filename, size]) => ({ key: category + '/' + filename, filename, size, lastModified: '2026-04-12T00:00:00Z', url: null, mimeType: 'application/pdf' })) };
  },
  articles(kind) {
    const items = ['July 2026', 'June 2026', 'May 2026', 'April 2026'].map(t => ({
      key: kind + t, title: kind === 'Event' ? 'Investor Meet · ' + t : t, filename: t + '.pdf', section: t, url: null, type: 'pdf', size: 1.6e6, lastModified: null,
    }));
    return { items, count: items.length };
  },
  family() {
    const owners = OWNERS.map(o => ({
      ownerId: o.id, ownerName: o.name, ownerEmail: o.name.toLowerCase().replace(/\W+/g, '.') + '@example.com',
      accounts: o.accts.map(([id, p, v]) => ({
        clientcode: id, holderName: o.name, fullName: o.name, relation: o.head ? 'Self' : o.name.includes('Trust') ? 'Trust' : 'Spouse',
        status: 'Active', portfolioValue: v, head_of_family: o.head, pannumber: '••••••382F', mobile: '98••••8801', city: 'Mumbai', strategyName: STRAT[p].name,
      })),
    }));
    return { isHeadOfFamily: true, groupId: GROUP, groupName: 'Mehta Family', tree: [{ groupName: 'Mehta Family', groupId: GROUP, groupEmail: 'rohan.mehta@example.com', owners }], totalMembers: allAccts.length };
  },
  bank() {
    return { payableTo: 'Sample Advisors LLP (demo)', accountNumber: 'XXXXXXXX1234', bank: 'Sample Bank', ifsc: 'SAMP0000001', micr: '000000000', copyText: 'Demo bank details' };
  },
  appVersion() {
    return { minVersion: '1.0.0', latestVersion: '1.0.0', forceUpdate: false, message: '', updateUrls: { ios: '', android: '' } };
  },
  drawdown(id, period = '1Y') {
    const m = model(id), last = m.n - 1;
    const days = { '1W': 7, '1M': 30, '3M': 91, '6M': 182, '1Y': 365, '3Y': 1095, ALL: last }[period] ?? 365;
    const from = Math.max(0, last - days), step = Math.max(1, Math.ceil((last - from) / 120));
    const dd = (arr, i) => { let p = 0; for (let j = from; j <= i; j++) p = Math.max(p, arr[j]); return r2((arr[i] / p - 1) * 100); };
    const series = [];
    for (let i = from; i <= last; i += step) series.push({ date: isoDate(m.dayOf(i)), portfolio: dd(m.nav, i), benchmark: dd(m.bench, i) });
    const vals = series.map(s => s.portfolio);
    return { series, minValue: Math.min(...vals), maxValue: 0, isClosed: false, closedAt: null };
  },
  quarterlyPl(id) {
    const mp = demo.monthlyPl(id), K = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
    const q = (row, fn) => { const o = { year: row.year }; for (let i = 0; i < 4; i++) { const ms = K.slice(i * 3, i * 3 + 3).map(k => row[k]).filter(v => v != null); o['q' + (i + 1)] = ms.length ? r2(fn(ms)) : null; } o.total = row.total; return o; };
    return {
      percentData: mp.percentData.map(r => q(r, ms => ms.reduce((t, v) => t * (1 + v / 100), 1) * 100 - 100)),
      rupeeData: mp.rupeeData.map(r => q(r, ms => ms.reduce((t, v) => t + v, 0))),
      isClosed: false, closedAt: null,
    };
  },
  transactions() {
    return { transactions: [
      { orderId: 'order_demo_1042', type: 'ONE_TIME', amount: 500000, currency: 'INR', status: 'PAID', date: '2026-06-12T09:30:00Z', frequency: 'One-time', startDate: null },
      { orderId: 'sub_demo_0071', type: 'SIP', amount: 100000, currency: 'INR', status: 'PROCESSING', date: '2026-03-01T09:30:00Z', frequency: 'Monthly', startDate: '2026-03-05' },
    ], lastUpdated: new Date().toISOString() };
  },
  investmentStatus() {
    const oneTime = { orderId: 'order_demo_1042', amount: 500000, formattedAmount: '₹5,00,000', paymentType: 'ONE_TIME', isNewStrategy: false, strategyType: null,
      paymentStatus: 'PAID', investmentStatus: 'DEPLOYED', statusLabel: 'Deployed', statusMessage: 'Your funds have been invested at the applicable NAV.', statusColor: '#008455', isTerminal: true,
      timeline: [['Payment received', true], ['Settled', true], ['Deployed', true]].map(([label, done]) => ({ label, done })), createdAt: '2026-06-12T09:30:00Z' };
    const sip = { orderId: 'sub_demo_0071', amount: 100000, formattedAmount: '₹1,00,000', paymentType: 'SIP', isNewStrategy: false, strategyType: null,
      paymentStatus: 'ACTIVE', investmentStatus: 'SIP_ACTIVE', statusLabel: 'SIP active', statusMessage: 'Your SIP mandate is active. Charges will be debited automatically on schedule.', statusColor: '#008455', isTerminal: false,
      timeline: [['Mandate approved', true], ['First charge', true], ['Running', false]].map(([label, done]) => ({ label, done })),
      sip: { frequency: 'monthly', startDate: '2026-03-05', nextChargeDate: '2026-08-05', charges: [] }, createdAt: '2026-03-01T09:30:00Z' };
    return { accountId: 'QAW0412', active: [sip], completed: [oneTime], oneTime: { active: [], completed: [oneTime] }, sip: { active: [sip], completed: [] }, totalCount: 2, lastUpdated: new Date().toISOString() };
  },
  verifySip(subscriptionId) {
    return { subscriptionId, cfSubscriptionStatus: 'ACTIVE', investmentStatus: 'SIP_ACTIVE', isActive: true, isMandatePending: false, isFailed: false, amount: 100000, frequency: 'monthly', nextChargeDate: '2026-08-05' };
  },
  verifyOrder(orderId) {
    return { orderId, orderStatus: 'PAID', orderAmount: 500000, orderCurrency: 'INR', paymentStatus: 'SUCCESS', isSuccess: true, payment: { cfPaymentId: 'demo', amount: 500000, time: '2026-06-12T09:31:00Z', method: 'upi', bankReference: 'DEMO', message: 'ok' } };
  },
  rzOrder(body) {
    const id = 'order_DEMO' + Date.now().toString().slice(-8);
    return { orderId: id, amount: body.amount, currency: 'INR', keyId: 'rzp_test_demo', environment: 'test', checkoutPath: '/demo-checkout', checkoutUrl: 'about:blank' };
  },
  rzVerify(body) {
    return { orderId: body.razorpay_order_id, paymentStatus: 'CAPTURED', investmentStatus: 'PAYMENT_SUCCESS', isSuccess: true, isFailed: false, amount: 100000, payment: { id: 'pay_DEMO', method: 'upi', vpa: 'demo@upi', reference: '000000' } };
  },
  switchInfo() {
    return { investors: [
      { id: 'demo-1', legalName: 'Rohan Mehta', invested: { QAW: 7565443, QTF: 3321414, QGF: 5720213 }, pending: null },
      { id: 'demo-2', legalName: 'Anjali Mehta', invested: { QAW: 5000000, QTF: 0, QGF: 4210450 }, pending: null },
      { id: 'demo-3', legalName: 'Mehta Family Trust', invested: { QAW: 20000000, QTF: 14108880, QGF: 0 }, pending: { requestDate: '2026-07-10', switchType: 'Partial Switch' } },
    ], dryRun: false };
  },
};
