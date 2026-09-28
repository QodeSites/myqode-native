// Demo-mode answers for the Reports page (same shapes as /api/mobile/reports/*; the server's reviewer mock in
// myQode/lib/mobileReports.ts serves the same figures to App Store reviewers).
const AS_OF = '2026-09-25';
const GROUPS = { trades: 'Trades', money: 'Money in/out', income: 'Income', charges: 'Charges' };
const TXNS = [
  { date: '2026-09-22', code: 'BY-', type: 'Buy', group: 'trades', direction: 'out', security: 'HDFC Bank Ltd', qty: 120, rate: 1652.4, amount: 198288 },
  { date: '2026-09-18', code: 'SL+', type: 'Sell', group: 'trades', direction: 'in', security: 'Infosys Ltd', qty: 80, rate: 1890.1, amount: 151208 },
  { date: '2026-09-10', code: 'RD0', type: 'Dividend Reinvest', group: 'income', direction: 'in', security: 'ITC Ltd', qty: null, rate: null, amount: 4200 },
  { date: '2026-09-01', code: 'CUS', type: 'Custody Charges', group: 'charges', direction: 'out', security: null, qty: null, rate: null, amount: 1180 },
  { date: '2026-08-14', code: 'CS+', type: 'Corpus Deposits', group: 'money', direction: 'in', security: null, qty: null, rate: null, amount: 500000 },
  { date: '2026-07-01', code: 'MGF', type: 'Management Fees', group: 'charges', direction: 'out', security: null, qty: null, rate: null, amount: 12500 },
].map((t, i) => ({ id: i + 1, settleDate: t.date, charges: 0, ref: null, notes: null, ...t }));
// from / to (yyyy-mm-dd, inclusive), read the way the server reads them (lib/reportsData.ts).
const iso = v => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);
const inRange = (d, from, to) => !!d && (!from || d >= from) && (!to || d <= to);
const CAT = 'Listed Shares/Equity Mutual Funds (STT paid on Sale)';
const LOTS = {
  '2026-27': [
    { saleDate: '2026-09-18', purchaseDate: '2024-06-11', security: 'Infosys Ltd', securityType: 'Shares', category: CAT, qty: 80, saleRate: 1890.1, saleAmount: 151208, purchaseRate: 1405, purchaseAmount: 112400, cost: 112400, gain: 38808, ltTaxable: 38808, term: 'LT', daysHeld: 829 },
    { saleDate: '2026-08-02', purchaseDate: '2026-03-20', security: 'Tata Motors Ltd', securityType: 'Shares', category: CAT, qty: 150, saleRate: 950, saleAmount: 142500, purchaseRate: 388.6, purchaseAmount: 58290, cost: 58290, gain: 84210, ltTaxable: null, term: 'ST', daysHeld: 135 },
    { saleDate: '2026-05-12', purchaseDate: '2023-11-02', security: 'Larsen & Toubro Ltd', securityType: 'Shares', category: CAT, qty: 60, saleRate: 3576.67, saleAmount: 214600, purchaseRate: 2116.8, purchaseAmount: 127008, cost: 127008, gain: 87592, ltTaxable: 87592, term: 'LT', daysHeld: 922 },
  ],
  '2025-26': [
    { saleDate: '2026-02-10', purchaseDate: '2025-10-01', security: 'Wipro Ltd', securityType: 'Shares', category: CAT, qty: 100, saleRate: 480.2, saleAmount: 48020, purchaseRate: 600.6, purchaseAmount: 60060, cost: 60060, gain: -12040, ltTaxable: null, term: 'ST', daysHeld: 132 },
    { saleDate: '2025-12-05', purchaseDate: '2023-08-14', security: 'ITC Ltd', securityType: 'Shares', category: CAT, qty: 200, saleRate: 468.5, saleAmount: 93700, purchaseRate: 177, purchaseAmount: 35400, cost: 35400, gain: 58300, ltTaxable: 58300, term: 'LT', daysHeld: 844 },
  ],
};
const EXPENSES = [
  { date: '2026-09-25', settleDate: null, type: 'Fund Accountant Fees', notes: 'Accrued', amount: 4120, status: 'payable' },
  { date: '2026-09-01', settleDate: '2026-09-01', type: 'Custody Charges', notes: 'Custody charges for Aug 2026', amount: 1180, status: 'paid' },
  { date: '2026-07-01', settleDate: '2026-07-03', type: 'Management Fees', notes: 'Management fee Q1 FY27', amount: 12500, status: 'paid' },
];
// Fact sheet snapshots, newest first; ?date= picks the latest one on or before it.
const SNAPSHOTS = [
  { asOf: AS_OF, profitLoss: 612400, portfolioValue: 3112400, portfolio: [2.1, 5.4, 18.2, 16.9], benchmark: [-4.16, -1.86, -1.32, 12.4] },
  { asOf: '2026-06-30', profitLoss: 540800, portfolioValue: 3040800, portfolio: [1.4, 3.9, 16.8, 16.1], benchmark: [2.35, 6.1, 4.8, 13.9] },
  { asOf: '2026-03-31', profitLoss: 468900, portfolioValue: 2968900, portfolio: [-0.8, 1.2, 14.6, 15.4], benchmark: [-3.2, -5.4, 5.9, 12.7] },
];

export const demoReports = {
  transactions: (accountId, { group = 'all', from: f, to: t } = {}) => {
    const from = iso(f), to = iso(t);
    const inR = TXNS.filter(x => inRange(x.date, from, to));
    const money = inR.filter(x => x.group === 'money');
    return {
      accountId, asOf: AS_OF, group, from, to, hasMore: false,
      coverage: { from: TXNS[TXNS.length - 1].date, to: TXNS[0].date },
      moneyIn: money.filter(x => x.direction === 'in').reduce((s, x) => s + x.amount, 0),
      moneyOut: money.filter(x => x.direction === 'out').reduce((s, x) => s + x.amount, 0),
      items: inR.filter(x => group === 'all' || x.group === group),
      summary: Object.keys(GROUPS).map(g => ({ group: g, label: GROUPS[g], count: inR.filter(x => x.group === g).length, amount: inR.filter(x => x.group === g).reduce((s, x) => s + x.amount, 0) })),
    };
  },
  capitalGains: (accountId, { fy, term, from: f, to: t } = {}) => {
    // A from / to range (sale date) takes precedence over a financial year.
    const from = iso(f), to = iso(t), ranged = !!(from || to);
    const fyOut = ranged ? null : fy === '2025-26' ? '2025-26' : '2026-27';
    const all = ranged ? [...LOTS['2026-27'], ...LOTS['2025-26']].filter(l => inRange(l.saleDate, from, to)) : LOTS[fyOut];
    const st = all.filter(l => l.term === 'ST').reduce((s, l) => s + l.gain, 0), lt = all.filter(l => l.term === 'LT').reduce((s, l) => s + l.gain, 0);
    const ltTaxable = ranged ? all.filter(l => l.term === 'LT').reduce((s, l) => s + (l.ltTaxable || 0), 0) : lt;
    return {
      accountId, asOf: AS_OF, fy: fyOut, from, to, term: term || null, hasMore: false,
      coverage: { from: '2025-12-05', to: '2026-09-18' },
      years: [{ fy: '2026-27', st: 84210, lt: 126400, total: 210610, lots: 3 }, { fy: '2025-26', st: -12040, lt: 58300, total: 46260, lots: 2 }],
      summary: { st, lt, ltTaxable, total: st + lt, byCategory: [{ category: CAT, st, lt, ltTaxable }] },
      items: all.filter(l => !term || l.term === term),
    };
  },
  expenses: (accountId, { type, from: f, to: t } = {}) => {
    const from = iso(f), to = iso(t), ranged = !!(from || to);
    const inR = EXPENSES.filter(x => inRange(x.date, from, to));
    // With a range, totals come from the rows inside it; without one, the statement totals.
    const byType = ranged
      ? Object.values(inR.reduce((m, x) => { const e = m[x.type] || (m[x.type] = { type: x.type, amount: 0, count: 0 }); e.amount += x.amount; e.count += 1; return m; }, {})).sort((a, b) => b.amount - a.amount)
      : [{ type: 'Management Fees', amount: 37500, count: 3 }, { type: 'Custody Charges', amount: 7080, count: 6 }, { type: 'Fund Accountant Fees', amount: 4720, count: 6 }, { type: 'Sec. Tran. Tax', amount: 3090, count: 14 }];
    return {
      accountId, asOf: AS_OF, strategy: 'QODE ADVISORS LLP - QODE ALL WEATHER', period: { from: '2025-04-01', to: AS_OF }, from, to,
      paid: ranged ? inR.filter(x => x.status !== 'payable').reduce((s, x) => s + x.amount, 0) : 52390,
      payable: ranged ? inR.filter(x => x.status === 'payable').reduce((s, x) => s + x.amount, 0) : 4120,
      hasMore: false, type: type || null, byType,
      items: inR.filter(x => !type || x.type === type),
    };
  },
  factsheet: (accountId, { date: d } = {}) => {
    const date = iso(d), dates = SNAPSHOTS.map(x => x.asOf);
    const snap = SNAPSHOTS.find(x => !date || x.asOf <= date);
    if (!snap) return { accountId, asOf: null, dates, date };
    return {
      accountId, asOf: snap.asOf, dates, date, strategy: 'QODE ADVISORS LLP - QODE ALL WEATHER', inceptionDate: '2023-06-01',
      contribution: 2500000, withdrawal: 0, profitLoss: snap.profitLoss, portfolioValue: snap.portfolioValue, valueDate: snap.asOf,
      returns: { periods: ['1m', '3m', '1y', 'Since 01/06/23'], portfolio: snap.portfolio, benchmark: { name: 'S&P BSE 500 Total Return Index', values: snap.benchmark } },
      sectors: [{ sector: 'Equity', pct: 62.5 }, { sector: 'Mutual Fund', pct: 24.1 }, { sector: 'Cash and Equivalent', pct: 13.4 }],
      holdings: [
        { security: 'Nippon India Liquid Fund', sector: 'Mutual Fund', value: 750000, pct: 24.1 },
        { security: 'Cash and Equivalent', sector: 'Cash', value: 417000, pct: 13.4 },
        { security: 'HDFC Bank Ltd', sector: 'Banks', value: 412300, pct: 13.25 },
        { security: 'Infosys Ltd', sector: 'IT - Software', value: 298100, pct: 9.58 },
      ],
    };
  },
};
