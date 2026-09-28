// Desktop dashboard for the web build (browser ≥ 1024 px wide). Same view-model V as the phone shell
// (src/main.js → vals()), so every figure, action and dialog is the phone app's; the layout is built for desktop:
// fixed sidebar, top bar with the account switcher, and dashboard grids. Shared pieces: src/web/kit.js.
// Signed-out phases: src/web/auth.js. Sections: reports.js, documents.js, services.js, account.js.
import React, { useState, useEffect, useRef } from 'react';
import { View, ScrollView, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Wordmark } from '../ui';
import { Refresh, Bell, ChevronDown, ChevronLeft, FamilyIcon, TabHome, TabPortfolio, TabDocs, TabServices, TabMore, Bars, Plus, Swap } from '../icons';
import { NavChart, DrawdownChart, Donut } from '../screens/charts';
import { RequestSheets } from '../screens/services';
import { PAGES } from '../screens/pages';
import { DESKTOP_PAGES } from './pages';
import { SwitchSheet, SettingsSheet, NotifsSheet } from '../screens/sheets';
import { UccNotice } from '../screens/ucc';
import { ddPct, pct, inr } from '../adapt';
import { C, Tx, Amt, Card, Row, Panel, Stat, DarkCard, Label, TextLink, Table, Loading, Btn, PageIntro, Chips, Tabs, Delta, BarList, KeyVals, sentence } from './kit';
import { NuvamaDetails } from './nuvama';
import DesktopReports from './reports';
import DesktopDocuments from './documents';
import DesktopServices from './services';
import DesktopAccount from './account';

const NAV = [
  { key: 'home', label: 'Overview', Icon: TabHome, go: V => V.goHome() },
  { key: 'portfolio', label: 'Performance', Icon: TabPortfolio, go: V => V.goPortfolio() },
  { key: 'holdings', label: 'Holdings', Icon: TabPortfolio, go: V => V.segHold() },
  { key: 'reports', label: 'Reports', Icon: ({ c }) => <Bars s={20} c={c} />, go: V => V.openPage('reports') },
  { key: 'docs', label: 'Documents', Icon: TabDocs, go: V => V.goDocs() },
  { key: 'services', label: 'Services', Icon: TabServices, go: V => V.goServices() },
  { key: 'more', label: 'Account', Icon: TabMore, go: V => V.goMore() },
];
const TITLES = { home: 'Overview', portfolio: 'Performance', holdings: 'Holdings', reports: 'Reports', docs: 'Documents', services: 'Services', more: 'Account' };

// Clean URLs for the web: /app/overview, /app/performance, /app/family … Each section and page has its own address,
// so a link, a refresh or the browser's Back button lands where the client expects.
const SLUGS = { home: 'overview', portfolio: 'performance', holdings: 'holdings', docs: 'documents', services: 'services', more: 'account' };
const BASE = '/app';
const pathFor = (tab, page) => BASE + '/' + (page || SLUGS[tab] || 'overview');
const slugOf = () => (typeof location === 'undefined' ? '' : location.pathname.replace(/^\/app\/?/, '').replace(/\/+$/, ''));
// Point the app at a slug. Returns false when the slug is unknown (404).
function openSlug(V, slug) {
  if (!slug) { V.goHome(); return true; }
  const n = NAV.find(x => SLUGS[x.key] === slug);
  if (n) { if (V.page) V.closePage(); n.go(V); return true; }
  if (DESKTOP_PAGES[slug] || PAGES[slug]) { V.openPage(slug); return true; }
  return false;
}

function useUrlSync(V, active, page, title, setMissing) {
  const pending = useRef(null), miss = useRef(false);
  const web = typeof window !== 'undefined' && typeof history !== 'undefined';
  useEffect(() => {
    if (!web) return undefined;
    const slug = slugOf();
    if (slug && !openSlug(V, slug)) { miss.current = true; setMissing(slug); }
    else if (slug) pending.current = BASE + '/' + slug;
    const onPop = () => { setMissing(null); if (!openSlug(V, slugOf())) setMissing(slugOf()); };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
  useEffect(() => {
    if (!web) return;
    if (miss.current) { miss.current = false; return; }   // keep the unknown address in the bar on a 404
    const want = pathFor(active === 'reports' ? null : V.tab, page);
    if (pending.current) { if (want !== pending.current) return; pending.current = null; }
    if (location.pathname !== want && !/^\/app\/?$/.test(location.pathname)) history.pushState(null, '', want);
    else if (location.pathname !== want) history.replaceState(null, '', want);
  }, [active, page]);
  useEffect(() => { if (typeof document !== 'undefined') document.title = title + ' | myQode'; }, [title]);
}

/* ── frame ──────────────────────────────────────────────────────────────────────────────────────────────── */
const GROUPS = [['Portfolio', ['home', 'portfolio', 'holdings']], ['Statements', ['reports', 'docs']], ['Manage', ['services', 'more']]];
const initials = n => String(n || '').replace(/^(mr|mrs|ms|dr)\.?\s+/i, '').split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();

function Sidebar({ V, active, onNav }) {
  const name = (V.user && V.user.name) || '';
  const go = n => { onNav(); if (V.page && n.key !== 'reports') V.closePage(); n.go(V); };
  return (
    <LinearGradient colors={['#02422B', '#002017', '#000000']} locations={[0, 0.6, 1]} start={{ x: 0, y: 0 }} end={{ x: 0.4, y: 1 }} style={{ width: 248, paddingTop: 22, paddingBottom: 16 }}>
      <View style={{ paddingHorizontal: 22, flexDirection: 'row', alignItems: 'baseline', gap: 10 }}>
        <Wordmark s={28} c={C.cream} />
      </View>
      <Tx s={11.5} c="rgba(239,236,211,0.55)" style={{ paddingHorizontal: 22, marginTop: 2 }}>Qode Advisors LLP · PMS</Tx>
      <View style={{ width: 34, height: 2, backgroundColor: C.gold, marginTop: 12, marginLeft: 22 }} />
      <View style={{ marginTop: 18, paddingHorizontal: 12, gap: 14 }}>
        {GROUPS.map(([g, keys]) => (
          <View key={g}>
            <Tx w={600} s={11.5} c="rgba(239,236,211,0.45)" style={{ paddingHorizontal: 10, marginBottom: 4 }}>{g}</Tx>
            {keys.filter(k => !(V.viewing && k === 'services')).map(k => NAV.find(n => n.key === k)).map(n => {
              const on = active === n.key;
              return (
                <Pressable key={n.key} accessibilityRole="link" accessibilityState={{ selected: on }} onPress={() => go(n)} style={({ hovered }) => ({
                  flexDirection: 'row', alignItems: 'center', gap: 11, height: 38, paddingHorizontal: 10, borderRadius: 8,
                  backgroundColor: on ? 'rgba(218,189,56,0.14)' : hovered ? 'rgba(239,236,211,0.06)' : 'transparent',
                })}>
                  <n.Icon c={on ? C.gold : 'rgba(239,236,211,0.65)'} s={18} />
                  <Tx w={on ? 600 : 400} s={14} c={on ? C.gold : 'rgba(239,236,211,0.82)'}>{n.label}</Tx>
                  {on && <View style={{ marginLeft: 'auto', width: 6, height: 6, borderRadius: 3, backgroundColor: C.gold }} />}
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>
      <View style={{ flex: 1 }} />
      {V.testMode && (
        <View style={{ marginHorizontal: 22, marginBottom: 12, backgroundColor: C.redTint, borderRadius: 6, paddingVertical: 5, alignItems: 'center' }}>
          <Tx w={600} s={11.5} c={C.red}>Test mode</Tx>
        </View>
      )}
      <View style={{ marginHorizontal: 12, borderTopWidth: 1, borderColor: 'rgba(239,236,211,0.12)', paddingTop: 14, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(218,189,56,0.16)', alignItems: 'center', justifyContent: 'center' }}>
          <Tx w={600} s={12} c={C.gold}>{initials(name) || 'Q'}</Tx>
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          {!!name && <Tx w={600} s={13} c={C.cream} numberOfLines={1}>{name}</Tx>}
          <Pressable accessibilityRole="button" onPress={V.doLogout} style={({ hovered }) => ({ alignSelf: 'flex-start', opacity: hovered ? 0.7 : 1 })}>
            <Tx w={600} s={12} c={C.gold}>Sign out</Tx>
          </Pressable>
        </View>
      </View>
    </LinearGradient>
  );
}

function TopBar({ V, title }) {
  const iconBtn = ({ hovered }) => ({ width: 36, height: 36, borderRadius: 8, borderWidth: 1, borderColor: C.line2, backgroundColor: hovered ? C.hover : C.card, alignItems: 'center', justifyContent: 'center' });
  return (
    <View style={{ height: 64, paddingHorizontal: 28, flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: 1, borderColor: C.line, backgroundColor: C.card }}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Tx w={600} s={19} role="heading" aria-level={1} numberOfLines={1}>{title}</Tx>
        {!!V.asOf && <Tx s={12} c={C.ink3}>Data as of {V.asOf}</Tx>}
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel="Change account" onPress={V.openSwitch} style={({ hovered }) => ({ flexDirection: 'row', alignItems: 'center', gap: 9, height: 36, borderWidth: 1, borderColor: C.line2, backgroundColor: hovered ? C.hover : C.card, borderRadius: 8, paddingLeft: 5, paddingRight: 10 })}>
        <View style={{ width: 26, height: 26, borderRadius: 6, backgroundColor: C.green, alignItems: 'center', justifyContent: 'center' }}>
          {V.isFamily ? <FamilyIcon s={14} c={C.gold} /> : <Tx w={600} s={10} c={C.gold}>{V.acctInitials}</Tx>}
        </View>
        <Tx w={600} s={13} numberOfLines={1} style={{ maxWidth: 260 }}>{V.acctName}{V.acctTag ? <Tx s={13} c={C.ink3}>{'  ' + V.acctTag}</Tx> : null}</Tx>
        {V.multiAcct && <ChevronDown c={C.ink3} />}
      </Pressable>
      <Pressable accessibilityRole="button" onPress={V.refresh} accessibilityLabel="Refresh" style={s => [iconBtn(s), { opacity: V.refreshing ? 0.45 : 1 }]}><Refresh c={C.ink2} s={16} /></Pressable>
      <Pressable accessibilityRole="button" onPress={V.openNotifs} accessibilityLabel="Notifications" style={iconBtn}>
        <Bell c={C.ink2} s={16} />
        {V.hasNotif && <View style={{ position: 'absolute', top: 7, right: 8, width: 7, height: 7, borderRadius: 4, backgroundColor: C.gold, borderWidth: 1, borderColor: C.card }} />}
      </Pressable>
      {!V.viewing && <Btn label="Add funds" icon={<Plus s={15} c={C.gold} />} onPress={V.openAdd} small style={{ marginLeft: 4 }} />}
    </View>
  );
}

/* ── helpers ────────────────────────────────────────────────────────────────────────────────────────────── */
// Formatted figures back to numbers, for bar lengths and sums ("+₹14,56,389.14", "−0.19%").
const numOf = s => { if (s == null) return 0; const t = String(s); const n = parseFloat(t.replace(/[^0-9.]/g, '')); return isNaN(n) ? 0 : /[−-]/.test(t) ? -n : n; };
const signCol = v => (v < 0 ? C.red : v > 0 ? C.pos : C.ink2);
const Divider = () => <View style={{ width: 1, alignSelf: 'stretch', backgroundColor: C.line }} />;

// One slice per strategy: a family can hold the same strategy in several accounts.
function strategySlices(rows) {
  const by = new Map();
  rows.forEach(h => {
    const k = h.name || h.id, g = by.get(k);
    if (g) { g.w += h.w || 0; g.raw += h.raw || 0; g.n += 1; } else by.set(k, { id: k, name: k, color: h.color, w: h.w || 0, raw: h.raw || 0, n: 1 });
  });
  return [...by.values()].sort((a, b) => b.w - a.w).map(g => ({ ...g, pct: Math.round(g.w * 10) / 10 }));
}

/* ── dashboard pieces ───────────────────────────────────────────────────────────────────────────────────── */
// Headline strip: current value and the figures a client checks first, with the most used actions.
// Figures on the dark summary strip: lighter green / red so they read on deep green.
const onDark = col => (col === C.red || col === '#EF4444' ? '#FCA5A5' : col === C.pos || col === '#16A34A' ? '#86EFAC' : C.cream);
function DarkBtn({ label, icon, onPress, gold }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ hovered }) => ({ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 34, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1,
      borderColor: gold ? C.gold : hovered ? C.gold : 'rgba(239,236,211,0.3)', backgroundColor: gold ? (hovered ? '#e8cc4e' : C.gold) : hovered ? 'rgba(239,236,211,0.06)' : 'transparent' })}>
      {icon}
      <Tx w={600} s={12.5} c={gold ? C.ink : C.cream}>{label}</Tx>
    </Pressable>
  );
}

// Headline strip: current value and the figures a client checks first, with the most used actions.
function Summary({ V }) {
  const f = V.flows || [];
  const Div = () => <View style={{ width: 1, alignSelf: 'stretch', backgroundColor: 'rgba(239,236,211,0.14)' }} />;
  const cell = (label, value, color) => (
    <View style={{ flex: 1, paddingHorizontal: 20, justifyContent: 'center' }}>
      <Label c="rgba(239,236,211,0.6)">{label}</Label>
      <Amt w={600} s={19} c={onDark(color)} numberOfLines={1} style={{ marginTop: 6 }}>{value}</Amt>
    </View>
  );
  const ret = V.tiles[0] || {}, si = V.tiles[1] || {}, y1 = V.tiles[2] || {};
  return (
    <DarkCard style={{ flexDirection: 'row', paddingVertical: 22, paddingHorizontal: 0 }}>
      <View style={{ flex: 1.5, paddingHorizontal: 24, justifyContent: 'center' }}>
        <Label c="rgba(239,236,211,0.6)">Current value</Label>
        <Amt w={600} s={30} c={C.cream} numberOfLines={1} style={{ marginTop: 6, letterSpacing: -0.6 }}>{V.heroValue}</Amt>
        <View style={{ width: 34, height: 2, backgroundColor: C.gold, marginTop: 10 }} />
        <Tx s={12} c="rgba(239,236,211,0.6)" style={{ marginTop: 8 }}>{[V.acctName, V.sinceLbl].filter(Boolean).join('  ·  ')}</Tx>
      </View>
      <Div />
      {cell('Net invested', (f[2] || {}).value || '–')}
      <Div />
      {cell('Total returns', ret.value, ret.color)}
      <Div />
      {cell('Return since inception', si.value, si.color)}
      <Div />
      {cell('1 year return', y1.value, y1.color)}
      <Div />
      <View style={{ paddingHorizontal: 20, justifyContent: 'center', gap: 8 }}>
        {!V.viewing && <DarkBtn gold label="Switch strategy" icon={<Swap s={14} c={C.ink} />} onPress={V.openSwitchStrategy} />}
        <DarkBtn label="Statements" icon={<Bars s={14} c={C.gold} />} onPress={() => V.openPage('reports')} />
      </View>
    </DarkCard>
  );
}

function NavPanel({ V, height = 250, style }) {
  return (
    <Panel title="NAV performance" sub={'Growth of your portfolio' + (V.hasBench ? ' against ' + V.benchName : '') + ', rebased to 100'} style={[{ flex: 2 }, style]}
      right={<Chips value={(V.ranges.find(r => r.active) || {}).label} options={V.ranges.map(r => [r.label, r.label])} onChange={l => { const r = V.ranges.find(x => x.label === l); if (r) r.pick(); }} />}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 18, marginBottom: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}><Amt w={600} s={20}>{V.navNow}</Amt><Tx s={12} c={C.ink3}>NAV</Tx></View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}><View style={{ width: 14, height: 2.5, borderRadius: 1, backgroundColor: V.chartColor || C.green }} /><Tx s={12} c={C.ink2}>Your portfolio</Tx></View>
        {V.hasBench && <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}><View style={{ width: 14, height: 1.5, backgroundColor: C.ink3 }} /><Tx s={12} c={C.ink2}>{V.benchName}</Tx></View>}
      </View>
      <NavChart line={V.linePath} area={V.areaPath} bench={V.benchPath} tip={V.navTip} yTicks={V.yTicks} xDates={V.xDates} height={height} color={V.chartColor} />
    </Panel>
  );
}

function Allocation({ V, style }) {
  const slices = strategySlices(V.holdings);
  const n = V.holdings.length;
  return (
    <Panel title="Allocation" sub={n + (n === 1 ? ' account' : ' accounts') + ' across ' + slices.length + (slices.length === 1 ? ' strategy' : ' strategies')} style={[{ flex: 1 }, style]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 22 }}>
        <Donut slices={slices} count={''} label={''} size={128} />
        <BarList style={{ flex: 1 }} items={slices.map(g => ({ key: g.id, label: String(g.name).replace('Qode ', ''), sub: g.n > 1 ? g.n + ' accounts' : '', pct: g.w, color: g.color }))} />
      </View>
      {slices.some(g => g.raw) && (
        <KeyVals style={{ marginTop: 18, borderTopWidth: 1, borderColor: C.line, paddingTop: 4 }}
          items={slices.map(g => [String(g.name), inr(g.raw)]).concat([['Total', inr(slices.reduce((a, g) => a + (g.raw || 0), 0))]])} />
      )}
    </Panel>
  );
}

const HOLD_COLS = [
  { key: 'name', label: 'Strategy', flex: 2.1, render: h => (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: h.color }} />
      <View style={{ minWidth: 0 }}><Tx w={600} s={13.5} numberOfLines={1}>{h.name}</Tx><Tx s={12} c={C.ink3} numberOfLines={1}>{h.tag && h.tag !== h.id ? h.id + '  ·  ' + h.tag : h.id}</Tx></View>
    </View>) },
  { key: 'value', label: 'Value', right: true, flex: 1.2, render: h => <Amt s={13.5}>{h.value}</Amt> },
  { key: 'alloc', label: 'Weight', right: true, flex: 0.9, render: h => (
    <View style={{ alignItems: 'flex-end', gap: 5 }}>
      <Amt s={13} c={C.ink2}>{h.alloc}%</Amt>
      <View style={{ width: 56, height: 4, borderRadius: 2, backgroundColor: C.track }}><View style={{ width: Math.max(2, h.w || 0) + '%', height: 4, borderRadius: 2, backgroundColor: h.color }} /></View>
    </View>) },
  { key: 'ret', label: 'Return (SI)', right: true, flex: 0.9, render: h => <Amt s={13.5} c={h.retColor}>{h.ret || '–'}</Amt> },
  { key: 'mdd', label: 'Max drawdown', right: true, flex: 1, render: h => <Amt s={13.5} c={h.mdd ? C.red : C.ink3}>{h.mdd || '–'}</Amt> },
];
const HoldingsTable = ({ V, title = 'Holdings', sub, style, right, onRowPress, selected }) => (
  <Panel title={title} sub={sub} right={right} pad={0} style={[{ flex: 2 }, style]}>
    <Table cols={HOLD_COLS} rows={V.holdings} onRowPress={onRowPress} selected={selected} empty="No active strategies in this view." />
  </Panel>
);

function RecentTx({ V, n = 9, style }) {
  const list = V.txAll.slice(0, n);
  return (
    <Panel title="Recent activity" right={V.viewing ? null : <TextLink label="View all" onPress={V.goServicesTx} />} pad={0} style={[{ flex: 1 }, style]}>
      {list.length ? list.map((t, i) => (
        <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11, paddingHorizontal: 20, borderTopWidth: 1, borderColor: C.line }}>
          <View style={{ width: 30, height: 30, borderRadius: 8, backgroundColor: numOf(t.amt) < 0 ? C.redTint : C.posTint, alignItems: 'center', justifyContent: 'center' }}>
            <Tx w={600} s={14} c={numOf(t.amt) < 0 ? C.red : C.pos}>{numOf(t.amt) < 0 ? '↑' : '↓'}</Tx>
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Tx w={600} s={13} numberOfLines={1}>{t.title}</Tx>
            <Tx s={12} c={C.ink3} numberOfLines={1}>{t.sub}</Tx>
          </View>
          <Amt s={13.5} c={t.color}>{t.amt}</Amt>
        </View>
      )) : <Tx s={13} c={C.ink3} style={{ padding: 20, borderTopWidth: 1, borderColor: C.line }}>No transactions recorded yet.</Tx>}
    </Panel>
  );
}

function DrawdownPanel({ V, height = 170, style }) {
  if (!V.hasDd) return null;
  return (
    <Panel title="Drawdown" sub={'Fall from the previous peak, ' + V.rangeLabel + (V.hasBench ? '. Dashed: ' + V.benchName : '')} style={[{ flex: 1 }, style]}
      right={<View style={{ alignItems: 'flex-end' }}><Amt w={600} s={18} c={Math.abs(V.ddNow) >= 0.005 ? C.red : C.ink2}>{ddPct(V.ddNow)}</Amt><Tx s={11.5} c={C.ink3}>current</Tx></View>}>
      <DrawdownChart line={V.ddLine} area={V.ddArea} bench={V.ddBench} tip={V.ddTip} height={height} />
    </Panel>
  );
}

// Profit and loss as a bar chart of period returns, with the year's figures beside it.
function PnlBars({ rows, height = 150, useAmt }) {
  const vals = rows.map(r => (useAmt ? numOf(r.v) : numOf(r.p) || numOf(r.v)));
  const maxP = Math.max(0, ...vals), maxN = Math.max(0, ...vals.map(v => -v));
  const hasNeg = maxN > 0, hasPos = maxP > 0;
  const LBL = 18;   // room for the figure above / below a bar
  const plot = height - LBL * ((hasPos ? 1 : 0) + (hasNeg ? 1 : 0));
  const upBars = hasPos ? plot * maxP / (maxP + maxN) : 0, downBars = plot - upBars;
  const up = hasPos ? upBars + LBL : 0, down = height - up;
  const max = Math.max(0.0001, maxP, maxN);
  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'stretch', gap: 6, height }}>
        {rows.map((r, i) => {
          const v = vals[i], h = Math.max(2, v < 0 ? (-v / (maxN || 1)) * downBars : (v / (maxP || 1)) * upBars);
          return (
            <View key={r.m || r.label} style={{ flex: 1, alignItems: 'center' }} accessibilityLabel={(r.m || r.label) + ' ' + r.v}>
              <View style={{ height: up, width: '100%', justifyContent: 'flex-end', alignItems: 'center' }}>
                {v >= 0 && <Amt s={10.5} c={C.ink3} numberOfLines={1} style={{ marginBottom: 3 }}>{useAmt ? '' : r.p}</Amt>}
                {v >= 0 && <View style={{ width: '70%', maxWidth: 34, height: h, borderTopLeftRadius: 4, borderTopRightRadius: 4, backgroundColor: C.pos, opacity: 0.85 }} />}
              </View>
              <View style={{ height: down, width: '100%', alignItems: 'center', borderTopWidth: hasNeg && hasPos ? 1 : 0, borderColor: C.line2 }}>
                {v < 0 && <View style={{ width: '70%', maxWidth: 34, height: h, borderBottomLeftRadius: 4, borderBottomRightRadius: 4, backgroundColor: C.red, opacity: 0.85 }} />}
                {v < 0 && <Amt s={10.5} c={C.ink3} numberOfLines={1} style={{ marginTop: 3 }}>{useAmt ? '' : r.p}</Amt>}
              </View>
            </View>
          );
        })}
      </View>
      <View style={{ flexDirection: 'row', gap: 6, marginTop: 8, borderTopWidth: !hasNeg || !hasPos ? 1 : 0, borderColor: C.line2, paddingTop: 6 }}>
        {rows.map(r => <Tx key={r.m || r.label} s={11.5} c={C.ink3} center numberOfLines={1} style={{ flex: 1 }}>{String(r.m || r.label).replace(/ \d{4}$/, '').slice(0, 3)}{/^Q/.test(r.m || '') ? String(r.m).slice(3, 0) : ''}</Tx>)}
      </View>
    </View>
  );
}

function PnlPanel({ V, style, wide }) {
  if (!V.hasPnl) return null;
  const years = V.pnlPills;
  const yi = years.findIndex(y => y.active);
  const seg = V.pnlSegChips.findIndex(c => c.active);
  const rows = V.pnlIsYear ? V.pnlRows : V.allYears.map(y => ({ m: y.label, v: y.total, color: y.color }));
  const nums = rows.map(r => numOf(r.v));
  const best = rows[nums.indexOf(Math.max(...nums))], worst = rows[nums.indexOf(Math.min(...nums))];
  const upCount = nums.filter(n => n > 0).length;
  const label = V.pnlIsYear ? (seg ? 'quarters' : 'months') : 'years';
  const side = (
    <KeyVals style={{ minWidth: 230 }} items={[
      ...(V.pnlIsYear ? [[V.fyLabel + ' total', <View key="t" style={{ alignItems: 'flex-end' }}><Amt w={600} s={14} c={V.fyColor}>{V.fyTotal}</Amt>{!!V.fyTotalPct && <Amt s={12} c={V.fyColor}>{V.fyTotalPct}</Amt>}</View>]] : []),
      ...(best ? [['Best ' + label.slice(0, -1), <View key="b" style={{ alignItems: 'flex-end' }}><Amt w={600} s={13.5} c={best.color}>{best.v}</Amt><Tx s={11.5} c={C.ink3}>{best.m}</Tx></View>]] : []),
      ...(worst && worst !== best ? [['Weakest ' + label.slice(0, -1), <View key="w" style={{ alignItems: 'flex-end' }}><Amt w={600} s={13.5} c={worst.color}>{worst.v}</Amt><Tx s={11.5} c={C.ink3}>{worst.m}</Tx></View>]] : []),
      ['Positive ' + label, upCount + ' of ' + rows.length],
    ]} />
  );
  return (
    <Panel title="Profit and loss" sub="Net of fees" style={style}
      right={<View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
        {V.pnlIsYear && <Chips value={seg} options={V.pnlSegChips.map((c, i) => [i, i ? 'Quarterly' : 'Monthly'])} onChange={i => V.pnlSegChips[i].pick()} />}
        <Chips value={yi} options={years.map((y, i) => [i, y.label === 'All Years' ? 'All years' : y.label])} onChange={i => years[i].pick()} />
      </View>}>
      <View style={{ flexDirection: wide ? 'row' : 'column', gap: wide ? 32 : 18 }}>
        <View style={{ flex: wide ? 1 : undefined }}><PnlBars rows={rows} useAmt={!V.pnlIsYear} /></View>
        {side}
      </View>
    </Panel>
  );
}

const TRAIL_COLS = V => [
  { key: 'p', label: 'Period', render: r => <Tx w={600} s={13}>{r.p}</Tx> },
  { key: 'pf', label: 'Portfolio', right: true, render: r => <Amt w={600} s={13.5} c={r.neg ? C.red : C.pos}>{r.pf}</Amt> },
  { key: 'n', label: V.benchName, right: true, render: r => <Amt s={13.5} c={C.ink2}>{r.n}</Amt> },
  { key: 'x', label: 'Excess', right: true, render: r => <Delta text={r.x} neg={numOf(r.x) < 0} zero={numOf(r.x) === 0} s={12.5} style={{ alignSelf: 'flex-end' }} /> },
];
const TrailingPanel = ({ V, style }) => (
  <Panel title="Trailing returns" sub={'Against ' + V.benchName} pad={0} style={[{ flex: 1 }, style]}>
    <Table dense cols={TRAIL_COLS(V)} rows={V.trailing} empty="Not enough history yet." />
  </Panel>
);

function DataState({ V, children }) {
  if (V.loading || V.skelOther) return <Loading rows={5} />;
  if (!V.hasData) {
    return (
      <Card style={{ padding: 32, alignItems: 'center' }}>
        <Tx w={600} s={15} center>We couldn’t load your portfolio</Tx>
        <Tx s={13} c={C.ink2} center lh={1.5} style={{ marginTop: 6, maxWidth: 520 }}>{V.dataErr || 'Please try again in a moment.'}</Tx>
        <Btn label="Try again" onPress={V.retry} style={{ marginTop: 16 }} />
      </Card>
    );
  }
  return children;
}

/* ── sections ───────────────────────────────────────────────────────────────────────────────────────────── */
function Overview({ V }) {
  return (
    <DataState V={V}>
      <View style={{ gap: 20 }}>
        {!V.viewing && <UccNotice visible={V.showUcc} onClose={V.dismissUcc} />}
        <Summary V={V} />
        <Row><NavPanel V={V} height={300} /><Allocation V={V} /></Row>
        <Row><HoldingsTable V={V} right={<TextLink label="All holdings" onPress={V.segHold} />} /><RecentTx V={V} /></Row>
        <Row><DrawdownPanel V={V} height={250} /><PnlPanel V={V} style={{ flex: 1.3 }} /></Row>
        {!V.viewing && <NuvamaDetails compact />}
      </View>
    </DataState>
  );
}

function Performance({ V }) {
  const maxDd = V.riskRows.find(r => /MAX/i.test(r.k));
  const cur = V.riskRows.find(r => /CURRENT/i.test(r.k));
  const f = V.flows || [];
  return (
    <DataState V={V}>
      <View style={{ gap: 20 }}>
        <Row>
          {V.perfHead.map(([k, v, col]) => <Stat key={k} label={sentence(k).replace('(SI)', 'since inception').replace('DD', 'drawdown')} value={v} color={col} style={{ flex: 1 }} />)}
          {!!maxDd && <Stat label="Max drawdown" value={maxDd.v} color={maxDd.vc} note={maxDd.note} style={{ flex: 1 }} />}
        </Row>
        <Row><NavPanel V={V} height={300} /><TrailingPanel V={V} /></Row>
        <Row>
          <DrawdownPanel V={V} height={200} style={{ flex: 1.4 }} />
          <Panel title="Capital and risk" style={{ flex: 1 }}>
            <KeyVals items={[
              ...f.map(x => [String(x.label).charAt(0) + String(x.label).slice(1).toLowerCase(), x.value, x.color === C.ink ? undefined : x.color]),
              ...(maxDd ? [['Max drawdown', maxDd.v, maxDd.vc]] : []),
              ...(cur ? [['Current drawdown', cur.v, cur.vc]] : []),
            ]} />
          </Panel>
        </Row>
        <PnlPanel V={V} wide />
      </View>
    </DataState>
  );
}

const RET_KEYS = [['m1', '1M'], ['m3', '3M'], ['m6', '6M'], ['y1', '1Y'], ['y3', '3Y'], ['sinceInception', 'SI']];
function Holdings({ V }) {
  const rows = V.holdings;
  const total = rows.reduce((s, h) => s + (h.raw || 0), 0);
  const slices = strategySlices(rows);
  const withRet = rows.filter(h => h.retNum != null);
  const best = withRet.length ? withRet.reduce((a, b) => (b.retNum > a.retNum ? b : a)) : null;
  const deepest = rows.filter(h => h.mdd).reduce((a, b) => (!a || numOf(b.mdd) < numOf(a.mdd) ? b : a), null);
  const retCols = [
    { key: 'name', label: 'Account', flex: 1.8, render: h => <View><Tx w={600} s={13} numberOfLines={1}>{h.name}</Tx><Tx s={12} c={C.ink3}>{h.id}</Tx></View> },
    ...RET_KEYS.map(([k, l]) => ({ key: k, label: l, right: true, render: h => { const v = h.tr ? h.tr[k] : null; return <Amt s={13} c={v == null ? C.ink3 : signCol(v)}>{v == null ? '–' : pct(v)}</Amt>; } })),
    { key: 'mdd', label: 'Max drawdown', right: true, flex: 1.1, render: h => <Amt s={13} c={h.mdd ? C.red : C.ink3}>{h.mdd || '–'}</Amt> },
  ];
  return (
    <DataState V={V}>
      <View style={{ gap: 20 }}>
        <Row>
          <Stat label="Total value" value={rows.length ? inr(total) : '–'} note={rows.length + (rows.length === 1 ? ' account' : ' accounts')} style={{ flex: 1.3 }} />
          <Stat label="Strategies" value={String(slices.length)} note={slices.map(s => String(s.name).replace('Qode ', '')).join(', ')} style={{ flex: 1 }} />
          <Stat label="Best return (SI)" value={best ? best.ret : '–'} color={best ? best.retColor : C.ink} note={best ? best.name + ' · ' + best.id : ''} style={{ flex: 1 }} />
          <Stat label="Deepest drawdown" value={deepest ? deepest.mdd : '–'} color={deepest ? C.red : C.ink} note={deepest ? deepest.name + ' · ' + deepest.id : ''} style={{ flex: 1 }} />
        </Row>
        <Row>
          <HoldingsTable V={V} title="Strategy accounts" sub="Value, weight and performance of each account in this view" />
          <Allocation V={V} />
        </Row>
        <Panel title="Returns by account" sub="Trailing returns for each account, as reported" pad={0}>
          <Table cols={retCols} rows={rows} empty="No active strategies in this view." />
        </Panel>
      </View>
    </DataState>
  );
}

// Content pages opened from Account (family, insights, referral, legal…): the page body in the content area,
// with a way back — instead of the phone's full-screen overlay.
function ContentPage({ V }) {
  const wide = DESKTOP_PAGES[V.page];
  const pg = wide || PAGES[V.page];
  if (!pg) return null;
  return (
    <View style={wide ? null : { maxWidth: 920 }}>
      <View accessibilityRole="navigation" aria-label="Breadcrumb" style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <Pressable accessibilityRole="link" onPress={() => { V.closePage(); V.goMore(); }} style={({ hovered }) => ({ flexDirection: 'row', alignItems: 'center', gap: 4, opacity: hovered ? 0.75 : 1 })}>
          <ChevronLeft s={14} c={C.ink2} /><Tx w={600} s={13} c={C.ink2}>Account</Tx>
        </Pressable>
        <Tx s={13} c={C.ink3}>/</Tx>
        <Tx s={13} c={C.ink} aria-current="page">{pg.title}</Tx>
      </View>
      <PageIntro title={pg.title} />
      <View>{pg.body(V)}</View>
    </View>
  );
}

function NotFound({ V, slug, onHome }) {
  return (
    <Card style={{ padding: 40, maxWidth: 620 }}>
      <Label>Error 404</Label>
      <Tx w={600} s={24} role="heading" aria-level={2} style={{ marginTop: 10 }}>We couldn’t find that page</Tx>
      <Tx s={14} c={C.ink2} lh={1.55} style={{ marginTop: 12 }}>There is no page at /app/{slug}. The link may be old or mistyped. Your portfolio is still where you left it.</Tx>
      <View style={{ flexDirection: 'row', gap: 12, marginTop: 24 }}>
        <Btn label="Go to Overview" onPress={onHome} />
        <Btn label="Contact Investor Relations" kind="outline" onPress={() => V.openPage('contact')} />
      </View>
    </Card>
  );
}

export default function DesktopShell({ V }) {
  const page = V.page, reports = page === 'reports';
  const active = reports ? 'reports' : V.tab;
  const [missing, setMissing] = useState(null);
  const title = missing ? 'Page not found' : page && !reports ? ((DESKTOP_PAGES[page] || PAGES[page]) || {}).title || 'myQode' : TITLES[active] || 'myQode';
  useUrlSync(V, active, page, title, setMissing);
  const navd = useRef(false);   // skip the first run: on mount, useUrlSync may just have flagged a 404
  useEffect(() => { if (navd.current) setMissing(null); navd.current = true; }, [active, page]);
  let body;
  if (missing) body = <NotFound V={V} slug={missing} onHome={() => { setMissing(null); V.goHome(); if (typeof history !== 'undefined') history.replaceState(null, '', BASE + '/overview'); }} />;
  else if (reports) body = <DesktopReports V={V} />;
  else if (page) body = <ContentPage V={V} />;
  else if (V.tab === 'home') body = <Overview V={V} />;
  else if (V.tab === 'portfolio') body = <Performance V={V} />;
  else if (V.tab === 'holdings') body = <Holdings V={V} />;
  else if (V.tab === 'docs') body = <DesktopDocuments V={V} />;
  else if (V.tab === 'services') body = V.viewing ? <Overview V={V} /> : <DesktopServices V={V} />;
  else body = <DesktopAccount V={V} />;
  return (
    <View style={{ flex: 1, flexDirection: 'row', backgroundColor: C.cream }}>
      <Sidebar V={V} active={missing ? null : page && !reports ? 'more' : active} onNav={() => setMissing(null)} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <TopBar V={V} title={title} />
        {!!V.viewing && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 32, backgroundColor: C.goldTint, borderBottomWidth: 1, borderColor: C.line }}>
            <Tx w={700} s={12} style={{ flex: 1 }}>Viewing {V.viewing} · read-only</Tx>
            <TextLink label="Back to distributor panel" onPress={V.exitView} />
          </View>
        )}
        <ScrollView key={active + (page || '')} style={{ flex: 1 }} contentContainerStyle={{ padding: 28, paddingBottom: 48 }}>
          <View style={{ maxWidth: 1680, width: '100%' }}>{body}</View>
        </ScrollView>
      </View>
      <RequestSheets V={V} />
      <SwitchSheet V={V} />
      <SettingsSheet V={V} />
      <NotifsSheet V={V} />
    </View>
  );
}

// Signed-out phases on a wide screen (welcome, sign-in, password setup, onboarding): the phone screen sits in a
// panel on the right, next to a brand panel — the desktop sign-in layout of banking / investment portals.
export function DesktopAuthFrame({ children }) {
  const point = (title, body) => (
    <View style={{ flexDirection: 'row', gap: 14, marginTop: 22, maxWidth: 460 }}>
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: C.gold, marginTop: 6 }} />
      <View style={{ flex: 1 }}>
        <Tx w={700} s={15} c={C.cream}>{title}</Tx>
        <Tx s={13} c={C.cream60} lh={1.5} style={{ marginTop: 3 }}>{body}</Tx>
      </View>
    </View>
  );
  return (
    <View style={{ flex: 1, flexDirection: 'row', backgroundColor: '#001008' }}>
      <LinearGradient colors={C.darkGrad} locations={[0, 0.6, 1]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ flex: 1, paddingHorizontal: 64, paddingVertical: 56, justifyContent: 'space-between' }}>
        <View>
          <Wordmark s={40} />
          <View style={{ width: 44, height: 2, backgroundColor: C.gold, marginTop: 16 }} />
        </View>
        <View>
          <Tx f="play" w={600} s={40} c={C.cream} lh={1.2} style={{ maxWidth: 560 }}>Every Qode account your family holds, in one sign-in.</Tx>
          {point('Performance at a glance', 'Portfolio value, returns, drawdown and trailing performance against the benchmark, for every account in your family.')}
          {point('Statements when you need them', 'Transactions, capital gains, expenses and your portfolio fact sheet, each ready to download as a PDF.')}
          {point('Act in a few clicks', 'Top up, set up a SIP, switch strategies or raise a request with our Investor Relations team.')}
        </View>
        <Tx s={11} c={C.cream40}>Qode Advisors LLP · SEBI Registered Portfolio Manager</Tx>
      </LinearGradient>
      <View style={{ width: 520, overflow: 'hidden', boxShadow: '-20px 0 40px rgba(0,0,0,0.25)' }}>{children}</View>
    </View>
  );
}
