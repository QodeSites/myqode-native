// Desktop Reports (web ≥ 1024 px): the custodian's statements for one strategy account, laid out as a dashboard
// (header row with the PDF button, one compact summary strip, the report's tables on the left, statement details
// and filters in a right-hand column).
// Same data, filters, paging and PDFs as the phone page (src/screens/reports.js): /api/mobile/reports/* through
// src/api → reports (demo mode answers from src/api/demoReports.js), PDFs from src/screens/reportPdf.js via savePdf.
// "All accounts" (2+ accounts): every account's full list (export=1) fetched in parallel and merged in src/combine.js,
// with an Account column, summed totals and one combined PDF per report. The P&L and balance sheet is the exception:
// the server sums the accounts itself, so "All accounts" is one call with every code.
import React, { useState, useEffect, useRef } from 'react';
import { View, Pressable } from 'react-native';
import Svg, { Rect, Line, Text as SvgText } from 'react-native-svg';
import { C, Tx, Amt, FitAmt, Card, Row, PageIntro, Label, Panel, Btn, Chips, Tabs, Table, KeyVals, Pill, Loading, Empty, ErrorBlock, DateField } from './kit';
import { ChevronDown, Download } from '../icons';
import { reports } from '../api';
import { inr, sinr, pct, fmtDate } from '../adapt';
import { savePdf } from '../screens/partner';
import { transactionsPdf, capitalGainsPdf, expensesPdf, factsheetPdf, transactionsAllPdf, capitalGainsAllPdf, expensesAllPdf, factsheetAllPdf, plbsPdf } from '../screens/reportPdf';
import { ALL_ID, reportAccountOptions, singleAccounts, failedText, loadTransactionsAll, loadCapitalGainsAll, loadExpensesAll, loadFactsheetsAll, FACTSHEET_NOTE } from '../combine';

// ── formatting (the app-wide formatters; only quantity and period headers are local, as on the phone) ────────
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const monthLabel = d => `${MON[+d.slice(5, 7) - 1]} ${d.slice(0, 4)}`;
const qtyFmt = v => (v == null ? '' : Number(v).toLocaleString('en-IN', { maximumFractionDigits: 4 }));
const gainColor = v => (v != null && Math.round(v * 100) > 0 ? C.pos : v != null && Math.round(v * 100) < 0 ? C.red : C.ink);
// Nuvama's period headers: "1m" → "1M", "Since 13/11/24" → "Since 13 Nov 2024".
const periodLabel = p => String(p).replace(/^(\d+)([a-z])$/i, (_, n, u) => n + u.toUpperCase())
  .replace(/^Since (\d{2})\/(\d{2})\/(\d{2,4})$/i, (_, d, m, y) => `Since ${d} ${MON[+m - 1]} ${y.length === 2 ? '20' + y : y}`);
const errMsg = e => (e && e.message) || 'Something went wrong.';

// ── a paged list: first page carries the summary (head); "Load more" appends ──────────────────────────────
// Copied from the phone page. `gen` drops replies from an earlier filter/account so a slow first page can't
// overwrite a newer one. Alert is a no-op on react-native-web, so a failed "load more" is kept in moreErr.
function usePaged(fetchPage, deps) {
  const [st, set] = useState({ head: null, items: [], loading: true, more: false, err: '', busy: false, moreErr: '' });
  const [tick, setTick] = useState(0);
  const gen = useRef(0);
  useEffect(() => {
    const g = ++gen.current;
    set({ head: null, items: [], loading: true, more: false, err: '', busy: false, moreErr: '' });
    fetchPage(0).then(
      d => { if (g === gen.current) set({ head: d, items: d.items || [], loading: false, more: !!d.hasMore, err: '', busy: false, moreErr: '' }); },
      e => { if (g === gen.current) set(s => ({ ...s, loading: false, err: errMsg(e) })); });
  }, [...deps, tick]);
  const loadMore = () => {
    if (st.busy || !st.more) return;
    const g = gen.current;
    set(s => ({ ...s, busy: true, moreErr: '' }));
    fetchPage(st.items.length).then(
      d => { if (g === gen.current) set(s => ({ ...s, items: s.items.concat(d.items || []), more: !!d.hasMore, busy: false })); },
      e => { if (g === gen.current) set(s => ({ ...s, busy: false, moreErr: errMsg(e) })); });
  };
  return { ...st, loadMore, reload: () => setTick(t => t + 1) };
}

// Plain loader for the one-shot fact sheet, with the same stale-reply guard.
function useOnce(fetch, deps) {
  const [st, set] = useState({ data: null, loading: true, err: '' });
  const [tick, setTick] = useState(0);
  const gen = useRef(0);
  useEffect(() => {
    const g = ++gen.current;
    set({ data: null, loading: true, err: '' });
    fetch().then(d => { if (g === gen.current) set({ data: d, loading: false, err: '' }); },
      e => { if (g === gen.current) set({ data: null, loading: false, err: errMsg(e) }); });
  }, [...deps, tick]);
  return { ...st, reload: () => setTick(t => t + 1) };
}


// ── shared pieces ─────────────────────────────────────────────────────────────────────────────────────────
// Every report uses one composition: a header row (report name and date on the left, the PDF button on the right),
// one compact summary strip, then the report's table(s) on the left and a 300 px right-hand column with the
// statement details and the report's filters.
const SIDE_W = 300;
const PDF_HINT = 'Opens your browser’s print dialog. Choose “Save as PDF” to keep a copy.';
function ReportLayout({ title, asOf, pdf, stats, main, side }) {
  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 20, marginBottom: 14 }}>
        <View style={{ flex: 1, minWidth: 0, paddingTop: 2 }}>
          {!!title && <Tx w={600} s={15} c={C.green} role="heading" aria-level={3} numberOfLines={1}>{title}</Tx>}
          <Tx s={12} c={C.ink3} style={{ marginTop: 3 }}>{asOf ? `As of ${fmtDate(asOf)}` : 'No statement on record yet'}</Tx>
        </View>
        <View style={{ alignItems: 'flex-end', maxWidth: 360, flexShrink: 1 }}>
          {pdf || <Btn kind="primary" small label="Download PDF" icon={<Download s={14} c={C.gold} />} disabled />}
          <Tx s={11.5} c={C.ink3} lh={1.45} style={{ marginTop: 6, textAlign: 'right' }}>{PDF_HINT}</Tx>
        </View>
      </View>
      {!!stats && <SummaryStrip items={stats} style={{ marginBottom: 20 }} />}
      <Row top>
        <View style={{ flex: 1, minWidth: 0, gap: 16 }}>{main}</View>
        <View style={{ width: SIDE_W, flexShrink: 0, gap: 16 }}>{side}</View>
      </Row>
    </View>
  );
}

// PDF: fetch the export (up to 5,000 rows), build the statement, hand it to savePdf (on the web: the print dialog,
// where "Save as PDF" is offered). Errors show under the button because Alert does nothing in a browser.
function PdfBtn({ make, name, disabled }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const go = async () => {
    if (busy) return;
    setBusy(true); setErr('');
    try { const doc = await make(); await savePdf(doc.html, name, { landscape: doc.landscape }); }
    catch (e) { setErr('Couldn’t create the PDF. ' + errMsg(e)); }
    finally { setBusy(false); }
  };
  return (
    <View>
      <Btn kind="primary" small label={busy ? 'Preparing PDF…' : 'Download PDF'} icon={<Download s={14} c={C.gold} />} onPress={go} disabled={disabled} busy={busy} />
      {!!err && <Tx s={12} c={C.red} lh={1.45} style={{ marginTop: 8, textAlign: 'right' }}>{err}</Tx>}
    </View>
  );
}

// One compact summary card per report: evenly spaced figures split by hairlines, a small muted label (with an
// optional muted suffix such as an entry count) above a medium figure that shrinks rather than truncates.
// items: [{ label, value, color, note }].
function SummaryStrip({ items, style }) {
  const list = (items || []).filter(Boolean);
  if (!list.length) return null;
  return (
    <Card style={[{ flexDirection: 'row', overflow: 'hidden' }, style]}>
      {list.map((it, i) => (
        <View key={it.label} style={{ flex: 1, minWidth: 0, paddingVertical: 12, paddingHorizontal: 16, borderLeftWidth: i ? 1 : 0, borderColor: C.line }}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6, minWidth: 0 }}>
            <Tx w={600} s={11.5} c={C.ink3} numberOfLines={1} style={{ flexShrink: 0 }}>{it.label}</Tx>
            {!!it.note && <Tx s={11} c={C.ink3} numberOfLines={1} style={{ flexShrink: 1, opacity: 0.85 }}>{it.note}</Tx>}
          </View>
          <FitAmt w={600} s={16} min={11} c={it.color || C.ink} style={{ marginTop: 4 }}>{it.value}</FitAmt>
        </View>
      ))}
    </Card>
  );
}

// Right-column card with the statement details (the PDF button sits in the report's header row).
function StatementPanel({ title = 'Statement details', asOf, note, extra = [] }) {
  return (
    <Panel title={title}>
      <KeyVals items={[
        ['As of', asOf ? fmtDate(asOf) : '–'],
        ...(note ? [['Basis', <Tx key="n" s={13} c={C.ink} style={{ flexShrink: 1, textAlign: 'right' }}>{note}</Tx>]] : []),
        ...extra,
      ]} style={{ marginTop: -8 }} />
    </Panel>
  );
}

// Loading / error / empty for a paged list. Returns null when there is something to show.
function Status({ L, empty }) {
  if (L.loading) return <Loading rows={5} />;
  if (L.err) return <ErrorBlock msg={L.err} onRetry={L.reload} />;
  if (empty) return <Empty>{empty}</Empty>;
  return null;
}

// Table footer: "Load more" while pages remain, a row count at the end.
function moreFooter(L, shown) {
  if (!L.more && !L.moreErr) return shown ? <Tx s={12} c={C.ink3}>{shown} {shown === 1 ? 'row' : 'rows'}, end of list</Tx> : null;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
      {L.more && <Btn kind="outline" small label={L.busy ? 'Loading…' : 'Load more'} busy={L.busy} onPress={L.loadMore} />}
      <Tx s={12} c={C.ink3}>{shown} {shown === 1 ? 'row' : 'rows'} shown</Tx>
      {!!L.moreErr && <Tx s={12} c={C.red} style={{ flexShrink: 1 }}>Couldn’t load more: {L.moreErr}</Tx>}
    </View>
  );
}
const countSub = (L) => `${L.items.length}${L.more ? '+' : ''} ${L.items.length === 1 && !L.more ? 'entry' : 'entries'}`;

// All accounts: accounts that failed to load (the rest still show) and the per-account export cap.
function CombinedNote({ h }) {
  if (!h || !h.all) return null;
  const failed = failedText(h.failed);
  if (!failed && !h.truncated) return null;
  return (
    <View style={{ gap: 4 }}>
      {!!failed && <Tx s={12.5} c={C.red} lh={1.5}>{failed}</Tx>}
      {!!h.truncated && <Tx s={12} c={C.ink3} lh={1.5}>Some accounts have more than 5,000 entries; the latest 5,000 of each are shown.</Tx>}
    </View>
  );
}
const acctCol = { key: 'acct', label: 'Account', flex: 0.9, render: x => cellTx(x.account, { c: C.ink2 }) };
const withAcct = (all, cols, at = 1) => (all ? [...cols.slice(0, at), acctCol, ...cols.slice(at)] : cols);
const accountsRow = ids => ['Accounts', <Tx key="acc" s={13} w={600} style={{ flexShrink: 1, textAlign: 'right' }}>{`All accounts (${ids.length})`}</Tx>];

const cellTx = (v, extra) => <Tx s={13} numberOfLines={2} {...extra}>{v}</Tx>;
const cellAmt = (v, c = C.ink, w) => <Amt s={13} c={c} w={w} style={{ textAlign: 'right' }}>{v}</Amt>;

// Short-term / long-term tag (Pill would sentence-case "LT" into "Lt").
const TermTag = ({ term }) => {
  const lt = term === 'LT';
  return (
    <View style={{ backgroundColor: lt ? C.posTint : C.goldTint, borderRadius: 6, paddingVertical: 2, paddingHorizontal: 6 }}>
      <Tx w={600} s={11} c={lt ? C.pos : C.goldText}>{term}</Tx>
    </View>
  );
};

// A filter card for the right-hand column.
const FilterPanel = ({ title, sub, children }) => <Panel title={title} sub={sub}>{children}</Panel>;

// ── date range filter (transactions, capital gains, expenses) ─────────────────────────────────────────────
// Presets are computed from today; the Indian financial year runs 1 Apr to 31 Mar. "Custom" takes two dates;
// the query only changes once what was typed is valid, so a half-entered range never fires a request.
const ISO_RE = /^\d{4}-\d{2}-\d{2}$/;
const pad2 = n => String(n).padStart(2, '0');
const isoOf = t => `${t.getFullYear()}-${pad2(t.getMonth() + 1)}-${pad2(t.getDate())}`;
const monthsBack = (t, n) => {
  const y = t.getFullYear(), m = t.getMonth() - n;
  const last = new Date(y, m + 1, 0).getDate(); // days in the target month (no 31 Feb overflow)
  return new Date(y, m, Math.min(t.getDate(), last));
};
const PRESETS = [['fy', 'This FY'], ['lfy', 'Last FY'], ['3m', 'Last 3 months'], ['12m', 'Last 12 months'], ['all', 'All time'], ['custom', 'Custom']];
function presetRange(k) {
  const now = new Date(), today = isoOf(now);
  const fy = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  if (k === 'fy') return { from: `${fy}-04-01`, to: today };
  if (k === 'lfy') return { from: `${fy - 1}-04-01`, to: `${fy}-03-31` };
  if (k === '3m') return { from: isoOf(monthsBack(now, 3)), to: today };
  if (k === '12m') return { from: isoOf(monthsBack(now, 12)), to: today };
  return {};
}
const periodText = ({ from, to } = {}) => (from && to ? `${fmtDate(from)} to ${fmtDate(to)}` : from ? `From ${fmtDate(from)}` : to ? `Up to ${fmtDate(to)}` : 'All time');
const coverageText = c => (c && c.from && c.to ? `${fmtDate(c.from)} to ${fmtDate(c.to)}` : '');
// True when the chosen range can't overlap the dates on record.
const outsideCoverage = (r, c) => !!(c && c.from && c.to && ((r.to && r.to < c.from) || (r.from && r.from > c.to)));
// "2025-26" → 1 Apr 2025 to 31 Mar 2026.
const fyRange = fy => { const y = parseInt(String(fy), 10); return y ? { from: `${y}-04-01`, to: `${y + 1}-03-31` } : {}; };
const fyPeriod = fy => periodText(fyRange(fy));
const rangeSuffix = r => (r.from || r.to ? ` ${r.from || 'start'} to ${r.to || 'latest'}` : '');

function useRange(initial) {
  const [preset, setPreset] = useState(initial);
  const [draft, setDraft] = useState({ from: '', to: '' });
  const [custom, setCustom] = useState({});
  const bad = v => !!v && !ISO_RE.test(v);
  const err = bad(draft.from) || bad(draft.to) ? 'Enter dates as YYYY-MM-DD.'
    : draft.from && draft.to && draft.from > draft.to ? 'The From date must be on or before the To date.' : '';
  const range = preset === 'custom' ? custom : presetRange(preset);
  // seed: the range on show when it isn't a preset (the capital gains FY view).
  const pick = (k, seed) => {
    if (k === 'custom' && preset !== 'custom') {
      // Start the custom range from what was showing, so switching to Custom doesn't change the data.
      const cur = seed || presetRange(preset);
      setDraft({ from: cur.from || '', to: cur.to || '' });
      setCustom(cur);
    }
    setPreset(k);
  };
  const edit = (key, v) => {
    const next = { ...draft, [key]: (v || '').trim() };
    setDraft(next);
    const ok = !bad(next.from) && !bad(next.to) && !(next.from && next.to && next.from > next.to);
    if (ok) setCustom({ from: next.from || undefined, to: next.to || undefined });
  };
  return { preset, pick, setPreset, draft, edit, err, range, from: range.from, to: range.to };
}

// Keeps the last coverage the API reported, so it stays visible while the next filter loads.
function useCoverage(head) {
  const [cov, setCov] = useState(null);
  const now = head && head.coverage && (head.coverage.from || head.coverage.to) ? head.coverage : null;
  useEffect(() => { if (now) setCov(now); }, [head]);
  return now || cov;
}

// The period card: presets, then From / To when "Custom" is chosen.
function PeriodFilter({ R, cov, sub = 'Applies to the table and the PDF.', children }) {
  const today = isoOf(new Date());
  const hi = (cov && cov.to && cov.to < today ? cov.to : today);
  return (
    <FilterPanel title="Period" sub={sub}>
      <Chips value={R.preset} options={PRESETS} onChange={R.pick} />
      {R.preset === 'custom' && (
        <View style={{ gap: 12, marginTop: 14 }}>
          <DateField label="From" value={R.draft.from} onChangeText={v => R.edit('from', v)} min={cov && cov.from} max={R.draft.to || hi} error={!!R.err} />
          <DateField label="To" value={R.draft.to} onChangeText={v => R.edit('to', v)} min={R.draft.from || (cov && cov.from)} max={hi} error={!!R.err} />
          {!!R.err && <Tx s={12} c={C.red} lh={1.45}>{R.err}</Tx>}
        </View>
      )}
      {children}
    </FilterPanel>
  );
}

// Statement-card rows for the active period and what is on record.
const periodRows = (r, cov) => [
  ['Period', <Tx key="per" s={13} w={600} style={{ flexShrink: 1, textAlign: 'right' }}>{periodText(r)}</Tx>],
  ...(coverageText(cov) ? [['On record', <Tx key="cov" s={13} c={C.ink2} style={{ flexShrink: 1, textAlign: 'right' }}>{coverageText(cov)}</Tx>]] : []),
];
const outsideMsg = cov => `No records in the selected period. Records are available from ${coverageText(cov)}.`;

// ── account picker: segmented control for a few accounts, a dropdown when there are many ───────────────────
function AccountPicker({ options, value, onPick }) {
  const [open, setOpen] = useState(false);
  if (!options || options.length < 2) return null;
  // Full strategy names are long: chips only while they fit on one line, a dropdown otherwise.
  if (options.length <= 5 && options.reduce((n, o) => n + String(o.label).length, 0) <= 64) return <Chips value={value} options={options.map(o => [o.id, o.label])} onChange={onPick} />;
  const cur = options.find(o => o.id === value) || options[0];
  return (
    <View style={{ width: 360, zIndex: 50 }}>
      <Pressable accessibilityRole="button" accessibilityLabel="Choose account" onPress={() => setOpen(o => !o)}
        style={({ hovered }) => ({ flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 8, backgroundColor: C.card,
          borderColor: open || hovered ? C.green : C.line2, height: 40, paddingHorizontal: 12 })}>
        <Label>Account</Label>
        <Tx w={600} s={13.5} style={{ flex: 1 }} numberOfLines={1}>{cur.label}</Tx>
        <ChevronDown s={11} c={C.ink2} />
      </Pressable>
      {open && (
        <View style={{ position: 'absolute', top: 44, left: 0, right: 0, zIndex: 50, borderWidth: 1, borderColor: C.line, borderRadius: 10, backgroundColor: C.card,
          overflow: 'hidden', maxHeight: 320, shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 16, shadowOffset: { width: 0, height: 8 } }}>
          {options.map(o => (
            <Pressable key={o.id} accessibilityRole="button" onPress={() => { onPick(o.id); setOpen(false); }}
              style={({ hovered }) => ({ paddingVertical: 10, paddingHorizontal: 14, backgroundColor: o.id === cur.id ? C.greenTint : hovered ? C.hover : 'transparent' })}>
              <Tx w={o.id === cur.id ? 600 : 400} s={13} numberOfLines={1}>{o.label}</Tx>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

// ── Transactions ──────────────────────────────────────────────────────────────────────────────────────────
const TXN_GROUPS = [['all', 'All'], ['trades', 'Trades'], ['money', 'Money in/out'], ['income', 'Income'], ['charges', 'Charges'], ['other', 'Other']];
function Transactions({ accountId, ids, rk }) {
  const [group, setGroup] = useState('all');
  const R = useRange('all');
  const { from, to } = R;
  const all = accountId === ALL_ID;
  const L = usePaged(offset => (all
    ? loadTransactionsAll(ids, id => reports.transactions(id, { group, from, to, export: 1, limit: 5000 }), { group, from, to })
    : reports.transactions(accountId, { group, from, to, limit: 50, offset })), [accountId, group, from, to, rk]);
  const h = L.head;
  const cov = useCoverage(h);
  const groupLabel = (TXN_GROUPS.find(g => g[0] === group) || [])[1];
  const makePdf = async () => (all ? transactionsAllPdf(h, groupLabel)
    : transactionsPdf(await reports.transactions(accountId, { group, from, to, export: 1, limit: 5000 }), accountId, groupLabel));
  const sumOf = g => (h && h.summary.find(s => s.group === g)) || null;
  const sumItem = (g, label) => { const s = sumOf(g); return { label, value: s ? inr(s.amount) : inr(0), note: s ? `${s.count} ${s.count === 1 ? 'entry' : 'entries'}` : null }; };

  // Rows arrive newest first; the first row of each month carries the month label so the table reads grouped.
  const rows = L.items.map((t, i) => {
    const m = (t.date || '').slice(0, 7);
    return { ...t, id: t.id != null ? t.id : i, _month: m && (i === 0 || (L.items[i - 1].date || '').slice(0, 7) !== m) ? monthLabel(m + '-01') : '' };
  });
  const cols = withAcct(all, [
    { key: 'date', label: 'Date', flex: 0.9, render: t => (
      <View>
        {!!t._month && <Tx w={600} s={11} c={C.goldText} style={{ marginBottom: 3 }}>{t._month}</Tx>}
        <Tx s={13}>{fmtDate(t.date)}</Tx>
      </View>
    ) },
    { key: 'type', label: 'Transaction', flex: 1.1, render: t => cellTx(t.type, { w: 600 }) },
    { key: 'sec', label: 'Security or details', flex: 2, render: t => cellTx(t.security || t.notes || '–', { c: t.security ? C.ink : C.ink2 }) },
    { key: 'qty', label: 'Quantity @ rate', flex: 1.3, right: true, render: t => cellAmt(t.qty != null && t.rate != null ? `${qtyFmt(t.qty)} @ ${inr(t.rate)}` : t.qty != null ? qtyFmt(t.qty) : '–', C.ink2) },
    { key: 'amt', label: 'Amount', flex: 1.1, right: true, render: t => cellAmt((t.direction === 'in' ? '+' : t.direction === 'out' ? '−' : '') + inr(t.amount), t.direction === 'in' ? C.pos : C.ink, 600) },
  ]);
  const empty = !L.loading && !L.err && !L.items.length ? (h && !h.asOf && !cov ? `No transactions are on record for ${all ? 'these accounts' : 'this account'} yet.`
    : outsideCoverage(R.range, cov) ? outsideMsg(cov)
    : from || to ? (group === 'all' ? 'No transactions in the selected period.' : 'No transactions in this category for the selected period.')
    : 'No transactions in this category.') : null;

  return (
    <ReportLayout
      title="Transaction statement" asOf={h && h.asOf}
      pdf={<PdfBtn make={makePdf} name={`Transactions ${all ? 'All accounts' : accountId}${rangeSuffix(R.range)}`} disabled={!L.items.length} />}
      stats={h && h.asOf ? [
        { label: 'Money in', value: sinr(h.moneyIn), color: gainColor(h.moneyIn) },
        { label: 'Money out', value: h.moneyOut ? '−' + inr(h.moneyOut) : inr(0) },
        sumItem('trades', 'Trades'),
        sumItem('income', 'Income'),
        sumItem('charges', 'Charges'),
      ] : null}
      main={<>
        <CombinedNote h={h} />
        {Status({ L, empty }) || (
          <Panel title={group === 'all' ? 'All transactions' : groupLabel} sub={countSub(L)} pad={0} footer={moreFooter(L, L.items.length)}>
            <Table cols={cols} rows={rows} dense />
          </Panel>
        )}
      </>}
      side={<>
        <StatementPanel asOf={h && h.asOf} note={h && h.asOf ? 'Latest transaction on record' : ''}
          extra={[...(all ? [accountsRow(ids)] : []), ...periodRows(R.range, cov)]} />
        <PeriodFilter R={R} cov={cov} />
        <FilterPanel title="Show" sub="Filter the statement by type">
          <Chips value={group} options={TXN_GROUPS} onChange={setGroup} />
        </FilterPanel>
      </>}
    />
  );
}

// ── Capital gains ─────────────────────────────────────────────────────────────────────────────────────────
function CapitalGains({ accountId, ids, rk }) {
  const [fy, setFy] = useState(null);
  const [term, setTerm] = useState('');
  // Two ways to choose: a financial year (preset 'byfy', the API's own FY view) or a date range by sale date,
  // which overrides the FY on the server. "All time" as a range starts from the earliest possible date.
  const R = useRange('byfy');
  const byFy = R.preset === 'byfy' || (R.preset === 'custom' && !R.from && !R.to);
  const q = byFy ? { fy: fy || undefined } : R.preset === 'all' ? { from: '1990-01-01', to: isoOf(new Date()) } : { from: R.from, to: R.to };
  const all = accountId === ALL_ID;
  // All accounts: the same FY (or sale-date range) for every account; with no FY chosen, the newest year any has.
  const L = usePaged(offset => (all
    ? loadCapitalGainsAll(ids, (id, o) => reports.capitalGains(id, { ...(byFy ? o : q), term: term || undefined, export: 1, limit: 5000 }), { ...q, term: term || undefined })
    : reports.capitalGains(accountId, { ...q, term: term || undefined, limit: 50, offset })), [accountId, q.fy, q.from, q.to, term, rk]);
  const h = L.head, s = h && h.summary;
  const cov = useCoverage(h);
  const makePdf = async () => (all ? capitalGainsAllPdf(h)
    : capitalGainsPdf(await reports.capitalGains(accountId, { ...(byFy ? { fy: h.fy } : q), term: term || undefined, export: 1, limit: 5000 }), accountId));
  // The years list only comes with FY answers; keep the last one so the FY chips stay while a range is shown.
  const [years, setYears] = useState([]);
  useEffect(() => { if (h && h.years && h.years.length) setYears(h.years); }, [h]);
  const [lastFy, setLastFy] = useState(null);
  useEffect(() => { if (h && h.fy) setLastFy(h.fy); }, [h]);
  const pickFy = y => { setFy(y); R.setPreset('byfy'); };
  const RC = { ...R, pick: k => R.pick(k, byFy && (h && h.fy || lastFy) ? fyRange(h && h.fy || lastFy) : undefined) };
  const shownRange = byFy ? {} : R.preset === 'all' ? {} : R.range;

  const cols = withAcct(all, [
    { key: 'sec', label: 'Security', flex: 2.2, render: l => (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <TermTag term={l.term} />
        <Tx w={600} s={13} numberOfLines={2} style={{ flex: 1 }}>{l.security}</Tx>
      </View>
    ) },
    { key: 'sold', label: 'Sold', flex: 1, render: l => cellTx(fmtDate(l.saleDate)) },
    { key: 'bought', label: 'Bought', flex: 1, render: l => cellTx(fmtDate(l.purchaseDate)) },
    { key: 'qty', label: 'Qty', flex: 0.7, right: true, render: l => cellAmt(qtyFmt(l.qty) || '–') },
    { key: 'sale', label: 'Sale value', flex: 1.1, right: true, render: l => cellAmt(inr(l.saleAmount)) },
    { key: 'cost', label: 'Cost', flex: 1.1, right: true, render: l => cellAmt(inr(l.cost)) },
    { key: 'days', label: 'Days', flex: 0.6, right: true, render: l => cellAmt(l.daysHeld != null ? String(l.daysHeld) : '–', C.ink2) },
    { key: 'gain', label: 'Gain or loss', flex: 1.2, right: true, render: l => cellAmt(sinr(l.gain), gainColor(l.gain), 600) },
  ], 0);
  const catCols = [
    { key: 'category', label: 'Category', flex: 2.4, render: c => cellTx(c.category) },
    { key: 'st', label: 'Short term', right: true, render: c => cellAmt(sinr(c.st || 0), gainColor(c.st)) },
    { key: 'lt', label: 'Long term', right: true, render: c => cellAmt(sinr(c.lt || 0), gainColor(c.lt)) },
    { key: 'tot', label: 'Total', right: true, render: c => cellAmt(sinr((c.st || 0) + (c.lt || 0)), gainColor((c.st || 0) + (c.lt || 0)), 600) },
  ];
  const empty = !L.loading && !L.err && !L.items.length ? (h && !h.asOf && !cov ? `No capital gains report is available for ${all ? 'these accounts' : 'this account'} yet.`
    : !byFy && outsideCoverage(shownRange, cov) ? outsideMsg(cov)
    : !byFy ? 'No realised gains in the selected period.' : 'No realised gains in this selection.') : null;
  const termLabel = term === 'ST' ? 'Short-term lots' : term === 'LT' ? 'Long-term lots' : 'Realised lots';

  return (
    <ReportLayout
      title={byFy && h && h.fy ? `Capital gains, FY ${h.fy}` : 'Capital gains'} asOf={h && h.asOf}
      pdf={<PdfBtn make={makePdf} name={byFy ? `Capital gains FY ${(h && h.fy) || ''} ${all ? 'All accounts' : accountId}` : `Capital gains ${all ? 'All accounts' : accountId}${rangeSuffix(shownRange)}`} disabled={!s} />}
      stats={s ? [
        { label: 'Short term', value: sinr(s.st), color: gainColor(s.st) },
        { label: 'Long term', value: sinr(s.lt), color: gainColor(s.lt) },
        { label: 'LT after grandfathering', value: sinr(s.ltTaxable != null ? s.ltTaxable : s.lt), color: gainColor(s.ltTaxable != null ? s.ltTaxable : s.lt) },
        { label: 'Total realised', value: sinr(s.total), color: gainColor(s.total) },
      ] : null}
      main={<>
        <CombinedNote h={h} />
        {s && s.byCategory && s.byCategory.length > 0 && (
          <Panel title="By category" sub={all ? 'Realised gain split by asset category, summed across accounts' : 'Realised gain split by asset category'} pad={0}>
            <Table cols={catCols} rows={s.byCategory.map((c, i) => ({ ...c, id: c.category || i }))} dense />
          </Panel>
        )}
        {Status({ L, empty }) || (
          <Panel title={termLabel} sub={countSub(L)} pad={0} footer={moreFooter(L, L.items.length)}>
            <Table cols={cols} rows={L.items.map((l, i) => ({ ...l, id: i }))} dense />
          </Panel>
        )}
      </>}
      side={<>
        <StatementPanel asOf={h && h.asOf} note={h && h.asOf ? 'Realised gains by date of sale' : ''}
          extra={(all ? [accountsRow(ids)] : []).concat(byFy ? (h && h.fy ? [['Period', <Tx key="per" s={13} w={600} style={{ flexShrink: 1, textAlign: 'right' }}>{fyPeriod(h.fy)}</Tx>]] : [])
            .concat(coverageText(cov) ? [['On record', <Tx key="cov" s={13} c={C.ink2} style={{ flexShrink: 1, textAlign: 'right' }}>{coverageText(cov)}</Tx>]] : [])
            : periodRows(shownRange, cov))} />
        <PeriodFilter R={RC} cov={cov} sub="By date of sale. Pick a financial year or any dates.">
          {years.length > 1 && (
            <View style={{ marginTop: 16 }}>
              <Label style={{ marginBottom: 8 }}>Financial year</Label>
              <Chips value={byFy ? (h && h.fy) || lastFy : null} options={years.map(y => [y.fy, 'FY ' + y.fy])} onChange={pickFy} />
            </View>
          )}
        </PeriodFilter>
        {(years.length > 0 || !!h) && (
          <FilterPanel title="Filters">
            <Label style={{ marginBottom: 8 }}>Holding period</Label>
            <Chips value={term} options={[['', 'All lots'], ['ST', 'Short term'], ['LT', 'Long term']]} onChange={setTerm} />
          </FilterPanel>
        )}
      </>}
    />
  );
}

// ── Expenses ──────────────────────────────────────────────────────────────────────────────────────────────
function Expenses({ accountId, ids, rk }) {
  const [type, setType] = useState('');
  const R = useRange('all');
  const { from, to } = R;
  const all = accountId === ALL_ID;
  const L = usePaged(offset => (all
    ? loadExpensesAll(ids, id => reports.expenses(id, { type: type || undefined, from, to, export: 1, limit: 5000 }), { type: type || undefined, from, to })
    : reports.expenses(accountId, { type: type || undefined, from, to, limit: 50, offset })), [accountId, type, from, to, rk]);
  // byType comes with each first page; keep the last one so the filter panel doesn't blink while a filter loads.
  const [byType, setByType] = useState([]);
  useEffect(() => { if (L.head && L.head.byType) setByType(L.head.byType); }, [L.head]);
  const h = L.head;
  const cov = useCoverage(h);
  const makePdf = async () => (all ? expensesAllPdf(h)
    : expensesPdf(await reports.expenses(accountId, { type: type || undefined, from, to, export: 1, limit: 5000 }), accountId));
  const noStatement = `No expense statement is available for ${all ? 'these accounts' : 'this account'} yet.`;
  const empty = !L.loading && !L.err && !L.items.length ? (h && !h.asOf && !cov ? noStatement
    : outsideCoverage(R.range, cov) ? outsideMsg(cov)
    : from || to ? (type ? 'No charges of this type in the selected period.' : 'No charges in the selected period.')
    : noStatement) : null;
  const max = Math.max(1, ...byType.map(t => t.amount || 0));

  const cols = withAcct(all, [
    { key: 'date', label: 'Date', flex: 0.9, render: x => cellTx(fmtDate(x.date)) },
    { key: 'type', label: 'Charge', flex: 1.3, render: x => cellTx(x.type, { w: 600 }) },
    { key: 'notes', label: 'Description', flex: 2, render: x => cellTx(x.notes || '–', { c: C.ink2 }) },
    { key: 'status', label: 'Status', flex: 0.8, render: x => <Pill label={x.status === 'payable' ? 'Payable' : 'Paid'} tone={x.status === 'payable' ? 'warn' : 'neutral'} /> },
    { key: 'amt', label: 'Amount', flex: 1, right: true, render: x => cellAmt(inr(x.amount), C.ink, 600) },
  ]);

  return (
    <ReportLayout
      title="Statement of expenses" asOf={h && h.asOf}
      pdf={<PdfBtn make={makePdf} name={`Expenses ${all ? 'All accounts' : accountId}${rangeSuffix(R.range)}`} disabled={!L.items.length} />}
      stats={h && h.asOf ? [
        { label: 'Paid', value: inr(h.paid) },
        { label: 'Payable (accrued)', value: inr(h.payable) },
        { label: 'Total', value: inr((h.paid || 0) + (h.payable || 0)) },
      ] : null}
      main={<>
        <CombinedNote h={h} />
        {Status({ L, empty }) || (
          <Panel title={type || 'All charges'} sub={countSub(L)} pad={0} footer={moreFooter(L, L.items.length)}
            right={type ? <Btn kind="ghost" small label="Show all" onPress={() => setType('')} /> : null}>
            <Table cols={cols} rows={L.items.map((x, i) => ({ ...x, id: i }))} dense />
          </Panel>
        )}
      </>}
      side={<>
        <StatementPanel asOf={h && h.asOf}
          extra={[...(all ? [accountsRow(ids)] : []), ...periodRows(R.range, cov),
            ...(h && h.asOf ? [['Statement covers', <Tx key="p" s={13} c={C.ink2} style={{ flexShrink: 1, textAlign: 'right' }}>{h.period ? `${fmtDate(h.period.from)} to ${fmtDate(h.period.to)}` : '–'}</Tx>]] : [])]} />
        <PeriodFilter R={R} cov={cov} sub="By date of charge. Applies to the table and the PDF." />
        {byType.length > 0 && (
          <Panel title="By charge" sub={type ? 'Filtered to one charge' : 'Select a charge to filter the table'}
            right={type ? <Pressable accessibilityRole="button" onPress={() => setType('')}><Tx w={600} s={12.5} c={C.green}>Show all</Tx></Pressable> : null}>
            <View style={{ gap: 2, marginHorizontal: -8 }}>
              {byType.map(t => {
                const on = type === t.type;
                return (
                  <Pressable key={t.type} accessibilityRole="button" accessibilityState={{ selected: on }} onPress={() => setType(on ? '' : t.type)}
                    style={({ hovered }) => ({ paddingVertical: 9, paddingHorizontal: 8, borderRadius: 8,
                      backgroundColor: on ? C.greenTint : hovered ? C.hover : 'transparent' })}>
                    <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
                      <Tx w={on ? 600 : 400} s={13} numberOfLines={1} style={{ flex: 1 }}>{t.type}</Tx>
                      <Tx s={11.5} c={C.ink3}>{t.count}</Tx>
                      <Amt s={13} w={600}>{inr(t.amount)}</Amt>
                    </View>
                    <View style={{ height: 5, backgroundColor: C.track, borderRadius: 3, marginTop: 6, overflow: 'hidden' }}>
                      <View style={{ width: `${Math.max(1, ((t.amount || 0) / max) * 100)}%`, height: 5, borderRadius: 3, backgroundColor: on ? C.gold : C.green }} />
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </Panel>
        )}
      </>}
    />
  );
}

// ── Fact sheet ────────────────────────────────────────────────────────────────────────────────────────────
// Grouped bars per period: portfolio (green) beside benchmark (gold), zero line solid, "nice" gridlines dashed.
// The same chart as the PDF, drawn with react-native-svg at the measured width so the labels stay crisp.
function ReturnsChart({ periods, a, b, height = 240 }) {
  const [W, setW] = useState(0);
  const vals = [...a, ...b].filter(v => v != null);
  const H = height, L = 44, B = 34, T = 10;
  let body = null;
  if (W > 0 && vals.length) {
    let lo = Math.min(0, ...vals), hi = Math.max(0, ...vals);
    const raw = (hi - lo) / 4 || 1, p = Math.pow(10, Math.floor(Math.log10(raw)));
    const step = [1, 2, 2.5, 5, 10].map(m => m * p).find(s => s >= raw);
    lo = Math.floor(lo / step) * step; hi = Math.ceil(hi / step) * step; if (hi === lo) hi = lo + step;
    const y = v => T + ((hi - v) / (hi - lo)) * (H - T - B);
    const gw = (W - L) / periods.length, bw = Math.min(26, gw / 3.2);
    const ticks = [];
    for (let v = lo; v <= hi + 1e-9; v += step) ticks.push(+v.toFixed(6));
    body = (
      <Svg width={W} height={H}>
        {ticks.map(v => (
          <React.Fragment key={v}>
            <Line x1={L} x2={W} y1={y(v)} y2={y(v)} stroke={v === 0 ? C.ink3 : C.line} strokeWidth={1} strokeDasharray={v === 0 ? undefined : '3 3'} />
            <SvgText x={L - 6} y={y(v) + 3.5} textAnchor="end" fill={C.ink3} fontSize={10}>{pct(v, 1)}</SvgText>
          </React.Fragment>
        ))}
        {periods.map((per, i) => {
          const cx = L + gw * i + gw / 2;
          return (
            <React.Fragment key={per + i}>
              {[[a[i], C.green, -bw - 1.5], [b[i], C.gold, 1.5]].map(([v, col, off], k) => (v == null ? null : (
                <Rect key={k} x={cx + off} y={Math.min(y(0), y(v))} width={bw} height={Math.max(1, Math.abs(y(v) - y(0)))} rx={2} fill={col} />
              )))}
              {periodLabel(per).split(/\s+(?=\d)/).map((ln, k) => (
                <SvgText key={k} x={cx} y={H - B + 15 + k * 11} textAnchor="middle" fill={C.ink2} fontSize={10}>{ln}</SvgText>
              ))}
            </React.Fragment>
          );
        })}
      </Svg>
    );
  }
  return <View style={{ height: H }} onLayout={e => setW(Math.floor(e.nativeEvent.layout.width))}>{body}</View>;
}

const Legend = ({ color, label }) => (
  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
    <View style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: color }} />
    <Tx s={12} c={C.ink2} numberOfLines={1}>{label}</Tx>
  </View>
);

// "As of" picker for the fact sheet: recent Nuvama snapshot dates as chips, or any date in the account's
// coverage (the backend computes a fact sheet for dates without a snapshot). '' means the latest.
function AsOfPanel({ dates, date, shown, coverage, onPick }) {
  const [draft, setDraft] = useState('');
  const [err, setErr] = useState('');
  const recent = dates.slice(0, 6);
  const cur = date || shown || dates[0] || '';
  const today = isoOf(new Date());
  const lo = (coverage && coverage.from) || (dates.length ? dates[dates.length - 1] : undefined);
  const hi = coverage && coverage.to && coverage.to < today ? coverage.to : today;
  const edit = v => {
    const t = (v || '').trim();
    setDraft(t);
    if (!t) { setErr(''); return; }
    if (!ISO_RE.test(t)) { setErr('Enter the date as YYYY-MM-DD.'); return; }
    if (lo && t < lo) { setErr(`Choose a date on or after ${fmtDate(lo)}.`); return; }
    if (t > hi) { setErr(`Choose a date on or before ${fmtDate(hi)}.`); return; }
    setErr(''); onPick(t);
  };
  const covText = coverageText(coverage);
  return (
    <FilterPanel title="As of" sub={covText ? `Fact sheets from ${covText}` : dates.length ? `${dates.length} ${dates.length === 1 ? 'snapshot' : 'snapshots'}, ${fmtDate(dates[dates.length - 1])} to ${fmtDate(dates[0])}` : 'Choose the fact sheet date'}>
      {recent.length > 0 && <Chips value={recent.includes(cur) ? cur : null} options={recent.map((x, i) => [x, i === 0 ? `${fmtDate(x)} (latest)` : fmtDate(x)])} onChange={x => { setDraft(''); setErr(''); onPick(x === dates[0] ? '' : x); }} />}
      <View style={{ marginTop: recent.length ? 14 : 0, gap: 8 }}>
        <DateField label="Or choose a date" value={draft} onChangeText={edit} min={lo} max={hi} error={!!err} />
        {!!err && <Tx s={12} c={C.red} lh={1.45}>{err}</Tx>}
        <Tx s={12} c={C.ink3} lh={1.5}>{covText
          ? `Pick any date from ${fmtDate(coverage.from)} to ${fmtDate(coverage.to)}. Dates other than a Nuvama snapshot are computed from your transaction and holdings data.`
          : 'Dates other than a Nuvama snapshot are computed from your transaction and holdings data.'}</Tx>
      </View>
    </FilterPanel>
  );
}

// One fact sheet's sections, shared by the single-account page and each account on the all-accounts page.
function PerfPanel({ d }) {
  const r = d.returns || {}, periods = r.periods || [];
  if (!periods.length) return <Empty>No performance figures in this fact sheet.</Empty>;
  const perfRows = [{ id: 'p', name: 'Portfolio', vals: r.portfolio || [], color: C.green, mine: true }, ...(r.benchmark ? [{ id: 'b', name: r.benchmark.name, vals: r.benchmark.values || [], color: C.gold }] : [])];
  const perfCols = [
    { key: 'name', label: '', flex: 2, render: x => (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <View style={{ width: 9, height: 9, borderRadius: 2, backgroundColor: x.color }} />
        <Tx w={x.mine ? 600 : 400} s={12.5} numberOfLines={2} style={{ flex: 1 }}>{x.name}</Tx>
      </View>
    ) },
    ...periods.map((p, j) => ({ key: 'p' + j, label: periodLabel(p), right: true, render: x => cellAmt(pct(x.vals[j]), x.mine ? gainColor(x.vals[j]) : C.ink2, 600) })),
  ];
  return (
    <Panel title="Performance (TWRR)" sub="Time-weighted, after management fees and other expenses. Returns over one year are annualised." pad={0}>
      <Table cols={perfCols} rows={perfRows} dense />
      <View style={{ padding: 20, paddingTop: 16, borderTopWidth: 1, borderColor: C.line }}>
        <View style={{ flexDirection: 'row', gap: 18, flexWrap: 'wrap', marginBottom: 10 }}>
          <Legend color={C.green} label="Portfolio" />
          {!!r.benchmark && <Legend color={C.gold} label={r.benchmark.name} />}
        </View>
        <ReturnsChart periods={periods} a={r.portfolio || []} b={(r.benchmark && r.benchmark.values) || []} />
      </View>
    </Panel>
  );
}
// limit: show only the top holdings (all-accounts page); the single-account page lists every holding.
function HoldingsPanel({ d, limit }) {
  const holdings = d.holdings || [];
  if (!holdings.length) return null;
  const shown = limit ? holdings.slice(0, limit) : holdings;
  const total = holdings.reduce((s, x) => s + (x.value || 0), 0);
  const holdCols = [
    { key: 'n', label: '#', flex: 0.35, render: x => cellTx(String(x.n), { c: C.ink3 }) },
    { key: 'security', label: 'Security', flex: 3, render: x => cellTx(x.security, { w: 600 }) },
    { key: 'sector', label: 'Sector', flex: 1.6, render: x => cellTx(x.sector || '–', { c: C.ink2 }) },
    { key: 'value', label: 'Market value', flex: 1.3, right: true, render: x => cellAmt(inr(x.value)) },
    { key: 'pct', label: '% of assets', flex: 1, right: true, render: x => (
      <View style={{ alignItems: 'flex-end', gap: 4 }}>
        <Amt s={13}>{(x.pct || 0).toFixed(2)}%</Amt>
        <View style={{ width: 70, height: 4, backgroundColor: C.track, borderRadius: 2, overflow: 'hidden' }}>
          <View style={{ width: `${Math.max(0, Math.min(100, x.pct || 0))}%`, height: 4, backgroundColor: C.green }} />
        </View>
      </View>
    ) },
  ];
  const sub = `${holdings.length} ${holdings.length === 1 ? 'security' : 'securities'}${shown.length < holdings.length ? `, top ${shown.length} shown` : ''}`;
  return (
    <Panel title={limit ? 'Top holdings' : 'Portfolio holdings'} sub={sub} pad={0}
      right={<Tx s={12.5} c={C.ink2}>Total <Amt s={12.5} w={600}>{inr(total)}</Amt></Tx>}>
      <Table cols={holdCols} rows={shown.map((x, i) => ({ ...x, n: i + 1, id: i }))} dense />
    </Panel>
  );
}
function SectorsPanel({ d }) {
  const sectors = (d.sectors || []).slice().sort((x, y) => (y.pct || 0) - (x.pct || 0));
  return (
    <Panel title="Sector allocation" sub={sectors.length ? `${sectors.length} ${sectors.length === 1 ? 'sector' : 'sectors'}, share of assets` : null}>
      {sectors.length === 0 && <Tx s={13} c={C.ink2}>No sector split in this fact sheet.</Tx>}
      <View style={{ gap: 14 }}>
        {sectors.map(x => (
          <View key={x.sector}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 10 }}>
              <Tx s={13} style={{ flex: 1 }} numberOfLines={1}>{x.sector}</Tx>
              <Amt s={13} w={600}>{(x.pct || 0).toFixed(2)}%</Amt>
            </View>
            <View style={{ height: 6, backgroundColor: C.track, borderRadius: 3, marginTop: 6, overflow: 'hidden' }}>
              <View style={{ width: `${Math.max(0, Math.min(100, x.pct || 0))}%`, height: 6, backgroundColor: C.green, borderRadius: 3 }} />
            </View>
          </View>
        ))}
      </View>
    </Panel>
  );
}

function Factsheet({ accountId, ids, names, rk }) {
  const [date, setDate] = useState('');
  const all = accountId === ALL_ID;
  const L = useOnce(() => (all
    ? loadFactsheetsAll(ids, id => reports.factsheet(id, { ...(date ? { date } : {}), export: 1 }), { date })
    : reports.factsheet(accountId, date ? { date } : {})), [accountId, date, rk]);
  const d = L.data;
  // The snapshot list comes with every answer; keep the last one so the picker doesn't blink while loading.
  const [dates, setDates] = useState([]);
  useEffect(() => { if (d && Array.isArray(d.dates)) setDates(d.dates); }, [d]);
  const [coverage, setCoverage] = useState(null);
  useEffect(() => { if (d && d.coverage && (d.coverage.from || d.coverage.to)) setCoverage(d.coverage); }, [d]);
  const strategy = d && d.strategy ? d.strategy.replace(/^QODE ADVISORS LLP - /, '') : '';
  const statement = <StatementPanel asOf={d && d.asOf} note={all ? FACTSHEET_NOTE : strategy} extra={[...(all ? [accountsRow(ids)] : []), ...(date ? [['Requested', fmtDate(date)]] : [])]} />;
  const asOfPanel = <AsOfPanel dates={dates} date={date} shown={d && (d.date || d.asOf)} coverage={coverage} onPick={setDate} />;
  const head = { title: 'Portfolio fact sheet', asOf: d && d.asOf };
  const who = all ? 'these accounts' : 'this account';
  if (L.loading) return <ReportLayout {...head} main={<Loading rows={4} />} side={<>{statement}{asOfPanel}</>} />;
  if (L.err) return <ReportLayout {...head} main={<ErrorBlock msg={L.err} onRetry={L.reload} />} side={<>{statement}{asOfPanel}</>} />;
  if (!d || !d.asOf) return <ReportLayout {...head} main={<><CombinedNote h={d} /><Empty>{coverage && coverage.from && coverage.to
    ? `${date ? `No fact sheet is available for ${fmtDate(date)}.` : `No fact sheet is available for ${who} yet.`} Fact sheets can be shown for any date from ${fmtDate(coverage.from)} to ${fmtDate(coverage.to)}.`
    : date ? `No fact sheet is available for ${fmtDate(date)}.` : `No fact sheet is available for ${who} yet.`}</Empty></>} side={<>{statement}{asOfPanel}</>} />;

  const stats = [
    { label: 'Portfolio value', value: inr(d.portfolioValue), note: d.valueDate ? 'on ' + fmtDate(d.valueDate) : null },
    { label: 'Profit or loss', value: sinr(d.profitLoss), color: gainColor(d.profitLoss), note: d.inceptionDate ? 'since ' + fmtDate(d.inceptionDate) : null },
    { label: 'Contribution', value: inr(d.contribution) },
    { label: 'Withdrawal', value: inr(d.withdrawal) },
  ];

  if (all) {
    // Combined summary (values summed), a by-account table, then each account's own fact sheet.
    const sheets = d.sheets || [];
    const byCols = [
      { key: 'acct', label: 'Account', flex: 2.4, render: x => cellTx(names[x.accountId] || x.accountId, { w: 600 }) },
      { key: 'asof', label: 'As of', flex: 1, render: x => cellTx(x.data.asOf ? fmtDate(x.data.asOf) : 'No fact sheet', { c: C.ink2 }) },
      { key: 'val', label: 'Portfolio value', flex: 1.2, right: true, render: x => cellAmt(x.data.asOf ? inr(x.data.portfolioValue) : '–') },
      { key: 'pl', label: 'Profit or loss', flex: 1.2, right: true, render: x => cellAmt(x.data.asOf ? sinr(x.data.profitLoss) : '–', gainColor(x.data.profitLoss), 600) },
      { key: 'in', label: 'Contribution', flex: 1.2, right: true, render: x => cellAmt(x.data.asOf ? inr(x.data.contribution) : '–') },
      { key: 'out', label: 'Withdrawal', flex: 1.1, right: true, render: x => cellAmt(x.data.asOf ? inr(x.data.withdrawal) : '–') },
    ];
    return (
      <ReportLayout
        {...head}
        pdf={<PdfBtn make={async () => factsheetAllPdf(d)} name={`Fact sheet All accounts ${d.asOf}`} />}
        stats={stats}
        main={<>
          <CombinedNote h={d} />
          <Panel title="By account" sub={FACTSHEET_NOTE} pad={0}>
            <Table cols={byCols} rows={sheets.map(x => ({ ...x, id: x.accountId }))} dense />
          </Panel>
          {sheets.filter(x => x.data && x.data.asOf).map(({ accountId: id, data: x }) => (
            <View key={id} style={{ gap: 16, marginTop: 8 }}>
              <View style={{ borderTopWidth: 1, borderColor: C.line, paddingTop: 16 }}>
                <Tx w={600} s={15} c={C.green} role="heading" aria-level={3}>{names[id] || id}</Tx>
                <Tx s={12} c={C.ink3} style={{ marginTop: 3 }}>
                  {[`As of ${fmtDate(x.asOf)}`, `Value ${inr(x.portfolioValue)}`, `Profit or loss ${sinr(x.profitLoss)}`, x.inceptionDate ? `since ${fmtDate(x.inceptionDate)}` : null].filter(Boolean).join(', ')}
                </Tx>
                {!!(x.computed && x.note) && <Tx s={12} c={C.ink3} lh={1.5} style={{ marginTop: 6 }}>{x.note}</Tx>}
              </View>
              <PerfPanel d={x} />
              <Row top>
                <View style={{ flex: 1, minWidth: 0 }}><SectorsPanel d={x} /></View>
                <View style={{ flex: 1.6, minWidth: 0 }}><HoldingsPanel d={x} limit={10} /></View>
              </Row>
            </View>
          ))}
        </>}
        side={<>{statement}{asOfPanel}</>}
      />
    );
  }

  return (
    <ReportLayout
      {...head}
      pdf={<PdfBtn make={async () => factsheetPdf(await reports.factsheet(accountId, { ...(date ? { date } : {}), export: 1 }), accountId)} name={`Fact sheet ${accountId} ${d.asOf}`} />}
      stats={stats}
      main={<>
        {!!(d.computed && d.note) && <Tx s={12} c={C.ink3} lh={1.5}>{d.note}</Tx>}
        <PerfPanel d={d} />
        <HoldingsPanel d={d} />
      </>}
      side={<>
        {statement}
        {asOfPanel}
        <SectorsPanel d={d} />
      </>}
    />
  );
}

// ── P&L and balance sheet ─────────────────────────────────────────────────────────────────────────────────
// Nuvama's "Profit and loss account - Balance sheet" layout: the P&L for the period (income, expenses, surplus),
// the unrealised gain block (not part of the surplus), then the balance sheet at cost as of the period's end, the
// two sides next to each other. /api/mobile/reports/pnl (myQode/lib/plbsCompute.ts); "All accounts" passes every
// code in one call and the server sums them. A stored Nuvama report is shown as is; any other period is computed.
const PLBS_NOTE = 'Computed by Qode from Nuvama transaction, holdings and expense data.';
// One statement row: kind 'head' (section heading), 'line', 'sub' (indented), 'total' (ruled, bold), 'grand'
// (double-ruled, bold, green). mid: an optional amount in the inner column (Nuvama's levels / sub-lines).
function StmtRow({ label, amount, mid, kind = 'line', note, color }) {
  const head = kind === 'head', total = kind === 'total' || kind === 'grand';
  return (
    <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 12, paddingVertical: head ? 0 : 7, paddingTop: head ? 14 : undefined, paddingBottom: head ? 4 : undefined,
      borderTopWidth: total ? (kind === 'grand' ? 2 : 1) : 0, borderColor: kind === 'grand' ? C.green : C.line2, marginTop: total ? 4 : 0 }}>
      <View style={{ flex: 1, minWidth: 0, paddingLeft: kind === 'sub' ? 16 : 0 }}>
        <Tx w={head || total ? 600 : 400} s={head ? 11.5 : 13} c={head ? C.goldText : kind === 'grand' ? C.green : C.ink} ls={head ? 0.6 : 0}>{head ? label.toUpperCase() : label}</Tx>
        {!!note && <Tx s={11.5} c={C.ink3} lh={1.45} style={{ marginTop: 2 }}>{note}</Tx>}
      </View>
      {mid !== undefined && <Amt s={13} c={C.ink2} style={{ width: 130, textAlign: 'right' }}>{mid == null ? '' : inr(mid)}</Amt>}
      {!head && <Amt s={13} w={total ? 600 : 400} c={color || (kind === 'grand' ? C.green : C.ink)} style={{ width: 140, textAlign: 'right' }}>{amount == null ? '' : inr(amount)}</Amt>}
    </View>
  );
}
// Rows of each statement, shared with the phone and the PDF layouts through the same response fields.
const pnlRows = d => [
  { kind: 'head', label: 'Income' },
  ...d.pnl.income.map(x => ({ label: x.label, amount: x.amount, note: x.note })),
  { kind: 'total', label: 'Total income', amount: d.pnl.incomeTotal },
  { kind: 'head', label: 'Expenses' },
  ...d.pnl.expenses.map(x => ({ label: x.label, amount: x.amount, note: x.note })),
  { kind: 'total', label: 'Total expenses', amount: d.pnl.expenseTotal },
  { kind: 'grand', label: 'Surplus for the period', amount: d.pnl.surplus, color: gainColor(d.pnl.surplus) },
];
const unrealRows = d => {
  const u = d.unrealised, o = u.options;
  return [
    { label: 'At the end of the period', mid: u.investments.end },
    { label: 'At the beginning of the period', mid: u.investments.begin },
    { kind: 'total', label: 'Net unrealised gain or loss during the period', amount: u.investments.net, color: gainColor(u.investments.net) },
    ...(o ? [
      { label: 'At the end of the period (options)', mid: o.end },
      { label: 'At the beginning of the period (options)', mid: o.begin },
      { kind: 'total', label: 'Net unrealised gain or loss during the period (options)', amount: o.net, color: gainColor(o.net) },
    ] : []),
    { kind: 'grand', label: 'Net unrealised gain or loss', amount: u.net, color: gainColor(u.net) },
  ];
};
const liabRows = d => {
  const L = d.balanceSheet.liabilities;
  return [
    { label: 'Capital contribution', amount: L.capital },
    { label: 'Less: withdrawals', amount: L.withdrawals },
    { kind: 'head', label: 'Reserves and surplus' },
    { kind: 'sub', label: 'Beginning', mid: L.reserves.begin },
    { kind: 'sub', label: 'For the period', mid: L.reserves.period },
    { kind: 'sub', label: 'Ending', amount: L.reserves.end },
    { kind: 'head', label: 'Current liabilities and provisions' },
    ...L.current.map(x => ({ kind: 'sub', label: x.label, mid: x.amount })),
    { kind: 'sub', label: 'Total current liabilities', amount: L.currentTotal },
    ...(L.difference ? [{ label: 'Other / reconciliation', amount: L.difference, note: 'Gap between the value on record and the computed surplus' }] : []),
  ];
};
const assetRows = d => {
  const A = d.balanceSheet.assets;
  return [
    { label: 'Investments at cost', amount: A.investmentsAtCost },
    ...(A.optionsPosition != null ? [{ label: 'Net options purchase position', amount: A.optionsPosition }] : []),
    ...(A.futuresMargin != null ? [{ label: 'Futures margin account', amount: A.futuresMargin }] : []),
    ...(A.optionsMargin != null ? [{ label: 'Options margin account', amount: A.optionsMargin }] : []),
    { kind: 'head', label: 'Current assets' },
    ...A.current.map(x => ({ kind: 'sub', label: x.label, mid: x.amount, note: x.note })),
    { kind: 'sub', label: 'Total current assets', amount: A.currentTotal },
  ];
};
const Stmt = ({ rows }) => <View>{rows.map((r, i) => <StmtRow key={i} {...r} />)}</View>;
const reconRows = d => {
  const r = d.reconciliation || {};
  const fmtDiff = v => (v == null ? '–' : Math.abs(v) <= 1 ? `${inr(v)} (within ₹1)` : inr(v));
  return [
    ...(r.portfolioValue != null ? [
      [`Portfolio value on ${fmtDate(d.to)}`, inr(r.portfolioValue)],
      ['Assets at cost + unrealised − liabilities', inr(r.valueFromStatement)],
      ['Difference', fmtDiff(r.valueDiff), r.valueDiff != null && Math.abs(r.valueDiff) > 1 ? C.red : C.ink],
    ] : []),
    ...(r.expected != null ? [
      ['Surplus implied by the value', inr(r.expected)],
      ['Surplus in the P&L', inr(r.computed)],
      ['Difference', fmtDiff(r.diff), r.diff != null && Math.abs(r.diff) > 1 ? C.red : C.ink],
    ] : []),
  ];
};

function PnlBalanceSheet({ accountId, ids, rk }) {
  const R = useRange('fy');
  const all = accountId === ALL_ID;
  // "All time" asks from the earliest possible date; the server starts it at the first date on record.
  const q = R.preset === 'all' ? { from: '2000-01-01' } : { from: R.from, to: R.to };
  const L = useOnce(() => reports.pnl(all ? ids : accountId, q), [accountId, q.from, q.to, rk]);
  const d = L.data;
  const cov = useCoverage(d);
  const period = d && d.asOf ? { from: d.from, to: d.to } : (R.preset === 'all' ? {} : R.range);
  const head = { title: 'Profit and loss account and balance sheet', asOf: d && d.asOf };
  const statement = (
    <StatementPanel asOf={d && d.asOf} note={d && d.asOf ? (d.computed ? 'Computed by Qode' : 'Nuvama report') : ''}
      extra={[...(all ? [accountsRow(ids)] : []), ...periodRows(period, cov)]} />
  );
  const side = <>{statement}<PeriodFilter R={R} cov={cov} sub="The P&L covers the period; the balance sheet is as of its last day." /></>;
  if (L.loading) return <ReportLayout {...head} main={<Loading rows={6} />} side={side} />;
  if (L.err) return <ReportLayout {...head} main={<ErrorBlock msg={L.err} onRetry={L.reload} />} side={side} />;
  if (!d || !d.asOf) return <ReportLayout {...head} main={<Empty>{cov && cov.from && cov.to
    ? `No statement for this period. Statements can be prepared for any dates from ${fmtDate(cov.from)} to ${fmtDate(cov.to)}.`
    : `No statement is available for ${all ? 'these accounts' : 'this account'} yet.`}</Empty>} side={side} />;

  const r = d.reconciliation || {};
  const pdfName = `PnL and balance sheet ${all ? 'All accounts' : accountId} ${d.from} to ${d.to}`;
  return (
    <ReportLayout
      {...head}
      pdf={<PdfBtn make={async () => plbsPdf(d, all ? null : accountId)} name={pdfName} />}
      stats={[
        { label: 'Total income', value: sinr(d.pnl.incomeTotal), color: gainColor(d.pnl.incomeTotal) },
        { label: 'Total expenses', value: inr(d.pnl.expenseTotal) },
        { label: 'Surplus', value: sinr(d.pnl.surplus), color: gainColor(d.pnl.surplus) },
        { label: 'Unrealised, net', value: sinr(d.unrealised.net), color: gainColor(d.unrealised.net) },
        ...(r.portfolioValue != null ? [{ label: 'Portfolio value', value: inr(r.portfolioValue), note: 'on ' + fmtDate(d.to) }] : []),
      ]}
      main={<>
        {!!(d.computed && d.note) && <Tx s={12} c={C.ink3} lh={1.5}>{d.note}{d.basis ? ' ' + d.basis : ''}</Tx>}
        <Panel title="Profit and loss account" sub={`${fmtDate(d.from)} to ${fmtDate(d.to)}`}>
          <Stmt rows={pnlRows(d)} />
        </Panel>
        <Panel title="Unrealised gain or loss in the value of investments" sub="Shown for information; not part of the surplus">
          <Stmt rows={unrealRows(d)} />
        </Panel>
        <Panel title={`Balance sheet as of ${fmtDate(d.to)}`} sub="At cost">
          <Row>
            <View style={{ flex: 1, minWidth: 0, justifyContent: 'space-between' }}>
              <View>
                <Tx w={600} s={13} c={C.green} style={{ marginBottom: 4 }}>Liabilities</Tx>
                <Stmt rows={liabRows(d)} />
              </View>
              <StmtRow kind="grand" label="Total" amount={d.balanceSheet.liabilities.total} />
            </View>
            <View style={{ width: 1, backgroundColor: C.line }} />
            <View style={{ flex: 1, minWidth: 0, justifyContent: 'space-between' }}>
              <View>
                <Tx w={600} s={13} c={C.green} style={{ marginBottom: 4 }}>Assets</Tx>
                <Stmt rows={assetRows(d)} />
              </View>
              <StmtRow kind="grand" label="Total" amount={d.balanceSheet.assets.total} />
            </View>
          </Row>
        </Panel>
      </>}
      side={<>
        {side}
        {reconRows(d).length > 0 && (
          <Panel title="Reconciliation" sub={r.note}>
            <KeyVals items={reconRows(d)} style={{ marginTop: -8 }} />
          </Panel>
        )}
      </>}
    />
  );
}

// ── page ──────────────────────────────────────────────────────────────────────────────────────────────────
const KINDS = [['txn', 'Transactions'], ['cg', 'Capital gains'], ['exp', 'Expenses'], ['fs', 'Fact sheet'], ['pl', 'P&L and balance sheet']];
export default function DesktopReports({ V }) {
  const opts = reportAccountOptions(V);
  const singles = singleAccounts(opts);
  const ids = singles.map(o => o.id);
  const names = Object.fromEntries(singles.map(o => [o.id, o.label]));
  const [sel, setSel] = useState(null);
  const [kind, setKind] = useState('txn');
  // "All accounts" is offered first, but the default stays the first single account.
  const accountId = sel && opts.some(o => o.id === sel) ? sel : singles[0] && singles[0].id;
  const Body = { txn: Transactions, cg: CapitalGains, exp: Expenses, fs: Factsheet, pl: PnlBalanceSheet }[kind];
  return (
    <View>
      <View style={{ zIndex: 20 }}>
        <PageIntro title="Statements" sub="Custodian statements for your Qode PMS account from Nuvama: transactions, capital gains, expenses, the portfolio fact sheet, and the profit and loss account with the balance sheet. Each one can be downloaded as a PDF."
          right={<AccountPicker options={opts} value={accountId} onPick={setSel} />} />
      </View>
      <Tabs value={kind} options={KINDS} onChange={setKind} style={{ marginBottom: 20 }} />
      {/* keyed so filters and paging reset when the account or report changes */}
      {accountId ? <Body key={kind + accountId + (accountId === ALL_ID ? ids.join(',') : '')} accountId={accountId} ids={ids} names={names} rk={V.rk} /> : <Empty>No active account found.</Empty>}
    </View>
  );
}
