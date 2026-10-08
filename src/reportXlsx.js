// The Reports page's statements as Excel workbooks (web src/web/reports.js, phone src/screens/reports.js), from the
// same report data the PDFs are built from (src/screens/reportPdf.js), so the two always agree. Each workbook opens
// with a "Summary" sheet (what the statement is, whose, the period, the totals), then the figures as plain numbers
// and dates (YYYY-MM-DD) that Excel can sort and sum. "All accounts" statements (src/combine.js) get an Account
// column. Plain JS with no React Native imports except in saveXlsx, so node can load the builders.
// xlsx-js-style is SheetJS with cell styles (the free SheetJS build can't write colours), so the workbooks carry
// Qode's colours: see style() below.
import * as XLSX from 'xlsx-js-style';
import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { track } from './api/track';
import { splitGains, BUSINESS_NOTE } from './businessIncome';

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

// Qode's colours, as in the app (src/ui.js) and the PDFs (src/screens/reportPdf.js): column headers dark green with
// cream text, the title in green over a gold rule, section rows on a gold tint, totals bold over a green rule, and
// figures with thousands separators, negatives in red.
const Q = { green: '02422B', cream: 'EFECD3', gold: 'DABD38', muted: '37584F', goldTint: 'F5EDC8', hair: 'DCD8C0', neg: 'C62828' };
const FONT = 'Calibri';
const font = (o = {}) => ({ name: FONT, sz: 11, color: { rgb: o.c || '002017' }, bold: !!o.b, ...(o.sz ? { sz: o.sz } : {}) });
const fill = rgb => ({ patternType: 'solid', fgColor: { rgb } });
const line = rgb => ({ style: 'thin', color: { rgb } });
// Amounts and percentages to 2 decimals; counts (#, entries, quantity, days held) as whole numbers when they are.
const COUNT = /^(#|Entries|Quantity|Days held)$/;
const numFmt = (v, head) => (COUNT.test(head || '') && Number.isInteger(v) ? '#,##0;[Red]-#,##0' : '#,##0.00;[Red]-#,##0.00');
const TOTAL = /^(Total\b|Surplus for the period|Net unrealised gain \/ loss$|Ending$)/;
function style(ws, isSummary) {
  if (!ws['!ref']) return ws;
  const R = XLSX.utils.decode_range(ws['!ref']), last = R.e.c;
  const at = (r, c) => XLSX.utils.encode_cell({ r, c });
  const get = (r, c) => ws[at(r, c)];
  const put = (r, c) => ws[at(r, c)] || (ws[at(r, c)] = { t: 's', v: '' });   // a blank cell, so a band fills the row
  const heads = []; for (let c = 0; c <= last; c++) { const h = get(R.s.r, c); heads[c] = h ? String(h.v) : ''; }   // first-row labels
  for (let r = R.s.r; r <= R.e.r; r++) {
    const cells = []; for (let c = 0; c <= last; c++) { const x = get(r, c); if (x && x.v !== '' && x.v != null) cells.push(c); }
    if (!cells.length) continue;
    const first = get(r, 0), label = first && typeof first.v === 'string' ? first.v : '';
    if (isSummary) {
      if (r === 0) {   // the title, across both columns over a gold rule
        for (let c = 0; c <= last; c++) put(r, c).s = { font: font({ b: true, sz: 14, c: Q.green }), border: { bottom: { style: 'medium', color: { rgb: Q.gold } } } };
        if (last > 0) ws['!merges'] = [...(ws['!merges'] || []), { s: { r: 0, c: 0 }, e: { r: 0, c: last } }];
        continue;
      }
      if (first) first.s = { font: font({ b: true, c: Q.muted }), alignment: { vertical: 'top' } };
      for (let c = 1; c <= last; c++) { const x = get(r, c); if (x) x.s = { font: font(), alignment: { wrapText: true, vertical: 'top', horizontal: x.t === 'n' ? 'right' : 'left' }, ...(x.t === 'n' ? { numFmt: numFmt(x.v) } : {}) }; }
      continue;
    }
    const head = r === 0 || cells.some(c => get(r, c).v === 'Amount (₹)');
    const section = !head && cells.length === 1 && cells[0] === 0 && typeof first.v === 'string';
    const total = !head && !section && TOTAL.test(label);
    if (head || section) {
      for (let c = 0; c <= last; c++) {
        put(r, c).s = head
          ? { font: font({ b: true, c: Q.cream }), fill: fill(Q.green), alignment: { vertical: 'center', wrapText: true, horizontal: c && get(r, c).v ? 'center' : 'left' }, border: { right: line(Q.green) } }
          : { font: font({ b: true, c: Q.green }), fill: fill(Q.goldTint) };
      }
      continue;
    }
    for (let c = 0; c <= last; c++) {
      const x = get(r, c); if (!x && !total) continue;
      const y = x || put(r, c);
      y.s = { font: font({ b: total }), border: total ? { top: line(Q.green) } : { bottom: line(Q.hair) },
        alignment: { vertical: 'top', horizontal: y.t === 'n' ? 'right' : 'left' }, ...(y.t === 'n' ? { numFmt: numFmt(y.v, heads[c]) } : {}) };
    }
  }
  return ws;
}
const add = (wb, ws, title) => {
  const tab = String(title).replace(/[\\/?*[\]:]/g, ' ').slice(0, 31);
  XLSX.utils.book_append_sheet(wb, style(ws, /Summary$/.test(tab)), tab);
};
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
  const A = !accountId, S = splitGains(r.summary) || {};   // derivatives apart, as business income (src/businessIncome.js)
  const wb = book();
  add(wb, summary('Statement of Capital Gain / Loss', [
    ...who(accountId, r), ['As of', day(r.asOf)], ['Period', r.fy ? `Financial year ${r.fy}` : period(r.from, r.to)], null,
    ['Short term (₹)', num(S.st)], ['Long term (₹)', num(S.lt)], ['Long term, effective (₹)', num(S.ltTaxable)], ['Total realised (₹)', num(S.total)],
    ...(S.hasBusiness ? [['Business income, derivatives (₹)', num(S.business)], ['Business income', BUSINESS_NOTE]] : []),
    ...failed(r),
  ]), 'Summary');
  const B = !!S.hasBusiness;
  const cats = (S.byCategory || []).map(c => [c.category, num(c.st), num(c.lt), num(c.ltTaxable), ...(B ? [num(c.business)] : []), (c.st || 0) + (c.lt || 0) + (c.business || 0)]);
  if (cats.length) add(wb, sheet([['Category', 'Short term (₹)', 'Long term (₹)', 'Long term, effective (₹)', ...(B ? ['Business income (₹)'] : []), 'Total (₹)'], ...cats], [28, 16, 16, 22, ...(B ? [20] : []), 16]), 'By category');
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
