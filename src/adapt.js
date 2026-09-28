// Shapes API responses (see myQode/app/api/mobile/*) into what the screens render.
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export const num = v => (v == null || v === '' || isNaN(Number(v)) ? null : Number(v));

export const initials = name =>
  (String(name || '').split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('') || 'Q').toUpperCase();

// ── One set of formatters for the whole app (money, percentages, dates) ─────────────────────────────────────
// Signs are decided on the ROUNDED value, so nothing ever reads "−0.00%" or "−₹0"; zero carries no sign.
const MON_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const rnd = (v, dp) => +(+v).toFixed(dp);
export const pct = (v, dp = 2) => {
  if (v == null || isNaN(v)) return '–';
  const r = rnd(v, dp);
  return (r < 0 ? '−' : r > 0 ? '+' : '') + Math.abs(r).toFixed(dp) + '%';
};
// Drawdown is a fall from the peak: shown as "−3.42%", and "0.00%" at a new high (never "+0.00%").
export const ddPct = v => (v == null || isNaN(v) ? '–' : rnd(Math.abs(v), 2) === 0 ? '0.00%' : '−' + Math.abs(v).toFixed(2) + '%');
// Money: ₹ with Indian grouping and 2 decimals everywhere (the web's convention).
export const inr = (v, dp = 2) => {
  if (v == null || isNaN(v)) return '–';
  const r = rnd(v, dp);
  return (r < 0 ? '−' : '') + '₹' + Math.abs(r).toLocaleString('en-IN', { minimumFractionDigits: dp, maximumFractionDigits: dp });
};
// Signed money for gains / flows: "+₹1,200.00", "−₹1,200.00", "₹0.00".
export const sinr = (v, dp = 2) => (v == null || isNaN(v) ? '–' : (rnd(v, dp) > 0 ? '+' : '') + inr(v, dp));
// Dates: "25 Sep 2026" from ISO ("2026-09-25…"), a Date, or a server string (Node prints September as "Sept").
export const fmtDate = d => {
  if (d == null || d === '') return '–';
  if (typeof d === 'string') {
    const m = d.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return `${m[3]} ${MON_SHORT[+m[2] - 1]} ${m[1]}`;
    if (/[A-Za-z]/.test(d)) return d.replace(/\bSept\b/g, 'Sep');
  }
  const t = d instanceof Date ? d : new Date(d);
  return isNaN(t) ? String(d) : `${String(t.getDate()).padStart(2, '0')} ${MON_SHORT[t.getMonth()]} ${t.getFullYear()}`;
};
// Chart axis ticks: "Sep 2026".
export const fmtMonth = d => { const t = new Date(d); return isNaN(t) ? '' : `${MON_SHORT[t.getMonth()]} ${t.getFullYear()}`; };

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
      x: P[k] != null && B[k] != null ? pct(P[k] - B[k]) : '–',
      neg: P[k] < 0,
    }));
}

export function flowTotals(cash) {
  const tx = (cash && cash.transactions) || [];
  let inflow = 0, outflow = 0;
  tx.forEach(t => { const a = Math.abs(num(t.amount) || 0); if (t.type === 'outflow') outflow += a; else inflow += a; });
  return { inflow, outflow };
}

// One date format for the whole app: DD-Mon-YYYY (25-Sep-2026). Takes a Date, an ISO string / timestamp, a plain
// YYYY-MM-DD (read as a calendar date, no timezone shift) or a string a server route already formatted
// ("25 Sept 2026"). Anything unreadable comes back unchanged (or '' for nothing).
const MON3 = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MON_IDX = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, sept: 8, oct: 9, nov: 10, dec: 11 };
export function fmtD(v, { utc = false } = {}) {
  if (v == null || v === '') return '';
  if (typeof v === 'string') {
    const t = v.trim();
    const m = t.match(/^(\d{1,2})[ -]([A-Za-z]+)[ -](\d{4})$/);
    if (m && MON_IDX[m[2].toLowerCase()] != null) return `${m[1].padStart(2, '0')}-${MON3[MON_IDX[m[2].toLowerCase()]]}-${m[3]}`;
    const iso = t.match(/^(\d{4})-(\d{2})-(\d{2})(?:T00:00:00(?:\.0+)?)?$/);
    if (iso) return `${iso[3]}-${MON3[+iso[2] - 1]}-${iso[1]}`;
    if (!/^\d{4}-\d{2}-\d{2}/.test(t)) return v;   // not a date ("FY 2027", a period label…): leave it alone
  }
  const d = v instanceof Date ? v : new Date(v);
  if (isNaN(d.getTime())) return typeof v === 'string' ? v : '';
  const D = utc ? d.getUTCDate() : d.getDate(), M = utc ? d.getUTCMonth() : d.getMonth(), Y = utc ? d.getUTCFullYear() : d.getFullYear();
  return `${String(D).padStart(2, '0')}-${MON3[M]}-${Y}`;
}
// DD-Mon, for tight spots (a date range chip)
export const fmtDM = v => { const s = fmtD(v); return /^\d{2}-[A-Z][a-z]{2}-\d{4}$/.test(s) ? s.slice(0, 6) : s; };
