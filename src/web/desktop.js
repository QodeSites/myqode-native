// Desktop dashboard for the web build (browser ≥ 1024 px wide). Same view-model V as the phone shell
// (src/main.js → vals()), so every figure, action and dialog is the phone app's; the layout is built for desktop:
// fixed sidebar, top bar with the account switcher, and dashboard grids. Shared pieces: src/web/kit.js.
// Signed-out phases: src/web/auth.js. Sections: reports.js, documents.js, services.js, account.js.
import React, { useState, useEffect, useRef } from 'react';
import { View, ScrollView, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Wordmark } from '../ui';
import { ClosedNote } from '../screens/tabs';
import { Refresh, Bell, ChevronDown, ChevronLeft, ChevronRight, FamilyIcon, GroupIcon, Bars, Plus, Swap } from '../icons';
import { NavChart, DrawdownChart, Donut, GUTTER } from '../screens/charts';
import { RequestSheets } from '../screens/services';
import { PAGES } from '../screens/pages';
import { DESKTOP_PAGES } from './pages';
import { SwitchSheet, SettingsSheet, NotifsSheet } from '../screens/sheets';
import { UccNotice } from '../screens/ucc';
import { ddPct, pct, inr } from '../adapt';
import { C, Tx, Amt, Card, Row, Grid, Panel, Stat, DarkCard, Label, TextLink, Table, Loading, Btn, PageIntro, Chips, Tabs, Delta, BarList, KeyVals, sentence, FitAmt, AppLinks } from './kit';
// NuvamaDetails now lives only on the Login To Nuvama page (src/web/pages.js), not on Overview
import DesktopHoldings from './holdings';
import DesktopReports from './reports';
import DesktopDocuments from './documents';
import DesktopServices from './services';
import DesktopAccount from './account';
import { PAGE_ALIASES, navItem, openItem } from '../nav';
import { WEB_NAV, NavIcon, webNavFor } from './webNav';
import { dayLabel } from '../screens/pay';

// Tabs of state.tab and their web titles and addresses. Pages (PAGES / DESKTOP_PAGES keys) use their own key as the
// address. The sidebar menu is WEB_NAV in src/web/webNav.js (the phone's More tab keeps NAV_GROUPS in src/nav.js).
const TITLES = { home: 'Overview', portfolio: 'Performance', holdings: 'Holdings', reports: 'Reports', docs: 'Investor Document Vault', services: 'Account Services', more: 'Profile and Settings' };

// Clean URLs for the web: /app/overview, /app/performance, /app/family … Each section and page has its own address,
// so a link, a refresh or the browser's Back button lands where the client expects.
const SLUGS = { home: 'overview', portfolio: 'performance', holdings: 'holdings', reports: 'reports', docs: 'documents', services: 'services', more: 'account' };
const TAB_GO = { home: V => V.goHome(), portfolio: V => V.goPortfolio(), holdings: V => V.segHold(), docs: V => V.goDocs(), services: V => V.goServices(), more: V => V.goMore() };
const BASE = '/app';
const pathFor = (tab, page) => BASE + '/' + (page || SLUGS[tab] || 'overview');
const slugOf = () => (typeof location === 'undefined' ? '' : location.pathname.replace(/^\/app\/?/, '').replace(/\/+$/, ''));
// Point the app at a slug. Returns the canonical slug it opened (an old alias such as "contact" opens "team"), or
// false when the slug is unknown (404).
function openSlug(V, slug) {
  if (!slug) { V.goHome(); return 'overview'; }
  slug = PAGE_ALIASES[slug] || slug;
  const tab = Object.keys(SLUGS).find(k => SLUGS[k] === slug && TAB_GO[k]);
  if (tab) { if (V.page) V.closePage(); TAB_GO[tab](V); return slug; }
  if (DESKTOP_PAGES[slug] || PAGES[slug]) { V.openPage(slug); return slug; }
  return false;
}

function useUrlSync(V, active, page, title, setMissing) {
  const pending = useRef(null), miss = useRef(false);
  const web = typeof window !== 'undefined' && typeof history !== 'undefined';
  useEffect(() => {
    if (!web) return undefined;
    // An alias keeps working but the address bar shows the page's own address, without a history entry.
    const land = slug => { const canon = openSlug(V, slug); if (canon && slug && canon !== slug) history.replaceState(null, '', BASE + '/' + canon); return canon; };
    let slug = slugOf();
    // A partner-panel address (/app/d/…) is not an investor page: open the Overview rather than a 404.
    if (slug === 'd' || slug.startsWith('d/')) { history.replaceState(null, '', BASE); slug = ''; }
    const canon = slug ? land(slug) : null;
    if (slug && !canon) { miss.current = true; setMissing(slug); }
    else if (slug) pending.current = BASE + '/' + canon;
    const onPop = () => { setMissing(null); if (!land(slugOf())) setMissing(slugOf()); };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
  useEffect(() => {
    if (!web) return;
    if (miss.current) { miss.current = false; return; }   // keep the unknown address in the bar on a 404
    const want = pathFor(active === 'reports' ? 'reports' : V.tab, page);
    if (pending.current) { if (want !== pending.current) return; pending.current = null; }
    if (location.pathname !== want && !/^\/app\/?$/.test(location.pathname)) history.pushState(null, '', want);
    else if (location.pathname !== want) history.replaceState(null, '', want);
  }, [active, page]);
  useEffect(() => { if (typeof document !== 'undefined') document.title = title + ' | myQode'; }, [title]);
}

/* ── frame ──────────────────────────────────────────────────────────────────────────────────────────────── */
const initials = n => String(n || '').replace(/^(mr|mrs|ms|dr)\.?\s+/i, '').split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();
const CREAM = a => 'rgba(239,236,211,' + a + ')';

// The sidebar: three labelled sections, one icon per item, nothing collapsible (src/web/webNav.js). Pages that aren't
// listed open from the About Qode / Support hubs or Profile, and keep that item highlighted. Profile and settings
// also sit behind the user card at the bottom.
function Sidebar({ V, activeId, onNav }) {
  const name = (V.user && V.user.name) || '';
  const cur = webNavFor(activeId);
  const pick = it => {
    onNav();
    if (it.tab === 'more') { if (V.page) V.closePage(); V.goMore(); return; }
    openItem(V, it);
  };
  const acctOn = activeId === 'account';
  return (
    <LinearGradient colors={['#02422B', '#002017', '#000000']} locations={[0, 0.6, 1]} start={{ x: 0, y: 0 }} end={{ x: 0.4, y: 1 }} style={{ width: 264, paddingTop: 22, paddingBottom: 16 }}>
      <View style={{ paddingHorizontal: 22, flexDirection: 'row', alignItems: 'baseline', gap: 10 }}>
        <Wordmark s={28} c={C.cream} />
      </View>
      <Tx s={11.5} c={CREAM(0.55)} style={{ paddingHorizontal: 22, marginTop: 2 }}>Qode Advisors LLP · PMS</Tx>
      <View style={{ width: 34, height: 2, backgroundColor: C.gold, marginTop: 12, marginLeft: 22 }} />
      <ScrollView style={{ flex: 1, marginTop: 10 }} contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 12 }}>
        {WEB_NAV.map(sec => (
          <View key={sec.title} accessibilityRole="navigation" aria-label={sec.title} style={{ marginTop: 18 }}>
            <Tx w={700} s={11} ls={0.14} c={CREAM(0.45)} style={{ paddingHorizontal: 12, marginBottom: 6 }}>{sec.title.toUpperCase()}</Tx>
            {sec.items.filter(it => !(V.viewing && it.id === 'support')).map(it => {
              const on = !!cur && cur.id === it.id;
              return (
                <Pressable key={it.id} accessibilityRole="link" accessibilityState={{ selected: on }} onPress={() => pick(it)} style={({ hovered }) => ({
                  flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 42, paddingHorizontal: 12, borderRadius: 10, marginTop: 2,
                  backgroundColor: on ? 'rgba(218,189,56,0.13)' : hovered ? CREAM(0.06) : 'transparent',
                  borderLeftWidth: 3, borderLeftColor: on ? C.gold : 'transparent',
                })}>
                  <NavIcon name={it.icon} s={19} c={on ? C.gold : CREAM(0.72)} />
                  <Tx w={on ? 600 : 500} s={14.5} c={on ? C.gold : CREAM(0.88)} style={{ flex: 1 }} numberOfLines={1}>{it.label}</Tx>
                </Pressable>
              );
            })}
          </View>
        ))}
      </ScrollView>
      {V.testMode && (
        <View style={{ marginHorizontal: 22, marginBottom: 12, backgroundColor: C.redTint, borderRadius: 6, paddingVertical: 5, alignItems: 'center' }}>
          <Tx w={600} s={11.5} c={C.red}>Test mode</Tx>
        </View>
      )}
      <AppLinks dark compact style={{ marginHorizontal: 22, marginBottom: 14 }} />
      <View style={{ marginHorizontal: 12, borderTopWidth: 1, borderColor: CREAM(0.12), paddingTop: 10 }}>
        <Pressable accessibilityRole="link" accessibilityLabel="Profile and settings" accessibilityState={{ selected: acctOn }}
          onPress={() => { onNav(); if (V.page) V.closePage(); V.goMore(); }} style={({ hovered }) => ({
            flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, paddingHorizontal: 10, borderRadius: 8,
            backgroundColor: acctOn ? 'rgba(218,189,56,0.14)' : hovered ? CREAM(0.06) : 'transparent',
          })}>
          <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(218,189,56,0.16)', alignItems: 'center', justifyContent: 'center' }}>
            <Tx w={600} s={12} c={C.gold}>{initials(name) || 'Q'}</Tx>
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            {!!name && <Tx w={600} s={13} c={acctOn ? C.gold : C.cream} numberOfLines={1}>{name}</Tx>}
            <Tx s={12} c={acctOn ? C.gold : CREAM(0.6)}>Profile and settings</Tx>
          </View>
          <ChevronRight s={11} c={acctOn ? C.gold : CREAM(0.5)} />
        </Pressable>
        {/* Sign out (a partner viewing an investor leaves the view instead, from the banner) */}
        {!V.viewing && (
          <Pressable accessibilityRole="button" onPress={V.doLogout} style={({ hovered }) => ({
            flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8,
            backgroundColor: hovered ? CREAM(0.06) : 'transparent',
          })}>
            <NavIcon name="signout" s={17} c={CREAM(0.65)} />
            <Tx w={500} s={13} c={CREAM(0.75)}>Sign out</Tx>
          </Pressable>
        )}
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
        {/* whose figures these are, quietly under the title (portfolio pages): "Name · 4 accounts · Data as of …" */}
        {(!V.page || ['reports', 'transactions'].includes(V.page)) && (!!V.asOf || !!V.acctName) && (
          <Tx s={12} c={C.ink3} numberOfLines={1}>
            {!!V.acctName && <Tx w={600} s={12} c={C.ink2}>{V.acctName}</Tx>}
            {!!V.acctName && !!V.acctCode && '  ·  ' + V.acctCode}
            {!!V.asOf && (V.acctName ? '  ·  ' : '') + 'Data as of ' + V.asOf}
          </Tx>
        )}
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
// "Showing …" on every portfolio page: whose figures these are (Entire Family / a person / one strategy account),
// with Change. The account switcher in the top bar does the same, but is easy to miss.
function AccountContext({ V }) {
  if (!V.acctName) return null;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 18, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10, backgroundColor: C.greenTint, borderWidth: 1, borderColor: C.line }}>
      <View style={{ width: 28, height: 28, borderRadius: 7, backgroundColor: C.green, alignItems: 'center', justifyContent: 'center' }}>
        {V.isFamily ? <FamilyIcon s={14} c={C.gold} /> : <Tx w={600} s={10.5} c={C.gold}>{V.acctInitials}</Tx>}
      </View>
      <Tx s={13.5} c={C.ink2}>Showing <Tx w={700} s={13.5} c={C.ink}>{V.acctName}</Tx>{V.acctCode ? <Tx s={13.5} c={C.ink3}>{'  ·  ' + V.acctCode}</Tx> : null}</Tx>
      {V.multiAcct && <TextLink label="Change" onPress={V.openSwitch} />}
    </View>
  );
}

// Dashboard headline: what an investor checks first. Current value, what they put in (gross, net under it when
// anything was withdrawn or deducted), total returns and CAGR. TWRR / IRR / 1-year live on Performance.
function Summary({ V }) {
  const Div = () => <View style={{ width: 1, alignSelf: 'stretch', backgroundColor: 'rgba(239,236,211,0.14)' }} />;
  const cell = (label, value, color, note) => (
    <View style={{ flex: 1, paddingHorizontal: 22, justifyContent: 'center' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}><Label c="rgba(239,236,211,0.75)">{label}</Label><InfoTip label={label} dark /></View>
      <FitAmt w={700} s={25} min={15} c={onDark(color)} style={{ marginTop: 8, letterSpacing: -0.4 }}>{value}</FitAmt>
      {!!note && <Tx s={12} c="rgba(239,236,211,0.6)" style={{ marginTop: 4 }}>{note}</Tx>}
    </View>
  );
  const ret = V.tiles[0] || {}, si = V.tiles[1] || {};
  const cagr = (V.keyMetrics || []).find(k => k.label === 'CAGR');
  const inv = V.invested || {};
  return (
    <DarkCard style={{ flexDirection: 'row', flexWrap: 'wrap', paddingVertical: 24, paddingHorizontal: 0 }}>
      <View style={{ flex: 1.4, minWidth: 260, paddingHorizontal: 24, justifyContent: 'center' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}><Label c={C.gold}>Current value</Label><InfoTip label="Current value" dark /></View>
        <FitAmt w={700} s={38} min={20} c={C.cream} style={{ marginTop: 6, letterSpacing: -0.8 }}>{V.heroValue}</FitAmt>
        <View style={{ width: 34, height: 2, backgroundColor: C.gold, marginTop: 10 }} />
        {!!V.sinceLbl && <Tx s={12} c="rgba(239,236,211,0.6)" style={{ marginTop: 8, whiteSpace: 'nowrap' }}>{V.sinceLbl}</Tx>}
      </View>
      <Div />
      {cell('Invested', inv.gross || '–', undefined, inv.note)}
      <Div />
      {cell('Total returns', ret.value, ret.color, si.value && si.value !== '–' ? si.value + ' since inception' : null)}
      <Div />
      {cagr && cagr.value !== '–' ? cell('CAGR', cagr.value, cagr.color, 'Since inception') : cell('Return since inception', si.value, si.color, 'Shown as CAGR after a year')}
    </DarkCard>
  );
}

function NavPanel({ V, height = 250, style }) {
  return (
    <Panel title="NAV performance" sub={'Growth of your portfolio' + (V.hasBench ? ' against ' + V.benchName : '') + ', rebased to 100'} style={style}
      right={<Chips value={(V.ranges.find(r => r.active) || {}).label} options={V.ranges.map(r => [r.label, r.label, r.disabled])} onChange={l => { const r = V.ranges.find(x => x.label === l); if (r) r.pick(); }} />}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 18, marginBottom: 10 }}>
        <View><Tx s={11.5} w={600} c={C.ink3}>Current NAV</Tx><Amt w={600} s={20}>{V.navNow}</Amt></View>
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
        <BarList style={{ flex: 1 }} dp={2} items={slices.map(g => ({ key: g.id, label: String(g.name), sub: g.n > 1 ? g.n + ' accounts' : '', pct: g.w, color: g.color }))} />
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
  const pending = V.inFlight || [];
  const list = (V.txRecent || V.txAll).slice(0, Math.max(0, n - pending.length));   // small movements left out (vals)
  return (
    <Panel title="Recent activity" right={<TextLink label="View all" onPress={V.goServicesTx} />} pad={0} style={[{ flex: 1 }, style]}>
      {pending.map(it => (
        <View key={it.orderId} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11, paddingHorizontal: 20, borderTopWidth: 1, borderColor: C.line, backgroundColor: 'rgba(218,189,56,0.08)' }}>
          <View style={{ width: 30, height: 30, borderRadius: 8, backgroundColor: C.posTint, alignItems: 'center', justifyContent: 'center' }}>
            <Tx w={600} s={14} c={C.pos}>↓</Tx>
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Tx w={600} s={13} numberOfLines={1}>Money received · Pending</Tx>
            <Tx s={12} c={C.ink3} numberOfLines={1}>Invested {dayLabel(it.deployOn)} · in your portfolio {dayLabel(it.visibleOn)}</Tx>
          </View>
          <Amt s={13.5} c={C.pos}>+{inr(it.amount, 0)}</Amt>
        </View>
      ))}
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

// Sits full width directly under the NAV chart, over the same range: the plot is indented by the NAV chart's
// y-label column (GUTTER) so both start at the same left edge, and it repeats the NAV chart's dates.
function DrawdownPanel({ V, height = 170, style }) {
  if (!V.hasDd) return null;
  const g = V.yTicks && V.yTicks.length ? GUTTER : 0;
  return (
    <Panel title="Drawdown" sub={'Fall from the previous peak, ' + V.rangePhrase + (V.hasBench ? '. Dashed: ' + V.benchName : '')} style={style}
      right={<View style={{ alignItems: 'flex-end' }}><Amt w={600} s={18} c={Math.abs(V.ddNow) >= 0.005 ? C.red : C.ink2}>{ddPct(V.ddNow)}</Amt><Tx s={11.5} c={C.ink3}>current</Tx></View>}>
      <View style={{ paddingLeft: g }}>
        <DrawdownChart line={V.ddLine} area={V.ddArea} bench={V.ddBench} tip={V.ddTip} height={height} />
        {!!g && <Tx s={9} c={C.gray} style={{ position: 'absolute', left: 0, width: g - 3, top: Math.max(0, (8 / 100) * height - 6), pointerEvents: 'none' }}>0%</Tx>}
      </View>
      {!!(V.xDates && V.xDates.length) && (
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4, paddingLeft: g }}>
          {V.xDates.map((d, i) => <Tx key={i} s={9} c={C.gray}>{d}</Tx>)}
        </View>
      )}
    </Panel>
  );
}

// Profit and loss as a bar chart of period returns, with the year's figures beside it.
function PnlBars({ rows, height = 150, useAmt }) {
  // Bars follow the % return; a real 0.00% is zero, not missing (falling back to the rupee amount put a ₹-scale bar
  // among %-scale ones: a −₹404 month at 0.00% towered over −6.28%). The amount is used only when there's no %.
  const hasPct = r => r.p != null && String(r.p).trim() !== '' && String(r.p).trim() !== '–';
  const vals = rows.map(r => (useAmt ? numOf(r.v) : hasPct(r) ? numOf(r.p) : numOf(r.v)));
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
// Data source for an account with Orbis history (as on the phone): Nuvama · Orbis (Legacy) · Orbis + Nuvama. It
// switches every figure built from the history (returns, NAV, drawdown, P&L, cash flows); holdings stay Nuvama's.
function DataSource({ V }) {
  if (!V.hasViews) return null;
  const on = V.viewChips.find(c => c.active) || V.viewChips[0];
  return (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <Tx w={600} s={13} c={C.ink2}>Data source</Tx>
        <Chips value={on.label} options={V.viewChips.map(c => [c.label, c.label])} onChange={l => { const c = V.viewChips.find(x => x.label === l); if (c) c.pick(); }} />
      </View>
      {V.orbisNote && <Tx s={12.5} c={C.ink3} lh={1.5}>Orbis data: figures run to the last day before Nuvama took over. Money in and out comes from the capital recorded by Orbis; returns are measured from the Orbis starting NAV of 100.</Tx>}
    </View>
  );
}

function Overview({ V }) {
  return (
    <DataState V={V}>
      <View style={{ gap: 20 }}>
        {!V.viewing && <UccNotice visible={V.showUcc} onClose={V.dismissUcc} />}
        <ClosedNote text={V.closedNote} />
        <DataSource V={V} />
        <Summary V={V} />
        <NavPanel V={V} height={300} />
        <Row><Allocation V={V} /><RecentTx V={V} /></Row>
        <HoldingsTable V={V} right={<TextLink label="All holdings" onPress={V.segHold} />} />
        <View style={{ alignItems: 'flex-start' }}><TextLink label="See detailed performance" onPress={V.goPortfolio} /></View>
      </View>
    </DataState>
  );
}

// Performance: one headline band (return since inception, against the benchmark), then Return and Risk side by side,
// trailing returns with TWRR/IRR and the capital figures, and the P&L. Each figure appears once.
// ⓘ beside a metric's name: a one-line explanation in plain words, on hover (or tap). Looked up by the label.
const METRIC_HELP = {
  'current value': 'What your portfolio is worth today, from the custodian’s latest data.',
  'invested': 'The money you put in (top-ups and securities transferred in). Net is after withdrawals and tax deducted.',
  'net invested': 'Money put in, less withdrawals and tax deducted.',
  'total returns': 'Your gain or loss in rupees: current value minus net invested.',
  'cagr': 'Average yearly growth since inception, as if it had compounded at a steady rate.',
  'cagr since inception': 'Average yearly growth since inception, as if it had compounded at a steady rate.',
  'return since inception': 'Total growth of the portfolio since you started, not annualised.',
  '1-year return': 'How much the portfolio grew over the last 12 months.',
  '1 year return': 'How much the portfolio grew over the last 12 months.',
  'xirr': 'Your own yearly return, taking into account when you added or withdrew money.',
  'best month': 'The calendar month with the highest return.',
  'volatility (ann.)': 'How much returns swing up and down in a year. Higher means a bumpier ride.',
  'sharpe ratio': 'Return earned for each unit of risk, above a 6.5% risk-free rate. Higher is better.',
  'beta': 'How much the portfolio moves with its benchmark: 1 moves the same, below 1 moves less.',
  'max drawdown': 'The largest fall from a peak to a low since inception.',
  'current drawdown': 'How far the portfolio is below its highest value right now.',
  'total contributions': 'All the money you put in: top-ups and securities transferred in.',
  'total withdrawals': 'All the money taken out.',
  'tax deducted & small adjustments': 'Tax deducted at source on interest income, and other small debits under ₹1,000.',
};
const helpFor = label => METRIC_HELP[String(label || '').toLowerCase()] || (/^alpha/i.test(String(label)) ? 'How much more (or less) the portfolio earned per year than its benchmark index.' : null);
function InfoTip({ label, dark }) {
  const text = helpFor(label);
  const [open, setOpen] = useState(false);
  if (!text) return null;
  const c = dark ? 'rgba(239,236,211,0.55)' : C.ink3;
  return (
    <View style={{ position: 'relative', zIndex: open ? 50 : 1 }}>
      <Pressable accessibilityRole="button" accessibilityLabel={'What ' + label + ' means'} onPress={() => setOpen(o => !o)} onHoverIn={() => setOpen(true)} onHoverOut={() => setOpen(false)}
        style={{ width: 15, height: 15, borderRadius: 8, borderWidth: 1, borderColor: c, alignItems: 'center', justifyContent: 'center', marginLeft: 6 }}>
        <Tx w={700} s={9.5} c={c} style={{ lineHeight: 11 }}>i</Tx>
      </Pressable>
      {open && (
        <View pointerEvents="none" style={{ position: 'absolute', top: 20, left: -8, width: 240, padding: 10, borderRadius: 8, backgroundColor: '#0E1A15', zIndex: 50,
          shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } }}>
          <Tx s={12} lh={1.5} c="#EFECD3">{text}</Tx>
        </View>
      )}
    </View>
  );
}
const LabelInfo = ({ children, dark, style, w = 600, s = 14, c }) => (
  <View style={[{ flexDirection: 'row', alignItems: 'center' }, style]}>
    <Tx w={w} s={s} c={c}>{children}</Tx><InfoTip label={children} dark={dark} />
  </View>
);

const ON_DARK = col => (col === C.red ? '#FF8F80' : col === C.pos ? '#8BD9AA' : C.cream);
function MetricRow({ label, note, value, color, last }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, paddingVertical: 13, borderBottomWidth: last ? 0 : 1, borderColor: C.line }}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <LabelInfo>{label}</LabelInfo>
        {!!note && <Tx s={12} c={C.ink3} style={{ marginTop: 2 }} numberOfLines={1}>{note}</Tx>}
      </View>
      <Amt w={600} s={20} c={color || C.ink}>{value}</Amt>
    </View>
  );
}
function Performance({ V }) {
  const head = Object.fromEntries((V.perfHead || []).map(([k, v, col]) => [k, { v, col }]));
  const si = head['RETURN (SI)'] || {}, y1 = head['1Y RETURN'] || {}, curDd = head['CURRENT DD'] || {}, ex = head['EXCESS (SI)'] || {};
  const km = Object.fromEntries((V.keyMetrics || []).map(k => [k.label, k]));
  const alpha = (V.keyMetrics || []).find(k => /^Alpha/.test(k.label));
  const f = V.flows || [], inv = V.invested || {}, ret = V.tiles[0] || {};
  const RETURN = [km['CAGR'], km['XIRR'], alpha, km['Best month']].filter(Boolean);
  const RISK = [km['Volatility (ann.)'], km['Sharpe ratio'], km['Beta'], km['Max drawdown']].filter(Boolean);
  const cagr = km['CAGR'] && km['CAGR'].value !== '–' ? km['CAGR'] : null;
  const side = (label, value, col, note) => (
    <View style={{ flex: 1, minWidth: 140, paddingHorizontal: 22, borderLeftWidth: 1, borderColor: 'rgba(239,236,211,0.14)' }}>
      <LabelInfo dark w={400} s={12} c="rgba(239,236,211,0.6)">{label}</LabelInfo>
      <Amt w={600} s={24} c={ON_DARK(col)} style={{ marginTop: 6 }}>{value || '–'}</Amt>
      {!!note && <Tx s={11.5} c="rgba(239,236,211,0.5)" style={{ marginTop: 3 }}>{note}</Tx>}
    </View>
  );
  return (
    <DataState V={V}>
      <View style={{ gap: 20 }}>
        <DataSource V={V} />
        <DarkCard style={{ paddingVertical: 28, paddingHorizontal: 32, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 24 }}>
          <View style={{ flex: 1.2, minWidth: 240 }}>
            <LabelInfo dark s={12.5} c={C.gold}>{cagr ? 'CAGR since inception' : 'Return since inception'}</LabelInfo>
            <Amt w={700} s={46} c={ON_DARK(cagr ? cagr.color : si.col)} style={{ marginTop: 6 }}>{cagr ? cagr.value : si.v || '–'}</Amt>
            <Tx s={13} c="rgba(239,236,211,0.7)" style={{ marginTop: 6 }}>{alpha && alpha.value !== '–' ? `${alpha.label} ${alpha.value}` : ex.v ? `${ex.v} against ${V.benchName}` : `Against ${V.benchName}`}</Tx>
          </View>
          <View style={{ flex: 1.8, minWidth: 420, flexDirection: 'row' }}>
            {side('Invested', inv.gross, undefined, inv.note)}
            {side('Total returns', ret.value, ret.color)}
            {side('1-year return', y1.v, y1.col)}
          </View>
        </DarkCard>
        {/* Your capital as one strip across the page, then trailing returns full width */}
        {f.length > 0 && (
          <Panel title="Your capital" pad={0}>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', borderTopWidth: 1, borderColor: C.line }}>
              {f.map((x, i) => (
                <View key={x.label} style={{ flex: 1, minWidth: 180, paddingVertical: 16, paddingHorizontal: 20, borderLeftWidth: i ? 1 : 0, borderColor: C.line }}>
                  <LabelInfo w={400} s={12} c={C.ink3}>{String(x.label).charAt(0) + String(x.label).slice(1).toLowerCase()}</LabelInfo>
                  <FitAmt w={600} s={18} min={13} c={x.color === C.ink ? C.ink : x.color} style={{ marginTop: 6 }}>{x.value}</FitAmt>
                </View>
              ))}
            </View>
          </Panel>
        )}
        {/* detailed metrics: always shown (decided 6 Oct 2026) */}
        {(
          <View style={{ gap: 20 }}>
            {(RETURN.length > 0 || RISK.length > 0) && (
              <Row gap={20}>
                <Panel title="Return" sub="Since inception" style={{ flex: 1 }}>
                  {RETURN.map((k, i) => <MetricRow key={k.label} label={k.label} note={k.note} value={k.value} color={k.color} last={i === RETURN.length - 1} />)}
                </Panel>
                <Panel title="Risk" sub="Sharpe uses a 6.5% risk-free rate" style={{ flex: 1 }}>
                  {RISK.map(k => <MetricRow key={k.label} label={k.label} note={k.note} value={k.value} color={k.color} />)}
                  <MetricRow label="Current drawdown" note="From the last peak" value={curDd.v || '–'} color={curDd.col} last />
                </Panel>
              </Row>
            )}
            {!!(V.irrRows && V.irrRows.length) && (
              <Panel title="TWRR and IRR" sub="Two ways to measure the same portfolio">
                <KeyVals items={[['Return since inception (TWRR)', si.v, si.col], ...V.irrRows.map(r => [r.period === 'SI' ? 'IRR since inception' : r.period + ' ' + r.label, r.value, r.color])]} />
                <Tx s={12} c={C.ink3} lh={1.5} style={{ marginTop: 12 }}>IRR (since inception) is money-weighted and shows the return on your capital, taking into account the timing of your investments and withdrawals. TWRR measures how the strategy performed, regardless of those cash flows.</Tx>
              </Panel>
            )}
          </View>
        )}
        <TrailingPanel V={V} />
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
          <Stat label="Strategies" value={String(slices.length)} note={slices.map(s => String(s.name)).join(', ')} style={{ flex: 1 }} />
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

// Content pages opened from the sidebar (family, insights, referral, legal…): the page body in the content area,
// under a breadcrumb naming its menu group (pages outside the groups lead back to Profile and settings).
function ContentPage({ V }) {
  const wide = DESKTOP_PAGES[V.page];
  const pg = wide || PAGES[V.page];
  if (!pg) return null;
  const it = navItem(V.page), hub = webNavFor(V.page);
  const g = hub && hub.id !== V.page ? hub : null;   // the hub this page sits under (About Qode, Support, Profile)
  const toHub = () => (g.tab === 'more' ? (V.closePage(), V.goMore()) : V.openPage(g.page));
  return (
    <View style={wide ? null : { maxWidth: 920 }}>
      {!(hub && hub.id === V.page) && <View accessibilityRole="navigation" aria-label="Breadcrumb" style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        {g ? (
          <Pressable accessibilityRole="link" onPress={toHub} style={({ hovered }) => ({ flexDirection: 'row', alignItems: 'center', gap: 4, opacity: hovered ? 0.75 : 1 })}>
            <ChevronLeft s={14} c={C.ink2} /><Tx w={600} s={13} c={C.ink2}>{g.label}</Tx>
          </Pressable>
        ) : hub ? null : (
          <Pressable accessibilityRole="link" onPress={() => { V.closePage(); V.goMore(); }} style={({ hovered }) => ({ flexDirection: 'row', alignItems: 'center', gap: 4, opacity: hovered ? 0.75 : 1 })}>
            <ChevronLeft s={14} c={C.ink2} /><Tx w={600} s={13} c={C.ink2}>Profile and settings</Tx>
          </Pressable>
        )}
        {!(hub && !g) && <Tx s={13} c={C.ink3}>/</Tx>}
        <Tx s={13} c={C.ink} aria-current="page">{it ? it.label : pg.title}</Tx>
      </View>}
      {!wide && <PageIntro title={pg.title} />}
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
        <Btn label="Contact Investor Relations" kind="outline" onPress={() => V.openPage('team')} />
      </View>
    </Card>
  );
}

export default function DesktopShell({ V }) {
  const page = V.page, reports = page === 'reports' || (!page && V.tab === 'reports');
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
  else if (V.tab === 'holdings') body = <DataState V={V}><DesktopHoldings V={V} /></DataState>;   // securities; strategy accounts are a section inside
  else if (V.tab === 'docs') body = <DesktopDocuments V={V} />;
  else if (V.tab === 'services') body = V.viewing ? <Overview V={V} /> : <DesktopServices V={V} />;
  else body = <DesktopAccount V={V} />;
  return (
    <View style={{ flex: 1, flexDirection: 'row', backgroundColor: C.cream }}>
      <Sidebar V={V} activeId={missing ? null : page || (active === 'more' ? 'account' : active)} onNav={() => setMissing(null)} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <TopBar V={V} title={title} />
        {!!V.viewing && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 32, backgroundColor: C.goldTint, borderBottomWidth: 1, borderColor: C.line }}>
            <Tx w={700} s={12} style={{ flex: 1 }}>Viewing {V.viewing} · read-only</Tx>
            <TextLink label="Back to partner panel" onPress={V.exitView} />
          </View>
        )}
        <ScrollView key={active + (page || '')} style={{ flex: 1 }} contentContainerStyle={{ padding: 28, paddingBottom: 48 }}>
          <View style={{ maxWidth: 1680, width: '100%' }}>
            {body}
          </View>
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
          <Tx f="play" w={600} s={40} c={C.cream} lh={1.2} style={{ maxWidth: 560 }}>All your Qode accounts, in one sign{'‑'}in</Tx>
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
