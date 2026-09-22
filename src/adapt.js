// Shapes API responses (see myQode/app/api/mobile/*) into what the screens render.
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export const num = v => (v == null || v === '' || isNaN(Number(v)) ? null : Number(v));

export const initials = name =>
  (String(name || '').split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('') || 'Q').toUpperCase();

export const pct = (v, dp = 2) => (v == null ? '—' : (v < 0 ? '−' : '+') + Math.abs(v).toFixed(dp) + '%');

export const titleCase = s => String(s || '').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());

// Owner / group ids come float-formatted from some sources ("65941.0"); compare them without the suffix.
export const normId = v => String(v == null ? '' : v).trim().replace(/\.0+$/, '');

// codes = the signed-in user's accountCodes (from login / auth/me): the ONLY ids the portfolio API will serve.
// A scope is offered only when its id is in that list, otherwise the API answers 403 and nothing loads.
export function buildScopes(snap, codes) {
  const allowed = codes && codes.length ? new Set(codes.map(normId)) : null;
  const can = id => !allowed || allowed.has(normId(id));
  const owners = (snap.owners || []).map(o => {
    const accounts = (o.accounts || []).filter(a => !a.isClosed && can(a.id));
    return {
      id: String(o.id), name: o.name, initials: initials(o.name),
      code: accounts.length + (accounts.length === 1 ? ' account' : ' accounts'),
      role: o.isHeadOfFamily ? 'HEAD OF FAMILY' : 'MEMBER', crown: !!o.isHeadOfFamily,
      // Owner view always uses the owner-level aggregate (like the web's "All Strategies"): it carries the
      // owner's full history, including accounts that have since closed — a single account does not.
      value: num(o.totalValue) || 0, accounts,
      // not authorised for the owner aggregate → fall back to the owner's first strategy account
      ...(can(o.id) ? { kind: 'owner' } : { kind: 'account', id: accounts[0] ? String(accounts[0].id) : String(o.id) }),
      groupId: o.groupId,
    };
  }).filter(o => o.accounts.length > 0);
  const total = num(snap.totalPortfolioValue) ?? owners.reduce((s, o) => s + o.value, 0);
  // "Entire Family" = the group aggregate. Only valid when the user may read that group id AND every owner shown
  // belongs to it (one email can span several groups; the group row would then cover only part of the total).
  const oneGroup = owners.every(o => normId(o.groupId) === normId(snap.groupId));
  const family = snap.groupId && owners.length > 1 && can(snap.groupId) && oneGroup
    ? { id: String(snap.groupId), kind: 'family', name: 'Entire Family', initials: 'MF', code: owners.length + ' members', value: total, accounts: owners.flatMap(o => o.accounts) }
    // No single readable group row covers everyone (not head of family, or one email spanning several groups):
    // the app builds the family total itself from the members it may read — see combineFamily() in webcalc.js.
    : owners.length > 1
      ? { id: 'family', kind: 'local-family', name: 'Entire Family', initials: 'MF', code: owners.length + ' members', value: owners.reduce((s, o) => s + o.value, 0), accounts: owners.flatMap(o => o.accounts), members: owners.map(o => o.id) }
      : null;
  return { owners, family };
}

// Monthly P&L → calendar years, newest year first; months run Jan → Dec inside a year — same as the web P&L table.
// Year: { label, m: [[label, ₹, %, note, monthIndex]...] Jan → Dec, tv: ₹ year total, tp: % year total (both from the API) }
export function buildFys(monthly) {
  const years = new Map();
  const get = y => { if (!years.has(y)) years.set(y, { label: String(y), cells: new Map(), tv: null, tp: null }); return years.get(y); };
  const add = (rows, field, tot) => (rows || []).forEach(r => {
    const Y = get(r.year);
    Y[tot] = num(r.total);
    MONTHS.forEach((m, i) => { const v = num(r[m]); if (v != null) Y.cells.set(i, { ...(Y.cells.get(i) || {}), [field]: v }); });
  });
  add(monthly && monthly.rupeeData, 'v', 'tv');
  add(monthly && monthly.percentData, 'p', 'tp');
  return [...years.entries()].sort((x, y) => y[0] - x[0]).filter(([, Y]) => Y.cells.size)
    .map(([y, Y]) => ({
      label: Y.label, tv: Y.tv, tp: Y.tp,
      m: [...Y.cells.entries()].sort((x, z) => x[0] - z[0]).map(([i, c]) => [MONTH_NAMES[i] + ' ' + y, c.v ?? 0, c.p ?? 0, undefined, i]),
    }));
}

// domain = [lo, hi] fixes the y-axis (used for the NAV charts so the axis labels are exact).
export function buildPaths(pts, bench, w, h, forceMax, domain) {
  if (!pts || pts.length < 2) return { line: '', area: '', bench: '', xy: [], bxy: [] };
  const b = bench && bench.length === pts.length ? bench : pts;
  const all = pts.concat(b), pad = 8;
  const min = domain ? domain[0] : Math.min(...all), max = domain ? domain[1] : forceMax != null ? Math.max(forceMax, ...all) : Math.max(...all), span = max - min || 1;
  const xy = a => a.map((v, i) => [(i / (a.length - 1)) * w, pad + (1 - (v - min) / span) * (h - 2 * pad)]);
  const ln = a => 'M' + xy(a).map(p => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join('L');
  const top = forceMax != null ? xy([forceMax])[0][1] : h;
  return { line: ln(pts), area: ln(pts) + `L${w},${top}L0,${top}Z`, bench: ln(b), xy: xy(pts), bxy: bench && bench.length === pts.length ? xy(bench) : [] };
}

// Round y-axis for a NAV chart: lo/hi snapped to a "nice" step, with three tick labels.
export function niceAxis(values) {
  const min = Math.min(...values), max = Math.max(...values), span = max - min || Math.abs(max) * 0.02 || 1;
  const raw = span / 4, mag = Math.pow(10, Math.floor(Math.log10(raw))), f = raw / mag;
  const step = (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * mag;
  const lo = Math.floor(min / step) * step, hi = Math.ceil(max / step) * step;
  const dp = step >= 1 ? 1 : Math.min(4, Math.ceil(-Math.log10(step)));
  return { lo, hi, ticks: [hi, (lo + hi) / 2, lo].map(v => v.toFixed(dp)) };
}

export const semverLt = (a, b) => {
  const A = String(a).split('.').map(Number), B = String(b).split('.').map(Number);
  for (let i = 0; i < 3; i++) { if ((A[i] || 0) < (B[i] || 0)) return true; if ((A[i] || 0) > (B[i] || 0)) return false; }
  return false;
};

// Quarterly P&L → calendar years; Q1 = Jan–Mar … Q4 = Oct–Dec, exactly as the API/web give them.
// Row: [label, ₹, %, note, quarterIndex 0..3]
export function buildFysQ(quarterly) {
  const years = new Map();
  const get = y => { if (!years.has(y)) years.set(y, { label: String(y), cells: new Map(), tv: null, tp: null }); return years.get(y); };
  const add = (rows, field, tot) => (rows || []).forEach(r => {
    const Y = get(r.year);
    Y[tot] = num(r.total);
    [1, 2, 3, 4].forEach(q => { const v = num(r['q' + q]); if (v != null) Y.cells.set(q - 1, { ...(Y.cells.get(q - 1) || {}), [field]: v }); });
  });
  add(quarterly && quarterly.rupeeData, 'v', 'tv');
  add(quarterly && quarterly.percentData, 'p', 'tp');
  return [...years.entries()].sort((x, y) => y[0] - x[0]).filter(([, Y]) => Y.cells.size)
    .map(([, Y]) => ({
      label: Y.label, tv: Y.tv, tp: Y.tp,
      q: [...Y.cells.entries()].sort((x, z) => x[0] - z[0]).map(([i, c]) => ['Q' + (i + 1), c.v ?? 0, c.p ?? 0, undefined, i]),
    }));
}

// NAV / drawdown series → chart points; benchmark gaps are carried forward (and back-filled at the start).
export function navSeries(nav) {
  // Every row is drawn, like the web chart (no thinning) — the tooltip then lands on the same dates as the web.
  const s = ((nav && nav.series) || []).filter(r => num(r.portfolio) != null);
  const pts = s.map(r => num(r.portfolio));
  const dates = s.map(r => r.date);
  let last = null;
  const bench = s.map(r => { const v = num(r.benchmark); if (v != null) last = v; return last; });
  const first = bench.find(v => v != null);
  bench.forEach((v, i) => { if (v == null) bench[i] = first; });
  // raw (un-rebased) NAV and index level per point, when the API provides them
  const navs = s.map(r => num(r.nav)), bvals = s.map(r => num(r.benchmarkValue));
  return { pts, dates, bench: first != null ? bench : null, navs, bvals };
}

export function trailingRows(perf) {
  const t = perf && perf.trailingReturns;
  if (!t) return [];
  const P = t.portfolio || {}, B = t.benchmark || {};
  return [['1W', 'w1'], ['10D', 'd10'], ['1M', 'm1'], ['3M', 'm3'], ['6M', 'm6'], ['1Y', 'y1'], ['3Y', 'y3'], ['SI', 'sinceInception']]
    .filter(([, k]) => P[k] != null)
    .map(([p, k]) => ({
      p, pf: pct(P[k]), n: pct(B[k]),
      x: P[k] != null && B[k] != null ? pct(P[k] - B[k]) : '—',
      neg: P[k] < 0,
    }));
}

export function flowTotals(cash) {
  const tx = (cash && cash.transactions) || [];
  let inflow = 0, outflow = 0;
  tx.forEach(t => { const a = Math.abs(num(t.amount) || 0); if (t.type === 'outflow') outflow += a; else inflow += a; });
  return { inflow, outflow };
}
