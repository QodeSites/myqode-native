// Cream-zone content for each tab of the main app (Curtain v2).
import React, { useState } from 'react';
import { View, Pressable, ScrollView, TextInput, Modal } from 'react-native';
import Svg, { Path, Line } from 'react-native-svg';
import { C, Tx, Amt, Card, Chip, Fade, Skel, useUI } from '../ui';
import { ddPct, fmtDate } from '../adapt';
import { ArrowDown, Download, ChevronRight, ChevronDown, Phone, MailIcon, Search, InfoCircle, GoldDocIcon } from '../icons';
import { NavChart, DrawdownChart, Donut, GUTTER, growthAt, ddScale } from './charts';
import { UccNotice } from './ucc';
import HoldingsList from './holdingsList';
import { PushOfferCard } from './notifications';
import { PendingRows } from './services';

const Label = ({ children, style }) => (
  <Tx w={700} s={11} ls={0.12} c={C.muted} style={[{ marginTop: 22, marginBottom: 10, marginLeft: 2 }, style]}>{children}</Tx>
);

// Two-up grid row that never collapses to one column: fixed 48% widths with
// space-between (no horizontal gap that could overflow on narrow screens).
export function Grid2({ children, style }) {
  return (
    <View style={[{ flexDirection: 'row', flexWrap: 'wrap', rowGap: 12, justifyContent: 'space-between' }, style]}>
      {children}
    </View>
  );
}

export function RangeRow({ ranges, style }) {
  // A range whose data is still on its way pulses; the charts keep showing the previous range meanwhile.
  return (
    // Seven windows (1W to SI) share one row: tighter gaps and a smaller label so they fit a 320pt-wide phone.
    <View style={[{ flexDirection: 'row', gap: 4 }, style]}>
      {ranges.map(r => <View key={r.label} style={{ flex: 1, minWidth: 0, opacity: r.loading ? 0.55 : 1 }}><Chip label={r.label} active={r.active} disabled={r.disabled} onPress={r.pick} flex py={7} s={10.5} /></View>)}
    </View>
  );
}

export function Tile({ t }) {
  return (
    <Card style={{ width: '48%', paddingVertical: 13, paddingHorizontal: 14 }}>
      <Tx w={700} s={10.5} ls={0.12} c={C.muted}>{t.label}</Tx>
      {/* one line always: crores with paise (−₹1,30,48,459.27) wrapped in a half-width tile; long figures start smaller
          and shrink to fit on the phone (the web has no shrink-to-fit, so the smaller start covers it there) */}
      <Amt s={String(t.value || '').length > 13 ? 14 : 16} c={t.color} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6} style={{ marginTop: 6 }}>{t.value}</Amt>
      {!!t.note && <Tx s={10.5} c={C.muted} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={{ marginTop: 3 }}>{t.note}</Tx>}
    </Card>
  );
}

export function TxRow({ t, last, status }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13, paddingHorizontal: 16, borderBottomWidth: last ? 0 : 1, borderColor: C.hairline }}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Tx w={700} s={13}>{t.title}</Tx>
        <Tx s={11} c={C.muted} style={{ marginTop: 2 }}>{t.sub}</Tx>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Amt s={13} c={t.color}>{t.amt}</Amt>
        {status && <Tx w={700} s={8.5} ls={0.1} c={t.stColor} style={{ marginTop: 4 }}>{t.status}</Tx>}
      </View>
    </View>
  );
}

// A closed account on screen (fully withdrawn): one muted line saying when, so ₹0 / a few rupees never looks like a loss.
export function ClosedNote({ text, style }) {
  if (!text) return null;
  return (
    <View style={[{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(55,88,79,0.08)', borderRadius: 8, paddingVertical: 8, paddingHorizontal: 10 }, style]}>
      <View style={{ borderWidth: 1, borderColor: C.mutedBorder35, borderRadius: 4, paddingVertical: 1, paddingHorizontal: 5 }}>
        <Tx w={700} s={8} ls={0.06} c={C.muted}>CLOSED</Tx>
      </View>
      <Tx s={11.5} c={C.ink} lh={1.4} style={{ flex: 1 }}>{text}</Tx>
    </View>
  );
}

export function HomeSkeleton() {
  return (
    <View style={{ marginTop: -34 }}>
      <Grid2>
        <Skel h={72} style={{ width: '48%' }} /><Skel h={72} style={{ width: '48%' }} />
        <Skel h={72} style={{ width: '48%' }} /><Skel h={72} style={{ width: '48%' }} />
      </Grid2>
      <Skel h={212} style={{ marginTop: 16 }} />
      <Skel h={180} style={{ marginTop: 16 }} />
    </View>
  );
}

export function OtherSkeleton() {
  return (
    <View style={{ marginTop: -34 }}>
      <Skel h={150} />
      <Skel h={64} style={{ marginTop: 14 }} />
      <Skel h={64} style={{ marginTop: 12 }} />
      <Skel h={64} style={{ marginTop: 12 }} />
    </View>
  );
}

// ── Home is the web Dashboard and Portfolio the web Performance page (src/web/desktop.js), laid out for a phone ──
// A figure's value and sign from its text (−₹1,234.50, +5.20%); colour by sign: + green, − red, unsigned in ink.
const numOf = s => { if (s == null) return 0; const t = String(s); const n = parseFloat(t.replace(/[^0-9.]/g, '')); return isNaN(n) ? 0 : /[−-]/.test(t) ? -n : n; };
const signC = v => (String(v).startsWith('+') ? C.pos : /^[−-]\d/.test(String(v)) ? C.red : C.ink);

const CardHead = ({ title, right, style }) => (
  <View style={[{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10, minHeight: 28 }, style]}>
    <Tx w={700} s={11} ls={0.12} c={C.muted}>{title}</Tx>
    {right}
  </View>
);
// Legend centred under a chart: [label, swatch] pairs.
const Legend = ({ items }) => (
  <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 18, marginTop: 10 }}>
    {items.map(([lbl, sw]) => <View key={lbl} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>{sw}<Tx s={10.5} c={C.muted}>{lbl}</Tx></View>)}
  </View>
);
const Solid = ({ c, h = 2.5 }) => <View style={{ width: 14, height: h, borderRadius: 1, backgroundColor: c }} />;
const Dashed = ({ c }) => <Svg width={14} height={4}><Line x1={0} y1={2} x2={14} y2={2} stroke={c} strokeWidth={1.5} strokeDasharray="3 2" /></Svg>;

// NAV performance: Current NAV and Returns (the tooltip's Portfolio Growth at the touched point, else at the latest
// date) at opposite ends of one line, the chart, its legend underneath, then the period buttons.
function NavCard({ V, style }) {
  const [hover, setHover] = useState(null);
  const tip = V.navTip, n = tip && tip.pts ? tip.pts.length : 0;
  const at = hover != null && hover < n ? hover : n - 1;
  const g = n >= 2 && tip.kind === 'growth' ? growthAt(tip, at) : null;
  const gTxt = g == null || !isFinite(g) ? '–' : (g > 0 ? '+' : g < 0 ? '−' : '') + Math.abs(g).toFixed(2) + '%';
  const when = n >= 2 && tip.dates && tip.dates[at] ? (hover != null ? fmtDate(tip.dates[at]) : 'as of ' + fmtDate(tip.dates[at])) : '';
  return (
    <Card big style={[{ paddingTop: 16, paddingHorizontal: 16, paddingBottom: 14 }, style]}>
      <ClosedNote text={V.closedNote} style={{ marginBottom: 12 }} />
      <Tx w={700} s={11} ls={0.12} c={C.muted}>NAV PERFORMANCE</Tx>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12, marginTop: 10 }}>
        <View><Tx s={10.5} c={C.muted}>Current NAV</Tx><Amt s={17} style={{ marginTop: 2 }}>{V.navNow}</Amt></View>
        <View style={{ alignItems: 'flex-end', flexShrink: 1 }}>
          <Tx s={10.5} c={C.muted} numberOfLines={1}>Returns{when ? ' · ' + when : ''}</Tx>
          <Amt s={17} c={g == null ? C.muted : g < 0 ? C.red : C.pos} style={{ marginTop: 2 }}>{gTxt}</Amt>
        </View>
      </View>
      <View style={{ marginTop: 10 }}>
        <NavChart line={V.linePath} area={V.areaPath} bench={V.benchPath} tip={V.navTip} yTicks={V.yTicks} xDates={V.xDates} color={V.chartColor} onIdx={setHover} />
      </View>
      <Legend items={[['Your Portfolio', <Solid c={V.chartColor || C.green} />], ...(V.hasBench ? [[V.benchName, <Solid c={C.gray} h={1.5} />]] : [])]} />
      <RangeRow ranges={V.ranges} style={{ marginTop: 12 }} />
    </Card>
  );
}

// Drawdown with its y axis (0% at the top, round steps down, dashed lines) and a legend.
export function DrawdownCard({ V, style }) {
  if (!V.hasDd) return null;
  const H = 100;
  const { ticks, grid } = ddScale(V.ddTip);
  return (
    <Card style={[{ marginTop: 12, paddingTop: 13, paddingHorizontal: 14, paddingBottom: 12 }, style]}>
      <CardHead title="DRAWDOWN" right={<Amt s={14} c={Math.abs(V.ddNow) >= 0.005 ? C.red : C.muted}>{ddPct(V.ddNow)}</Amt>} />
      <View style={{ marginTop: 10, paddingLeft: GUTTER }}>
        <DrawdownChart line={V.ddLine} area={V.ddArea} bench={V.ddBench} tip={V.ddTip} height={H} grid={grid} />
        {ticks.map(k => (
          <Tx key={k.v} s={9} c={C.gray} numberOfLines={1}
            style={{ position: 'absolute', left: 0, width: GUTTER - 3, top: Math.max(0, Math.min(H - 12, (k.y / 100) * H - 6)), pointerEvents: 'none' }}>{k.t}</Tx>
        ))}
      </View>
      {!!(V.xDates && V.xDates.length) && (
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4, paddingLeft: GUTTER }}>
          {V.xDates.map((d, i) => <Tx key={i} s={9} c={C.gray}>{d}</Tx>)}
        </View>
      )}
      <Legend items={[['Your Portfolio', <Solid c={C.red} />], ...(V.hasBench ? [[V.benchName, <Dashed c={C.gray} />]] : [])]} />
      <Tx s={11} c={C.muted} style={{ marginTop: 8 }}>Fall from the previous peak, {V.rangePhrase}.</Tx>
    </Card>
  );
}

// Chart / table switch: two icons in one pill (the web's ViewToggle).
function ViewToggle({ value, onChange }) {
  const icon = (k, on) => {
    const c = on ? C.gold : C.muted;
    return k === 'chart'
      ? <Svg width={15} height={15} viewBox="0 0 24 24" fill="none"><Path d="M3 20h18M6 20v-7M11 20V5M16 20v-10M21 20v-4" stroke={c} strokeWidth={2} strokeLinecap="round" /></Svg>
      : <Svg width={15} height={15} viewBox="0 0 24 24" fill="none"><Path d="M3.5 5h17v14h-17zM3.5 10h17M3.5 14.5h17M9 5v14" stroke={c} strokeWidth={1.8} strokeLinejoin="round" /></Svg>;
  };
  return (
    <View style={{ flexDirection: 'row', backgroundColor: 'rgba(55,88,79,0.09)', borderRadius: 9, padding: 3, gap: 2 }}>
      {[['table', 'Table view'], ['chart', 'Chart view']].map(([k, a11y]) => {
        const on = value === k;
        return (
          <Pressable key={k} accessibilityRole="button" accessibilityLabel={a11y} accessibilityState={{ selected: on }} onPress={() => onChange(k)}
            hitSlop={{ top: 8, bottom: 8 }} style={({ pressed }) => ({ width: 34, height: 28, borderRadius: 6, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? C.green : pressed ? 'rgba(55,88,79,0.12)' : 'transparent' })}>
            {icon(k, on)}
          </Pressable>
        );
      })}
    </View>
  );
}

// A small dropdown: a button ("2026 ▾") and the list of choices (the web's compact dropdown). items: [{ label,
// active, pick }]; what: the spoken name ("Year"); title: the list's heading; lbl: the shown text for an item.
// dark: the brand's green with cream text and a gold chevron (a card's top-right control, like the active chips).
function Pick({ items, what, title, lbl = x => x.label, style, dark }) {
  const [open, setOpen] = useState(false);
  const cur = items.find(y => y.active) || items[0];
  if (!cur) return null;
  return (
    <>
      <Pressable onPress={() => setOpen(true)} accessibilityRole="button" accessibilityLabel={what + ': ' + lbl(cur) + '. Change'}
        hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }} style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: 5, height: dark ? 32 : 40, paddingHorizontal: dark ? 11 : 12, borderRadius: dark ? 999 : 9, borderWidth: 1,
          borderColor: dark ? C.green : C.mutedBorder35, backgroundColor: dark ? (pressed ? '#035A3B' : C.green) : pressed ? 'rgba(2,66,43,0.04)' : '#fff' }, style]}>
        <Tx w={700} s={dark ? 11.5 : 12} c={dark ? C.cream : C.ink} numberOfLines={1} style={{ flexShrink: 1 }}>{lbl(cur)}</Tx>
        <ChevronDown s={9} c={dark ? C.gold : C.muted} />
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable onPress={() => setOpen(false)} style={{ flex: 1, backgroundColor: 'rgba(0,32,23,0.45)', justifyContent: 'center', padding: 48 }}>
          <Card style={{ paddingVertical: 6, overflow: 'hidden' }}>
            <Tx w={700} s={10} ls={0.12} c={C.muted} style={{ paddingHorizontal: 18, paddingTop: 10, paddingBottom: 6 }}>{title}</Tx>
            {items.map(y => (
              <Pressable key={y.label} onPress={() => { setOpen(false); if (!y.active) y.pick(); }} accessibilityRole="button" accessibilityState={{ selected: y.active }}
                style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 18, borderTopWidth: 1, borderColor: C.hairline, backgroundColor: y.active ? 'rgba(2,66,43,0.06)' : 'transparent' }}>
                <Tx w={y.active ? 700 : 400} s={13} c={y.active ? C.green : C.ink} style={{ flex: 1 }}>{lbl(y)}</Tx>
                {y.active && <Tx w={700} s={13} c={C.green}>✓</Tx>}
              </Pressable>
            ))}
          </Card>
        </Pressable>
      </Modal>
    </>
  );
}

// % / ₹ as one joined switch (the same pill as the table / chart toggle).
function UnitToggle({ value, onChange }) {
  return (
    <View style={{ flexDirection: 'row', backgroundColor: 'rgba(55,88,79,0.09)', borderRadius: 9, padding: 3, gap: 2 }}>
      {[['pct', '%', 'Show returns in percent'], ['inr', '₹', 'Show profit in rupees']].map(([k, l, a11y]) => {
        const on = value === k;
        return (
          <Pressable key={k} accessibilityRole="button" accessibilityLabel={a11y} accessibilityState={{ selected: on }} onPress={() => onChange(k)}
            hitSlop={{ top: 8, bottom: 8 }} style={({ pressed }) => ({ width: 32, height: 28, borderRadius: 6, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? C.green : pressed ? 'rgba(55,88,79,0.12)' : 'transparent' })}>
            <Tx w={700} s={12.5} c={on ? C.gold : C.muted}>{l}</Tx>
          </Pressable>
        );
      })}
    </View>
  );
}

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
// P&L table: one row per year, the months (or quarters) and the year's total. Monthly is wider than a phone, so the
// year stays put on the left and the months scroll sideways; quarterly fits the width.
function PnlTable({ V, seg, inr, yearly }) {
  const rows = (seg ? V.pnlGridQ : V.pnlGrid) || [];
  const cols = yearly ? [] : seg ? ['Q1', 'Q2', 'Q3', 'Q4'] : MONTH_SHORT;   // Yearly: each year's total only
  // Full rupee amounts are wider than a phone's share of the width: in ₹ the quarters scroll sideways too.
  const fits = yearly || (seg && !inr);
  const RH = 34, YW = 50, CW = fits ? undefined : inr ? 96 : 64, TW = fits ? undefined : inr ? 108 : 70;
  const box = (w, line) => ({ width: w, flex: w ? undefined : 1, height: RH, paddingHorizontal: 6, alignItems: 'center', justifyContent: 'center', borderBottomWidth: line ? 1 : 0, borderColor: C.hairline });
  if (!rows.length) return <Tx s={12} c={C.muted} style={{ marginTop: 12 }}>No figures yet.</Tx>;
  const figures = (
    <View style={fits ? { flex: 1 } : null}>
      <View style={{ flexDirection: 'row', backgroundColor: C.green }}>
        {cols.map(m => <View key={m} style={box(CW)}><Tx w={700} s={10.5} c={C.cream}>{m}</Tx></View>)}
        <View style={box(TW)}><Tx w={700} s={10.5} c={C.cream}>Total</Tx></View>
      </View>
      {rows.map((r, ri) => (
        <View key={r.id} style={{ flexDirection: 'row' }}>
          {cols.map((m, i) => <View key={m} style={box(CW, ri < rows.length - 1)}><Amt s={11} c={(inr ? r.rcolors : r.colors)[i]} numberOfLines={1}>{(inr ? r.rcells : r.cells)[i]}</Amt></View>)}
          <View style={box(TW, ri < rows.length - 1)}><Amt w={700} s={11.5} c={inr ? r.rtcolor : r.tcolor} numberOfLines={1}>{inr ? r.rtotal : r.total}</Amt></View>
        </View>
      ))}
    </View>
  );
  return (
    <View style={{ marginTop: 12, flexDirection: 'row', borderWidth: 1, borderColor: C.hairline, borderRadius: 8, overflow: 'hidden' }}>
      <View style={{ width: YW }}>
        <View style={{ height: RH, paddingHorizontal: 8, justifyContent: 'center', backgroundColor: C.green }}><Tx w={700} s={10.5} c={C.cream}>Year</Tx></View>
        {rows.map((r, ri) => (
          <View key={r.id} style={{ height: RH, paddingHorizontal: 8, justifyContent: 'center', borderBottomWidth: ri < rows.length - 1 ? 1 : 0, borderColor: C.hairline }}>
            <Tx w={700} s={12}>{r.year}</Tx>
          </View>
        ))}
      </View>
      {fits ? figures : <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1 }}>{figures}</ScrollView>}
    </View>
  );
}

// P&L as a chart: one bar per month / quarter / year either side of zero (green up, red down), the figure beside it.
// The bars follow the % return; the rupee amount only for All years (which has no %).
function PnlBarsH({ rows, useAmt }) {
  const hasPct = r => r.p != null && String(r.p).trim() !== '' && String(r.p).trim() !== '–';
  const vals = rows.map(r => (useAmt ? numOf(r.v) : hasPct(r) ? numOf(r.p) : numOf(r.v)));
  const max = Math.max(0.0001, ...vals.map(Math.abs));
  const hasNeg = vals.some(v => v < 0);
  return (
    <View style={{ marginTop: 12, gap: 8 }}>
      {rows.map((r, i) => {
        const v = vals[i], w = Math.max(1.5, (Math.abs(v) / max) * 100) + '%';
        const fig = useAmt || !hasPct(r) ? r.vc || r.v : r.p;
        return (
          <View key={r.m} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }} accessibilityLabel={r.m + ' ' + fig}>
            <Tx s={11.5} c={C.muted} numberOfLines={1} style={{ width: 62 }}>{String(r.m).replace(/ \d{4}$/, '')}</Tx>
            <View style={{ flex: 1, flexDirection: 'row', height: 14 }}>
              {hasNeg && (
                <View style={{ flex: 1, alignItems: 'flex-end', borderRightWidth: 1, borderColor: C.mutedBorder35 }}>
                  {v < 0 && <View style={{ width: w, height: 14, borderTopLeftRadius: 3, borderBottomLeftRadius: 3, backgroundColor: C.red, opacity: 0.85 }} />}
                </View>
              )}
              <View style={{ flex: 1, alignItems: 'flex-start', borderLeftWidth: hasNeg ? 0 : 1, borderColor: C.mutedBorder35 }}>
                {v >= 0 && <View style={{ width: w, height: 14, borderTopRightRadius: 3, borderBottomRightRadius: 3, backgroundColor: C.pos, opacity: 0.85 }} />}
              </View>
            </View>
            <Amt s={11.5} c={v < 0 ? C.red : v > 0 ? C.pos : C.muted} numberOfLines={1} style={{ width: useAmt ? 104 : 64, textAlign: 'right' }}>{fig}</Amt>
          </View>
        );
      })}
    </View>
  );
}

// Profit and loss: the table first (or the chart), Monthly / Quarterly and the year, as on the web Dashboard.
export function PnlCard({ V }) {
  const [view, setView] = useState('table');
  const [unit, setUnit] = useState('pct');   // 'pct' | 'inr': returns or profit in rupees
  if (!V.hasPnl) return null;
  const seg = V.pnlSegChips.findIndex(c => c.active);
  const rows = V.pnlIsYear ? V.pnlRows : V.allYears.map(y => ({ m: y.label, v: y.total, vc: y.totalC, p: y.pct, color: y.color, pcolor: y.pcolor }));
  const inr = unit === 'inr';
  return (
    <Card style={{ marginTop: 12, paddingTop: 13, paddingHorizontal: 14, paddingBottom: 12 }}>
      {/* The year-and-period dropdown ("2026 - Quarterly") at the card's top right, in the brand green; the % / ₹ and
          table / chart switches on the row under it. */}
      <CardHead title="PROFIT & LOSS" />
      {/* One compact row: the % / ₹ and table / chart switches at the left, the year-and-period dropdown at the right. */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 }}>
        <UnitToggle value={unit} onChange={setUnit} />
        <ViewToggle value={view} onChange={setView} />
        <View style={{ flex: 1 }} />
        <Pick dark items={V.pnlOptions} what="Showing" title="SHOW PROFIT & LOSS" style={{ maxWidth: 170, flexShrink: 1 }} />
      </View>
      {view === 'table' ? <PnlTable V={V} seg={seg} inr={inr} yearly={!V.pnlIsYear} /> : <PnlBarsH rows={rows} useAmt={inr} />}
      <Tx s={11} c={C.gray} style={{ marginTop: 10 }}>As of {V.asOf} · Net of fees</Tx>
    </Card>
  );
}

// Excess return as a tinted pill: green ahead of the benchmark, red behind.
function Pill({ v }) {
  if (!v || v === '–') return <Amt s={12} c={C.muted}>–</Amt>;
  const n = numOf(v), fg = n === 0 ? C.muted : n < 0 ? C.red : C.pos, bg = n === 0 ? C.hairline : n < 0 ? 'rgba(194,54,47,0.10)' : 'rgba(21,128,61,0.11)';
  return <View style={{ backgroundColor: bg, borderRadius: 6, paddingVertical: 2, paddingHorizontal: 6 }}><Amt s={11.5} w={700} c={fg} numberOfLines={1}>{v}</Amt></View>;
}
// Trailing returns: the portfolio, the benchmark and the excess for each period. The web lays the periods across;
// a phone is too narrow for nine columns, so here they run down.
export function TrailingCard({ V }) {
  const rows = V.trailing || [];
  if (!rows.length) return null;
  const head = t => <Tx w={700} s={10} c={C.cream} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={{ flex: 1, textAlign: 'center' }}>{t}</Tx>;
  const fig = v => <View style={{ flex: 1, alignItems: 'center' }}><Amt s={12.5} c={!v || v === '–' ? C.muted : numOf(v) < 0 ? C.red : C.pos} numberOfLines={1}>{v || '–'}</Amt></View>;
  return (
    <Card style={{ marginTop: 12, paddingTop: 13, paddingHorizontal: 14, paddingBottom: 12 }}>
      <CardHead title="TRAILING RETURNS" right={<Tx s={11} c={C.muted}>Against {V.benchName}</Tx>} />
      <View style={{ marginTop: 12, borderWidth: 1, borderColor: C.hairline, borderRadius: 8, overflow: 'hidden' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 9, paddingHorizontal: 10, backgroundColor: C.green }}>
          <Tx w={700} s={10} c={C.cream} style={{ width: 70 }}>Period</Tx>
          {head('Portfolio (%)')}{head(V.benchName + ' (%)')}{head('Excess (%)')}
        </View>
        {rows.map((r, i) => (
          <View key={r.p} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 9, paddingHorizontal: 10, borderTopWidth: i ? 1 : 0, borderColor: C.hairline }}>
            <Tx w={700} s={12} numberOfLines={2} style={{ width: 70 }}>{r.p === 'SI' ? 'Since inception' : r.p}</Tx>
            {fig(r.pf)}{fig(r.n)}
            <View style={{ flex: 1, alignItems: 'center' }}><Pill v={r.x} /></View>
          </View>
        ))}
      </View>
    </Card>
  );
}

export function HomeCream({ V }) {
  // The web Dashboard's headline: net invested (current value − net invested = total returns), total returns,
  // return since inception and CAGR (the 1-year return until there is a full year of history).
  const ret = V.tiles[0] || {}, si = V.tiles[1] || {}, y1 = V.tiles[2] || {};
  const cagr = (V.keyMetrics || []).find(k => k.label === 'CAGR');
  // The earlier portal's four tiles, with the same figures: amount invested (net, the gross under it), current value,
  // total returns and the return since inception: "Returns %" (absolute) under a year, "CAGR" from a year.
  const tiles = [
    { label: 'AMOUNT INVESTED', value: (V.invested || {}).net, color: C.ink, note: V.invested && V.invested.gross ? 'Gross: ' + V.invested.gross : '' },
    { label: 'CURRENT VALUE', value: V.heroValue, color: C.ink, note: V.asOf ? 'As of ' + V.asOf : '' },
    { label: 'TOTAL RETURNS', value: ret.value, color: ret.color, note: 'Absolute returns' },
    { label: 'RETURNS %', value: si.value, color: si.color, note: si.annualised ? 'CAGR' : 'Absolute returns' },   // as the old portal
  ];
  return (
    <Fade>
      {/* The four headline figures first, then the NAV chart and the drawdown under it. */}
      <Grid2 style={{ marginTop: -34 }}>
        {tiles.map(t => <Tile key={t.label} t={t} />)}
      </Grid2>
      <Tx s={11} c={C.gray} style={{ marginTop: 10, marginLeft: 2 }}>As of {V.asOf}</Tx>
      <NavCard V={V} style={{ marginTop: 16 }} />
      <UccNotice visible={V.showUcc} onClose={V.dismissUcc} />
      <PushOfferCard V={V} />
      <DrawdownCard V={V} />
      <PnlCard V={V} />
      <TrailingCard V={V} />
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 16, marginBottom: 8, marginHorizontal: 2 }}>
        <Tx w={700} s={11} ls={0.12} c={C.muted}>TRANSACTIONS</Tx>
        <Pressable onPress={V.goServicesTx}><Tx w={700} s={12} c={C.green}>View all</Tx></Pressable>
      </View>
      <PendingRows V={V} />
      <Card style={{ overflow: 'hidden' }}>
        {V.hasTx
          ? V.tx3.map((t, i) => <TxRow key={i} t={t} last={i === V.tx3.length - 1} />)
          : <Tx s={12} c={C.muted} style={{ padding: 16 }}>No transactions recorded yet.</Tx>}
      </Card>
    </Fade>
  );
}

// The web Performance banner: CAGR (return since inception until a full year) large, then the 1-year return and the
// two drawdowns, each with the benchmark's figure under it.
function PerfBanner({ V, style }) {
  const head = Object.fromEntries((V.perfHead || []).map(([k, v, col]) => [k, { v, col }]));
  const si = head['RETURN (SI)'] || {}, y1 = head['1Y RETURN'] || {};
  const cagr = (V.keyMetrics || []).find(k => k.label === 'CAGR' && k.value !== '–');
  const cells = [
    { label: '1Y RETURN', value: y1.v, color: y1.col, note: 'Last 12 months' },
    ...(V.riskRows || []).map(r => ({ label: r.k === 'MAX DRAWDOWN' ? 'MAX DD' : 'CURRENT DD', value: r.v, color: r.vc, note: r.note })),
  ];
  return (
    <Card big style={[{ paddingVertical: 16, paddingHorizontal: 16 }, style]}>
      <View style={{ alignItems: 'center' }}>
        <Tx w={700} s={10.5} ls={0.12} c={C.muted} center>{cagr ? 'CAGR SINCE INCEPTION' : 'RETURN SINCE INCEPTION'}</Tx>
        <Amt s={26} c={cagr ? cagr.color : si.col} style={{ marginTop: 4, textAlign: 'center' }}>{(cagr ? cagr.value : si.v) || '–'}</Amt>
        <View style={{ width: 34, height: 2, backgroundColor: C.gold, marginTop: 8 }} />
      </View>
      <View style={{ flexDirection: 'row', marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderColor: C.hairline }}>
        {cells.map((c, i) => (
          <View key={c.label} style={{ flex: 1, paddingHorizontal: 6, borderLeftWidth: i ? 1 : 0, borderColor: C.hairline }}>
            <Tx w={700} s={9.5} ls={0.1} c={C.muted} numberOfLines={1}>{c.label}</Tx>
            <Amt s={14} c={c.color} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} style={{ marginTop: 4 }}>{c.value || '–'}</Amt>
            {!!c.note && <Tx s={9.5} c={C.gray} numberOfLines={2} style={{ marginTop: 2 }}>{c.note}</Tx>}
          </View>
        ))}
      </View>
    </Card>
  );
}

// Metrics: the ten measures (return, then risk), the portfolio beside its benchmark; tap one to read what it means
// (the web's ⓘ).
function RiskCard({ V }) {
  const [open, setOpen] = useState(null);
  const rows = V.riskMetrics || [];
  if (!rows.length) return null;
  return (
    <Card style={{ marginTop: 12, paddingTop: 12, paddingHorizontal: 14, paddingBottom: 2 }}>
      <Tx w={700} s={11} ls={0.12} c={C.ink}>METRICS</Tx>
      <View style={{ width: 24, height: 2, borderRadius: 2, backgroundColor: C.ink, marginTop: 5 }} />
      <Tx s={11} c={C.muted} style={{ marginTop: 6 }}>Since inception · Sharpe and Sortino use a 6.5% risk-free rate. Tap a measure to see what it means.</Tx>
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 12, paddingBottom: 6, borderBottomWidth: 1, borderColor: C.hairline }}>
        <View style={{ flex: 1.5 }} />
        <Tx w={700} s={9.5} ls={0.08} c={C.muted} style={{ flex: 1, textAlign: 'right' }}>PORTFOLIO</Tx>
        <Tx w={700} s={9.5} ls={0.08} c={C.muted} numberOfLines={1} style={{ flex: 1, textAlign: 'right' }}>{String(V.benchName).toUpperCase()}</Tx>
      </View>
      {rows.map((r, i) => (
        <Pressable key={r.k} onPress={() => setOpen(open === r.k ? null : r.k)} accessibilityRole="button" accessibilityLabel={r.k + ', what it means'}
          style={{ paddingVertical: 9, borderBottomWidth: i === rows.length - 1 ? 0 : 1, borderColor: C.hairline }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={{ flex: 1.5, minWidth: 0 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                <Tx w={700} s={12.5}>{r.k}</Tx>
                <InfoCircle />
              </View>
              <Tx s={10.5} c={C.muted} lh={1.4} style={{ marginTop: 2 }}>{r.note}</Tx>
            </View>
            <Amt s={14} c={r.pc || C.ink} style={{ flex: 1, textAlign: 'right' }}>{r.pf}</Amt>
            <View style={{ flex: 1, alignItems: 'flex-end' }}>
              <Amt s={13} c={r.bc || C.muted}>{r.bm}</Amt>
              {!!r.bnote && <Tx s={9.5} c={C.gray} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>{r.bnote}</Tx>}
            </View>
          </View>
          {open === r.k && <Fade duration={200}><Tx s={11.5} c={C.muted} lh={1.55} style={{ marginTop: 8 }}>{r.def}</Tx></Fade>}
        </Pressable>
      ))}
    </Card>
  );
}

// Return / Risk: three measures each, the name and a short note on the left, the figure coloured by sign on the right.
function MetricCard({ title, sub, items }) {
  const list = items.filter(Boolean);
  if (!list.length) return null;
  return (
    <Card style={{ marginTop: 12, paddingTop: 12, paddingHorizontal: 14, paddingBottom: 2 }}>
      <Tx w={700} s={11} ls={0.12} c={C.ink}>{title}</Tx>
      <View style={{ width: 24, height: 2, borderRadius: 2, backgroundColor: C.ink, marginTop: 5 }} />
      <Tx s={11} c={C.muted} style={{ marginTop: 6 }}>{sub}</Tx>
      {list.map((k, i) => (
        <View key={k.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: i === list.length - 1 ? 0 : 1, borderColor: C.hairline }}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Tx w={700} s={13}>{k.label}</Tx>
            {!!k.note && <Tx s={11} c={C.muted} lh={1.4} style={{ marginTop: 2 }}>{k.note}</Tx>}
          </View>
          <Amt s={16} c={signC(k.value)}>{k.value}</Amt>
        </View>
      ))}
    </Card>
  );
}

// Best / worst / positive months since inception: the portfolio beside its benchmark (the web's Monthly returns).
function MonthlyCard({ V }) {
  const rows = V.monthRows || [];
  const yrs = V.monthYears || [], on = yrs.find(y => y.active);
  if (!rows.length) return null;
  const fig = x => (
    <View style={{ flex: 1, alignItems: 'flex-end' }}>
      <Amt s={14} c={x.color} numberOfLines={1}>{x.v}</Amt>
      {!!x.note && <Tx s={10.5} c={C.muted} numberOfLines={1}>{x.note}</Tx>}
    </View>
  );
  return (
    <Card style={{ marginTop: 12, paddingTop: 12, paddingHorizontal: 14, paddingBottom: 2 }}>
      {/* Title at the left; the period dropdown ("Since inception", a year) at the top right, as on the P&L card. */}
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Tx w={700} s={11} ls={0.12} c={C.ink}>MONTHLY RETURNS</Tx>
          <View style={{ width: 24, height: 2, borderRadius: 2, backgroundColor: C.ink, marginTop: 5 }} />
          <Tx s={11} c={C.muted} style={{ marginTop: 6 }}>{on && on.id ? 'In ' + on.id : 'Since inception'}, against {V.benchName}</Tx>
        </View>
        {yrs.length > 1 && <Pick dark items={yrs} what="Period" title="SHOW MONTHLY RETURNS" style={{ maxWidth: 150, flexShrink: 1 }} />}
      </View>
      <View style={{ flexDirection: 'row', gap: 10, marginTop: 12, paddingBottom: 6, borderBottomWidth: 1, borderColor: C.hairline }}>
        <View style={{ flex: 1.3 }} />
        <Tx w={700} s={10} ls={0.08} c={C.muted} style={{ flex: 1, textAlign: 'right' }}>PORTFOLIO</Tx>
        <Tx w={700} s={10} ls={0.08} c={C.muted} numberOfLines={1} style={{ flex: 1, textAlign: 'right' }}>{String(V.benchName).toUpperCase()}</Tx>
      </View>
      {rows.map((r, i) => (
        <View key={r.k} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9, borderBottomWidth: i === rows.length - 1 ? 0 : 1, borderColor: C.hairline }}>
          <View style={{ flex: 1.3, minWidth: 0 }}>
            <Tx w={700} s={13}>{r.k}</Tx>
            <Tx s={11} c={C.muted} lh={1.4} style={{ marginTop: 2 }}>{r.note}</Tx>
          </View>
          {fig(r.pf)}{fig(r.bm)}
        </View>
      ))}
    </Card>
  );
}

export function PortfolioCream({ V }) {
  const km = Object.fromEntries((V.keyMetrics || []).map(k => [k.label, k]));
  const alpha = (V.keyMetrics || []).find(k => /^Alpha/.test(k.label));
  return (
    <Fade>
      {/* Web's Data Source View (only for an account with Orbis rows): Nuvama · Orbis (Legacy) · Orbis + Nuvama.
          A solid segmented bar on the cream, so it is not part of the header's scroll parallax and never drifts. */}
      {V.hasViews && (
        <View style={{ marginTop: -34, marginBottom: 12, flexDirection: 'row', backgroundColor: '#fff', borderRadius: 999, padding: 4,
          shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2 }}>
          {V.viewChips.map(ch => (
            <Pressable key={ch.label} onPress={ch.pick} accessibilityRole="button" accessibilityState={{ selected: ch.active }}
              style={{ flex: 1, paddingVertical: 9, paddingHorizontal: 4, borderRadius: 999, alignItems: 'center', justifyContent: 'center', backgroundColor: ch.active ? C.green : 'transparent' }}>
              <Tx w={700} s={10.5} c={ch.active ? C.gold : C.muted} center numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>{ch.label}</Tx>
            </Pressable>
          ))}
        </View>
      )}
      {/* The period (1W … SI) first, as a white strip over the header's curve; it drives every card below. */}
      <Card style={{ marginTop: V.hasViews ? 0 : -34, paddingVertical: 8, paddingHorizontal: 8 }}>
        <RangeRow ranges={V.ranges} />
      </Card>
      <PerfBanner V={V} style={{ marginTop: 12 }} />
      <ClosedNote text={V.closedNote} style={{ marginTop: 10 }} />
      <RiskCard V={V} />
      <MonthlyCard V={V} />
      <Tx s={11} c={C.gray} style={{ marginTop: 12, marginLeft: 2 }}>As of {V.asOf} · NAV-based, net of fees</Tx>
    </Fade>
  );
}

export function HoldingsCream({ V }) {
  return (
    <Fade>
      <Card big style={{ marginTop: -34, paddingVertical: 18, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 18 }}>
        <Donut slices={V.holdSlices} count={V.holdSlices.length} label={V.holdSlices.length === 1 ? 'STRATEGY' : 'STRATEGIES'} />
        <View style={{ flex: 1, gap: 8 }}>
          <Tx s={11} c={C.muted}>{V.holdCount} {V.holdCount === 1 ? 'account' : 'accounts'} across {V.holdSlices.length} {V.holdSlices.length === 1 ? 'strategy' : 'strategies'}</Tx>
          {V.holdSlices.map(h => (
            <View key={h.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: h.color }} />
              <View style={{ flex: 1 }}>
                <Tx s={12}>{h.name}</Tx>
                {h.n > 1 && <Tx s={10.5} c={C.muted}>{h.n} accounts</Tx>}
              </View>
              <Amt s={12}>{h.alloc}%</Amt>
            </View>
          ))}
        </View>
      </Card>
      {/* What the investor actually owns (securities), then the strategy accounts. */}
      <View style={{ marginTop: 16 }}><HoldingsList V={V} /></View>
      <Label>BY STRATEGY ACCOUNT</Label>
      <View style={{ gap: 12, marginTop: 4 }}>
        {V.holdings.map(h => (
          <Card key={h.id} style={{ paddingTop: 15, paddingHorizontal: 16, paddingBottom: 13, borderLeftWidth: 3, borderLeftColor: h.color }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <Tx w={700} s={14}>{h.name}</Tx>
              <Amt s={12} c={C.muted}>{h.alloc}%</Amt>
            </View>
            <Tx s={11} c={C.muted} style={{ marginTop: 2 }}>{h.tag}</Tx>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 11 }}>
              <Amt s={18}>{h.value}</Amt>
              <Amt s={12} c={h.retColor}>{h.gain}</Amt>
            </View>
            {h.hasM && (
              <View style={{ flexDirection: 'row', gap: 22, marginTop: 10, paddingTop: 9, borderTopWidth: 1, borderColor: C.hairline }}>
                <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 3 }}>
                  <Tx s={10} ls={0.08} c={C.muted}>RETURN</Tx><Amt s={12} c={h.retColor}>{h.ret}</Amt>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 3 }}>
                  <Tx s={10} ls={0.08} c={C.muted}>MAX DD</Tx><Amt s={12} c={C.red}>{h.mdd}</Amt>
                </View>
              </View>
            )}
          </Card>
        ))}
      </View>
      <Tx s={11} c={C.gray} style={{ marginTop: 10, marginLeft: 2 }}>As of {V.asOf}</Tx>
    </Fade>
  );
}
