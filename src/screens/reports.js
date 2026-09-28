// Reports page (Home → Reports, More → Reports): the custodian's statements for one strategy account —
// Transactions (pms_transactions, synced daily), Capital gains, Expenses and the Portfolio fact sheet (Nuvama
// exports loaded on the server by myQode/scripts/import-nuvama-reports.mjs; each shows its "as of" date).
// Data: /api/mobile/reports/* (src/api → reports). Every report can be saved or shared as a PDF (savePdf).
import React, { useState, useEffect, useRef } from 'react';
import { View, Pressable, Alert, Platform } from 'react-native';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { C, Tx, Amt, Card, CTA, ChipRow, Sheet, Field } from '../ui';
import { reports } from '../api';
import { useLoad, ErrorBox, Empty, SectionLabel, AccountChips, Loading } from './kit';
import { inr, sinr, pct, fmtDate } from '../adapt';
import { savePdf } from './partner';
import { transactionsPdf, capitalGainsPdf, expensesPdf, factsheetPdf } from './reportPdf';

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
      e => { if (g === gen.current) set(s => ({ ...s, loading: false, err: (e && e.message) || 'Something went wrong.' })); });
  }, [...deps, tick]);
  const loadMore = () => {
    if (st.busy || !st.more) return;
    const g = gen.current;
    set(s => ({ ...s, busy: true }));
    fetchPage(st.items.length).then(
      d => { if (g === gen.current) set(s => ({ ...s, items: s.items.concat(d.items || []), more: !!d.hasMore, busy: false })); },
      e => { if (g !== gen.current) return; set(s => ({ ...s, busy: false })); Alert.alert('Couldn’t load more', (e && e.message) || 'Please try again.'); });
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

// Custom period sheet: From / To, either may be left open; from must not be after to.
function RangeSheet({ visible, init, onApply, onClose }) {
  const [v, setV] = useState({ from: '', to: '' });
  const [edit, setEdit] = useState('');
  const [err, setErr] = useState('');
  useEffect(() => {
    if (!visible) return;
    const t = new Date();
    setV(init && (init.from || init.to) ? { from: init.from || '', to: init.to || '' } : PRESETS.fy[1](t));
    setEdit(''); setErr('');
  }, [visible]);
  const today = new Date();
  const put = (k, val) => { setV(s => ({ ...s, [k]: val })); setErr(''); };
  const apply = () => {
    if (v.from && v.to && v.from > v.to) return setErr('The From date must be on or before the To date.');
    if (!v.from && !v.to) return setErr('Pick at least one date, or choose All.');
    onApply({ from: v.from || undefined, to: v.to || undefined });
  };
  return (
    <Sheet visible={visible} onClose={onClose}>
      <View style={{ paddingHorizontal: 20, paddingTop: 8 }}>
        <Tx f="play" w={600} s={20}>Custom period</Tx>
        <Tx s={12} c={C.muted} lh={1.5} style={{ marginTop: 4 }}>Leave a date empty to include everything before or after the other one.</Tx>
        <DateRow label="FROM" value={v.from} placeholder="Earliest record" max={dateOf(v.to) || today} open={edit === 'from'}
          onToggle={() => setEdit(e => (e === 'from' ? '' : 'from'))} onPick={d => put('from', d)} onClear={() => put('from', '')} />
        <DateRow label="TO" value={v.to} placeholder="Latest record" min={dateOf(v.from)} max={today} open={edit === 'to'}
          onToggle={() => setEdit(e => (e === 'to' ? '' : 'to'))} onPick={d => put('to', d)} onClear={() => put('to', '')} />
        {!!err && <Tx s={12} c={C.red} style={{ marginTop: 12 }}>{err}</Tx>}
        <CTA label="APPLY" onPress={apply} style={{ marginTop: 18 }} />
      </View>
    </Sheet>
  );
}

// Preset chips + the custom sheet. value: { key, from, to } or null (no range, e.g. capital gains by FY).
function PeriodFilter({ value, onChange, keys = ALL_PRESETS, style }) {
  const [open, setOpen] = useState(false);
  const pick = k => {
    if (k === 'custom') return setOpen(true);
    onChange({ key: k, ...PRESETS[k][1](new Date()) });
  };
  return (
    <>
      <ChipRow chips={keys.map(k => ({ label: PRESETS[k][0], active: !!value && value.key === k, pick: () => pick(k) }))} style={style} />
      <RangeSheet visible={open} init={value} onClose={() => setOpen(false)} onApply={r => { setOpen(false); onChange({ key: 'custom', ...r }); }} />
    </>
  );
}

// Active period + what the data on record covers.
function PeriodNote({ period, all = 'All records', cover, coverLabel = 'Records on file' }) {
  const text = period ? rangeText(period.from, period.to) || all : '';
  const cov = cover && (cover.from || cover.to) ? rangeText(cover.from, cover.to) : '';
  if (!text && !cov) return null;
  return (
    <View style={{ marginTop: 10, marginLeft: 2 }}>
      {!!text && <Tx w={700} s={11.5} c={C.green}>{text}</Tx>}
      {!!cov && <Tx s={11} c={C.gray} style={{ marginTop: 2 }}>{coverLabel}: {cov}</Tx>}
    </View>
  );
}

// ── PDF ───────────────────────────────────────────────────────────────────────────────────────────────────
function PdfButton({ make, name }) {
  const [busy, setBusy] = useState(false);
  const go = async () => {
    if (busy) return;
    setBusy(true);
    try { const out = await make(); const doc = typeof out === 'string' ? { html: out, landscape: false } : out; await savePdf(doc.html, name, { share: true, landscape: doc.landscape }); }
    catch (e) { Alert.alert('Couldn’t create the PDF', (e && e.message) || 'Please try again.'); }
    finally { setBusy(false); }
  };
  return <CTA outline label={busy ? 'PREPARING PDF…' : 'DOWNLOAD PDF'} onPress={go} style={{ marginTop: 18 }} />;
}

// ── shared bits ───────────────────────────────────────────────────────────────────────────────────────────
const AsOf = ({ d, note }) => <Tx s={11} c={C.gray} style={{ marginTop: 10, marginLeft: 2 }}>As of {dt(d)}{note ? ' · ' + note : ''}</Tx>;
function Stat({ label, value, color, small }) {
  return (
    <View style={{ flex: 1, minWidth: '45%' }}>
      <Tx w={700} s={10.5} ls={0.12} c={C.muted}>{label}</Tx>
      <Amt s={small ? 14 : 17} c={color || C.ink} style={{ marginTop: 4 }}>{value}</Amt>
    </View>
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
const Badge = ({ label, color = C.muted }) => (
  <View style={{ borderWidth: 1, borderColor: color, borderRadius: 999, paddingVertical: 1, paddingHorizontal: 6, alignSelf: 'flex-start' }}>
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
function Status({ L, empty }) {
  if (L.loading) return <Loading rows={4} h={56} />;
  if (L.err) return <ErrorBox msg={L.err} onRetry={L.reload} />;
  if (empty) return <Empty>{empty}</Empty>;
  return null;
}

// ── Transactions ──────────────────────────────────────────────────────────────────────────────────────────
const TXN_GROUPS = [['all', 'All'], ['trades', 'Trades'], ['money', 'Money in/out'], ['income', 'Income'], ['charges', 'Charges'], ['other', 'Other']];
function TxnRow({ t, last }) {
  const sign = t.direction === 'in' ? '+' : t.direction === 'out' ? '−' : '';
  const detail = [t.security ? t.type : null, t.qty != null && t.rate != null ? `${qtyFmt(t.qty)} @ ${inr2(t.rate)}` : null, t.notes && !t.security ? t.notes : null].filter(Boolean).join(' · ');
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
function Transactions({ accountId, rk }) {
  const [group, setGroup] = useState('all');
  const [period, setPeriod] = useState(ALL_TIME);
  const L = usePaged(offset => reports.transactions(accountId, { group, ...rangeQuery(period), limit: 50, offset }), [accountId, group, period.from, period.to, rk]);
  const h = L.head;
  const ranged = !!(period.from || period.to);
  const makePdf = async () => {
    const d = await reports.transactions(accountId, { group, ...rangeQuery(period), export: 1, limit: 5000 });
    return transactionsPdf(withRange(d, period), accountId, (TXN_GROUPS.find(g => g[0] === group) || [])[1]);
  };
  const empty = h && !h.asOf ? 'No transactions are on record for this account yet.'
    : ranged ? (group === 'all' ? 'No transactions in this period.' : 'No transactions in this category for this period.')
      : 'No transactions in this category.';

  return (
    <>
      <PeriodFilter value={period} onChange={setPeriod} style={{ marginTop: 16 }} />
      <PeriodNote period={period} cover={h && h.coverage} />
      {h && h.asOf && (
        <Card style={{ padding: 16, marginTop: 14 }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', rowGap: 14 }}>
            <Stat label="MONEY IN" value={signed(h.moneyIn)} color={gainColor(h.moneyIn)} />
            <Stat label="MONEY OUT" value={h.moneyOut ? '−' + inr(h.moneyOut) : inr(0)} />
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', rowGap: 12, marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderColor: C.hairline }}>
            {h.summary.filter(s => s.group !== 'money').map(s => <Stat key={s.group} small label={s.label.toUpperCase() + ` · ${s.count}`} value={inr(s.amount)} />)}
          </View>
        </Card>
      )}
      {h && h.asOf && <AsOf d={h.asOf} note="latest transaction on record" />}
      <ChipRow chips={TXN_GROUPS.map(([k, l]) => ({ label: l, active: group === k, pick: () => setGroup(k) }))} style={{ marginTop: 16 }} />
      <Status L={L} empty={!L.loading && !L.err && !L.items.length ? empty : null} />
      {!L.loading && !L.err && byMonth(L.items, t => t.date).map(m => (
        <View key={m.key}>
          <SectionLabel style={{ marginTop: 18 }}>{m.key ? monthLabel(m.key + '-01').toUpperCase() : ''}</SectionLabel>
          <Card style={{ overflow: 'hidden' }}>{m.items.map((t, i) => <TxnRow key={t.id} t={t} last={i === m.items.length - 1} />)}</Card>
        </View>
      ))}
      <MoreButton L={L} />
      {!!L.items.length && <PdfButton make={makePdf} name={`Transactions ${accountId}${rangeFile(period)}`} />}
    </>
  );
}

// ── Capital gains ─────────────────────────────────────────────────────────────────────────────────────────
function CapitalGains({ accountId, rk }) {
  const [fy, setFy] = useState(null);
  const [term, setTerm] = useState('');
  // A date range (sale date) overrides the financial year; null = by FY.
  const [range, setRange] = useState(null);
  // "All" here is everything up to today (the API needs a from or a to to leave FY mode).
  const pickRange = p => setRange(p.key === 'all' ? { key: 'all', from: undefined, to: isoOf(new Date()) } : p);
  const q = range ? rangeQuery(range) : { fy: fy || undefined };
  const L = usePaged(offset => reports.capitalGains(accountId, { ...q, term: term || undefined, limit: 50, offset }), [accountId, fy, range && range.from, range && range.to, term, rk]);
  const h = L.head, s = h && h.summary;
  const makePdf = async () => {
    const d = await reports.capitalGains(accountId, { ...(range ? rangeQuery(range) : { fy: h.fy }), term: term || undefined, export: 1, limit: 5000 });
    return capitalGainsPdf(range ? withRange(d, range) : d, accountId);
  };
  const years = (h && h.years) || [];

  return (
    <>
      {years.length > 0 && (
        <ChipRow chips={years.map(y => ({ label: 'FY ' + y.fy, active: !range && h.fy === y.fy, pick: () => { setRange(null); setFy(y.fy); } }))} style={{ marginTop: 16 }} />
      )}
      {(years.length > 0 || range) && (
        <PeriodFilter value={range} onChange={pickRange} keys={['3m', '12m', 'all', 'custom']} style={{ marginTop: 10 }} />
      )}
      {range && <PeriodNote period={range} cover={h && h.coverage} coverLabel="Sales on file" />}
      {s && (
        <Card style={{ padding: 16, marginTop: 14 }}>
          <Tx w={700} s={11} ls={0.1} c={C.muted}>{range || !h.fy ? 'SELECTED PERIOD' : `FINANCIAL YEAR ${h.fy}`}</Tx>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', rowGap: 14, marginTop: 12 }}>
            <Stat label="SHORT TERM" value={signed(s.st)} color={gainColor(s.st)} />
            <Stat label="LONG TERM" value={signed(s.lt)} color={gainColor(s.lt)} />
            <Stat label="TOTAL REALISED" value={signed(s.total)} color={gainColor(s.total)} />
            {s.ltTaxable != null && Math.round(s.ltTaxable) !== Math.round(s.lt) && <Stat label="LT AFTER GRANDFATHERING" value={signed(s.ltTaxable)} color={gainColor(s.ltTaxable)} />}
          </View>
          {s.byCategory.length > 1 && (
            <View style={{ marginTop: 14, paddingTop: 10, borderTopWidth: 1, borderColor: C.hairline, gap: 8 }}>
              {s.byCategory.map(c => (
                <View key={c.category} style={{ flexDirection: 'row', gap: 10 }}>
                  <Tx s={11} c={C.muted} style={{ flex: 1 }} numberOfLines={2}>{c.category}</Tx>
                  <Amt s={11.5} c={gainColor((c.st || 0) + (c.lt || 0))}>{signed((c.st || 0) + (c.lt || 0))}</Amt>
                </View>
              ))}
            </View>
          )}
        </Card>
      )}
      {h && h.asOf && <AsOf d={h.asOf} note="realised gains by date of sale" />}
      {years.length > 0 && (
        <ChipRow chips={[['', 'All lots'], ['ST', 'Short term'], ['LT', 'Long term']].map(([k, l]) => ({ label: l, active: term === k, pick: () => setTerm(k) }))} style={{ marginTop: 16 }} />
      )}
      <Status L={L} empty={!L.loading && !L.err && !L.items.length ? (h && !h.asOf ? 'No capital gains report is available for this account yet.' : range ? 'No realised gains in this period.' : 'No realised gains in this selection.') : null} />
      {!L.loading && !L.err && !!L.items.length && (
        <Card style={{ overflow: 'hidden', marginTop: 14 }}>
          {L.items.map((l, i) => (
            <Row key={i} last={i === L.items.length - 1}>
              <DateBox d={l.saleDate} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Tx w={700} s={12.5} numberOfLines={1}>{l.security}</Tx>
                <Tx s={11} c={C.muted} numberOfLines={1} style={{ marginTop: 2 }}>{[l.qty != null && 'Qty ' + qtyFmt(l.qty), 'bought ' + dt(l.purchaseDate), l.daysHeld != null && l.daysHeld + (l.daysHeld === 1 ? ' day' : ' days')].filter(Boolean).join(' · ')}</Tx>
                <Tx s={11} c={C.muted} numberOfLines={1} style={{ marginTop: 1 }}>Sold {inr(l.saleAmount)} · cost {inr(l.cost)}</Tx>
              </View>
              <View style={{ alignItems: 'flex-end', gap: 4 }}>
                <Amt s={12.5} c={gainColor(l.gain)}>{signed(l.gain)}</Amt>
                <Badge label={l.term} />
              </View>
            </Row>
          ))}
        </Card>
      )}
      <MoreButton L={L} />
      {!!(h && h.summary) && <PdfButton make={makePdf} name={range ? `Capital gains ${accountId}${rangeFile(range)}` : `Capital gains FY ${h.fy} ${accountId}`} />}
    </>
  );
}

// ── Expenses ──────────────────────────────────────────────────────────────────────────────────────────────
function Expenses({ accountId, rk }) {
  const [type, setType] = useState('');
  const [period, setPeriodRaw] = useState(ALL_TIME);
  // A charge picked in one period may not exist in the next, so a new period shows every charge again.
  const setPeriod = p => { setPeriodRaw(p); setType(''); };
  const L = usePaged(offset => reports.expenses(accountId, { type: type || undefined, ...rangeQuery(period), limit: 50, offset }), [accountId, type, period.from, period.to, rk]);
  const h = L.head;
  const ranged = !!(period.from || period.to);
  const makePdf = async () => expensesPdf(withRange(await reports.expenses(accountId, { type: type || undefined, ...rangeQuery(period), export: 1, limit: 5000 }), period), accountId);

  return (
    <>
      <PeriodFilter value={period} onChange={setPeriod} style={{ marginTop: 16 }} />
      <PeriodNote period={period} cover={h && h.period} coverLabel="Statement covers" />
      {h && h.asOf && (
        <Card style={{ padding: 16, marginTop: 14 }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', rowGap: 14 }}>
            <Stat label="PAID" value={inr(h.paid)} />
            <Stat label="PAYABLE (ACCRUED)" value={inr(h.payable)} />
          </View>
        </Card>
      )}
      {h && h.asOf && <AsOf d={h.asOf} />}
      {h && h.byType.length > 0 && (
        <>
          <SectionLabel>BY CHARGE {type ? '· TAP AGAIN TO SHOW ALL' : '· TAP TO FILTER'}</SectionLabel>
          <Card style={{ overflow: 'hidden' }}>
            {h.byType.map((t, i) => (
              <Row key={t.type} last={i === h.byType.length - 1} onPress={() => setType(type === t.type ? '' : t.type)}>
                <View style={{ width: 4, alignSelf: 'stretch', borderRadius: 2, backgroundColor: type === t.type ? C.gold : 'transparent' }} />
                <Tx w={type === t.type ? 700 : 400} s={12.5} style={{ flex: 1 }} numberOfLines={1}>{t.type}</Tx>
                <Tx s={10.5} c={C.muted}>{t.count}</Tx>
                <Amt s={12.5}>{inr(t.amount)}</Amt>
              </Row>
            ))}
          </Card>
        </>
      )}
      <Status L={L} empty={!L.loading && !L.err && !L.items.length ? (h && h.asOf && ranged ? 'No expense entries in this period.' : h && h.asOf && type ? 'No entries for this charge.' : 'No expense statement is available for this account yet.') : null} />
      {!L.loading && !L.err && !!L.items.length && (
        <>
          <SectionLabel>{type ? type.toUpperCase() : 'ALL ENTRIES'}</SectionLabel>
          <Card style={{ overflow: 'hidden' }}>
            {L.items.map((x, i) => (
              <Row key={i} last={i === L.items.length - 1}>
                <DateBox d={x.date} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Tx w={700} s={12.5} numberOfLines={1}>{x.type}</Tx>
                  {!!x.notes && <Tx s={11} c={C.muted} numberOfLines={2} style={{ marginTop: 2 }}>{x.notes}</Tx>}
                </View>
                <View style={{ alignItems: 'flex-end', gap: 4 }}>
                  <Amt s={12.5}>{inr(x.amount)}</Amt>
                  {x.status === 'payable' && <Badge label="PAYABLE" color={C.gold} />}
                </View>
              </Row>
            ))}
          </Card>
        </>
      )}
      <MoreButton L={L} />
      {!!L.items.length && <PdfButton make={makePdf} name={`Expenses ${accountId}${rangeFile(period)}`} />}
    </>
  );
}

// ── Fact sheet ────────────────────────────────────────────────────────────────────────────────────────────
// "As of" chooser: the newest snapshots as chips plus any other date (the API returns the latest snapshot on or
// before it). dates come from the last response, newest first.
function AsOfSheet({ visible, init, min, onApply, onClose }) {
  const [v, setV] = useState('');
  const [open, setOpen] = useState(false);
  useEffect(() => { if (visible) { setV(init || isoOf(new Date())); setOpen(Platform.OS === 'ios'); } }, [visible]);
  return (
    <Sheet visible={visible} onClose={onClose}>
      <View style={{ paddingHorizontal: 20, paddingTop: 8 }}>
        <Tx f="play" w={600} s={20}>Fact sheet as of</Tx>
        <Tx s={12} c={C.muted} lh={1.5} style={{ marginTop: 4 }}>Shows the latest fact sheet on or before this date.</Tx>
        <DateRow label="AS OF" value={v} placeholder="Pick a date" min={min} max={new Date()} open={open} onToggle={() => setOpen(o => !o)} onPick={setV} />
        <CTA label="APPLY" onPress={() => { if (v) onApply(v); }} style={{ marginTop: 18 }} />
      </View>
    </Sheet>
  );
}
function AsOfChooser({ dates, date, onPick }) {
  const [open, setOpen] = useState(false);
  if (!dates.length) return null;
  const top = dates.slice(0, 5);
  const current = date || dates[0];
  const other = !top.includes(current);
  return (
    <>
      <SectionLabel style={{ marginTop: 18 }}>AS OF</SectionLabel>
      <ChipRow chips={[
        ...top.map((x, i) => ({ label: i === 0 ? `Latest · ${dt(x)}` : dt(x), active: current === x, pick: () => onPick(i === 0 ? null : x) })),
        { label: other ? dt(current) : 'Other date', active: other, pick: () => setOpen(true) },
      ]} />
      <AsOfSheet visible={open} init={date} min={dateOf(dates[dates.length - 1])} onClose={() => setOpen(false)} onApply={x => { setOpen(false); onPick(x >= dates[0] ? null : x); }} />
    </>
  );
}
function Factsheet({ accountId, rk }) {
  const [date, setDate] = useState(null);
  const [dates, setDates] = useState([]);
  const L = useLoad(() => reports.factsheet(accountId, date ? { date } : {}), [accountId, date, rk]);
  const [all, setAll] = useState(false);
  const d = L.data;
  useEffect(() => { if (d && Array.isArray(d.dates)) setDates(d.dates); }, [d]);
  const chooser = <AsOfChooser dates={dates} date={date} onPick={setDate} />;
  if (L.loading) return <>{chooser}<View style={{ marginTop: 16 }}><Loading rows={3} h={90} /></View></>;
  if (L.err) return <>{chooser}<View style={{ marginTop: 16 }}><ErrorBox msg={L.err} onRetry={L.reload} /></View></>;
  if (!d || !d.asOf) {
    const oldest = dates.length ? dates[dates.length - 1] : null;
    return <>{chooser}<View style={{ marginTop: 16 }}><Empty>{date && oldest ? `No fact sheet on or before ${dt(date)}. The earliest is ${dt(oldest)}.` : 'No fact sheet is available for this account yet.'}</Empty></View></>;
  }
  const r = d.returns || {}, periods = r.periods || [];
  const holdings = d.holdings || [], shown = all ? holdings : holdings.slice(0, 10);
  const makePdf = async () => factsheetPdf(d, accountId);
  return (
    <>
      {chooser}
      <Card style={{ padding: 16, marginTop: 16 }}>
        {!!d.strategy && <Tx w={700} s={11} ls={0.06} c={C.muted} numberOfLines={2}>{d.strategy.replace(/^QODE ADVISORS LLP - /, '')}</Tx>}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', rowGap: 14, marginTop: 12 }}>
          <Stat label="PORTFOLIO VALUE" value={inr(d.portfolioValue)} />
          <Stat label="PROFIT / LOSS" value={signed(d.profitLoss)} color={gainColor(d.profitLoss)} />
          <Stat small label="CONTRIBUTION" value={inr(d.contribution)} />
          <Stat small label="WITHDRAWAL" value={inr(d.withdrawal)} />
        </View>
        <Tx s={11} c={C.muted} style={{ marginTop: 10 }}>Since inception {dt(d.inceptionDate)}</Tx>
      </Card>
      <AsOf d={d.asOf} note={date && date !== d.asOf ? `latest on or before ${dt(date)}` : ''} />
      {periods.length > 0 && (
        <>
          <SectionLabel>PERFORMANCE (TWRR)</SectionLabel>
          <Card style={{ padding: 14 }}>
            <View style={{ flexDirection: 'row' }}>
              <View style={{ flex: 1.6 }} />
              {periods.map(p => <Tx key={p} w={700} s={10} c={C.muted} right style={{ flex: 1 }} numberOfLines={2}>{periodLabel(p)}</Tx>)}
            </View>
            {[['Portfolio', r.portfolio], ...(r.benchmark ? [[r.benchmark.name, r.benchmark.values]] : [])].map(([name, vals], i) => (
              <View key={name} style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderColor: C.hairline }}>
                <Tx w={i === 0 ? 700 : 400} s={11.5} style={{ flex: 1.6 }} numberOfLines={2}>{name}</Tx>
                {(vals || []).map((v, j) => <Amt key={j} s={11.5} c={i === 0 ? gainColor(v) : C.muted} style={{ flex: 1, textAlign: 'right' }}>{pct(v)}</Amt>)}
              </View>
            ))}
            <Tx s={10} c={C.gray} lh={1.45} style={{ marginTop: 12 }}>After management fees and other expenses. Returns over 1 year are annualised.</Tx>
          </Card>
        </>
      )}
      {d.sectors.length > 0 && (
        <>
          <SectionLabel>SECTOR ALLOCATION</SectionLabel>
          <Card style={{ padding: 14, gap: 12 }}>
            {d.sectors.slice().sort((a, b) => (b.pct || 0) - (a.pct || 0)).map(s => (
              <View key={s.sector}>
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
          <SectionLabel>PORTFOLIO HOLDINGS · {holdings.length}</SectionLabel>
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
          {holdings.length > 10 && <CTA outline label={all ? 'SHOW TOP 10' : `SHOW ALL ${holdings.length}`} onPress={() => setAll(a => !a)} style={{ marginTop: 12 }} />}
        </>
      )}
      <PdfButton make={makePdf} name={`Fact sheet ${accountId} ${d.asOf}`} />
    </>
  );
}

// ── page ──────────────────────────────────────────────────────────────────────────────────────────────────
const KINDS = [['txn', 'Transactions'], ['cg', 'Capital gains'], ['exp', 'Expenses'], ['fs', 'Fact sheet']];
export function ReportsPage({ V }) {
  const opts = V.acctOptions || [];
  const [sel, setSel] = useState(null);
  const [kind, setKind] = useState('txn');
  const accountId = sel && opts.some(o => o.id === sel) ? sel : opts[0] && opts[0].id;
  const Body = { txn: Transactions, cg: CapitalGains, exp: Expenses, fs: Factsheet }[kind];
  return (
    <>
      <Card style={{ padding: 18 }}>
        <Tx s={12} c={C.muted} lh={1.5}>Statements for your Qode PMS account from our custodian, Nuvama. Save or share any of them as a PDF.</Tx>
        <AccountChips options={opts} value={accountId} onPick={setSel} />
        <ChipRow chips={KINDS.map(([k, l]) => ({ label: l, active: kind === k, pick: () => setKind(k) }))} style={{ marginTop: 14 }} />
      </Card>
      {accountId ? <Body key={kind + accountId} accountId={accountId} rk={V.rk} /> : <View style={{ marginTop: 16 }}><Empty>No active account found.</Empty></View>}
    </>
  );
}
