// Reports page (Home → Reports, More → Reports): the custodian's statements for one strategy account:
// Transactions (pms_transactions, synced daily), Capital gains, Expenses, the Portfolio fact sheet and the P&L and
// balance sheet (Nuvama exports loaded on the server by myQode/scripts/import-nuvama-reports.mjs; each shows its
// "as of" date). Layout: scrollable report tabs, one compact row (Account ▾ and Period ▾ chips that open bottom
// sheets, a download button), one status line, the summary strip, then the list.
// Data: /api/mobile/reports/* (src/api → reports). Every report can be saved or shared as a PDF (savePdf).
// "All accounts" (2+ accounts): every account's full list (export=1) fetched in parallel and merged in src/combine.js,
// rows tagged with their account, totals summed, one combined PDF per report. The P&L and balance sheet is summed on
// the server instead: "All accounts" is one call with every code.
import React, { useState, useEffect, useRef } from 'react';
import { View, Pressable, ScrollView, Alert, Platform, ActivityIndicator, TextInput } from 'react-native';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { C, Tx, Amt, Card, CTA, Chip, Sheet, Field } from '../ui';
import { reports } from '../api';
import { useLoad, ErrorBox, Empty, SectionLabel, Loading, ClosedAccountPopup } from './kit';
import { inr, sinr, pct, fmtDate } from '../adapt';
import { Download, ChevronDown, Check, Search, InfoCircle } from '../icons';
import { PLBS_INFO, TXN_INFO, CG_INFO, EXP_INFO, FS_INFO } from '../plbsInfo';
import { savePdf } from './partner';
import { transactionsPdf, capitalGainsPdf, expensesPdf, factsheetPdf, transactionsAllPdf, capitalGainsAllPdf, expensesAllPdf, factsheetAllPdf, plbsPdf } from './reportPdf';
import { transactionsXlsx, capitalGainsXlsx, expensesXlsx, factsheetXlsx, plbsXlsx, saveXlsx } from '../reportXlsx';
import Svg, { Rect, Line } from 'react-native-svg';
import { ALL_ID, reportAccountOptions, singleAccounts, failedText, loadTransactionsAll, loadCapitalGainsAll, loadExpensesAll, loadFactsheetsAll, FACTSHEET_NOTE } from '../combine';
import { track } from '../api/track';

import { userMessage } from '../errors';
import { useUnrealised } from '../unrealised';
import { latestDate, monthEnds, earliestDate, asOfHint } from '../reportDates';
// ── formatting ────────────────────────────────────────────────────────────────────────────────────────────
// Money, percentages and dates use the app-wide formatters (src/adapt.js) so Reports matches every other screen.
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const dt = fmtDate;
const monthLabel = d => `${MON[+d.slice(5, 7) - 1]} ${d.slice(0, 4)}`;
const inr2 = v => inr(v);   // rates: same 2-decimal money format
const qtyFmt = v => (v == null ? '' : Number(v).toLocaleString('en-IN', { maximumFractionDigits: 4 }));
const signed = sinr;
const gainColor = v => (v != null && Math.round(v * 100) > 0 ? C.pos : v != null && Math.round(v * 100) < 0 ? C.red : C.ink);
// Nuvama's period headers: "1m" → "1M", "Since 13/11/24" → "Since 13 Nov 2024".
const periodLabel = p => String(p).replace(/^(\d+)([a-z])$/i, (_, n, u) => n + u.toUpperCase())
  .replace(/^Since (\d{2})\/(\d{2})\/(\d{2,4})$/i, (_, d, m, y) => `Since ${d} ${MON[+m - 1]} ${y.length === 2 ? '20' + y : y}`);

// ── a paged list: first page carries the summary (head); "Load more" appends ──────────────────────────────
function usePaged(fetchPage, deps) {
  const [st, set] = useState({ head: null, items: [], loading: true, more: false, err: '', busy: false });
  const [tick, setTick] = useState(0);
  const gen = useRef(0);
  useEffect(() => {
    const g = ++gen.current;
    set({ head: null, items: [], loading: true, more: false, err: '', busy: false });
    fetchPage(0).then(
      d => { if (g === gen.current) set({ head: d, items: d.items || [], loading: false, more: !!d.hasMore, err: '', busy: false }); },
      e => { if (g === gen.current) set(s => ({ ...s, loading: false, err: userMessage(e, 'Something went wrong.') })); });
  }, [...deps, tick]);
  const loadMore = () => {
    if (st.busy || !st.more) return;
    const g = gen.current;
    set(s => ({ ...s, busy: true }));
    fetchPage(st.items.length).then(
      d => { if (g === gen.current) set(s => ({ ...s, items: s.items.concat(d.items || []), more: !!d.hasMore, busy: false })); },
      e => { if (g !== gen.current) return; set(s => ({ ...s, busy: false })); Alert.alert('Couldn’t load more', userMessage(e, 'Please try again.')); });
  };
  return { ...st, loadMore, reload: () => setTick(t => t + 1) };
}

// ── periods ───────────────────────────────────────────────────────────────────────────────────────────────
// A period is { key, from, to } with ISO dates (either side may be open). Presets are computed from today; the
// Indian financial year runs 1 Apr to 31 Mar. The backend filters by transaction date (capital gains: sale date).
const pad2 = n => String(n).padStart(2, '0');
const isoOf = d => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const dateOf = s => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || ''); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null; };
const fyStartYear = t => (t.getMonth() >= 3 ? t.getFullYear() : t.getFullYear() - 1);
const monthsBack = (t, n) => {
  const first = new Date(t.getFullYear(), t.getMonth() - n, 1);
  const last = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  return new Date(first.getFullYear(), first.getMonth(), Math.min(t.getDate(), last));
};
const PRESETS = {
  fy: ['This FY', t => ({ from: `${fyStartYear(t)}-04-01`, to: isoOf(t) })],
  lfy: ['Last FY', t => { const y = fyStartYear(t) - 1; return { from: `${y}-04-01`, to: `${y + 1}-03-31` }; }],
  '3m': ['3M', t => ({ from: isoOf(monthsBack(t, 3)), to: isoOf(t) })],
  '12m': ['12M', t => ({ from: isoOf(monthsBack(t, 12)), to: isoOf(t) })],
  all: ['All', () => ({ from: undefined, to: undefined })],
  custom: ['Custom', null],
};
const ALL_PRESETS = ['fy', 'lfy', '3m', '12m', 'all', 'custom'];
const ALL_TIME = { key: 'all', from: undefined, to: undefined };
const rangeText = (from, to) => (from && to ? `${dt(from)} to ${dt(to)}` : from ? `From ${dt(from)}` : to ? `Up to ${dt(to)}` : '');
const rangeQuery = p => ({ from: (p && p.from) || undefined, to: (p && p.to) || undefined });
// A preset needs history behind it: 3M / 12M need the account to be at least that old, Last FY needs some of that
// year on record. `since` = the first date on record ("Records from"); unknown → every preset is offered.
const presetOk = (k, since) => {
  if (!since || !['3m', '12m', 'lfy'].includes(k)) return true;
  const r = PRESETS[k][1](new Date()), grace = 5 * 86400000;
  return k === 'lfy' ? since <= r.to : Date.parse(since) <= Date.parse(r.from) + grace;
};
const rangeFile = p => (p && (p.from || p.to) ? ` ${p.from || 'start'} to ${p.to || isoOf(new Date())}` : '');
// The PDF shows the period the user asked for, even if a (demo) response does not echo it.
const withRange = (d, p) => ({ ...d, from: d.from || (p && p.from) || null, to: d.to || (p && p.to) || null });

// One date: a field on web, the system dialog on Android, an inline calendar that opens under the row on iOS.
function DateRow({ label, value, placeholder, min, max, open, onToggle, onPick, onClear }) {
  const today = new Date();
  const clampD = d => (min && d < min ? min : max && d > max ? max : d);
  const cur = clampD(dateOf(value) || today);
  if (Platform.OS === 'web') {
    return (
      <View style={{ marginTop: 14 }}>
        <Tx w={700} s={10} ls={0.12} c={C.gray}>{label}</Tx>
        <Field value={value || ''} placeholder="YYYY-MM-DD" s={14} style={{ marginTop: 6 }}
          onChangeText={t => { const d = dateOf(t.trim()); if (d) onPick(isoOf(clampD(d))); else if (!t.trim() && onClear) onClear(); }} />
      </View>
    );
  }
  const press = () => {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({ value: cur, mode: 'date', minimumDate: min || undefined, maximumDate: max || undefined, onValueChange: (_e, d) => { if (d) onPick(isoOf(d)); }, onDismiss: () => {} });
      return;
    }
    onToggle();
  };
  return (
    <View style={{ marginTop: 14 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Tx w={700} s={10} ls={0.12} c={C.gray} style={{ flex: 1 }}>{label}</Tx>
        {!!value && !!onClear && <Pressable onPress={onClear} hitSlop={8}><Tx w={700} s={10.5} c={C.muted}>CLEAR</Tx></Pressable>}
      </View>
      <Pressable onPress={press} style={{ marginTop: 6, borderWidth: 1, borderColor: open ? C.green : C.mutedBorder35, borderRadius: 8, paddingVertical: 11, paddingHorizontal: 12 }}>
        {value ? <Tx w={700} s={13}>{dt(value)}</Tx> : <Tx s={13} c={C.gray}>{placeholder}</Tx>}
      </Pressable>
      {Platform.OS === 'ios' && open && (
        <DateTimePicker value={cur} mode="date" display="inline" themeVariant="light" accentColor={C.green} minimumDate={min || undefined} maximumDate={max || undefined}
          onValueChange={(_e, d) => { if (d) onPick(isoOf(d)); }} style={{ alignSelf: 'stretch', marginTop: 6 }} />
      )}
    </View>
  );
}

// ── controls: select chips that open bottom sheets ────────────────────────────────────────────────────────
// A compact chip showing the current choice with a chevron; opens a sheet.
function SelectChip({ label, onPress, a11y }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={a11y ? `${a11y}: ${label}` : label} hitSlop={4}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1, minHeight: 36, borderWidth: 1, borderColor: C.mutedBorder35,
        borderRadius: 999, paddingVertical: 8, paddingHorizontal: 13, backgroundColor: pressed ? 'rgba(2,66,43,0.06)' : 'transparent' })}>
      <Tx w={700} s={11.5} c={C.green} style={{ flexShrink: 1 }}>{label}</Tx>
      <ChevronDown s={9} c={C.muted} />
    </Pressable>
  );
}

// A sheet's list of choices. options: [{ id, label, note? }] or { section } headings; value: the selected id.
function OptionList({ options, value, onPick }) {
  return (
    <View style={{ marginTop: 8 }}>
      {options.map((o, i) => (o.section ? (
        <Tx key={'s' + i} w={700} s={10} ls={0.12} c={C.gray} style={{ marginTop: i ? 16 : 6, marginBottom: 2 }}>{o.section.toUpperCase()}</Tx>
      ) : (
        <Pressable key={String(o.id)} onPress={o.disabled ? undefined : () => onPick(o.id)} disabled={!!o.disabled} accessibilityRole="button" accessibilityState={{ selected: o.id === value, disabled: !!o.disabled }}
          style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 13, borderBottomWidth: 1, borderColor: C.hairline, opacity: o.disabled ? 0.4 : pressed ? 0.6 : 1 })}>
          <Tx w={o.id === value ? 700 : 400} s={13.5} c={o.id === value ? C.green : C.ink} numberOfLines={2} style={{ flex: 1 }}>{o.label}</Tx>
          {!!o.note && <Tx s={11.5} c={C.muted} numberOfLines={1}>{o.note}</Tx>}
          <View style={{ width: 16, alignItems: 'flex-end' }}>{o.id === value ? <Check s={13} c={C.green} /> : null}</View>
        </Pressable>
      )))}
    </View>
  );
}
const SheetTitle = ({ title, sub }) => (
  <>
    <Tx f="play" w={600} s={20}>{title}</Tx>
    {!!sub && <Tx s={12} c={C.muted} lh={1.5} style={{ marginTop: 4 }}>{sub}</Tx>}
  </>
);

// Custom period (inside the period sheet): From / To, either may be left open; from must not be after to.
function RangeBody({ init, onApply, onBack }) {
  const [v, setV] = useState(() => (init && (init.from || init.to) ? { from: init.from || '', to: init.to || '' } : PRESETS.fy[1](new Date())));
  const [edit, setEdit] = useState('');
  const [err, setErr] = useState('');
  const today = new Date();
  const put = (k, val) => { setV(s => ({ ...s, [k]: val })); setErr(''); };
  const apply = () => {
    if (v.from && v.to && v.from > v.to) return setErr('The From date must be on or before the To date.');
    if (!v.from && !v.to) return setErr('Pick at least one date, or choose All time.');
    onApply({ from: v.from || undefined, to: v.to || undefined });
  };
  return (
    <>
      <SheetTitle title="Custom period" sub="Leave a date empty to include everything before or after the other one." />
      <DateRow label="FROM" value={v.from} placeholder="Earliest record" max={dateOf(v.to) || today} open={edit === 'from'}
        onToggle={() => setEdit(e => (e === 'from' ? '' : 'from'))} onPick={d => put('from', d)} onClear={() => put('from', '')} />
      <DateRow label="TO" value={v.to} placeholder="Latest record" min={dateOf(v.from)} max={today} open={edit === 'to'}
        onToggle={() => setEdit(e => (e === 'to' ? '' : 'to'))} onPick={d => put('to', d)} onClear={() => put('to', '')} />
      {!!err && <Tx s={12} c={C.red} style={{ marginTop: 12 }}>{err}</Tx>}
      <CTA label="APPLY" onPress={apply} style={{ marginTop: 18 }} />
      <CTA outline label="BACK" onPress={onBack} style={{ marginTop: 10 }} />
    </>
  );
}

// Period chip + sheet. value: { key, from, to } or null (capital gains by FY). head: extra choices listed first
// (capital gains: the financial years), picked through onHead; selected overrides which choice is ticked.
const PRESET_LONG = { fy: 'This FY', lfy: 'Last FY', '3m': 'Last 3 months', '12m': 'Last 12 months', all: 'All time', custom: 'Custom…' };
const periodChipText = p => (!p ? '' : p.key === 'custom' ? rangeText(p.from, p.to) || 'Custom' : PRESET_LONG[p.key]);
function PeriodChip({ value, onChange, keys = ALL_PRESETS, head = [], onHead, selected, text, sub, keysTitle, since }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState('list');
  const close = () => { setOpen(false); setMode('list'); };
  const pick = id => {
    if (head.some(h => h.id === id)) { close(); onHead(id); return; }
    if (id === 'custom') { setMode('custom'); return; }
    close();
    onChange({ key: id, ...PRESETS[id][1](new Date()) });
  };
  const opts = [...head, ...(keysTitle ? [{ section: keysTitle }] : []), ...keys.map(k => presetOk(k, since) ? { id: k, label: PRESET_LONG[k] } : { id: k, label: PRESET_LONG[k], note: 'Not enough history', disabled: true })];
  return (
    <>
      <SelectChip label={text || periodChipText(value) || 'Period'} a11y="Period" onPress={() => setOpen(true)} />
      <Sheet visible={open} onClose={close}>
        <View style={{ paddingHorizontal: 20, paddingTop: 8 }}>
          {mode === 'custom'
            ? <RangeBody init={value} onBack={() => setMode('list')} onApply={r => { close(); onChange({ key: 'custom', ...r }); }} />
            : <><SheetTitle title="Period" sub={sub} /><OptionList options={opts} value={selected !== undefined ? selected : value && value.key} onPick={pick} /></>}
        </View>
      </Sheet>
    </>
  );
}

// Account chip + sheet ("All accounts" first when there are 2+). Nothing to choose with one account.
function AccountChip({ options, value, onPick, count }) {
  const [open, setOpen] = useState(false);
  if (!options || options.length < 2) return null;
  const text = o => (o.id === ALL_ID ? `${o.label} (${count})` : o.label);
  const cur = options.find(o => o.id === value) || options[0];
  return (
    <>
      <SelectChip label={text(cur)} a11y="Account" onPress={() => setOpen(true)} />
      <Sheet visible={open} onClose={() => setOpen(false)}>
        <View style={{ paddingHorizontal: 20, paddingTop: 8 }}>
          <SheetTitle title="Account" />
          <OptionList options={options.map(o => ({ id: o.id, label: text(o) }))} value={cur.id} onPick={id => { setOpen(false); onPick(id); }} />
        </View>
      </Sheet>
    </>
  );
}

// ── PDF ───────────────────────────────────────────────────────────────────────────────────────────────────
// A round download button at the right of the controls row. Dimmed until there is something to save.
// xlsx: the same statement as an Excel workbook (src/reportXlsx.js), a second round button beside the PDF one.
const SheetIcon = ({ s = 16, c = C.green }) => (
  <Svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Rect x={3} y={4} width={18} height={16} rx={2} /><Line x1={3} y1={10} x2={21} y2={10} /><Line x1={3} y1={15} x2={21} y2={15} /><Line x1={9} y1={4} x2={9} y2={20} />
  </Svg>
);
function RoundBtn({ onPress, off, busy, label, children }) {
  return (
    <Pressable onPress={onPress} disabled={off} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled: off, busy }} hitSlop={6}
      style={({ pressed }) => ({ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(2,66,43,0.35)',
        backgroundColor: off ? 'transparent' : 'rgba(2,66,43,0.06)', opacity: off ? 0.45 : pressed ? 0.7 : 1 })}>
      {busy ? <ActivityIndicator size="small" color={C.green} /> : children}
    </Pressable>
  );
}
function PdfButton({ make, xlsx, name, disabled }) {
  const [busy, setBusy] = useState('');   // '' | 'pdf' | 'xlsx'
  const off = disabled || !make;
  const go = async () => {
    if (busy || off) return;
    setBusy('pdf');
    try { const out = await make(); const doc = typeof out === 'string' ? { html: out, landscape: false } : out; await savePdf(doc.html, name, { share: true, landscape: doc.landscape }); }
    catch (e) { Alert.alert('Couldn’t create the PDF', userMessage(e, 'Please try again.')); }
    finally { setBusy(''); }
  };
  const goXlsx = async () => {
    if (busy || off || !xlsx) return;
    setBusy('xlsx');
    try { await saveXlsx(await xlsx(), name); }
    catch (e) { Alert.alert('Couldn’t create the Excel file', userMessage(e, 'Please try again.')); }
    finally { setBusy(''); }
  };
  return (
    <View style={{ flexDirection: 'row', gap: 8 }}>
      {!!xlsx && <RoundBtn onPress={goXlsx} off={off} busy={busy === 'xlsx'} label={busy === 'xlsx' ? 'Preparing Excel file' : 'Download Excel'}><SheetIcon /></RoundBtn>}
      <RoundBtn onPress={go} off={off} busy={busy === 'pdf'} label={busy === 'pdf' ? 'Preparing PDF' : 'Download PDF'}><Download s={16} c={C.green} /></RoundBtn>
    </View>
  );
}

// The row under the report tabs: account and period chips on the left, the download button on the right.
// The chips show their whole text: when a long account name and the period don't fit beside the download buttons,
// the row wraps and the buttons move to the next line.
const Controls = ({ account, period, pdf }) => (
  <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginTop: 12 }}>
    {account}
    {period}
    <View style={{ flex: 1, minWidth: 4 }} />
    {pdf || <PdfButton disabled />}
  </View>
);

// One muted line: "As of … · period · 128 entries · Records from …", with a "Computed by Qode" tag and a
// "How this is computed" toggle when the report was computed rather than supplied by Nuvama.
function StatusLine({ parts, computed, note }) {
  const [open, setOpen] = useState(false);
  const text = (parts || []).filter(Boolean).join(' · ');
  if (!text && !computed) return null;
  return (
    <View style={{ marginTop: 10, marginLeft: 2 }}>
      {!!text && <Tx s={11} c={C.gray} lh={1.5}>{text}</Tx>}
      {(!!computed || !!note) && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 6 }}>
          {!!computed && <Badge label="COMPUTED BY QODE" color={C.muted} />}
          {!!note && <Pressable onPress={() => setOpen(o => !o)} hitSlop={8}><Tx w={700} s={11} c={C.green}>{open ? 'Hide details' : 'How this is computed'}</Tx></Pressable>}
        </View>
      )}
      {open && !!note && <Tx s={11} c={C.muted} lh={1.5} style={{ marginTop: 6 }}>{note}</Tx>}
    </View>
  );
}
const asOfPart = d => (d ? `As of ${dt(d)}` : null);
const recordsPart = c => (c && c.from ? `Records from ${dt(c.from)}` : null);
const countPart = L => (!L.loading && !L.err && L.items.length ? `${L.items.length}${L.more ? '+' : ''} ${L.items.length === 1 && !L.more ? 'entry' : 'entries'}` : null);
// A horizontally scrolling row of small filter chips above a list.
const FilterChips = ({ options, value, onPick }) => (
  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 16, flexGrow: 0, marginHorizontal: -20 }} contentContainerStyle={{ gap: 8, paddingHorizontal: 20 }}>
    {options.map(([k, l]) => <Chip key={String(k)} label={l} active={value === k} onPress={() => onPick(k)} py={8} px={13} s={11.5} />)}
  </ScrollView>
);

// ── shared bits ───────────────────────────────────────────────────────────────────────────────────────────
// One compact summary card per report: a 2-column grid split by hairlines, small muted label (optional tiny
// suffix such as an entry count) above a 14 px figure. items: [{ label, value, color, note }].
// Cells are centred and the grid lines are drawn in a visible rule colour; an odd last figure spans the full width
// instead of leaving a blank half cell beside it.
const RULE = 'rgba(55,88,79,0.22)';
function Strip({ items, caption, footer, style }) {
  const list = (items || []).filter(Boolean);
  const odd = list.length % 2 === 1;
  const [open, setOpen] = useState(null);   // the tile whose explanation (info) is showing
  const shown = list.find(it => it.label === open && it.info);
  return (
    <Card style={[{ marginTop: 14, overflow: 'hidden' }, style]}>
      {!!caption && <Tx w={700} s={10} ls={0.1} c={C.muted} center numberOfLines={2} style={{ paddingHorizontal: 14, paddingTop: 12, paddingBottom: 10, borderBottomWidth: 1, borderColor: RULE }}>{caption}</Tx>}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {list.map((it, i) => {
          const full = odd && i === list.length - 1;
          return (
            <Pressable key={it.label} disabled={!it.info} onPress={() => setOpen(open === it.label ? null : it.label)} accessibilityRole={it.info ? 'button' : undefined}
              accessibilityLabel={it.info ? it.label + ', how this is worked out' : undefined} accessibilityState={it.info ? { expanded: open === it.label } : undefined}
              style={{ width: full ? '100%' : '50%', alignItems: 'center', justifyContent: 'center', paddingVertical: 11, paddingHorizontal: 12,
                borderLeftWidth: !full && i % 2 ? 1 : 0, borderTopWidth: i >= 2 ? 1 : 0, borderColor: RULE, backgroundColor: open === it.label ? 'rgba(2,66,43,0.05)' : 'transparent' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, maxWidth: '100%' }}>
                <Tx w={700} s={9.5} ls={0.1} c={C.muted} center numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={{ flexShrink: 1 }}>{it.label}</Tx>
                {!!it.note && <Tx s={9.5} c={C.gray}>{it.note}</Tx>}
                {!!it.info && <InfoCircle />}
              </View>
              <Amt s={14} c={it.color || C.ink} center numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={{ marginTop: 4, maxWidth: '100%' }}>{it.value}</Amt>
            </Pressable>
          );
        })}
      </View>
      {!!shown && (
        <View style={{ paddingHorizontal: 14, paddingVertical: 10, borderTopWidth: 1, borderColor: RULE, backgroundColor: 'rgba(2,66,43,0.04)' }}>
          <Tx w={700} s={10} ls={0.1} c={C.green}>{shown.label}</Tx>
          <Tx s={11.5} c={C.muted} lh={1.55} style={{ marginTop: 3 }}>{shown.info}</Tx>
        </View>
      )}
      {footer}
    </Card>
  );
}
function MoreButton({ L }) {
  if (!L.more) return null;
  return <CTA outline label={L.busy ? 'LOADING…' : 'LOAD MORE'} onPress={L.loadMore} style={{ marginTop: 12 }} />;
}
const Row = ({ last, children, onPress }) => {
  const style = { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, paddingHorizontal: 14, borderBottomWidth: last ? 0 : 1, borderColor: C.hairline };
  return onPress ? <Pressable onPress={onPress} style={style}>{children}</Pressable> : <View style={style}>{children}</View>;
};
const DateBox = ({ d }) => (
  <View style={{ width: 36, alignItems: 'center' }}>
    <Tx w={700} s={15}>{d ? d.slice(8, 10) : '–'}</Tx>
    <Tx s={10} c={C.muted}>{d ? MON[+d.slice(5, 7) - 1] : ''}</Tx>
  </View>
);
// align: where the badge sits in its column ('flex-end' under a right-aligned figure, so a list's badges line up).
const Badge = ({ label, color = C.muted, align = 'flex-start' }) => (
  <View style={{ borderWidth: 1, borderColor: color, borderRadius: 999, paddingVertical: 1, paddingHorizontal: 6, alignSelf: align }}>
    <Tx w={700} s={9} c={color}>{label}</Tx>
  </View>
);
// Items → [{ key: 'YYYY-MM', items }] in order
const byMonth = (items, dateOf) => items.reduce((out, it) => {
  const k = (dateOf(it) || '').slice(0, 7);
  if (!out.length || out[out.length - 1].key !== k) out.push({ key: k, items: [] });
  out[out.length - 1].items.push(it);
  return out;
}, []);
// All accounts: accounts that failed to load (the rest still show), the export cap, and the row count.
function CombinedNote({ h }) {
  if (!h || !h.all) return null;
  const failed = failedText(h.failed);
  return (
    <>
      {!!failed && <Tx s={11.5} c={C.red} lh={1.5} style={{ marginTop: 12, marginLeft: 2 }}>{failed}</Tx>}
      {!!h.truncated && <Tx s={11} c={C.gray} lh={1.5} style={{ marginTop: 6, marginLeft: 2 }}>Some accounts have more than 5,000 entries; the latest 5,000 of each are shown.</Tx>}
    </>
  );
}
function Status({ L, empty }) {
  if (L.loading) return <Loading rows={4} h={56} />;
  if (L.err) return <ErrorBox msg={L.err} onRetry={L.reload} />;
  if (empty) return <Empty>{empty}</Empty>;
  return null;
}

// Search text as typed, and the same text once typing pauses (what goes to the server as q).
function useSearch(ms = 350) {
  const [text, setText] = useState('');
  const [q, setQ] = useState('');
  useEffect(() => { const t = setTimeout(() => setQ(text.trim()), ms); return () => clearTimeout(t); }, [text, ms]);
  return { text, setText, q };
}

// ── Transactions ──────────────────────────────────────────────────────────────────────────────────────────
const TXN_GROUPS = [['all', 'All'], ['trades', 'Trades'], ['money', 'Money in/out'], ['income', 'Dividend/Interest'], ['charges', 'Fees'], ['other', 'Other']];
function TxnRow({ t, last }) {
  const sign = t.direction === 'in' ? '+' : t.direction === 'out' ? '−' : '';
  const detail = [t.account || null, t.security ? t.type : null, t.qty != null && t.rate != null ? `${qtyFmt(t.qty)} @ ${inr2(t.rate)}` : null, t.notes && !t.security ? t.notes : null].filter(Boolean).join(' · ');
  return (
    <Row last={last}>
      <DateBox d={t.date} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Tx w={700} s={12.5} numberOfLines={1}>{t.security || t.type}</Tx>
        {!!detail && <Tx s={11} c={C.muted} numberOfLines={2} style={{ marginTop: 2 }}>{detail}</Tx>}
      </View>
      <Amt s={12.5} c={t.direction === 'in' ? C.pos : C.ink}>{sign}{inr(t.amount)}</Amt>
    </Row>
  );
}
function Transactions({ accountId, ids, rk, account }) {
  const [group, setGroup] = useState('all');
  const Q = useSearch();   // what to look for: transaction type, security or details
  const [period, setPeriod] = useState(ALL_TIME);
  const all = accountId === ALL_ID;
  const L = usePaged(offset => (all
    ? loadTransactionsAll(ids, id => reports.transactions(id, { group, ...rangeQuery(period), q: Q.q || undefined, export: 1, limit: 5000 }), { group, ...rangeQuery(period) })
    : reports.transactions(accountId, { group, ...rangeQuery(period), q: Q.q || undefined, limit: 50, offset })), [accountId, group, period.from, period.to, Q.q, rk]);
  const h = L.head;
  const ranged = !!(period.from || period.to);
  // The statement's data for a download: the combined answer for all accounts, else the full export (up to 5,000 rows).
  const exportData = async () => withRange(all ? h : await reports.transactions(accountId, { group, ...rangeQuery(period), q: Q.q || undefined, export: 1, limit: 5000 }), period);
  const groupLabel = (TXN_GROUPS.find(g => g[0] === group) || [])[1];
  const makePdf = async () => (all ? transactionsAllPdf(await exportData(), groupLabel) : transactionsPdf(await exportData(), accountId, groupLabel));
  const makeXlsx = async () => transactionsXlsx(await exportData(), all ? null : accountId, groupLabel);
  const empty = h && !h.asOf ? `No transactions are on record for ${all ? 'these accounts' : 'this account'} yet.`
    : Q.q ? `No transactions match “${Q.q}”${group === 'all' ? '' : ' in this category'}${ranged ? ' for this period' : ''}.`
    : ranged ? (group === 'all' ? 'No transactions in this period.' : 'No transactions in this category for this period.')
      : 'No transactions in this category.';

  return (
    <>
      <Controls account={account} period={<PeriodChip value={period} onChange={setPeriod} sub="By date of transaction. Applies to the list and the PDF." since={h && h.coverage && h.coverage.from} />}
        pdf={<PdfButton make={makePdf} xlsx={makeXlsx} name={`Transactions ${all ? 'All accounts' : accountId}${rangeFile(period)}`} disabled={!L.items.length} />} />
      <StatusLine parts={[asOfPart(h && h.asOf), rangeText(period.from, period.to) || 'All time', countPart(L), recordsPart(h && h.coverage)]} />
      {h && h.asOf && (
        <Strip items={[
          { label: 'MONEY IN', value: signed(h.moneyIn), color: gainColor(h.moneyIn), info: TXN_INFO.moneyIn },
          { label: 'MONEY OUT', value: h.moneyOut ? '−' + inr(h.moneyOut) : inr(0), info: TXN_INFO.moneyOut },
          // trades left out of the totals; income and charges under the names on the filter chips (TXN_GROUPS)
          ...h.summary.filter(s => s.group !== 'money' && s.group !== 'trades').map(s => ({ label: (((TXN_GROUPS.find(g => g[0] === s.group) || [])[1]) || s.label).toUpperCase(), value: inr(s.amount), info: s.group === 'income' ? TXN_INFO.income : TXN_INFO.fees })),
        ]} />
      )}
      <CombinedNote h={h} />
      <FilterChips options={TXN_GROUPS} value={group} onPick={setGroup} />
      <View style={{ marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 8, height: 42, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, borderColor: C.mutedBorder35, backgroundColor: '#fff' }}>
        <Search s={15} c={C.muted} />
        <TextInput value={Q.text} onChangeText={Q.setText} placeholder="Search, e.g. Custody Charges" placeholderTextColor={C.muted} autoCapitalize="none" autoCorrect={false} returnKeyType="search"
          style={{ flex: 1, fontSize: 13, color: C.ink, paddingVertical: 0, fontFamily: 'Inter_400Regular' }} />
        {!!Q.text && <Pressable accessibilityRole="button" accessibilityLabel="Clear search" onPress={() => Q.setText('')} hitSlop={8}><Tx s={18} c={C.muted}>×</Tx></Pressable>}
      </View>
      <View style={{ marginTop: 4 }}><Status L={L} empty={!L.loading && !L.err && !L.items.length ? empty : null} /></View>
      {!L.loading && !L.err && byMonth(L.items, t => t.date).map(m => (
        <View key={m.key}>
          <SectionLabel style={{ marginTop: 18 }}>{m.key ? monthLabel(m.key + '-01').toUpperCase() : ''}</SectionLabel>
          <Card style={{ overflow: 'hidden' }}>{m.items.map((t, i) => <TxnRow key={t.id} t={t} last={i === m.items.length - 1} />)}</Card>
        </View>
      ))}
      <MoreButton L={L} />
    </>
  );
}

// ── Capital gains ─────────────────────────────────────────────────────────────────────────────────────────
function CapitalGains({ accountId, ids, rk, account }) {
  const [fy, setFy] = useState(null);
  const [term, setTerm] = useState('');
  // A date range (sale date) overrides the financial year; null = by FY.
  const [range, setRange] = useState(null);
  // "All" here is everything up to today (the API needs a from or a to to leave FY mode).
  const pickRange = p => setRange(p.key === 'all' ? { key: 'all', from: undefined, to: isoOf(new Date()) } : p);
  const q = range ? rangeQuery(range) : { fy: fy || undefined };
  const all = accountId === ALL_ID;
  // All accounts: the same FY (or sale-date range) for every account; with no FY chosen, the newest year any has.
  const L = usePaged(offset => (all
    ? loadCapitalGainsAll(ids, (id, o) => reports.capitalGains(id, { ...(range ? q : o), term: term || undefined, export: 1, limit: 5000 }), { ...q, term: term || undefined })
    : reports.capitalGains(accountId, { ...q, term: term || undefined, limit: 50, offset })), [accountId, fy, range && range.from, range && range.to, term, rk]);
  const h = L.head, s = h && h.summary;
  const U = useUnrealised(all ? ids : [accountId]);   // unrealised: on what is held now, whatever the period
  const exportData = async () => { const d = all ? h : await reports.capitalGains(accountId, { ...(range ? rangeQuery(range) : { fy: h.fy }), term: term || undefined, export: 1, limit: 5000 }); return range ? withRange(d, range) : d; };
  const makePdf = async () => (all ? capitalGainsAllPdf(await exportData()) : capitalGainsPdf(await exportData(), accountId));
  const makeXlsx = async () => capitalGainsXlsx(await exportData(), all ? null : accountId);
  // The years list only comes with FY answers; keep the last one so the FY choices stay while a range is shown.
  const [years, setYears] = useState([]);
  useEffect(() => { if (h && h.years && h.years.length) setYears(h.years); }, [h]);
  const curFy = !range && h && h.fy;
  const period = (
    <PeriodChip value={range} onChange={pickRange} keys={['3m', '12m', 'all', 'custom']}
      head={years.length ? [{ section: 'Financial year' }, ...years.map(y => ({ id: 'fy:' + y.fy, label: 'FY ' + y.fy }))] : []}
      keysTitle={years.length ? 'By date of sale' : null}
      onHead={id => { const y = years.find(x => 'fy:' + x.fy === id); if (y) { setRange(null); setFy(y.fy); } }}
      selected={range ? range.key : curFy ? 'fy:' + curFy : null}
      text={range ? periodChipText(range) : curFy ? `FY ${curFy}` : 'Financial year'}
      sub="Realised gains by date of sale: a financial year or any dates." />
  );

  return (
    <>
      <Controls account={account} period={period}
        pdf={<PdfButton make={makePdf} xlsx={makeXlsx} name={range ? `Capital gains ${all ? 'All accounts' : accountId}${rangeFile(range)}` : `Capital gains FY ${h && h.fy} ${all ? 'All accounts' : accountId}`} disabled={!(h && h.summary)} />} />
      <StatusLine parts={[asOfPart(h && h.asOf), range ? (range.key === 'all' ? 'All time' : rangeText(range.from, range.to)) : h && h.fy ? `FY ${h.fy}` : null, recordsPart(h && h.coverage)]} />
      {s && (
        <Strip items={[
          { label: 'SHORT TERM', value: signed(s.st), color: gainColor(s.st), info: CG_INFO.st },
          { label: 'LONG TERM', value: signed(s.lt), color: gainColor(s.lt), info: CG_INFO.lt },
          { label: 'REALISED GAINS', value: signed(s.total), color: gainColor(s.total), info: CG_INFO.realised },
          { label: 'UNREALISED GAINS', value: U.gain != null ? signed(U.gain) : U.loading ? '…' : '–', color: U.gain != null ? gainColor(U.gain) : C.muted, info: CG_INFO.unrealised },
        ]} footer={s.byCategory.length > 1 && (
            <View style={{ paddingHorizontal: 14, paddingVertical: 10, borderTopWidth: 1, borderColor: C.hairline, gap: 8 }}>
              {s.byCategory.map(c => (
                <View key={c.category} style={{ flexDirection: 'row', gap: 10 }}>
                  <Tx s={11} c={C.muted} style={{ flex: 1 }} numberOfLines={2}>{c.category}</Tx>
                  <Amt s={11.5} c={gainColor((c.st || 0) + (c.lt || 0))}>{signed((c.st || 0) + (c.lt || 0))}</Amt>
                </View>
              ))}
            </View>
          )} />
      )}
      <CombinedNote h={h} />
      {years.length > 0 && <FilterChips options={[['', 'All lots'], ['ST', 'Short term'], ['LT', 'Long term']]} value={term} onPick={setTerm} />}
      <View style={{ marginTop: 14 }}><Status L={L} empty={!L.loading && !L.err && !L.items.length ? (h && !h.asOf ? `No capital gains report is available for ${all ? 'these accounts' : 'this account'} yet.` : range ? 'No realised gains in this period.' : 'No realised gains in this selection.') : null} /></View>
      {!L.loading && !L.err && !!L.items.length && (
        <Card style={{ overflow: 'hidden' }}>
          {L.items.map((l, i) => (
            <Row key={i} last={i === L.items.length - 1}>
              <DateBox d={l.saleDate} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Tx w={700} s={12.5} numberOfLines={1}>{l.security}</Tx>
                <Tx s={11} c={C.muted} numberOfLines={1} style={{ marginTop: 2 }}>{[l.account, l.qty != null && 'Qty ' + qtyFmt(l.qty), 'bought ' + dt(l.purchaseDate), l.daysHeld != null && l.daysHeld + (l.daysHeld === 1 ? ' day' : ' days')].filter(Boolean).join(' · ')}</Tx>
                <Tx s={11} c={C.muted} numberOfLines={1} style={{ marginTop: 1 }}>Sold {inr(l.saleAmount)} · cost {inr(l.cost)}</Tx>
              </View>
              <View style={{ alignItems: 'flex-end', gap: 4 }}>
                <Amt s={12.5} c={gainColor(l.gain)}>{signed(l.gain)}</Amt>
                <Badge label={l.term} align="flex-end" />
              </View>
            </Row>
          ))}
        </Card>
      )}
      <MoreButton L={L} />
    </>
  );
}

// ── Expenses ──────────────────────────────────────────────────────────────────────────────────────────────
// Charge filter: a chip above the list opening a sheet with every charge, its entry count and total.
function ChargeChip({ byType, value, onPick }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <SelectChip label={value || 'All charges'} a11y="Charge" onPress={() => setOpen(true)} />
      <Sheet visible={open} onClose={() => setOpen(false)}>
        <View style={{ paddingHorizontal: 20, paddingTop: 8 }}>
          <SheetTitle title="Charge" sub="Show one charge, or all of them." />
          <OptionList options={[{ id: '', label: 'All charges' }, ...byType.map(t => ({ id: t.type, label: t.type, note: `${t.count} · ${inr(t.amount)}` }))]}
            value={value} onPick={id => { setOpen(false); onPick(id); }} />
        </View>
      </Sheet>
    </>
  );
}
function Expenses({ accountId, ids, rk, account }) {
  const [type, setType] = useState('');
  const [period, setPeriodRaw] = useState(ALL_TIME);
  // A charge picked in one period may not exist in the next, so a new period shows every charge again.
  const setPeriod = p => { setPeriodRaw(p); setType(''); };
  const all = accountId === ALL_ID;
  const L = usePaged(offset => (all
    ? loadExpensesAll(ids, id => reports.expenses(id, { type: type || undefined, ...rangeQuery(period), export: 1, limit: 5000 }), { type: type || undefined, ...rangeQuery(period) })
    : reports.expenses(accountId, { type: type || undefined, ...rangeQuery(period), limit: 50, offset })), [accountId, type, period.from, period.to, rk]);
  const h = L.head;
  const ranged = !!(period.from || period.to);
  const exportData = async () => withRange(all ? h : await reports.expenses(accountId, { type: type || undefined, ...rangeQuery(period), export: 1, limit: 5000 }), period);
  const makePdf = async () => (all ? expensesAllPdf(await exportData()) : expensesPdf(await exportData(), accountId));
  const makeXlsx = async () => expensesXlsx(await exportData(), all ? null : accountId);
  // byType comes with each first page; keep the last one so the charge chip stays while a filter loads.
  const [byType, setByType] = useState([]);
  useEffect(() => { if (h && h.byType) setByType(h.byType); }, [h]);

  return (
    <>
      <Controls account={account} period={<PeriodChip value={period} onChange={setPeriod} sub="By date of charge. Applies to the list and the PDF." since={h && h.coverage && h.coverage.from} />}
        pdf={<PdfButton make={makePdf} xlsx={makeXlsx} name={`Expenses ${all ? 'All accounts' : accountId}${rangeFile(period)}`} disabled={!L.items.length} />} />
      <StatusLine parts={[asOfPart(h && h.asOf), rangeText(period.from, period.to) || 'All time', countPart(L),
        h && h.period && (h.period.from || h.period.to) ? `Statement covers ${rangeText(h.period.from, h.period.to)}` : null]} />
      {h && h.asOf && (
        <Strip items={[
          { label: 'PAID', value: inr(h.paid), info: EXP_INFO.paid },
          { label: 'PAYABLE (ACCRUED)', value: inr(h.payable), info: EXP_INFO.payable },
        ]} />
      )}
      <CombinedNote h={h} />
      {byType.length > 0 && <View style={{ flexDirection: 'row', marginTop: 16 }}><ChargeChip byType={byType} value={type} onPick={setType} /></View>}
      <View style={{ marginTop: 14 }}><Status L={L} empty={!L.loading && !L.err && !L.items.length ? (h && h.asOf && ranged ? 'No expense entries in this period.' : h && h.asOf && type ? 'No entries for this charge.' : `No expense statement is available for ${all ? 'these accounts' : 'this account'} yet.`) : null} /></View>
      {!L.loading && !L.err && !!L.items.length && (
        <Card style={{ overflow: 'hidden' }}>
          {L.items.map((x, i) => (
            <Row key={i} last={i === L.items.length - 1}>
              <DateBox d={x.date} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Tx w={700} s={12.5} numberOfLines={1}>{x.type}</Tx>
                {!!x.account && <Tx s={11} c={C.muted} numberOfLines={1} style={{ marginTop: 2 }}>{x.account}</Tx>}
                {!!x.notes && <Tx s={11} c={C.muted} numberOfLines={2} style={{ marginTop: 2 }}>{x.notes}</Tx>}
              </View>
              <View style={{ alignItems: 'flex-end', gap: 4 }}>
                <Amt s={12.5}>{inr(x.amount)}</Amt>
                {x.status === 'payable' && <Badge label="PAYABLE" color={C.gold} align="flex-end" />}
              </View>
            </Row>
          ))}
        </Card>
      )}
      <MoreButton L={L} />
    </>
  );
}

// ── Fact sheet ────────────────────────────────────────────────────────────────────────────────────────────
// "As of" chip: Latest, month-ends back to the account's start, or any date (src/reportDates.js). The server answers
// any date — Nuvama's own fact sheet where one was imported, otherwise computed (computed: true).
function AsOfBody({ init, min, max, hint, onApply, onBack }) {
  const [v, setV] = useState(() => init || isoOf(new Date()));
  const [open, setOpen] = useState(Platform.OS === 'ios');
  return (
    <>
      <SheetTitle title="Fact Sheet as of" sub={hint} />
      <DateRow label="AS OF" value={v} placeholder="Pick a date" min={min} max={max || new Date()} open={open} onToggle={() => setOpen(o => !o)} onPick={setV} />
      <CTA label="APPLY" onPress={() => { if (v) onApply(v); }} style={{ marginTop: 18 }} />
      <CTA outline label="BACK" onPress={onBack} style={{ marginTop: 10 }} />
    </>
  );
}
function AsOfChip({ dates, date, coverage, onPick }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState('list');
  const latest = latestDate(dates, coverage), first = earliestDate(dates, coverage);
  const ends = monthEnds(first, latest);
  const today = new Date();
  const hi = latest && dateOf(latest) < today ? dateOf(latest) : today;
  const hint = asOfHint(first, latest, dt);
  const close = () => { setOpen(false); setMode('list'); };
  const pick = id => {
    if (id === 'other') { setMode('date'); return; }
    close();
    onPick(id === 'latest' ? null : id);
  };
  const value = !date ? 'latest' : ends.includes(date) ? date : 'other';
  const label = date ? `As of ${dt(date)}` : latest ? `As of ${dt(latest)} (latest)` : 'As of latest';
  const options = [
    { id: 'latest', label: 'Latest', note: latest ? dt(latest) : null },
    ...(ends.length ? [{ section: 'Month-end' }, ...ends.map(x => ({ id: x, label: dt(x) }))] : []),
    { id: 'other', label: value === 'other' ? `Other date (${dt(date)})` : 'Pick a date…' },
  ];
  return (
    <>
      <SelectChip label={label} a11y="Fact sheet date" onPress={() => { if (latest) setOpen(true); }} />
      <Sheet visible={open} onClose={close}>
        <View style={{ paddingHorizontal: 20, paddingTop: 8 }}>
          {mode === 'date'
            ? <AsOfBody init={date} min={dateOf(first)} max={hi} hint={hint} onBack={() => setMode('list')}
                onApply={x => { close(); onPick(x === latest ? null : x); }} />
            : <>
                <SheetTitle title="Fact Sheet as of" sub={hint} />
                <OptionList options={options} value={value} onPick={pick} />
              </>}
        </View>
      </Sheet>
    </>
  );
}
// One fact sheet's returns, sectors and holdings (the single-account page, and each account under "All accounts").
function SheetSections({ d }) {
  const [showAll, setShowAll] = useState(false);
  const r = d.returns || {}, periods = r.periods || [];
  const holdings = d.holdings || [], shown = showAll ? holdings : holdings.slice(0, 10);
  // Holdings can lag the fact sheet date (the holdings feed is a day behind the values): say which day they are from.
  const hAsOf = d.holdingsDate && d.asOf && d.holdingsDate < d.asOf ? ` · AS OF ${dt(d.holdingsDate).toUpperCase()}` : '';
  const sectors = d.sectors || [];
  return (
    <>
      {periods.length > 0 && (
        <>
          <SectionLabel>PERFORMANCE (TWRR)</SectionLabel>
          <Card style={{ padding: 14 }}>
            {/* Header and rows share the column widths and gap, and both are centred, so each label sits over its
                figures; "Since <date>" always breaks after "Since" and the short labels centre against it. */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <View style={{ flex: 1.3 }} />
              {periods.map(p => <Tx key={p} w={700} s={10} c={C.muted} center lh={1.35} style={{ flex: 1 }} numberOfLines={2}>{periodLabel(p).replace(/^Since\s+/i, 'Since\n')}</Tx>)}
            </View>
            {[['Portfolio', r.portfolio], ...(r.benchmark ? [[r.benchmark.name, r.benchmark.values]] : [])].map(([name, vals], i) => (
              <View key={name} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderColor: C.hairline }}>
                <Tx w={i === 0 ? 700 : 400} s={11.5} style={{ flex: 1.3 }} numberOfLines={2}>{name}</Tx>
                {(vals || []).map((v, j) => <Amt key={j} s={11.5} c={i === 0 ? gainColor(v) : C.muted} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={{ flex: 1, textAlign: 'center' }}>{pct(v)}</Amt>)}
              </View>
            ))}
            <Tx s={10} c={C.gray} lh={1.45} style={{ marginTop: 12 }}>After management fees and other expenses. Returns over 1 year are annualised.</Tx>
          </Card>
        </>
      )}
      {sectors.length > 0 && (
        <>
          <SectionLabel>SECTOR ALLOCATION{hAsOf}</SectionLabel>
          <Card style={{ padding: 14, gap: 12 }}>
            {sectors.slice().sort((a, b) => (b.pct || 0) - (a.pct || 0)).map((s, k) => (
              <View key={s.sector + ':' + k}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 10 }}>
                  <Tx s={12} style={{ flex: 1 }} numberOfLines={1}>{s.sector}</Tx>
                  <Amt s={12} w={700}>{(s.pct || 0).toFixed(2)}%</Amt>
                </View>
                <View style={{ height: 5, backgroundColor: C.hairline, borderRadius: 3, marginTop: 5, overflow: 'hidden' }}>
                  <View style={{ width: `${Math.max(0, Math.min(100, s.pct || 0))}%`, height: 5, backgroundColor: C.green, borderRadius: 3 }} />
                </View>
              </View>
            ))}
          </Card>
        </>
      )}
      {holdings.length > 0 && (
        <>
          <SectionLabel>PORTFOLIO HOLDINGS · {holdings.length}{hAsOf}</SectionLabel>
          <Card style={{ overflow: 'hidden' }}>
            {shown.map((x, i) => (
              <Row key={i} last={i === shown.length - 1}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Tx w={700} s={12.5} numberOfLines={1}>{x.security}</Tx>
                  <Tx s={11} c={C.muted} numberOfLines={1} style={{ marginTop: 2 }}>{x.sector}</Tx>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Amt s={12.5}>{inr(x.value)}</Amt>
                  <Tx s={10.5} c={C.muted} style={{ marginTop: 2 }}>{(x.pct || 0).toFixed(2)}%</Tx>
                </View>
              </Row>
            ))}
          </Card>
          {holdings.length > 10 && <CTA outline label={showAll ? 'SHOW TOP 10' : `SHOW ALL ${holdings.length}`} onPress={() => setShowAll(a => !a)} style={{ marginTop: 12 }} />}
        </>
      )}
    </>
  );
}
const sheetStrip = d => [
  { label: 'PORTFOLIO VALUE', value: inr(d.portfolioValue), info: FS_INFO.value },
  { label: 'PROFIT / LOSS', value: signed(d.profitLoss), color: gainColor(d.profitLoss), info: FS_INFO.pl },
  { label: 'CONTRIBUTION', value: inr(d.contribution), info: FS_INFO.contribution },
  { label: 'WITHDRAWAL', value: inr(d.withdrawal), info: FS_INFO.withdrawal },
];
function Factsheet({ accountId, ids, names, rk, account }) {
  const [date, setDate] = useState(null);
  const [dates, setDates] = useState([]);
  const all = accountId === ALL_ID;
  const L = useLoad(() => (all
    ? loadFactsheetsAll(ids, id => reports.factsheet(id, { ...(date ? { date } : {}), export: 1 }), { date })
    : reports.factsheet(accountId, date ? { date } : {})), [accountId, date, rk]);
  const d = L.data;
  const [coverage, setCoverage] = useState(null);
  useEffect(() => { if (d && Array.isArray(d.dates)) setDates(d.dates); if (d && d.coverage && (d.coverage.from || d.coverage.to)) setCoverage(d.coverage); }, [d]);
  const has = !!(d && d.asOf);
  const makePdf = has ? (all ? async () => factsheetAllPdf(d) : async () => factsheetPdf(d, accountId)) : null;
  const makeXlsx = has ? async () => factsheetXlsx(d, all ? null : accountId) : null;
  // The download button stays in place (dimmed) while the fact sheet loads or when there is none.
  const controls = (
    <Controls account={account} period={<AsOfChip dates={dates} date={date} coverage={coverage} onPick={setDate} />}
      pdf={<PdfButton make={L.loading || L.err ? null : makePdf} xlsx={L.loading || L.err ? null : makeXlsx} name={has ? `Fact sheet ${all ? 'All accounts' : accountId} ${d.asOf}` : ''} disabled={L.loading || !!L.err || !has} />} />
  );
  if (L.loading) return <>{controls}<View style={{ marginTop: 16 }}><Loading rows={3} h={90} /></View></>;
  if (L.err) return <>{controls}<View style={{ marginTop: 16 }}><ErrorBox msg={L.err} onRetry={L.reload} /></View></>;
  if (!has) {
    const first = date ? `No fact sheet is available for ${dt(date)}.` : `No fact sheet is available for ${all ? 'these accounts' : 'this account'} yet.`;
    const cov = coverage && coverage.from && coverage.to ? ` Fact sheets can be shown for any date from ${dt(coverage.from)} to ${dt(coverage.to)}.` : '';
    return <>{controls}<CombinedNote h={d} /><View style={{ marginTop: 16 }}><Empty>{first + cov}</Empty></View></>;
  }
  if (all) {
    const sheets = (d.sheets || []).filter(x => !/^QFH/i.test(String(x.accountId)));
    return (
      <>
        {controls}
        <StatusLine parts={[asOfPart(d.asOf), 'latest across accounts', `${sheets.length} accounts`]} />
        <CombinedNote h={d} />
        <Strip caption={`ALL ACCOUNTS · ${sheets.length}`} items={sheetStrip(d)}
          footer={<Tx s={10.5} c={C.muted} style={{ paddingHorizontal: 14, paddingVertical: 8, borderTopWidth: 1, borderColor: RULE }}>{FACTSHEET_NOTE}</Tx>} />
        {sheets.map(({ accountId: id, data: x }) => (
          <View key={id}>
            <SectionLabel style={{ marginTop: 22 }}>{String(names[id] || id).toUpperCase()}</SectionLabel>
            {x && x.asOf ? (
              <>
                {!!(x.computed && x.note) && <Tx s={11} c={C.muted} lh={1.5} style={{ marginBottom: 8, marginLeft: 2 }}>{x.note}</Tx>}
                <Strip style={{ marginTop: 0 }} items={sheetStrip(x)}
                  footer={<Tx s={10.5} c={C.muted} style={{ paddingHorizontal: 14, paddingVertical: 8, borderTopWidth: 1, borderColor: RULE }}>As of {dt(x.asOf)} · since inception {dt(x.inceptionDate)}</Tx>} />
                <SheetSections d={x} />
              </>
            ) : <Empty>No fact sheet for this date.</Empty>}
          </View>
        ))}
      </>
    );
  }
  return (
    <>
      {controls}
      <StatusLine parts={[asOfPart(d.asOf), d.computed ? null : 'Nuvama fact sheet', `since inception ${dt(d.inceptionDate)}`]}
        computed={!!d.computed} note={d.computed ? d.note : ''} />
      <Strip caption={d.strategy ? d.strategy.replace(/^QODE ADVISORS LLP - /, '') : ''} items={sheetStrip(d)} />
      <SheetSections d={d} />
    </>
  );
}

// ── P&L and balance sheet ─────────────────────────────────────────────────────────────────────────────────
// Nuvama's "Profit and loss account - Balance sheet": the P&L for the period, the unrealised gain block (not part of
// the surplus), then the balance sheet at cost as of the period's end, liabilities above assets. /reports/pnl; for
// "All accounts" every code goes in one call and the server sums them.
// kind: 'head' (section heading), 'line', 'sub' (indented), 'total' (ruled), 'grand' (heavier rule, green).
function PRow({ label, amount, mid, kind = 'line', note, color }) {
  const head = kind === 'head', total = kind === 'total' || kind === 'grand';
  if (head) return <Tx w={700} s={9.5} ls={0.1} c={C.muted} style={{ paddingHorizontal: 14, paddingTop: 12, paddingBottom: 2 }}>{label.toUpperCase()}</Tx>;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8, paddingVertical: 8, paddingHorizontal: 14, borderTopWidth: total ? (kind === 'grand' ? 1.5 : 1) : 0,
      borderColor: kind === 'grand' ? C.green : RULE, marginTop: total ? 2 : 0 }}>
      <View style={{ flex: 1, minWidth: 0, paddingLeft: kind === 'sub' ? 10 : 0 }}>
        <Tx w={total ? 700 : 400} s={12} c={kind === 'grand' ? C.green : C.ink}>{label}</Tx>
        {!!note && <Tx s={10.5} c={C.gray} lh={1.4} style={{ marginTop: 2 }}>{note}</Tx>}
      </View>
      {mid != null && <Amt s={11.5} w={400} c={C.muted}>{inr(mid)}</Amt>}
      {amount != null && <Amt s={12} w={total ? 700 : 600} c={color || (kind === 'grand' ? C.green : C.ink)} style={{ minWidth: 96, textAlign: 'right' }}>{inr(amount)}</Amt>}
    </View>
  );
}
const PCard = ({ rows, total }) => (
  <Card style={{ overflow: 'hidden', paddingVertical: 4 }}>
    {rows.map((r, i) => <PRow key={i} {...r} />)}
    {total ? <PRow kind="grand" {...total} /> : null}
  </Card>
);
function PnlBalanceSheet({ accountId, ids, rk, account }) {
  const [period, setPeriod] = useState(() => ({ key: 'fy', ...PRESETS.fy[1](new Date()) }));
  const all = accountId === ALL_ID;
  // "All" asks from the earliest possible date; the server starts it at the first date on record.
  const q = period.key === 'all' ? { from: '2000-01-01' } : rangeQuery(period);
  const L = useLoad(() => reports.pnl(all ? ids : accountId, q), [accountId, q.from, q.to, rk]);
  // QFH accounts count in the totals but are never named (the server sums every account of the owner).
  const d = L.data && L.data.accounts ? { ...L.data, accounts: L.data.accounts.filter(c => !/^QFH/i.test(String(c))) } : L.data;
  const has = !!(d && d.asOf);
  const pdf = <PdfButton make={has ? async () => plbsPdf(d, all ? null : accountId) : null} xlsx={has ? async () => plbsXlsx(d, all ? null : accountId) : null} name={has ? `PnL and balance sheet ${all ? 'All accounts' : accountId} ${d.from} to ${d.to}` : ''} disabled={!has} />;
  const controls = <Controls account={account} period={<PeriodChip value={period} onChange={setPeriod} sub="The P&L covers the period; the balance sheet is as of its last day." since={d && d.coverage && d.coverage.from} />} pdf={pdf} />;
  if (L.loading) return <>{controls}<View style={{ marginTop: 16 }}><Loading rows={4} h={90} /></View></>;
  if (L.err) return <>{controls}<View style={{ marginTop: 16 }}><ErrorBox msg={L.err} onRetry={L.reload} /></View></>;
  if (!has) {
    const c = d && d.coverage;
    return <>{controls}<View style={{ marginTop: 16 }}><Empty>{c && c.from && c.to
      ? `No statement for this period. Statements can be prepared for any dates from ${dt(c.from)} to ${dt(c.to)}.`
      : `No statement is available for ${all ? 'these accounts' : 'this account'} yet.`}</Empty></View></>;
  }
  const u = d.unrealised, B = d.balanceSheet, r = d.reconciliation || {};
  const Lb = B.liabilities, A = B.assets;
  const diffText = v => (v == null ? '–' : Math.abs(v) <= 1 ? `${inr(v)} · within ₹1` : inr(v));
  return (
    <>
      {controls}
      <StatusLine parts={[asOfPart(d.to), rangeText(d.from, d.to), recordsPart(d.coverage), all ? `${(d.accounts || ids).length} accounts summed` : null, d.computed ? null : 'Nuvama report']}
        computed={!!d.computed} note={d.computed ? d.note : ''} />
      <Strip items={[
        { label: 'SURPLUS', value: signed(d.pnl.surplus), color: gainColor(d.pnl.surplus), info: PLBS_INFO.surplus },
        { label: 'UNREALISED, NET', value: signed(u.net), color: gainColor(u.net), info: PLBS_INFO.unrealised },
        { label: 'TOTAL INCOME', value: signed(d.pnl.incomeTotal), color: gainColor(d.pnl.incomeTotal), info: PLBS_INFO.income },
        { label: 'TOTAL EXPENSES', value: inr(d.pnl.expenseTotal), info: PLBS_INFO.expenses },
      ]} />
      {!!(d.omitted && d.omitted.length) && <Tx s={11.5} c={C.red} lh={1.5} style={{ marginTop: 6, marginLeft: 2 }}>Not included (not available to this login): {d.omitted.join(', ')}.</Tx>}
      <SectionLabel>PROFIT AND LOSS ACCOUNT</SectionLabel>
      <PCard rows={[
        { kind: 'head', label: 'Income' },
        ...d.pnl.income.map(x => ({ label: x.label, amount: x.amount, note: x.note })),
        { kind: 'total', label: 'Total income', amount: d.pnl.incomeTotal },
        { kind: 'head', label: 'Expenses' },
        ...d.pnl.expenses.map(x => ({ label: x.label, amount: x.amount })),
        { kind: 'total', label: 'Total expenses', amount: d.pnl.expenseTotal },
      ]} total={{ label: 'Surplus for the period', amount: d.pnl.surplus, color: gainColor(d.pnl.surplus) }} />
      <SectionLabel>UNREALISED GAIN / LOSS · NOT IN THE SURPLUS</SectionLabel>
      <PCard rows={[
        { label: 'At the end of the period', mid: u.investments.end },
        { label: 'At the beginning of the period', mid: u.investments.begin },
        { kind: 'total', label: 'Net during the period', amount: u.investments.net, color: gainColor(u.investments.net) },
        ...(u.options ? [
          { kind: 'head', label: 'Options' },
          { label: 'At the end of the period', mid: u.options.end },
          { label: 'At the beginning of the period', mid: u.options.begin },
          { kind: 'total', label: 'Net during the period', amount: u.options.net, color: gainColor(u.options.net) },
        ] : []),
      ]} total={{ label: 'Net unrealised gain / loss', amount: u.net, color: gainColor(u.net) }} />
      <SectionLabel>BALANCE SHEET · AS OF {dt(d.to).toUpperCase()} · AT COST</SectionLabel>
      <PCard rows={[
        { kind: 'head', label: 'Liabilities' },
        { label: 'Capital contribution', amount: Lb.capital },
        { label: 'Less: withdrawals', amount: Lb.withdrawals },
        { label: 'Reserves and surplus, beginning', mid: Lb.reserves.begin },
        { label: 'Reserves and surplus, for the period', mid: Lb.reserves.period },
        { label: 'Reserves and surplus, ending', amount: Lb.reserves.end },
        ...Lb.current.map(x => ({ kind: 'sub', label: x.label, mid: x.amount })),
        { label: 'Current liabilities and provisions', amount: Lb.currentTotal },
        ...(Lb.difference ? [{ label: 'Other / reconciliation', amount: Lb.difference, note: 'Gap between the value on record and the computed surplus' }] : []),
      ]} total={{ label: 'Total liabilities', amount: Lb.total }} />
      <View style={{ height: 12 }} />
      <PCard rows={[
        { kind: 'head', label: 'Assets' },
        { label: 'Investments at cost', amount: A.investmentsAtCost },
        ...(A.optionsPosition != null ? [{ label: 'Net options purchase position', amount: A.optionsPosition }] : []),
        ...(A.futuresMargin != null ? [{ label: 'Futures margin account', amount: A.futuresMargin }] : []),
        ...(A.optionsMargin != null ? [{ label: 'Options margin account', amount: A.optionsMargin }] : []),
        ...A.current.map(x => ({ kind: 'sub', label: x.label, mid: x.amount, note: x.note })),
        { label: 'Current assets', amount: A.currentTotal },
      ]} total={{ label: 'Total assets', amount: A.total }} />
      {(r.portfolioValue != null || r.expected != null) && (
        <>
          <SectionLabel>RECONCILIATION</SectionLabel>
          <Card style={{ overflow: 'hidden', paddingVertical: 4 }}>
            {r.portfolioValue != null && <>
              <PRow label={`Portfolio value on ${dt(d.to)}`} amount={r.portfolioValue} />
              <PRow label="Assets at cost + unrealised − liabilities" amount={r.valueFromStatement} />
              <PRow label="Difference" note={diffText(r.valueDiff)} />
            </>}
            {r.expected != null && <>
              <PRow label="Surplus implied by the value" amount={r.expected} />
              <PRow label="Surplus in the P&L" amount={r.computed} />
              <PRow label="Difference" note={diffText(r.diff)} />
            </>}
            {!!r.note && <Tx s={10.5} c={C.gray} lh={1.45} style={{ paddingHorizontal: 14, paddingVertical: 8, borderTopWidth: 1, borderColor: RULE }}>{r.note}</Tx>}
          </Card>
        </>
      )}
    </>
  );
}

// ── page ──────────────────────────────────────────────────────────────────────────────────────────────────
const KINDS = [['fs', 'Fact Sheet'], ['pl', 'P&L and Balance Sheet'], ['cg', 'Capital Gains'], ['txn', 'Transactions'], ['exp', 'Expenses']];
export function ReportsPage({ V }) {
  const opts = reportAccountOptions(V);
  const singles = singleAccounts(opts);
  // "All accounts" also covers accounts that are never listed (QFH), so totals match Nuvama's statements.
  const ids = [...singles.map(o => o.id), ...((V && V.reportHidden) || []).filter(id => !singles.some(o => String(o.id) === id))];
  const names = Object.fromEntries(singles.map(o => [o.id, o.label]));
  const [sel, setSel] = useState(null);
  const [kind, setKind] = useState('fs');
  const [closedPick, setClosedPick] = useState(null);   // a closed account just picked: the pop-up
  const pick = id => {
    setSel(id);
    const o = opts.find(x => x.id === id);
    setClosedPick(o && o.closed ? { id: o.id, name: o.name, closedOn: o.closedOn ? fmtDate(o.closedOn) : '' } : null);
  };
  // "All accounts" is offered first, but the default stays the first single account.
  const accountId = sel && opts.some(o => o.id === sel) ? sel : singles[0] && singles[0].id;
  const Body = { txn: Transactions, cg: CapitalGains, exp: Expenses, fs: Factsheet, pl: PnlBalanceSheet }[kind];
  const account = <AccountChip options={opts} value={accountId} onPick={pick} count={singles.length} />;
  return (
    <>
      {/* report tabs: one scrollable row */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, marginHorizontal: -20 }} contentContainerStyle={{ gap: 18, paddingHorizontal: 20 }}>
        {KINDS.map(([k, l]) => {
          const on = kind === k;
          return (
            <Pressable key={k} onPress={() => { setKind(k); track('event', 'report_view', { tab: k }); }} accessibilityRole="tab" accessibilityState={{ selected: on }} hitSlop={6} style={{ paddingVertical: 8 }}>
              <Tx w={700} s={13} c={on ? C.green : C.gray}>{l}</Tx>
              <View style={{ height: 2, borderRadius: 1, marginTop: 6, backgroundColor: on ? C.gold : 'transparent' }} />
            </Pressable>
          );
        })}
      </ScrollView>
      <View style={{ height: 1, backgroundColor: C.hairline, marginTop: -1 }} />
      {/* keyed so filters and paging reset when the account or report changes */}
      {accountId ? <Body key={kind + accountId + (accountId === ALL_ID ? ids.join(',') : '')} accountId={accountId} ids={ids} names={names} rk={V.rk} account={account} /> : <View style={{ marginTop: 16 }}><Empty>No active account found.</Empty></View>}
      <ClosedAccountPopup p={closedPick} onClose={() => setClosedPick(null)} />
    </>
  );
}
