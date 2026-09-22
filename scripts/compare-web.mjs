// Compares the mobile API's numbers with the web page's own calculation for one client.
//   node scripts/compare-web.mjs <clientCode> [baseUrl]
// Needs the myQode server in development (uses the passwordless dev login; sends nothing to the client,
// but adds one row to that client's login history per run).
// Web side = /api/portfolio-history + /api/getIndices rows, run through the formulas ported from
// myQode/app/(protected)/portfolio/performance/page.tsx (calculateTrailingReturnsForData etc.).
const [code, base = 'http://localhost:2069'] = process.argv.slice(2);
if (!code) { console.error('usage: node scripts/compare-web.mjs <clientCode> [baseUrl]'); process.exit(1); }

const j = async (url, opts) => { const r = await fetch(url, opts); const d = await r.json().catch(() => null); if (!r.ok) throw new Error(url + ' -> ' + r.status + ' ' + JSON.stringify(d)); return d; };
const key = d => new Date(d).toISOString().slice(0, 10);

const login = await j(base + '/api/mobile/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: code }) });
const H = { Authorization: 'Bearer ' + login.token };
const isAcct = c => /^Q[A-Z]{2}\d/.test(c);
// strategy accounts use the per-account routes; owner / family ids use the combined-* routes and NIFTY 50 (web: "All Strategies")
const accounts = login.user.accountCodes;
console.log('Signed in as', login.user.name, '· codes:', accounts.join(', '));

const isMonthEnd = d => { const n = new Date(d); n.setDate(n.getDate() + 1); return n.getMonth() !== d.getMonth(); };

// data: [{nav,date}]. tenDDate: the benchmark's 10th trading date from the end (the web uses it as the
// exact 10D start for BOTH portfolio and benchmark). syntheticSI: web anchors SI at NAV 10 the day before inception.
function webTrailing(data, tenDDate, syntheticSI, inceptionDate) {
  data = [...data].sort((a, b) => new Date(a.date) - new Date(b.date));
  const latest = data[data.length - 1], latestDate = new Date(latest.date);
  const closest = t => { for (let i = data.length - 1; i >= 0; i--) if (new Date(data[i].date) <= t) return data[i]; return null; };
  const target = m => { const t = new Date(latestDate); if (isMonthEnd(latestDate)) t.setMonth(t.getMonth() - m + 1, 0); else t.setMonth(t.getMonth() - m); return t; };
  const out = {};
  const w = data[data.length - 1 - 5];                      // 1W = 5 rows back in its own series
  out.w1 = w ? (latest.nav / w.nav - 1) * 100 : null;
  const p10 = tenDDate ? data.find(x => key(x.date) === tenDDate) : data[data.length - 1 - 10];
  out.d10 = p10 ? (latest.nav / p10.nav - 1) * 100 : null;
  for (const [k, m] of [['m1', 1], ['m3', 3], ['m6', 6], ['y1', 12], ['y3', 36]]) {
    const p = closest(target(m));
    out[k] = !p ? null : m >= 12 ? (Math.pow(latest.nav / p.nav, 12 / m) - 1) * 100 : (latest.nav / p.nav - 1) * 100;
  }
  // SI: start point = closest row on/before the PORTFOLIO inception date; years counted from that inception date.
  const inc = inceptionDate ? closest(new Date(inceptionDate)) : data[0];
  if (!inc) { out.sinceInception = null; return out; }
  let baseNav = inc.nav; const baseDate = new Date(inceptionDate || inc.date);
  if (syntheticSI && data[0].nav !== 10) { baseNav = 10; baseDate.setTime(new Date(inceptionDate).getTime()); baseDate.setDate(baseDate.getDate() - 1); }
  const years = (latestDate - baseDate) / 864e5 / 365.25;
  out.sinceInception = years < 1 ? (latest.nav / baseNav - 1) * 100 : (Math.pow(latest.nav / baseNav, 1 / years) - 1) * 100;
  out._siFrom = key(inc.date);
  return out;
}

function webSummary(rows) {
  const s = [...rows].sort((a, b) => new Date(a.report_date) - new Date(b.report_date));
  const invested = s.reduce((t, r) => t + (Number(r.cash_in_out) || 0), 0);
  const current = Number(s[s.length - 1].portfolio_value) || 0;
  const first = s.find(r => Number(r.nav) > 0), last = [...s].reverse().find(r => Number(r.nav) > 0);
  const firstNav = Number(first.nav), synthetic = firstNav !== 10, baseNav = synthetic ? 10 : firstNav;
  const baseDate = new Date(first.report_date); if (synthetic) baseDate.setDate(baseDate.getDate() - 1);
  const years = (new Date(last.report_date) - baseDate) / 864e5 / 365.25;
  const returnsPercent = years >= 1 ? (Math.pow(Number(last.nav) / baseNav, 1 / years) - 1) * 100 : (Number(last.nav) / baseNav - 1) * 100;
  const dds = s.map(r => Number(r.drawdown_percent) || 0);
  return { amountInvested: invested, currentValue: current, totalReturns: current - invested, returnsPercent, currentDD: dds[dds.length - 1], maxDD: Math.max(...dds.map(Math.abs)), firstNav };
}

let diffs = 0;
const row = (label, web, mob, tol) => {
  const ok = web == null && mob == null ? true : web != null && mob != null && Math.abs(web - mob) <= tol;
  if (!ok) diffs++;
  console.log((ok ? '  ok   ' : '  DIFF ') + label.padEnd(28) + 'web ' + String(web == null ? '-' : (+web).toFixed(2)).padStart(16) + '   app ' + String(mob == null ? '-' : (+mob).toFixed(2)).padStart(16));
};
const PERIODS = ['w1', 'd10', 'm1', 'm3', 'm6', 'y1', 'y3', 'sinceInception'];

for (const acct of accounts) {
  console.log('\n=== ' + acct + ' ===');
  const single = isAcct(acct);
  const hist = (await j(base + (single ? '/api/portfolio-history?nuvama_code=' : '/api/portfolio-history-by-code?account_code=') + encodeURIComponent(acct))).data;
  if (!hist.length) { console.log('  no history rows'); continue; }
  const perf = await j(base + '/api/mobile/portfolio/' + (single ? 'performance' : 'combined-performance') + '?accountId=' + encodeURIComponent(acct), { headers: H });
  if (perf.isClosed) { console.log('  closed account (web hides these), skipped'); continue; }

  const benchName = perf.strategy.benchmark || 'NIFTY 50';
  const s0 = hist[0].report_date, s1 = hist[hist.length - 1].report_date;
  const raw = await j(base + '/api/getIndices?indices=' + encodeURIComponent(benchName) + '&startDate=' + s0 + '&endDate=' + s1);
  const bench = (Array.isArray(raw) ? raw : raw.data || [])
    .filter(x => new Date(x.date) >= new Date(s0) && new Date(x.date) <= new Date(s1))
    .map(x => ({ date: x.date, nav: parseFloat(x.nav) })).filter(x => !isNaN(x.nav))
    .sort((a, b) => new Date(a.date) - new Date(b.date));
  const tenD = bench.length > 10 ? key(bench[bench.length - 11].date) : null;

  const W = webSummary(hist), P = perf.trailingReturns.portfolio, B = perf.trailingReturns.benchmark;
  const T = webTrailing(hist.map(r => ({ nav: Number(r.nav), date: r.report_date })), tenD, true, s0);
  const TB = bench.length ? webTrailing(bench, tenD, false, s0) : {};
  console.log('  portfolio inception ' + key(s0) + ' · benchmark first row ' + (bench.length ? key(bench[0].date) : '-') + ' · web benchmark SI start ' + (TB._siFrom || 'none (shows -)'));
  console.log('  ' + hist.length + ' portfolio rows · first NAV ' + W.firstNav + ' · as of ' + perf.dataAsOf + ' · ' + benchName + ' (' + bench.length + ' rows, last ' + (bench.length ? key(bench[bench.length - 1].date) : '-') + ') · web 10D start ' + tenD);
  row('Amount invested', W.amountInvested, perf.amountInvested, 0.01);
  row('Current value', W.currentValue, perf.currentValue, 0.01);
  row('Total returns', W.totalReturns, perf.totalReturns, 0.01);
  row('Returns % (card)', W.returnsPercent, perf.returnsPercent, 0.005);
  for (const k of PERIODS) row('Portfolio ' + k, T[k], P[k], 0.005);
  row('Portfolio current DD', Math.abs(W.currentDD), Math.abs(P.currentDD), 0.005);
  row('Portfolio max DD', W.maxDD, Math.abs(P.maxDD), 0.005);
  for (const k of PERIODS) row('Benchmark ' + k, TB[k], B[k], 0.005);

  // ── NAV / drawdown charts: the web's enrichedData (synthetic NAV 10 row, benchmark rebased to 10 at inception) ──
  const before = (d) => { let hit = null; for (const b of bench) { if (new Date(b.date) <= new Date(d)) hit = b; else break; } return hit; };
  const firstNav = Number(hist[0].nav), fb = before(s0), firstBench = fb ? fb.nav : 0, hasBench = bench.length > 0 && firstBench > 0;
  const rows = firstNav !== 10 ? [{ report_date: (() => { const t = new Date(s0); t.setDate(t.getDate() - 1); return t.toISOString().split('T')[0]; })(), nav: 10 }, ...hist] : hist;
  let pk = firstNav !== 10 ? 10 : firstNav, bpk = hasBench ? 10 : 0;
  const E = rows.map(r => {
    const nav = Number(r.nav); if (nav > pk) pk = nav;
    // drawdowns kept NEGATIVE here (the mobile API's convention; the web stores them positive and negates when plotting)
    const o = { date: key(r.report_date), nav, dd: ((nav - pk) / pk) * 100 };
    if (hasBench) { const b = before(r.report_date), v = b ? b.nav : firstBench, nb = (v / firstBench) * 10; if (nb > bpk) bpk = nb; o.bench = nb; o.bdd = ((nb - bpk) / bpk) * 100; }
    return o;
  });
  const nav = await j(base + '/api/mobile/portfolio/' + (single ? 'nav' : 'combined-nav') + '?accountId=' + encodeURIComponent(acct) + '&period=ALL', { headers: H });
  const dd = await j(base + '/api/mobile/portfolio/' + (single ? 'drawdown' : 'combined-drawdown') + '?accountId=' + encodeURIComponent(acct) + '&period=ALL', { headers: H });
  const S = nav.series || [], D = dd.series || [];
  console.log('  NAV chart: web ' + E.length + ' points from ' + E[0].date + ' · app ' + S.length + ' points from ' + (S[0] ? key(S[0].date) : '-') + (hasBench ? '' : ' · web shows NO benchmark line') + (S.length && S[0].benchmark == null ? ' · app: no benchmark' : ''));
  row('Chart points', E.length, S.length, 0);
  row('Chart first NAV', E[0].nav, S[0] && S[0].nav, 0.00005);
  row('Chart last NAV', E[E.length - 1].nav, S.length ? S[S.length - 1].nav : null, 0.00005);
  const mid = Math.floor(E.length / 2);
  row('Chart mid NAV', E[mid].nav, S[mid] && S[mid].nav, 0.00005);
  row('Chart bench first (÷10)', hasBench ? E[0].bench : null, S[0] && S[0].benchmark != null ? S[0].benchmark / 10 : null, 0.0005);
  row('Chart bench last (÷10)', hasBench ? E[E.length - 1].bench : null, S.length && S[S.length - 1].benchmark != null ? S[S.length - 1].benchmark / 10 : null, 0.0005);
  row('Chart bench mid (÷10)', hasBench ? E[mid].bench : null, S[mid] && S[mid].benchmark != null ? S[mid].benchmark / 10 : null, 0.0005);
  row('DD points', E.length, D.length, 0);
  row('DD last', E[E.length - 1].dd, D.length ? D[D.length - 1].portfolio : null, 0.0005);
  row('DD min', Math.min(...E.map(x => x.dd)), D.length ? Math.min(...D.map(x => x.portfolio)) : null, 0.0005);
  row('DD bench last', hasBench ? E[E.length - 1].bdd : null, D.length && D[D.length - 1].benchmark != null ? D[D.length - 1].benchmark : null, 0.0005);
  const dateMismatch = S.findIndex((p, i) => !E[i] || key(p.date) !== E[i].date);
  console.log('  chart dates ' + (dateMismatch < 0 && S.length === E.length ? 'identical to the web' : 'DIFFER from index ' + dateMismatch));
  if (dateMismatch >= 0) diffs++;
}
console.log('\n' + (diffs ? diffs + ' value(s) differ between web and app.' : 'All compared values match.'));
