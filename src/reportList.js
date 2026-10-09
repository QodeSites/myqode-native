// Reports as a download centre (decided 9 Oct 2026, layout "B"): one account, then a card per report with its own
// period control and its Excel and PDF buttons. Nothing is shown on the page itself; each download fetches the
// report (export=1, every row) and builds the file the way the full report pages did. Web: src/web/reports.js
// DesktopReports; phone: src/screens/reports.js ReportsPage.
//
// Each report's period, as `period` to reportCall():
//   fs   { date }                  '' / missing = the latest snapshot
//   pl   { key, from, to }         key 'all' (or no dates) = from the first date on record
//   cg   { fy } | { key, from, to }  a financial year ("2026-27", the API's own view) or a sale-date range
//   txn  { key, from, to }         by date of transaction, every type
//   exp  { key, from, to }         by date
import { reports } from './api';
import { ALL_ID, reportAccountOptions, singleAccounts, loadTransactionsAll, loadCapitalGainsAll, loadExpensesAll, loadFactsheetsAll } from './combine';
import { transactionsPdf, capitalGainsPdf, expensesPdf, factsheetPdf, transactionsAllPdf, capitalGainsAllPdf, expensesAllPdf, factsheetAllPdf, plbsPdf } from './screens/reportPdf';
import { transactionsXlsx, capitalGainsXlsx, expensesXlsx, factsheetXlsx, plbsXlsx } from './reportXlsx';

export const REPORT_LIST = [
  ['fs', 'Fact Sheet', 'Value, returns, allocation, top holdings'],
  ['pl', 'P&L and Balance Sheet', 'Income, expenses, surplus, assets and liabilities'],
  ['cg', 'Capital Gains', 'Short and long term, by date of sale'],
  ['txn', 'Transactions', 'Every entry on the custodian ledger'],
  ['exp', 'Expenses', 'Fees and charges, paid and accrued'],
];

const pad2 = n => String(n).padStart(2, '0');
const isoOf = t => `${t.getFullYear()}-${pad2(t.getMonth() + 1)}-${pad2(t.getDate())}`;
const fyStartYear = t => (t.getMonth() >= 3 ? t.getFullYear() : t.getFullYear() - 1);
const fyKey = y => `${y}-${String(y + 1).slice(2)}`;
/** Financial years to offer, newest first: from the first date on record (`since`, or 3 years back) to this FY. */
export function fyOptions(since) {
  const now = fyStartYear(new Date());
  const first = since ? fyStartYear(new Date(since)) : now - 3;
  const out = [];
  for (let y = now; y >= Math.max(first, now - 7); y--) out.push(fyKey(y));
  return out;
}
export const currentFy = () => fyKey(fyStartYear(new Date()));

/**
 * One report's loader and file builders for an account (or ALL_ID with `ids`) and that report's own period:
 * data() → the report (every row), pdf(data) → the PDF document, xlsx(data) → the workbook, name → the file name.
 */
export function reportCall(k, { accountId, ids = [], period = {} }) {
  const all = accountId === ALL_ID;
  const who = all ? 'All accounts' : accountId;
  const today = isoOf(new Date());
  const EXP = { export: 1, limit: 5000 };
  const allTime = period.key === 'all' || (!period.from && !period.to);
  const fromTo = allTime ? {} : { from: period.from || undefined, to: period.to || undefined };
  const suffix = allTime ? '' : ` ${period.from || 'start'} to ${period.to || today}`;
  switch (k) {
    case 'fs': {
      const q = period.date ? { date: period.date } : {};
      return {
        data: () => (all ? loadFactsheetsAll(ids, id => reports.factsheet(id, { ...q, ...EXP }), q) : reports.factsheet(accountId, { ...q, ...EXP })),
        pdf: d => (all ? factsheetAllPdf(d) : factsheetPdf(d, accountId)), xlsx: d => factsheetXlsx(d, all ? null : accountId),
        name: `Fact sheet ${who}${q.date ? ' as of ' + q.date : ' latest'}`,
      };
    }
    case 'pl': {
      const q = allTime ? { from: '2000-01-01' } : fromTo;
      return {
        data: () => reports.pnl(all ? ids : accountId, q),
        pdf: d => plbsPdf(d, all ? null : accountId), xlsx: d => plbsXlsx(d, all ? null : accountId),
        name: `PnL and balance sheet ${who}${suffix}`,
      };
    }
    case 'cg': {
      const fy = period.fy || null;
      const q = fy ? { fy } : allTime ? { from: '1990-01-01', to: today } : fromTo;
      return {
        data: () => (all ? loadCapitalGainsAll(ids, (id, o) => reports.capitalGains(id, { ...(fy ? o : q), ...EXP }), q) : reports.capitalGains(accountId, { ...q, ...EXP })),
        pdf: d => (all ? capitalGainsAllPdf(d) : capitalGainsPdf(d, accountId)), xlsx: d => capitalGainsXlsx(d, all ? null : accountId),
        name: fy ? `Capital gains FY ${fy} ${who}` : `Capital gains ${who}${suffix}`,
      };
    }
    case 'txn':
      return {
        data: () => (all ? loadTransactionsAll(ids, id => reports.transactions(id, { group: 'all', ...fromTo, ...EXP }), { group: 'all', ...fromTo }) : reports.transactions(accountId, { group: 'all', ...fromTo, ...EXP })),
        pdf: d => (all ? transactionsAllPdf(d, 'All') : transactionsPdf(d, accountId, 'All')), xlsx: d => transactionsXlsx(d, all ? null : accountId, 'All'),
        name: `Transactions ${who}${suffix}`,
      };
    case 'exp':
      return {
        data: () => (all ? loadExpensesAll(ids, id => reports.expenses(id, { ...fromTo, ...EXP }), fromTo) : reports.expenses(accountId, { ...fromTo, ...EXP })),
        pdf: d => (all ? expensesAllPdf(d) : expensesPdf(d, accountId)), xlsx: d => expensesXlsx(d, all ? null : accountId),
        name: `Expenses ${who}${suffix}`,
      };
    default:
      throw new Error('Unknown report ' + k);
  }
}

const DATES_CACHE = new Map();
/** First and latest dates on record across these accounts (one-row transactions pages), cached for the session. */
export function recordDates(codes) {
  const key = codes.join(',');
  if (!DATES_CACHE.has(key)) {
    DATES_CACHE.set(key, Promise.all(codes.map(id => reports.transactions(id, { limit: 1 }).then(d => d && d.coverage, () => null))).then(cs => {
      const ok = cs.filter(c => c && (c.from || c.to));
      if (!ok.length) { DATES_CACHE.delete(key); return null; }
      return { from: ok.map(c => c.from).filter(Boolean).sort()[0] || null, to: ok.map(c => c.to).filter(Boolean).sort().pop() || null };
    }));
  }
  return DATES_CACHE.get(key);
}

/** Warm recordDates for every account the Reports page can show (each one, and all together), so its date menus
 *  are full the first time they open. Called by main.js once the account list is known. */
export function prefetchRecordDates(V) {
  const opts = reportAccountOptions(V), singles = singleAccounts(opts);
  if (!singles.length) return;
  const ids = [...singles.map(o => o.id), ...((V && V.reportHidden) || []).filter(id => !singles.some(o => String(o.id) === id))];
  singles.forEach(o => recordDates([o.id]));
  if (opts.some(o => o.id === ALL_ID)) recordDates(ids);
}
