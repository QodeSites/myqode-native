// Partner (distributor) app: shown instead of the investor tabs when the signed-in login is a distributor.
// Web logic first — a port of the web's partner portal (myQode/app/(protected)/distributors/*):
//   Overview   = distributors/page.tsx      (money brought in, strategy split, where investors are,
//                                             onboarding journey, recently funded)
//   Investors  = distributors/investors      (searchable list; detail hides lastConversation, as the web does)
//   Links      = distributors/referrals      (onboarding links for individuals / non-individuals)
// Status wording is lib/distributorVocabulary.ts verbatim (Zoho's own values + a one-line meaning).
// Data: /api/mobile/distributor/{journey,strategy-aum}, which re-check the distributor role server-side.
import React, { useState, useMemo, useEffect } from 'react';
import { View, Pressable, ScrollView, TextInput, Share, Linking, RefreshControl, Dimensions, Modal } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path, Circle, Rect } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import { C, Tx, Amt, Card, CTA, Fade, GoldThreads, CurveCap, KeyboardScroll, useBackHandler } from '../ui';
import { ChevronDown, ChevronRight, Refresh, Phone, MailIcon, Download } from '../icons';
import { distributor as api } from '../api';
import { useLoad, SectionLabel, Loading, ErrorBox, SignOutButton } from './kit';
import { InvestorDetail, Fees, Statement, Invoice, Decks, Indicators, Ticket, Policies, BackRow, openPdf, warmPartnerData } from './partner';
import { DateField } from './sip';

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
// One colour per status for the "Where your investors are" doughnut and its list (funded = greens/blue,
// in progress = gold/grey, stalled = ambers/reds).
const STATUS_COLOR = { invested: '#008455', regular: '#0A3452', smallfunded: '#5FB08A', opened: '#DABD38', onboarding: '#9CA3AF', inactive: '#E0A458', declined: '#EF4444', closed: '#991B1B' };
// The same colours as text on the cream cards: the light ones (gold, grey, pale green) darkened to stay readable.
const STATUS_TEXT = { ...STATUS_COLOR, smallfunded: '#3F8F68', opened: '#9A6B12', onboarding: '#5B6470', inactive: '#B26B1E' };
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

// Icons from the web partner menu (components/qode-distributor-sidebar.tsx, lucide-react), drawn at the
// same 24-unit size and stroke so the app reads like the web.
const Lucide = ({ c, s = 22, children }) => (
  <Svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">{children}</Svg>
);
const IconDashboard = ({ c, s }) => <Lucide c={c} s={s}><Rect x={3} y={3} width={7} height={9} rx={1} /><Rect x={14} y={3} width={7} height={5} rx={1} /><Rect x={14} y={12} width={7} height={9} rx={1} /><Rect x={3} y={16} width={7} height={5} rx={1} /></Lucide>;
const IconUsers = ({ c, s }) => <Lucide c={c} s={s}><Path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><Circle cx={9} cy={7} r={4} /><Path d="M22 21v-2a4 4 0 0 0-3-3.87" /><Path d="M16 3.13a4 4 0 0 1 0 7.75" /></Lucide>;
const IconCalculator = ({ c, s }) => <Lucide c={c} s={s}><Rect x={4} y={2} width={16} height={20} rx={2} /><Path d="M8 6h8" /><Path d="M16 14v4" /><Path d="M16 10h.01M12 10h.01M8 10h.01M12 14h.01M8 14h.01M12 18h.01M8 18h.01" /></Lucide>;
const IconLineChart = ({ c, s }) => <Lucide c={c} s={s}><Path d="M3 3v16a2 2 0 0 0 2 2h16" /><Path d="m19 9-5 5-4-4-3 3" /></Lucide>;
const IconMore = ({ c, s }) => <Lucide c={c} s={s}><Path d="M4 6h16M4 12h16M4 18h16" /></Lucide>;
const IconShare = ({ c, s }) => <Lucide c={c} s={s}><Circle cx={18} cy={5} r={3} /><Circle cx={6} cy={12} r={3} /><Circle cx={18} cy={19} r={3} /><Path d="m8.59 13.51 6.83 3.98M15.41 6.51l-6.82 3.98" /></Lucide>;
const IconFile = ({ c, s }) => <Lucide c={c} s={s}><Path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" /><Path d="M14 2v4a2 2 0 0 0 2 2h4M10 9H8M16 13H8M16 17H8" /></Lucide>;
const IconShield = ({ c, s }) => <Lucide c={c} s={s}><Path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" /><Path d="m9 12 2 2 4-4" /></Lucide>;
const IconLifeBuoy = ({ c, s }) => <Lucide c={c} s={s}><Circle cx={12} cy={12} r={10} /><Circle cx={12} cy={12} r={4} /><Path d="m4.93 4.93 4.24 4.24M14.83 9.17l4.24-4.24M14.83 14.83l4.24 4.24M9.17 14.83l-4.24 4.24" /></Lucide>;

const TABS = [
  { key: 'overview', label: 'Overview', Icon: IconDashboard },
  { key: 'investors', label: 'Investors', Icon: IconUsers },
  { key: 'fees', label: 'Fees', Icon: IconCalculator },
  { key: 'indicators', label: 'Indicators', Icon: IconLineChart },
  { key: 'more', label: 'More', Icon: IconMore },
];
// Page headings the web shows above a tab's content.
const TITLE = { fees: 'Your Fees' };
const SUBTITLE = { overview: 'Your book at a glance', investors: 'Everyone who joined Qode through your links', fees: 'What you have earned from client fees in the selected period.', indicators: 'Market indicators from Qode research', more: 'Links, decks, policies and support' };

export function DistributorShell({ V }) {
  const insets = useSafeAreaInsets();
  const back = V.partnerNav || {};   // where the partner was before "View account"
  // The app opens on Overview (the web lands partners on Fees; chosen differently for the app).
  const HOME_TAB = 'overview';
  const [tab, setTab] = useState(back.tab || HOME_TAB);
  const [filter, setFilter] = useState(back.filter || null);   // { status, stage, strategy, basis, from, to } from Overview
  const [sub, setSub] = useState(back.sub || null);         // a screen opened inside a tab: investor detail, statement, invoice, decks…
  // "View account" (web: investors page): opens the investor's own app, read-only. Errors are shown where the
  // button was pressed.
  const [opening, setOpening] = useState('');
  const [openErr, setOpenErr] = useState('');
  const [openErrFor, setOpenErrFor] = useState('');   // the client code the error belongs to
  const viewAccount = async c => {
    if (opening || !c.clientCode) return;
    setOpening(c.clientCode); setOpenErr(''); setOpenErrFor('');
    try { await V.viewInvestor(c.clientCode, { tab, filter, sub }); }
    catch (e) {
      setOpenErr(e.status === 403 ? (e.message || 'This investor is not in your book.')
        : e.status === 503 ? (e.message || 'We couldn’t confirm this investor just now. Please try again in a few minutes.')
        : `We couldn’t open ${c.name || 'that'} account just now. Please try again.`);
      setOpenErrFor(c.clientCode); setOpening('');
    }
  };
  const view = { opening, err: openErr, errFor: openErrFor, open: viewAccount };
  // Moving between tabs starts each one fresh: a filter picked on the Overview applies only to the Investors view
  // it opened, not to later visits.
  const go = t => { setTab(t); setSub(null); setFilter(null); };
  // Back (Android button / iOS edge swipe, via useBackHandler): close the open screen first, then return to
  // the landing tab (Overview); only from there does the app's own handler take over ("press again to exit").
  useBackHandler(() => {
    if (sub) { setSub(null); return true; }
    if (tab !== HOME_TAB) { go(HOME_TAB); return true; }
    return false;
  });
  // One scroll view for every tab and screen: each opens at its top, not where the last one was left.
  const scrollRef = React.useRef(null);
  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTo({ y: 0, animated: false }); }, [tab, sub]);
  const [tick, setTick] = useState(0);
  useEffect(() => { warmPartnerData(); }, []);
  const journey = useLoad(() => api.journey(), [tick]);
  const split = useLoad(() => api.strategyAum(), [tick]);
  const refresh = () => setTick(t => t + 1);
  const name = (V.user && V.user.name) || 'Partner';
  const busy = journey.loading || split.loading;

  return (
    <View style={{ flex: 1, backgroundColor: C.cream }}>
      <KeyboardScroll ref={scrollRef} contentContainerStyle={{ paddingBottom: 130 }}
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
          {!!TITLE[tab] && <Tx f="play" w={600} s={17} c={C.cream} style={{ paddingHorizontal: 22, marginTop: 14 }}>{TITLE[tab]}</Tx>}
          <Tx s={12} c={C.cream60} style={{ paddingHorizontal: 22, marginTop: TITLE[tab] ? 3 : 10 }}>
            {SUBTITLE[tab]}
          </Tx>
        </LinearGradient>
        <View style={{ marginTop: -48 }}><CurveCap height={46} /></View>
        <View style={{ backgroundColor: C.cream, paddingHorizontal: 20, minHeight: 420 }}>
          {tab === 'overview' && <Overview journey={journey} split={split} onOpen={f => { setTab('investors'); setSub(null); setFilter(f || null); }}
            onDetail={(c, st) => { setOpenErr(''); setFilter(null); setTab('investors'); setSub({ kind: 'detail', c, st }); }} onLinks={() => { setTab('more'); setSub({ kind: 'links' }); }} />}
          {tab === 'investors' && !sub && <Investors journey={journey} filter={filter} setFilter={setFilter} onDetail={(c, st) => { setOpenErr(''); setSub({ kind: 'detail', c, st }); }} view={view} onLinks={() => { setTab('more'); setSub({ kind: 'links' }); }} />}
          {tab === 'investors' && sub && sub.kind === 'detail' && <InvestorDetail c={sub.c} status={sub.st} onboardingSequence={ONBOARDING_SEQUENCE} onBack={() => { setOpenErr(''); setSub(null); }} view={view} />}
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

function Overview({ journey, split, onOpen, onDetail, onLinks }) {
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
  if (journey.err) return <View style={{ marginTop: -30 }}><ErrorBox msg="We couldn’t load your overview. Please refresh, or contact partnerships@qodeinvest.com if this keeps happening." onRetry={journey.reload} /></View>;
  const t = d.totals || {};
  // Web: when the CRM can't be read, or this login is on no partner record, the cards are replaced by one message.
  const live = d.crmLinked && d.zohoAvailable;
  const invested = t.invested, value = t.currentValue;
  const gain = invested != null && value != null ? value - invested : null;
  const gainPct = gain != null && invested ? (gain / invested) * 100 : null;
  return (
    <Fade>
      {!live ? (
        <Card big style={{ marginTop: -34, paddingVertical: 22, paddingHorizontal: 18 }}>
          <Tx s={12.5} c={C.muted} center lh={1.55}>
            {!d.zohoAvailable ? 'We couldn’t load your investor data just now. Please try again shortly.' : 'We couldn’t link this login to your records, so your investors can’t be shown yet.'}
            {!d.crmLinked && <>{' '}Email <Tx w={700} s={12.5} c={C.green} onPress={() => Linking.openURL('mailto:partnerships@qodeinvest.com')}>partnerships@qodeinvest.com</Tx> and we’ll connect it.</>}
          </Tx>
        </Card>
      ) : (<>
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
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 16, gap: 10, borderTopWidth: 1, borderColor: C.hairline, paddingTop: 14 }}>
          <Stat label="YOUR INVESTORS" value={String(t.investors || 0)} />
          <Stat label="FIRST FUND INITIATED" value={String(investedCount)} color={QAW_GREEN} />
          <Stat label="NOT YET FUNDED" value={String(notYet)} />
        </View>
      </Card>

      {monthlyInflow.length >= 2 && (<>
        <SectionLabel>MONEY YOU HAVE BROUGHT IN</SectionLabel>
        <Tx s={11.5} c={C.muted} lh={1.5} style={{ marginTop: -4, marginBottom: 10, marginLeft: 2 }}>By the month each investor started investing.</Tx>
        <Card style={{ padding: 16 }}>
          {monthlyInflow.length > 3 && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
              {INFLOW_RANGES.filter(r => r.months == null || monthlyInflow.length > r.months).map(r => {
                const on = inflowRange === r.key;
                return (
                  <Pressable key={r.key} onPress={() => { setInflowRange(r.key); setPickedMonth(null); }} style={{ paddingVertical: 7, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1, borderColor: on ? C.green : C.mutedBorder35, backgroundColor: on ? C.green : 'transparent' }}>
                    <Tx w={700} s={11} c={on ? C.cream : C.muted}>{r.label}</Tx>
                  </Pressable>
                );
              })}
            </View>
          )}
          <InflowBars data={visibleInflow} picked={pickedMonth} onPick={setPickedMonth}
            onSee={pt => { const [yy, mm] = pt.month.split('-').map(Number); onOpen({ basis: 'invested', from: pt.month + '-01', to: new Date(Date.UTC(yy, mm, 0)).toISOString().slice(0, 10) }); }} />
        </Card>
      </>)}

      <SectionLabel>WHICH STRATEGIES THEY HOLD</SectionLabel>
      {split.loading && !split.data ? <Loading rows={1} h={90} /> : (
        strat.rows.length === 0
          ? <Card style={{ padding: 16 }}><Tx s={12} c={C.muted} center>No invested value to split yet.</Tx></Card>
          : (
            <Card style={{ padding: 16 }}>
              <Tx s={11.5} c={C.muted} lh={1.5}>{strat.exact ? 'Value held in each strategy today.' : 'Investor numbers are exact. Value is split evenly for anyone holding more than one strategy, so treat it as indicative.'}</Tx>
              <Donut slices={strat.rows.map(s => ({ key: s.name, value: s.value, color: STRATEGY_COLOR[s.name] || C.gray }))}
                label="TOTAL" value={inr(strat.total)} onPick={k => onOpen({ strategy: k })} />
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
        <Tx s={11.5} c={C.muted} lh={1.5} style={{ marginTop: -4, marginBottom: 10, marginLeft: 2 }}>Every investor you referred, by how far along they are.</Tx>
        <Card style={{ padding: 16 }}>
          <Donut slices={visible.map(s => ({ key: s.key, value: counts.get(s.key) || 0, color: STATUS_COLOR[s.key] }))}
            label="INVESTORS" value={String(clients.length)} onPick={k => onOpen({ status: k })} />
          {visible.map(s => (
            <Pressable key={s.key} onPress={() => onOpen({ status: s.key })} accessibilityRole="button" accessibilityLabel={`${counts.get(s.key)} ${s.label} — show these investors`}
              style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8, paddingVertical: 6, paddingHorizontal: 6, marginHorizontal: -6, borderRadius: 8, backgroundColor: pressed ? 'rgba(2,66,43,0.06)' : 'transparent' })}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: STATUS_COLOR[s.key] }} />
              <View style={{ flex: 1 }}>
                <Tx w={700} s={12.5}>{s.label}</Tx>
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
            // Web: each row opens that investor (or the list when there's no email to key on)
            <Pressable key={(c.email || '') + i} onPress={() => (c.email ? onDetail(c, statusFor(c.stage, c.onboardingStage)) : onOpen(null))}
              style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: i < a.length - 1 ? 1 : 0, borderColor: C.hairline, backgroundColor: pressed ? 'rgba(2,66,43,0.05)' : 'transparent' })}>
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
            </Pressable>
          ))}
        </Card>
      </>)}
      </>)}

      {/* Where to go next (web: two link cards under the overview, shown whether or not the CRM is live) */}
      <View style={{ marginTop: 18, gap: 10 }}>
        {[['See all your investors', 'Search, filter and download statements', () => onOpen(null)], ['Onboarding Link', 'Share with a prospective investor', onLinks]].map(([title, sub, go]) => (
          <Pressable key={title} onPress={go} accessibilityRole="button">
            <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 14, paddingHorizontal: 16 }}>
              <View style={{ flex: 1 }}>
                <Tx w={700} s={13}>{title}</Tx>
                <Tx s={11.5} c={C.muted} style={{ marginTop: 1 }}>{sub}</Tx>
              </View>
              <ChevronRight />
            </Card>
          </Pressable>
        ))}
      </View>
    </Fade>
  );
}

// Each stat is as wide as its label; the row spaces them with equal gaps. Labels stay on one line (they shrink a
// little on very narrow phones rather than wrap).
const Stat = ({ label, value, color }) => (
  <View style={{ alignItems: 'center', flexShrink: 1 }}>
    <Tx w={700} s={9} ls={0.1} c={C.muted} center numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>{label}</Tx>
    <Tx w={700} s={20} c={color || C.ink} center style={{ marginTop: 4 }}>{value}</Tx>
  </View>
);

// Doughnut chart, centred above its list (the web's strategy card is a doughnut with the total in the hole).
// Tapping a slice opens the same filtered investor list as tapping its row.
function Donut({ slices, label, value, onPick, size = 190, thickness = 30 }) {
  const total = slices.reduce((n, s) => n + (s.value > 0 ? s.value : 0), 0);
  const r = size / 2, ri = r - thickness;
  const pt = (a, rad) => [r + rad * Math.sin(a), r - rad * Math.cos(a)];
  let a0 = 0;
  const arcs = total > 0 ? slices.filter(s => s.value > 0).map(s => {
    const frac = s.value / total, gap = slices.filter(x => x.value > 0).length > 1 ? 0.012 : 0;
    const a1 = a0 + frac * 2 * Math.PI, from = a0 + gap / 2, to = Math.max(from + 0.001, a1 - gap / 2);
    a0 = a1;
    if (frac >= 0.9999) return { key: s.key, color: s.color, full: true };
    const large = to - from > Math.PI ? 1 : 0;
    const [x1, y1] = pt(from, r), [x2, y2] = pt(to, r), [x3, y3] = pt(to, ri), [x4, y4] = pt(from, ri);
    return { key: s.key, color: s.color, d: `M${x1},${y1} A${r},${r} 0 ${large} 1 ${x2},${y2} L${x3},${y3} A${ri},${ri} 0 ${large} 0 ${x4},${y4} Z` };
  }) : [];
  return (
    <View style={{ alignItems: 'center', marginTop: 12, marginBottom: 4 }}>
      <View style={{ width: size, height: size }}>
        <Svg width={size} height={size}>
          {total === 0 && <Circle cx={r} cy={r} r={r - thickness / 2} stroke="rgba(55,88,79,0.12)" strokeWidth={thickness} fill="none" />}
          {arcs.map(a => a.full
            ? <Circle key={a.key} cx={r} cy={r} r={r - thickness / 2} stroke={a.color} strokeWidth={thickness} fill="none" onPress={onPick ? () => onPick(a.key) : undefined} />
            : <Path key={a.key} d={a.d} fill={a.color} onPress={onPick ? () => onPick(a.key) : undefined} />)}
        </Svg>
        <View style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
          <Tx w={700} s={9.5} ls={0.12} c={C.muted}>{label}</Tx>
          <Amt w={700} s={17} style={{ marginTop: 2 }}>{value}</Amt>
        </View>
      </View>
    </View>
  );
}

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
          {many ? <ScrollView horizontal showsHorizontalScrollIndicator={false} directionalLockEnabled alwaysBounceVertical={false} nestedScrollEnabled><View>{bars}{labels}</View></ScrollView> : <>{bars}{labels}</>}
        </View>
      </View>
    </View>
  );
}


// Web: distributors/investors — same filters (status, onboarding step, strategy, date basis), same search
// (name, email, city, strategy), same order (largest holdings first), 10 rows then 25 more at a time.
function Investors({ journey, filter, setFilter, onDetail, view, onLinks }) {
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
    .filter(x => !needle || [x.c.name, x.c.email, ...(x.c.strategies || [])].some(v => String(v || '').toLowerCase().includes(needle)))
    .sort((a, b) => (b.c.currentValue || 0) - (a.c.currentValue || 0));
  // Web: duplicate CRM records are counted across the whole book, not just the rows on screen.
  const dupes = (() => { const seen = new Set(); let extra = 0; for (const c of clients) { const k = String(c.email || '').toLowerCase() + '|' + String(c.name || '').toLowerCase(); if (seen.has(k)) extra++; else seen.add(k); } return extra; })();
  // Web: how many the date filter set aside purely for having no date — reported, not silently dropped.
  const undated = !f.basis || (!f.from && !f.to) ? 0 : withStatus.filter(x => (status === 'all' || x.s.key === status) && (!f.strategy || (x.c.strategies || []).includes(f.strategy)) && !dateOf(x.c)).length;
  const setDates = patch => setFilter({ ...f, ...patch });
  const toIso = dt => `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
  const [menu, setMenu] = useState(null);   // 'status' | 'date' — the dropdown list that is open
  const shortDay = iso => { const t = new Date(`${iso}T00:00:00`); return isNaN(t) ? iso : t.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }); };
  const dateLabel = !f.basis ? 'Any date'
    : (f.basis === 'opened' ? 'Opened' : 'First funded') + (f.from || f.to ? ` · ${f.from ? shortDay(f.from) : '…'} – ${f.to ? shortDay(f.to) : '…'}` : '');
  const [soaBusy, setSoaBusy] = useState('');
  const [soaMsg, setSoaMsg] = useState(null);   // { email, text } — shown under that investor's SOA button
  const soa = async c => {
    if (soaBusy) return;
    setSoaBusy(c.email); setSoaMsg(null);
    try { await openPdf({ kind: 'soa', email: c.email }, `No SOA has been issued for ${c.name || 'this investor'} yet.`); }
    catch (e) { setSoaMsg({ email: c.email, text: e.status === 404 ? `No SOA has been issued for ${c.name || 'this investor'} yet.` : 'We couldn’t fetch the SOA. Please try again.' }); }
    setSoaBusy('');
  };
  const drop = k => setFilter({ ...f, [k]: undefined, ...(k === 'basis' ? { from: undefined, to: undefined } : null) });
  const chips = [
    f.stage && ['stage', 'Onboarding step: ' + f.stage],
    f.strategy && ['strategy', 'Strategy: ' + f.strategy],
  ].filter(Boolean);

  if (journey.loading && !d) return <View style={{ marginTop: -30 }}><Loading rows={4} h={64} /></View>;
  if (journey.err) return <View style={{ marginTop: -30 }}><ErrorBox msg={'We couldn’t load your investors. Please refresh to try again.'} onRetry={journey.reload} /></View>;
  return (
    <Fade>
      {/* One compact filter card: search, then Status and Date as dropdowns (each opens a short list) */}
      <Card big style={{ marginTop: -34, paddingHorizontal: 14, paddingTop: 4, paddingBottom: clients.length ? 12 : 4 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <TextInput value={q} onChangeText={setQ} placeholder="Search by name or strategy" placeholderTextColor={C.gray}
            autoCapitalize="none" autoCorrect={false} accessibilityLabel="Search your investors" style={{ flex: 1, paddingVertical: 12, fontSize: 14, color: C.ink }} />
          {!!q && <Pressable onPress={() => setQ('')} hitSlop={10} accessibilityLabel="Clear search"><Tx w={700} s={14} c={C.muted}>✕</Tx></Pressable>}
        </View>
        {clients.length > 0 && (
          <View style={{ flexDirection: 'row', gap: 8, paddingTop: 10, borderTopWidth: 1, borderColor: C.hairline }}>
            <Dropdown label="Status" active={status !== 'all'} onPress={() => setMenu('status')}
              value={status === 'all' ? `All · ${clients.length}` : `${(STATUS_ORDER.find(x => x.key === status) || {}).short || status} · ${withStatus.filter(x => x.s.key === status).length}`} />
            <Dropdown label="Date" active={!!f.basis} onPress={() => setMenu('date')} value={dateLabel} />
          </View>
        )}
      </Card>
      {/* The two dates, only once a date type is chosen */}
      {!!f.basis && (
        <View style={{ marginTop: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
            <DateField label="FROM" value={f.from ? new Date(`${f.from}T00:00:00`) : new Date()} max={f.to ? new Date(`${f.to}T00:00:00`) : undefined}
              placeholder={f.from ? '' : 'DD-MM-YYYY'} onChange={dt => setDates({ from: toIso(dt) })} />
            <DateField label="TO" value={f.to ? new Date(`${f.to}T00:00:00`) : new Date()} min={f.from ? new Date(`${f.from}T00:00:00`) : undefined}
              placeholder={f.to ? '' : 'DD-MM-YYYY'} onChange={dt => setDates({ to: toIso(dt) })} />
          </View>
          {undated > 0 && (
            <Tx s={11.5} c={C.muted} style={{ marginTop: 8 }}>{undated} {undated === 1 ? 'investor has' : 'investors have'} no {f.basis === 'opened' ? 'Account Live' : 'First Fund Initiated'} date on record and {undated === 1 ? 'is' : 'are'} not shown.</Tx>
          )}
        </View>
      )}
      <Modal visible={!!menu} transparent animationType="fade" onRequestClose={() => setMenu(null)}>
        <Pressable onPress={() => setMenu(null)} style={{ flex: 1, backgroundColor: 'rgba(0,32,23,0.45)', justifyContent: 'center', padding: 28 }}>
          <Card style={{ paddingVertical: 6, overflow: 'hidden' }}>
            <Tx w={700} s={10} ls={0.12} c={C.muted} style={{ paddingHorizontal: 18, paddingTop: 10, paddingBottom: 6 }}>{menu === 'status' ? 'SHOW INVESTORS' : 'FILTER BY DATE'}</Tx>
            {(menu === 'status'
              ? [{ key: 'all', label: 'All investors', n: clients.length }, ...present.map(x => ({ key: x.key, label: x.label, n: withStatus.filter(y => y.s.key === x.key).length, dot: STATUS_COLOR[x.key], warn: x.tone === 'warn' }))]
              : DATE_BASES.map(([key, label, sub]) => ({ key, label, sub }))
            ).map(o => {
              const on = menu === 'status' ? status === o.key : (f.basis || '') === o.key;
              const pick = () => {
                if (menu === 'status') setStatus(o.key);
                else setDates(o.key ? { basis: o.key } : { basis: undefined, from: undefined, to: undefined });
                setMenu(null);
              };
              return (
                <Pressable key={o.key || 'any'} onPress={pick} accessibilityRole="button" accessibilityState={{ selected: on }}
                  style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, paddingHorizontal: 18, borderTopWidth: 1, borderColor: C.hairline, backgroundColor: on ? 'rgba(2,66,43,0.06)' : pressed ? 'rgba(2,66,43,0.03)' : 'transparent' })}>
                  {!!o.dot && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: o.dot }} />}
                  <View style={{ flex: 1 }}>
                    <Tx w={on ? 700 : 400} s={13} c={o.warn ? C.red : on ? C.green : C.ink}>{o.label}</Tx>
                    {!!o.sub && <Tx s={11} c={C.gray} style={{ marginTop: 1 }}>{o.sub}</Tx>}
                  </View>
                  {o.n != null && <Tx w={700} s={12} c={C.muted}>{o.n}</Tx>}
                  {on && <Tx w={700} s={13} c={C.green}>✓</Tx>}
                </Pressable>
              );
            })}
          </Card>
        </Pressable>
      </Modal>
      <View style={{ marginTop: 12 }}><CrmNotice data={d} /></View>
      {chips.map(([k, label]) => (
        <Pressable key={k} onPress={() => drop(k)} style={{ flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 8, marginBottom: 8, paddingVertical: 7, paddingHorizontal: 12, borderRadius: 999, backgroundColor: C.green }}>
          <Tx w={700} s={11} c={C.cream}>{label}</Tx>
          <Tx w={700} s={12} c={C.gold}>✕</Tx>
        </Pressable>
      ))}
      {clients.length > 0 && rows.length > 0 && (
        <Tx s={11} c={C.gray} style={{ marginTop: 12, marginBottom: 10, marginLeft: 2 }}>
          {rows.length === clients.length ? `${clients.length} investors, largest holdings first` : `Showing ${rows.length} of ${clients.length}`}{dupes ? ` · includes ${dupes} duplicate ${dupes === 1 ? 'record' : 'records'} from the CRM` : ''}
        </Tx>
      )}
      {rows.length === 0 && (
        <Card style={{ padding: 18 }}>
          {clients.length
            ? <Tx s={12.5} c={C.muted} center lh={1.5}>No investors match this view. Try a different search, or choose “All” above.</Tx>
            : <Tx s={12.5} c={C.muted} center lh={1.5}>No investors have joined through your links yet. <Tx w={700} s={12.5} c={C.green} onPress={onLinks}>Share a link</Tx> to get started.</Tx>}
        </Card>
      )}
      {rows.slice(0, shown).map(({ c, s }, i) => {
        const delta = c.currentValue != null && c.investedAmount != null ? c.currentValue - c.investedAmount : null;
        const meta = [c.city, (c.strategies || []).join(', ') || null, c.accountLiveDate ? `${c.currentValue != null ? 'Funded' : 'Account opened'} ${day(c.accountLiveDate)}` : null].filter(Boolean).join(' · ');
        return (
          <Pressable key={(c.email || 'row') + '-' + i} onPress={() => onDetail(c, s)}>
            <Card style={{ marginBottom: 10, borderLeftWidth: 3, borderLeftColor: STATUS_COLOR[s.key] || TONE[s.tone], padding: 14 }}>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Tx w={700} s={13} numberOfLines={1}><Tx s={11} c={C.gray}>{i + 1}.  </Tx>{c.name || '—'}</Tx>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                    <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: STATUS_COLOR[s.key] || TONE[s.tone] }} />
                    <Tx w={700} s={9.5} ls={0.06} c={STATUS_TEXT[s.key] || (s.tone === 'warn' ? C.red : C.green)}>{s.label.toUpperCase()}</Tx>
                  </View>
                  {s.key === 'onboarding' && !!c.onboardingStage && <Tx s={11} c={C.muted} style={{ marginTop: 2 }}>{c.onboardingStage}</Tx>}
                  <Tx s={11} c={C.muted} numberOfLines={2} style={{ marginTop: 3 }}>{meta || 'No details recorded yet'}</Tx>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  {/* Web: today's value (— when none), then the change — or "No holdings yet" where there is no change to show */}
                  {c.currentValue != null ? <Amt s={13}>{inr(c.currentValue)}</Amt> : <Tx w={700} s={13} c={C.muted}>—</Tx>}
                  {delta != null
                    ? <Tx w={700} s={11} c={delta >= 0 ? '#008455' : C.red} style={{ marginTop: 2 }}>{delta >= 0 ? '▲' : '▼'} {inr(Math.abs(delta))}</Tx>
                    : <Tx s={11} c={C.muted} style={{ marginTop: 2 }}>No holdings yet</Tx>}
                  <View style={{ marginTop: 8 }}><ChevronRight /></View>
                </View>
              </View>
              {/* Footer (web: "View account" and "SOA" buttons on each investor): View account on the left, SOA on the right */}
              <View style={{ marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderColor: C.hairline, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  {c.clientCode ? (
                    <Pressable onPress={() => view.open(c)} hitSlop={4} accessibilityRole="button" accessibilityLabel={`View ${c.name || 'this investor'}'s account`}
                      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, paddingLeft: 14, paddingRight: 10, borderRadius: 999, backgroundColor: C.green,
                        shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 2,
                        opacity: view.opening && view.opening !== c.clientCode ? 0.5 : pressed ? 0.85 : 1, transform: [{ scale: pressed ? 0.97 : 1 }] })}>
                      <Tx w={700} s={11.5} c={C.gold}>{view.opening === c.clientCode ? 'Opening…' : 'View account'}</Tx>
                      <Tx s={10.5} c="rgba(239,236,211,0.7)">{c.clientCode}</Tx>
                      <ChevronRight s={9} c={C.gold} />
                    </Pressable>
                  ) : (
                    // No portal client code for this investor yet (still onboarding, or their accounts are not in the portal yet): nothing to open
                    <View accessibilityLabel="Not in the portal yet" style={{ paddingVertical: 8, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1, borderStyle: 'dashed', borderColor: C.mutedBorder35 }}>
                      <Tx w={700} s={11.5} c={C.gray}>Not in portal yet</Tx>
                    </View>
                  )}
                  <View style={{ flex: 1 }} />
                  {!!c.email && (
                    <Pressable onPress={() => soa(c)} hitSlop={4} accessibilityRole="button" accessibilityLabel={`Download ${c.name || 'this investor'}'s SOA`}
                      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 7, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1, borderColor: C.greenBorder || 'rgba(2,66,43,0.35)',
                        backgroundColor: pressed ? 'rgba(2,66,43,0.06)' : 'transparent', opacity: soaBusy && soaBusy !== c.email ? 0.5 : 1 })}>
                      <Download s={12} c={C.green} />
                      <Tx w={700} s={11.5} c={C.green}>{soaBusy === c.email ? 'Fetching…' : 'SOA'}</Tx>
                    </Pressable>
                  )}
                </View>
              {view.errFor === c.clientCode && !!view.err && (
                <View style={{ marginTop: 8, padding: 10, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(239,68,68,0.4)', backgroundColor: 'rgba(239,68,68,0.05)' }}>
                  <Tx s={11.5} c={C.red} lh={1.5}>{view.err}</Tx>
                </View>
              )}
              {!!soaMsg && soaMsg.email === c.email && (
                <View style={{ marginTop: 8, padding: 10, borderRadius: 8, borderWidth: 1, borderColor: C.gold35, backgroundColor: 'rgba(218,189,56,0.08)' }}>
                  <Tx s={11.5} c={C.muted} lh={1.5}>{soaMsg.text}</Tx>
                </View>
              )}
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
// Web's date filter choices (investors page): what the From / To range applies to.
const DATE_BASES = [['', 'Any date', 'Show every investor'], ['opened', 'Account opened between', 'By the Account Live date'], ['invested', 'First Fund Initiated between', 'By the date the first money arrived']];
// A compact dropdown button: small label above the current choice, chevron on the right; green when filtering.
function Dropdown({ label, value, active, onPress }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${label}: ${value}. Change`}
      style={({ pressed }) => ({ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 7, paddingHorizontal: 11, borderRadius: 10, borderWidth: 1,
        borderColor: active ? C.green : C.mutedBorder35, backgroundColor: active ? 'rgba(2,66,43,0.06)' : pressed ? 'rgba(2,66,43,0.03)' : 'transparent' })}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Tx w={700} s={9} ls={0.1} c={C.muted}>{label.toUpperCase()}</Tx>
        <Tx w={700} s={12.5} c={active ? C.green : C.ink} numberOfLines={1} style={{ marginTop: 1 }}>{value}</Tx>
      </View>
      <ChevronDown s={10} c={active ? C.green : C.muted} />
    </Pressable>
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
          <Tx s={12.5} c={C.muted} center lh={1.6}>Your referral links haven’t been set up yet. Email <Tx w={700} s={12.5} c={C.green} onPress={() => Linking.openURL('mailto:partnerships@qodeinvest.com').catch(() => {})}>partnerships@qodeinvest.com</Tx> and we’ll create them for you.</Tx>
        </Card>
      ) : (<>
        <LinkCard title="For an individual" sub="A person investing in their own name" url={L.individual} />
        <LinkCard title="For a company, LLP, HUF or trust" sub="Anything that is not an individual" url={L.nonIndividual} />
      </>)}
      {/* Web: the contact card under the links */}
      <Pressable onPress={() => Linking.openURL('mailto:partnerships@qodeinvest.com').catch(() => {})} accessibilityRole="button">
        <Card style={{ padding: 16, marginTop: 12, flexDirection: 'row', gap: 12 }}>
          <View style={{ marginTop: 2 }}><MailIcon /></View>
          <View style={{ flex: 1 }}>
            <Tx w={700} s={13}>Questions about your investors or payouts?</Tx>
            <Tx s={11.5} c={C.muted} lh={1.5} style={{ marginTop: 3 }}>Email partnerships@qodeinvest.com — we usually reply the same day.</Tx>
          </View>
        </Card>
      </Pressable>
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

const MORE_ICON = { links: IconShare, decks: IconFile, policies: IconShield, ticket: IconLifeBuoy };
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
            {MORE_ICON[k] && <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(2,66,43,0.08)', alignItems: 'center', justifyContent: 'center' }}>{React.createElement(MORE_ICON[k], { c: C.green, s: 18 })}</View>}
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
      <SignOutButton onPress={V.doLogout} />
    </Fade>
  );
}
