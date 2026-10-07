// The Reports page's statements as Excel workbooks (web src/web/reports.js, phone src/screens/reports.js), from the
// same report data the PDFs are built from (src/screens/reportPdf.js), so the two always agree. Each workbook opens
// with a "Summary" sheet (what the statement is, whose, the period, the totals), then the figures as plain numbers
// and dates (YYYY-MM-DD) that Excel can sort and sum. "All accounts" statements (src/combine.js) get an Account
// column. Plain JS with no React Native imports except in saveXlsx, so node can load the builders.
import * as XLSX from 'xlsx';
import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { track } from './api/track';

const num = v => (v == null || v === '' || isNaN(+v) ? null : +v);
const day = d => (d ? String(d).slice(0, 10) : '');
const name = (holder, fallback) => (holder && holder.name) || fallback || '';

/** A sheet from rows of cells (header first). widths: characters per column. */
function sheet(rows, widths) {
  const ws = XLSX.utils.aoa_to_sheet(rows);
  if (widths) ws['!cols'] = widths.map(wch => ({ wch }));
  return ws;
}
const book = () => XLSX.utils.book_new();
const add = (wb, ws, title) => XLSX.utils.book_append_sheet(wb, ws, String(title).replace(/[\\/?*[\]:]/g, ' ').slice(0, 31));
// The Summary sheet: [label, value] pairs, blank rows between groups.
const summary = (title, pairs) => sheet([[title], [], ...pairs.map(p => (p ? [p[0], p[1] == null ? '' : p[1]] : []))], [34, 44]);
const who = (accountId, r) => (accountId
  ? [['Account', accountId], ['Account holder', name(r.holder)], ...(r.holder && r.holder.strategy ? [['Strategy', r.holder.strategy]] : [])]
  : [['Account', 'All accounts'], ['Account codes', (r.accounts || []).join(', ')], ['Account holder', name(r.holder)]]);
const period = (from, to, none = 'All records') => (from || to ? `${day(from) || 'Earliest'} to ${day(to) || 'Latest'}` : none);
const failed = r => (r.failed && r.failed.length ? [[], ['Not included (could not be loaded)', r.failed.map(f => `${f.accountId} (${f.msg})`).join(', ')]] : []);

// ── Transactions ──────────────────────────────────────────────────────────────────────────────────────────
export function transactionsXlsx(r, accountId, groupLabel) {
  const A = !accountId;
  const wb = book();
  add(wb, summary('Transaction Statement', [
    ...who(accountId, r), ['As of', day(r.asOf)], ['Period', period(r.from, r.to)], ['Showing', groupLabel || 'All'], null,
    ['Money in (₹)', num(r.moneyIn)], ['Money out (₹)', num(r.moneyOut)],
    ...(r.summary || []).filter(s => s.group !== 'trades').map(s => [`${s.label} (₹)`, num(s.amount)]),
    ...failed(r),
  ]), 'Summary');
  const head = ['Transaction', ...(A ? ['Account'] : []), 'Trade date', 'Settlement date', 'Security / details', 'Exchange', 'Quantity', 'Unit price (₹)', 'Brokerage (₹)', 'STT (₹)', 'Amount (₹)', 'Settlement amount (₹)', 'Asset class', 'Reference'];
  const rows = (r.items || []).map(t => [t.type, ...(A ? [t.account] : []), day(t.date), day(t.settleDate), t.security || t.notes || '', t.exchange || '',
    num(t.qty), num(t.rate), num(t.brokerage), num(t.stt), num(t.amount), num(t.settlement != null ? t.settlement : t.amount), t.assetClass || '', t.ref || '']);
  add(wb, sheet([head, ...rows], [26, ...(A ? [12] : []), 12, 14, 40, 9, 12, 14, 13, 11, 16, 18, 20, 16]), 'Transactions');
  return wb;
}

// ── Capital gains ─────────────────────────────────────────────────────────────────────────────────────────
export function capitalGainsXlsx(r, accountId) {
  const A = !accountId, S = r.summary || {};
  const wb = book();
  add(wb, summary('Statement of Capital Gain / Loss', [
    ...who(accountId, r), ['As of', day(r.asOf)], ['Period', r.fy ? `Financial year ${r.fy}` : period(r.from, r.to)], null,
    ['Short term (₹)', num(S.st)], ['Long term (₹)', num(S.lt)], ['Long term, effective (₹)', num(S.ltTaxable)], ['Total realised (₹)', num(S.total)],
    ...failed(r),
  ]), 'Summary');
  const cats = (S.byCategory || []).map(c => [c.category, num(c.st), num(c.lt), num(c.ltTaxable), (c.st || 0) + (c.lt || 0)]);
  if (cats.length) add(wb, sheet([['Category', 'Short term (₹)', 'Long term (₹)', 'Long term, effective (₹)', 'Total (₹)'], ...cats], [28, 16, 16, 22, 16]), 'By category');
  const head = [...(A ? ['Account'] : []), 'Category', 'Security', 'Type', 'Sale date', 'Quantity', 'Sale rate (₹)', 'Sale amount (₹)', 'Purchase date', 'Purchase rate (₹)', 'Purchase amount (₹)', 'Effective cost (₹)', 'Days held', 'Term', 'Realised gain (₹)', 'Effective LT gain (₹)'];
  const rows = (r.items || []).map(l => [...(A ? [l.account] : []), l.category || '', l.security, l.securityType || '', day(l.saleDate), num(l.qty), num(l.saleRate), num(l.saleAmount),
    day(l.purchaseDate), num(l.purchaseRate), num(l.purchaseAmount), num(l.cost), num(l.daysHeld), l.term || '', num(l.gain), l.term === 'LT' ? num(l.ltTaxable != null ? l.ltTaxable : l.gain) : null]);
  add(wb, sheet([head, ...rows], [...(A ? [12] : []), 18, 36, 14, 12, 12, 14, 16, 14, 16, 18, 16, 10, 7, 16, 18]), 'Realised lots');
  return wb;
}

// ── Expenses ──────────────────────────────────────────────────────────────────────────────────────────────
export function expensesXlsx(r, accountId) {
  const A = !accountId;
  const wb = book();
  add(wb, summary('Statement of Expenses', [
    ...who(accountId, r), ...(r.strategy ? [['Strategy', r.strategy]] : []), ['As of', day(r.asOf)],
    ['Statement covers', r.period ? `${day(r.period.from)} to ${day(r.period.to)}` : ''], ['Period', period(r.from, r.to)], null,
    ['Paid (₹)', num(r.paid)], ['Payable, accrued (₹)', num(r.payable)], ['Total (₹)', (r.paid || 0) + (r.payable || 0)],
    ...failed(r),
  ]), 'Summary');
  add(wb, sheet([['Charge', 'Entries', 'Amount (₹)'], ...(r.byType || []).map(t => [t.type, t.count, num(t.amount)])], [30, 10, 16]), 'By charge');
  const head = ['Date', 'Settled', ...(A ? ['Account'] : []), 'Charge', 'Description', 'Status', 'Amount (₹)'];
  const rows = (r.items || []).map(x => [day(x.date), day(x.settleDate), ...(A ? [x.account] : []), x.type, x.notes || '', x.status || 'paid', num(x.amount)]);
  add(wb, sheet([head, ...rows], [12, 12, ...(A ? [12] : []), 28, 44, 10, 16]), 'Entries');
  return wb;
}

// ── Fact sheet ────────────────────────────────────────────────────────────────────────────────────────────
// One account's sheets, added to wb with a prefix (per account in the all-accounts workbook).
function factsheetSheets(wb, r, accountId, prefix = '') {
  const ret = r.returns || {}, periods = ret.periods || [];
  add(wb, summary('Portfolio Fact Sheet', [
    ...who(accountId, r), ...(r.strategy ? [['Strategy', r.strategy]] : []), ['As of', day(r.asOf)], ['Inception', day(r.inceptionDate)],
    ...(r.computed && r.note ? [['Note', r.note]] : []), null,
    [`Portfolio value (₹) · ${day(r.valueDate)}`, num(r.portfolioValue)], ['Profit / loss (₹)', num(r.profitLoss)], ['Contribution (₹)', num(r.contribution)], ['Withdrawal (₹)', num(r.withdrawal)],
  ]), prefix + 'Summary');
  if (periods.length) {
    const rows = [['', ...periods], ['Portfolio (%)', ...(ret.portfolio || []).map(num)]];
    if (ret.benchmark) rows.push([`${ret.benchmark.name} (%)`, ...(ret.benchmark.values || []).map(num)]);
    add(wb, sheet(rows, [26, ...periods.map(() => 12)]), prefix + 'Performance');
  }
  if ((r.sectors || []).length) add(wb, sheet([['Sector', 'Share (%)'], ...r.sectors.slice().sort((x, y) => (y.pct || 0) - (x.pct || 0)).map(x => [x.sector, num(x.pct)])], [30, 12]), prefix + 'Sectors');
  if ((r.holdings || []).length) add(wb, sheet([['#', 'Security', 'Sector', 'Market value (₹)', '% of assets'], ...r.holdings.map((x, i) => [i + 1, x.security, x.sector || '', num(x.value), num(x.pct)])], [5, 40, 24, 18, 12]), prefix + 'Holdings');
}
export function factsheetXlsx(r, accountId) {
  const wb = book();
  if (accountId) { factsheetSheets(wb, r, accountId); return wb; }
  const sheets = r.sheets || [];
  add(wb, summary('Portfolio Fact Sheet · All accounts', [
    ...who(null, r), ['As of', day(r.asOf)], ['Requested', r.date ? day(r.date) : 'Latest'], null,
    ['Portfolio value (₹)', num(r.portfolioValue)], ['Profit / loss (₹)', num(r.profitLoss)], ['Contribution (₹)', num(r.contribution)], ['Withdrawal (₹)', num(r.withdrawal)],
    ...(r.note ? [null, ['Note', r.note]] : []), ...failed(r),
  ]), 'Summary');
  add(wb, sheet([['Account', 'Strategy', 'As of', 'Portfolio value (₹)', 'Profit / loss (₹)', 'Contribution (₹)', 'Withdrawal (₹)'],
    ...sheets.map(({ accountId: id, data: d }) => (d && d.asOf ? [id, d.strategy || (d.holder && d.holder.strategy) || '', day(d.asOf), num(d.portfolioValue), num(d.profitLoss), num(d.contribution), num(d.withdrawal)] : [id, 'No fact sheet for this date']))],
    [12, 30, 12, 18, 16, 16, 16]), 'By account');
  for (const { accountId: id, data } of sheets) if (data && data.asOf) factsheetSheets(wb, data, id, id + ' ');
  return wb;
}

// ── Profit and loss account - Balance sheet ───────────────────────────────────────────────────────────────
export function plbsXlsx(r, accountId) {
  const P = r.pnl, U = r.unrealised, L = r.balanceSheet.liabilities, A = r.balanceSheet.assets, R = r.reconciliation || {};
  const wb = book();
  add(wb, summary('Profit and Loss Account - Balance Sheet', [
    ...who(accountId, r), ['Period', `${day(r.from)} to ${day(r.to)}`], ['Basis', r.computed ? 'Computed by Qode' : 'Nuvama report'],
    ...(r.computed && r.note ? [['Note', r.note]] : []), ...(r.omitted && r.omitted.length ? [['Not included', r.omitted.join(', ')]] : []), null,
    ['Total income (₹)', num(P.incomeTotal)], ['Total expenses (₹)', num(P.expenseTotal)], ['Surplus for the period (₹)', num(P.surplus)], ['Unrealised, net (₹)', num(U.net)],
    ...(R.portfolioValue != null ? [[`Portfolio value (₹) · ${day(r.to)}`, num(R.portfolioValue)]] : []),
  ]), 'Summary');
  const pnl = [['Profit and loss account', '', 'Amount (₹)'], ['Income'], ...P.income.map(x => [x.label, x.note || '', num(x.amount)]), ['Total income', '', num(P.incomeTotal)], [],
    ['Expenses'], ...P.expenses.map(x => [x.label, '', num(x.amount)]), ['Total expenses', '', num(P.expenseTotal)], [], ['Surplus for the period', '', num(P.surplus)], [],
    ['Unrealised gain / loss in the value of investments', '', 'Amount (₹)'],
    ['At the end of the period', num(U.investments.end)], ['At the beginning of the period', num(U.investments.begin)], ['Net unrealised gain / loss during the period', '', num(U.investments.net)],
    ...(U.options ? [['At the end of the period (options)', num(U.options.end)], ['At the beginning of the period (options)', num(U.options.begin)], ['Net unrealised gain / loss during the period (options)', '', num(U.options.net)]] : []),
    ['Net unrealised gain / loss', '', num(U.net)]];
  add(wb, sheet(pnl, [52, 18, 18]), 'Profit and loss');
  const bs = [['Liabilities', '', 'Amount (₹)'], ['Capital contribution', '', num(L.capital)], ['Less: withdrawals', '', num(L.withdrawals)],
    ['Reserves and surplus'], ['Beginning', num(L.reserves.begin)], ['For the period', num(L.reserves.period)], ['Ending', '', num(L.reserves.end)],
    ['Current liabilities and provisions'], ...L.current.map(x => [x.label, num(x.amount)]), ['Total current liabilities', '', num(L.currentTotal)],
    ...(L.difference ? [['Other / reconciliation', '', num(L.difference)]] : []), ['Total liabilities', '', num(L.total)], [],
    ['Assets', '', 'Amount (₹)'], ['Investments at cost', '', num(A.investmentsAtCost)],
    ...(A.optionsPosition != null ? [['Net options purchase position', '', num(A.optionsPosition)]] : []),
    ...(A.futuresMargin != null ? [['Futures margin account', '', num(A.futuresMargin)]] : []),
    ...(A.optionsMargin != null ? [['Options margin account', '', num(A.optionsMargin)]] : []),
    ['Current assets'], ...A.current.map(x => [x.label, num(x.amount), '', x.note || '']), ['Total current assets', '', num(A.currentTotal)], ['Total assets', '', num(A.total)]];
  add(wb, sheet(bs, [44, 18, 18, 40]), `Balance sheet ${day(r.to)}`);
  if (R.portfolioValue != null || R.expected != null) {
    add(wb, sheet([['Reconciliation', 'Amount (₹)'],
      ...(R.portfolioValue != null ? [[`Portfolio value on ${day(r.to)}`, num(R.portfolioValue)], ['Total assets at cost + unrealised gain − current liabilities', num(R.valueFromStatement)], ['Difference', num(R.valueDiff)]] : []),
      ...(R.expected != null ? [['Surplus implied by the change in value', num(R.expected)], ['Surplus in the profit and loss account', num(R.computed)], ['Difference', num(R.diff)]] : []),
      ...(R.note ? [[], ['Note', R.note]] : [])], [60, 18]), 'Reconciliation');
  }
  return wb;
}

// ── Saving ────────────────────────────────────────────────────────────────────────────────────────────────
// Web: the browser's download. Phone: the file is written to the app's cache and handed to the share sheet (Save to
// Files / Drive, mail, WhatsApp…). Never two at once.
const MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
let job = null;
export async function saveXlsx(wb, fileName, { source } = {}) {
  if (job) return job;
  const safe = String(fileName || 'statement').replace(/[^\w .()-]/g, '-').replace(/\s+/g, ' ').trim() || 'statement';
  const kind = safe.split(/\s+(?=Q[A-Z]{2}\d|All accounts|\d|FY\b)/)[0].trim() || 'statement';
  track('event', 'xlsx_download', { kind, source: source || 'reports' });
  job = (async () => {
    if (Platform.OS === 'web') { XLSX.writeFile(wb, safe + '.xlsx', { bookType: 'xlsx', compression: true }); return {}; }
    const b64 = XLSX.write(wb, { type: 'base64', bookType: 'xlsx', compression: true });
    const uri = FileSystem.cacheDirectory + safe + '.xlsx';
    await FileSystem.writeAsStringAsync(uri, b64, { encoding: FileSystem.EncodingType.Base64 });
    if (!(await Sharing.isAvailableAsync())) throw new Error('Sharing is not available on this phone, so the Excel file could not be saved.');
    await Sharing.shareAsync(uri, { mimeType: MIME, dialogTitle: safe, UTI: 'org.openxmlformats.spreadsheetml.sheet' });
    return { uri };
  })().finally(() => { job = null; });
  return job;
}
