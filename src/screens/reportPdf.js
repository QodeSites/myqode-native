// PDF statements for the Reports page, in the myQode design (colours from src/ui.js → C): a dark-green header
// band with the gold wordmark, a cream account strip, gold-edged figure tiles, green-headed tables with cream
// zebra rows. The content follows the custodian's (Nuvama WealthSpectrum) statements clients already know.
// Each builder returns { html, landscape } for savePdf (src/screens/partner.js); iOS supplies the page margins.

import { transactionsSummary, capitalGainsSummary, expensesSummary, factsheetSummary, pnlSummary } from '../reportSummary.js';

const K = {
  ink: '#002017', green: '#02422B', gold: '#DABD38', cream: '#EFECD3', card: '#F7F5E9', muted: '#37584F',
  hair: '#DCD8C0', pos: '#15803D', neg: '#C62828', goldTint: '#F5EDC8',
};
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
// Figures: Indian grouping, 2 decimals, "−" for negatives; sign on the rounded value (no "−0.00").
const nf = (v, dp = 2) => {
  if (v == null || isNaN(v)) return '';
  const r = +(+v).toFixed(dp);
  return (r < 0 ? '−' : '') + Math.abs(r).toLocaleString('en-IN', { minimumFractionDigits: dp, maximumFractionDigits: dp });
};
const inr = (v, dp = 2) => (v == null || isNaN(v) ? '–' : (+(+v).toFixed(dp) < 0 ? '−' : '') + '₹' + nf(Math.abs(v), dp));
const qty = v => (v == null ? '' : Number(v).toLocaleString('en-IN', { maximumFractionDigits: 4 }));
const pc = v => (v == null || isNaN(v) ? '–' : (+(+v).toFixed(2) < 0 ? '−' : '') + Math.abs(+v).toFixed(2) + '%');
const MS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MON = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
// Dates: "25 Sep 2026" in headers, "25/09/26" in dense tables.
const dl = iso => (iso ? `${iso.slice(8, 10)} ${MS[+iso.slice(5, 7) - 1]} ${iso.slice(0, 4)}` : '–');
const ds = iso => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(2, 4)}` : '');
const today = () => { const t = new Date(); return `${String(t.getDate()).padStart(2, '0')} ${MS[t.getMonth()]} ${t.getFullYear()}`; };
const cls = v => (v == null || isNaN(v) ? '' : +(+v).toFixed(2) < 0 ? 'neg' : +(+v).toFixed(2) > 0 ? 'pos' : '');

const CSS = landscape => `
  @page { size: A4 ${landscape ? 'landscape' : 'portrait'}; margin: 10mm; }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  html, body { width: 100%; }
  body { font-family: -apple-system, 'Helvetica Neue', Roboto, Arial, sans-serif; color: ${K.ink}; font-size: ${landscape ? 7.3 : 7.8}pt; margin: 0; line-height: 1.35; }
  .band { background: linear-gradient(120deg, ${K.green} 0%, ${K.ink} 75%); color: ${K.cream}; border-radius: 6px; padding: 14px 18px 13px; display: table; width: 100%; }
  .band > div { display: table-cell; vertical-align: middle; }
  .wm { font-family: 'Playfair Display', Georgia, 'Times New Roman', serif; color: ${K.gold}; font-weight: 600; font-size: 26pt; line-height: 1; letter-spacing: .2px; }
  .wm small { font-size: 14pt; }
  .firm { font-size: 6.6pt; letter-spacing: 1.4px; color: rgba(239,236,211,.7); margin-top: 5px; }
  .rt { text-align: right; }
  .rtitle { font-family: 'Playfair Display', Georgia, serif; font-size: ${landscape ? 16 : 15}pt; font-weight: 600; color: ${K.cream}; }
  .accent { width: 38px; height: 2px; background: ${K.gold}; margin: 7px 0 0 auto; }
  .period { font-size: 8pt; font-weight: 700; color: ${K.gold}; margin-top: 6px; letter-spacing: .3px; }
  .asof { font-size: 7.4pt; color: rgba(239,236,211,.75); margin-top: 6px; letter-spacing: .3px; }
  .strip { background: ${K.card}; border: 1px solid ${K.hair}; border-radius: 6px; margin-top: 8px; padding: 8px 12px; display: table; width: 100%; table-layout: fixed; }
  .strip > div { display: table-cell; vertical-align: top; padding-right: 10px; }
  .lbl { font-size: 6.2pt; font-weight: 700; letter-spacing: 1.1px; color: ${K.muted}; text-transform: uppercase; }
  .val { font-size: 8.4pt; font-weight: 600; margin-top: 2px; }
  .tiles { display: table; width: 100%; table-layout: fixed; border-spacing: 8px 0; margin: 10px -8px 2px; }
  .tile { display: table-cell; background: ${K.card}; border: 1px solid ${K.hair}; border-top: 2.5px solid ${K.gold}; border-radius: 5px; padding: 8px 10px; }
  .tile .v { font-size: var(--tv, 11.5pt); font-weight: 700; margin-top: 3px; font-variant-numeric: tabular-nums; white-space: nowrap; }
  table[style*="--n"] td.r { font-size: var(--n); }
  h3 { font-family: 'Playfair Display', Georgia, serif; font-size: 10.5pt; font-weight: 600; color: ${K.green}; margin: 14px 0 5px; }
  h3::after { content: ''; display: block; width: 26px; height: 1.6px; background: ${K.gold}; margin-top: 3px; }
  table { width: 100%; border-collapse: collapse; }
  table.fixed { table-layout: fixed; }
  thead { display: table-header-group; }
  tr { page-break-inside: avoid; }
  th { background: ${K.green}; color: ${K.cream}; font-weight: 700; font-size: .92em; letter-spacing: .2px; text-align: left; padding: 5px 5px; vertical-align: bottom; }
  thead tr.grp th { background: ${K.ink}; color: ${K.gold}; text-align: center; font-size: .85em; letter-spacing: 1px; text-transform: uppercase; padding: 3px 5px; }
  td { padding: 4px 5px; vertical-align: top; border-bottom: .5px solid ${K.hair}; }
  tbody tr.z:nth-child(even) td { background: ${K.card}; }
  .r { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
  th.r { white-space: normal; }
  td.wrap { word-wrap: break-word; }
  .sec td { background: ${K.goldTint} !important; color: ${K.green}; font-weight: 700; letter-spacing: .2px; border-bottom: 1px solid ${K.gold}; }
  .tot td { font-weight: 700; border-top: 1.5px solid ${K.green}; border-bottom: none; background: none !important; color: ${K.green}; }
  .pos { color: ${K.pos}; } .neg { color: ${K.neg}; }
  .note { color: ${K.muted}; font-size: 6.8pt; margin-top: 4px; line-height: 1.45; }
  .two { display: table; width: 100%; table-layout: fixed; }
  .two > div { display: table-cell; vertical-align: top; }
  .two > div:first-child { padding-right: 16px; }
  .bar { height: 6px; background: ${K.hair}; border-radius: 3px; overflow: hidden; margin-top: 3px; }
  .bar > i { display: block; height: 6px; background: ${K.green}; border-radius: 3px; }
  .srow { padding: 4px 0 5px; border-bottom: .5px solid ${K.hair}; }
  .srow b { float: right; font-variant-numeric: tabular-nums; }
  .dot { display: inline-block; width: 7px; height: 7px; border-radius: 2px; margin-right: 5px; vertical-align: 0; }
  .ft { margin-top: 16px; border-top: 1.4px solid ${K.gold}; padding-top: 5px; display: table; width: 100%; font-size: 6.6pt; color: ${K.muted}; }
  .ft > div { display: table-cell; vertical-align: top; }
  .pb { page-break-before: always; }
  .sum { margin-top: 8px; border: 1px solid ${K.hair}; border-left: 3px solid ${K.gold}; border-radius: 5px; background: ${K.card}; padding: 8px 12px; }
  .sum p { margin: 3px 0 0; font-size: 8.6pt; line-height: 1.5; }
  table.stmt td { border-bottom: none; padding: 3.5px 6px; }
  table.stmt tr.sh td { color: #8A700C; font-weight: 700; font-size: .86em; letter-spacing: 1px; text-transform: uppercase; padding-top: 9px; }
  table.stmt tr.sub td:first-child { padding-left: 16px; }
  table.stmt tr.st td { font-weight: 700; border-top: .8px solid ${K.muted}; }
  table.stmt tr.gt td { font-weight: 700; color: ${K.green}; border-top: 1.2px solid ${K.green}; border-bottom: 2.6px double ${K.green}; }
  table.stmt td.mid { color: ${K.muted}; }
  .bs { display: table; width: 100%; table-layout: fixed; border: 1px solid ${K.hair}; border-radius: 5px; }
  .bs > div { display: table-cell; vertical-align: top; padding: 6px 8px 8px; }
  .bs > div + div { border-left: 1px solid ${K.hair}; }
  .bs h4 { margin: 2px 0 4px; font-size: 8.4pt; color: ${K.green}; font-weight: 700; letter-spacing: .3px; }
`;
// summary: plain sentences (src/reportSummary.js) printed under the header, before any figures or tables.
// Off in the phone app (the Reports screen there has no summaries either); on for the web. main.js decides.
let showSummaries = true;
export const setPdfSummaries = on => { showSummaries = !!on; };
const summaryBlock = lines => (showSummaries && lines && lines.length ? `<div class="sum"><div class="lbl">Summary</div><p>${esc(lines.join(' '))}</p></div>` : '');
// Figures never overflow their box: a cell keeps one line (nowrap), so a long amount (crores) would run past the
// column and off the page. Before printing, each fixed table's figure size is lowered, when needed, until its
// longest figure fits its column; the tile row likewise. Widths are the A4 content box in points (page margins off).
const CONTENT_PT = { portrait: 530, landscape: 775 };
const EM_FIG = 0.56;   // advance of a digit / sign in em (Helvetica, Roboto); commas and points are narrower
const MIN_PT = 5.2;
const plain = h => h.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&[a-z]+;/g, 'x').trim();
function fitTables(html, W, base) {
  return html.replace(/<table class="fixed([^"]*)"(?: data-frac="([\d.]+)")?>([\s\S]*?)<\/table>/g, (whole, _kind, frac, inner) => {
    const tw = frac ? W * +frac - 13 : W;
    const cols = [...((inner.match(/<colgroup>([\s\S]*?)<\/colgroup>/) || [])[1] || '').matchAll(/<col(?: style="width:([\d.]+)%")?>/g)].map(m => (m[1] ? +m[1] : null));
    if (!cols.length) return whole;
    const fixedSum = cols.reduce((s, w) => s + (w || 0), 0), autos = cols.filter(w => w == null).length;
    const pct = cols.map(w => (w != null ? w : Math.max(0, 100 - fixedSum) / (autos || 1)));
    let pt = base;
    for (const row of inner.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)) {
      let ci = 0;
      for (const cell of row[1].matchAll(/<t([dh])([^>]*)>([\s\S]*?)<\/t\1>/g)) {
        const span = +((cell[2].match(/colspan="(\d+)"/) || [])[1] || 1);
        const isFig = cell[1] === 'd' && /class="[^"]*\br\b/.test(cell[2]);
        if (isFig) {
          const len = plain(cell[3]).length, wPt = pct.slice(ci, ci + span).reduce((s, p) => s + p, 0) / 100 * tw - 9;
          if (len && wPt > 0) pt = Math.min(pt, wPt / (len * EM_FIG));
        }
        ci += span;
      }
    }
    return pt >= base ? whole : whole.replace('<table ', `<table style="--n:${Math.max(MIN_PT, pt).toFixed(2)}pt" `);
  });
}
function fitTiles(html, W) {
  return html.replace(/<div class="tiles" data-fit="(\d+),(\d+)">/g, (_, n, len) => {
    const inner = (W - 6 * (+n + 1)) / +n - 17;
    const pt = Math.min(11.5, inner / (+len * (EM_FIG + 0.05)));
    return `<div class="tiles" style="--tv:${Math.max(6, pt).toFixed(2)}pt">`;
  });
}
// Column headers on every page. Browsers repeat a table's <thead> when it breaks across pages, but the iOS print
// engine does not, and Android prints with scripts off, so the split is made here: a long table is cut into
// page-sized tables, each with its own header rows, with a page break between them. Heights are estimated on the
// high side (a page may end a little early, but a continued table never starts without its header).
// PAGE_PT: usable A4 height in points, under both engines' content box (Chrome / Android 277 mm; iOS 778 pt).
const PAGE_PT = { portrait: 745, landscape: 505 };
const BLOCK_PT = { band: 90, strip: 52, tiles: 64, h3: 30, note: 15, srow: 23, sum: 64 };
function rowHeight(row, pct, tw, fs, th) {
  let ci = 0, lines = 1;
  for (const cell of row.matchAll(/<t([dh])([^>]*)>([\s\S]*?)<\/t\1>/g)) {
    const span = +((cell[2].match(/colspan="(\d+)"/) || [])[1] || 1);
    const wPt = pct.slice(ci, ci + span).reduce((s, p) => s + p, 0) / 100 * tw - 8;
    const figure = /class="[^"]*\br\b/.test(cell[2]) && !th;
    const text = plain(cell[3]), f = th ? fs * 0.92 : fs;
    let n = figure || !text ? 1 : Math.ceil(text.length * 0.52 * f / Math.max(12, wPt));
    if (/class="note"/.test(cell[3])) n += 1 + Math.floor(plain((cell[3].match(/<div class="note"[^>]*>([\s\S]*?)<\/div>/) || [])[1] || '').length * 0.5 * f * 0.87 / Math.max(12, wPt));
    lines = Math.max(lines, n);
    ci += span;
  }
  return lines * fs * 1.38 + (th ? 9 : 7.5);
}
function tableParts(inner, W) {
  const colgroup = (inner.match(/<colgroup>[\s\S]*?<\/colgroup>/) || [''])[0];
  const cols = [...colgroup.matchAll(/<col(?: style="width:([\d.]+)%")?>/g)].map(m => (m[1] ? +m[1] : null));
  const fixedSum = cols.reduce((s, w) => s + (w || 0), 0), autos = cols.filter(w => w == null).length;
  const pct = cols.map(w => (w != null ? w : Math.max(0, 100 - fixedSum) / (autos || 1)));
  const thead = (inner.match(/<thead>[\s\S]*?<\/thead>/) || [''])[0];
  const body = (inner.match(/<tbody>([\s\S]*)<\/tbody>/) || [, ''])[1];
  return { colgroup, pct: pct.length ? pct : [100], thead, rows: body.match(/<tr[^>]*>[\s\S]*?<\/tr>/g) || [], tw: W };
}
function paginate(html, W, H, fs) {
  const re = /<div class="pb"><\/div>|<div class="band">|<div class="strip">|<div class="tiles"|<h3>|<p class="note"|<div class="srow">|<div class="sum">|<table([^>]*)>([\s\S]*?)<\/table>/g;
  let out = '', last = 0, y = 0, h3At = -1, m;
  while ((m = re.exec(html))) {
    out += html.slice(last, m.index);
    last = re.lastIndex;
    const tok = m[0];
    if (!tok.startsWith('<table')) {
      if (tok.startsWith('<div class="pb"')) y = 0;
      else y += BLOCK_PT[(tok.match(/class="(\w+)"/) || [, 'h3'])[1]] || BLOCK_PT.h3;
      h3At = tok === '<h3>' ? out.length : -1;
      out += tok;
      continue;
    }
    const attrs = m[1], P = tableParts(m[2], W);
    const headH = (P.thead.match(/<tr[^>]*>[\s\S]*?<\/tr>/g) || []).reduce((s, r) => s + rowHeight(r, P.pct, P.tw, fs, true), 0);
    const hs = P.rows.map(r => rowHeight(r, P.pct, P.tw, fs, false));
    // Side-by-side tables (data-frac) and tables without a header or rows are never split; they only move the cursor.
    if (/data-frac/.test(attrs) || !/class="fixed/.test(attrs) || !P.thead || !P.rows.length) {
      y += headH + hs.reduce((s, h) => s + h, 0) * (/data-frac/.test(attrs) ? 0.5 : 1);
      out += tok; h3At = -1;
      continue;
    }
    // Not even the header and a few rows fit below what is already on the page: start the table (and its heading) on a new one.
    const lead = hs.slice(0, 3).reduce((s, h) => s + h, 0);
    if (y > 0 && y + headH + lead > H) {
      const brk = '<div class="pb"></div>';
      if (h3At >= 0) { out = out.slice(0, h3At) + brk + out.slice(h3At); y = BLOCK_PT.h3; } else { out += brk; y = 0; }
    }
    const pieces = [[]];
    y += headH;
    P.rows.forEach((row, i) => {
      const cur = pieces[pieces.length - 1];
      if (cur.length && y + hs[i] > H) {
        // A month / section heading row never ends a page on its own: it moves on with the rows it heads.
        const carry = /class="sec"/.test(cur[cur.length - 1].row) && cur.length > 1 ? [cur.pop()] : [];
        pieces.push(carry);
        y = headH + carry.reduce((s, c) => s + c.h, 0);
      }
      pieces[pieces.length - 1].push({ row, h: hs[i] });
      y += hs[i];
    });
    out += pieces.map(list => `<table${attrs}>${P.colgroup}${P.thead}<tbody>${list.map(c => c.row).join('')}</tbody></table>`).join('<div class="pb"></div>');
    h3At = -1;
  }
  return out + html.slice(last);
}
const page = (landscape, head, body, summary) => `<!doctype html><html data-report="1"><head><meta charset="utf-8"><style>${CSS(landscape)}</style></head><body>${paginate(head + summaryBlock(summary) + fitTiles(fitTables(body, CONTENT_PT[landscape ? 'landscape' : 'portrait'], landscape ? 7.3 : 7.8), CONTENT_PT[landscape ? 'landscape' : 'portrait']), CONTENT_PT[landscape ? 'landscape' : 'portrait'], PAGE_PT[landscape ? 'landscape' : 'portrait'], landscape ? 7.3 : 7.8)}
<div class="ft"><div><b style="color:${K.green}">Qode Advisors LLP</b> · SEBI Registered Portfolio Manager · Data: Nuvama WealthSpectrum (custodian)<br>This is a computer generated report and does not require a signature.</div><div class="rt">Generated ${today()}<br>from the myQode app</div></div></body></html>`;

// Reporting period line under the title: both ends, one open end, or (when allowed) "All records".
const periodLine = (from, to, allLabel) => (from && to ? `Period: ${dl(from)} to ${dl(to)}` : from ? `From ${dl(from)}` : to ? `Up to ${dl(to)}` : allLabel || '');
// Header band + account strip. fields: [[label, value]]. period: text shown under the title (optional).
const header = (title, asOf, fields, period) => `
  <div class="band"><div><div class="wm"><small>my</small>Qode</div><div class="firm">QODE ADVISORS LLP · SEBI REGISTERED PMS</div></div>
    <div class="rt"><div class="rtitle">${esc(title)}</div><div class="accent"></div>${period ? `<div class="period">${esc(period)}</div>` : ''}${asOf ? `<div class="asof">As of ${esc(dl(asOf))}</div>` : ''}</div></div>
  <div class="strip">${fields.filter(f => f && f[1]).map(([l, v]) => `<div><div class="lbl">${esc(l)}</div><div class="val">${esc(v)}</div></div>`).join('')}</div>`;
const tiles = list => `<div class="tiles" data-fit="${list.length},${Math.max(1, ...list.map(t => plain(String(t[1])).length))}">${list.map(([l, v, c]) => `<div class="tile"><div class="lbl">${esc(l)}</div><div class="v ${c || ''}">${v}</div></div>`).join('')}</div>`;
const strategyName = (holder, fallback) => String((holder && holder.strategy) || fallback || '').replace(/^QODE ADVISORS LLP - /i, '');
const acctFields = (accountId, holder, fallbackStrategy) => [['Account', accountId], ['Account holder', holder && holder.name], ['Strategy', strategyName(holder, fallbackStrategy)]];

// ── Transaction statement ─────────────────────────────────────────────────────────────────────────────────
// Nuvama's transaction statement layout in Qode's colours (landscape): one section per asset class (Shares –
// Listed, Equity ETF, Liquid ETF, Options – Index, Initial Margin, then cash and bank entries), oldest first, with
// exchange, unit price, brokerage, STT and Nuvama's settlement amount (STT added to a purchase, taken off a sale),
// then a summary per transaction type: settled during the period, not yet settled, total.
const CLASS_ORDER = ['Shares - Listed', 'Shares - Equity ETF', 'Shares - Liquid ETF', 'Shares', 'Mutual Fund', 'Bonds', 'Options - Index', 'Options', 'Futures', 'Options - Initial Margin'];
const classRank = c => {
  if (!c) return 90;
  if (/^Cash/i.test(c)) return 80;
  if (/^Fixed Deposit/i.test(c)) return 85;
  const i = CLASS_ORDER.indexOf(c); if (i >= 0) return i;
  const j = CLASS_ORDER.findIndex(x => c.startsWith(x)); return j >= 0 ? j + 0.5 : 70;
};
const classLabel = c => (!c ? 'Other' : /^Cash/i.test(c) ? 'Cash and bank' : /^Fixed Deposit/i.test(c) ? 'Fixed deposits' : c.replace(/ - /g, ' – '));
const settleAmt = t => (t.settlement != null ? t.settlement : t.amount);
function statementBody(r, withAccount) {
  const end = r.to || r.asOf || '';
  const items = r.items.map((t, i) => ({ ...t, _i: i }))
    .sort((x, y) => classRank(x.assetClass) - classRank(y.assetClass) || String(x.assetClass || '').localeCompare(String(y.assetClass || ''))
      || String(x.date || '').localeCompare(String(y.date || ''))
      || (x.type < y.type ? -1 : x.type > y.type ? 1 : 0) || (x.security < y.security ? -1 : x.security > y.security ? 1 : 0) || y._i - x._i);   // same day: by transaction, then security (as Nuvama orders it)
  const cols = withAccount ? 11 : 10;
  let last = null;
  const rows = items.map(t => {
    const cls = classLabel(t.assetClass), sec = cls !== last ? `<tr class="sec"><td colspan="${cols}">${esc(cls)}</td></tr>` : '';
    last = cls;
    const cash = /^Cash|^Fixed/i.test(t.assetClass || '');   // cash and deposit entries: the amount only
    return sec + `<tr class="z"><td class="wrap">${esc(t.type)}</td>${withAccount ? `<td class="wrap">${esc(t.account)}</td>` : ''}<td>${ds(t.date)}</td><td>${ds(t.settleDate)}</td>
      <td class="wrap">${esc(t.security || t.notes || '')}</td><td>${esc(t.exchange || '')}</td><td class="r">${!cash && t.qty != null ? nf(t.qty, 3) : ''}</td>
      <td class="r">${!cash && t.rate != null ? nf(t.rate, 4) : ''}</td><td class="r">${!cash && t.brokerage != null ? (+t.brokerage).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 4 }) : ''}</td><td class="r">${!cash && t.stt != null ? nf(t.stt) : ''}</td>
      <td class="r">${nf(settleAmt(t))}</td></tr>`;
  }).join('');
  // summary per transaction type, in the order the types first appear
  const sum = new Map();
  for (const t of items) {
    const k = t.type || 'Other', v = settleAmt(t) || 0, settled = !!t.settleDate && (!end || t.settleDate <= end);
    const s = sum.get(k) || { done: 0, open: 0 }; settled ? (s.done += v) : (s.open += v); sum.set(k, s);
  }
  const sumRows = [...sum].map(([k, v]) => `<tr class="z"><td>${esc(k)}</td><td class="r">${nf(v.done)}</td><td class="r">${nf(v.open)}</td><td class="r">${nf(v.done + v.open)}</td></tr>`).join('');
  const w = withAccount
    ? ['13%', '8%', '6.5%', '6.5%', '', '4.5%', '8%', '7.5%', '5.5%', '5%', '10%']
    : ['14%', '6.5%', '6.5%', '', '4.5%', '8.5%', '8%', '6%', '5.5%', '10.5%'];
  return `${r.items.length ? '' : '<p class="note">No transactions in this period.</p>'}<h3>Transactions · ${r.items.length}${r.hasMore || r.truncated ? ' <span class="note">(latest 5,000)</span>' : ''}</h3>
    <table class="fixed"><colgroup>${w.map(x => (x ? `<col style="width:${x}">` : '<col>')).join('')}</colgroup>
    <thead><tr><th>Transaction</th>${withAccount ? '<th>Account</th>' : ''}<th>Trade date</th><th>Settlement date</th><th>Security</th><th>Exch.</th><th class="r">Quantity</th><th class="r">Unit price</th><th class="r">Brokerage</th><th class="r">STT</th><th class="r">Settlement amount (₹)</th></tr></thead>
    <tbody>${rows}</tbody></table>
    ${sum.size ? `<h3>Transaction statement summary</h3>
    <table class="fixed" style="width:70%"><colgroup><col><col style="width:22%"><col style="width:22%"><col style="width:22%"></colgroup>
    <thead><tr><th>Transaction</th><th class="r">Settled during the period (₹)</th><th class="r">Not yet settled (₹)</th><th class="r">Total (₹)</th></tr></thead><tbody>${sumRows}</tbody></table>` : ''}
    <p class="note">Settlement amount: the amount settled for the trade, including STT on purchases and net of STT on sales. Securities transferred in are dated by the day they reached the account.</p>`;
}
export function transactionsPdf(r, accountId, groupLabel) {
  const head = header('Transaction Statement', r.asOf, [...acctFields(accountId, r.holder), ['Showing', groupLabel || 'All']], periodLine(r.from, r.to, 'All records'));
  return { html: page(true, head, statementBody(r, false), transactionsSummary(r, false)), landscape: true };
}

// ── Capital gain / loss (landscape; per category, with the advance-tax quarter summary) ──────────────────
const QUARTERS = ['01/04–15/06', '16/06–15/09', '16/09–15/12', '16/12–15/03', '16/03–31/03'];
const quarterOf = iso => {
  const k = +iso.slice(5, 7) * 100 + +iso.slice(8, 10);
  if (k >= 401 && k <= 615) return 0;
  if (k >= 616 && k <= 915) return 1;
  if (k >= 916 && k <= 1215) return 2;
  if (k >= 1216 || k <= 315) return 3;
  return 4;
};
export function capitalGainsPdf(r, accountId) {
  const head = header('Statement of Capital Gain / Loss', r.asOf, [...acctFields(accountId, r.holder), ['Period', cgPeriod(r)]],
    r.fy ? `Financial year ${r.fy}` : periodLine(r.from, r.to));
  return { html: page(true, head, cgBody(r), capitalGainsSummary(r, false)), landscape: true };
}
// Period text of a capital gains answer: by financial year (fy set) or by a sale-date range (fy null, from / to set).
function cgPeriod(r) {
  const from = r.fy ? `${r.fy.slice(0, 4)}-04-01` : null, fyEnd = r.fy ? `${+r.fy.slice(0, 4) + 1}-03-31` : null;
  const to = r.asOf && fyEnd && r.asOf < fyEnd ? r.asOf : fyEnd;
  const range = !r.fy && (r.from || r.to);
  return from ? `${dl(from)} to ${dl(to)}` : range ? `${r.from ? dl(r.from) : 'Earliest'} to ${dl(r.to || r.asOf)}` : '';
}
// Summary tiles and one section per category. A: with an Account column (all accounts).
function cgBody(r, A, afterTiles = '') {
  const S = r.summary || { st: 0, lt: 0, ltTaxable: 0, total: 0 };
  const sum = tiles([[r.fy ? `FY ${r.fy} · Short term` : 'Short term', inr(S.st), cls(S.st)], ['Long term', inr(S.lt), cls(S.lt)], ['Long term (effective)', inr(S.ltTaxable), cls(S.ltTaxable)], ['Total realised', inr(S.total), cls(S.total)]]);
  const cats = [];
  for (const l of r.items) { const c = l.category || 'Other'; let g = cats.find(x => x.c === c); if (!g) cats.push(g = { c, lots: [] }); g.lots.push(l); }
  const colg = '<colgroup>' + (A ? [7, 15, 6, 6, 7, 8, 6, 7, 8, 8, 4, 7, 6, 5] : [19, 6, 7, 7, 8, 6, 7, 8, 8, 4, 8, 6, 6]).map(w => `<col style="width:${w}%">`).join('') + '</colgroup>';
  const head2 = `${colg}<thead><tr class="grp">${A ? '<th></th>' : ''}<th></th><th colspan="4">Sale</th><th colspan="4">Purchase</th><th></th><th colspan="3">Realised gain / loss</th></tr>
    <tr>${A ? '<th>Account</th>' : ''}<th>Security</th><th>Date</th><th class="r">Quantity</th><th class="r">Rate (S)</th><th class="r">Amount</th><th>Date</th><th class="r">Rate (P)</th><th class="r">Amount</th>
    <th class="r">Effective cost</th><th class="r">Days</th><th class="r">Short term</th><th class="r">Long term</th><th class="r">Effective LT</th></tr></thead>`;
  const sections = cats.map((g, gi) => {
    const T = { sale: 0, pur: 0, cost: 0, st: 0, lt: 0, eff: 0 }, Q = { st: [0, 0, 0, 0, 0], lt: [0, 0, 0, 0, 0] };
    const rows = g.lots.map(l => {
      const st = l.term === 'ST' ? l.gain : 0, lt = l.term === 'LT' ? l.gain : 0, eff = l.term === 'LT' ? (l.ltTaxable != null ? l.ltTaxable : l.gain) : 0;
      T.sale += l.saleAmount || 0; T.pur += l.purchaseAmount || 0; T.cost += l.cost || 0; T.st += st; T.lt += lt; T.eff += eff;
      if (l.saleDate) { const q = quarterOf(l.saleDate); Q.st[q] += st; Q.lt[q] += eff; }
      return `<tr class="z">${A ? `<td class="wrap">${esc(l.account)}</td>` : ''}<td class="wrap">${esc(l.security)}</td><td>${ds(l.saleDate)}</td><td class="r">${qty(l.qty)}</td><td class="r">${l.saleRate != null ? nf(l.saleRate, 4) : ''}</td>
        <td class="r">${nf(l.saleAmount)}</td><td>${ds(l.purchaseDate)}</td><td class="r">${l.purchaseRate != null ? nf(l.purchaseRate, 4) : ''}</td><td class="r">${nf(l.purchaseAmount)}</td>
        <td class="r">${nf(l.cost)}</td><td class="r">${l.daysHeld != null ? l.daysHeld : ''}</td>
        <td class="r ${cls(st)}">${nf(st)}</td><td class="r ${cls(lt)}">${nf(lt)}</td><td class="r">${nf(eff)}</td></tr>`;
    }).join('');
    const quarters = `<h3>Quarter-wise summary · ${esc(g.c)}</h3>
      <table class="fixed"><colgroup><col style="width:13%">${QUARTERS.map(() => '<col style="width:10%">').join('')}<col style="width:10%"><col style="width:12%"><col style="width:15%"></colgroup>
      <thead><tr><th></th>${QUARTERS.map(q => `<th class="r">${q}</th>`).join('')}<th class="r">Total</th><th class="r">Sale value</th><th class="r">Effective cost</th></tr></thead><tbody>
      <tr class="z"><td><b>Short term</b></td>${Q.st.map(v => `<td class="r ${cls(v)}">${nf(v)}</td>`).join('')}<td class="r ${cls(T.st)}"><b>${nf(T.st)}</b></td><td class="r">${nf(T.sale)}</td><td class="r">${nf(T.cost)}</td></tr>
      <tr class="z"><td><b>Long term</b></td>${Q.lt.map(v => `<td class="r ${cls(v)}">${nf(v)}</td>`).join('')}<td class="r ${cls(T.eff)}"><b>${nf(T.eff)}</b></td><td></td><td></td></tr></tbody></table>
      <p class="note">Based on effective gain (after grandfathering / indexation). Quarters follow the advance-tax instalment dates.</p>`;
    return `${gi ? '<div class="pb"></div>' : ''}<h3>${esc(g.c)}</h3><table class="fixed">${head2}<tbody>${rows}
      <tr class="tot"><td>Total</td>${A ? '<td></td>' : ''}<td></td><td></td><td></td><td class="r">${nf(T.sale)}</td><td></td><td></td><td class="r">${nf(T.pur)}</td><td class="r">${nf(T.cost)}</td><td></td>
      <td class="r">${nf(T.st)}</td><td class="r">${nf(T.lt)}</td><td class="r">${nf(T.eff)}</td></tr></tbody></table>${quarters}`;
  }).join('');
  return sum + afterTiles + (cats.length ? sections : '<p class="note">No realised gains in this period.</p>') + (r.hasMore ? '<p class="note">Showing the latest 5,000 lots.</p>' : '');
}

// ── Statement of expenses ─────────────────────────────────────────────────────────────────────────────────
export function expensesPdf(r, accountId) {
  const head = header('Statement of Expenses', r.asOf, [...acctFields(accountId, r.holder, r.strategy), [r.from || r.to ? 'Statement covers' : 'Period', r.period ? `${dl(r.period.from)} to ${dl(r.period.to)}` : '']],
    periodLine(r.from, r.to));
  const top = tiles([['Paid', inr(r.paid)], ['Payable (accrued)', inr(r.payable)], ['Total', inr((r.paid || 0) + (r.payable || 0))]]);
  const max = Math.max(1, ...r.byType.map(t => t.amount || 0));
  const byType = `<h3>By charge</h3>${r.byType.map(t => `<div class="srow">${esc(t.type)} <span class="note">· ${t.count} ${t.count === 1 ? 'entry' : 'entries'}</span><b>${inr(t.amount)}</b>
    <div class="bar"><i style="width:${Math.max(1, (t.amount || 0) / max * 100).toFixed(1)}%"></i></div></div>`).join('')}`;
  const block = (label, status) => {
    const items = r.items.filter(x => (x.status || 'paid') === status);
    if (!items.length) return '';
    const tot = items.reduce((s, x) => s + (x.amount || 0), 0);
    return `<tr class="sec"><td colspan="5">${label}</td></tr>` + items.map(x => `<tr class="z"><td>${ds(x.date)}</td><td>${ds(x.settleDate)}</td><td>${esc(x.type)}</td><td class="wrap">${esc(x.notes || '')}</td><td class="r">${nf(x.amount)}</td></tr>`).join('')
      + `<tr class="tot"><td colspan="4">Total ${label.toLowerCase()}</td><td class="r">${nf(tot)}</td></tr>`;
  };
  const body = top + byType + `<h3>Entries${r.type ? ' · ' + esc(r.type) : ''}${r.hasMore ? ' <span class="note">(latest 5,000)</span>' : ''}</h3>
    <table class="fixed"><colgroup><col style="width:10%"><col style="width:10%"><col style="width:24%"><col><col style="width:15%"></colgroup>
    <thead><tr><th>Date</th><th>Settled</th><th>Charge</th><th>Description</th><th class="r">Amount (₹)</th></tr></thead><tbody>
    ${block('Expenses paid', 'paid')}${block('Expenses payable', 'payable')}</tbody></table>${r.items.length ? '' : '<p class="note">No expense entries in this period.</p>'}`;
  return { html: page(false, head, body, expensesSummary(r, false, r.byType)), landscape: false };
}

// ── Portfolio fact sheet ──────────────────────────────────────────────────────────────────────────────────
function barChart(periods, a, b) {
  const W = 300, H = 150, L = 34, B = 26, T = 8, vals = [...a, ...b].filter(v => v != null);
  if (!vals.length) return '';
  let lo = Math.min(0, ...vals), hi = Math.max(0, ...vals);
  const step = (() => { const raw = (hi - lo) / 4 || 1, p = Math.pow(10, Math.floor(Math.log10(raw))); return [1, 2, 2.5, 5, 10].map(m => m * p).find(s => s >= raw); })();
  lo = Math.floor(lo / step) * step; hi = Math.ceil(hi / step) * step; if (hi === lo) hi = lo + step;
  const y = v => T + (hi - v) / (hi - lo) * (H - T - B), gw = (W - L) / periods.length, bw = Math.min(20, gw / 3);
  let s = `<svg width="100%" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMinYMin meet" xmlns="http://www.w3.org/2000/svg" font-family="Helvetica, Arial" font-size="8" style="display:block;max-width:100%">`;
  for (let v = lo; v <= hi + 1e-9; v += step) s += `<line x1="${L}" x2="${W}" y1="${y(v)}" y2="${y(v)}" stroke="${K.hair}" stroke-width=".8" ${Math.abs(v) < 1e-9 ? '' : 'stroke-dasharray="3 3"'}/><text x="${L - 4}" y="${y(v) + 3}" text-anchor="end" fill="${K.muted}">${(+v.toFixed(2)).toFixed(1)}%</text>`;
  s += `<line x1="${L}" x2="${W}" y1="${y(0)}" y2="${y(0)}" stroke="${K.muted}" stroke-width=".8"/>`;
  periods.forEach((p, i) => {
    const cx = L + gw * i + gw / 2;
    [[a[i], K.green, -bw - 1], [b[i], K.gold, 1]].forEach(([v, col, off]) => {
      if (v == null) return;
      const y0 = y(0), y1 = y(v);
      s += `<rect x="${cx + off}" y="${Math.min(y0, y1)}" width="${bw}" height="${Math.max(0.6, Math.abs(y1 - y0))}" rx="1.5" fill="${col}"/>`;
    });
    // Two lines at most (the space under the axis holds two): "Since" over "04 Apr 2025", never a third line cut off.
    String(p).replace(/^(\S+)\s+(?=\d)/, '$1\n').split('\n').forEach((ln, k) => { s += `<text x="${cx}" y="${H - B + 11 + k * 9}" text-anchor="middle" fill="${K.ink}">${esc(ln)}</text>`; });
  });
  return s + '</svg>';
}
export function factsheetPdf(r, accountId) {
  return { html: page(false, ...factsheetParts(r, accountId), factsheetSummary(r, false)), landscape: false };
}
// [header, body] of one account's fact sheet (also used per account in the all-accounts fact sheet).
function factsheetParts(r, accountId) {
  const ret = r.returns || {}, periods = ret.periods || [];
  // The band's "As of" line is the reporting date: a stored Nuvama snapshot, or a date Qode computed (computed: true),
  // in which case the backend's note is printed in small type right under the title band.
  const head = header('Portfolio Fact Sheet', r.asOf, [...acctFields(accountId, r.holder, r.strategy), ['Inception', dl(r.inceptionDate)]])
    + (r.computed && r.note ? `<p class="note" style="margin:6px 0 10px">${esc(r.note)}</p>` : '');
  const top = tiles([[`Portfolio value · ${dl(r.valueDate)}`, inr(r.portfolioValue, 0)], ['Profit / loss', inr(r.profitLoss, 0), cls(r.profitLoss)], ['Contribution', inr(r.contribution, 0)], ['Withdrawal', inr(r.withdrawal, 0)]]);
  const sectors = r.sectors.length ? `<h3>Sector allocation</h3>${r.sectors.slice().sort((x, y) => (y.pct || 0) - (x.pct || 0)).map(x => `<div class="srow">${esc(x.sector)}<b>${pc(x.pct)}</b>
    <div class="bar"><i style="width:${Math.max(0.5, Math.min(100, x.pct || 0))}%"></i></div></div>`).join('')}` : '';
  const perf = periods.length ? `<h3>Performance (TWRR)</h3>
    <table class="fixed" data-frac="0.5"><colgroup><col style="width:34%">${periods.map(() => '<col>').join('')}</colgroup><thead><tr><th></th>${periods.map(p => `<th class="r">${esc(p)}</th>`).join('')}</tr></thead><tbody>
      <tr class="z"><td><span class="dot" style="background:${K.green}"></span><b>Portfolio</b></td>${(ret.portfolio || []).map(v => `<td class="r ${cls(v)}">${pc(v)}</td>`).join('')}</tr>
      ${ret.benchmark ? `<tr class="z"><td class="wrap"><span class="dot" style="background:${K.gold}"></span>${esc(ret.benchmark.name)}</td>${ret.benchmark.values.map(v => `<td class="r">${pc(v)}</td>`).join('')}</tr>` : ''}
    </tbody></table>
    <div style="margin-top:8px">${barChart(periods, ret.portfolio || [], (ret.benchmark && ret.benchmark.values) || [])}</div>
    <p class="note">Returns are time-weighted and after management fees and other expenses. Returns over one year are annualised.</p>` : '';
  const tot = r.holdings.reduce((a, x) => a + (x.value || 0), 0);
  const holdings = r.holdings.length ? `<h3>Portfolio holdings · ${r.holdings.length}</h3><table class="fixed"><colgroup><col style="width:5%"><col style="width:50%"><col style="width:19%"><col style="width:15%"><col style="width:11%"></colgroup>
    <thead><tr><th>#</th><th>Security</th><th>Sector</th><th class="r">Market value (₹)</th><th class="r">% of assets</th></tr></thead><tbody>
    ${r.holdings.map((x, i) => `<tr class="z"><td>${i + 1}</td><td class="wrap">${esc(x.security)}</td><td class="wrap">${esc(x.sector)}</td><td class="r">${nf(x.value, 0)}</td><td class="r">${pc(x.pct)}</td></tr>`).join('')}
    <tr class="tot"><td></td><td>Total</td><td></td><td class="r">${nf(tot, 0)}</td><td class="r">100.00%</td></tr></tbody></table>` : '';
  return [head, `${top}<div class="two"><div>${sectors}</div><div>${perf}</div></div>${holdings}`];
}

// ── All accounts ──────────────────────────────────────────────────────────────────────────────────────────
// One statement over every account of the investor (r from src/combine.js: rows carry `account`, totals summed,
// r.accounts lists the codes, r.failed the accounts that could not be loaded). The header says "All accounts" and
// lists the codes; tables get an Account column.
const allFields = r => [['Account', 'All accounts'], ['Account codes', (r.accounts || []).join(', ')], ['Account holder', r.holder && r.holder.name]];
const failedNote = r => (r.failed && r.failed.length
  ? `<p class="note" style="color:${K.neg}">Not included (could not be loaded): ${r.failed.map(f => `${esc(f.accountId)} (${esc(f.msg)})`).join(', ')}.</p>` : '');
const capNote = r => (r.truncated ? ' <span class="note">(latest 5,000 per account)</span>' : '');

export function transactionsAllPdf(r, groupLabel) {
  const head = header('Transaction Statement', r.asOf, [...allFields(r), ['Showing', groupLabel || 'All']], periodLine(r.from, r.to, 'All records'));
  return { html: page(true, head, failedNote(r) + statementBody({ ...r, hasMore: false, truncated: r.truncated }, true), transactionsSummary(r, true)), landscape: true };
}

export function capitalGainsAllPdf(r) {
  const head = header('Statement of Capital Gain / Loss', r.asOf, [...allFields(r), ['Period', cgPeriod(r)]],
    r.fy ? `Financial year ${r.fy}` : periodLine(r.from, r.to));
  const byCat = (r.summary && r.summary.byCategory) || [];
  const cats = byCat.length ? `<h3>By category · all accounts</h3><table class="fixed"><colgroup><col><col style="width:16%"><col style="width:16%"><col style="width:16%"><col style="width:16%"></colgroup>
    <thead><tr><th>Category</th><th class="r">Short term</th><th class="r">Long term</th><th class="r">Long term (effective)</th><th class="r">Total</th></tr></thead><tbody>
    ${byCat.map(c => `<tr class="z"><td>${esc(c.category)}</td><td class="r ${cls(c.st)}">${nf(c.st)}</td><td class="r ${cls(c.lt)}">${nf(c.lt)}</td><td class="r">${nf(c.ltTaxable)}</td><td class="r ${cls((c.st || 0) + (c.lt || 0))}">${nf((c.st || 0) + (c.lt || 0))}</td></tr>`).join('')}</tbody></table>` : '';
  return { html: page(true, head, failedNote(r) + cgBody({ ...r, hasMore: false }, true, cats) + (r.truncated ? '<p class="note">Showing the latest 5,000 lots per account.</p>' : ''), capitalGainsSummary(r, true)), landscape: true };
}

export function expensesAllPdf(r) {
  const head = header('Statement of Expenses', r.asOf, [...allFields(r), [r.from || r.to ? 'Statement covers' : 'Period', r.period ? `${dl(r.period.from)} to ${dl(r.period.to)}` : '']],
    periodLine(r.from, r.to));
  const top = tiles([['Paid', inr(r.paid)], ['Payable (accrued)', inr(r.payable)], ['Total', inr((r.paid || 0) + (r.payable || 0))]]);
  const max = Math.max(1, ...r.byType.map(t => t.amount || 0));
  const byType = `<h3>By charge</h3>${r.byType.map(t => `<div class="srow">${esc(t.type)} <span class="note">· ${t.count} ${t.count === 1 ? 'entry' : 'entries'}</span><b>${inr(t.amount)}</b>
    <div class="bar"><i style="width:${Math.max(1, (t.amount || 0) / max * 100).toFixed(1)}%"></i></div></div>`).join('')}`;
  const block = (label, status) => {
    const items = r.items.filter(x => (x.status || 'paid') === status);
    if (!items.length) return '';
    const tot = items.reduce((s, x) => s + (x.amount || 0), 0);
    return `<tr class="sec"><td colspan="6">${label}</td></tr>` + items.map(x => `<tr class="z"><td>${ds(x.date)}</td><td>${ds(x.settleDate)}</td><td class="wrap">${esc(x.account)}</td><td>${esc(x.type)}</td><td class="wrap">${esc(x.notes || '')}</td><td class="r">${nf(x.amount)}</td></tr>`).join('')
      + `<tr class="tot"><td colspan="5">Total ${label.toLowerCase()}</td><td class="r">${nf(tot)}</td></tr>`;
  };
  const body = failedNote(r) + top + byType + `<h3>Entries${r.type ? ' · ' + esc(r.type) : ''} · ${r.items.length}${capNote(r)}</h3>
    <table class="fixed"><colgroup><col style="width:9%"><col style="width:9%"><col style="width:11%"><col style="width:21%"><col><col style="width:14%"></colgroup>
    <thead><tr><th>Date</th><th>Settled</th><th>Account</th><th>Charge</th><th>Description</th><th class="r">Amount (₹)</th></tr></thead><tbody>
    ${block('Expenses paid', 'paid')}${block('Expenses payable', 'payable')}</tbody></table>${r.items.length ? '' : '<p class="note">No expense entries in this period.</p>'}`;
  return { html: page(false, head, body, expensesSummary(r, true, r.byType)), landscape: false };
}

// Combined summary (values summed; returns are not additive), then each account's own fact sheet on a new page.
export function factsheetAllPdf(r) {
  const head = header('Portfolio Fact Sheet', r.asOf, [...allFields(r), ['Requested', r.date ? dl(r.date) : 'Latest']]);
  const top = tiles([['Portfolio value', inr(r.portfolioValue, 0)], ['Profit / loss', inr(r.profitLoss, 0), cls(r.profitLoss)], ['Contribution', inr(r.contribution, 0)], ['Withdrawal', inr(r.withdrawal, 0)]]);
  const sheets = r.sheets || [];
  const table = `<h3>By account</h3><table class="fixed"><colgroup><col style="width:13%"><col><col style="width:11%"><col style="width:13%"><col style="width:13%"><col style="width:12%"><col style="width:11%"></colgroup>
    <thead><tr><th>Account</th><th>Strategy</th><th>As of</th><th class="r">Portfolio value (₹)</th><th class="r">Profit / loss (₹)</th><th class="r">Contribution (₹)</th><th class="r">Withdrawal (₹)</th></tr></thead><tbody>
    ${sheets.map(({ accountId, data: d }) => (d && d.asOf
      ? `<tr class="z"><td>${esc(accountId)}</td><td class="wrap">${esc(strategyName(d.holder, d.strategy))}</td><td>${ds(d.asOf)}</td><td class="r">${nf(d.portfolioValue, 0)}</td><td class="r ${cls(d.profitLoss)}">${nf(d.profitLoss, 0)}</td><td class="r">${nf(d.contribution, 0)}</td><td class="r">${nf(d.withdrawal, 0)}</td></tr>`
      : `<tr class="z"><td>${esc(accountId)}</td><td colspan="6" class="note">No fact sheet for this date.</td></tr>`)).join('')}
    <tr class="tot"><td>Total</td><td></td><td></td><td class="r">${nf(r.portfolioValue, 0)}</td><td class="r">${nf(r.profitLoss, 0)}</td><td class="r">${nf(r.contribution, 0)}</td><td class="r">${nf(r.withdrawal, 0)}</td></tr></tbody></table>
    <p class="note">${esc(r.note || 'Returns are per account; values are summed.')}</p>`;
  const each = sheets.filter(s => s.data && s.data.asOf).map(({ accountId, data }) => `<div class="pb"></div>${factsheetParts(data, accountId).join('')}`).join('');
  return { html: page(false, head, failedNote(r) + top + table + each, factsheetSummary(r, true)), landscape: false };
}

// ── Profit and loss account - Balance sheet ───────────────────────────────────────────────────────────────
// r: /api/mobile/reports/pnl (myQode/lib/plbsCompute.ts), one account or several summed on the server (accountId
// null → "All accounts", r.accounts lists the codes). Nuvama's layout: the P&L (income, expenses, surplus), the
// unrealised gain block (not part of the surplus), then the balance sheet at cost, liabilities and assets side by
// side with their totals on the same ruled line, and the reconciliation to the portfolio value.
// rows: [{ k: 'sh' | 'line' | 'sub' | 'st' | 'gt', label, mid, amt, note }]
const stmtRow = x => x.k === 'sh'
  ? `<tr class="sh"><td colspan="3">${esc(x.label)}</td></tr>`
  : `<tr class="${x.k === 'line' ? '' : x.k}"><td class="wrap">${esc(x.label)}${x.note ? `<div class="note" style="margin-top:1px">${esc(x.note)}</div>` : ''}</td>
     <td class="r mid">${x.mid == null ? '' : nf(x.mid)}</td><td class="r ${x.k === 'gt' || x.k === 'st' ? cls(x.amt) : ''}">${x.amt == null ? '' : nf(x.amt)}</td></tr>`;
// half: one side of the balance sheet (half the page wide), so its figure columns get more of the width.
const stmtTable = (rows, amtHead = 'Amount (₹)', half = false) => `<table class="fixed stmt"${half ? ' data-frac="0.5"' : ''}><colgroup><col>${half ? '<col style="width:27%"><col style="width:30%">' : '<col style="width:22%"><col style="width:22%">'}</colgroup>
  <thead><tr><th></th><th class="r"></th><th class="r">${amtHead}</th></tr></thead><tbody>${rows.map(stmtRow).join('')}</tbody></table>`;
export function plbsPdf(r, accountId) {
  const all = !accountId;
  const fields = all ? allFields(r) : acctFields(accountId, r.holder);
  const head = header('Profit and Loss Account - Balance Sheet', r.to, [...fields, ['Basis', r.computed ? 'Computed by Qode' : 'Nuvama report']],
    `Period: ${dl(r.from)} to ${dl(r.to)}`)
    + (r.computed && r.note ? `<p class="note" style="margin:6px 0 4px">${esc(r.note)}</p>` : '')
    + (r.omitted && r.omitted.length ? `<p class="note" style="color:${K.neg}">Not included (not available to this login): ${esc(r.omitted.join(', '))}.</p>` : '');
  const P = r.pnl, U = r.unrealised, L = r.balanceSheet.liabilities, A = r.balanceSheet.assets, R = r.reconciliation || {};
  const top = tiles([['Total income', inr(P.incomeTotal), cls(P.incomeTotal)], ['Total expenses', inr(P.expenseTotal)], ['Surplus for the period', inr(P.surplus), cls(P.surplus)],
    ['Unrealised, net', inr(U.net), cls(U.net)], ...(R.portfolioValue != null ? [[`Portfolio value · ${dl(r.to)}`, inr(R.portfolioValue)]] : [])]);
  const pnl = stmtTable([
    { k: 'sh', label: 'Income' },
    ...P.income.map(x => ({ k: 'line', label: x.label, amt: x.amount, note: x.note })),
    { k: 'st', label: 'Total', amt: P.incomeTotal },
    { k: 'sh', label: 'Expenses' },
    ...P.expenses.map(x => ({ k: 'line', label: x.label, amt: x.amount })),
    { k: 'st', label: 'Total', amt: P.expenseTotal },
    { k: 'gt', label: 'Surplus for the period', amt: P.surplus },
  ]);
  const unreal = stmtTable([
    { k: 'line', label: 'At the end of the period', mid: U.investments.end },
    { k: 'line', label: 'At the beginning of the period', mid: U.investments.begin },
    { k: 'st', label: 'Net unrealised gain / loss during the period', amt: U.investments.net },
    ...(U.options ? [
      { k: 'line', label: 'At the end of the period (options)', mid: U.options.end },
      { k: 'line', label: 'At the beginning of the period (options)', mid: U.options.begin },
      { k: 'st', label: 'Net unrealised gain / loss during the period (options)', amt: U.options.net },
    ] : []),
    { k: 'gt', label: 'Net unrealised gain / loss', amt: U.net },
  ]);
  const liab = [
    { k: 'line', label: 'Capital contribution', amt: L.capital },
    { k: 'line', label: 'Less: withdrawals', amt: L.withdrawals },
    { k: 'sh', label: 'Reserves and surplus' },
    { k: 'sub', label: 'Beginning', mid: L.reserves.begin },
    { k: 'sub', label: 'For the period', mid: L.reserves.period },
    { k: 'sub', label: 'Ending', amt: L.reserves.end },
    { k: 'sh', label: 'Current liabilities and provisions' },
    ...L.current.map(x => ({ k: 'sub', label: x.label, mid: x.amount })),
    { k: 'sub', label: 'Total current liabilities', amt: L.currentTotal },
    ...(L.difference ? [{ k: 'line', label: 'Other / reconciliation', amt: L.difference, note: 'Gap between the value on record and the computed surplus' }] : []),
  ];
  const assets = [
    { k: 'line', label: 'Investments at cost', amt: A.investmentsAtCost },
    ...(A.optionsPosition != null ? [{ k: 'line', label: 'Net options purchase position', amt: A.optionsPosition }] : []),
    ...(A.futuresMargin != null ? [{ k: 'line', label: 'Futures margin account', amt: A.futuresMargin }] : []),
    ...(A.optionsMargin != null ? [{ k: 'line', label: 'Options margin account', amt: A.optionsMargin }] : []),
    { k: 'sh', label: 'Current assets' },
    ...A.current.map(x => ({ k: 'sub', label: x.label, mid: x.amount, note: x.note })),
    { k: 'sub', label: 'Total current assets', amt: A.currentTotal },
  ];
  // Pad the shorter side so both totals sit on the same line.
  const n = Math.max(liab.length, assets.length), pad = list => list.concat(Array.from({ length: n - list.length }, () => ({ k: 'line', label: '' })));
  const side = (title, rows, total) => `<div><h4>${title}</h4>${stmtTable([...pad(rows), { k: 'gt', label: 'Total', amt: total }], 'Amount (₹)', true)}</div>`;
  const bs = `<div class="bs">${side('Liabilities', liab, L.total)}${side('Assets', assets, A.total)}</div>`;
  const diff = v => (v == null ? '–' : nf(v) + (Math.abs(v) <= 1 ? ' (within ₹1)' : ''));
  const recon = (R.portfolioValue != null || R.expected != null) ? `<h3>Reconciliation</h3><table class="fixed stmt"><colgroup><col><col style="width:26%"></colgroup><tbody>
    ${R.portfolioValue != null ? `<tr><td>Portfolio value on ${dl(r.to)}</td><td class="r">${nf(R.portfolioValue)}</td></tr>
      <tr><td>Total assets at cost + unrealised gain − current liabilities</td><td class="r">${nf(R.valueFromStatement)}</td></tr>
      <tr class="st"><td>Difference</td><td class="r">${diff(R.valueDiff)}</td></tr>` : ''}
    ${R.expected != null ? `<tr><td>Surplus implied by the change in value (after unrealised gains and capital flows)</td><td class="r">${nf(R.expected)}</td></tr>
      <tr><td>Surplus in the profit and loss account</td><td class="r">${nf(R.computed)}</td></tr>
      <tr class="st"><td>Difference</td><td class="r">${diff(R.diff)}</td></tr>` : ''}
    </tbody></table>${R.note ? `<p class="note">${esc(R.note)}</p>` : ''}` : '';
  const body = top
    + `<h3>Profit and loss account · ${dl(r.from)} to ${dl(r.to)}</h3>${pnl}`
    + `<h3>Unrealised gain / loss in the value of investments</h3>${unreal}<p class="note">Shown for information; not part of the surplus.</p>`
    + `<div class="pb"></div><h3>Balance sheet as of ${dl(r.to)} · at cost</h3>${bs}`
    + recon;
  return { html: page(false, head, body, pnlSummary(r, !accountId)), landscape: false };
}
