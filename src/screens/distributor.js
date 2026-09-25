// Partner (distributor) app: shown instead of the investor tabs when the signed-in login is a distributor.
// Web logic first — a port of the web's partner portal (myQode/app/(protected)/distributors/*):
//   Overview   = distributors/page.tsx      (money brought in, strategy split, where investors are,
//                                             onboarding journey, recently funded)
//   Investors  = distributors/investors      (searchable list; detail hides lastConversation, as the web does)
//   Links      = distributors/referrals      (onboarding links for individuals / non-individuals)
// Status wording is lib/distributorVocabulary.ts verbatim (Zoho's own values + a one-line meaning).
// Data: /api/mobile/distributor/{journey,strategy-aum}, which re-check the distributor role server-side.
import React, { useState, useMemo, useEffect } from 'react';
import { View, Pressable, ScrollView, TextInput, Share, Linking, RefreshControl, BackHandler, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import { C, Tx, Amt, Card, CTA, Fade, GoldThreads, CurveCap, KeyboardScroll } from '../ui';
import { ChevronDown, ChevronRight, Refresh, TabHome, TabPortfolio, TabServices, TabDocs, TabMore, Phone, MailIcon } from '../icons';
import { distributor as api } from '../api';
import { useLoad, SectionLabel, Loading, ErrorBox } from './kit';
import { InvestorDetail, Fees, Statement, Invoice, Decks, Indicators, Ticket, Policies, BackRow } from './partner';

// ── Vocabulary: port of myQode/lib/distributorVocabulary.ts ──────────────────
const S = {
  invested:    { key: 'invested', label: 'First Fund Initiated', short: 'First fund initiated', detail: 'Money is in the market', tone: 'good' },
  regular:     { key: 'regular', label: 'Regular Investor', short: 'Regular investor', detail: 'Invested again after their first', tone: 'good' },
  smallfunded: { key: 'smallfunded', label: 'Funded Less than 50 lacs', short: 'Below ₹50 L', detail: 'Money is in the market, below the usual ticket', tone: 'good' },
  opened:      { key: 'opened', label: 'Account Live', short: 'Account live', detail: 'Account open — nothing invested yet', tone: 'normal' },
  onboarding:  { key: 'onboarding', label: 'Onboarding', short: 'Onboarding', detail: 'Account opening in progress', tone: 'normal' },
  inactive:    { key: 'inactive', label: 'Dormant Investor', short: 'Dormant', detail: 'Account open, nothing moving', tone: 'warn' },
  declined:    { key: 'declined', label: 'Dropped before account opening', short: 'Dropped', detail: 'Never opened an account', tone: 'warn' },
  closed:      { key: 'closed', label: 'Dropped after account opening', short: 'Exited', detail: 'Opened, then exited', tone: 'warn' },
};
const STATUS_ORDER = [S.invested, S.regular, S.smallfunded, S.opened, S.onboarding, S.inactive, S.declined, S.closed];
const ONBOARDING_SEQUENCE = ['Investor added', 'Onboarding Email Sent', 'Documents Received', 'Forms Filled', 'Consent Received',
  'Form Sent to Investor for Signature', 'Forms Received from Investor', 'Esign Received', 'Forms Sent to Nuvama', 'CML Pending', 'Observations'];
const isStalled = s => /dropped|lost/i.test(s || '');
// The sub-stage decides (Investor_Stage goes stale behind it); Investor_Stage is the fallback.
function statusFor(stage, sub) {
  if (sub) {
    if (isStalled(sub)) return /lost/i.test(sub) ? S.closed : S.declined;
    if (sub === 'First Fund Initiated') return S.invested;
    if (sub === 'Regular Investor') return S.regular;
    if (sub === 'Funded less than 50L') return S.smallfunded;
    if (sub === 'Account Live') return S.opened;
    if (sub === 'Dormant Investor') return S.inactive;
    if (ONBOARDING_SEQUENCE.includes(sub)) return S.onboarding;
  }
  switch (stage) {
    case 'First Fund Initiated': return S.invested;
    case 'Regular Investor': return S.regular;
    case 'Account Live': return S.opened;
    case 'Dormant Investor': return S.inactive;
    case 'Dropped before account opening': return S.declined;
    case 'Dropped after account opening': return S.closed;
    default: return S.onboarding;
  }
}
// Activation_Date first; Date_Of_1st_Investment only for "Funded less than 50L" (web: fundedDate()).
const fundedDate = c => c.activationDate || (c.onboardingStage === 'Funded less than 50L' ? c.accountLiveDate : null);
const STRATEGY_COLOR = { 'Qode All Weather': '#008455', 'Qode Growth Fund': '#0A3452', 'Qode Tactical Fund': '#550E0E' };
const TONE = { good: C.pos, normal: C.gold, warn: C.red };
const shortStrategy = n => String(n || '').replace(/^Qode\s+/, '').replace(/\s+Fund$/, '');

// Number and date formats are the web's own (distributors/page.tsx money() / formatDate()), so every figure reads
// the same on both: crores always 2 decimals, lakhs 1 decimal, below a lakh whole rupees.
const inr = n => {
  if (n == null || isNaN(n)) return '—';
  const abs = Math.abs(n), sign = n < 0 ? '−' : '';
  if (abs >= 10000000) return `${sign}₹${(abs / 10000000).toFixed(2)} Cr`;
  if (abs >= 100000) return `${sign}₹${(abs / 100000).toFixed(1)} L`;
  return `${sign}₹${abs.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
};
// Exact amount, to the paisa, shown under a rounded headline so nothing is hidden by rounding.
const exact = n => (n == null || isNaN(n) ? '' : '₹' + Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
const INFLOW_RANGES = [
  { key: 'all', label: 'Since inception', months: null },
  { key: '12m', label: 'Last 12 months', months: 12 },
  { key: '6m', label: 'Last 6 months', months: 6 },
  { key: '3m', label: 'Last 3 months', months: 3 },
];
const QAW_GREEN = '#008455';
const day = iso => { if (!iso) return '—'; const t = new Date(iso); return isNaN(t.getTime()) ? '—' : t.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); };

const TABS = [
  { key: 'overview', label: 'Overview', Icon: TabHome },
  { key: 'investors', label: 'Investors', Icon: TabPortfolio },
  { key: 'fees', label: 'Fees', Icon: TabServices },
  { key: 'indicators', label: 'Indicators', Icon: TabDocs },
  { key: 'more', label: 'More', Icon: TabMore },
];
const SUBTITLE = { overview: 'Your book at a glance', investors: 'Everyone who joined Qode through your links', fees: 'What you have earned from client fees', indicators: 'Market indicators from Qode research', more: 'Links, decks, policies and support' };

export function DistributorShell({ V }) {
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState('overview');
  const [filter, setFilter] = useState(null);   // { status, stage, strategy, basis, from, to } from Overview
  const [sub, setSub] = useState(null);         // a screen opened inside a tab: investor detail, statement, invoice, decks…
  const go = t => { setTab(t); setSub(null); };
  // Phone back button: close the open screen first, then return to Overview; only from Overview does the app's
  // own handler take over ("press again to exit").
  useEffect(() => {
    const h = BackHandler.addEventListener('hardwareBackPress', () => {
      if (sub) { setSub(null); return true; }
      if (tab !== 'overview') { go('overview'); return true; }
      return false;
    });
    return () => h.remove();
  }, [sub, tab]);
  const [tick, setTick] = useState(0);
  const journey = useLoad(() => api.journey(), [tick]);
  const split = useLoad(() => api.strategyAum(), [tick]);
  const refresh = () => setTick(t => t + 1);
  const name = (V.user && V.user.name) || 'Partner';
  const busy = journey.loading || split.loading;

  return (
    <View style={{ flex: 1, backgroundColor: C.cream }}>
      <KeyboardScroll contentContainerStyle={{ paddingBottom: 130 }}
        refreshControl={<RefreshControl refreshing={false} onRefresh={refresh} tintColor={C.gold} />}>
        <LinearGradient colors={C.darkGrad} locations={[0, 0.62, 1]} start={{ x: 0.1, y: 0 }} end={{ x: 0.6, y: 1 }} style={{ paddingBottom: 96 }}>
          <GoldThreads height={300} />
          <View style={{ paddingTop: insets.top + 12, paddingHorizontal: 22, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Tx w={700} s={10} ls={0.18} c={C.gold}>QODE PARTNER</Tx>
              <Tx f="play" w={600} s={22} c={C.cream} numberOfLines={2} style={{ marginTop: 4 }}>{name}</Tx>
            </View>
            <Pressable onPress={refresh} accessibilityLabel="Refresh" style={{ width: 42, height: 42, borderRadius: 21, borderWidth: 1, borderColor: 'rgba(239,236,211,0.22)', alignItems: 'center', justifyContent: 'center', opacity: busy ? 0.45 : 1 }}>
              <Refresh />
            </Pressable>
          </View>
          {V.testMode && (
            <View style={{ paddingTop: 10, paddingHorizontal: 22, flexDirection: 'row' }}>
              <View style={{ borderWidth: 1, borderColor: C.red, borderRadius: 999, paddingVertical: 4, paddingHorizontal: 10 }}>
                <Tx w={700} s={9.5} ls={0.18} c={C.red}>TEST MODE</Tx>
              </View>
            </View>
          )}
          <Tx s={12} c={C.cream60} style={{ paddingHorizontal: 22, marginTop: 10 }}>
            {SUBTITLE[tab]}
          </Tx>
        </LinearGradient>
        <View style={{ marginTop: -48 }}><CurveCap height={46} /></View>
        <View style={{ backgroundColor: C.cream, paddingHorizontal: 20, minHeight: 420 }}>
          {tab === 'overview' && <Overview journey={journey} split={split} onOpen={f => { setFilter(f || null); go('investors'); }} />}
          {tab === 'investors' && !sub && <Investors journey={journey} filter={filter} setFilter={setFilter} onDetail={(c, st) => setSub({ kind: 'detail', c, st })} />}
          {tab === 'investors' && sub && sub.kind === 'detail' && <InvestorDetail c={sub.c} status={sub.st} onboardingSequence={ONBOARDING_SEQUENCE} onBack={() => setSub(null)} />}
          {tab === 'fees' && !sub && <Fees onStatement={period => setSub({ kind: 'statement', period })} onInvoice={period => setSub({ kind: 'invoice', period })} />}
          {tab === 'fees' && sub && sub.kind === 'statement' && <Statement period={sub.period} distributorName={name} onBack={() => setSub(null)} onInvoice={period => setSub({ kind: 'invoice', period })} />}
          {tab === 'fees' && sub && sub.kind === 'invoice' && <Invoice period={sub.period} distributorName={name} onBack={() => setSub(null)} />}
          {tab === 'indicators' && <Indicators />}
          {tab === 'more' && !sub && <More V={V} open={k => setSub({ kind: k })} />}
          {tab === 'more' && sub && sub.kind === 'decks' && <Decks onBack={() => setSub(null)} />}
          {tab === 'more' && sub && sub.kind === 'links' && <><BackRow label="More" onPress={() => setSub(null)} /><Links journey={journey} inner /></>}
          {tab === 'more' && sub && sub.kind === 'policies' && <Policies onBack={() => setSub(null)} />}
          {tab === 'more' && sub && sub.kind === 'ticket' && <Ticket onBack={() => setSub(null)} />}
        </View>
      </KeyboardScroll>
      <LinearGradient colors={['rgba(0,16,8,0.9)', 'rgba(0,16,8,0)']}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, height: insets.top + 14, pointerEvents: 'none' }} />
      <LinearGradient colors={['#02422B', '#001008']} style={{ position: 'absolute', left: 0, right: 0, bottom: 0, paddingBottom: Math.max(insets.bottom, 16) }}>
        <View style={{ flexDirection: 'row', paddingBottom: 8 }}>
          {TABS.map(t => {
            const on = tab === t.key, col = on ? C.gold : C.cream55;
            return (
              <Pressable key={t.key} onPress={() => go(t.key)} style={{ flex: 1, alignItems: 'center', gap: 4, paddingTop: 9, minHeight: 44 }}>
                <t.Icon c={col} />
                <Tx w={700} s={10} c={col}>{t.label}</Tx>
                <View style={{ width: 30, height: 2, borderRadius: 1, marginTop: 2, backgroundColor: on ? C.gold : 'transparent' }} />
              </Pressable>
            );
          })}
        </View>
      </LinearGradient>
    </View>
  );
}

// Messages the web shows when the CRM cannot be read or the login is on no Zoho record.
function CrmNotice({ data }) {
  if (!data) return null;
  if (!data.zohoAvailable) return <Notice text="Investor details are temporarily unavailable. Your links and account counts are still correct. Please pull to refresh in a few minutes." />;
  if (!data.crmLinked) return <Notice text={`Your login address is not yet linked to your partner record, so your ${data.portalClientCount || ''} client accounts cannot be listed here. Please email partnerships@qodeinvest.com and we will link it.`} />;
  return null;
}
const Notice = ({ text }) => (
  <Card style={{ padding: 14, marginBottom: 12, borderWidth: 1, borderColor: C.gold35 }}>
    <Tx s={12} c={C.muted} lh={1.55}>{text}</Tx>
  </Card>
);

function Overview({ journey, split, onOpen }) {
  const d = journey.data;
  const clients = (d && d.journey && d.journey.clients) || [];
  const counts = useMemo(() => {
    const m = new Map();
    for (const c of clients) { const s = statusFor(c.stage, c.onboardingStage); m.set(s.key, (m.get(s.key) || 0) + 1); }
    return m;
  }, [clients]);
  const visible = STATUS_ORDER.filter(s => (counts.get(s.key) || 0) > 0);
  // Headline counts (web: investedCount / notYet) — both funded statuses count as funded.
  const investedCount = (counts.get('invested') || 0) + (counts.get('regular') || 0) + (counts.get('smallfunded') || 0);
  const notYet = (counts.get('opened') || 0) + (counts.get('onboarding') || 0);
  // Money brought in per month, by the month each investor started investing (web: monthlyInflow). Empty months
  // are real zeros and are kept.
  const [inflowRange, setInflowRange] = useState('all');
  const [pickedMonth, setPickedMonth] = useState(null);
  const monthlyInflow = useMemo(() => {
    const by = new Map();
    for (const c of clients) {
      const when = fundedDate(c);
      if (!when || !c.investedAmount) continue;
      const key = String(when).slice(0, 7);
      const row = by.get(key) || { amount: 0, investors: 0 };
      row.amount += c.investedAmount; row.investors += 1;
      by.set(key, row);
    }
    const keys = [...by.keys()].sort();
    if (!keys.length) return [];
    const out = [];
    let [y, m] = keys[0].split('-').map(Number);
    const [ey, em] = keys[keys.length - 1].split('-').map(Number);
    while (y < ey || (y === ey && m <= em)) {
      const key = `${y}-${String(m).padStart(2, '0')}`;
      const row = by.get(key);
      out.push({ month: key, label: new Date(y, m - 1, 1).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' }), amount: row ? row.amount : 0, investors: row ? row.investors : 0 });
      if (m === 12) { m = 1; y++; } else m++;
    }
    return out;
  }, [clients]);
  const visibleInflow = useMemo(() => {
    const def = INFLOW_RANGES.find(r => r.key === inflowRange) || INFLOW_RANGES[0];
    return def.months == null ? monthlyInflow : monthlyInflow.slice(-def.months);
  }, [monthlyInflow, inflowRange]);
  // Web rule (distributors/page.tsx): the exact split comes from strategy-aum (pms_master_sheet) and is scaled so it
  // totals the partner's Zoho book value — the same "current value" as the top card. When there is no exact split,
  // each investor's value is shared evenly across the strategies they hold (indicative).
  const strat = useMemo(() => {
    const exactRows = (split.data && split.data.strategies) || [];
    let rows, exact = exactRows.length > 0;
    if (exact) rows = exactRows.map(r => ({ name: r.name, value: r.value }));
    else {
      const by = new Map();
      for (const c of clients) {
        if (!c.currentValue || !(c.strategies || []).length) continue;
        const share = c.currentValue / c.strategies.length;
        for (const t of c.strategies) by.set(t, (by.get(t) || 0) + share);
      }
      rows = [...by.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
    }
    const raw = rows.reduce((n, r) => n + r.value, 0);
    const book = d && d.totals ? d.totals.currentValue : null;
    const scale = exact && raw > 0 && (book || 0) > 0 ? book / raw : 1;
    // pct is the web's figure exactly: the UNSCALED value over the SCALED total (distributors/page.tsx:769). That
    // is a web bug — the shares then don't add up to 100% whenever the scale isn't 1 — kept here so both agree;
    // fix it on the web first, then here (pct: r.value / raw * 100).
    const total = raw * scale;
    return { exact, rows: rows.map(r => ({ ...r, value: r.value * scale, pct: total > 0 ? (r.value / total) * 100 : null })), total };
  }, [split.data, clients, d]);
  const recent = clients.filter(c => { const w = fundedDate(c); const t = w ? new Date(w).getTime() : NaN; return !isNaN(t) && Date.now() - t < 30 * 864e5; })
    .sort((a, b) => String(fundedDate(b) || '').localeCompare(String(fundedDate(a) || '')));
  // Web rule (distributors/page.tsx onboardingSteps): count investors still in onboarding by their sub-stage, then
  // show the whole path from the first step to the furthest one anyone has reached — an empty step between two
  // occupied ones says that stage was passed.
  const journeySteps = useMemo(() => {
    const counts = new Map();
    for (const c of clients) {
      if (statusFor(c.stage, c.onboardingStage).key !== 'onboarding' || !c.onboardingStage) continue;
      counts.set(c.onboardingStage, (counts.get(c.onboardingStage) || 0) + 1);
    }
    if (!counts.size) return [];
    const rank = st => { const i = ONBOARDING_SEQUENCE.indexOf(st); return i === -1 ? ONBOARDING_SEQUENCE.length : i; };
    const last = Math.max(...[...counts.keys()].map(rank));
    return ONBOARDING_SEQUENCE.slice(0, last + 1).map(step => ({ step, count: counts.get(step) || 0 }));
  }, [clients]);

  if (journey.loading && !d) return <View style={{ marginTop: -30 }}><Loading rows={3} h={96} /></View>;
  if (journey.err) return <View style={{ marginTop: -30 }}><ErrorBox msg={journey.err} onRetry={journey.reload} /></View>;
  const t = d.totals || {};
  const invested = t.invested, value = t.currentValue;
  const gain = invested != null && value != null ? value - invested : null;
  const gainPct = gain != null && invested ? (gain / invested) * 100 : null;
  return (
    <Fade>
      <Card big style={{ marginTop: -34, padding: 18 }}>
        <Tx w={700} s={10.5} ls={0.12} c={C.muted}>TOTAL VALUE TODAY</Tx>
        <Amt w={700} s={30} style={{ marginTop: 6 }}>{inr(value)}</Amt>
        {gain != null && gainPct != null && (
          <View style={{ marginTop: 8 }}>
            <Tx s={12.5} lh={1.5}>
              <Tx w={700} s={12.5} c={gain >= 0 ? QAW_GREEN : C.red}>{gain >= 0 ? '▲' : '▼'} {inr(Math.abs(gain))} ({gain >= 0 ? '+' : '−'}{Math.abs(gainPct).toFixed(1)}%)</Tx>
              <Tx s={12.5} c={C.muted}> against {inr(invested)} put in</Tx>
            </Tx>
          </View>
        )}
        <View style={{ flexDirection: 'row', marginTop: 16, gap: 10, borderTopWidth: 1, borderColor: C.hairline, paddingTop: 14 }}>
          <Stat label="YOUR INVESTORS" value={String(t.investors || 0)} />
          <Stat label="FIRST FUND INITIATED" value={String(investedCount)} color={QAW_GREEN} />
          <Stat label="NOT YET FUNDED" value={String(notYet)} />
        </View>
      </Card>
      <View style={{ marginTop: 12 }}><CrmNotice data={d} /></View>

      {monthlyInflow.length >= 2 && (<>
        <SectionLabel>MONEY YOU HAVE BROUGHT IN</SectionLabel>
        <Tx s={11.5} c={C.muted} lh={1.5} style={{ marginTop: -4, marginBottom: 10, marginLeft: 2 }}>By the month each investor started investing.</Tx>
        <Card style={{ padding: 16 }}>
          {monthlyInflow.length > 3 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }} style={{ marginBottom: 14 }}>
              {INFLOW_RANGES.filter(r => r.months == null || monthlyInflow.length > r.months).map(r => {
                const on = inflowRange === r.key;
                return (
                  <Pressable key={r.key} onPress={() => { setInflowRange(r.key); setPickedMonth(null); }} style={{ paddingVertical: 7, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1, borderColor: on ? C.green : C.mutedBorder35, backgroundColor: on ? C.green : 'transparent' }}>
                    <Tx w={700} s={11} c={on ? C.cream : C.muted}>{r.label}</Tx>
                  </Pressable>
                );
              })}
            </ScrollView>
          )}
          <InflowBars data={visibleInflow} picked={pickedMonth} onPick={setPickedMonth}
            onSee={pt => { const [yy, mm] = pt.month.split('-').map(Number); onOpen({ basis: 'invested', from: pt.month + '-01', to: new Date(Date.UTC(yy, mm, 0)).toISOString().slice(0, 10) }); }} />
        </Card>
      </>)}

      <View style={{ marginTop: 12 }}><CrmNotice data={d} /></View>

      <SectionLabel>WHICH STRATEGIES THEY HOLD</SectionLabel>
      {split.loading && !split.data ? <Loading rows={1} h={90} /> : (
        strat.rows.length === 0
          ? <Card style={{ padding: 16 }}><Tx s={12} c={C.muted} center>No invested value to split yet.</Tx></Card>
          : (
            <Card style={{ padding: 16 }}>
              <Tx s={11.5} c={C.muted} lh={1.5}>{strat.exact ? 'Value held in each strategy today.' : 'Investor numbers are exact. Value is split evenly for anyone holding more than one strategy, so treat it as indicative.'}</Tx>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 12 }}>
                <Tx w={700} s={10} ls={0.1} c={C.muted}>TOTAL</Tx>
                <Amt w={700} s={16}>{inr(strat.total)}</Amt>
              </View>
              <View style={{ flexDirection: 'row', height: 10, borderRadius: 5, overflow: 'hidden', backgroundColor: 'rgba(55,88,79,0.08)', marginTop: 8 }}>
                {strat.rows.map(s => <View key={s.name} style={{ width: (strat.total > 0 ? (s.value / strat.total) * 100 : 0) + '%', backgroundColor: STRATEGY_COLOR[s.name] || C.gray }} />)}
              </View>
              {strat.rows.map(s => (
                <Pressable key={s.name} onPress={() => onOpen({ strategy: s.name })} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12 }}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: STRATEGY_COLOR[s.name] || C.gray }} />
                  <Tx w={700} s={12.5} style={{ flex: 1 }}>{s.name}</Tx>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Tx w={700} s={12.5}>{s.pct != null ? s.pct.toFixed(1) + '%' : '—'}</Tx>
                    <Amt s={11} c={C.muted}>{inr(s.value)}</Amt>
                  </View>
                </Pressable>
              ))}
            </Card>
          )
      )}

      {visible.length > 0 && (<>
        <SectionLabel>WHERE YOUR INVESTORS ARE</SectionLabel>
        <Card style={{ padding: 16 }}>
          <View style={{ flexDirection: 'row', height: 10, borderRadius: 5, overflow: 'hidden', backgroundColor: 'rgba(55,88,79,0.08)' }}>
            {visible.map(s => <View key={s.key} style={{ width: ((counts.get(s.key) || 0) / Math.max(clients.length, 1)) * 100 + '%', backgroundColor: TONE[s.tone] }} />)}
          </View>
          {visible.map(s => (
            <Pressable key={s.key} onPress={() => onOpen({ status: s.key })} accessibilityRole="button" accessibilityLabel={`${counts.get(s.key)} ${s.label} — show these investors`}
              style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8, paddingVertical: 6, paddingHorizontal: 6, marginHorizontal: -6, borderRadius: 8, backgroundColor: pressed ? 'rgba(2,66,43,0.06)' : 'transparent' })}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: TONE[s.tone] }} />
              <View style={{ flex: 1 }}>
                <Tx w={700} s={12.5} c={C.green} style={{ textDecorationLine: 'underline' }}>{s.label}</Tx>
                <Tx s={10.5} c={C.muted}>{s.detail}</Tx>
              </View>
              <Tx w={700} s={14}>{counts.get(s.key)}</Tx>
              <ChevronRight />
            </Pressable>
          ))}
        </Card>
      </>)}

      {journeySteps.length > 0 && (<>
        <SectionLabel>THE ONBOARDING JOURNEY</SectionLabel>
        <Tx s={11.5} c={C.muted} lh={1.5} style={{ marginTop: -4, marginBottom: 10, marginLeft: 2 }}>Where your investors have reached on the way to opening an account.</Tx>
        <Card style={{ paddingVertical: 8, paddingHorizontal: 16 }}>
          {/* Vertical on a phone: the path reads top to bottom, one step per row, no sideways scrolling. */}
          {journeySteps.map(({ step, count }, i) => {
            const here = count > 0, first = i === 0, last = i === journeySteps.length - 1;
            const Row = here ? Pressable : View;
            return (
              <Row key={step} {...(here ? { onPress: () => onOpen({ status: 'onboarding', stage: step }) } : {})} style={{ flexDirection: 'row', alignItems: 'stretch', minHeight: 50 }}>
                {/* marker with the connecting line running through it */}
                <View style={{ width: 30, alignItems: 'center' }}>
                  <View style={{ width: 1.5, flex: 1, backgroundColor: first ? 'transparent' : 'rgba(55,88,79,0.25)' }} />
                  <View style={{ width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 1,
                    borderColor: here ? C.green : 'rgba(55,88,79,0.3)', backgroundColor: here ? C.green : C.cream }}>
                    {here ? <Tx w={700} s={11.5} c={C.gold}>{count}</Tx> : <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(55,88,79,0.3)' }} />}
                  </View>
                  <View style={{ width: 1.5, flex: 1, backgroundColor: last ? 'transparent' : 'rgba(55,88,79,0.25)' }} />
                </View>
                <View style={{ flex: 1, justifyContent: 'center', paddingLeft: 12, paddingVertical: 6 }}>
                  <Tx w={here ? 700 : 400} s={12.5} c={here ? C.ink : C.gray}>{step}</Tx>
                  {here && <Tx s={11} c={C.muted} style={{ marginTop: 1 }}>{count} {count === 1 ? 'investor' : 'investors'}</Tx>}
                </View>
                {here && <View style={{ justifyContent: 'center' }}><ChevronRight /></View>}
              </Row>
            );
          })}
        </Card>
      </>)}

      {recent.length > 0 && (<>
        <SectionLabel>RECENTLY FUNDED</SectionLabel>
        <Tx s={11.5} c={C.muted} lh={1.5} style={{ marginTop: -4, marginBottom: 10, marginLeft: 2 }}>{recent.length} {recent.length === 1 ? 'investor' : 'investors'} in the last 30 days.</Tx>
        <Card style={{ overflow: 'hidden' }}>
          {recent.slice(0, 3).map((c, i, a) => (
            <View key={(c.email || '') + i} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: i < a.length - 1 ? 1 : 0, borderColor: C.hairline }}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Tx w={700} s={12.5} numberOfLines={1}>{c.name || '—'}</Tx>
                {(c.strategies || []).length > 0 && <Tx s={11} c={C.muted} numberOfLines={1} style={{ marginTop: 1 }}>{c.strategies.join(', ')}</Tx>}
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                {/* Web rule: today's value when the CRM has one; otherwise the amount put in, marked "invested". */}
                {c.currentValue != null
                  ? <Amt s={12.5}>{inr(c.currentValue)}</Amt>
                  : c.investedAmount != null
                    ? <Tx><Amt s={12.5}>{inr(c.investedAmount)}</Amt><Tx s={10.5} c={C.muted}> invested</Tx></Tx>
                    : <Tx s={12.5} c={C.muted}>—</Tx>}
                <Tx s={11} c={C.muted} style={{ marginTop: 1 }}>{day(fundedDate(c))}</Tx>
              </View>
            </View>
          ))}
        </Card>
      </>)}
    </Fade>
  );
}

const Stat = ({ label, value, color }) => (
  <View style={{ flex: 1 }}>
    <Tx w={700} s={9} ls={0.1} c={C.muted}>{label}</Tx>
    <Tx w={700} s={20} c={color || C.ink} style={{ marginTop: 4 }}>{value}</Tx>
  </View>
);

// Month bars for "Money you have brought in" (web: bar chart in QAW green, y-axis in L / Cr, tooltip on a bar).
// Tap a bar for its tooltip; "See these investors" opens the list for that month, as clicking a bar does on the web.
const yTick = v => (v >= 10000000 ? `${(v / 10000000).toFixed(1)}Cr` : `${Math.round(v / 100000)}L`);
function niceMax(m) { if (m <= 0) return 1; const p = Math.pow(10, Math.floor(Math.log10(m))); const f = m / p; return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * p; }
function InflowBars({ data, picked, onPick, onSee }) {
  const top = niceMax(Math.max(1, ...data.map(x => x.amount)));
  const ticks = [top, top * 0.75, top * 0.5, top * 0.25, 0];
  const H = 150, many = data.length > 12;
  const pt = data.find(x => x.month === picked);
  const bars = (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: many ? 6 : 4, height: H }}>
      {data.map(x => {
        const on = picked === x.month;
        return (
          <Pressable key={x.month} onPress={() => onPick(on ? null : x.month)} style={{ width: many ? 30 : undefined, flex: many ? undefined : 1, alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}>
            <View style={{ width: '78%', maxWidth: 38, height: x.amount > 0 ? Math.max(3, (x.amount / top) * H) : 2, borderTopLeftRadius: 4, borderTopRightRadius: 4,
              backgroundColor: x.amount > 0 ? (on ? C.green : QAW_GREEN) : 'rgba(55,88,79,0.15)', opacity: picked && !on ? 0.45 : 1 }} />
          </Pressable>
        );
      })}
    </View>
  );
  const labels = (
    <View style={{ flexDirection: 'row', gap: many ? 6 : 4, marginTop: 5 }}>
      {data.map(x => <Tx key={x.month} s={9} c={picked === x.month ? C.ink : C.muted} numberOfLines={1} style={{ width: many ? 30 : undefined, flex: many ? undefined : 1, textAlign: 'center' }}>{x.label}</Tx>)}
    </View>
  );
  return (
    <View>
      {/* tooltip, like the web's on hover */}
      <View style={{ minHeight: 44, marginBottom: 6 }}>
        {pt ? (
          <View style={{ alignSelf: 'flex-start', borderWidth: 1, borderColor: C.hairline, borderRadius: 8, backgroundColor: C.card, paddingVertical: 6, paddingHorizontal: 10 }}>
            <Tx w={700} s={11.5}>{pt.label}</Tx>
            <Tx s={11.5} c={C.muted}>Brought in: {inr(pt.amount)} from {pt.investors} {pt.investors === 1 ? 'investor' : 'investors'}</Tx>
            {pt.investors > 0 && <Pressable onPress={() => onSee(pt)} hitSlop={6}><Tx w={700} s={11.5} c={C.green} style={{ marginTop: 2 }}>See these investors ›</Tx></Pressable>}
          </View>
        ) : <Tx s={11} c={C.gray} style={{ marginTop: 14 }}>Tap a bar to see the month.</Tx>}
      </View>
      <View style={{ flexDirection: 'row' }}>
        {/* y-axis, the web's labels */}
        <View style={{ width: 40, height: H, justifyContent: 'space-between', paddingRight: 6 }}>
          {ticks.map((v, i) => <Tx key={i} s={9} c={C.muted} style={{ textAlign: 'right', marginTop: i === 0 ? -5 : 0, marginBottom: i === ticks.length - 1 ? -5 : 0 }}>{yTick(v)}</Tx>)}
        </View>
        <View style={{ flex: 1 }}>
          <View style={{ position: 'absolute', left: 0, right: 0, top: 0, height: H, justifyContent: 'space-between' }}>
            {ticks.map((_, i) => <View key={i} style={{ height: 1, backgroundColor: i === ticks.length - 1 ? 'rgba(55,88,79,0.25)' : 'rgba(55,88,79,0.08)' }} />)}
          </View>
          {many ? <ScrollView horizontal showsHorizontalScrollIndicator={false}><View>{bars}{labels}</View></ScrollView> : <>{bars}{labels}</>}
        </View>
      </View>
    </View>
  );
}


// Web: distributors/investors — same filters (status, onboarding step, strategy, date basis), same search
// (name, email, city, strategy), same order (largest holdings first), 10 rows then 25 more at a time.
function Investors({ journey, filter, setFilter, onDetail }) {
  const f = filter || {};
  const [q, setQ] = useState('');
  const [status, setStatus] = useState(f.status || 'all');
  const [shown, setShown] = useState(10);
  useEffect(() => { setShown(10); }, [q, status, f.stage, f.strategy, f.basis, f.from, f.to]);
  const d = journey.data;
  const clients = (d && d.journey && d.journey.clients) || [];
  const withStatus = clients.map(c => ({ c, s: statusFor(c.stage, c.onboardingStage) }));
  const present = STATUS_ORDER.filter(s => withStatus.some(x => x.s.key === s.key));
  const needle = q.trim().toLowerCase();
  const dateOf = c => (f.basis === 'opened' ? c.accountLiveDate : fundedDate(c));
  const rows = withStatus
    .filter(x => status === 'all' || x.s.key === status)
    .filter(x => !f.stage || x.c.onboardingStage === f.stage)
    .filter(x => !f.strategy || (x.c.strategies || []).includes(f.strategy))
    .filter(x => {
      if (!f.basis || (!f.from && !f.to)) return true;
      const raw = dateOf(x.c); if (!raw) return false;
      const dd = String(raw).slice(0, 10);
      return !(f.from && dd < f.from) && !(f.to && dd > f.to);
    })
    .filter(x => !needle || [x.c.name, x.c.email, x.c.city, ...(x.c.strategies || [])].some(v => String(v || '').toLowerCase().includes(needle)))
    .sort((a, b) => (b.c.currentValue || 0) - (a.c.currentValue || 0));
  const dupes = (() => { const seen = new Map(); for (const { c } of rows) { const k = String(c.email || '').toLowerCase() + '|' + String(c.name || '').toLowerCase(); seen.set(k, (seen.get(k) || 0) + 1); } return [...seen.values()].reduce((n, v) => n + (v > 1 ? v - 1 : 0), 0); })();
  const drop = k => setFilter({ ...f, [k]: undefined, ...(k === 'basis' ? { from: undefined, to: undefined } : null) });
  const chips = [
    f.stage && ['stage', 'Onboarding step: ' + f.stage],
    f.strategy && ['strategy', 'Strategy: ' + f.strategy],
    f.basis && (f.from || f.to) && ['basis', (f.basis === 'opened' ? 'Opened ' : 'Funded ') + [f.from && formatShort(f.from), f.to && formatShort(f.to)].filter(Boolean).join(' – ')],
  ].filter(Boolean);

  if (journey.loading && !d) return <View style={{ marginTop: -30 }}><Loading rows={4} h={64} /></View>;
  if (journey.err) return <View style={{ marginTop: -30 }}><ErrorBox msg={'We couldn’t load your investors. Please refresh to try again.'} onRetry={journey.reload} /></View>;
  return (
    <Fade>
      <Card big style={{ marginTop: -34, paddingHorizontal: 14, paddingVertical: 4, flexDirection: 'row', alignItems: 'center' }}>
        <TextInput value={q} onChangeText={setQ} placeholder="Search by name, city or strategy" placeholderTextColor={C.gray}
          autoCapitalize="none" autoCorrect={false} accessibilityLabel="Search your investors" style={{ flex: 1, paddingVertical: 12, fontSize: 14, color: C.ink }} />
        {!!q && <Pressable onPress={() => setQ('')} hitSlop={10} accessibilityLabel="Clear search"><Tx w={700} s={14} c={C.muted}>✕</Tx></Pressable>}
      </Card>
      <View style={{ marginTop: 12 }}><CrmNotice data={d} /></View>
      {chips.map(([k, label]) => (
        <Pressable key={k} onPress={() => drop(k)} style={{ flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 8, marginBottom: 8, paddingVertical: 7, paddingHorizontal: 12, borderRadius: 999, backgroundColor: C.green }}>
          <Tx w={700} s={11} c={C.cream}>{label}</Tx>
          <Tx w={700} s={12} c={C.gold}>✕</Tx>
        </Pressable>
      ))}
      {present.length > 1 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 2 }} style={{ marginBottom: 10 }}>
          {[{ key: 'all', short: 'All' }, ...present].map(s => {
            const on = status === s.key, warn = s.tone === 'warn';
            const n = s.key === 'all' ? clients.length : withStatus.filter(x => x.s.key === s.key).length;
            return (
              <Pressable key={s.key} onPress={() => setStatus(on && s.key !== 'all' ? 'all' : s.key)} style={{ paddingVertical: 8, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1, borderColor: on ? C.green : warn ? 'rgba(239,68,68,0.4)' : C.mutedBorder35, backgroundColor: on ? C.green : 'transparent' }}>
                <Tx w={700} s={11} c={on ? C.cream : warn ? C.red : C.muted}>{s.short} · {n}</Tx>
              </Pressable>
            );
          })}
        </ScrollView>
      )}
      {clients.length > 0 && (
        <Tx s={11} c={C.gray} style={{ marginBottom: 10, marginLeft: 2 }}>
          {rows.length === clients.length ? `${clients.length} investors, largest holdings first` : `Showing ${rows.length} of ${clients.length}`}{dupes ? ` · includes ${dupes} duplicate ${dupes === 1 ? 'record' : 'records'} from the CRM` : ''}
        </Tx>
      )}
      {rows.length === 0 && (
        <Card style={{ padding: 18 }}>
          <Tx s={12.5} c={C.muted} center lh={1.5}>{clients.length ? 'No investors match this view. Try a different search, or clear the filters above.' : 'No investors have joined through your links yet. Share a link to get started.'}</Tx>
        </Card>
      )}
      {rows.slice(0, shown).map(({ c, s }, i) => {
        const delta = c.currentValue != null && c.investedAmount != null ? c.currentValue - c.investedAmount : null;
        const meta = [c.city, (c.strategies || []).join(', ') || null, c.accountLiveDate ? `${c.currentValue != null ? 'Funded' : 'Account opened'} ${day(c.accountLiveDate)}` : null].filter(Boolean).join(' · ');
        return (
          <Pressable key={(c.email || 'row') + '-' + i} onPress={() => onDetail(c, s)}>
            <Card style={{ marginBottom: 10, borderLeftWidth: 3, borderLeftColor: TONE[s.tone], padding: 14 }}>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Tx w={700} s={13} numberOfLines={1}><Tx s={11} c={C.gray}>{i + 1}.  </Tx>{c.name || '—'}</Tx>
                  <Tx w={700} s={9.5} ls={0.06} c={s.tone === 'warn' ? C.red : C.green} style={{ marginTop: 4 }}>{s.label.toUpperCase()}</Tx>
                  {s.key === 'onboarding' && !!c.onboardingStage && <Tx s={11} c={C.muted} style={{ marginTop: 2 }}>{c.onboardingStage}</Tx>}
                  <Tx s={11} c={C.muted} numberOfLines={2} style={{ marginTop: 3 }}>{meta || 'No details recorded yet'}</Tx>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  {c.currentValue != null ? <Amt s={13}>{inr(c.currentValue)}</Amt> : <Tx s={11} c={C.muted}>No holdings yet</Tx>}
                  {delta != null && <Tx w={700} s={11} c={delta >= 0 ? '#008455' : C.red} style={{ marginTop: 2 }}>{delta >= 0 ? '▲' : '▼'} {inr(Math.abs(delta))}</Tx>}
                  <View style={{ marginTop: 8 }}><ChevronRight /></View>
                </View>
              </View>
            </Card>
          </Pressable>
        );
      })}
      {rows.length > shown && (
        <CTA label={`SHOW ${Math.min(25, rows.length - shown)} MORE (${rows.length - shown} REMAINING)`} outline onPress={() => setShown(n => n + 25)} style={{ paddingVertical: 11 }} />
      )}
    </Fade>
  );
}
const formatShort = iso => { const t = new Date(iso); return isNaN(t.getTime()) ? iso : t.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); };

const Row = ({ k, v }) => (
  <View style={{ flexDirection: 'row', paddingVertical: 6, gap: 10 }}>
    <Tx s={11.5} c={C.muted} style={{ flex: 1 }}>{k}</Tx>
    <Tx w={700} s={11.5} style={{ flexShrink: 1, textAlign: 'right' }}>{v}</Tx>
  </View>
);

function Links({ journey, inner }) {   // inner: opened from More, under its back link
  const d = journey.data;
  if (journey.loading && !d) return <View style={{ marginTop: inner ? 0 : -30 }}><Loading rows={2} h={110} /></View>;
  if (journey.err) return <View style={{ marginTop: inner ? 0 : -30 }}><ErrorBox msg="We couldn’t load your links. Please pull down to try again." onRetry={journey.reload} /></View>;
  const L = d.referralLinks;
  return (
    <Fade>
      <Card big style={{ marginTop: inner ? 0 : -34, padding: 18 }}>
        <Tx s={12.5} c={C.muted} lh={1.6}>Send someone the right link and their account is recorded against your name automatically.</Tx>
      </Card>
      {!L ? (
        <Card style={{ padding: 18, marginTop: 12 }}>
          <Tx s={12.5} c={C.muted} lh={1.6}>No onboarding link has been set up for you yet. Email partnerships@qodeinvest.com and we will create one.</Tx>
        </Card>
      ) : (<>
        <LinkCard title="For individuals" sub="A person investing in their own name" url={L.individual} />
        <LinkCard title="For companies, LLPs, HUFs and trusts" sub="Any non-individual investor" url={L.nonIndividual} />
      </>)}
    </Fade>
  );
}

function LinkCard({ title, sub, url }) {
  const [copied, setCopied] = useState(false);
  return (
    <Card style={{ padding: 16, marginTop: 12 }}>
      <Tx w={700} s={13}>{title}</Tx>
      <Tx s={11} c={C.muted} style={{ marginTop: 2 }}>{sub}</Tx>
      <View style={{ marginTop: 10, padding: 10, borderRadius: 8, backgroundColor: 'rgba(55,88,79,0.06)' }}>
        <Tx s={12} c={C.green} selectable>{url}</Tx>
      </View>
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
        <CTA label={copied ? 'COPIED' : 'COPY'} outline onPress={() => { Clipboard.setStringAsync(url).catch(() => {}); setCopied(true); setTimeout(() => setCopied(false), 1500); }} style={{ flex: 1, paddingVertical: 11 }} />
        <CTA label="SHARE" onPress={() => Share.share({ message: url }).catch(() => {})} style={{ flex: 1, paddingVertical: 11 }} />
      </View>
    </Card>
  );
}

const MORE_ITEMS = [
  ['links', 'Onboarding link', 'Share with a prospective investor'],
  ['decks', 'Decks', 'Download and share with prospective investors'],
  ['policies', 'Risk & controls', 'The policies that guide portfolio construction'],
  ['ticket', 'Raise a ticket', 'The partnerships team replies by email'],
];
function More({ V, open }) {
  const u = V.user || {};
  return (
    <Fade>
      <Card big style={{ marginTop: -34, padding: 18 }}>
        <Tx w={700} s={10.5} ls={0.12} c={C.muted}>SIGNED IN AS</Tx>
        <Tx w={700} s={14} style={{ marginTop: 6 }}>{u.name || 'Partner'}</Tx>
        <Tx s={12} c={C.muted} style={{ marginTop: 2 }}>{u.email || ''}</Tx>
      </Card>
      <SectionLabel>PARTNER TOOLS</SectionLabel>
      <Card style={{ overflow: 'hidden' }}>
        {MORE_ITEMS.map(([k, t, sub], i) => (
          <Pressable key={k} onPress={() => open(k)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 16, borderBottomWidth: i < MORE_ITEMS.length - 1 ? 1 : 0, borderColor: C.hairline }}>
            <View style={{ flex: 1 }}>
              <Tx w={700} s={13}>{t}</Tx>
              <Tx s={11} c={C.muted} style={{ marginTop: 2 }}>{sub}</Tx>
            </View>
            <ChevronRight />
          </Pressable>
        ))}
      </Card>
      <SectionLabel>PARTNERSHIPS TEAM</SectionLabel>
      <Card style={{ overflow: 'hidden' }}>
        <Pressable onPress={() => Linking.openURL('mailto:partnerships@qodeinvest.com').catch(() => {})} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderBottomWidth: 1, borderColor: C.hairline }}>
          <MailIcon /><Tx w={700} s={13} style={{ flex: 1 }}>partnerships@qodeinvest.com</Tx>
        </Pressable>
        <Pressable onPress={() => Linking.openURL('tel:+919326535470').catch(() => {})} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 }}>
          <Phone /><Tx w={700} s={13} style={{ flex: 1 }}>+91 93265 35470</Tx>
        </Pressable>
      </Card>
      <CTA label="SIGN OUT" outline onPress={V.doLogout} style={{ marginTop: 22 }} />
    </Fade>
  );
}
