// "All accounts" on the Reports page (web src/web/reports.js, phone src/screens/reports.js): the per-account
// /api/mobile/reports/* answers merged in the app. Every account is fetched in parallel with the same filters
// (Promise.allSettled): an account that fails is listed in `failed` and the rest still show. Rows carry `account`
// (the strategy account code) for the Account column; totals are summed. Plain JS with no React Native imports,
// so node can load it (and src/screens/reportPdf.js) directly.

export const ALL_ID = '__all__';
export const ALL_LABEL = 'All accounts';

// Picker options with the full strategy name ("Qode Growth Fund QGF00014"). Names come from the scope's accounts
// (V.acctList → subs, V.switchAccounts); only the custodian's "QODE ADVISORS LLP - " prefix is dropped.
// With 2+ accounts, "All accounts" comes first; the default selection stays the first single account.
const cleanName = s => String(s || '').replace(/^QODE ADVISORS LLP\s*-\s*/i, '').trim();
export function reportAccountOptions(V) {
  const opts = (V && V.acctOptions) || [];
  const names = {};
  ((V && V.acctList) || []).forEach(o => (o.subs || []).forEach(x => { if (x.name && x.name !== x.code) names[String(x.code || x.id)] = x.name; }));
  ((V && V.switchAccounts) || []).forEach(x => { if (x.name && x.name !== x.id && !names[x.id]) names[x.id] = x.name; });
  const list = opts.map(o => {
    const name = cleanName(names[String(o.id)]);
    return { id: o.id, name, label: name ? `${name} ${o.id}` : String(o.label || o.id) };
  });
  // Closed accounts: in "All accounts" and pickable, marked closed (their charges, trades and gains still count).
  ((V && V.reportClosed) || []).filter(c => !list.some(o => String(o.id) === c.id)).forEach(c => {
    const name = cleanName(c.name);
    list.push({ id: c.id, name, label: `${name ? `${name} ${c.id}` : c.id} (closed)`, closed: true });
  });
  return list.length >= 2 ? [{ id: ALL_ID, label: ALL_LABEL, name: ALL_LABEL, all: true }, ...list] : list;
}
export const singleAccounts = options => (options || []).filter(o => o.id !== ALL_ID);

// ── fetching ──────────────────────────────────────────────────────────────────────────────────────────────
const msgOf = e => (e && e.message) || 'Something went wrong.';
// fetchOne(accountId) → Promise. Resolves { ok: [{ accountId, data }], failed: [{ accountId, msg }] };
// rejects only when every account failed.
export async function settleAll(ids, fetchOne) {
  const res = await Promise.allSettled(ids.map(id => Promise.resolve().then(() => fetchOne(id))));
  const ok = [], failed = [];
  res.forEach((r, i) => (r.status === 'fulfilled' && r.value ? ok.push({ accountId: ids[i], data: r.value }) : failed.push({ accountId: ids[i], msg: r.status === 'rejected' ? msgOf(r.reason) : 'No data.' })));
  if (!ok.length && ids.length) throw new Error(failed.length === 1 ? failed[0].msg : `No account could be loaded. ${failed[0].msg}`);
  return { ok, failed };
}
// "Couldn't load QGF00014 (reason). Showing the other accounts."
export const failedText = failed => (failed && failed.length
  ? `Couldn’t load ${failed.map(f => `${f.accountId} (${f.msg})`).join(', ')}. Showing the other accounts.`
  : '');

// ── merging helpers ───────────────────────────────────────────────────────────────────────────────────────
const n = v => (v == null || isNaN(v) ? 0 : +v);
const maxStr = list => list.filter(Boolean).reduce((a, b) => (a && a > b ? a : b), null);
const minStr = list => list.filter(Boolean).reduce((a, b) => (a && a < b ? a : b), null);
const union = ranges => {
  const rs = ranges.filter(r => r && (r.from || r.to));
  return rs.length ? { from: minStr(rs.map(r => r.from)), to: maxStr(rs.map(r => r.to)) } : null;
};
// Newest first by `key`, ties kept in account order (Array.sort is stable).
const byDateDesc = (rows, key) => rows.slice().sort((a, b) => String(b[key] || '').localeCompare(String(a[key] || '')));
// QFH accounts are never shown by code: their rows count but carry no account label, and a failed one isn't named.
const HIDDEN = id => /^QFH/i.test(String(id));
const tag = (ok, pick) => ok.flatMap(({ accountId, data }) => (pick(data) || []).map((x, i) => ({ ...x, account: HIDDEN(accountId) ? '' : accountId, id: `${accountId}:${x.id != null ? x.id : i}` })));
const holders = ok => {
  const names = [...new Set(ok.map(o => o.data && o.data.holder && o.data.holder.name).filter(Boolean))];
  return names.length ? { name: names.join(', ') } : null;
};
const base = (ok, failed) => ({
  all: true, accounts: ok.map(o => o.accountId).filter(id => !HIDDEN(id)), failed: (failed || []).filter(f => !HIDDEN(f.accountId)), holder: holders(ok),
  asOf: maxStr(ok.map(o => o.data.asOf)), truncated: ok.some(o => o.data.hasMore), hasMore: false,
});

// ── Transactions ──────────────────────────────────────────────────────────────────────────────────────────
export function mergeTransactions({ ok, failed }, q = {}) {
  const summary = [];
  ok.forEach(({ data }) => (data.summary || []).forEach(s => {
    let g = summary.find(x => x.group === s.group);
    if (!g) summary.push(g = { group: s.group, label: s.label, count: 0, amount: 0 });
    g.count += n(s.count); g.amount += n(s.amount);
  }));
  return {
    ...base(ok, failed), group: q.group || 'all', from: q.from || null, to: q.to || null,
    coverage: union(ok.map(o => o.data.coverage)),
    moneyIn: ok.reduce((s, o) => s + n(o.data.moneyIn), 0), moneyOut: ok.reduce((s, o) => s + n(o.data.moneyOut), 0),
    switchIn: ok.reduce((s, o) => s + n(o.data.switchIn), 0), switchOut: ok.reduce((s, o) => s + n(o.data.switchOut), 0),
    summary, items: byDateDesc(tag(ok, d => d.items), 'date'),
  };
}
export const loadTransactionsAll = (ids, fetchOne, q) => settleAll(ids, fetchOne).then(r => mergeTransactions(r, q));

// ── Capital gains ─────────────────────────────────────────────────────────────────────────────────────────
export function mergeCapitalGains({ ok, failed }, q = {}) {
  const years = [], byCategory = [];
  const S = { st: 0, lt: 0, ltTaxable: 0, total: 0 };
  let any = false;
  ok.forEach(({ data }) => {
    (data.years || []).forEach(y => {
      let e = years.find(x => x.fy === y.fy);
      if (!e) years.push(e = { fy: y.fy, st: 0, lt: 0, total: 0, lots: 0 });
      e.st += n(y.st); e.lt += n(y.lt); e.total += n(y.total); e.lots += n(y.lots);
    });
    const s = data.summary;
    if (!s) return;
    any = true;
    S.st += n(s.st); S.lt += n(s.lt); S.ltTaxable += n(s.ltTaxable != null ? s.ltTaxable : s.lt); S.total += n(s.total);
    (s.byCategory || []).forEach(c => {
      let e = byCategory.find(x => x.category === c.category);
      if (!e) byCategory.push(e = { category: c.category, st: 0, lt: 0, ltTaxable: 0 });
      e.st += n(c.st); e.lt += n(c.lt); e.ltTaxable += n(c.ltTaxable != null ? c.ltTaxable : c.lt);
    });
  });
  years.sort((a, b) => String(b.fy).localeCompare(String(a.fy)));
  const fys = ok.map(o => o.data.fy).filter(Boolean);
  return {
    ...base(ok, failed), fy: q.fy || maxStr(fys) || null, from: q.fy ? null : (q.from || null), to: q.fy ? null : (q.to || null), term: q.term || null,
    coverage: union(ok.map(o => o.data.coverage)), years,
    summary: any ? { ...S, byCategory } : null,
    items: byDateDesc(tag(ok, d => d.items), 'saleDate'),
  };
}
// By financial year with no year chosen, each account answers with its own latest year: settle on the newest year
// any account has and fetch the others again for that year, so every account shows the same year.
// fetchOne(accountId, { fy }) → Promise.
export async function loadCapitalGainsAll(ids, fetchOne, q = {}) {
  const byFy = !q.from && !q.to;
  const first = await settleAll(ids, id => fetchOne(id, q.fy ? { fy: q.fy } : {}));
  if (!byFy || q.fy) return mergeCapitalGains(first, q);
  const years = first.ok.flatMap(o => [o.data.fy, ...(o.data.years || []).map(y => y.fy)]).filter(Boolean);
  const fy = maxStr(years);
  if (!fy || first.ok.every(o => o.data.fy === fy)) return mergeCapitalGains(first, { ...q, fy });
  const redo = first.ok.filter(o => o.data.fy !== fy).map(o => o.accountId);
  const again = await Promise.allSettled(redo.map(id => fetchOne(id, { fy })));
  const ok = first.ok.map(o => {
    const k = redo.indexOf(o.accountId);
    return k < 0 || again[k].status !== 'fulfilled' || !again[k].value ? o : { accountId: o.accountId, data: again[k].value };
  });
  const failed = first.failed.concat(redo.filter((id, k) => again[k].status === 'rejected').map(id => ({ accountId: id, msg: `FY ${fy}: ${msgOf(again[redo.indexOf(id)].reason)}` })));
  return mergeCapitalGains({ ok: ok.filter(o => !failed.some(f => f.accountId === o.accountId)), failed }, { ...q, fy });
}

// ── Expenses ──────────────────────────────────────────────────────────────────────────────────────────────
export function mergeExpenses({ ok, failed }, q = {}) {
  const byType = [];
  ok.forEach(({ data }) => (data.byType || []).forEach(t => {
    let e = byType.find(x => x.type === t.type);
    if (!e) byType.push(e = { type: t.type, amount: 0, count: 0 });
    e.amount += n(t.amount); e.count += n(t.count);
  }));
  byType.sort((a, b) => b.amount - a.amount);
  return {
    ...base(ok, failed), type: q.type || null, from: q.from || null, to: q.to || null,
    period: union(ok.map(o => o.data.period)), coverage: union(ok.map(o => o.data.coverage)),
    paid: ok.reduce((s, o) => s + n(o.data.paid), 0), payable: ok.reduce((s, o) => s + n(o.data.payable), 0),
    byType, items: byDateDesc(tag(ok, d => d.items), 'date'),
  };
}
export const loadExpensesAll = (ids, fetchOne, q) => settleAll(ids, fetchOne).then(r => mergeExpenses(r, q));

// ── Fact sheet ────────────────────────────────────────────────────────────────────────────────────────────
// Returns are not additive: the combined view sums contribution, withdrawal, profit / loss and portfolio value,
// then lists each account's own fact sheet (sheets: [{ accountId, data }], data.asOf null when none for the date).
export const FACTSHEET_NOTE = 'Returns are per account; values are summed.';
export function mergeFactsheets({ ok, failed }, q = {}) {
  const has = ok.filter(o => o.data && o.data.asOf);
  const sum = k => has.reduce((s, o) => s + n(o.data[k]), 0);
  const dates = [...new Set(ok.flatMap(o => o.data.dates || []))].sort().reverse();
  return {
    all: true, accounts: ok.map(o => o.accountId).filter(id => !HIDDEN(id)), failed: (failed || []).filter(f => !HIDDEN(f.accountId)), holder: holders(ok), date: q.date || null,
    asOf: maxStr(has.map(o => o.data.asOf)), valueDate: maxStr(has.map(o => o.data.valueDate || o.data.asOf)),
    inceptionDate: minStr(has.map(o => o.data.inceptionDate)),
    contribution: sum('contribution'), withdrawal: sum('withdrawal'), profitLoss: sum('profitLoss'), portfolioValue: sum('portfolioValue'),
    dates, coverage: union(ok.map(o => o.data.coverage)),
    sheets: ok.map(o => ({ accountId: o.accountId, data: o.data })), note: FACTSHEET_NOTE,
  };
}
export const loadFactsheetsAll = (ids, fetchOne, q) => settleAll(ids, fetchOne).then(r => mergeFactsheets(r, q));
