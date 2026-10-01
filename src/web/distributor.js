// Desktop distributor dashboard for the web build (browser ≥ 1024 px wide). Replaces the phone partner screens
// (src/screens/distributor.js + src/screens/partner.js) on a wide screen, in the investor desktop's design system
// (src/web/kit.js, shell as src/web/desktop.js): dark green sidebar, cream canvas, ivory panels.
// Every figure, rule and handler is the phone app's: the data calls (api.distributor), the vocabulary and filters
// (statusFor, bookFigures, filterInvestors), the fee maths (summarise, statementOf, invoiceFigures), the printable
// statement / invoice (statementDoc().html, invoiceHtml) and savePdf, which prints them from a hidden frame on the
// web. Only the layout is new. "View account" uses V.viewInvestor, as on the phone; the investor's desktop then
// shows "Back to distributor panel", and V.partnerNav brings the distributor back to the page they left.
// Address: /app/d/<section> (replaced as the section changes; Back is main.js's, via useBackHandler).
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { View, ScrollView, Pressable, Linking } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Clipboard from 'expo-clipboard';
import { Wordmark, useBackHandler } from '../ui';
import { Refresh, ChevronLeft, ChevronRight, ChevronDown, Download, DocIcon, MailIcon, Phone, Copy } from '../icons';
import { Donut } from '../screens/charts';
import { distributor as api, BASE_URL } from '../api';
import { useLoad, openUrl } from '../screens/kit';
import { inr, fmtDate } from '../adapt';
import * as content from '../content';
import { GST_STATE_CODES, QODE_ENTITY, qodeAddressLines, isQodeEntityComplete, amountInWords } from '../partnerTax';
import {
  S, STATUS_ORDER, ONBOARDING_SEQUENCE, statusFor, fundedDate, STATUS_COLOR, STATUS_TEXT, INFLOW_RANGES, inflowRanges, DATE_BASES,
  bookFigures, filterInvestors, IconDashboard, IconUsers, IconCalculator, IconLineChart, IconShare, IconFile, IconShield, IconLifeBuoy,
} from '../screens/distributor';
import {
  money, warmPartnerData, defaultPeriod, summarise, usePeriodRows, statementDoc, invoiceFigures, invoiceHtml, savePdf, feesCsvLines,
  STRATEGY_COLOR, shortStrategy, ACCOUNT_JOURNEY, num, inrCompact, displayDate, SCHEME, SCHEME_COLOR, code3, parseBillgroup,
  EMPTY_PROFILE, todayIst, validateProfile, DECKS, SEGMENTS, toSeries, VsiChart, RISK_OFF, RISK_ON, VSI, ddmmyyyy, TOPICS,
} from '../screens/partner';
import { C, Tx, Amt, Card, Row, Grid, Panel, Stat, DarkCard, Label, TextLink, Table, Loading, ErrorBlock, Empty, Btn, PageIntro, Chips, Input, KeyVals, Pill, Dialog, FitAmt, Dropdown } from './kit';
import { ClientReportsDialog } from './clientReports';

/* ── sections, addresses ────────────────────────────────────────────────────────────────────────────────── */
const DocSmall = ({ c, s }) => <DocIcon s={s || 18} c={c} w={1.6} />;
const NAV = [
  { key: 'overview', label: 'Overview', Icon: IconDashboard },
  { key: 'investors', label: 'Investors', Icon: IconUsers },
  { key: 'fees', label: 'Fees', Icon: IconCalculator },
  { key: 'statement', label: 'Fee statement', Icon: DocSmall },
  { key: 'invoice', label: 'Invoices', Icon: DocSmall },
  { key: 'links', label: 'Onboarding links', Icon: IconShare },
  { key: 'decks', label: 'Sales decks', Icon: IconFile },
  { key: 'indicators', label: 'Indicators', Icon: IconLineChart },
  { key: 'support', label: 'Support', Icon: IconLifeBuoy },
  { key: 'policies', label: 'Risk and controls', Icon: IconShield },
  { key: 'profile', label: 'Profile', Icon: ({ c }) => <UserGlyph c={c} /> },
];
const GROUPS = [['Your book', ['overview', 'investors']], ['Earnings', ['fees', 'statement', 'invoice']], ['Resources', ['links', 'decks', 'indicators']], ['Help', ['support', 'policies', 'profile']]];
const TITLES = { overview: 'Overview', investors: 'Investors', fees: 'Your fees', statement: 'Fee statement', invoice: 'Invoices', links: 'Onboarding links', decks: 'Sales decks', indicators: 'Market indicators', support: 'Support', policies: 'Risk and controls', profile: 'Profile' };
const SECTIONS = NAV.map(n => n.key);
const BASE = '/app/d/';
const web = typeof window !== 'undefined' && typeof history !== 'undefined' && typeof location !== 'undefined';
const sectionFromUrl = () => {
  if (!web) return null;
  const m = location.pathname.match(/^\/app\/d\/([\w-]+)/);
  return m && SECTIONS.includes(m[1]) ? m[1] : null;
};

const UserGlyph = ({ c, s = 18 }) => (
  <View style={{ width: s, height: s, alignItems: 'center', justifyContent: 'flex-end' }}>
    <View style={{ width: s * 0.42, height: s * 0.42, borderRadius: s, borderWidth: 1.6, borderColor: c, marginBottom: 1.5 }} />
    <View style={{ width: s * 0.78, height: s * 0.36, borderTopLeftRadius: s, borderTopRightRadius: s, borderWidth: 1.6, borderBottomWidth: 0, borderColor: c }} />
  </View>
);

/* ── helpers ────────────────────────────────────────────────────────────────────────────────────────────── */
// Sentence case for CRM values ("First Fund Initiated" → "First fund initiated"), keeping acronyms (CML).
const noSept = t => String(t || '').replace(/\bSept\b/g, 'Sep');
// Fee periods come from the calculator as "1-Apr-26"; everything else is ISO.
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const dday = x => {
  const m = /^(\d{1,2})-([A-Za-z]{3})-(\d{2}|\d{4})$/.exec(String(x || '').trim());
  if (m && MON.includes(m[2])) return `${m[1].padStart(2, '0')} ${m[2]} ${m[3].length === 2 ? '20' + m[3] : m[3]}`;
  return noSept(displayDate(x));
};
const sc = t => String(t || '').split(' ').map((w, i) => (i === 0 || /^[A-Z0-9]{2,}$/.test(w) || /^(Nuvama|Qode|Zoho)$/.test(w) ? w : w.toLowerCase())).join(' ');
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
const PARTNERSHIPS = 'partnerships@qodeinvest.com';
const mail = to => Linking.openURL('mailto:' + to).catch(() => {});

// PDFs behind a signed 5-minute link (SOA, decks): a tab is opened on the click itself so the browser does not
// block it, then pointed at the file once the link is back.
async function openFile(body, fail) {
  const w = web ? window.open('', '_blank') : null;
  try {
    const r = await api.fileLink(body);
    if (!r || !r.url) throw new Error(fail);
    if (w) w.location.href = BASE_URL + r.url; else openUrl(BASE_URL + r.url);
  } catch (e) { if (w) w.close(); throw e; }
}
function downloadText(name, text, type) {
  if (!web) return;
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

const Dot = ({ color, s = 8, sq }) => <View style={{ width: s, height: s, borderRadius: sq ? 2 : s / 2, backgroundColor: color }} />;
const Notice = ({ children, tone = 'info', style }) => (
  <View style={[{ padding: 14, borderRadius: 10, borderWidth: 1, borderColor: tone === 'bad' ? 'rgba(194,54,47,0.35)' : 'rgba(218,189,56,0.5)', backgroundColor: tone === 'bad' ? C.redTint : C.goldTint }, style]}>
    {typeof children === 'string' ? <Tx s={13} c={tone === 'bad' ? C.red : C.ink2} lh={1.55}>{children}</Tx> : children}
  </View>
);
function StatusTag({ s, sub }) {
  return (
    <View style={{ minWidth: 0, alignSelf: 'stretch' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
        <Dot color={STATUS_COLOR[s.key]} />
        <Tx w={600} s={12.5} c={STATUS_TEXT[s.key] || C.ink} numberOfLines={1} style={{ flexShrink: 1, minWidth: 0 }}>{sc(s.label)}</Tx>
      </View>
      {!!sub && <Tx s={11.5} c={C.ink3} numberOfLines={1} style={{ marginTop: 2, marginLeft: 15 }}>{sub}</Tx>}
    </View>
  );
}
const iconBtn = ({ hovered }) => ({ width: 36, height: 36, borderRadius: 8, borderWidth: 1, borderColor: C.line2, backgroundColor: hovered ? C.hover : C.card, alignItems: 'center', justifyContent: 'center' });
// A dd/mm/yyyy date field. The browser's own date input always shows the browser's locale order (mm/dd/yyyy on
// en-US), so the text is typed here and the native picker is kept only behind the calendar button.
const isoToDmy = iso => (iso ? iso.slice(8, 10) + '/' + iso.slice(5, 7) + '/' + iso.slice(0, 4) : '');
function dmyToIso(t) {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(t);
  if (!m) return null;
  const iso = `${m[3]}-${m[2]}-${m[1]}`;
  const d = new Date(iso + 'T00:00:00');
  return !Number.isNaN(d.getTime()) && d.getDate() === +m[1] && d.getMonth() + 1 === +m[2] ? iso : null;
}
function DateInput({ label, value, onChange, min, max }) {
  const [text, setText] = useState(isoToDmy(value));
  const picker = useRef(null);
  useEffect(() => { setText(isoToDmy(value)); }, [value]);
  const type = raw => {
    const dg = raw.replace(/\D/g, '').slice(0, 8);
    const t = dg.length > 4 ? `${dg.slice(0, 2)}/${dg.slice(2, 4)}/${dg.slice(4)}` : dg.length > 2 ? `${dg.slice(0, 2)}/${dg.slice(2)}` : dg;
    setText(t);
    if (!t) onChange('');
    else { const iso = dmyToIso(t); if (iso) onChange(iso); }
  };
  const bad = text.length === 10 && !dmyToIso(text);
  return (
    <View style={{ flex: 1, minWidth: 0 }}>
      {!!label && <Tx w={600} s={12.5} c={C.ink2} style={{ marginBottom: 6 }}>{label}</Tx>}
      {React.createElement('div', { style: { position: 'relative' } },
        React.createElement('input', {
          type: 'text', inputMode: 'numeric', placeholder: 'dd/mm/yyyy', value: text, 'aria-label': label ? label + ' (dd/mm/yyyy)' : 'Date (dd/mm/yyyy)',
          onChange: e => type(e.target.value),
          style: { height: 42, border: '1px solid ' + (bad ? C.red : C.line2), borderRadius: 8, padding: '0 40px 0 10px', fontFamily: 'Inter_400Regular', fontSize: 14, color: C.ink, background: C.card, width: '100%', boxSizing: 'border-box', outline: 'none' },
        }),
        React.createElement('input', {
          ref: picker, type: 'date', tabIndex: -1, 'aria-hidden': true, value: value || '', min: min || undefined, max: max || undefined,
          onChange: e => onChange(e.target.value || ''),
          style: { position: 'absolute', right: 0, bottom: 0, width: 1, height: 1, opacity: 0, pointerEvents: 'none', border: 0, padding: 0 },
        }),
        React.createElement('button', {
          type: 'button', 'aria-label': 'Open calendar',
          onClick: () => { const el = picker.current; if (!el) return; try { el.showPicker(); } catch { el.focus(); el.click(); } },
          style: { position: 'absolute', right: 4, top: 4, width: 34, height: 34, border: 0, borderRadius: 6, background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.ink2 },
        }, React.createElement('svg', { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' },
          React.createElement('rect', { x: 3, y: 4, width: 18, height: 18, rx: 2 }),
          React.createElement('path', { d: 'M16 2v4M8 2v4M3 10h18' }))),
      )}
      {bad && <Tx s={11.5} c={C.red} style={{ marginTop: 4 }}>Not a real date</Tx>}
    </View>
  );
}
// Clickable list row with a bar under it (status and strategy breakdowns open the filtered investor list).
function BarRow({ color, label, sub, value, count, pct, onPress }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ hovered }) => ({ paddingVertical: 8, paddingHorizontal: 10, marginHorizontal: -10, borderRadius: 8, backgroundColor: hovered ? C.hover : 'transparent' })}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}>
        <Dot color={color} sq />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Tx w={600} s={13} numberOfLines={1}>{label}</Tx>
          {!!sub && <Tx s={11.5} c={C.ink3} numberOfLines={1}>{sub}</Tx>}
        </View>
        {!!value && <Amt s={12.5} c={C.ink2}>{value}</Amt>}
        <Amt w={600} s={13} style={{ minWidth: 44, textAlign: 'right' }}>{count}</Amt>
        <ChevronRight s={11} c={C.ink3} />
      </View>
      <View style={{ height: 5, borderRadius: 3, backgroundColor: C.track, marginTop: 7, marginLeft: 17, overflow: 'hidden' }}>
        <View style={{ width: Math.max(1.5, Math.min(100, pct || 0)) + '%', height: 5, borderRadius: 3, backgroundColor: color }} />
      </View>
    </Pressable>
  );
}

/* ── frame ──────────────────────────────────────────────────────────────────────────────────────────────── */
function Sidebar({ V, active, onNav }) {
  const name = (V.user && V.user.name) || '';
  const initials = String(name).split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();
  return (
    <LinearGradient colors={['#02422B', '#002017', '#000000']} locations={[0, 0.6, 1]} start={{ x: 0, y: 0 }} end={{ x: 0.4, y: 1 }} style={{ width: 248, paddingTop: 22, paddingBottom: 16 }}>
      <View style={{ paddingHorizontal: 22 }}><Wordmark s={28} c={C.cream} /></View>
      <Tx s={11.5} c="rgba(239,236,211,0.55)" style={{ paddingHorizontal: 22, marginTop: 2 }}>Qode Advisors LLP · Distributor</Tx>
      <View style={{ width: 34, height: 2, backgroundColor: C.gold, marginTop: 12, marginLeft: 22 }} />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ marginTop: 18, paddingHorizontal: 12, gap: 14, paddingBottom: 12 }}>
        {GROUPS.map(([g, keys]) => (
          <View key={g}>
            <Tx w={600} s={11.5} c="rgba(239,236,211,0.45)" style={{ paddingHorizontal: 10, marginBottom: 4 }}>{g}</Tx>
            {keys.map(k => NAV.find(n => n.key === k)).map(n => {
              const on = active === n.key;
              return (
                <Pressable key={n.key} accessibilityRole="link" accessibilityState={{ selected: on }} onPress={() => onNav(n.key)} style={({ hovered }) => ({
                  flexDirection: 'row', alignItems: 'center', gap: 11, height: 36, paddingHorizontal: 10, borderRadius: 8,
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
      </ScrollView>
      {V.testMode && (
        <View style={{ marginHorizontal: 22, marginBottom: 12, backgroundColor: C.redTint, borderRadius: 6, paddingVertical: 5, alignItems: 'center' }}>
          <Tx w={600} s={11.5} c={C.red}>Test mode</Tx>
        </View>
      )}
      <View style={{ marginHorizontal: 12, borderTopWidth: 1, borderColor: 'rgba(239,236,211,0.12)', paddingTop: 14, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(218,189,56,0.16)', alignItems: 'center', justifyContent: 'center' }}>
          <Tx w={600} s={12} c={C.gold}>{initials || 'Q'}</Tx>
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

function TopBar({ V, title, asOf, busy, onRefresh }) {
  return (
    <View style={{ height: 64, paddingHorizontal: 28, flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: 1, borderColor: C.line, backgroundColor: C.card }}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Tx w={600} s={19} role="heading" aria-level={1} numberOfLines={1}>{title}</Tx>
        <Tx s={12} c={C.ink3} numberOfLines={1}>{asOf ? 'Values as of ' + asOf : 'Your distributor dashboard'}</Tx>
      </View>
      <Pressable accessibilityRole="button" onPress={onRefresh} accessibilityLabel="Refresh" style={s => [iconBtn(s), { opacity: busy ? 0.45 : 1 }]}><Refresh c={C.ink2} s={16} /></Pressable>
      <Btn label="Sign out" kind="outline" small onPress={V.doLogout} style={{ marginLeft: 4 }} />
    </View>
  );
}

/* ── root ───────────────────────────────────────────────────────────────────────────────────────────────── */
export default function DesktopDistributor({ V }) {
  const back = V.partnerNav || {};   // where the distributor was before "View account"
  const [section, setSection] = useState(() => (SECTIONS.includes(back.tab) ? back.tab : null) || sectionFromUrl() || 'overview');
  const [filter, setFilter] = useState(back.filter || null);   // investor filter opened from the Overview
  const [sub, setSub] = useState(back.sub || null);            // { kind: 'detail', c, st }
  const [tick, setTick] = useState(0);
  const [picked, setPeriod] = useState(null);                  // shared by Fees, Fee statement and Invoices
  useEffect(() => { warmPartnerData(); }, []);
  const journey = useLoad(() => api.journey(), [tick]);
  const split = useLoad(() => api.strategyAum(), [tick]);
  const periods = useLoad(() => api.feePeriods(), []);
  const period = picked || (periods.data ? defaultPeriod(periods.data) : null);   // the phone's default until one is picked
  const name = (V.user && V.user.name) || 'Distributor';
  const valuedOn = split.data && split.data.valuedOn;

  const go = (k, f = null) => { setSection(k); setSub(null); setFilter(f); };

  // Address: /app/d/<section>, so a refresh or a shared link lands on the same page. It is replaced, not pushed:
  // the browser's Back button belongs to main.js (it keeps one history entry ahead and asks handleBack()), which
  // runs this handler first: close an investor, then return to the Overview, then main.js's own rules.
  useEffect(() => {
    if (!web) return;
    const want = BASE + section;
    if (location.pathname !== want) history.replaceState(history.state, '', want);
    document.title = TITLES[section] + ' | myQode';
  }, [section]);
  useBackHandler(() => {
    if (sub) { setSub(null); return true; }
    if (section !== 'overview') { go('overview'); return true; }
    return false;
  });
  const scrollRef = useRef(null);
  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTo({ y: 0, animated: false }); }, [section, sub]);

  // "View account": the investor's own dashboard, read-only (V.viewInvestor, as on the phone). Errors show where the
  // button was pressed.
  const [opening, setOpening] = useState('');
  const [openErr, setOpenErr] = useState(null);   // { code, text }
  const viewAccount = async c => {
    if (opening || !c.clientCode) return;
    setOpening(c.clientCode); setOpenErr(null);
    const prev = web ? location.pathname : '';
    // The investor dashboard reads its own address on mount; hand it a clean /app so it opens on its Overview.
    if (web) history.replaceState(history.state, '', '/app');
    try { await V.viewInvestor(c.clientCode, { tab: section, filter, sub }); }
    catch (e) {
      if (web) history.replaceState(history.state, '', prev);
      setOpenErr({ code: c.clientCode, text: e.status === 403 ? (e.message || 'This investor is not in your book.')
        : e.status === 503 ? (e.message || 'We couldn’t confirm this investor just now. Please try again in a few minutes.')
        : `We couldn’t open ${c.name || 'that'} account just now. Please try again.` });
      setOpening('');
    }
  };
  const view = { opening, err: openErr, open: viewAccount };
  const openDetail = (c, st) => { setOpenErr(null); setSection('investors'); setFilter(null); setSub({ kind: 'detail', c, st: st || statusFor(c.stage, c.onboardingStage) }); };

  let body;
  if (section === 'overview') body = <Overview journey={journey} split={split} periods={periods} onOpen={f => go('investors', f)} onDetail={openDetail} go={go} />;
  else if (section === 'investors' && sub && sub.kind === 'detail') body = <InvestorPage c={sub.c} status={sub.st} view={view} onBack={() => { setOpenErr(null); setSub(null); }} />;
  else if (section === 'investors') body = <Investors journey={journey} filter={filter} setFilter={setFilter} onDetail={openDetail} view={view} onLinks={() => go('links')} />;
  else if (section === 'fees') body = <Fees periods={periods} period={period} setPeriod={setPeriod} go={go} />;
  else if (section === 'statement') body = <StatementPage periods={periods} period={period} setPeriod={setPeriod} name={name} go={go} />;
  else if (section === 'invoice') body = <InvoicePage periods={periods} period={period} setPeriod={setPeriod} name={name} />;
  else if (section === 'links') body = <Links journey={journey} />;
  else if (section === 'decks') body = <Decks />;
  else if (section === 'indicators') body = <Indicators />;
  else if (section === 'support') body = <Support />;
  else if (section === 'policies') body = <Policies />;
  else body = <Profile V={V} journey={journey} go={go} />;

  return (
    <View style={{ flex: 1, flexDirection: 'row', backgroundColor: C.cream }}>
      <Sidebar V={V} active={section} onNav={k => go(k)} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <TopBar V={V} title={section === 'investors' && sub ? (sub.c.name || 'Investor') : TITLES[section]} asOf={valuedOn ? fmtDate(valuedOn) : ''}
          busy={journey.loading || split.loading} onRefresh={() => setTick(t => t + 1)} />
        <ScrollView ref={scrollRef} style={{ flex: 1 }} contentContainerStyle={{ padding: 28, paddingBottom: 48 }}>
          <View style={{ maxWidth: 1680, width: '100%' }}>{body}</View>
        </ScrollView>
      </View>
    </View>
  );
}

/* ── Overview ───────────────────────────────────────────────────────────────────────────────────────────── */
function CrmNotice({ d, style }) {
  if (!d) return null;
  if (!d.zohoAvailable) return <Notice style={style}>We couldn’t load your investor data just now. Your links and account counts are still correct. Please refresh in a few minutes.</Notice>;
  if (!d.crmLinked) return <Notice style={style}>{`Your login address is not yet linked to your distributor record, so your ${d.portalClientCount || ''} client accounts cannot be listed here. Email ${PARTNERSHIPS} and we will link it.`}</Notice>;
  return null;
}

const onDark = (col) => (col === C.red ? '#FCA5A5' : col === C.pos ? '#86EFAC' : C.cream);
function DarkBtn({ label, onPress, gold }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ hovered }) => ({ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 34, paddingHorizontal: 14, borderRadius: 8, borderWidth: 1,
      borderColor: gold ? C.gold : hovered ? C.gold : 'rgba(239,236,211,0.3)', backgroundColor: gold ? (hovered ? '#e8cc4e' : C.gold) : hovered ? 'rgba(239,236,211,0.06)' : 'transparent' })}>
      <Tx w={600} s={12.5} c={gold ? C.ink : C.cream}>{label}</Tx>
    </Pressable>
  );
}

function Overview({ journey, split, periods, onOpen, onDetail, go }) {
  const d = journey.data;
  const F = useMemo(() => bookFigures(d, split.data), [d, split.data]);
  // The latest fee period's commission (the phone's Fees default), for the headline strip.
  const feeP = periods.data ? defaultPeriod(periods.data) : null;
  const fee = useLoad(() => (feeP ? api.feeRows(feeP) : Promise.resolve(null)), [feeP && feeP.label]);
  const feeT = useMemo(() => summarise(Array.isArray(fee.data) ? fee.data : []).totals, [fee.data]);

  if (journey.loading && !d) return <Loading rows={5} />;
  if (journey.err) return <ErrorBlock msg={`We couldn’t load your overview. Please refresh, or email ${PARTNERSHIPS} if this keeps happening.`} onRetry={journey.reload} />;
  const t = d.totals || {};
  const live = d.crmLinked && d.zohoAvailable;
  const gain = t.invested != null && t.currentValue != null ? t.currentValue - t.invested : null;
  const gainPct = gain != null && t.invested ? (gain / t.invested) * 100 : null;
  const Div = () => <View style={{ width: 1, alignSelf: 'stretch', backgroundColor: 'rgba(239,236,211,0.14)' }} />;
  const cell = (label, value, note, color, onPress) => (
    <Pressable disabled={!onPress} onPress={onPress} style={({ hovered }) => ({ flex: 1, paddingHorizontal: 20, justifyContent: 'center', opacity: hovered && onPress ? 0.8 : 1 })}>
      <Label c="rgba(239,236,211,0.6)">{label}</Label>
      <FitAmt w={600} s={20} c={onDark(color)} style={{ marginTop: 6 }}>{value}</FitAmt>
      {!!note && <Tx s={11.5} c="rgba(239,236,211,0.55)" numberOfLines={1} style={{ marginTop: 3 }}>{note}</Tx>}
    </Pressable>
  );

  return (
    <View style={{ gap: 20 }}>
      {!live && <CrmNotice d={d} />}
      {!live && (
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Btn label="All investors" onPress={() => onOpen(null)} />
          <Btn kind="outline" label="Onboarding links" onPress={() => go('links')} />
        </View>
      )}
      {live && (
        <DarkCard style={{ flexDirection: 'row', paddingVertical: 22, paddingHorizontal: 0 }}>
          <View style={{ flex: 1.5, paddingHorizontal: 24, justifyContent: 'center' }}>
            <Label c="rgba(239,236,211,0.6)">Total value today</Label>
            <FitAmt w={600} s={30} min={18} c={C.cream} style={{ marginTop: 6, letterSpacing: -0.6 }}>{money(t.currentValue)}</FitAmt>
            <View style={{ width: 34, height: 2, backgroundColor: C.gold, marginTop: 10 }} />
            {gain != null && gainPct != null
              ? <Tx s={12} c="rgba(239,236,211,0.7)" style={{ marginTop: 8 }}><Tx w={600} s={12} c={onDark(gain >= 0 ? C.pos : C.red)}>{gain >= 0 ? '+' : '−'}{money(Math.abs(gain))} ({gain >= 0 ? '+' : '−'}{Math.abs(gainPct).toFixed(1)}%)</Tx> against {money(t.invested)} put in</Tx>
              : <Tx s={12} c="rgba(239,236,211,0.6)" style={{ marginTop: 8 }}>Across everyone who joined through your links</Tx>}
          </View>
          <Div />
          {cell('Your investors', String(t.investors || 0), 'Joined through your links', null, () => onOpen(null))}
          <Div />
          {cell('First fund initiated', String(F.investedCount), 'Money in the market', C.pos, () => onOpen({ status: 'invested' }))}
          <Div />
          {cell('Not yet funded', String(F.notYet), 'Account live or onboarding', null, () => onOpen(null))}
          <Div />
          {cell(feeP ? 'Commission, ' + feeP.label : 'Commission', !feeP || fee.loading ? '…' : fee.err ? '–' : inrCompact(feeT.shareNet), 'Before GST', null, () => go('fees'))}
          <Div />
          <View style={{ paddingHorizontal: 20, justifyContent: 'center', gap: 8 }}>
            <DarkBtn gold label="All investors" onPress={() => onOpen(null)} />
            <DarkBtn label="Onboarding links" onPress={() => go('links')} />
          </View>
        </DarkCard>
      )}

      {live && (
        <Row>
          {F.monthlyInflow.length >= 2 && <InflowPanel data={F.monthlyInflow} onOpen={onOpen} />}
          <StrategyPanel split={split} strat={F.strat} onOpen={onOpen} style={{ flex: F.monthlyInflow.length >= 2 ? 1 : 1.2 }} />
          {F.monthlyInflow.length < 2 && <StatusPanel F={F} onOpen={onOpen} />}
        </Row>
      )}
      {live && (
        <Row>
          {F.monthlyInflow.length >= 2 && <StatusPanel F={F} onOpen={onOpen} />}
          <RecentPanel F={F} onDetail={onDetail} onOpen={onOpen} />
        </Row>
      )}
      {live && F.journeySteps.length > 0 && <JourneyPanel steps={F.journeySteps} onOpen={onOpen} />}
    </View>
  );
}

const yTick = v => (v >= 10000000 ? `${(v / 10000000).toFixed(1)} Cr` : `${Math.round(v / 100000)} L`);
function niceMax(m) { if (m <= 0) return 1; const p = Math.pow(10, Math.floor(Math.log10(m))); const f = m / p; return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * p; }

// "Money you have brought in": one bar per month (web: bar chart, tooltip on hover, click lists that month's investors).
function InflowPanel({ data: all, onOpen }) {
  const [range, setRange] = useState('all');
  const def = INFLOW_RANGES.find(r => r.key === range) || INFLOW_RANGES[0];
  const data = def.months == null ? all : all.slice(-def.months);
  const [hover, setHover] = useState(null);
  const pt = data.find(x => x.month === hover) || null;
  const top = niceMax(Math.max(1, ...data.map(x => x.amount)));
  const ticks = [top, top * 0.75, top * 0.5, top * 0.25, 0];
  const H = 200, every = Math.max(1, Math.ceil(data.length / 12));
  const see = p => { const [yy, mm] = p.month.split('-').map(Number); onOpen({ basis: 'invested', from: p.month + '-01', to: new Date(Date.UTC(yy, mm, 0)).toISOString().slice(0, 10) }); };
  const total = data.reduce((n, x) => n + x.amount, 0);
  return (
    <Panel title="Money you have brought in" sub="By the month each investor started investing" style={{ flex: 2, minWidth: 0 }}
      right={inflowRanges(all.length).length ? <Chips value={range} options={inflowRanges(all.length).map(r => [r.key, r.label])} onChange={k => { setRange(k); setHover(null); }} /> : null}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 22, marginBottom: 10 }}>
        {pt ? (<>
          <Tx w={600} s={13}>{noSept(pt.label)}</Tx>
          <Tx s={13} c={C.ink2}>{money(pt.amount)} from {plural(pt.investors, 'investor', 'investors')}</Tx>
          {pt.investors > 0 && <TextLink label="See these investors" onPress={() => see(pt)} />}
        </>) : <Tx s={12.5} c={C.ink3}>{money(total)} in this range. Point at a bar for its month; click it to list those investors.</Tx>}
      </View>
      <View style={{ flexDirection: 'row' }}>
        <View style={{ width: 48, height: H, justifyContent: 'space-between', paddingRight: 8 }}>
          {ticks.map((v, i) => <Tx key={i} s={10.5} c={C.ink3} style={{ textAlign: 'right', marginTop: i === 0 ? -6 : 0, marginBottom: i === ticks.length - 1 ? -6 : 0 }}>{yTick(v)}</Tx>)}
        </View>
        <View style={{ flex: 1 }}>
          <View style={{ position: 'absolute', left: 0, right: 0, top: 0, height: H, justifyContent: 'space-between' }}>
            {ticks.map((_, i) => <View key={i} style={{ height: 1, backgroundColor: i === ticks.length - 1 ? C.line2 : C.line }} />)}
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 3, height: H }}>
            {data.map(x => {
              const on = hover === x.month;
              return (
                <Pressable key={x.month} accessibilityRole="button" accessibilityLabel={`${noSept(x.label)}: ${money(x.amount)}`}
                  onHoverIn={() => setHover(x.month)} onPress={() => (x.investors > 0 ? see(x) : setHover(x.month))}
                  style={{ flex: 1, height: '100%', alignItems: 'center', justifyContent: 'flex-end' }}>
                  <View style={{ width: '76%', maxWidth: 34, height: x.amount > 0 ? Math.max(3, (x.amount / top) * H) : 2, borderTopLeftRadius: 3, borderTopRightRadius: 3,
                    backgroundColor: x.amount > 0 ? (on ? C.green : '#008455') : C.line2, opacity: hover && !on ? 0.55 : 1 }} />
                </Pressable>
              );
            })}
          </View>
          <View style={{ flexDirection: 'row', gap: 3, marginTop: 6 }}>
            {data.map((x, i) => <Tx key={x.month} s={10.5} c={hover === x.month ? C.ink : C.ink3} numberOfLines={1} style={{ flex: 1, textAlign: 'center' }}>{i % every === 0 ? noSept(x.label) : ''}</Tx>)}
          </View>
        </View>
      </View>
    </Panel>
  );
}

function StrategyPanel({ split, strat, onOpen, style }) {
  const sum = strat.rows.reduce((n, r) => n + (r.value > 0 ? r.value : 0), 0);
  return (
    <Panel title="Which strategies they hold" sub={strat.exact ? 'Value held in each strategy today' : 'Value split evenly across strategies, so indicative'} style={[{ flex: 1, minWidth: 0 }, style]}>
      {split.loading && !split.data ? <Loading rows={2} /> : strat.rows.length === 0 ? <Tx s={13} c={C.ink3}>No invested value to split yet.</Tx> : (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 20 }}>
          <View style={{ alignItems: 'center' }}>
            <Donut slices={strat.rows.map(s => ({ pct: sum > 0 ? (Math.max(0, s.value) / sum) * 100 : 0, color: STRATEGY_COLOR[s.name] || C.ink3 }))} count={money(strat.total)} label="TOTAL" size={132} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            {strat.rows.map(s => (
              <BarRow key={s.name} color={STRATEGY_COLOR[s.name] || C.ink3} label={s.name} value={money(s.value)}
                count={s.pct != null ? s.pct.toFixed(1) + '%' : '–'} pct={s.pct} onPress={() => onOpen({ strategy: s.name })} />
            ))}
          </View>
        </View>
      )}
    </Panel>
  );
}

function StatusPanel({ F, onOpen }) {
  const n = F.clients.length || 1;
  return (
    <Panel title="Where your investors are" sub="Every investor you referred, by how far along they are" style={{ flex: 1, minWidth: 0 }}>
      {F.visible.length === 0 ? <Tx s={13} c={C.ink3}>No investors yet.</Tx> : F.visible.map(s => (
        <BarRow key={s.key} color={STATUS_COLOR[s.key]} label={sc(s.label)} sub={s.detail} count={String(F.counts.get(s.key) || 0)}
          pct={((F.counts.get(s.key) || 0) / n) * 100} onPress={() => onOpen({ status: s.key })} />
      ))}
    </Panel>
  );
}

function RecentPanel({ F, onDetail, onOpen }) {
  const rows = F.recent.slice(0, 7).map((c, i) => ({ ...c, id: (c.email || 'r') + i }));
  return (
    <Panel title="Recently funded" sub={F.recent.length ? plural(F.recent.length, 'investor', 'investors') + ' in the last 30 days' : 'Investors funded in the last 30 days'} pad={0} style={{ flex: 1.2, minWidth: 0 }}
      right={<TextLink label="All investors" onPress={() => onOpen(null)} />}>
      <Table dense rows={rows} empty="Nobody has been funded in the last 30 days." onRowPress={c => (c.email ? onDetail(c) : onOpen(null))} cols={[
        { key: 'name', label: 'Investor', flex: 1.6, render: c => <View style={{ minWidth: 0 }}><Tx w={600} s={13} numberOfLines={1}>{c.name || '–'}</Tx>{(c.strategies || []).length > 0 && <Tx s={11.5} c={C.ink3} numberOfLines={1}>{c.strategies.map(shortStrategy).join(', ')}</Tx>}</View> },
        { key: 'value', label: 'Value', right: true, render: c => (c.currentValue != null ? <Amt s={13}>{money(c.currentValue)}</Amt> : c.investedAmount != null ? <View style={{ alignItems: 'flex-end' }}><Amt s={13}>{money(c.investedAmount)}</Amt><Tx s={11} c={C.ink3}>invested</Tx></View> : <Tx s={13} c={C.ink3}>–</Tx>) },
        { key: 'when', label: 'Funded on', right: true, render: c => <Tx s={12.5} c={C.ink2}>{fmtDate(fundedDate(c))}</Tx> },
      ]} />
    </Panel>
  );
}

// The onboarding path as a horizontal stepper: every step up to the furthest one reached; click a step to list
// the investors at it.
function JourneyPanel({ steps, onOpen }) {
  return (
    <Panel title="The onboarding journey" sub="Where your investors have reached on the way to opening an account">
      <View style={{ flexDirection: 'row' }}>
        {steps.map(({ step, count }, i) => {
          const here = count > 0, firstS = i === 0, lastS = i === steps.length - 1;
          return (
            <Pressable key={step} disabled={!here} onPress={() => onOpen({ status: 'onboarding', stage: step })} accessibilityRole={here ? 'button' : undefined}
              style={({ hovered }) => ({ flex: 1, alignItems: 'center', paddingVertical: 6, borderRadius: 8, backgroundColor: hovered && here ? C.hover : 'transparent' })}>
              <View style={{ flexDirection: 'row', alignItems: 'center', alignSelf: 'stretch' }}>
                <View style={{ flex: 1, height: 1.5, backgroundColor: firstS ? 'transparent' : C.line2 }} />
                <View style={{ width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: here ? C.green : C.line2, backgroundColor: here ? C.green : C.card }}>
                  {here ? <Tx w={600} s={12} c={C.gold}>{count}</Tx> : <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: C.line2 }} />}
                </View>
                <View style={{ flex: 1, height: 1.5, backgroundColor: lastS ? 'transparent' : C.line2 }} />
              </View>
              <Tx w={here ? 600 : 400} s={11.5} c={here ? C.ink : C.ink3} center lh={1.35} style={{ marginTop: 8, paddingHorizontal: 4 }}>{sc(step)}</Tx>
            </Pressable>
          );
        })}
      </View>
    </Panel>
  );
}

/* ── Investors ──────────────────────────────────────────────────────────────────────────────────────────── */
function Investors({ journey, filter, setFilter, onDetail, view, onLinks }) {
  const f = filter || {};
  const [q, setQ] = useState('');
  const [status, setStatus] = useState(f.status || 'all');
  const [shown, setShown] = useState(25);
  useEffect(() => { setShown(25); }, [q, status, f.stage, f.strategy, f.basis, f.from, f.to]);
  useEffect(() => { if (f.status) setStatus(f.status); }, [f.status]);
  const [soaBusy, setSoaBusy] = useState('');
  const [soaMsg, setSoaMsg] = useState(null);   // { email, text }: shown under that investor's SOA button, where it was pressed
  const [reportsFor, setReportsFor] = useState(null);
  const [narrow, setNarrow] = useState(false);   // too narrow for filters beside the table: they go above it   // investor whose "Download reports" dialog is open
  const d = journey.data;
  const clients = (d && d.journey && d.journey.clients) || [];
  const counts = useMemo(() => { const m = new Map(); for (const c of clients) { const k = statusFor(c.stage, c.onboardingStage).key; m.set(k, (m.get(k) || 0) + 1); } return m; }, [clients]);
  const rows = useMemo(() => filterInvestors(clients, status, f, q), [clients, status, f.stage, f.strategy, f.basis, f.from, f.to, q]);
  const dupes = useMemo(() => { const seen = new Set(); let extra = 0; for (const c of clients) { const k = String(c.email || '').toLowerCase() + '|' + String(c.name || '').toLowerCase(); if (seen.has(k)) extra++; else seen.add(k); } return extra; }, [clients]);
  const dateOf = c => (f.basis === 'opened' ? c.accountLiveDate : fundedDate(c));
  const undated = !f.basis || (!f.from && !f.to) ? 0 : clients.filter(c => (status === 'all' || statusFor(c.stage, c.onboardingStage).key === status) && (!f.strategy || (c.strategies || []).includes(f.strategy)) && !dateOf(c)).length;
  const drop = k => setFilter({ ...f, [k]: undefined, ...(k === 'basis' ? { from: undefined, to: undefined } : null) });
  const soa = async c => {
    if (soaBusy) return;
    setSoaBusy(c.email); setSoaMsg(null);
    try { await openFile({ kind: 'soa', email: c.email }, `No SOA has been issued for ${c.name || 'this investor'} yet.`); }
    catch (e) { setSoaMsg({ email: c.email, text: e.status === 404 ? `No SOA has been issued for ${c.name || 'this investor'} yet.` : 'We couldn’t fetch the SOA. Please try again.' }); }
    setSoaBusy('');
  };

  if (journey.loading && !d) return <Loading rows={6} />;
  if (journey.err) return <ErrorBlock msg="We couldn’t load your investors. Please refresh to try again." onRetry={journey.reload} />;
  const present = STATUS_ORDER.filter(s => counts.get(s.key));
  const chips = [f.stage && ['stage', 'Onboarding step: ' + sc(f.stage)], f.strategy && ['strategy', 'Strategy: ' + f.strategy]].filter(Boolean);

  const cols = [
    { key: 'n', label: '#', w: 64, render: r => <Tx s={12} c={C.ink3} numberOfLines={1}>{r.i + 1}</Tx> },
    { key: 'name', label: 'Investor', flex: 2, render: ({ c }) => (
      <View style={{ minWidth: 0, alignSelf: 'stretch' }}>
        <Tx w={600} s={13.5} numberOfLines={1}>{c.name || '–'}</Tx>
        <Tx s={11.5} c={C.ink3} numberOfLines={1}>{[c.city, c.email].filter(Boolean).join(' · ') || 'No details recorded yet'}</Tx>
      </View>) },
    { key: 'status', label: 'Status', flex: 1.6, render: ({ c, s }) => <StatusTag s={s} sub={s.key === 'onboarding' && c.onboardingStage ? sc(c.onboardingStage) : null} /> },
    { key: 'strat', label: 'Strategies', flex: 1.3, render: ({ c }) => (
      (c.strategies || []).length ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {c.strategies.map(n => <View key={n} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}><Dot sq s={7} color={STRATEGY_COLOR[n] || C.ink3} /><Tx s={12.5}>{shortStrategy(n)}</Tx></View>)}
        </View>) : <Tx s={12.5} c={C.ink3}>–</Tx>) },
    { key: 'value', label: 'Current value', right: true, render: ({ c }) => {
      const delta = c.currentValue != null && c.investedAmount != null ? c.currentValue - c.investedAmount : null;
      return (
        <View style={{ alignItems: 'flex-end' }}>
          {c.currentValue != null ? <Amt w={600} s={13.5}>{money(c.currentValue)}</Amt> : <Tx s={13} c={C.ink3}>–</Tx>}
          {delta != null ? <Amt s={11.5} c={delta >= 0 ? C.pos : C.red}>{delta >= 0 ? '+' : '−'}{money(Math.abs(delta))}</Amt> : <Tx s={11.5} c={C.ink3}>No holdings yet</Tx>}
        </View>);
    } },
    { key: 'date', label: f.basis === 'opened' ? 'Account opened' : 'First funded', right: true, render: ({ c }) => <Tx s={12.5} c={C.ink2}>{fmtDate(f.basis === 'opened' ? c.accountLiveDate : fundedDate(c) || c.accountLiveDate)}</Tx> },
    { key: 'act', label: 'Actions', right: true, render: ({ c }) => (
      <View style={{ alignItems: 'flex-end' }}>
        <View style={{ flexDirection: 'row', gap: 8, justifyContent: 'flex-end' }}>
          {c.clientCode
            ? <Btn small label={view.opening === c.clientCode ? 'Opening…' : 'View account'} onPress={() => view.open(c)} disabled={!!view.opening && view.opening !== c.clientCode} />
            : <View style={{ height: 34, paddingHorizontal: 10, borderRadius: 8, borderWidth: 1, borderStyle: 'dashed', borderColor: C.line2, justifyContent: 'center' }}><Tx s={12} c={C.ink3}>Not in portal yet</Tx></View>}
          {!!c.clientCode && <Btn small kind="outline" label="Reports" icon={<Download s={13} c={C.ink2} />} onPress={() => setReportsFor(c)} />}
          {!!c.email && <Btn small kind="outline" label={soaBusy === c.email ? 'Fetching…' : 'SOA'} icon={<Download s={13} c={C.ink2} />} onPress={() => soa(c)} disabled={!!soaBusy && soaBusy !== c.email} />}
        </View>
        {!!soaMsg && soaMsg.email === c.email && <Tx w={600} s={11.5} c={C.ink2} lh={1.4} style={{ marginTop: 6, textAlign: 'right', alignSelf: 'stretch', width: 0, minWidth: '100%' }}>{soaMsg.text}</Tx>}
      </View>) },
  ];

  return (
    <View style={{ gap: 20 }} onLayout={e => setNarrow(e.nativeEvent.layout.width < 1300)}>
      <CrmNotice d={d} />
      <View style={{ flexDirection: narrow ? 'column' : 'row', alignItems: narrow ? 'stretch' : 'flex-start', gap: 20 }}>
        {/* Filters: a sidebar beside the table, or one compact bar of dropdowns above it when narrow */}
        {narrow ? (
          <Card style={{ zIndex: 5, paddingVertical: 14, paddingHorizontal: 20 }}>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end', gap: 12 }}>
              <Dropdown label="Status" text={status === 'all' ? 'All investors' : sc((STATUS_ORDER.find(s => s.key === status) || {}).label || status)} value={status} onPick={setStatus} menuWidth={320}
                options={[{ id: 'all', label: 'All investors', note: String(clients.length) }, ...present.map(s => ({ id: s.key, label: sc(s.label), note: String(counts.get(s.key)) }))]} />
              <Dropdown label="Date" text={f.basis === 'opened' ? 'Account opened' : f.basis === 'invested' ? 'First funded' : 'Any'} value={f.basis || ''} menuWidth={240}
                options={DATE_BASES.map(([k]) => ({ id: k, label: k === '' ? 'Any date' : k === 'opened' ? 'Account opened' : 'First funded' }))}
                onPick={k => setFilter(k ? { ...f, basis: k } : { ...f, basis: undefined, from: undefined, to: undefined })} />
              {!!f.basis && <View style={{ width: 170 }}><DateInput label="From" value={f.from} max={f.to} onChange={v => setFilter({ ...f, from: v || undefined })} /></View>}
              {!!f.basis && <View style={{ width: 170 }}><DateInput label="To" value={f.to} min={f.from} onChange={v => setFilter({ ...f, to: v || undefined })} /></View>}
            </View>
            {undated > 0 && <Tx s={12} c={C.ink3} lh={1.5} style={{ marginTop: 10 }}>{plural(undated, 'investor has', 'investors have')} no {f.basis === 'opened' ? 'account live' : 'first fund initiated'} date on record and {undated === 1 ? 'is' : 'are'} not shown.</Tx>}
          </Card>
        ) : (
        <View style={{ width: 280, gap: 16 }}>
          <Panel title="Status" sub="Show investors at one stage">
            <View style={{ gap: 2 }}>
              {[{ key: 'all', label: 'All investors', n: clients.length }, ...present.map(s => ({ key: s.key, label: sc(s.label), n: counts.get(s.key), dot: STATUS_COLOR[s.key] }))].map(o => {
                const on = status === o.key;
                return (
                  <Pressable key={o.key} accessibilityRole="button" accessibilityState={{ selected: on }} onPress={() => setStatus(o.key)}
                    style={({ hovered }) => ({ flexDirection: 'row', alignItems: 'center', gap: 9, paddingVertical: 8, paddingHorizontal: 10, marginHorizontal: -10, borderRadius: 8, backgroundColor: on ? C.greenTint : hovered ? C.hover : 'transparent' })}>
                    {o.dot ? <Dot color={o.dot} /> : <View style={{ width: 8 }} />}
                    <Tx w={on ? 600 : 400} s={13} c={on ? C.green : C.ink} numberOfLines={1} style={{ flex: 1 }}>{o.label}</Tx>
                    <Tx w={600} s={12.5} c={C.ink3}>{o.n}</Tx>
                  </Pressable>
                );
              })}
            </View>
          </Panel>
          <Panel title="Date" sub="Filter by when an account opened or was first funded">
            <Chips value={f.basis || ''} options={DATE_BASES.map(([k]) => [k, k === '' ? 'Any' : k === 'opened' ? 'Opened' : 'First funded'])}
              onChange={k => setFilter(k ? { ...f, basis: k } : { ...f, basis: undefined, from: undefined, to: undefined })} />
            {!!f.basis && (
              <View style={{ gap: 12, marginTop: 14 }}>
                <DateInput label="From" value={f.from} max={f.to} onChange={v => setFilter({ ...f, from: v || undefined })} />
                <DateInput label="To" value={f.to} min={f.from} onChange={v => setFilter({ ...f, to: v || undefined })} />
              </View>
            )}
            {undated > 0 && <Tx s={12} c={C.ink3} lh={1.5} style={{ marginTop: 10 }}>{plural(undated, 'investor has', 'investors have')} no {f.basis === 'opened' ? 'account live' : 'first fund initiated'} date on record and {undated === 1 ? 'is' : 'are'} not shown.</Tx>}
          </Panel>
        </View>
        )}

        {/* Table */}
        <View style={{ flex: narrow ? undefined : 1, minWidth: 0, gap: 12 }}>
          {!!view.err && <Notice tone="bad">{view.err.text}</Notice>}
          <Panel pad={0} title={rows.length === clients.length ? plural(clients.length, 'investor', 'investors') : `Showing ${rows.length} of ${clients.length}`}
            sub={'Largest holdings first' + (dupes ? `. Includes ${plural(dupes, 'duplicate record', 'duplicate records')} from the CRM` : '')}
            right={<Input value={q} onChangeText={setQ} placeholder="Search by name, email or strategy" style={{ width: 300 }} />}>
            {chips.length > 0 && (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 20, paddingBottom: 12 }}>
                {chips.map(([k, label]) => (
                  <Pressable key={k} onPress={() => drop(k)} accessibilityRole="button" accessibilityLabel={'Remove filter ' + label}
                    style={({ hovered }) => ({ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 5, paddingHorizontal: 10, borderRadius: 7, backgroundColor: hovered ? '#012A1C' : C.green })}>
                    <Tx w={600} s={12} c={C.cream}>{label}</Tx><Tx w={600} s={12} c={C.gold}>✕</Tx>
                  </Pressable>
                ))}
              </View>
            )}
            <Table rows={rows.slice(0, shown).map((x, i) => ({ ...x, i, id: (x.c.email || 'row') + '-' + i }))} cols={cols} onRowPress={r => onDetail(r.c, r.s)}
              empty={clients.length ? 'No investors match this view. Try a different search, or choose All investors.' : 'No investors have joined through your links yet. Share an onboarding link to get started.'} />
            {rows.length > shown && (
              <View style={{ padding: 14, borderTopWidth: 1, borderColor: C.line, alignItems: 'center' }}>
                <Btn kind="outline" small label={`Show ${Math.min(25, rows.length - shown)} more (${rows.length - shown} remaining)`} onPress={() => setShown(n => n + 25)} />
              </View>
            )}
            {!clients.length && <View style={{ paddingHorizontal: 20, paddingBottom: 16 }}><TextLink label="Onboarding links" onPress={onLinks} /></View>}
          </Panel>
        </View>
      </View>
      <ClientReportsDialog c={reportsFor} visible={!!reportsFor} onClose={() => setReportsFor(null)} />
    </View>
  );
}

/* ── Investor detail ────────────────────────────────────────────────────────────────────────────────────── */
function Stepper({ items }) {   // items: [{ label, note, state: 'done' | 'here' | 'todo', right }]
  return (
    <View>
      {items.map((it, i) => {
        const on = it.state !== 'todo';
        return (
          <View key={it.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderTopWidth: i ? 1 : 0, borderColor: C.line }}>
            <View style={{ width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? C.green : 'transparent', borderWidth: 1, borderColor: on ? C.green : C.line2 }}>
              <Tx w={600} s={11} c={on ? C.gold : C.ink3}>{it.state === 'done' ? '✓' : it.state === 'here' ? '●' : i + 1}</Tx>
            </View>
            <View style={{ flex: 1 }}>
              <Tx w={on ? 600 : 400} s={13} c={on ? C.ink : C.ink3}>{it.label}</Tx>
              {!!it.note && <Tx s={12} c={it.state === 'here' ? C.green : C.ink3}>{it.note}</Tx>}
            </View>
            {!!it.right && <Tx s={12} c={C.ink2}>{it.right}</Tx>}
          </View>
        );
      })}
    </View>
  );
}

function InvestorPage({ c, status, view, onBack }) {
  const [busy, setBusy] = useState(false);
  const [reportsOpen, setReportsOpen] = useState(false);
  const [msg, setMsg] = useState('');
  const delta = c.currentValue != null && c.investedAmount != null ? c.currentValue - c.investedAmount : null;
  const deltaPct = delta != null && c.investedAmount ? (delta / c.investedAmount) * 100 : null;
  const jIdx = ACCOUNT_JOURNEY.findIndex(j => j[0] === c.stage);
  const rank = st => { const i = ONBOARDING_SEQUENCE.indexOf(st); return i === -1 ? ONBOARDING_SEQUENCE.length : i; };
  const cur = c.onboardingStage ? rank(c.onboardingStage) : -1;
  const soa = async () => {
    if (busy) return;
    setBusy(true); setMsg('');
    try { await openFile({ kind: 'soa', email: c.email }, 'No SOA has been issued for this investor yet.'); }
    catch (e) { setMsg(e.status === 404 ? 'No SOA has been issued for this investor yet.' : 'We couldn’t fetch the SOA. Please try again.'); }
    setBusy(false);
  };
  const vErr = view.err && view.err.code === c.clientCode ? view.err.text : '';
  const onboarding = status.key === 'onboarding' && !!c.onboardingStage;
  return (
    <View style={{ gap: 20 }}>
      <View accessibilityRole="navigation" aria-label="Breadcrumb" style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Pressable accessibilityRole="link" onPress={onBack} style={({ hovered }) => ({ flexDirection: 'row', alignItems: 'center', gap: 4, opacity: hovered ? 0.75 : 1 })}>
          <ChevronLeft s={14} c={C.ink2} /><Tx w={600} s={13} c={C.ink2}>Investors</Tx>
        </Pressable>
        <Tx s={13} c={C.ink3}>/</Tx>
        <Tx s={13} c={C.ink} aria-current="page">{c.name || 'Investor'}</Tx>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Tx w={600} s={22} role="heading" aria-level={2} numberOfLines={1}>{c.name || 'Investor'}</Tx>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 6 }}>
            <StatusTag s={status} />
            <Tx s={13} c={C.ink2}>{onboarding ? sc(c.onboardingStage) : status.detail}</Tx>
          </View>
        </View>
        {!!c.clientCode && <Btn label={view.opening === c.clientCode ? 'Opening…' : 'View account'} onPress={() => view.open(c)} />}
        {!!c.clientCode && <Btn kind="outline" label="Download reports" icon={<Download s={14} c={C.ink2} />} onPress={() => setReportsOpen(true)} />}
        {!!c.email && <Btn kind="outline" label={busy ? 'Fetching…' : 'Download SOA'} icon={<Download s={14} c={C.ink2} />} onPress={soa} />}
        {!!c.email && <Btn kind="outline" label="Email" icon={<MailIcon s={14} c={C.ink2} />} onPress={() => mail(c.email)} />}
        {!!c.mobile && <Btn kind="outline" label="Call" icon={<Phone s={14} c={C.ink2} />} onPress={() => Linking.openURL('tel:' + String(c.mobile).replace(/[^\d+]/g, '')).catch(() => {})} />}
      </View>
      {!!vErr && <Notice tone="bad">{vErr}</Notice>}
      {!!msg && <Notice>{msg}</Notice>}

      <Row>
        <DarkCard style={{ flex: 1.1 }}>
          <Label c="rgba(239,236,211,0.6)">Current value</Label>
          <Amt w={600} s={30} c={C.cream} style={{ marginTop: 6, letterSpacing: -0.6 }}>{money(c.currentValue)}</Amt>
          <View style={{ width: 34, height: 2, backgroundColor: C.gold, marginTop: 10 }} />
          {delta != null && deltaPct != null
            ? <Tx s={12.5} c="rgba(239,236,211,0.7)" style={{ marginTop: 10 }}><Tx w={600} s={12.5} c={onDark(delta >= 0 ? C.pos : C.red)}>{delta >= 0 ? '+' : '−'}{money(Math.abs(delta))} ({delta >= 0 ? '+' : '−'}{Math.abs(deltaPct).toFixed(1)}%)</Tx> against {money(c.investedAmount)} invested</Tx>
            : <Tx s={12.5} c="rgba(239,236,211,0.6)" style={{ marginTop: 10 }}>Holdings are not yet priced in our records.</Tx>}
          {(c.strategies || []).length > 0 && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 18 }}>
              {c.strategies.map(n => (
                <View key={n} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 5, paddingHorizontal: 10, borderRadius: 7, borderWidth: 1, borderColor: 'rgba(239,236,211,0.25)' }}>
                  <Dot sq s={8} color={STRATEGY_COLOR[n] === '#0A3452' ? '#5B8DB8' : STRATEGY_COLOR[n] === '#550E0E' ? '#C97B7B' : STRATEGY_COLOR[n] || C.gold} />
                  <Tx w={600} s={12} c={C.cream}>{n}</Tx>
                </View>
              ))}
            </View>
          )}
        </DarkCard>
        <Panel title="Account" style={{ flex: 1 }}>
          <KeyVals items={[
            ['Account code', c.clientCode || '–'], ['Activation date', fmtDate(c.activationDate)], ['First investment', fmtDate(c.accountLiveDate)], ['Last top-up', fmtDate(c.firstTopUpDate)],
            ...(c.onboardingStage ? [['Onboarding stage', sc(c.onboardingStage)]] : []), ['Annual review', c.annualReviewStatus || '–'], ['Portal walkthrough', c.hadWalkthrough ? 'Done' : 'Not done'],
          ]} />
        </Panel>
        <Panel title="Contact" style={{ flex: 1 }}>
          <KeyVals items={[['Email', c.email || '–'], ['Mobile', c.mobile || '–'], ['City', c.city || '–'], ['Occupation', c.occupation || '–'], ['Relationship manager', c.relationshipManager || '–'], ['Next contact', fmtDate(c.nextContactDate)]]} />
        </Panel>
      </Row>

      {(jIdx >= 0 || onboarding) && (
        <Row>
          {jIdx >= 0 && (
            <Panel title="Account journey" sub="The stages an account passes through" style={{ flex: 1 }}>
              <Stepper items={ACCOUNT_JOURNEY.map(([st, meaning, field], i) => ({ label: sc(st), note: meaning, state: i < jIdx ? 'done' : i === jIdx ? 'here' : 'todo', right: field ? fmtDate(c[field]) : '' }))} />
            </Panel>
          )}
          {onboarding && (
            <Panel title="Onboarding progress" sub="Steps completed, and what happens next" style={{ flex: 1 }}>
              {cur >= ONBOARDING_SEQUENCE.length ? <Tx s={13}>{sc(c.onboardingStage)}</Tx> : (
                <Stepper items={ONBOARDING_SEQUENCE.slice(0, cur + 2).map((st, i) => ({
                  label: sc(st), state: i < cur ? 'done' : i === cur ? 'here' : 'todo',
                  note: i === cur ? 'Currently here' + (c.stageEntryDate ? ' since ' + fmtDate(c.stageEntryDate) : '') : i > cur ? 'Next step' : '',
                }))} />
              )}
            </Panel>
          )}
        </Row>
      )}
      <ClientReportsDialog c={c} visible={reportsOpen} onClose={() => setReportsOpen(false)} />
    </View>
  );
}

/* ── Fee period picker (Fees, Fee statement, Invoices) ─────────────────────────────────────────────────── */
const PERIOD_TYPES = [['Since Inception', 'All time'], ['Quarter', 'Quarters'], ['Year', 'Financial years']];
function PeriodBar({ periods, period, setPeriod, right }) {
  const [open, setOpen] = useState(false);
  const ps = (periods.data && periods.data.periods) || [];
  const group = period ? ps.filter(p => p.type === period.type) : [];
  const gi = period ? group.findIndex(p => p.label === period.label) : -1;
  const types = PERIOD_TYPES.filter(([t]) => ps.some(p => p.type === t));
  const stepper = !!period && period.type !== 'Since Inception' && group.length > 1;
  const Arrow = ({ dir, ok }) => (
    <Pressable accessibilityRole="button" accessibilityLabel={dir < 0 ? 'Earlier period' : 'Later period'} disabled={!ok} onPress={() => setPeriod(group[gi + dir])} style={s => [iconBtn(s), { opacity: ok ? 1 : 0.35 }]}>
      {dir < 0 ? <ChevronLeft s={14} c={C.green} /> : <ChevronRight s={12} c={C.green} />}
    </Pressable>
  );
  return (
    <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 16 }}>
      {stepper && <Arrow dir={-1} ok={gi > 0} />}
      <Pressable accessibilityRole="button" accessibilityLabel="Change period" onPress={() => setOpen(true)} style={({ hovered }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 4, paddingHorizontal: 10, borderRadius: 8, backgroundColor: hovered ? C.hover : 'transparent' })}>
        <View>
          <Label>Period</Label>
          <Tx w={600} s={15} style={{ marginTop: 2 }}>{period ? period.label : periods.loading ? 'Loading periods…' : 'Choose a period'}</Tx>
          {!!period && <Tx s={12} c={C.ink3}>{dday(period.startDate)} to {dday(period.endDate)}</Tx>}
        </View>
        <ChevronDown s={11} c={C.ink3} />
      </Pressable>
      {stepper && <Arrow dir={1} ok={gi < group.length - 1} />}
      <View style={{ flex: 1 }} />
      {right}
      {types.length > 1 && <Chips value={period && period.type} options={types} onChange={t => { const g = ps.filter(p => p.type === t); if (g.length) setPeriod(g[g.length - 1]); }} />}
      <Dialog visible={open} onClose={() => setOpen(false)} title="Choose a period" width={440}>
        {types.map(([t, h]) => {
          const items = ps.filter(p => p.type === t).slice().reverse();
          return items.length > 0 && (
            <View key={t} style={{ marginBottom: 14 }}>
              <Label style={{ marginBottom: 6 }}>{h}</Label>
              {items.map((p, i) => {
                const on = period && p.label === period.label;
                return (
                  <Pressable key={p.label} onPress={() => { setPeriod(p); setOpen(false); }} accessibilityRole="button" accessibilityState={{ selected: !!on }}
                    style={({ hovered }) => ({ flexDirection: 'row', alignItems: 'center', paddingVertical: 9, paddingHorizontal: 10, borderRadius: 8, backgroundColor: on ? C.greenTint : hovered ? C.hover : 'transparent' })}>
                    <View style={{ flex: 1 }}>
                      <Tx w={on ? 600 : 400} s={13.5} c={on ? C.green : C.ink}>{p.label}{t === 'Quarter' && i === 0 ? '  · latest' : ''}</Tx>
                      <Tx s={12} c={C.ink3}>{dday(p.startDate)} to {dday(p.endDate)}</Tx>
                    </View>
                    {on && <Tx w={600} s={13} c={C.green}>✓</Tx>}
                  </Pressable>
                );
              })}
            </View>
          );
        })}
      </Dialog>
    </Card>
  );
}
function PeriodGate({ periods, children }) {
  if (periods.loading && !periods.data) return <Loading rows={4} />;
  if (periods.err) return <ErrorBlock msg={'We couldn’t load your fee periods. ' + periods.err} onRetry={periods.reload} />;
  return children;
}

/* ── Fees ───────────────────────────────────────────────────────────────────────────────────────────────── */
function Fees({ periods, period, setPeriod, go }) {
  const rows = useLoad(() => (period ? api.feeRows(period) : Promise.resolve(null)), [period && period.label]);
  const list = Array.isArray(rows.data) ? rows.data : [];
  const [search, setSearch] = useState('');
  const [openClient, setOpenClient] = useState(null);
  const { clients, totals: t } = useMemo(() => summarise(list, search), [rows.data, search]);
  const csv = () => { if (period) downloadText(`qode-fees-${String(period.label).replace(/\s+/g, '-')}.csv`, feesCsvLines(clients).join('\n'), 'text/csv;charset=utf-8'); };
  return (
    <PeriodGate periods={periods}>
      <View style={{ gap: 20 }}>
        <PeriodBar periods={periods} period={period} setPeriod={setPeriod} />
        {rows.loading && <Loading rows={4} />}
        {!rows.loading && !!rows.err && <ErrorBlock msg={`We couldn’t load your fees. ${rows.err}. Please refresh, or contact partnerships@qodeinvest.com.`} onRetry={rows.reload} />}
        {!rows.loading && !rows.err && list.length === 0 && !!period && (
          <Empty title="No fees in this period">No fees were billed to your clients between {dday(period.startDate)} and {dday(period.endDate)}. Try an earlier period.</Empty>
        )}
        {!rows.loading && list.length > 0 && (<>
          <Row>
            <DarkCard style={{ flex: 1.2 }}>
              <Label c="rgba(239,236,211,0.6)">{'Your commission for ' + period.label}</Label>
              <Amt w={600} s={32} c={C.cream} style={{ marginTop: 6, letterSpacing: -0.6 }}>{inrCompact(t.shareNet)}</Amt>
              <Tx s={12.5} c="rgba(239,236,211,0.65)" style={{ marginTop: 4 }}>{inrCompact(t.shareNet) !== inr(t.shareNet) ? inr(t.shareNet) + ' before GST' : 'Before GST'}, from {plural(t.clientCount, 'client', 'clients')}</Tx>
              <View style={{ width: 34, height: 2, backgroundColor: C.gold, marginTop: 12 }} />
              {!!t.sharePct && <Tx s={12.5} c={C.cream} style={{ marginTop: 12 }}>Your revenue share: <Tx w={600} s={12.5} c={C.gold}>{t.sharePct}</Tx> of the standard fee{t.discount > 0 ? ', less the discounts you have given' : ''}</Tx>}
              {t.shareNet > 0 && <Tx s={12.5} c="rgba(239,236,211,0.75)" style={{ marginTop: 4 }}>Plus GST of {inr(t.shareGst)}: invoice {inr(t.share)} in total</Tx>}
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 18 }}>
                <DarkBtn gold label="Raise invoice" onPress={() => go('invoice')} />
                <DarkBtn label="Fee statement" onPress={() => go('statement')} />
                <DarkBtn label="Download CSV" onPress={csv} />
              </View>
            </DarkCard>
            <View style={{ flex: 1, gap: 16 }}>
              <Row gap={16} style={{ flex: 1 }}>
                <Stat label="Client AUM" value={inrCompact(t.aum)} note={plural(t.accountCount, 'account', 'accounts')} style={{ flex: 1 }} />
                <Stat label="Total fees billed" value={inrCompact(t.totalFees)} note={'+ ' + inrCompact(t.gst) + ' GST'} style={{ flex: 1 }} />
              </Row>
              <Row gap={16} style={{ flex: 1 }}>
                <Stat label="Management fees" value={inrCompact(t.fixedFees)} note="Charged quarterly" style={{ flex: 1 }} />
                <Stat label="Performance fees" value={inrCompact(t.perfFees)} note="Charged annually" style={{ flex: 1 }} />
              </Row>
            </View>
          </Row>
          {t.unmappedCount > 0 && <Notice>{`${plural(t.unmappedCount, 'client has', 'clients have')} no fee rate configured. Their share shows as ₹0 because no rate has been set, not because none is due. Contact partnerships@qodeinvest.com to have these confirmed.`}</Notice>}
          <Row top>
            <Panel title="By client" sub="Click a client for each account's fees" pad={0} style={{ flex: 2, minWidth: 0 }}
              right={<Input value={search} onChangeText={setSearch} placeholder="Search by client or account code" style={{ width: 280 }} />}>
              <Table rows={clients.map(g => ({ ...g, id: g.name }))} onRowPress={g => setOpenClient(g)} empty={`No client matches “${search}”.`} cols={[
                { key: 'name', label: 'Client', flex: 2, render: g => (
                  <View style={{ minWidth: 0 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Tx w={600} s={13.5} numberOfLines={1} style={{ flexShrink: 1 }}>{g.name}</Tx>
                      {g.unmapped && <Pill label="No rate" tone="bad" />}
                    </View>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 3 }}>
                      {g.accounts.map((a, i) => <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}><Dot s={7} color={SCHEME_COLOR[code3(a)] || C.ink3} /><Tx s={11.5} c={C.ink3}>{code3(a)}</Tx></View>)}
                    </View>
                  </View>) },
                { key: 'aum', label: 'Client AUM', right: true, render: g => <Amt s={13}>{inrCompact(g.aum)}</Amt> },
                { key: 'fees', label: 'Fees billed', right: true, render: g => <Amt s={13}>{inr(g.totalFees)}</Amt> },
                { key: 'share', label: 'Your share', right: true, render: g => <Amt s={13} c={C.ink2}>{inr(g.shareOfFee)}</Amt> },
                { key: 'disc', label: 'Discount', right: true, render: g => <Amt s={13} c={g.shareDiscount > 0 ? C.red : C.ink3}>{g.shareDiscount > 0 ? '−' + inr(g.shareDiscount) : '–'}</Amt> },
                { key: 'comm', label: 'Commission', right: true, render: g => <View style={{ alignItems: 'flex-end' }}><Amt w={600} s={13.5}>{inr(g.commission)}</Amt>{g.unmapped && <Tx s={11} c={C.ink3}>no rate set</Tx>}</View> },
              ]} />
            </Panel>
            <View style={{ flex: 1, gap: 20, minWidth: 0 }}>
              {!!t.sharePct && (
                <Panel title="How your share was calculated">
                  <KeyVals items={[
                    ...(t.perfFees > 0 ? [['Management fees charged', inr(t.fixedFees)], ['Performance fees charged', inr(t.perfFees)]] : [['Fees your clients were charged', inr(t.totalFees)]]),
                    ...(t.shareDiscount > 0
                      ? [[`Your share, ${t.sharePct} of those fees`, inr(t.shareOfFee)], ['Less the discount you gave', '−' + inr(t.shareDiscount), C.red], ['Your commission', inr(t.shareNet)]]
                      : [[`Your commission, ${t.sharePct} of those fees`, inr(t.shareNet)]]),
                    ['Plus GST at 18%', inr(t.shareGst)],
                    ['Payable to you', <Amt key="p" w={700} s={15} c={C.green}>{inr(t.share)}</Amt>],
                  ]} />
                </Panel>
              )}
            </View>
          </Row>
        </>)}
        <ClientFeesDialog g={openClient} onClose={() => setOpenClient(null)} />
      </View>
    </PeriodGate>
  );
}

function ClientFeesDialog({ g, onClose }) {
  if (!g) return null;
  const terms = parseBillgroup(g.accounts[0] && (g.accounts[0].billgroup || g.accounts[0].billGroup));
  return (
    <Dialog visible onClose={onClose} title={g.name} width={620}>
      {terms && <Tx s={13} c={C.ink2} style={{ marginBottom: 12 }}>Fee terms: management {terms.mf}, performance {terms.pf}, hurdle {terms.h}</Tx>}
      {g.accounts.map((a, i) => {
        const standardFee = num(a.totalRackRateFee) || num(a.totalFees);
        const isDiscounted = num(a.discountAmount) > 0 && standardFee > num(a.totalFees);
        const unmapped = a.rateSource === 'unmapped';
        const perf = num(a.performanceFees) > 0;
        return (
          <Card key={i} style={{ padding: 16, marginBottom: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Dot sq s={9} color={SCHEME_COLOR[code3(a)] || C.ink3} />
              <Tx w={600} s={14} style={{ flex: 1 }}>{SCHEME[code3(a)] || a.strategy || a.accountcode || '–'}</Tx>
              <Tx s={12} c={C.ink3}>{a.accountcode}{a.inceptionDate ? ' · opened ' + dday(a.inceptionDate) : ''}</Tx>
            </View>
            {a.isZeroFee ? <Tx s={13} c={C.ink3} style={{ marginTop: 10 }}>No fee arrangement: no fees charged on this account.</Tx> : (
              <KeyVals style={{ marginTop: 8 }} items={[
                ['Client assets', inr(num(a.averageAum))],
                ['Management fee (before GST)', inr(num(a.fixedFees)) + (num(a.fixedFees) > 0 && a.actualFeeChargedPct != null ? ` (${a.actualFeeChargedPct}%)` : '') + (isDiscounted && a.rackFixedFeePct != null ? `, standard ${a.rackFixedFeePct}%` : '')],
                ['Performance fee (before GST)', perf ? inr(num(a.performanceFees)) + (a.rackPerfFeePct != null && num(a.rackPerfFeePct) > 0 ? ` (${a.rackPerfFeePct}% over ${a.hurdlePct ?? 0}%)` : '') : 'Billed annually'],
                ['Your share', unmapped ? '–' : inr(num(a.yourShareOfFee)) + ` (${a.distributorPercentage}%)`],
                ['Discount', a.netFeePct != null && num(a.shareDiscount) > 0 ? '−' + inr(num(a.shareDiscount)) : '–', a.netFeePct != null && num(a.shareDiscount) > 0 ? C.red : undefined],
                ['Your commission (before GST)', inr(num(a.yourCommission ?? a.distributorShare)) + (a.netFeePctOfAum != null ? ` (${a.netFeePctOfAum}% ${a.netFeePctBasis === 'performance' ? 'of gains' : 'p.a.'})` : ''), C.green],
              ]} />
            )}
          </Card>
        );
      })}
      {g.accounts.length > 1 && (
        <Panel title="Total">
          <KeyVals items={[['Client assets', inr(g.aum)], ['Management fee (before GST)', inr(g.fixedFees)], ['Performance fee (before GST)', inr(g.perfFees)], ['Your share', inr(g.shareOfFee)],
            ['Discount', g.shareDiscount > 0 ? '−' + inr(g.shareDiscount) : '–', g.shareDiscount > 0 ? C.red : undefined], ['Your commission (before GST)', inr(g.commission), C.green]]} />
        </Panel>
      )}
    </Dialog>
  );
}

/* ── Fee statement ──────────────────────────────────────────────────────────────────────────────────────── */
function StatementPage({ periods, period, setPeriod, name, go }) {
  return (
    <PeriodGate periods={periods}>
      <View style={{ gap: 20 }}>
        <PeriodBar periods={periods} period={period} setPeriod={setPeriod} />
        {!!period && <StatementBody key={period.label} period={period} name={name} go={go} />}
      </View>
    </PeriodGate>
  );
}
function StatementBody({ period, name, go }) {
  const { loading, err, rows, reload } = usePeriodRows(period);
  const doc = useMemo(() => statementDoc(period, name, rows), [rows, period, name]);
  const { clients, t, ref, issued, disc, calc } = doc;
  const money2 = v => (v < 0 ? '−' + inr(-v) : inr(v));
  const [busy, setBusy] = useState(false);
  const [pdfErr, setPdfErr] = useState('');
  if (loading) return <Loading rows={4} />;
  if (err) return <ErrorBlock msg={`We couldn’t prepare the statement. ${err}. Please try again, or contact partnerships@qodeinvest.com.`} onRetry={reload} />;
  if (!rows.length) return <Empty title="No fees in this period">There is nothing to put on a statement for {period.label}. Try an earlier period.</Empty>;
  const pdf = async () => { if (busy) return; setBusy(true); setPdfErr(''); try { await savePdf(doc.html(), 'Fee statement ' + ref); } catch (e) { setPdfErr(e.message); } setBusy(false); };
  const cols = [
    { key: 'name', label: 'Client', flex: 1.8, render: c => <View><Tx w={600} s={13.5} numberOfLines={1}>{c.name}</Tx>{c.accounts > 1 && <Tx s={11.5} c={C.ink3}>{c.accounts} accounts</Tx>}</View> },
    { key: 'aum', label: 'Avg AUM', right: true, render: c => <Amt s={13}>{inr(c.aum)}</Amt> },
    { key: 'fixed', label: 'Fixed fees', right: true, render: c => <Amt s={13}>{inr(c.fixed)}</Amt> },
    { key: 'perf', label: 'Perf. fees', right: true, render: c => <Amt s={13}>{inr(c.perf)}</Amt> },
    ...(disc ? [{ key: 'rack', label: 'Standard fee', right: true, render: c => <Amt s={13}>{inr(c.rack)}</Amt> }] : []),
    { key: 'fees', label: disc ? 'Fee charged' : 'Total fees', right: true, render: c => <Amt s={13}>{inr(c.fees)}</Amt> },
    ...(disc ? [{ key: 'disc', label: 'Your discount', right: true, render: c => <Amt s={13} c={c.discount > 0 ? C.red : C.ink3}>{c.discount > 0 ? '−' + inr(c.discount) : '–'}</Amt> }] : []),
    { key: 'share', label: 'You receive (incl. GST)', right: true, flex: 1.2, render: c => <Amt w={600} s={13.5} c={c.total ? C.green : C.ink}>{inr(c.share)}</Amt> },
  ];
  const totalRow = { id: 'total', name: 'Total', accounts: 0, aum: t.aum, fixed: t.fixed, perf: t.perf, rack: t.rack, fees: t.fees, discount: t.discount, share: t.share, total: true };
  return (
    <>
      <Row>
        <Panel title="Distributor fee statement" sub={`Ref ${ref} · Issued ${noSept(issued)}`} style={{ flex: 1.3 }}
          right={<View style={{ flexDirection: 'row', gap: 8 }}>
            <Btn small label={busy ? 'Preparing…' : 'Download PDF'} icon={<Download s={14} c={C.gold} />} onPress={pdf} busy={busy} />
            <Btn small kind="outline" label="Raise invoice" onPress={() => go('invoice')} />
          </View>}>
          <View style={{ flexDirection: 'row', gap: 20, paddingBottom: 14, borderBottomWidth: 1, borderColor: C.line }}>
            <View style={{ flex: 1 }}><Label>Statement for</Label><Tx w={600} s={14} style={{ marginTop: 4 }}>{name || '–'}</Tx></View>
            <View style={{ flex: 1, alignItems: 'flex-end' }}><Label>Period</Label><Tx w={600} s={14} style={{ marginTop: 4 }}>{period.label}</Tx><Tx s={12} c={C.ink3}>{dday(period.startDate)} to {dday(period.endDate)}</Tx></View>
          </View>
          <Label style={{ marginTop: 16 }}>Total payable to you, inclusive of GST</Label>
          <Amt w={600} s={30} style={{ marginTop: 4, letterSpacing: -0.5 }}>{inr(t.share)}</Amt>
          <Tx s={12.5} c={C.ink3} style={{ fontStyle: 'italic', marginTop: 2 }}>{amountInWords(t.share)}</Tx>
          <Notice style={{ marginTop: 14 }}>
            <Tx s={13} lh={1.55} c={C.ink2}><Tx w={600} s={13}>This amount already includes GST. Do not add GST on top.</Tx> Invoice Qode Advisors LLP for <Tx w={600} s={13}>{inr(t.share)}</Tx> in total, shown on your invoice as <Tx w={600} s={13}>{inr(t.shareNet)}</Tx> plus GST of <Tx w={600} s={13}>{inr(t.shareGst)}</Tx>.</Tx>
          </Notice>
          {!!pdfErr && <Tx s={12.5} c={C.red} style={{ marginTop: 10 }}>{pdfErr}</Tx>}
          <Tx s={12} c={C.ink3} lh={1.5} style={{ marginTop: 12 }}>Download PDF opens your browser’s print dialog: choose “Save as PDF”. This statement is not a tax invoice; use Raise invoice to generate one.</Tx>
        </Panel>
        <Panel title="Calculation" style={{ flex: 1 }}>
          <KeyVals items={calc.map(([k, sub, v, kind]) => [sub ? `${k} (${sub})` : k, kind === 'total' ? <Amt key={k} w={700} s={15} c={C.green}>{money2(v)}</Amt> : money2(v), v < 0 ? C.red : undefined])} />
        </Panel>
      </Row>
      <Panel title="Breakdown by client" sub={`You receive ${t.ratePct} of the standard fee${disc ? ', less your discount' : ''}, including GST`} pad={0}>
        <Table dense rows={[...clients.map((c, i) => ({ ...c, id: c.name + i })), totalRow]} cols={cols} />
      </Panel>
      {t.unmapped && <Notice>Some clients are not included. One or more clients have no fee share configured, so no amount is shown against them. Contact partnerships@qodeinvest.com before invoicing.</Notice>}
      {t.isLegacyRate && <Notice>Provisional rate. This statement uses a share rate held in our portal records rather than a confirmed CRM rate. Please confirm before invoicing.</Notice>}
      <Panel title="Notes">
        <Tx s={13} c={C.ink2} lh={1.6}><Tx w={600} s={13}>This is not a tax invoice.</Tx> It is a statement of fees earned, issued for your records. Please raise your own invoice on Qode Advisors LLP for the total shown above.</Tx>
        <Tx s={13} c={C.ink2} lh={1.6} style={{ marginTop: 10 }}><Tx w={600} s={13}>The total payable to you is inclusive of GST at 18%.</Tx> Your revenue share of {t.ratePct} is calculated on the fees billed to your clients, and GST at 18% is added to your share. Do not add GST on top of the total: the amount payable to you is {inr(t.share)} in full. On your invoice this is {inr(t.shareNet)} plus GST of {inr(t.shareGst)}.</Tx>
        <Tx s={13} c={C.ink2} lh={1.6} style={{ marginTop: 10 }}>Fixed fees are billed quarterly and performance fees annually. Fee amounts are as recorded in our systems for the stated period. If any figure appears incorrect, contact partnerships@qodeinvest.com before invoicing.</Tx>
      </Panel>
    </>
  );
}

/* ── Invoices ───────────────────────────────────────────────────────────────────────────────────────────── */
function InvoicePage({ periods, period, setPeriod, name }) {
  const [tick, setTick] = useState(0);
  const history_ = useLoad(() => api.invoices(), [tick]);
  const past = (history_.data && history_.data.invoices) || [];
  return (
    <PeriodGate periods={periods}>
      <View style={{ gap: 20 }}>
        <PeriodBar periods={periods} period={period} setPeriod={setPeriod} />
        {!!period && <InvoiceBody key={period.label} period={period} name={name} onIssued={() => setTick(x => x + 1)} />}
        <Panel title="Invoices you have issued" sub="Your 24 most recent" pad={0}>
          {history_.loading && !history_.data ? <View style={{ padding: 20 }}><Loading rows={2} /></View>
            : history_.err ? <Tx s={13} c={C.ink3} style={{ padding: 20 }}>We couldn’t load your invoice history just now.</Tx>
            : <Table dense rows={past.map((r, i) => ({ ...r, id: r.invoiceNumber + i }))} empty="No invoices recorded yet." cols={[
              { key: 'invoiceNumber', label: 'Invoice no.', render: r => <Tx w={600} s={13}>{r.invoiceNumber}</Tx> },
              { key: 'invoiceDate', label: 'Date', render: r => <Tx s={13}>{fmtDate(r.invoiceDate)}</Tx> },
              { key: 'periodLabel', label: 'Period', render: r => <Tx s={13}>{r.periodLabel}</Tx> },
              { key: 'amountBeforeTax', label: 'Before tax', right: true, render: r => <Amt s={13}>{inr(r.amountBeforeTax)}</Amt> },
              { key: 'taxAmount', label: 'Tax', right: true, render: r => <Amt s={13} c={C.ink2}>{inr(r.taxAmount)}</Amt> },
              { key: 'totalAmount', label: 'Total', right: true, render: r => <Amt w={600} s={13}>{inr(r.totalAmount)}</Amt> },
            ]} />}
        </Panel>
      </View>
    </PeriodGate>
  );
}

function InvoiceBody({ period, name, onIssued }) {
  const { loading, err, rows, sum } = usePeriodRows(period);
  const prof = useLoad(() => api.invoiceProfile(), []);
  const [edited, setP] = useState(null);   // the saved invoice details pre-fill the form until edited
  const base = prof.data || prof.err ? { ...EMPTY_PROFILE, ...((prof.data && prof.data.profile) || {}) } : null;
  const p = edited || base;
  const [num0, setNum] = useState(null);
  const [date, setDate] = useState(todayIst());
  const [errs, setErrs] = useState({});
  const [st, setSt] = useState({ saving: false, saved: false, issuing: false, msg: '', err: '' });
  const [pickState, setPickState] = useState(false);
  if (loading || !p) return <Loading rows={4} />;
  if (err) return <ErrorBlock msg={`We couldn’t load your invoice. ${err}`} />;

  const { taxable, tax, discount, clientCount, ratePct } = invoiceFigures(rows, sum, p);
  const last = Number(p.lastInvoiceNumber || 0);
  const invoiceNumber = num0 != null ? num0 : (p.invoicePrefix ? p.invoicePrefix + String(last + 1).padStart(3, '0') : String(last + 1));
  const set = (k, v) => { setP(o => ({ ...(o || base), [k]: v })); if (errs[k]) setErrs(e => ({ ...e, [k]: '' })); setSt(s => ({ ...s, saved: false })); };
  const qodeOk = isQodeEntityComplete();
  const ready = qodeOk && p.legalName.trim() && p.addressLine1.trim() && String(invoiceNumber).trim() && taxable * 1.18 > 0;
  const save = async () => {
    const e = validateProfile(p, invoiceNumber, date);
    const profileErrs = Object.fromEntries(Object.entries(e).filter(([k]) => k !== 'invoiceNumber' && k !== 'invoiceDate'));
    if (Object.keys(profileErrs).length) { setErrs(e); return false; }
    setSt(s => ({ ...s, saving: true, err: '' }));
    try { await api.saveInvoiceProfile({ ...p, gstin: p.gstin.trim().toUpperCase(), pan: p.pan.trim().toUpperCase(), bankIfsc: p.bankIfsc.trim().toUpperCase() }); setSt(s => ({ ...s, saving: false, saved: true })); return true; }
    catch (x) { setErrs(o => ({ ...o, ...((x.data && x.data.errors) || {}) })); setSt(s => ({ ...s, saving: false, err: x.message })); return false; }
  };
  const html = () => invoiceHtml({ p, period, invoiceNumber, date, tax, ratePct, clientCount, discount, distributorName: name });
  const generate = async () => {
    const e = validateProfile(p, invoiceNumber, date);
    if (Object.keys(e).length) { setErrs(e); return; }
    setSt(s => ({ ...s, issuing: true, err: '', msg: '' }));
    if (!(await save())) { setSt(s => ({ ...s, issuing: false })); return; }
    try {
      await api.issueInvoice({ invoiceNumber: String(invoiceNumber).trim(), invoiceDate: date, periodLabel: period.label, periodStart: period.startDate, periodEnd: period.endDate, amountBeforeTax: tax.taxableValue, taxAmount: tax.totalTax, totalAmount: tax.total });
      const n = String(invoiceNumber).match(/(\d+)\s*$/);
      if (n) setP(o => { const q = o || base; return { ...q, lastInvoiceNumber: Math.max(Number(q.lastInvoiceNumber || 0), Number(n[1])) }; });
      setNum(null);
      onIssued();
      // The number is recorded; a PDF problem is reported on its own so it isn't mistaken for a failed invoice.
      try { await savePdf(html(), 'Invoice ' + invoiceNumber); setSt(s => ({ ...s, issuing: false, msg: `Invoice ${invoiceNumber} recorded.` })); }
      catch (pe) { setSt(s => ({ ...s, issuing: false, msg: `Invoice ${invoiceNumber} recorded.`, err: pe.message })); }
    } catch (x) { setSt(s => ({ ...s, issuing: false, err: x.status === 409 ? x.message : 'Could not record the invoice' })); }
  };
  const F = (k, label, props = {}) => <Input label={label} value={String(p[k] || '')} onChangeText={t => set(k, props.upper ? t.toUpperCase() : t)} error={errs[k]} placeholder={props.placeholder} hint={props.hint} style={{ flex: 1, minWidth: 0 }} />;
  const addr = [p.addressLine1, p.addressLine2, [p.city, p.state, p.pincode].filter(Boolean).join(', ')].filter(Boolean);
  const sameState = String(p.stateCode).padStart(2, '0') === QODE_ENTITY.stateCode;
  return (
    <Row top>
      <View style={{ flex: 1, gap: 20, minWidth: 0 }}>
        {!qodeOk && <Notice tone="bad">Invoicing isn’t available yet. Qode’s GST details haven’t been configured in the portal, and an invoice without them wouldn’t be valid. Please contact partnerships@qodeinvest.com.</Notice>}
        <Panel title="Your invoice details" sub="They appear on the invoice as the party raising it. We save them, so you only enter them once.">
          <View style={{ gap: 14 }}>
            <Row gap={14}>{F('legalName', 'Registered name *', { placeholder: 'As registered, e.g. Acme Capital Services LLP' })}</Row>
            <Row gap={14}>
              {F('gstin', 'GSTIN', { placeholder: '27AABCU9603R1ZX', upper: true, hint: 'Leave blank if you aren’t GST-registered.' })}
              {F('pan', 'PAN', { placeholder: 'AABCU9603R', upper: true })}
            </Row>
            <Row gap={14}>{F('addressLine1', 'Registered address *', { placeholder: 'Building, street' })}</Row>
            <Row gap={14}>{F('addressLine2', 'Address line 2', { placeholder: 'Area, landmark' })}</Row>
            <Row gap={14}>
              {F('city', 'City', { placeholder: 'Mumbai' })}
              <View style={{ flex: 1, minWidth: 0 }}>
                <Tx w={600} s={12.5} c={C.ink2} style={{ marginBottom: 6 }}>State</Tx>
                <Pressable onPress={() => setPickState(true)} accessibilityRole="button" style={({ hovered }) => ({ height: 44, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, borderColor: errs.stateCode ? C.red : C.line2, backgroundColor: hovered ? C.hover : C.card })}>
                  <Tx s={14} c={p.stateCode ? C.ink : C.ink3} style={{ flex: 1 }}>{p.stateCode ? p.state : 'Select your state'}</Tx>
                  <ChevronDown s={10} c={C.ink3} />
                </Pressable>
                {!!errs.stateCode && <Tx s={12} c={C.red} style={{ marginTop: 6 }}>{errs.stateCode}</Tx>}
                {!errs.stateCode && !!p.stateCode && !!p.gstin.trim() && <Tx s={12} c={C.ink3} style={{ marginTop: 6 }}>{sameState ? 'Same state as Qode: CGST and SGST.' : 'Different state from Qode: IGST.'}</Tx>}
              </View>
              {F('pincode', 'PIN code', { placeholder: '400001' })}
            </Row>
            <Row gap={14}>
              <Input label="Invoice number *" value={String(invoiceNumber)} onChangeText={setNum} error={errs.invoiceNumber} hint={last ? `Your last invoice here was number ${last}.` : 'Use your own series.'} style={{ flex: 1, minWidth: 0 }} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <DateInput label="Invoice date *" value={date} onChange={v => { if (v) setDate(v); if (errs.invoiceDate) setErrs(e => ({ ...e, invoiceDate: '' })); }} />
                {!!errs.invoiceDate && <Tx s={12} c={C.red} style={{ marginTop: 6 }}>{errs.invoiceDate}</Tx>}
              </View>
              {F('invoicePrefix', 'Invoice prefix', { placeholder: 'e.g. ACS/25-26/', hint: 'Optional. Suggests your next number.' })}
            </Row>
            <Label style={{ marginTop: 6 }}>Bank details for payment</Label>
            <Row gap={14}>{F('bankAccountName', 'Account name')}{F('bankName', 'Bank name')}</Row>
            <Row gap={14}>{F('bankAccountNumber', 'Account number')}{F('bankIfsc', 'IFSC', { upper: true })}</Row>
          </View>
        </Panel>
      </View>

      <View style={{ flex: 1, gap: 16, minWidth: 0 }}>
        <Panel title="Your invoice" sub="Updates as you fill in your details. Amounts come from your fees for the period.">
          <View style={{ flexDirection: 'row', gap: 16, paddingBottom: 14, borderBottomWidth: 1, borderColor: C.line }}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Label>Tax invoice</Label>
              <Tx f="play" w={600} s={18} style={{ marginTop: 4 }}>{p.legalName || name || 'Your registered name'}</Tx>
              {(addr.length > 0 || !!p.gstin || !!p.pan) && <Tx s={12} c={C.ink2} lh={1.5} style={{ marginTop: 6 }}>{[...addr, p.gstin && 'GSTIN: ' + p.gstin, p.pan && 'PAN: ' + p.pan].filter(Boolean).join('\n')}</Tx>}
            </View>
            <View style={{ alignItems: 'flex-end', gap: 3 }}>
              {[['Invoice no.', invoiceNumber || '–'], ['Date', dday(date)], ['Period', period.label]].map(([k, v]) => <Tx key={k} s={12} c={C.ink3}>{k} <Tx w={600} s={12} c={C.ink}>{v}</Tx></Tx>)}
            </View>
          </View>
          <View style={{ paddingVertical: 14, borderBottomWidth: 1, borderColor: C.line }}>
            <Label>Bill to</Label>
            <Tx w={600} s={13} style={{ marginTop: 4 }}>{QODE_ENTITY.name}</Tx>
            <Tx s={12} c={C.ink2} lh={1.5} style={{ marginTop: 3 }}>{[...qodeAddressLines(), QODE_ENTITY.gstin && 'GSTIN: ' + QODE_ENTITY.gstin, 'SEBI Registered Portfolio Manager · ' + QODE_ENTITY.sebiRegistration].filter(Boolean).join('\n')}</Tx>
          </View>
          <View style={{ flexDirection: 'row', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderColor: C.line }}>
            <View style={{ flex: 1 }}>
              <Tx w={600} s={13}>Distribution fees: {period.label}</Tx>
              <Tx s={12} c={C.ink3} lh={1.5} style={{ marginTop: 3 }}>{ratePct} share of fees on {plural(clientCount, 'client', 'clients')}{discount > 0 ? `, net of ${inr(discount)} in discounts given to clients` : ''}. {dday(period.startDate)} to {dday(period.endDate)}.</Tx>
            </View>
            <Amt s={13.5}>{inr(tax.taxableValue)}</Amt>
          </View>
          <KeyVals items={[
            ['Taxable value', inr(tax.taxableValue)],
            ...(tax.treatment === 'intra_state' ? [[`CGST at ${tax.cgstRate}%`, inr(tax.cgst)], [`SGST at ${tax.sgstRate}%`, inr(tax.sgst)]] : []),
            ...(tax.treatment === 'inter_state' ? [[`IGST at ${tax.igstRate}%`, inr(tax.igst)]] : []),
            ...(tax.treatment === 'unregistered' ? [['GST', 'Not registered, none charged']] : []),
            ['Total', <Amt key="t" w={700} s={16} c={C.green}>{inr(tax.total)}</Amt>],
          ]} />
          <Tx s={12} c={C.ink3} style={{ fontStyle: 'italic', marginTop: 4 }}>{amountInWords(tax.total)}</Tx>
          {(!!p.bankAccountNumber || !!p.bankIfsc) && (
            <View style={{ paddingTop: 12, marginTop: 12, borderTopWidth: 1, borderColor: C.line }}>
              <Label>Payment details</Label>
              <Tx s={12} c={C.ink2} lh={1.5} style={{ marginTop: 4 }}>{[p.bankAccountName, p.bankName, p.bankAccountNumber && 'A/c ' + p.bankAccountNumber, p.bankIfsc && 'IFSC ' + p.bankIfsc].filter(Boolean).join('\n')}</Tx>
            </View>
          )}
        </Panel>
        {!!st.err && <Notice tone="bad">{st.err}</Notice>}
        {!!st.msg && <Notice>{st.msg}</Notice>}
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Btn kind="outline" label={st.saving ? 'Saving…' : st.saved ? 'Saved' : 'Save details'} onPress={save} style={{ flex: 1 }} />
          <Btn label={st.issuing ? 'Generating…' : 'Generate invoice'} icon={<Download s={14} c={C.gold} />} onPress={generate} disabled={!ready} busy={st.issuing} style={{ flex: 1 }} />
        </View>
        <Tx s={12} c={C.ink3} lh={1.5}>{!ready && qodeOk ? 'Fill in your name, address and invoice number first. ' : ''}Your invoice number is recorded when you generate, so each one is only used once. The PDF opens in your browser’s print dialog: choose “Save as PDF”.</Tx>
      </View>
      <Dialog visible={pickState} onClose={() => setPickState(false)} title="Select your state" width={420}>
        {Object.entries(GST_STATE_CODES).sort((a, b) => a[1].localeCompare(b[1])).map(([code, n]) => (
          <Pressable key={code} onPress={() => { set('stateCode', code); set('state', n); setPickState(false); }} style={({ hovered }) => ({ paddingVertical: 9, paddingHorizontal: 10, borderRadius: 8, backgroundColor: p.stateCode === code ? C.greenTint : hovered ? C.hover : 'transparent' })}>
            <Tx s={13.5} w={p.stateCode === code ? 600 : 400}>{n}</Tx>
          </Pressable>
        ))}
      </Dialog>
    </Row>
  );
}

/* ── Onboarding links ───────────────────────────────────────────────────────────────────────────────────── */
function LinkPanel({ title, sub, url }) {
  const [copied, setCopied] = useState(false);
  return (
    <Panel title={title} sub={sub}>
      <View style={{ padding: 12, borderRadius: 8, backgroundColor: C.subtle, borderWidth: 1, borderColor: C.line }}>
        <Tx s={13} c={C.green} selectable numberOfLines={2}>{url}</Tx>
      </View>
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
        <Btn small label={copied ? 'Copied' : 'Copy link'} icon={<Copy s={13} c={C.gold} />} onPress={() => { Clipboard.setStringAsync(url).catch(() => {}); setCopied(true); setTimeout(() => setCopied(false), 1500); }} />
        <Btn small kind="outline" label="Open" onPress={() => Linking.openURL(url).catch(() => {})} />
        <Btn small kind="outline" label="Send by email" icon={<MailIcon s={13} c={C.ink2} />} onPress={() => Linking.openURL('mailto:?subject=' + encodeURIComponent('Open your Qode account') + '&body=' + encodeURIComponent(url)).catch(() => {})} />
      </View>
    </Panel>
  );
}
function Links({ journey }) {
  const d = journey.data;
  if (journey.loading && !d) return <Loading rows={3} />;
  if (journey.err) return <ErrorBlock msg="We couldn’t load your links. Please refresh to try again." onRetry={journey.reload} />;
  const L = d.referralLinks;
  return (
    <View style={{ gap: 20 }}>
      <PageIntro sub="Send someone the right link and their account is recorded against your name automatically." />
      {!L ? <Empty title="Your links aren’t set up yet">Email {PARTNERSHIPS} and we’ll create them for you.</Empty> : (
        <Row>
          <View style={{ flex: 1 }}><LinkPanel title="For an individual" sub="A person investing in their own name" url={L.individual} /></View>
          <View style={{ flex: 1 }}><LinkPanel title="For a company, LLP, HUF or trust" sub="Anything that is not an individual" url={L.nonIndividual} /></View>
        </Row>
      )}
      <Panel title="Questions about your investors or payouts?">
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
          <Tx s={13} c={C.ink2} lh={1.55} style={{ flex: 1 }}>Email {PARTNERSHIPS}. We usually reply the same day.</Tx>
          <Btn small kind="outline" label="Email us" icon={<MailIcon s={13} c={C.ink2} />} onPress={() => mail(PARTNERSHIPS)} />
        </View>
      </Panel>
    </View>
  );
}

/* ── Sales decks ────────────────────────────────────────────────────────────────────────────────────────── */
function Decks() {
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState({});
  const get = async d => {
    if (busy) return;
    setBusy(d.slug); setErr(e => ({ ...e, [d.slug]: '' }));
    try { await openFile({ kind: 'deck', slug: d.slug }, 'That document is unavailable just now.'); }
    catch (e) { setErr(o => ({ ...o, [d.slug]: e.status === 401 || e.status === 403 ? 'Please sign in again to download this.' : e.status ? 'That document is unavailable just now.' : 'Download failed. Please check your connection and try again.' })); }
    setBusy('');
  };
  const sections = [['The firm', DECKS.filter(d => !d.strategy)], ['Strategy decks', DECKS.filter(d => d.strategy && d.kind !== 'factsheet')], ['Factsheets', DECKS.filter(d => d.kind === 'factsheet')]];
  return (
    <View style={{ gap: 20 }}>
      <PageIntro sub="Download and share with prospective investors. Each file opens in a new tab." />
      <Grid min={320} gap={20}>
        {sections.map(([h, items]) => (
          <Panel key={h} title={h} pad={0}>
            {items.map(d => {
              const col = d.strategy ? STRATEGY_COLOR[d.strategy] || C.ink3 : C.green;
              return (
                <View key={d.slug} style={{ paddingVertical: 12, paddingHorizontal: 20, borderTopWidth: 1, borderColor: C.line }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <View style={{ width: 36, height: 36, borderRadius: 8, backgroundColor: col + '1a', alignItems: 'center', justifyContent: 'center' }}><DocIcon s={17} c={col} /></View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Tx w={600} s={13.5} numberOfLines={1}>{d.title}</Tx>
                      <Tx s={12} c={C.ink3}>{d.asOf}</Tx>
                    </View>
                    <Btn small kind="outline" label={busy === d.slug ? 'Preparing…' : 'Download'} icon={<Download s={13} c={C.ink2} />} onPress={() => get(d)} disabled={!!busy && busy !== d.slug} />
                  </View>
                  {!!err[d.slug] && <Tx s={12} c={C.red} style={{ marginTop: 6 }}>{err[d.slug]}</Tx>}
                </View>
              );
            })}
          </Panel>
        ))}
      </Grid>
    </View>
  );
}

/* ── Indicators ─────────────────────────────────────────────────────────────────────────────────────────── */
function Indicators() {
  const ind = useLoad(() => api.indicator(), []);
  const series = useMemo(() => {
    const list = (ind.data && ind.data.series) || [];
    return Object.fromEntries(SEGMENTS.map(s => [s[0], toSeries(list.find(e => e.segment === s[2]))]));
  }, [ind.data]);
  const asOf = useMemo(() => Math.max(0, ...Object.values(series).map(p => (p.length ? p[p.length - 1].t : 0))), [series]);
  const Seg = ({ seg }) => {
    const pts = series[seg[0]];
    const latest = pts.length ? pts[pts.length - 1] : null;
    return (
      <Panel title={seg[1]} sub={seg[3]} right={latest ? (
        <View style={{ alignItems: 'flex-end' }}>
          <Amt w={600} s={20} c={latest.v >= RISK_OFF ? VSI.redLabel : latest.v <= RISK_ON ? VSI.greenLabel : C.ink}>{latest.v.toFixed(2)}%</Amt>
          <Tx s={11.5} c={C.ink3}>Latest, {ddmmyyyy(latest.t)}</Tx>
        </View>) : null}>
        {pts.length === 0 ? <Tx s={13} c={C.ink3}>No indicator data is available right now.</Tx> : <VsiChart pts={pts} zone={seg[1]} />}
      </Panel>
    );
  };
  return (
    <View style={{ gap: 20 }}>
      <Panel title="Valuation spread indicator" sub={asOf ? 'Data as of ' + ddmmyyyy(asOf) : 'Updated daily from Qode research'}>
        <View style={{ flexDirection: 'row', gap: 28, alignItems: 'flex-start' }}>
          <Tx s={13} c={C.ink2} lh={1.6} style={{ flex: 1 }}>How much of the market is trading rich against its own history. Each stock’s price-to-book is ranked against its own 10-year history; the indicator is the share of the segment trading in the expensive half. Above {RISK_OFF}% Qode underweights the segment (Risk OFF); below {RISK_ON}% it overweights (Risk ON).</Tx>
          <View style={{ gap: 8 }}>
            {[[VSI.redOuter, `Risk OFF: above ${RISK_OFF}%`], [VSI.greenOuter, `Risk ON: below ${RISK_ON}%`]].map(([c, l]) => (
              <View key={l} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><View style={{ width: 14, height: 10, borderRadius: 2, backgroundColor: c }} /><Tx s={12.5} c={C.ink2}>{l}</Tx></View>
            ))}
          </View>
        </View>
      </Panel>
      {ind.loading && !ind.data && <Loading rows={4} />}
      {!ind.loading && !!ind.err && <ErrorBlock msg={/being rebuilt/i.test(ind.err) ? 'The indicator is being rebuilt. Check back shortly.' : 'We couldn’t load the indicator. Please refresh.'} onRetry={ind.reload} />}
      {!!ind.data && (<>
        <Seg seg={SEGMENTS[0]} />
        <Grid min={480} gap={20}>{SEGMENTS.slice(1).map(s => <Seg key={s[0]} seg={s} />)}</Grid>
        <Tx s={12} c={C.ink3}>Source: Ace Equity, Qode Advisors LLP. Click or drag across a chart for a reading.</Tx>
      </>)}
    </View>
  );
}

/* ── Support ────────────────────────────────────────────────────────────────────────────────────────────── */
function Support() {
  const [topic, setTopic] = useState('');
  const [about, setAbout] = useState('');
  const [message, setMessage] = useState('');
  const [st, setSt] = useState({ busy: false, err: '', done: false });
  const hint = (TOPICS.find(t => t[0] === topic) || [])[2];
  const withInvestor = topic === 'investor' || topic === 'onboarding';
  const submit = async () => {
    if (st.busy) return;
    if (!topic) return setSt({ busy: false, err: 'Please pick what this is about.', done: false });
    if (!message.trim()) return setSt({ busy: false, err: 'Please tell us what you need.', done: false });
    setSt({ busy: true, err: '', done: false });
    try {
      await api.ticket({ topic, aboutInvestor: withInvestor ? about.trim() : '', message: message.trim() });
      setSt({ busy: false, err: '', done: true });
    } catch (e) { setSt({ busy: false, err: e.status ? e.message || 'We couldn’t send that. Please try again.' : 'We couldn’t send that. Please check your connection and try again.', done: false }); }
  };
  const contact = (
    <View style={{ width: 340, gap: 20 }}>
      <Panel title="Talk to us">
        <KeyVals items={[
          ['Email', <TextLink key="e" label={PARTNERSHIPS} onPress={() => mail(PARTNERSHIPS)} />],
          ['Phone', <TextLink key="p" label="+91 93265 35470" onPress={() => Linking.openURL('tel:+919326535470').catch(() => {})} />],
        ]} />
      </Panel>
      <Panel title="What happens next">
        <Tx s={13} c={C.ink2} lh={1.6}>Your ticket goes to our distributor support team, who reply to your sign-in email, usually the same working day. You don’t need to send it again.</Tx>
      </Panel>
    </View>
  );
  if (st.done) return (
    <Row top>
      <View style={{ flex: 1 }}>
        <Empty title="Ticket raised">Our team has it and will reply to you by email. You don’t need to send it again.</Empty>
        <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 16 }}>
          <Btn label="Raise another" onPress={() => { setTopic(''); setAbout(''); setMessage(''); setSt({ busy: false, err: '', done: false }); }} />
        </View>
      </View>
      {contact}
    </Row>
  );
  return (
    <Row top>
      <View style={{ flex: 1, gap: 20, minWidth: 0 }}>
        <Panel title="What is this about?" sub="Tell us what you need and our team will reply by email">
          <Grid min={260} gap={10}>
            {TOPICS.map(([k, l, h]) => {
              const on = topic === k;
              return (
                <Pressable key={k} accessibilityRole="radio" accessibilityState={{ checked: on }} onPress={() => { if (k !== topic) setMessage(''); setTopic(k); setSt(s => ({ ...s, err: '' })); }}
                  style={({ hovered }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 10, borderWidth: 1, borderColor: on ? C.green : C.line, backgroundColor: on ? C.greenTint : hovered ? C.hover : C.card })}>
                  <View style={{ width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: on ? C.green : C.line2, alignItems: 'center', justifyContent: 'center' }}>
                    {on && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: C.green }} />}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Tx w={600} s={13.5}>{l}</Tx>
                    <Tx s={12} c={C.ink3}>{h}</Tx>
                  </View>
                </Pressable>
              );
            })}
          </Grid>
        </Panel>
        <Panel title="Details">
          <View style={{ gap: 14 }}>
            {withInvestor && <Input label="Which investor? (optional)" value={about} onChangeText={t => setAbout(t.slice(0, 200))} placeholder="Name or email" />}
            <Input label="What do you need?" value={message} onChangeText={t => setMessage(t.slice(0, 4000))} multiline
              placeholder={(hint ? hint + '. ' : '') + 'The more detail you give, the fewer times we have to come back to you.'} hint={`${message.length} / 4000`} />
            {!!st.err && <Tx s={12.5} c={C.red}>{st.err}</Tx>}
            <View style={{ flexDirection: 'row' }}><Btn label={st.busy ? 'Sending…' : 'Raise ticket'} onPress={submit} busy={st.busy} /></View>
          </View>
        </Panel>
      </View>
      {contact}
    </Row>
  );
}

/* ── Risk and controls ──────────────────────────────────────────────────────────────────────────────────── */
function Policies() {
  const R = content.RISK;
  return (
    <View style={{ gap: 20 }}>
      <PageIntro sub={R.intro.join(' ') + ' Share them with prospective investors who ask how portfolios are run.'} />
      <Grid min={340} gap={20}>
        {R.policies.map(p => (
          <Panel key={p.title} title={sc(p.title)} style={{ flex: 1 }}>
            {p.body.map((t, i) => <Tx key={i} s={13} c={C.ink2} lh={1.6} style={{ marginTop: i ? 8 : 0 }}>{t}</Tx>)}
            {!!p.pdf && <View style={{ flexDirection: 'row', marginTop: 14 }}><Btn small kind="outline" label="View policy (PDF)" icon={<DocIcon s={13} c={C.ink2} />} onPress={() => openUrl(p.pdf)} /></View>}
          </Panel>
        ))}
      </Grid>
    </View>
  );
}

/* ── Profile ────────────────────────────────────────────────────────────────────────────────────────────── */
function Profile({ V, journey, go }) {
  const u = V.user || {};
  const d = journey.data || {};
  const dist = d.distributor || {};
  return (
    <Row top>
      <View style={{ flex: 1, gap: 20 }}>
        <Panel title="Signed in as">
          <KeyVals items={[
            ['Name', u.name || dist.name || 'Distributor'],
            ['Email', u.email || dist.email || '–'],
            ...(dist.name && dist.name !== u.name ? [['Distributor record', dist.name]] : []),
            ...(d.portalClientCount != null ? [['Client accounts in the portal', String(d.portalClientCount)]] : []),
            ...(d.totals ? [['Investors referred', String(d.totals.investors || 0)]] : []),
          ]} />
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
            <Btn kind="danger" label="Sign out" onPress={V.doLogout} />
          </View>
        </Panel>
        {V.testMode && <Notice tone="bad">Test mode is on: actions that could reach a client are blocked.</Notice>}
      </View>
      <View style={{ flex: 1, gap: 20 }}>
        <Panel title="Distributor tools">
          {[['links', 'Onboarding links', 'Share with a prospective investor'], ['decks', 'Sales decks', 'Download and share with prospective investors'], ['policies', 'Risk and controls', 'The policies that guide portfolio construction'], ['support', 'Raise a ticket', 'Our team replies by email']].map(([k, t, s], i) => (
            <Pressable key={k} onPress={() => go(k)} accessibilityRole="link" style={({ hovered }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11, paddingHorizontal: 10, marginHorizontal: -10, borderRadius: 8, borderTopWidth: i ? 1 : 0, borderColor: C.line, backgroundColor: hovered ? C.hover : 'transparent' })}>
              <View style={{ flex: 1 }}><Tx w={600} s={13.5}>{t}</Tx><Tx s={12} c={C.ink3}>{s}</Tx></View>
              <ChevronRight s={12} c={C.ink3} />
            </Pressable>
          ))}
        </Panel>
        <Panel title="Our distributor team">
          <KeyVals items={[
            ['Email', <TextLink key="e" label={PARTNERSHIPS} onPress={() => mail(PARTNERSHIPS)} />],
            ['Phone', <TextLink key="p" label="+91 93265 35470" onPress={() => Linking.openURL('tel:+919326535470').catch(() => {})} />],
          ]} />
        </Panel>
      </View>
    </Row>
  );
}
