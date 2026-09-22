// Static demo data from the design (no backend). Updated to Curtain v2.
export const ACCTS = [
  { name: 'Rohan Mehta', code: 'PMS 00412', role: 'HEAD OF FAMILY', crown: true, value: 18452300, invested: 12000000, dd: -4.2, initials: 'RM' },
  { name: 'Anjali Mehta', code: 'PMS 00468', role: 'SPOUSE', crown: false, value: 9210450, invested: 7000000, dd: -3.6, initials: 'AM' },
  { name: 'Mehta Family Trust', code: 'PMS 00561', role: 'TRUST', crown: false, value: 34108880, invested: 24000000, dd: -3.9, initials: 'MT' },
];

export const FAMILY = { name: 'Entire Family', code: '3 accounts', value: 61771630, invested: 43000000, dd: -3.8, initials: 'MF' };

export const SERIES = {
  '1M': [151.2, 151.8, 151.4, 152.1, 152.6, 152.2, 153.0, 153.4, 153.1, 153.9, 154.6, 155.1, 154.8, 155.6, 156.3, 156.83],
  '6M': [143.5, 144.8, 146.2, 145.1, 147.0, 148.4, 147.6, 149.2, 150.8, 151.9, 150.7, 152.4, 153.8, 155.1, 156.83],
  '1Y': [133.4, 135.2, 134.1, 137.0, 138.6, 140.2, 139.1, 142.0, 144.6, 143.2, 146.5, 148.9, 151.2, 153.6, 156.83],
  '3Y': [98.4, 103.2, 101.5, 108.8, 114.2, 111.6, 119.4, 124.8, 122.1, 130.5, 136.2, 141.8, 147.4, 152.1, 156.83],
  'All': [100, 96.8, 104.5, 110.2, 107.4, 116.8, 123.5, 120.2, 129.8, 137.4, 133.9, 143.2, 149.8, 156.83],
};

export const RANGE_T = { '1M': [2.3, 1.1], '6M': [11.8, 6.2], '1Y': [21.4, 14.1], '3Y': [19.6, 12.8], 'All': [22.6, 14.1] };

export const TX = [
  { title: 'Contribution', sub: '12 Jul 2026 · All Weather', v: 500000, st: 'COMPLETED' },
  { title: 'Management fee', sub: '30 Jun 2026 · Quarterly', v: -23120, st: 'COMPLETED' },
  { title: 'Dividend credit', sub: '28 Jun 2026 · Growth', v: 18240, st: 'COMPLETED' },
  { title: 'Contribution', sub: '15 Jun 2026 · Growth', v: 1000000, st: 'COMPLETED' },
  { title: 'STT & charges', sub: '02 Jun 2026', v: -4310, st: 'COMPLETED' },
  { title: 'Withdrawal', sub: '22 May 2026 · To HDFC ••4021', v: -750000, st: 'PROCESSING' },
  { title: 'Contribution', sub: '05 May 2026 · Tactical', v: 750000, st: 'COMPLETED' },
];

// Profit & Loss by fiscal year: [month, value, pct, note?]
export const FYS = [
  { label: 'FY 2026-27', m: [['July 2026', 86420, 0.47, 'Month to date'], ['June 2026', 284120, 1.58], ['May 2026', 196480, 1.10], ['April 2026', -112480, -0.62]] },
  { label: 'FY 2025-26', m: [['March 2026', 342260, 1.95], ['February 2026', 158900, 0.91], ['January 2026', 224510, 1.31], ['December 2025', -86300, -0.49], ['November 2025', 268400, 1.55], ['October 2025', 121750, 0.72], ['September 2025', -204600, -1.18], ['August 2025', 187300, 1.12], ['July 2025', 294800, 1.79], ['June 2025', 142600, 0.88], ['May 2025', -63200, -0.39], ['April 2025', 228900, 1.44]] },
  { label: 'FY 2024-25', m: [['March 2025', 198400, 1.32], ['February 2025', -142800, -0.94], ['January 2025', 176500, 1.19], ['December 2024', 243700, 1.68], ['November 2024', 88900, 0.61], ['October 2024', -178200, -1.21], ['September 2024', 312400, 2.18], ['August 2024', 154800, 1.09], ['July 2024', 201300, 1.44], ['June 2024', -94600, -0.67], ['May 2024', 167200, 1.21], ['April 2024', 139800, 1.03]] },
];

export const QUARTER_LABELS = [['Q1', 'Jan – Mar'], ['Q2', 'Apr – Jun'], ['Q3', 'Jul – Sep'], ['Q4', 'Oct – Dec']];

export const HOLD = [
  { name: 'Qode All Weather', tag: 'Multi-asset · Low volatility', alloc: 41, gain: 19.4, color: '#008455', xirr: '+26.1%', mdd: '−9.2%', hasM: true },
  { name: 'Qode Growth', tag: 'Concentrated equity', alloc: 31, gain: 26.8, color: '#0A3452', xirr: '+29.4%', mdd: '−16.8%', hasM: true },
  { name: 'Qode Tactical', tag: 'Momentum · Hedged', alloc: 18, gain: 11.2, color: '#550E0E', xirr: '+21.7%', mdd: '−7.5%', hasM: true },
  { name: 'Liquid & Cash', tag: 'Ultra short duration', alloc: 10, gain: 6.4, color: '#9CA3AF', xirr: '', mdd: '', hasM: false },
];

export const METHODS = ['UPI', 'NET BANKING', 'NEFT / RTGS'];

export const TRAILING = [
  { p: '1M', pf: '+2.3%', n: '+1.1%', x: '+1.2%' }, { p: '3M', pf: '+6.1%', n: '+3.4%', x: '+2.7%' },
  { p: '6M', pf: '+11.8%', n: '+6.2%', x: '+5.6%' }, { p: '1Y', pf: '+21.4%', n: '+14.1%', x: '+7.3%' },
  { p: '3Y', pf: '+19.6%', n: '+12.8%', x: '+6.8%' }, { p: 'SI', pf: '+22.6%', n: '+14.1%', x: '+8.5%' },
];

// Detailed metrics (collapsible card on Portfolio)
export const RISK_ROWS = [
  { k: 'MAX DRAWDOWN', v: '−11.4%', down: true, note: 'Recovered in 4 months' },
  { k: 'TWRR (SI)', v: '+23.1%', up: true, note: 'XIRR +24.3% reflects your cash-flow timing' },
  { k: 'VOLATILITY', v: '13.2%', note: 'Annualised · Nifty 50: 16.8%' },
];

export const CRED_ITEMS = [
  ['SHARPE', '1.68', 'Return earned per unit of total risk taken.'],
  ['SORTINO', '2.14', 'Return per unit of downside risk only.'],
  ['BETA', '0.71', 'The portfolio moves 0.71% for every 1% move in the Nifty 50.'],
  ['WIN RATE', '68%', 'Share of months with a positive return.'],
];

// Documents tab (v2)
export const DOCS = [
  { name: 'Monthly Statement — June 2026', cat: 'Statements', meta: 'PDF · 1.2 MB · 05 Jul 2026' },
  { name: 'Monthly Statement — May 2026', cat: 'Statements', meta: 'PDF · 1.1 MB · 05 Jun 2026' },
  { name: 'Monthly Statement — April 2026', cat: 'Statements', meta: 'PDF · 1.1 MB · 06 May 2026' },
  { name: 'Annual Portfolio Report — FY26', cat: 'Statements', meta: 'PDF · 5.1 MB · 21 Apr 2026' },
  { name: 'Capital Gains Statement — FY26', cat: 'Tax', meta: 'PDF · 840 KB · 12 Apr 2026' },
  { name: 'TDS Certificate — FY26', cat: 'Tax', meta: 'PDF · 310 KB · 30 Apr 2026' },
  { name: 'Capital Gains Statement — FY25', cat: 'Tax', meta: 'PDF · 780 KB · 14 Apr 2025' },
  { name: 'PMS Agreement', cat: 'Agreements', meta: 'PDF · 2.8 MB · 14 Mar 2021' },
  { name: 'Fee Schedule — Annexure B', cat: 'Agreements', meta: 'PDF · 420 KB · 14 Mar 2021' },
  { name: 'Quarterly Factsheet — Q1 FY27', cat: 'Factsheets', meta: 'PDF · 3.4 MB · 08 Jul 2026' },
  { name: 'Quarterly Factsheet — Q4 FY26', cat: 'Factsheets', meta: 'PDF · 3.2 MB · 08 Apr 2026' },
  { name: 'Fee Invoice — Q1 FY27', cat: 'Invoices', meta: 'PDF · 180 KB · 02 Jul 2026' },
  { name: 'Fee Invoice — Q4 FY26', cat: 'Invoices', meta: 'PDF · 175 KB · 02 Apr 2026' },
];

export const DOC_CATS = ['All', 'Statements', 'Tax', 'Agreements', 'Factsheets', 'Invoices'];

export const DOC_QUICK = [
  { name: 'Latest Holdings Statement', sub: 'Jun 2026' }, { name: 'Capital Gains Statement', sub: 'FY 2025-26' },
  { name: 'Annual P&L Report', sub: 'FY 2025-26' }, { name: 'PMS Agreement', sub: 'Mar 2021' },
];

// Onboarding
export const QS = [
  { q: 'When might you need this money back?', a: ['Within 3 years', '3–5 years', '5–10 years', '10+ years'] },
  { q: 'A quarter ends 12% down. You would…', a: ['Withdraw to safety', 'Pause new investing', 'Hold as planned', 'Invest more'] },
  { q: 'How much of your wealth will this portfolio be?', a: ['Under 10%', '10–25%', '25–50%', 'Over 50%'] },
  { q: 'Your investing experience so far?', a: ['Deposits only', 'Mutual funds', 'Direct equity', 'Derivatives & alternatives'] },
  { q: 'Which statement feels most like you?', a: ['Protect capital above all', 'Steady, modest growth', 'Growth, accepting swings', 'Maximum long-term growth'] },
  { q: 'How stable is your income?', a: ['Very stable', 'Mostly stable', 'Variable', 'Irregular'] },
];

export const TYPES = [
  { name: 'Individual', sub: 'Resident, NRI, OCI or PIO' },
  { name: 'HUF', sub: 'Hindu Undivided Family, operated by the karta' },
  { name: 'Entity', sub: 'Company, LLP, partnership or trust' },
];

export const FEES = [
  { name: 'Hybrid', sub: '1% p.a. fixed + 10% of gains above a 6% hurdle.' },
  { name: 'Fixed only', sub: '2% p.a. on assets under management. No performance fee.' },
  { name: 'Performance only', sub: '0.25% p.a. fixed + 20% of gains above a 6% hurdle.' },
];

export const RES = ['Resident', 'NRI', 'OCI', 'PIO'];

export const DOC_META = { pan: 'PAN card', af: 'Aadhaar — front', ab: 'Aadhaar — back', cheque: 'Cancelled cheque' };
export const DOC_FILE = { pan: 'pan_rohan.pdf', af: 'aadhaar_front.jpg', ab: 'aadhaar_back.jpg', cheque: 'cheque_hdfc.jpg' };

export const TRACK = [
  { title: 'Application submitted', sub: '14 Jul 2026, 6:12 PM', state: 'done' },
  { title: 'Verified by Qode', sub: '14 Jul 2026, 8:40 PM', state: 'done' },
  { title: 'Account opening with custodian', sub: 'Expected by 18 Jul 2026', state: 'active' },
  { title: 'Fund your account', sub: 'Transfer instructions follow by email', state: 'pending' },
  { title: 'Portfolio live', sub: 'Invested at the next NAV after funds clear', state: 'pending' },
];

export const ARTICLES = [
  { read: '3 MIN READ', title: "What a PMS is — and isn't", sub: 'Securities held in your own name, managed under a mandate.' },
  { read: '4 MIN READ', title: 'How custody protects you', sub: 'Your assets sit with a SEBI-registered custodian, not with Qode.' },
  { read: '5 MIN READ', title: 'Understanding drawdowns', sub: 'Why temporary declines are part of long-term investing.' },
];
