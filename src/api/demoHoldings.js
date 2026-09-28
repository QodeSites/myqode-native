// Demo-mode answer for GET /api/mobile/portfolio/securities (myQode/lib/securities.ts): the Mehta family's
// security-level holdings, same shape as the server. Each strategy has a model portfolio; each account holds it
// scaled to its snapshot value (src/api/demo.js), with the remainder in cash, so the totals match the demo snapshot.
import { demo } from './demo';

const AS_OF = '2026-09-25';
// [symbol, name, sector, assetClass, weight %, price, gain since purchase %]
const MODEL = {
  QAW: [
    ['NIFTYBEES', 'Nippon India ETF Nifty 50 BeES', 'Equity', 'ETFs', 24, 284.6, 21.4],
    ['GOLDBEES', 'Nippon India ETF Gold BeES', 'Commodity', 'ETFs', 22, 124.43, 64.1],
    ['MOMENTUM50', 'Motilal Oswal Nifty 500 Momentum 50 ETF', 'Equity', 'ETFs', 12, 53.46, 5.5],
    ['LOWVOLIETF', 'ICICI Prudential Nifty 100 Low Volatility 30 ETF', 'Equity', 'ETFs', 11, 21.18, -2.5],
    ['152881', 'Nippon India Nifty 500 Momentum 50 Index Fund - Direct Growth', 'Mutual Fund', 'Mutual funds', 10, 8.453, 8.4],
    ['150902', 'Edelweiss Nifty Midcap150 Momentum 50 Index Fund - Direct Growth', 'Mutual Fund', 'Mutual funds', 9, 18.4385, 4.8],
    ['115132', 'Quantum Gold Savings Fund - Direct Growth', 'Mutual Fund', 'Mutual funds', 8, 57.6652, 53.6],
    ['OPTNIFTYPE', 'Nifty 50 - Put - 29/09/2026 - 23100', 'Options', 'Derivatives', 1.2, 59.2, -53.1],
  ],
  QGF: [
    ['DIXON', 'Dixon Technologies (India) Ltd', 'Consumer Electronics', 'Stocks', 9, 14620, 49.2],
    ['PERSISTENT', 'Persistent Systems Ltd', 'Computers - Software & Consulting', 'Stocks', 8.5, 5710.4, 15.4],
    ['TRENT', 'Trent Ltd', 'Speciality Retail', 'Stocks', 8, 5480.2, 30.2],
    ['KAYNES', 'Kaynes Technology India Ltd', 'Industrial Products', 'Stocks', 7.5, 5890, 38.6],
    ['POLYCAB', 'Polycab India Ltd', 'Cables - Electricals', 'Stocks', 7.5, 7120.5, 11.9],
    ['KPITTECH', 'KPIT Technologies Ltd', 'Computers - Software & Consulting', 'Stocks', 7, 1384.3, -6.2],
    ['CGPOWER', 'CG Power and Industrial Solutions Ltd', 'Heavy Electrical Equipment', 'Stocks', 7, 712.8, 24.7],
    ['COFORGE', 'Coforge Ltd', 'Computers - Software & Consulting', 'Stocks', 6.5, 1802.6, 18.3],
    ['BSE', 'BSE Ltd', 'Exchange and Data Platform', 'Stocks', 6.5, 2466, 72.5],
    ['APARINDS', 'Apar Industries Ltd', 'Other Electrical Equipment', 'Stocks', 6, 8940, -4.1],
    ['PGEL', 'PG Electroplast Ltd', 'Household Appliances', 'Stocks', 5.5, 812.35, 27.8],
    ['AMBER', 'Amber Enterprises India Ltd', 'Household Appliances', 'Stocks', 5, 7415, 9.6],
    ['HDFCBANK', 'HDFC Bank Ltd', 'Private Sector Bank', 'Stocks', 5, 1652.4, 9.3],
    ['LIQUIDBEES', 'Nippon India ETF Nifty 1D Rate Liquid BeES', 'Cash and Equivalent', 'Cash', 4, 1000, 0],
  ],
  QTF: [
    ['HDFCBANK', 'HDFC Bank Ltd', 'Private Sector Bank', 'Stocks', 11, 1652.4, 9.3],
    ['ICICIBANK', 'ICICI Bank Ltd', 'Private Sector Bank', 'Stocks', 10, 1418.9, 17.2],
    ['RELIANCE', 'Reliance Industries Ltd', 'Refineries & Marketing', 'Stocks', 9.5, 2915.3, 17.5],
    ['BHARTIARTL', 'Bharti Airtel Ltd', 'Telecom - Cellular & Fixed line services', 'Stocks', 9, 1968.2, 34.1],
    ['INFY', 'Infosys Ltd', 'Computers - Software & Consulting', 'Stocks', 8.5, 1890.1, 34.5],
    ['LT', 'Larsen & Toubro Ltd', 'Civil Construction', 'Stocks', 8, 3812.45, 12.8],
    ['BAJFINANCE', 'Bajaj Finance Ltd', 'Non Banking Financial Company (NBFC)', 'Stocks', 7.5, 942.6, 22.9],
    ['SUNPHARMA', 'Sun Pharmaceutical Industries Ltd', 'Pharmaceuticals', 'Stocks', 7, 1745.3, 8.1],
    ['M&M', 'Mahindra & Mahindra Ltd', 'Passenger Cars & Utility Vehicles', 'Stocks', 7, 3406.8, 41.3],
    ['TITAN', 'Titan Company Ltd', 'Gems, Jewellery And Watches', 'Stocks', 6, 3689.5, -3.4],
    ['ITC', 'ITC Ltd', 'Diversified FMCG', 'Stocks', 5.5, 468.5, 16.5],
    ['TCS', 'Tata Consultancy Services Ltd', 'Computers - Software & Consulting', 'Stocks', 5, 3512.7, -8.6],
  ],
  QLF: [
    ['LIQUIDBEES', 'Nippon India ETF Nifty 1D Rate Liquid BeES', 'Cash and Equivalent', 'Cash', 55, 1000, 0],
    ['118701', 'Nippon India Liquid Fund - Direct Growth', 'Mutual Fund', 'Mutual funds', 42, 6250.4, 6.9],
  ],
};

const r2 = v => Math.round(v * 100) / 100;
const r4 = v => Math.round(v * 10000) / 10000;

export function demoSecurities(accountId) {
  const snap = demo.snapshot();
  const all = snap.owners.flatMap(o => o.accounts);
  const asked = String(accountId || '').split(',').map(s => s.trim()).filter(Boolean);
  const accts = asked.length ? all.filter(a => asked.includes(a.id)) : all;
  if (asked.length && !accts.length) throw Object.assign(new Error('Forbidden'), { status: 403 });

  const byKey = new Map();
  const add = (code, key, base, qty, cost, value) => {
    const x = byKey.get(key) || { ...base, qty: 0, cost: 0, value: 0, accounts: new Set() };
    x.qty += qty; x.cost += cost; x.value += value; x.accounts.add(code);
    byKey.set(key, x);
  };
  for (const a of accts) {
    let held = 0;
    for (const [symbol, security, sector, assetClass, w, price, g] of MODEL[a.strategyPrefix] || []) {
      const qty = Math.floor((a.portfolioValue * w) / 100 / price);
      if (!qty) continue;
      const value = qty * price, cost = value / (1 + g / 100);
      held += value;
      add(a.id, symbol, { security, symbol, sector, assetClass, price, unitless: assetClass === 'Cash' && symbol === 'CASH' }, qty, cost, value);
    }
    const cash = a.portfolioValue - held;
    add(a.id, 'CASH', { security: 'Cash', symbol: null, sector: 'Cash and Equivalent', assetClass: 'Cash', price: null, unitless: true }, 0, cash, cash);
  }
  const rows = [...byKey.values()];
  const total = rows.reduce((s, x) => s + x.value, 0), invested = rows.reduce((s, x) => s + x.cost, 0);
  const w = v => (total ? r2((v / total) * 100) : 0);
  const items = rows.map(x => ({
    security: x.security, symbol: x.symbol, sector: x.sector, assetClass: x.assetClass,
    qty: x.unitless ? null : r4(x.qty), avgCost: x.unitless || !x.qty ? null : r4(x.cost / x.qty), price: x.unitless ? null : x.price,
    invested: r2(x.cost), value: r2(x.value), gain: r2(x.value - x.cost),
    gainPct: x.unitless || !x.cost ? null : r2(((x.value - x.cost) / x.cost) * 100),
    weight: w(x.value), accounts: [...x.accounts].sort(),
  })).sort((a, b) => b.value - a.value);
  const group = key => [...items.reduce((m, i) => m.set(key(i), (m.get(key(i)) || 0) + i.value), new Map())].sort((a, b) => b[1] - a[1]);
  return {
    asOf: accts.length ? AS_OF : null,
    accounts: accts.map(a => ({ code: a.id, strategy: a.strategyName, holdingsDate: AS_OF, value: a.portfolioValue })),
    totals: { value: r2(total), invested: r2(invested), gain: r2(total - invested), gainPct: invested ? r2(((total - invested) / invested) * 100) : null, count: items.filter(i => i.qty != null).length },
    sectors: group(i => i.sector).map(([sector, value]) => ({ sector, value: r2(value), weight: w(value) })),
    assetClasses: group(i => i.assetClass).map(([assetClass, value]) => ({ assetClass, value: r2(value), weight: w(value) })),
    items,
  };
}
