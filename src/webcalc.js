// A faithful port of the web performance page's client-side maths
// (myQode/app/(protected)/portfolio/performance/page.tsx), used for accounts that have legacy Orbis data.
// The web builds three views from raw rows — Nuvama, Orbis (Legacy), Orbis + Nuvama (Combined) — so the app
// does the same from GET /api/mobile/portfolio/history. Every function returns the SAME SHAPE as the matching
// /api/mobile/portfolio/* response, so the rest of the app doesn't know the difference.
// Keep this file in step with the web page, EXCEPT for the Orbis corrections below (orbisSeries, consolidate,
// the NAV-10 anchor), where the web's numbers were wrong. Checked on all 14 Orbis accounts on 28 Sep 2026:
//  - Orbis NAVs start at 100 on a row before any money arrives; the web anchored them at 10 (returns ×10).
//  - orbis_master_sheet.net_capital_flow is 0 on every row; the real flows are the changes in capital_amount
//    (with them, NAV and value agree on every day but a handful).
//  - Some accounts book the move to Nuvama as an Orbis withdrawal (QGF0003, QGF00061): value collapses on the last
//    row, so Orbis must stop the day before.

const DAY = 86400000;
const n = v => Number(v) || 0;
const key = d => new Date(d).toISOString().slice(0, 10);
const r2 = v => (v == null || !isFinite(v) ? null : +v.toFixed(2));
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const fmtDate = d => { const t = new Date(d); return isNaN(t) ? '' : String(t.getDate()).padStart(2, '0') + ' ' + MON[t.getMonth()] + ' ' + t.getFullYear(); };   // DD Mon YYYY, the app's date format
const asc = (rows, k) => [...rows].sort((a, b) => new Date(a[k]) - new Date(b[k]));

const nuvamaRows = h => asc((h.nuvama || []).map(x => ({ ...x, nav: n(x.nav), portfolio_value: n(x.portfolio_value), cash_in_out: n(x.cash_in_out), drawdown_percent: n(x.drawdown_percent) })), 'report_date');

// The Orbis history as the app uses it: rows before Nuvama took over (and before a hand-over booked as an Orbis
// withdrawal), with each day's cash flow = the change in capital_amount (a missing capital carries the last one).
export function orbisSeries(h) {
  const o = asc(h.orbis || [], 'date');
  const nuv = nuvamaRows(h);
  let rows = nuv.length ? o.filter(r => new Date(r.date) < new Date(nuv[0].report_date)) : o;
  while (rows.length > 1) {
    const a = rows[rows.length - 2], b = rows[rows.length - 1];
    if (n(b.market_value) < 0.5 * n(a.market_value) && b.capital_amount != null && n(b.capital_amount) < n(a.capital_amount)) rows = rows.slice(0, -1);
    else break;
  }
  let cap = 0;
  return rows.map(r => {
    const c = r.capital_amount == null ? cap : n(r.capital_amount), cf = c - cap;
    cap = c;
    return { report_date: r.date, nav: n(r.nav), portfolio_value: n(r.market_value), drawdown_percent: 0, cash_in_out: cf };
  });
}

// Orbis + Nuvama. Nuvama books the holdings it received as money in on its first day; that is a transfer, not new
// money, so it is taken out of that day's flow. Across the hand-over the value moved from Orbis's last figure to
// Nuvama's first with no money in or out: that change is part of the return, so the Nuvama NAVs are chained on
// from Orbis's last NAV by value (not rebased to show 0% that day, as the web did).
export function consolidate(h) {
  const nuv = nuvamaRows(h), orb = orbisSeries(h);
  if (!orb.length) return nuv;
  if (!nuv.length) return orb;
  if (h.accountId === 'QAW00026') return nuv;   // the web's own exception (no reason given there); kept
  const end = orb[orb.length - 1];
  const after = nuv.filter(x => new Date(x.report_date) > new Date(end.report_date));
  if (!after.length) return orb;
  const first = after[0];
  const transferIn = Math.max(0, n(first.cash_in_out));   // the whole first-day inflow: new money that same day can't be told apart
  const cfFirst = n(first.cash_in_out) - transferIn;
  const bridge = end.portfolio_value > 0 ? (n(first.portfolio_value) - cfFirst) / end.portfolio_value : 1;
  const factor = n(first.nav) > 0 ? (end.nav * bridge) / n(first.nav) : 1;
  return [...orb, ...after.map((x, i) => ({ ...x, nav: n(x.nav) * factor, cash_in_out: i ? n(x.cash_in_out) : cfFirst }))];
}

// Entire Family built from the members' own aggregate rows — the same way the backend builds its group rows in
// pms_master_sheet: value = Σ members, cash = Σ members, NAV chained from 10 with the day's cash flow counted at the
// START of the day:  NAV_t = NAV_(t-1) × V_t / (V_(t-1) + CF_t).   (Checked against a real group row: ≤0.001% apart.)
// histories = /portfolio/history responses, one per member. Returns an object shaped like one such response.
export function combineFamily(histories) {
  const hs = histories.filter(h => h && h.nuvama && h.nuvama.length);
  if (!hs.length) return null;
  // stop at the earliest "latest date" so a member whose data is a day behind can't make the total dip
  const lastDay = Math.min(...hs.map(h => new Date(h.nuvama[h.nuvama.length - 1].report_date).getTime()));
  const days = new Map();
  hs.forEach(h => h.nuvama.forEach(x => {
    if (new Date(x.report_date).getTime() > lastDay) return;
    const o = days.get(x.report_date) || { v: 0, cf: 0 };
    o.v += n(x.portfolio_value); o.cf += n(x.cash_in_out); days.set(x.report_date, o);
  }));
  let nav = 10, prev = 0;
  const nuvama = [...days.keys()].sort((a, b) => new Date(a) - new Date(b)).map(d => {
    const { v, cf } = days.get(d);
    if (prev + cf > 0 && prev > 0) nav *= v / (prev + cf);
    prev = v;
    return { report_date: d, nav, portfolio_value: v, cash_in_out: cf, drawdown_percent: 0 };
  });
  // family views are measured against NIFTY 50 (as the combined-* routes do): take the longest NIFTY 50 series we were given
  const bench = hs.filter(h => h.strategy && h.strategy.benchmark === 'NIFTY 50').map(h => h.benchmark || []).sort((a, b) => b.length - a.length)[0] || [];
  return { accountId: 'family', family: true, strategy: { prefix: '', name: 'Entire Family', benchmark: 'NIFTY 50', color: '#008455' }, nuvama, orbis: [], orbisMetrics: null, benchmark: bench };
}

// The three views for one account. h = the /portfolio/history response.
export function viewRows(h, view) {
  if (view === 'orbis') return orbisSeries(h);
  if (view === 'consolidated') return consolidate(h);
  return nuvamaRows(h);
}
// The web's NAV-10 anchor the day before inception is right for a Nuvama series (it starts at 10 and its first row
// already carries a day's return). An Orbis series starts on a base row at NAV 100 before any money: no anchor.
// Managed accounts (QAC, qode_portfolios master_sheet) are the same shape at base 100: their NAV starts at 100 the day
// before the first row, which already carries a day's return. The anchor is that base NAV (0 = none).
const anchorOf = (h, view) => (view === 'orbis' || view === 'consolidated' ? 0 : h && h.managed ? 100 : 10);
const baseOf = anchor => (anchor === true ? 10 : Number(anchor) || 0);

const isMonthEnd = d => { const x = new Date(d); x.setDate(x.getDate() + 1); return x.getMonth() !== d.getMonth(); };

// web: calculateTrailingReturnsForData. data = [{nav, date}] ASC.
function trailing(data, inceptionDate, tenDDate) {
  if (!data.length) return {};
  const latest = data[data.length - 1], latestDate = new Date(latest.date);
  const closest = t => { for (let i = data.length - 1; i >= 0; i--) if (new Date(data[i].date) <= t) return data[i]; return null; };
  const target = m => { const t = new Date(latestDate); if (isMonthEnd(latestDate)) t.setMonth(t.getMonth() - m + 1, 0); else t.setMonth(t.getMonth() - m); return t; };
  const out = {};
  const w = data[data.length - 1 - 5];
  out.w1 = w ? r2((latest.nav / w.nav - 1) * 100) : null;
  const p10 = tenDDate ? data.find(x => key(x.date) === tenDDate) : data[data.length - 1 - 10];
  out.d10 = p10 ? r2((latest.nav / p10.nav - 1) * 100) : null;
  [['m1', 1], ['m3', 3], ['m6', 6], ['y1', 12], ['y3', 36]].forEach(([k, m]) => {
    const p = closest(target(m));
    out[k] = !p ? null : r2(m >= 12 ? (Math.pow(latest.nav / p.nav, 12 / m) - 1) * 100 : (latest.nav / p.nav - 1) * 100);
  });
  const inc = inceptionDate ? closest(new Date(inceptionDate)) : data[0];
  if (inc) {
    const years = (latestDate - new Date(inceptionDate || inc.date)) / DAY / 365.25;
    out.sinceInception = r2(years < 1 ? (latest.nav / inc.nav - 1) * 100 : (Math.pow(latest.nav / inc.nav, 1 / years) - 1) * 100);
  } else out.sinceInception = null;
  return out;
}

// NAV 10 anchor the day before inception when the first NAV isn't 10 (web: returns % card and portfolio SI).
function anchoredReturn(rows, anchor = true) {
  const first = rows.find(x => n(x.nav) > 0), last = [...rows].reverse().find(x => n(x.nav) > 0);
  if (!first || !last) return 0;
  const base = baseOf(anchor);
  const synthetic = !!base && n(first.nav) !== base, baseNav = synthetic ? base : n(first.nav);
  const baseDate = new Date(first.report_date); if (synthetic) baseDate.setDate(baseDate.getDate() - 1);
  const years = (new Date(last.report_date) - baseDate) / DAY / 365.25;
  const v = years >= 1 ? (Math.pow(n(last.nav) / baseNav, 1 / years) - 1) * 100 : (n(last.nav) / baseNav - 1) * 100;
  return isFinite(v) ? v : 0;
}

const benchOnOrBefore = (bench, date) => { const t = new Date(date); let hit = null; for (const b of bench) { if (new Date(b.date) <= t) hit = b; else break; } return hit; };

// web: enrichedData — portfolio drawdown recomputed from NAV (peak starts at 10 when a synthetic row is needed),
// benchmark rebased to 10 at inception. Drawdowns returned as NEGATIVE numbers (the mobile API's convention).
// Like the web, a synthetic NAV=10 row is prepended one day before inception when the first NAV isn't 10
// (its benchmark = the inception anchor, i.e. rebased 10). Callers that slice by row index must allow for it.
function enrich(rows, bench, anchor = true) {
  if (!rows.length) return [];
  const firstNav = n(rows[0].nav);
  const firstB = bench.length ? benchOnOrBefore(bench, rows[0].report_date) : null;
  const firstBench = firstB ? firstB.nav : 0, hasBench = bench.length > 0 && firstBench > 0;
  const base = baseOf(anchor), synth = !!base && firstNav !== base, bBase = base || 10;
  let peak = synth ? base : firstNav, bPeak = hasBench ? bBase : 0;
  if (synth) {
    const d = new Date(rows[0].report_date); d.setDate(d.getDate() - 1);
    const synthetic = { report_date: d.toISOString().split('T')[0], nav: base, _synthetic: true };
    rows = [synthetic, ...rows];
  }
  return rows.map(x => {
    if (x._synthetic) return { date: x.report_date, nav: base, dd: 0, bench: hasBench ? bBase : null, benchValue: hasBench ? firstBench : null, bdd: hasBench ? 0 : null, synthetic: true };
    const nav = n(x.nav);
    if (nav > peak) peak = nav;
    const out = { date: x.report_date, nav, dd: peak > 0 ? ((nav - peak) / peak) * 100 : 0, bench: null, benchValue: null, bdd: null };
    if (hasBench) {
      const b = benchOnOrBefore(bench, x.report_date), val = b ? b.nav : firstBench, norm = (val / firstBench) * bBase;
      if (norm > bPeak) bPeak = norm;
      out.bench = norm; out.benchValue = val; out.bdd = ((norm - bPeak) / bPeak) * 100;
    }
    return out;
  });
}

// → same shape as GET /portfolio/performance
export function perfFrom(h, view) {
  const rows = viewRows(h, view);
  if (!rows.length) return null;
  const bench = asc(h.benchmark || [], 'date');
  const anchor = anchorOf(h, view);
  // Every view's rows carry its real cash flows (Orbis: capital changes; Orbis + Nuvama: without the transfer), so
  // net invested = the sum of the flows and the current value = the last row's value.
  const invested = rows.reduce((t, x) => t + n(x.cash_in_out), 0);
  const current = n(rows[rows.length - 1].portfolio_value);

  const first = rows[0], last = rows[rows.length - 1];
  // The web loads the benchmark over the account's whole (Orbis + Nuvama) span and only caps it at the latest date,
  // so "on or before inception" can reach back to the previous trading day.
  const benchIn = bench.filter(b => new Date(b.date) <= new Date(last.report_date));
  const tenD = benchIn.length > 10 ? key(benchIn[benchIn.length - 11].date) : null;
  const P = trailing(rows.map(x => ({ nav: n(x.nav), date: x.report_date })), first.report_date, tenD);
  P.sinceInception = r2(anchoredReturn(rows, anchor));
  const B = benchIn.length ? trailing(benchIn.map(b => ({ nav: b.nav, date: b.date })), first.report_date, tenD) : {};
  const e = enrich(rows, benchIn, anchor);
  P.currentDD = r2(e[e.length - 1].dd); P.maxDD = r2(Math.min(...e.map(x => x.dd)));
  if (benchIn.length) { B.currentDD = r2(e[e.length - 1].bdd); B.maxDD = r2(Math.min(...e.map(x => x.bdd ?? 0))); }

  return {
    accountId: h.accountId, isClosed: false, closedAt: null, strategy: h.strategy,
    amountInvested: r2(invested), currentValue: r2(current), totalReturns: r2(current - invested),
    returnsPercent: r2(anchoredReturn(rows, anchor)), isNegative: current - invested < 0,
    inceptionDate: fmtDate(first.report_date), dataAsOf: fmtDate(last.report_date), grossValue: r2(current),
    trailingReturns: { portfolio: P, benchmark: B, benchmarkUnavailable: !benchIn.length },
  };
}

const PERIOD_DAYS = { '1W': 7, '10D': 10, '1M': 30, '3M': 91, '6M': 182, '1Y': 365, '3Y': 1095 };
function windowed(h, view, period) {
  const rows = viewRows(h, view);
  if (!rows.length) return { rows: [], e: [] };
  const lastT = new Date(rows[rows.length - 1].report_date);
  const e = enrich(rows, asc(h.benchmark || [], 'date').filter(b => new Date(b.date) <= lastT), anchorOf(h, view));
  const days = PERIOD_DAYS[period];
  if (!days) return { rows, e };   // "SI" (ALL) = the web chart, synthetic starting row included
  const from = new Date(rows[rows.length - 1].report_date).getTime() - days * DAY;
  const i = rows.findIndex(x => new Date(x.report_date).getTime() >= from);
  return { rows: rows.slice(i), e: e.slice(i + (e.length - rows.length)) };   // e may carry the synthetic row in front
}

// → same shape as GET /portfolio/nav (rebased to 100 at the window start, plus raw nav / benchmarkValue)
export function navFrom(h, view, period) {
  const { e } = windowed(h, view, period);
  if (!e.length) return { series: [] };
  const b0 = e.find(x => x.bench != null);
  return { series: e.map(x => ({
    date: x.date, portfolio: +((x.nav / e[0].nav) * 100).toFixed(4),
    benchmark: x.bench != null && b0 ? +((x.bench / b0.bench) * 100).toFixed(4) : null,
    nav: +x.nav.toFixed(4), benchmarkValue: x.benchValue,
    ...(x.synthetic ? { synthetic: true } : {}),   // the web's NAV=10 anchor the day before inception (not a real day)
  })) };
}

// → same shape as GET /portfolio/drawdown. "All" is the web's chart exactly (from inception);
// shorter windows are re-anchored at the window start, the way the mobile API does it.
export function ddFrom(h, view, period) {
  const { e } = windowed(h, view, period);
  if (!e.length) return { series: [] };
  if (!PERIOD_DAYS[period]) return { series: e.map(x => ({ date: x.date, portfolio: +x.dd.toFixed(4), benchmark: x.bdd == null ? null : +x.bdd.toFixed(4) })) };
  let pk = 0, bpk = 0;
  return { series: e.map(x => {
    pk = Math.max(pk, x.nav); if (x.bench != null) bpk = Math.max(bpk, x.bench);
    return { date: x.date, portfolio: +(((x.nav - pk) / pk) * 100).toFixed(4), benchmark: x.bench == null ? null : +(((x.bench - bpk) / bpk) * 100).toFixed(4) };
  }) };
}

// → same shape as GET /portfolio/cashflow
export function cashFrom(h, view) {
  const transactions = viewRows(h, view).filter(x => n(x.cash_in_out) !== 0)
    .map(x => ({ date: x.report_date, amount: Math.abs(n(x.cash_in_out)), type: n(x.cash_in_out) < 0 ? 'outflow' : 'inflow' }));
  return { transactions, total: transactions.reduce((t, x) => t + (x.type === 'outflow' ? -x.amount : x.amount), 0) };
}

// web: monthly / quarterly P&L. % = endNAV / startNAV − 1 ; ₹ = endValue − startValue − net cash in the period.
// → { monthly, quarterly } in the shapes of GET /portfolio/monthly-pl and /quarterly-pl
export function plFrom(h, view) {
  const rows = asc(viewRows(h, view), 'report_date');
  const MK = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
  const years = {};
  const Y = y => (years[y] = years[y] || { m: {}, q: {}, tp: null, tv: null });
  let prev = null, mS = null, qS = null, yS = null;
  const open = (nav, value, first) => ({ nav: first ? nav : prev.nav, value: first ? 0 : prev.value, cash: 0 });
  const close = (S, endNav, endValue) => ({ p: S.nav > 0 ? (endNav / S.nav - 1) * 100 : 0, v: endValue - S.value - S.cash });
  for (const x of rows) {
    const d = new Date(x.report_date), y = d.getFullYear(), mo = d.getMonth(), q = Math.floor(mo / 3);
    const nav = n(x.nav), value = n(x.portfolio_value), cash = n(x.cash_in_out), first = !prev;
    const newYear = first || y !== prev.y, newQ = newYear || q !== prev.q, newM = first || y !== prev.y || mo !== prev.mo;
    if (newYear) { if (!first) { const c = close(yS, prev.nav, prev.value); Y(prev.y).tp = c.p; Y(prev.y).tv = c.v; } yS = open(nav, value, first); Y(y); }
    if (newQ) { if (!first) Y(prev.y).q[prev.q] = close(qS, prev.nav, prev.value); qS = open(nav, value, first); }
    if (newM) { if (!first) Y(prev.y).m[prev.mo] = close(mS, prev.nav, prev.value); mS = open(nav, value, first); }
    yS.cash += cash; qS.cash += cash; mS.cash += cash;
    prev = { nav, value, y, q, mo };
  }
  if (prev) {
    Y(prev.y).m[prev.mo] = close(mS, prev.nav, prev.value);
    Y(prev.y).q[prev.q] = close(qS, prev.nav, prev.value);
    const c = close(yS, prev.nav, prev.value); Y(prev.y).tp = c.p; Y(prev.y).tv = c.v;
  }
  const ys = Object.keys(years).map(Number).sort((a, b) => a - b);
  const build = (cells, keys, f, tot) => ys.map(y => { const o = { year: y }; keys.forEach((k, i) => { const c = years[y][cells][i]; o[k] = c ? r2(c[f]) : null; }); o.total = r2(years[y][tot]); return o; });
  const QK = ['q1', 'q2', 'q3', 'q4'];
  return {
    monthly: { percentData: build('m', MK, 'p', 'tp'), rupeeData: build('m', MK, 'v', 'tv'), isClosed: false, closedAt: null },
    quarterly: { percentData: build('q', QK, 'p', 'tp'), rupeeData: build('q', QK, 'v', 'tv'), isClosed: false, closedAt: null },
  };
}
