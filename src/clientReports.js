// Distributor "Download reports" (web src/web/distributor.js, phone src/screens/clientReports.js): the choices and the
// PDF for one of the distributor's investors. The data comes from clientReports() in src/api (the investor's
// read-only view token); the statements are the Reports page's own builders (src/screens/reportPdf.js) and the
// "All accounts" merges are src/combine.js, so a distributor's PDF is the same document the investor downloads.
// Plain JS with no React Native imports.
import { ALL_ID, ALL_LABEL, loadTransactionsAll, loadCapitalGainsAll, loadExpensesAll, loadFactsheetsAll } from './combine.js';
import {
  transactionsPdf, transactionsAllPdf, capitalGainsPdf, capitalGainsAllPdf, expensesPdf, expensesAllPdf,
  factsheetPdf, factsheetAllPdf, plbsPdf,
} from './screens/reportPdf.js';

export { ALL_ID, ALL_LABEL };

export const REPORT_KINDS = [
  ['factsheet', 'Fact sheet'],
  ['pnl', 'P&L and balance sheet'],
  ['capitalGains', 'Capital gains'],
  ['transactions', 'Transactions'],
  ['expenses', 'Expenses'],
];
export const reportLabel = k => (REPORT_KINDS.find(r => r[0] === k) || [k, k])[1];

// ── dates (India time: the statements are dated in IST) ──────────────────────────────────────────────────────────
const pad = v => String(v).padStart(2, '0');
const isoOf = d => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
export const todayIso = () => isoOf(new Date(Date.now() + 5.5 * 3600000));
const MS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const niceIso = iso => (iso ? `${+iso.slice(8, 10)} ${MS[+iso.slice(5, 7) - 1]} ${iso.slice(0, 4)}` : '');
const monthsBack = (iso, m) => {
  const d = new Date(iso + 'T00:00:00Z');
  const day = d.getUTCDate();
  d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() - m);
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, last));
  d.setUTCDate(d.getUTCDate() + 1);   // "last 3 months" to today inclusive starts the day after
  return isoOf(d);
};
// Indian financial year: "2026-27" = 1 Apr 2026 to 31 Mar 2027.
export const fyOf = iso => { const y = +iso.slice(0, 4), m = +iso.slice(5, 7); const s = m >= 4 ? y : y - 1; return `${s}-${pad((s + 1) % 100)}`; };
const fyStartYear = fy => +String(fy).slice(0, 4);
const fyShift = (fy, n) => { const s = fyStartYear(fy) + n; return `${s}-${pad((s + 1) % 100)}`; };
const fyRange = (fy, today) => { const s = fyStartYear(fy); const to = `${s + 1}-03-31`; return { from: `${s}-04-01`, to: to > today ? today : to }; };

// Period choices. Capital gains is statement-by-financial-year (Nuvama's statement): its list is the last five
// financial years, then the date-range choices. Fact sheet takes an "as of" date instead (see asOfChoices).
export const PERIODS = [
  ['thisFy', 'This FY'], ['lastFy', 'Last FY'], ['3m', 'Last 3 months'], ['12m', 'Last 12 months'], ['all', 'All time'], ['custom', 'Custom'],
];
export function periodChoices(kind, today = todayIso()) {
  if (kind === 'factsheet') return [];
  if (kind !== 'capitalGains') return PERIODS;
  const cur = fyOf(today);
  const fys = [0, 1, 2, 3, 4].map(i => fyShift(cur, -i));
  return [...fys.map((fy, i) => ['fy:' + fy, i === 0 ? `FY ${fy} (this)` : `FY ${fy}`]), ['12m', 'Last 12 months'], ['all', 'All time'], ['custom', 'Custom']];
}
export const defaultPeriod = kind => (kind === 'capitalGains' ? 'fy:' + fyOf(todayIso()) : kind === 'factsheet' ? null : 'thisFy');

// → { from, to, fy, label } for the chosen period. custom: { from, to } (yyyy-mm-dd).
export function resolvePeriod(key, custom = {}, today = todayIso()) {
  const cur = fyOf(today);
  if (key && key.startsWith('fy:')) { const fy = key.slice(3); return { fy, ...fyRange(fy, today), label: `FY ${fy}` }; }
  if (key === 'thisFy') return { ...fyRange(cur, today), fy: cur, label: `FY ${cur}` };
  if (key === 'lastFy') { const fy = fyShift(cur, -1); return { ...fyRange(fy, today), fy, label: `FY ${fy}` }; }
  if (key === '3m') { const from = monthsBack(today, 3); return { from, to: today, label: `${niceIso(from)} to ${niceIso(today)}` }; }
  if (key === '12m') { const from = monthsBack(today, 12); return { from, to: today, label: `${niceIso(from)} to ${niceIso(today)}` }; }
  if (key === 'all') return { from: null, to: today, label: 'All time' };
  const from = custom.from || null, to = custom.to || null;
  return { from, to, label: from || to ? `${from ? niceIso(from) : 'Start'} to ${niceIso(to || today)}` : 'All time' };
}
// A custom range is complete and in order; returns an error message or ''.
export function periodError(key, custom = {}, today = todayIso()) {
  if (key !== 'custom') return '';
  if (!custom.from || !custom.to) return 'Choose both a start and an end date.';
  if (custom.from > custom.to) return 'The start date must be on or before the end date.';
  if (custom.from > today) return 'The start date cannot be in the future.';
  return '';
}

// Fact sheet: the latest snapshot, or the one on or before a chosen date.
export const AS_OF = [['latest', 'Latest'], ['date', 'As of a date']];

// Account choices: "All accounts" first when there are 2+, then each strategy account ("Qode All Weather QAW00041").
const cleanName = s => String(s || '').replace(/^QODE ADVISORS LLP\s*-\s*/i, '').trim();
export function accountChoices(accounts) {
  const list = (accounts || []).map(a => {
    const name = cleanName(a.name);
    return { id: a.id, label: (name ? `${name} ${a.id}` : a.id) + (a.closed ? ' (closed)' : ''), holder: a.holder };
  });
  return list.length >= 2 ? [{ id: ALL_ID, label: ALL_LABEL, all: true }, ...list] : list;
}

// "<Client name> - Transactions - FY 2026-27 - QAW00041" (savePdf makes it safe for a file name).
export function fileName(clientName, kind, periodText, accountText) {
  return [clientName || 'Investor', reportLabel(kind), periodText, accountText].filter(Boolean).join(' - ');
}

// The PDF. rep: clientReports(...).reports; sel: { kind, account (id or ALL_ID), ids (every single account id),
// period (key), custom ({ from, to }), asOf ('latest' | 'date'), date (yyyy-mm-dd) }.
// → { html, landscape, periodText, note } (note: accounts left out of an "All accounts" statement).
const withRange = (d, p) => ({ ...d, from: d.from || p.from || null, to: d.to || p.to || null });
const X = { export: 1, limit: 5000 };
export async function buildReport(rep, sel) {
  const { kind, account, ids } = sel;
  const all = account === ALL_ID;
  const codes = all ? ids : [account];
  if (!codes.length) throw new Error('This investor has no accounts to report on yet.');
  const failedNote = r => (r && r.failed && r.failed.length ? `Not included: ${r.failed.map(f => f.accountId).join(', ')}.` : '');

  if (kind === 'factsheet') {
    const date = sel.asOf === 'date' && sel.date ? sel.date : null;
    const q = { ...(date ? { date } : {}), export: 1 };
    const periodText = date ? `as of ${niceIso(date)}` : 'Latest';
    if (all) {
      const r = await loadFactsheetsAll(codes, id => rep.factsheet(id, q), { date });
      if (!r.asOf) throw new Error(date ? 'There is no fact sheet on or before that date.' : 'No fact sheet is available yet.');
      return { ...factsheetAllPdf(r), periodText, note: failedNote(r) };
    }
    const d = await rep.factsheet(account, q);
    if (!d || !d.asOf) throw new Error(date ? 'There is no fact sheet on or before that date for this account.' : 'No fact sheet is available for this account yet.');
    return { ...factsheetPdf(d, account), periodText: `as of ${niceIso(d.asOf)}`, note: '' };
  }

  const p = resolvePeriod(sel.period, sel.custom);
  const range = { from: p.from || undefined, to: p.to || undefined };

  // A period with nothing in it gets a message, as P&L does, never an empty or zero PDF. When the period ends before the
  // account's first transaction on record, the message says when the account started.
  const startOf = async () => {
    const first = await Promise.all(codes.map(id => rep.transactions(id, { group: 'all', limit: 1 }).then(d => d && d.coverage && d.coverage.from, () => null)));
    return first.filter(Boolean).sort()[0] || null;
  };
  const nothing = async (what, start) => {
    const s = start === undefined ? await startOf() : start;
    const when = p.fy && (sel.period || '').match(/^(fy:|thisFy$|lastFy$)/) ? `FY ${p.fy}` : 'this period';
    const began = s && p.to && p.to < s ? `${all ? 'These accounts' : 'This account'} started on ${niceIso(s)}. ` : '';
    return new Error(`${began}No ${what} for ${when}.`);
  };
  const empty = d => !d || !(d.items || []).length;

  if (kind === 'transactions') {
    const q = { group: 'all', ...range };
    if (all) {
      const r = await loadTransactionsAll(codes, id => rep.transactions(id, { ...q, ...X }), q);
      if (empty(r) && !(r.failed || []).length) throw await nothing('transactions', r.coverage && r.coverage.from);
      return { ...transactionsAllPdf(withRange(r, range), 'All'), periodText: p.label, note: failedNote(r) };
    }
    const d = await rep.transactions(account, { ...q, ...X });
    if (empty(d)) throw await nothing('transactions', d && d.coverage && d.coverage.from);
    return { ...transactionsPdf(withRange(d, range), account, 'All'), periodText: p.label, note: '' };
  }
  if (kind === 'expenses') {
    if (all) {
      const r = await loadExpensesAll(codes, id => rep.expenses(id, { ...range, ...X }), range);
      if (empty(r) && !(r.failed || []).length) throw await nothing('expenses');
      return { ...expensesAllPdf(withRange(r, range)), periodText: p.label, note: failedNote(r) };
    }
    const d = await rep.expenses(account, { ...range, ...X });
    if (empty(d)) throw await nothing('expenses');
    return { ...expensesPdf(withRange(d, range), account), periodText: p.label, note: '' };
  }
  if (kind === 'capitalGains') {
    // By financial year (Nuvama's statement), or by sale date for a range. "All time": every sale on record.
    const byFy = !!p.fy && (sel.period || '').startsWith('fy:');
    const q = byFy ? { fy: p.fy } : { from: p.from || '2000-01-01', to: p.to || undefined };
    // Asked for a year with no sales, the server answers with the latest year that has some; that is not this year.
    const onlyFy = d => (byFy && d && d.fy !== p.fy ? { ...d, fy: p.fy, summary: null, items: [] } : d);
    if (all) {
      const r = await loadCapitalGainsAll(codes, (id, o) => rep.capitalGains(id, { ...(byFy ? o : q), ...X }).then(onlyFy), q);
      if (empty(r) && !(r.failed || []).length) throw await nothing('capital gains');
      return { ...capitalGainsAllPdf(byFy ? r : withRange(r, q)), periodText: p.label, note: failedNote(r) };
    }
    const d = onlyFy(await rep.capitalGains(account, { ...q, ...X }));
    if (empty(d)) throw await nothing('capital gains');
    return { ...capitalGainsPdf(byFy ? d : withRange(d, q), account), periodText: p.label, note: '' };
  }
  if (kind === 'pnl') {
    // "All time" asks from the earliest possible date; the server starts it at the first date on record.
    const q = sel.period === 'all' ? { from: '2000-01-01', to: p.to } : range;
    const d = await rep.pnl(all ? codes : account, q);
    if (!d || !d.asOf) throw new Error('No profit and loss statement is available for this period.');
    const omitted = d.omitted && d.omitted.length ? `Not included: ${d.omitted.join(', ')}.` : '';
    return { ...plbsPdf(d, all ? null : account), periodText: d.from && d.to ? `${niceIso(d.from)} to ${niceIso(d.to)}` : p.label, note: omitted };
  }
  throw new Error('Choose a report.');
}
