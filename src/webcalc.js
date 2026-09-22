// A faithful port of the web performance page's client-side maths
// (myQode/app/(protected)/portfolio/performance/page.tsx), used for accounts that have legacy Orbis data.
// The web builds three views from raw rows — Nuvama, Orbis (Legacy), Orbis + Nuvama (Combined) — so the app
// does the same from GET /api/mobile/portfolio/history. Every function returns the SAME SHAPE as the matching
// /api/mobile/portfolio/* response, so the rest of the app doesn't know the difference.
// Keep this file in step with the web page; do not "improve" the formulas.

const DAY = 86400000;
const n = v => Number(v) || 0;
const key = d => new Date(d).toISOString().slice(0, 10);
const r2 = v => (v == null || !isFinite(v) ? null : +v.toFixed(2));
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sept', 'Oct', 'Nov', 'Dec'];
const fmtDate = d => { const t = new Date(d); return isNaN(t) ? '' : String(t.getDate()).padStart(2, '0') + ' ' + MON[t.getMonth()] + ' ' + t.getFullYear(); };
const asc = (rows, k) => [...rows].sort((a, b) => new Date(a[k]) - new Date(b[k]));

const orbisRow = o => ({ report_date: o.date, nav: n(o.nav), portfolio_value: n(o.market_value), drawdown_percent: 0, cash_in_out: n(o.net_capital_flow) });

// web: createConsolidatedData — Orbis NAVs rebased onto the Nuvama scale at the hand-over, Nuvama rows after it kept as-is.
export function consolidate(orbis, nuvama, code) {
  if (!orbis || !orbis.length) return nuvama;
  if (!nuvama || !nuvama.length) return orbis.map(orbisRow);
  if (code === 'QAW00026') return nuvama;
  const so = asc(orbis, 'date'), last = so[so.length - 1];
  const after = asc(nuvama, 'report_date').filter(x => new Date(x.report_date) > new Date(last.date));
  if (!after.length) return so.map(orbisRow);
  const factor = n(last.nav) > 0 ? n(after[0].nav) / n(last.nav) : 1;
  return [...so.map(o => ({ ...orbisRow(o), nav: n(o.nav) * factor })), ...after.map(x => ({ ...x, nav: n(x.nav) }))];
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
  const nuvama = (h.nuvama || []).map(x => ({ ...x, nav: n(x.nav), portfolio_value: n(x.portfolio_value), cash_in_out: n(x.cash_in_out), drawdown_percent: n(x.drawdown_percent) }));
  if (view === 'orbis') return asc((h.orbis || []).map(orbisRow), 'report_date');
  if (view === 'consolidated') return consolidate(h.orbis || [], nuvama, h.accountId);
  return nuvama;
}

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
function anchoredReturn(rows) {
  const first = rows.find(x => n(x.nav) > 0), last = [...rows].reverse().find(x => n(x.nav) > 0);
  if (!first || !last) return 0;
  const synthetic = n(first.nav) !== 10, baseNav = synthetic ? 10 : n(first.nav);
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
function enrich(rows, bench) {
  if (!rows.length) return [];
  const firstNav = n(rows[0].nav);
  const firstB = bench.length ? benchOnOrBefore(bench, rows[0].report_date) : null;
  const firstBench = firstB ? firstB.nav : 0, hasBench = bench.length > 0 && firstBench > 0;
  let peak = firstNav !== 10 ? 10 : firstNav, bPeak = hasBench ? 10 : 0;
  if (firstNav !== 10) {
    const d = new Date(rows[0].report_date); d.setDate(d.getDate() - 1);
    const synthetic = { report_date: d.toISOString().split('T')[0], nav: 10, _synthetic: true };
    rows = [synthetic, ...rows];
  }
  return rows.map(x => {
    if (x._synthetic) return { date: x.report_date, nav: 10, dd: 0, bench: hasBench ? 10 : null, benchValue: hasBench ? firstBench : null, bdd: hasBench ? 0 : null };
    const nav = n(x.nav);
    if (nav > peak) peak = nav;
    const out = { date: x.report_date, nav, dd: peak > 0 ? ((nav - peak) / peak) * 100 : 0, bench: null, benchValue: null, bdd: null };
    if (hasBench) {
      const b = benchOnOrBefore(bench, x.report_date), val = b ? b.nav : firstBench, norm = (val / firstBench) * 10;
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
  const nuvama = viewRows(h, 'nuvama'), orbisRows = viewRows(h, 'orbis');
  const M = h.orbisMetrics, sum = a => a.reduce((t, x) => t + n(x.cash_in_out), 0);
  const nuvamaNow = nuvama.length ? n(nuvama[nuvama.length - 1].portfolio_value) : 0;

  // web: totalInvested / currentValue, single-account branches
  let invested, current;
  if (M && view === 'orbis') { invested = M.latestCapitalAmount; current = M.latestMarketValue; }
  else if (M && view === 'consolidated') { invested = sum(nuvama) - (n(M.latestMarketValue) - n(M.latestCapitalAmount)); current = nuvamaNow; }
  else {
    invested = sum(rows);
    current = view === 'consolidated' && orbisRows.length ? n(orbisRows[orbisRows.length - 1].portfolio_value) + nuvamaNow
      : view === 'orbis' ? n(rows[rows.length - 1].portfolio_value) : nuvamaNow;
  }

  const first = rows[0], last = rows[rows.length - 1];
  // The web loads the benchmark over the account's whole (Orbis + Nuvama) span and only caps it at the latest date,
  // so "on or before inception" can reach back to the previous trading day.
  const benchIn = bench.filter(b => new Date(b.date) <= new Date(last.report_date));
  const tenD = benchIn.length > 10 ? key(benchIn[benchIn.length - 11].date) : null;
  const P = trailing(rows.map(x => ({ nav: n(x.nav), date: x.report_date })), first.report_date, tenD);
  P.sinceInception = r2(anchoredReturn(rows));
  const B = benchIn.length ? trailing(benchIn.map(b => ({ nav: b.nav, date: b.date })), first.report_date, tenD) : {};
  const e = enrich(rows, benchIn);
  P.currentDD = r2(e[e.length - 1].dd); P.maxDD = r2(Math.min(...e.map(x => x.dd)));
  if (benchIn.length) { B.currentDD = r2(e[e.length - 1].bdd); B.maxDD = r2(Math.min(...e.map(x => x.bdd ?? 0))); }

  return {
    accountId: h.accountId, isClosed: false, closedAt: null, strategy: h.strategy,
    amountInvested: r2(invested), currentValue: r2(current), totalReturns: r2(current - invested),
    returnsPercent: r2(anchoredReturn(rows)), isNegative: current - invested < 0,
    inceptionDate: fmtDate(first.report_date), dataAsOf: fmtDate(last.report_date), grossValue: r2(current),
    trailingReturns: { portfolio: P, benchmark: B, benchmarkUnavailable: !benchIn.length },
  };
}

const PERIOD_DAYS = { '1W': 7, '1M': 30, '3M': 91, '6M': 182, '1Y': 365, '3Y': 1095 };
function windowed(h, view, period) {
  const rows = viewRows(h, view);
  if (!rows.length) return { rows: [], e: [] };
  const lastT = new Date(rows[rows.length - 1].report_date);
  const e = enrich(rows, asc(h.benchmark || [], 'date').filter(b => new Date(b.date) <= lastT));
  const days = PERIOD_DAYS[period];
  if (!days) return { rows, e };   // "All" = the web chart, synthetic starting row included
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
