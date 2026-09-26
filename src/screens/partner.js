// Partner (distributor) app — the web partner portal's remaining sections, same content and figures, laid out for a
// phone. Web source of truth for each part:
//   InvestorDetail   app/(protected)/distributors/investors/[email]/page.tsx
//   Fees             app/(protected)/distributor/fees-distribution/page.tsx          (+ statement/, invoice/)
//   Decks            app/(protected)/distributors/documents/page.tsx + lib/distributorDocuments.ts
//   Indicators       components/indicators/valuation-spread-indicator.tsx
//   Ticket           app/(protected)/distributors/support/page.tsx
//   Policies         app/(protected)/trust/risk-managment-and-controls/page.tsx (the web links partners there)
// Figures come from /api/mobile/distributor/* which call the web's own routes, so they are identical.
import React, { useState, useMemo, useEffect } from 'react';
import { View, Pressable, ScrollView, TextInput, Linking, Modal, Dimensions, PanResponder } from 'react-native';
import Svg, { Path, Rect, Line, Text as SvgText } from 'react-native-svg';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';
import { C, Tx, Amt, Card, CTA, Fade, Field } from '../ui';
import { ChevronDown, ChevronLeft, ChevronRight, DocIcon, MailIcon, Phone, Download } from '../icons';
import { distributor as api, BASE_URL } from '../api';
import { useLoad, openUrl, SectionLabel, Loading, ErrorBox } from './kit';
import { DateField } from './sip';
import { storeGet, storeSet, storeDel } from '../api/session';
import * as content from '../content';
import { computeTax, GST_STATE_CODES, validateGstin, validatePan, amountInWords, QODE_ENTITY, qodeAddressLines, isQodeEntityComplete } from '../partnerTax';

// ── shared ───────────────────────────────────────────────────────────────────
const STRATEGY_COLOR = { 'Qode All Weather': '#008455', 'Qode Growth Fund': '#0A3452', 'Qode Tactical Fund': '#550E0E' };
const NEUTRAL = '#9CA3AF';
const QAW = '#008455';
const shortStrategy = n => String(n || '').replace(/^Qode\s+/, '').replace(/\s+Fund$/, '');
// web money() / formatDate()
export const money = n => {
  if (n == null || isNaN(n)) return '—';
  const abs = Math.abs(n), sign = n < 0 ? '−' : '';
  if (abs >= 10000000) return `${sign}₹${(abs / 10000000).toFixed(2)} Cr`;
  if (abs >= 100000) return `${sign}₹${(abs / 100000).toFixed(1)} L`;
  return `${sign}₹${abs.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
};
export const formatDate = iso => { if (!iso) return '—'; const d = new Date(iso); return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); };

export function BackRow({ label, onPress }) {
  return (
    <Pressable onPress={onPress} hitSlop={8} accessibilityRole="button" accessibilityLabel={'Back to ' + label}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: -34, marginBottom: 14, alignSelf: 'flex-start', paddingVertical: 9, paddingLeft: 10, paddingRight: 16, borderRadius: 999, backgroundColor: C.card, zIndex: 2, elevation: 3, shadowColor: C.ink, shadowOpacity: 0.12, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } }}>
      <ChevronLeft s={16} c={C.green} />
      <Tx w={700} s={12.5} c={C.green}>{label}</Tx>
    </Pressable>
  );
}
const KV = ({ k, v, last }) => (
  <View style={{ flexDirection: 'row', gap: 10, paddingVertical: 10, borderBottomWidth: last ? 0 : 1, borderColor: C.hairline }}>
    <Tx w={700} s={10} ls={0.08} c={C.muted} style={{ flex: 1, marginTop: 2 }}>{String(k).toUpperCase()}</Tx>
    <Tx w={700} s={12.5} style={{ flex: 1.3, textAlign: 'right' }}>{v == null || v === '' ? '—' : v}</Tx>
  </View>
);
const Msg = ({ text, tone = 'muted' }) => !text ? null : (
  <Card style={{ padding: 12, marginBottom: 12, borderWidth: 1, borderColor: tone === 'red' ? 'rgba(239,68,68,0.4)' : C.gold35 }}>
    <Tx s={12} c={tone === 'red' ? C.red : C.muted} lh={1.5}>{String(text).split(/([\w.+-]+@[\w-]+\.[\w.]+\w)/).map((part, i) => i % 2
      ? <Tx key={i} w={700} s={12} c={C.green} onPress={() => Linking.openURL('mailto:' + part)}>{part}</Tx>   // web: a mailto link
      : part)}</Tx>
  </Card>
);

// Opens a statement / deck PDF from a signed 5-minute link, without leaving the app:
//   iOS      in-app viewer (Safari view) — shows the PDF, "Done" returns to the app, share button to save/send;
//   Android  downloads it into the app's cache, then the system sheet: open in a PDF viewer, save or send.
//            (Handing the URL to Chrome made it download silently and left the user outside the app.)
export async function openPdf(body, fail) {
  const r = await api.fileLink(body);
  if (!r || !r.url) throw new Error(fail);
  const url = BASE_URL + r.url;
  if (Platform.OS === 'ios') { await WebBrowser.openBrowserAsync(url, { presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET }); return; }
  if (Platform.OS === 'web') { openUrl(url); return; }
  const name = String(r.fileName || 'document.pdf').replace(/[^\w .()-]/g, '').replace(/\s+/g, ' ').trim() || 'document.pdf';
  const dest = FileSystem.cacheDirectory + (name.toLowerCase().endsWith('.pdf') ? name : name + '.pdf');
  const res = await FileSystem.downloadAsync(url, dest);
  if (res.status !== 200) { const e = new Error(fail); e.status = res.status; throw e; }
  await Sharing.shareAsync(res.uri, { mimeType: 'application/pdf', dialogTitle: name, UTI: 'com.adobe.pdf' });
}

// ── Investor detail (web: investors/[email]) ─────────────────────────────────
const ACCOUNT_JOURNEY = [
  ['Onboarding', 'Opening the account', null],
  ['Account Live', 'Open, nothing invested', 'accountLiveDate'],
  ['First Fund Initiated', 'Money invested', 'activationDate'],
  ['Regular Investor', 'Invested and active', 'firstTopUpDate'],
];

export function InvestorDetail({ c, status, onBack, onboardingSequence, view }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const delta = c.currentValue != null && c.investedAmount != null ? c.currentValue - c.investedAmount : null;
  const deltaPct = delta != null && c.investedAmount ? (delta / c.investedAmount) * 100 : null;
  const jIdx = ACCOUNT_JOURNEY.findIndex(j => j[0] === c.stage);
  const rank = st => { const i = onboardingSequence.indexOf(st); return i === -1 ? onboardingSequence.length : i; };
  const cur = c.onboardingStage ? rank(c.onboardingStage) : -1;
  const soa = async () => {
    if (busy) return;
    setBusy(true); setMsg('');
    try { await openPdf({ kind: 'soa', email: c.email }, 'No SOA has been issued for this investor yet.'); }
    catch (e) { setMsg(e.status === 404 ? 'No SOA has been issued for this investor yet.' : 'We couldn’t fetch the SOA. Please try again.'); }
    setBusy(false);
  };
  return (
    <Fade>
      <BackRow label="Your investors" onPress={onBack} />
      <Tx f="play" w={600} s={24}>{c.name || 'Investor'}</Tx>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
        <View style={{ paddingVertical: 3, paddingHorizontal: 8, borderRadius: 999, backgroundColor: status.tone === 'warn' ? 'rgba(239,68,68,0.12)' : 'rgba(2,66,43,0.1)' }}>
          <Tx w={700} s={10} ls={0.06} c={status.tone === 'warn' ? C.red : C.green}>{status.label.toUpperCase()}</Tx>
        </View>
        <Tx s={12} c={C.muted}>{status.key === 'onboarding' && c.onboardingStage ? c.onboardingStage : status.detail}</Tx>
      </View>
      <View style={{ marginTop: 12 }}><Msg text={msg} /></View>
      {!!view && !!view.err && <Msg tone="red" text={view.err} />}
      {(!!c.email || !!c.clientCode) && (
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 2 }}>
          {!!c.clientCode && view && <CTA label={view.opening === c.clientCode ? 'OPENING…' : 'VIEW PORTFOLIO'} onPress={() => view.open(c)} style={{ flex: 1, paddingVertical: 12 }} />}
          {!!c.email && <CTA label={busy ? 'WORKING…' : 'DOWNLOAD SOA'} outline onPress={soa} style={{ flex: 1, paddingVertical: 12 }} />}
        </View>
      )}

      <Card style={{ padding: 18, marginTop: 14 }}>
        <Tx w={700} s={10.5} ls={0.12} c={C.muted}>CURRENT VALUE</Tx>
        <Amt w={700} s={28} style={{ marginTop: 4 }}>{money(c.currentValue)}</Amt>
        {delta != null && deltaPct != null
          ? <Tx s={12.5} style={{ marginTop: 6 }}><Tx w={700} s={12.5} c={delta >= 0 ? QAW : C.red}>{delta >= 0 ? '▲' : '▼'} {money(Math.abs(delta))} ({delta >= 0 ? '+' : '−'}{Math.abs(deltaPct).toFixed(1)}%)</Tx><Tx s={12.5} c={C.muted}> against {money(c.investedAmount)} invested</Tx></Tx>
          : <Tx s={12} c={C.muted} style={{ marginTop: 6 }}>Holdings are not yet priced in our records.</Tx>}
        {(c.strategies || []).length > 0 && (
          <View style={{ marginTop: 14 }}>
            <Tx w={700} s={10} ls={0.1} c={C.muted}>STRATEGIES</Tx>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
              {c.strategies.map(n => (
                <View key={n} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 5, paddingHorizontal: 10, borderRadius: 999, borderWidth: 1, borderColor: C.hairline }}>
                  <View style={{ width: 9, height: 9, borderRadius: 2, backgroundColor: STRATEGY_COLOR[n] || NEUTRAL }} />
                  <Tx w={700} s={11.5}>{shortStrategy(n)}</Tx>
                </View>
              ))}
            </View>
          </View>
        )}
      </Card>

      {jIdx >= 0 && (<>
        <SectionLabel>ACCOUNT JOURNEY</SectionLabel>
        <Tx s={11.5} c={C.muted} style={{ marginTop: -4, marginBottom: 10, marginLeft: 2 }}>The stages an account passes through.</Tx>
        <Card style={{ paddingVertical: 6, paddingHorizontal: 16 }}>
          {ACCOUNT_JOURNEY.map(([st, meaning, field], i) => {
            const done = i < jIdx, here = i === jIdx;
            return (
              <View key={st} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: i < 3 ? 1 : 0, borderColor: C.hairline }}>
                <View style={{ width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: done || here ? C.green : 'transparent', borderWidth: 1, borderColor: done || here ? C.green : 'rgba(55,88,79,0.3)' }}>
                  <Tx w={700} s={11} c={done || here ? C.gold : C.muted}>{done ? '✓' : here ? '●' : i + 1}</Tx>
                </View>
                <View style={{ flex: 1 }}>
                  <Tx w={700} s={12.5} c={done || here ? C.ink : C.gray}>{st}</Tx>
                  <Tx s={11} c={C.muted}>{meaning}</Tx>
                </View>
                {!!field && <Tx s={11} c={C.muted}>{formatDate(c[field])}</Tx>}
              </View>
            );
          })}
        </Card>
      </>)}

      {status.key === 'onboarding' && !!c.onboardingStage && (<>
        <SectionLabel>ONBOARDING PROGRESS</SectionLabel>
        <Tx s={11.5} c={C.muted} style={{ marginTop: -4, marginBottom: 10, marginLeft: 2 }}>Steps completed, and what happens next.</Tx>
        <Card style={{ paddingVertical: 6, paddingHorizontal: 16 }}>
          {cur >= onboardingSequence.length
            ? <Tx s={12.5} style={{ paddingVertical: 10 }}>{c.onboardingStage}</Tx>
            : onboardingSequence.slice(0, cur + 2).map((st, i, a) => {
              const done = i < cur, here = i === cur;
              return (
                <View key={st} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: i < a.length - 1 ? 1 : 0, borderColor: C.hairline }}>
                  <View style={{ width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: done || here ? C.green : 'transparent', borderWidth: 1, borderColor: done || here ? C.green : 'rgba(55,88,79,0.3)' }}>
                    <Tx w={700} s={10} c={C.gold}>{done ? '✓' : here ? '●' : ''}</Tx>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Tx w={done || here ? 700 : 400} s={12.5} c={done || here ? C.ink : C.gray}>{st}</Tx>
                    {here && <Tx s={11} c={C.green}>Currently here{c.stageEntryDate ? ' since ' + formatDate(c.stageEntryDate) : ''}</Tx>}
                    {!done && !here && <Tx s={11} c={C.muted}>Next step</Tx>}
                  </View>
                </View>
              );
            })}
        </Card>
      </>)}

      <SectionLabel>ACCOUNT</SectionLabel>
      <Card style={{ paddingHorizontal: 16, paddingVertical: 4 }}>
        {[['Account code', c.clientCode], ['Activation date', formatDate(c.activationDate)], ['First investment', formatDate(c.accountLiveDate)], ['Last top-up', formatDate(c.firstTopUpDate)],
          ...(c.onboardingStage ? [['Onboarding stage', c.onboardingStage]] : []), ['Annual review', c.annualReviewStatus], ['Portal walkthrough', c.hadWalkthrough ? 'Done' : 'Not done']]
          .map(([k, v], i, a) => <KV key={k} k={k} v={v} last={i === a.length - 1} />)}
      </Card>

      <SectionLabel>CONTACT</SectionLabel>
      <Card style={{ paddingHorizontal: 16, paddingVertical: 4 }}>
        {[['Email', c.email], ['Mobile', c.mobile], ['City', c.city], ['Occupation', c.occupation], ['Relationship manager', c.relationshipManager], ['Next contact', formatDate(c.nextContactDate)]]
          .map(([k, v], i, a) => <KV key={k} k={k} v={v} last={i === a.length - 1} />)}
      </Card>
      {(!!c.mobile || !!c.email) && (
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
          {!!c.mobile && <CTA label="CALL" outline onPress={() => Linking.openURL('tel:' + String(c.mobile).replace(/[^\d+]/g, '')).catch(() => {})} style={{ flex: 1, paddingVertical: 11 }} />}
          {!!c.email && <CTA label="EMAIL" outline onPress={() => Linking.openURL('mailto:' + c.email).catch(() => {})} style={{ flex: 1, paddingVertical: 11 }} />}
        </View>
      )}
    </Fade>
  );
}

// ── Fees & payouts (web: distributor/fees-distribution) ──────────────────────
const num = s => parseFloat(String(s ?? '').replace(/,/g, '')) || 0;
const commissionOf = r => (r.yourCommission != null ? num(r.yourCommission) : num(r.distributorShare));
const inr = n => n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const inrCompact = n => (Math.abs(n) >= 1e7 ? `₹${(n / 1e7).toFixed(2)} Cr` : Math.abs(n) >= 1e5 ? `₹${(n / 1e5).toFixed(2)} L` : `₹${inr(n)}`);
const displayDate = iso => (iso ? new Date(`${String(iso).slice(0, 10)}T00:00:00`).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '');
const SCHEME = { QAW: 'Qode All Weather', QGF: 'Qode Growth Fund', QTF: 'Qode Tactical Fund', QFH: 'Qode Fund of Holdings', QLF: 'Qode Liquid Fund' };
const SCHEME_COLOR = { QAW: '#008455', QGF: '#0A3452', QTF: '#550E0E' };
const code3 = r => String(r.strategy || r.accountcode || '').slice(0, 3).toUpperCase();
const parseBillgroup = bg => {
  const s = String(bg || '');
  const m = s.match(/MF([\d.]+)/), p = s.match(/PF([\d.]+)/), h = s.match(/H([\d.]+)/);
  if (!m && !p && !h) return null;
  return { mf: m ? m[1] + '%' : '—', pf: p ? p[1] + '%' : '—', h: h ? h[1] + '%' : '—' };
};
const GST_RATE = 18;

// Called when the partner app opens: starts the slow Fees and indicator loads in the background, so the tabs
// are ready (or nearly) by the time they are opened. Errors are left for the tab to show.
export function warmPartnerData() {
  api.indicator().catch(() => {});
  api.feePeriods().then(d => { const p = defaultPeriod(d); if (p) api.feeRows(p).catch(() => {}); }).catch(() => {});
}

// Web default: the current FY (last Year in API order) → latest quarter → suggested → last.
function defaultPeriod(data) {
  const ps = (data && data.periods) || [];
  const years = ps.filter(p => p.type === 'Year'), qs = ps.filter(p => p.type === 'Quarter');
  return years[years.length - 1] || qs[qs.length - 1] || data.suggestedPeriod || ps[ps.length - 1] || null;
}

// Grouping and totals exactly as the web page (lines 440-633).
export function summarise(rows, search = '') {
  const groups = new Map();
  for (const r of rows) {
    const key = String(r.clientName || '').trim().toLowerCase().replace(/\s+/g, ' ');
    const g = groups.get(key) || { name: String(r.clientName || '').trim(), accounts: [], aum: 0, fixedFees: 0, perfFees: 0, totalFees: 0, gst: 0, share: 0, shareOfFee: 0, commission: 0, shareDiscount: 0, discount: 0, unmapped: true };
    g.accounts.push(r);
    g.aum += num(r.averageAum); g.fixedFees += num(r.fixedFees); g.perfFees += num(r.performanceFees); g.totalFees += num(r.totalFees);
    g.gst += num(r.totalFeesGst); g.share += commissionOf(r) * 1.18; g.shareOfFee += num(r.yourShareOfFee) || num(r.distributorShare);
    g.commission += commissionOf(r); g.shareDiscount += num(r.shareDiscount); g.discount += num(r.discountAmount);
    if (r.rateSource && r.rateSource !== 'unmapped') g.unmapped = false;
    groups.set(key, g);
  }
  const all = [...groups.values()].map(g => ({ ...g, accounts: g.accounts.sort((a, b) => num(b.distributorShare) - num(a.distributorShare)) })).sort((a, b) => b.share - a.share);
  const q = search.trim().toLowerCase();
  const clients = q ? all.filter(g => g.name.toLowerCase().includes(q) || g.accounts.some(a => String(a.accountcode || a.strategy || '').toLowerCase().includes(q))) : all;
  const t = { share: 0, aum: 0, fixedFees: 0, perfFees: 0, totalFees: 0, gst: 0, shareOfFee: 0, shareDiscount: 0, commission: 0, discount: 0, clientCount: all.length, accountCount: rows.length, unmappedCount: all.filter(g => g.unmapped).length };
  for (const g of all) { t.share += g.share; t.aum += g.aum; t.fixedFees += g.fixedFees; t.perfFees += g.perfFees; t.totalFees += g.totalFees; t.gst += g.gst; t.shareOfFee += g.shareOfFee; t.shareDiscount += g.shareDiscount; t.commission += g.commission; t.discount += g.discount; }
  t.shareGst = t.share * GST_RATE / (100 + GST_RATE);
  t.shareNet = t.share - t.shareGst;
  const r0 = rows[0];
  t.sharePct = r0 ? (r0.distributorShareCategory || (num(r0.distributorPercentage) > 0 ? `${r0.distributorPercentage}%` : null)) : null;
  return { clients, all, totals: t };
}

export function Fees({ onStatement, onInvoice }) {
  const periods = useLoad(() => api.feePeriods(), []);
  const [period, setPeriod] = useState(null);
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState({});
  const [pickOpen, setPickOpen] = useState(false);
  useEffect(() => { if (periods.data && !period) setPeriod(defaultPeriod(periods.data)); }, [periods.data]);
  const rows = useLoad(() => (period ? api.feeRows(period) : Promise.resolve(null)), [period && period.label]);
  const list = Array.isArray(rows.data) ? rows.data : [];
  const { clients, totals: t } = useMemo(() => summarise(list, search), [rows.data, search]);
  const [csvBusy, setCsvBusy] = useState(false);
  const downloadCsv = async () => {
    if (csvBusy || !period) return;
    setCsvBusy(true);
    try {
      const head = ['Client', 'Account Code', 'Strategy', 'Inception Date', 'Fee Structure', 'Standard Fixed %', 'Standard Performance %', 'Hurdle %',
        'Client Assets', 'Management Fee (before GST)', 'Performance Fee (before GST)', 'Charged Fixed %', 'Your %', 'Your Share', 'Discount',
        'Your Net Rate % p.a.', 'Your Commission (before GST)', 'Rate Source'];
      const q = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
      const lines = [head.join(',')];
      for (const g of clients) for (const a of g.accounts) {
        lines.push([q(g.name), a.accountcode ?? '', a.strategy ?? '', a.inceptionDate ?? '', q(a.feeStructureLabel ?? ''), a.rackFixedFeePct ?? '', a.rackPerfFeePct ?? '', a.hurdlePct ?? '',
          num(a.averageAum).toFixed(2), num(a.fixedFees).toFixed(2), num(a.performanceFees).toFixed(2), a.actualFeeChargedPct ?? '', a.distributorPercentage ?? '',
          num(a.yourShareOfFee).toFixed(2), num(a.shareDiscount).toFixed(2), a.netFeePctOfAum != null ? Number(a.netFeePctOfAum).toFixed(2) : '', commissionOf(a).toFixed(2), a.rateSource ?? ''].join(','));
      }
      const name = `qode-fees-${String(period.label).replace(/\s+/g, '-')}.csv`;
      if (Platform.OS === 'web') { openUrl('data:text/csv;charset=utf-8,' + encodeURIComponent(lines.join('\n'))); return; }
      const uri = FileSystem.cacheDirectory + name;
      await FileSystem.writeAsStringAsync(uri, lines.join('\n'), { encoding: FileSystem.EncodingType.UTF8 });
      await Sharing.shareAsync(uri, { mimeType: 'text/csv', dialogTitle: name, UTI: 'public.comma-separated-values-text' });
    } catch {} finally { setCsvBusy(false); }
  };

  if (periods.loading && !periods.data) return <View style={{ marginTop: -30 }}><Loading rows={3} h={90} /></View>;
  if (periods.err) return <View style={{ marginTop: -30 }}><ErrorBox msg={'Could not load periods. ' + periods.err} onRetry={periods.reload} /></View>;
  const ps = periods.data.periods || [];
  const group = period ? ps.filter(p => p.type === period.type) : [];
  const gi = period ? group.findIndex(p => p.label === period.label) : -1;
  const groups = [['All time', ps.filter(p => p.type === 'Since Inception')], ['Quarters', ps.filter(p => p.type === 'Quarter').reverse()], ['Financial years', ps.filter(p => p.type === 'Year').reverse()]];
  return (
    <Fade>
      {/* Period: one compact row — the choice opens a grouped list; the arrows step to the next / previous period
          of the same kind (quarter or financial year), as the web's Earlier / Later buttons do. */}
      <Card big style={{ marginTop: -34, paddingVertical: 10, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        {(() => {
          const stepper = !!period && period.type !== 'Since Inception' && group.length > 1;
          const Arrow = ({ dir, ok, onPress }) => (
            <Pressable onPress={ok ? onPress : undefined} disabled={!ok} hitSlop={6} accessibilityRole="button" accessibilityLabel={dir < 0 ? 'Earlier period' : 'Later period'}
              style={{ width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: C.mutedBorder35, alignItems: 'center', justifyContent: 'center', opacity: ok ? 1 : 0.35 }}>
              {dir < 0 ? <ChevronLeft s={14} c={C.green} /> : <ChevronRight s={12} c={C.green} />}
            </Pressable>
          );
          return (<>
            {stepper && <Arrow dir={-1} ok={gi > 0} onPress={() => { setPeriod(group[gi - 1]); setOpen({}); }} />}
            <Pressable onPress={() => setPickOpen(true)} accessibilityRole="button" accessibilityLabel={`Period: ${period ? period.label : 'choose'}. Change period`}
              style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4, paddingHorizontal: 8 }}>
              <View style={{ flex: 1 }}>
                <Tx w={700} s={9.5} ls={0.12} c={C.muted}>PERIOD</Tx>
                <Tx w={700} s={14} numberOfLines={1} style={{ marginTop: 1 }}>{period ? period.label : 'Choose a period'}</Tx>
                {!!period && <Tx s={10.5} c={C.gray} numberOfLines={1}>{period.startDate} – {period.endDate}</Tx>}
              </View>
              <ChevronDown s={11} c={C.muted} />
            </Pressable>
            {stepper && <Arrow dir={1} ok={gi < group.length - 1} onPress={() => { setPeriod(group[gi + 1]); setOpen({}); }} />}
          </>);
        })()}
      </Card>
      <Modal visible={pickOpen} transparent animationType="fade" onRequestClose={() => setPickOpen(false)}>
        <Pressable onPress={() => setPickOpen(false)} style={{ flex: 1, backgroundColor: 'rgba(0,32,23,0.45)', justifyContent: 'center', padding: 28 }}>
          <Card style={{ maxHeight: Dimensions.get('window').height * 0.7, paddingVertical: 6, overflow: 'hidden' }}>
            <ScrollView>
              {groups.map(([h, items]) => items.length > 0 && (
                <View key={h}>
                  <Tx w={700} s={10} ls={0.12} c={C.muted} style={{ paddingHorizontal: 18, paddingTop: 12, paddingBottom: 6 }}>{h.toUpperCase()}</Tx>
                  {items.map((p, i) => {
                    const on = period && p.label === period.label;
                    return (
                      <Pressable key={p.label} onPress={() => { setPeriod(p); setOpen({}); setPickOpen(false); }} accessibilityRole="button" accessibilityState={{ selected: !!on }}
                        style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 11, paddingHorizontal: 18, borderTopWidth: 1, borderColor: C.hairline, backgroundColor: on ? 'rgba(2,66,43,0.06)' : 'transparent' }}>
                        <View style={{ flex: 1 }}>
                          <Tx w={on ? 700 : 400} s={13} c={on ? C.green : C.ink}>{p.label}{h === 'Quarters' && i === 0 ? '  · latest' : ''}</Tx>
                          <Tx s={10.5} c={C.gray}>{p.startDate} – {p.endDate}</Tx>
                        </View>
                        {on && <Tx w={700} s={13} c={C.green}>✓</Tx>}
                      </Pressable>
                    );
                  })}
                </View>
              ))}
            </ScrollView>
          </Card>
        </Pressable>
      </Modal>

      {rows.loading && <View style={{ marginTop: 14 }}><Loading rows={3} h={68} /></View>}
      {!rows.loading && !!rows.err && <View style={{ marginTop: 14 }}><Msg tone="red" text={`We couldn’t load your fees. ${rows.err}. Please refresh, or contact investor.relations@qodeinvest.com.`} /></View>}
      {!rows.loading && !rows.err && list.length === 0 && period && (
        <Card style={{ padding: 18, marginTop: 14 }}>
          <Tx w={700} s={13}>No fees in this period</Tx>
          <Tx s={12} c={C.muted} lh={1.5} style={{ marginTop: 4 }}>No fees were billed to your clients between {period.startDate} and {period.endDate}. Try an earlier period.</Tx>
        </Card>
      )}

      {!rows.loading && list.length > 0 && (<>
        <Card style={{ padding: 18, marginTop: 14 }}>
          <Tx w={700} s={10.5} ls={0.12} c={C.muted}>YOUR COMMISSION FOR {String(period.label).toUpperCase()}</Tx>
          <Amt w={700} s={30} style={{ marginTop: 6 }}>{inrCompact(t.shareNet)}</Amt>
          <Tx s={12} c={C.muted} style={{ marginTop: 2 }}>₹ {inr(t.shareNet)} · from {t.clientCount} {t.clientCount === 1 ? 'client' : 'clients'}</Tx>
          {!!t.sharePct && (<>
            <View style={{ flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 8, marginTop: 12, paddingVertical: 7, paddingHorizontal: 14, borderRadius: 999, backgroundColor: C.green }}>
              <Tx w={700} s={10.5} ls={0.1} c={C.gold}>YOUR REVENUE SHARE</Tx>
              <Tx w={700} s={13} c={C.gold}>{t.sharePct}</Tx>
            </View>
            <Tx s={11.5} c={C.muted} style={{ marginTop: 6 }}>of the standard fee for your clients{t.discount > 0 ? ', less the discounts you’ve given' : ''}</Tx>
          </>)}
          {t.shareNet > 0 && <Tx s={11.5} lh={1.5} style={{ marginTop: 6 }}>Plus GST of <Tx w={700} s={11.5}>₹ {inr(t.shareGst)}</Tx> — invoice ₹ {inr(t.share)} in total</Tx>}
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
            <IconButton label="RAISE INVOICE" icon={<DocIcon s={15} c={C.gold} w={1.8} />} primary onPress={() => onInvoice(period)} style={{ flex: 1.35 }} />
            <IconButton label="STATEMENT" onPress={() => onStatement(period)} style={{ flex: 1 }} />
            <IconButton label={csvBusy ? '…' : 'CSV'} icon={<Download s={15} c={C.green} />} onPress={downloadCsv} style={{ flex: 0.75 }} accessibilityLabel="Download CSV" />
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 16, borderTopWidth: 1, borderColor: C.hairline, paddingTop: 12 }}>
            {[['CLIENT AUM', inrCompact(t.aum)], ['FIXED FEES', inrCompact(t.fixedFees)], ['PERFORMANCE FEES', inrCompact(t.perfFees)], ['TOTAL FEES BILLED', inrCompact(t.totalFees), `+ ${inrCompact(t.gst)} GST`]].map(([k, v, sub]) => (
              <View key={k} style={{ width: '50%', paddingVertical: 6 }}>
                <Tx w={700} s={9.5} ls={0.08} c={C.muted}>{k}</Tx>
                <Tx w={700} s={14} style={{ marginTop: 2 }}>{v}</Tx>
                {!!sub && <Tx s={10.5} c={C.gray}>{sub}</Tx>}
              </View>
            ))}
          </View>
          {!!t.sharePct && (
            <View style={{ marginTop: 10, borderTopWidth: 1, borderColor: C.hairline, paddingTop: 12 }}>
              <Tx w={700} s={10.5} ls={0.12} c={C.muted}>HOW YOUR SHARE WAS CALCULATED</Tx>
              {[
                ...(t.perfFees > 0
                  ? [['Management fees your clients were charged', 'charged quarterly on their assets', t.fixedFees], ['Performance fees your clients were charged', 'charged annually on gains above the hurdle', t.perfFees]]
                  : [['Fees your clients were charged', 'charged quarterly on their assets', t.totalFees]]),
                ...(t.shareDiscount > 0
                  ? [[`Your share, ${t.sharePct} of those fees`, 'your revenue share, per your agreement with Qode', t.shareOfFee], ['Less the discount you gave', 'the lower fee you agreed with your clients', -t.shareDiscount, 'neg'], ['Your commission', 'at your net fee rate in the CRM', t.shareNet, 'sub']]
                  : [[`Your commission, ${t.sharePct} of those fees`, 'your revenue share, per your agreement with Qode', t.shareNet, 'sub']]),
                ['Plus GST at 18%', 'the statutory rate on your commission', t.shareGst],
                ['Payable to you', 'invoice this amount in full — GST is already included', t.share, 'total'],
              ].map(([k, sub, v, kind], i, arr) => (
                <View key={k} style={{ flexDirection: 'row', gap: 10, paddingVertical: 10, borderBottomWidth: i < arr.length - 1 && kind !== 'sub' ? 1 : 0, borderColor: C.hairline, ...(kind === 'total' || kind === 'sub' ? { borderTopWidth: 1.5, borderTopColor: kind === 'total' ? C.green : C.hairline } : null) }}>
                  <View style={{ flex: 1 }}>
                    <Tx w={kind ? 700 : 400} s={12.5}>{k}</Tx>
                    <Tx s={10.5} c={C.muted}>{sub}</Tx>
                  </View>
                  <Tx w={kind === 'total' || kind === 'sub' ? 700 : 400} s={12.5} c={kind === 'neg' ? C.red : C.ink}>{v < 0 ? `− ₹ ${inr(-v)}` : `₹ ${inr(v)}`}</Tx>
                </View>
              ))}
            </View>
          )}
        </Card>

        {t.unmappedCount > 0 && (
          <View style={{ marginTop: 14 }}>
            <Msg text={`${t.unmappedCount} ${t.unmappedCount === 1 ? 'client has' : 'clients have'} no fee rate configured. Their share shows as ₹0 because no rate has been set — not because none is due. Contact investor.relations@qodeinvest.com to have these confirmed.`} />
          </View>
        )}

        <SectionLabel>BY CLIENT</SectionLabel>
        <Card style={{ paddingHorizontal: 14, paddingVertical: 2, marginBottom: 10 }}>
          <TextInput value={search} onChangeText={setSearch} placeholder="Search by client or account code" placeholderTextColor={C.gray} autoCorrect={false} style={{ paddingVertical: 11, fontSize: 14, color: C.ink }} />
        </Card>
        {clients.length === 0 && (
          <Card style={{ padding: 16 }}>
            <Tx s={12.5} c={C.muted} center>No client matches “{search}”.</Tx>
            <CTA label="CLEAR SEARCH" outline onPress={() => setSearch('')} style={{ marginTop: 10, paddingVertical: 9 }} />
          </Card>
        )}
        {clients.map(g => {
          const exp = !!open[g.name];
          const terms = parseBillgroup(g.accounts[0] && (g.accounts[0].billgroup || g.accounts[0].billGroup));
          return (
            <Card key={g.name} style={{ marginBottom: 10, overflow: 'hidden' }}>
              <Pressable onPress={() => setOpen(o => ({ ...o, [g.name]: !exp }))} style={{ padding: 14 }}>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <View style={{ flex: 1 }}>
                    <Tx w={700} s={13}>{g.name}{g.unmapped ? '  ' : ''}{g.unmapped && <Tx w={700} s={10} c={C.red}>NO RATE</Tx>}</Tx>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginTop: 5 }}>
                      {g.accounts.map((a, i) => (
                        <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                          <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: SCHEME_COLOR[code3(a)] || NEUTRAL }} />
                          <Tx w={700} s={10.5} c={C.muted}>{code3(a)}</Tx>
                        </View>
                      ))}
                      <Tx s={10.5} c={C.muted}>· {inrCompact(g.aum)} AUM</Tx>
                    </View>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Tx w={700} s={13}>{inrCompact(g.commission)}</Tx>
                    <Tx s={10} c={C.muted}>{g.unmapped ? 'no rate set' : 'your commission'}</Tx>
                    {g.shareDiscount > 0 && <Tx s={10} c={C.red} style={{ marginTop: 2 }}>− {inrCompact(g.shareDiscount)} discount</Tx>}
                  </View>
                  <View style={{ justifyContent: 'center', transform: [{ rotate: exp ? '180deg' : '0deg' }] }}><ChevronDown s={10} c={C.muted} /></View>
                </View>
              </Pressable>
              {exp && (
                <View style={{ paddingHorizontal: 14, paddingBottom: 14 }}>
                  {/* Web: the client's fee terms as three labelled values, each "—" when absent. */}
                  {terms && (
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: 16, rowGap: 2, marginBottom: 8 }}>
                      {[['Management', terms.mf], ['Performance', terms.pf], ['Hurdle', terms.h]].map(([k, v]) => (
                        <Tx key={k} s={11} c={C.muted}>{k} <Tx s={11} c={C.ink}>{v}</Tx></Tx>
                      ))}
                    </View>
                  )}
                  {g.accounts.map((a, i) => {
                    // Web: the standard (rack) rate shows under the management fee only when the client pays below it.
                    const standardFee = num(a.totalRackRateFee) || num(a.totalFees);
                    const isDiscounted = num(a.discountAmount) > 0 && standardFee > num(a.totalFees);
                    const unmapped = a.rateSource === 'unmapped';
                    return (
                      <View key={i} style={{ borderTopWidth: 1, borderColor: C.hairline, paddingTop: 10, marginTop: i ? 10 : 0 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <View style={{ width: 9, height: 9, borderRadius: 2, backgroundColor: SCHEME_COLOR[code3(a)] || NEUTRAL }} />
                          <Tx w={700} s={12.5} style={{ flex: 1 }}>{SCHEME[code3(a)] || a.strategy || a.accountcode || '—'}</Tx>
                        </View>
                        {!!a.isZeroFee && <Tx s={11} c={C.muted} style={{ marginTop: 2, paddingLeft: 15 }}>No fee arrangement</Tx>}
                        <Tx s={10.5} c={C.gray} style={{ marginTop: 2, paddingLeft: 15 }}>{a.accountcode}{a.inceptionDate ? ' · opened ' + displayDate(a.inceptionDate) : ''}</Tx>
                        <View style={{ marginTop: 4 }}>
                          <FeeLine k="Client assets" v={a.averageAum} />
                          {a.isZeroFee ? <Tx s={11.5} c={C.muted} style={{ marginTop: 4, fontStyle: 'italic', textAlign: 'right' }}>No fees charged on this account</Tx> : (<>
                            <FeeLine k="Management fee (before GST)" v={a.fixedFees}
                              sub={[num(a.fixedFees) > 0 && a.actualFeeChargedPct != null ? `(${a.actualFeeChargedPct}%)` : '', isDiscounted && a.rackFixedFeePct != null ? `standard ${a.rackFixedFeePct}%` : ''].filter(Boolean).join('\n')} />
                            <FeeLine k="Performance fee (before GST)" v={num(a.performanceFees) > 0 ? a.performanceFees : '—'}
                              sub={num(a.performanceFees) > 0 ? (a.rackPerfFeePct != null && num(a.rackPerfFeePct) > 0 ? `(${a.rackPerfFeePct}% over ${a.hurdlePct ?? 0}%)` : '') : 'billed annually'} />
                            <FeeLine k="Your share (share category × fee)" v={unmapped ? '—' : a.yourShareOfFee} sub={unmapped ? '' : `(${a.distributorPercentage}%)`} />
                            <FeeLine k="Discount (share − commission)" v={a.netFeePct != null && num(a.shareDiscount) > 0 ? '− ' + a.shareDiscount : '—'} red={a.netFeePct != null && num(a.shareDiscount) > 0} />
                            <FeeLine k="Your commission (before GST)" v={a.yourCommission ?? a.distributorShare} bold sub={a.netFeePctOfAum != null ? `(${a.netFeePctOfAum}% ${a.netFeePctBasis === 'performance' ? 'of gains' : 'p.a.'})` : ''} />
                          </>)}
                        </View>
                      </View>
                    );
                  })}
                  {/* Web: a Total row across every column, only when the client has more than one account. */}
                  {g.accounts.length > 1 && (
                    <View style={{ borderTopWidth: 1.5, borderColor: C.green, marginTop: 10, paddingTop: 6, backgroundColor: 'rgba(2,66,43,0.03)' }}>
                      <Tx w={700} s={10} ls={0.1} c={C.muted} style={{ marginBottom: 2 }}>TOTAL</Tx>
                      <FeeLine k="Client assets" v={inr(g.aum)} />
                      <FeeLine k="Management fee (before GST)" v={inr(g.fixedFees)} />
                      <FeeLine k="Performance fee (before GST)" v={inr(g.perfFees)} />
                      <FeeLine k="Your share" v={inr(g.shareOfFee)} />
                      <FeeLine k="Discount" v={g.shareDiscount > 0 ? '− ' + inr(g.shareDiscount) : '—'} red={g.shareDiscount > 0} />
                      <FeeLine k="Your commission (before GST)" v={inr(g.commission)} bold />
                    </View>
                  )}
                </View>
              )}
            </Card>
          );
        })}
        <Tx s={11} c={C.muted} lh={1.55} style={{ marginTop: 6 }}><Tx w={700} s={11} c={C.ink}>Raising an invoice:</Tx> management fees are charged quarterly and performance fees annually. <Tx w={700} s={11} c={C.ink}>The commission shown is before GST — add 18% when you invoice.</Tx> Every figure above is exclusive of GST, and the total to invoice is stated at the top.</Tx>
      </>)}
    </Fade>
  );
}
// Button with an optional icon before the label (web: "Raise invoice" with a document icon, "CSV" with download).
const IconButton = ({ label, icon, primary, onPress, style, accessibilityLabel }) => (
  <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={accessibilityLabel || label}
    style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 11, paddingHorizontal: 8, borderRadius: 8,
      backgroundColor: primary ? C.green : 'transparent', borderWidth: primary ? 0 : 1, borderColor: 'rgba(2,66,43,0.35)', transform: [{ scale: pressed ? 0.98 : 1 }] }, style]}>
    {icon}
    <Tx w={700} s={12} ls={0.06} c={primary ? C.gold : C.green} numberOfLines={1}>{label}</Tx>
  </Pressable>
);

const FeeLine = ({ k, v, sub, bold, red }) => (
  <View style={{ flexDirection: 'row', gap: 10, paddingVertical: 4 }}>
    <Tx s={11.5} c={C.muted} style={{ flex: 1 }}>{k}</Tx>
    <View style={{ alignItems: 'flex-end' }}>
      <Tx w={bold ? 700 : 400} s={12} c={red ? C.red : C.ink}>{v}</Tx>
      {!!sub && <Tx s={10} c={C.gray} style={{ textAlign: 'right' }}>{sub}</Tx>}
    </View>
  </View>
);

// Shared: rows for one period (statement / invoice screens)
function usePeriodRows(period) {
  const r = useLoad(() => api.feeRows(period), [period.label]);
  const rows = Array.isArray(r.data) ? r.data : [];
  return { ...r, rows, sum: useMemo(() => summarise(rows), [r.data]) };
}
const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
// Statement / invoice PDF: render → give it a readable name → share sheet (save to Files / Drive, send by mail…).
// If rendering or sharing fails, fall back to the phone's print screen, which always offers "Save as PDF".
// Throws only when both fail, so the screen can say so instead of doing nothing.
// Saves an HTML page as a named PDF.
//   Android: written straight into a folder the partner picks once (Downloads, say) — remembered, so later saves
//            are silent and the app never hands over to another app. Returns { savedTo: 'Download' }.
//   iOS:     the share sheet ("Save to Files" is a pop-up over the app, so it returns by itself).
//   { share: true } opens the share sheet on either platform (to send the PDF on).
//   · One PDF job at a time (a module-wide lock): a second tap while one runs is ignored, not re-rendered.
//   · The same page is rendered once: an unchanged statement or invoice reuses the file already made.
//   · Only a failure to CREATE the PDF falls back to the system print dialog; a share-sheet problem does not.
const PDF_DIR_KEY = 'myqode.partner.pdfDir';
let pdfJob = null;
const pdfMade = new Map();   // html → file uri (this session)
const folderName = dirUri => { const tail = decodeURIComponent(String(dirUri)).split(/[:/]/).filter(Boolean).pop(); return tail || 'your folder'; };
async function makePdf(html, safe) {
  let out = pdfMade.get(html);
  if (out && Platform.OS !== 'web') {
    const info = await FileSystem.getInfoAsync(out).catch(() => null);
    if (!info || !info.exists) out = null;
  }
  if (out) return out;
  // A4 on both platforms. iOS ignores the page's own @page size and margins (it prints US Letter, edge to edge),
  // so it is given the same margins here: the statement's 22 / 24 / 18 mm, in points.
  const { uri } = await Print.printToFileAsync({
    html, width: 595, height: 842,
    ...(Platform.OS === 'ios' ? { margins: { top: 62, right: 68, bottom: 51, left: 68 } } : null),
  });
  out = uri;
  if (Platform.OS !== 'web') {
    const named = FileSystem.cacheDirectory + safe + '.pdf';
    await FileSystem.deleteAsync(named, { idempotent: true });
    await FileSystem.moveAsync({ from: uri, to: named });
    out = named;
  }
  pdfMade.set(html, out);
  return out;
}
async function saveToFolder(file, safe) {
  const SAF = FileSystem.StorageAccessFramework;
  const write = async dir => {
    const target = await SAF.createFileAsync(dir, safe, 'application/pdf');
    const b64 = await FileSystem.readAsStringAsync(file, { encoding: FileSystem.EncodingType.Base64 });
    await FileSystem.writeAsStringAsync(target, b64, { encoding: FileSystem.EncodingType.Base64 });
    return { savedTo: folderName(dir) };
  };
  const known = await storeGet(PDF_DIR_KEY);
  if (known) {
    try { return await write(known); } catch { await storeDel(PDF_DIR_KEY); }   // folder gone or access revoked: ask again
  }
  const perm = await SAF.requestDirectoryPermissionsAsync();
  if (!perm.granted) return { cancelled: true };
  await storeSet(PDF_DIR_KEY, perm.directoryUri);
  return write(perm.directoryUri);
}
async function savePdf(html, fileName, { share = false } = {}) {
  if (pdfJob) return pdfJob;
  pdfJob = (async () => {
    const safe = String(fileName || 'document').replace(/[^\w .()-]/g, '-').replace(/\s+/g, ' ').trim() || 'document';
    let out;
    try { out = await makePdf(html, safe); }
    catch (first) {
      try { await Print.printAsync({ html }); return {}; }
      catch (second) { throw new Error('We couldn’t create the PDF on this phone. ' + ((second && second.message) || (first && first.message) || '')); }
    }
    if (Platform.OS === 'android' && !share) {
      try { return await saveToFolder(out, safe); }
      catch { /* no folder access on this phone: fall through to the share sheet */ }
    }
    if (Platform.OS === 'web' || !(await Sharing.isAvailableAsync())) { await Print.printAsync({ uri: out }); return {}; }
    try { await Sharing.shareAsync(out, { mimeType: 'application/pdf', dialogTitle: safe, UTI: 'com.adobe.pdf' }); }
    catch (e) {
      if (/progress|already|another/i.test(String(e && e.message))) return {};   // a sheet still closing — not a failure
      throw new Error('The PDF is ready, but the share sheet could not open. Please try again.');
    }
    return {};
  })().finally(() => { pdfJob = null; });
  return pdfJob;
}

// ── Fee statement (web: fees-distribution/statement) ─────────────────────────
// The web statement's own figures, field for field: share = Σ distributorShare (GST-inclusive), standard fee
// = Σ (totalRackRateFee or totalFees), your share at the rate = Σ distributorGrossShare, discount = Σ discountAmount.
function statementOf(rows) {
  const byName = new Map();
  for (const r of rows) {
    const key = String(r.clientName || '').trim().toLowerCase().replace(/\s+/g, ' ');
    const g = byName.get(key) || { name: r.clientName, accounts: 0, aum: 0, fixed: 0, perf: 0, fees: 0, share: 0, rack: 0, discount: 0, grossShare: 0 };
    g.accounts += 1; g.aum += num(r.averageAum); g.fixed += num(r.fixedFees); g.perf += num(r.performanceFees); g.fees += num(r.totalFees);
    g.share += num(r.distributorShare); g.rack += num(r.totalRackRateFee) || num(r.totalFees); g.discount += num(r.discountAmount); g.grossShare += num(r.distributorGrossShare);
    byName.set(key, g);
  }
  const clients = [...byName.values()].sort((a, b) => b.share - a.share);
  const sum = k => clients.reduce((n, c) => n + c[k], 0);
  const share = sum('share'), rack = sum('rack'), discount = sum('discount');
  const shareGst = (share * GST_RATE) / (100 + GST_RATE);
  const first = rows[0];
  return {
    clients,
    totals: {
      aum: sum('aum'), fixed: sum('fixed'), perf: sum('perf'), fees: sum('fees'), rack, discount, grossShare: sum('grossShare'),
      discountPctOfRack: rack > 0 ? (discount / rack) * 100 : 0, share, shareGst, shareNet: share - shareGst,
      ratePct: first ? (first.distributorShareCategory ?? `${first.distributorPercentage}%`) : '—',
      unmapped: rows.some(r => r.rateSource === 'unmapped'), isLegacyRate: rows.some(r => r.rateSource === 'legacy'),
    },
  };
}

export function Statement({ period, distributorName, onBack, onInvoice }) {
  const { loading, err, rows, reload } = usePeriodRows(period);
  const [busy, setBusy] = useState(false);
  const { clients, totals: t } = useMemo(() => statementOf(rows), [rows]);
  const [pdfErr, setPdfErr] = useState('');
  const [pdfSaved, setPdfSaved] = useState('');   // Android: the folder the PDF was saved to
  const initials = String(distributorName || '').replace(/[^a-zA-Z ]/g, '').split(/\s+/).filter(Boolean).slice(0, 3).map(w => w[0].toUpperCase()).join('');
  const ref = `QFS-${String(period.label).replace(/\s+/g, '')}-${initials || 'DST'}`;
  const issued = formatDate(new Date().toISOString());
  const disc = t.discount > 0;
  const calc = [
    ['Standard fees for your clients', null, t.rack],
    [`Your share at ${t.ratePct}`, null, t.grossShare],
    ...(disc ? [['Less: the discount you agreed with your clients', `${t.discountPctOfRack.toFixed(1)}% of the standard fee — funded from your share`, -t.discount]] : []),
    ['Your share for the period', null, t.shareNet, 'sub'],
    [`Add: GST at ${GST_RATE}%`, null, t.shareGst],
    ['Payable to you', null, t.share, 'total'],
  ];
  const money2 = v => (v < 0 ? `− ₹ ${inr(-v)}` : `₹ ${inr(v)}`);
  // The web statement's printed layout (distributor/fees-distribution/statement, printed to PDF): text letterhead,
  // Playfair heading + Lato body, wide margins, light dividers; the client table's header repeats on every page and
  // rows never split. Two web print faults are not copied: its last column is cut off at the page edge, and wide
  // figures run into each other — here every column fits and numbers keep a gap.
  // Fonts: the phone's own (no web fonts — the PDF renderer waits for a download before drawing any page).
  const html = () => `<html><head><meta charset="utf-8">
  <style>
    @page { size: A4; margin: 22mm 24mm 18mm; }
    * { box-sizing: border-box; }
    body { font-family: Lato, 'Helvetica Neue', Roboto, Arial, sans-serif; color: #002017; font-size: 11px; margin: 0; line-height: 1.5; }
    .serif { font-family: 'Playfair Display', Georgia, 'Times New Roman', serif; }
    .lbl { font-size: 8.5px; font-weight: 700; letter-spacing: .14em; text-transform: uppercase; color: #37584F; }
    .muted { color: #37584F; }
    .rule { border-top: 1px solid #d6d3c4; }
    table { width: 100%; border-collapse: collapse; }
    thead { display: table-header-group; }
    tr { page-break-inside: avoid; break-inside: avoid; }
    .num { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
    .calc td { padding: 8px 0; border-bottom: 1px solid #e8e5d8; font-size: 10.5px; }
    .calc .sub td { font-weight: 700; }
    .calc .grand td { font-weight: 700; font-size: 11px; border-top: 3px solid #d6d3c4; border-bottom: 0; padding-top: 12px; }
    .calc .grand td.num { font-size: 13px; }
    .calc .neg { color: #b42318; }
    .calc .why { display: block; font-size: 9px; color: #37584F; font-weight: 400; }
    .bk th { font-size: 8px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: #37584F; text-align: right; padding: 0 0 8px 10px; border-bottom: 1px solid #d6d3c4; vertical-align: bottom; white-space: nowrap; }
    .bk th .s { display: block; font-weight: 400; letter-spacing: 0; text-transform: none; font-size: 7.5px; }
    .bk td { padding: 9px 0 9px 10px; border-bottom: 1px solid #e8e5d8; font-size: 10.5px; vertical-align: middle; }
    .bk th:first-child, .bk td:first-child { text-align: left; padding-left: 0; }
    .bk td:first-child { font-size: 11px; }
    .bk .acc { display: block; font-size: 9px; color: #37584F; margin-top: 1px; }
    .bk .tot td { font-weight: 700; font-size: 11px; border-top: 3px solid #d6d3c4; border-bottom: 0; padding-top: 12px; }
    .box { border: 1px solid #e6dcc0; border-radius: 8px; padding: 10px 14px; margin-top: 12px; }
    .note { margin: 0 0 10px; font-size: 9.5px; color: #37584F; }
    .note b { color: #002017; }
  </style></head><body>
    <table><tr>
      <td style="vertical-align:top"><div class="serif" style="font-size:18px">Qode Advisors LLP</div>
        <div class="muted" style="font-size:9.5px;margin-top:4px;line-height:1.65">SEBI Registered Portfolio Manager · INP000008914<br>Mumbai, India<br>investor.relations@qodeinvest.com</div></td>
      <td style="vertical-align:top;text-align:right"><div class="lbl">Distributor Fee Statement</div>
        <div class="muted" style="font-size:9.5px;margin-top:6px;line-height:1.6">Ref ${esc(ref)}<br>Issued ${esc(issued)}</div></td>
    </tr></table>
    <table class="rule" style="margin-top:18px"><tr>
      <td style="padding:16px 0;vertical-align:top"><div class="lbl">Statement for</div><div style="font-size:12px;font-weight:700;margin-top:6px">${esc(distributorName || '—')}</div></td>
      <td style="padding:16px 0;vertical-align:top;text-align:right"><div class="lbl">Period</div><div style="font-size:12px;margin-top:6px">${esc(period.label)}<span class="muted"> · ${esc(period.startDate)} – ${esc(period.endDate)}</span></div></td>
    </tr></table>
    <div class="rule" style="padding:16px 0 18px">
      <div class="lbl">Total payable to you — inclusive of GST</div>
      <div style="font-size:26px;font-weight:700;margin-top:8px;letter-spacing:-.01em">₹ ${inr(t.share)}</div>
      <div class="muted" style="font-style:italic;font-size:10px;margin-top:4px">${esc(amountInWords(t.share))}</div>
      <div class="box"><div style="font-weight:700;font-size:10.5px">This amount already includes GST. Do not add GST on top.</div>
        <div class="muted" style="font-size:10px;margin-top:4px">Invoice Qode Advisors LLP for <b style="color:#002017">₹ ${inr(t.share)}</b> in total — shown on your invoice as <b style="color:#002017">₹ ${inr(t.shareNet)}</b> plus GST of <b style="color:#002017">₹ ${inr(t.shareGst)}</b>.</div></div>
      <table class="calc" style="margin-top:12px">${calc.map(([k, sub, v, kind]) => `<tr class="${kind === 'total' ? 'grand' : kind === 'sub' ? 'sub' : ''}"><td>${esc(k)}${sub ? `<span class="why">${esc(sub)}</span>` : ''}</td><td class="num${v < 0 ? ' neg' : ''}">${money2(v)}</td></tr>`).join('')}</table>
    </div>
    <div class="rule" style="padding-top:18px">
      <div class="lbl" style="margin-bottom:12px">Breakdown by client</div>
      <table class="bk">
        <thead><tr><th>Client</th><th>Avg AUM</th><th>Fixed Fees</th><th>Perf. Fees</th>${disc ? '<th>Standard Fee</th>' : ''}<th>${disc ? 'Fee Charged' : 'Total Fees'}</th>${disc ? '<th>Your Discount</th>' : ''}<th>You Receive (incl. GST)<span class="s">${esc(t.ratePct)} of standard fee${disc ? ', less your discount' : ''}</span></th></tr></thead>
        <tbody>
        ${clients.map(c => `<tr><td>${esc(c.name)}${c.accounts > 1 ? `<span class="acc">${c.accounts} accounts</span>` : ''}</td><td class="num">${inr(c.aum)}</td><td class="num">${inr(c.fixed)}</td><td class="num">${inr(c.perf)}</td>${disc ? `<td class="num">${inr(c.rack)}</td>` : ''}<td class="num">${inr(c.fees)}</td>${disc ? `<td class="num">${c.discount > 0 ? '− ' + inr(c.discount) : '—'}</td>` : ''}<td class="num"><b>${inr(c.share)}</b></td></tr>`).join('')}
        <tr class="tot"><td>Total</td><td class="num">${inr(t.aum)}</td><td class="num">${inr(t.fixed)}</td><td class="num">${inr(t.perf)}</td>${disc ? `<td class="num">${inr(t.rack)}</td>` : ''}<td class="num">${inr(t.fees)}</td>${disc ? `<td class="num">− ${inr(t.discount)}</td>` : ''}<td class="num">${inr(t.share)}</td></tr>
        </tbody>
      </table>
    </div>
    ${t.unmapped ? '<div class="box" style="margin-top:18px;font-size:10px"><b>Some clients are not included.</b> <span class="muted">One or more clients have no fee share configured, so no amount is shown against them. Contact investor.relations@qodeinvest.com before invoicing.</span></div>' : ''}
    ${t.isLegacyRate ? '<div class="box" style="margin-top:10px;font-size:10px"><b>Provisional rate.</b> <span class="muted">This statement uses a share rate held in our portal records rather than a confirmed CRM rate. Please confirm before invoicing.</span></div>' : ''}
    <div class="rule" style="margin-top:36px;padding-top:18px">
    <p class="note"><b>This is not a tax invoice.</b> It is a statement of fees earned, issued for your records. Please raise your own invoice on Qode Advisors LLP for the total shown above.</p>
    <p class="note"><b>The total payable to you is inclusive of GST at 18%.</b> Your revenue share of ${esc(t.ratePct)} is calculated on the fees billed to your clients, and GST at 18% is added to your share. Do not add GST on top of the total — the amount payable to you is ₹ ${inr(t.share)} in full. On your invoice this is ₹ ${inr(t.shareNet)} plus GST of ₹ ${inr(t.shareGst)}. Client fee amounts in the table are shown before GST, with GST in its own column.</p>
    <p class="note">Fixed fees are billed quarterly and performance fees annually. Fee amounts are as recorded in our systems for the stated period. If any figure appears incorrect, contact investor.relations@qodeinvest.com before invoicing.</p>
    </div></body></html>`;
  return (
    <Fade>
      <BackRow label="Back to fees" onPress={onBack} />
      {loading && <Tx s={12} c={C.muted}>Preparing your statement…</Tx>}
      {!!err && <ErrorBox msg={`We couldn’t prepare the statement. ${err}. Please go back and try again, or contact investor.relations@qodeinvest.com.`} onRetry={reload} />}
      {!loading && !err && (<>
        <Tx s={11.5} c={C.muted} lh={1.5} style={{ marginBottom: 10 }}>Save it as a PDF for your records. This statement is not a tax invoice — use <Tx w={700} s={11.5} c={C.ink}>Raise invoice</Tx> to generate one.</Tx>
        <Card style={{ padding: 0, overflow: 'hidden' }}>
          {/* Letterhead: the Qode band (as on the Qode signature), then the web's text letterhead */}
          <View style={{ backgroundColor: C.green, paddingVertical: 14, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <Tx f="play" w={700} s={26} c={C.cream}>Qode<Tx s={9} c={C.cream}>™</Tx></Tx>
            <Tx s={10} c={C.cream60} style={{ textAlign: 'right', marginTop: 4 }}>SEBI PMS Reg. No.{'\n'}INP000008914</Tx>
          </View>
          <View style={{ padding: 18 }}>
          <View style={{ paddingBottom: 12, borderBottomWidth: 1, borderColor: C.hairline }}>
            <Tx f="play" w={600} s={16}>Qode Advisors LLP</Tx>
            <Tx s={11} c={C.muted} lh={1.5} style={{ marginTop: 2 }}>SEBI Registered Portfolio Manager · INP000008914{'\n'}Mumbai, India{'\n'}investor.relations@qodeinvest.com</Tx>
          </View>
          <Tx w={700} s={10.5} ls={0.12} c={C.muted} style={{ marginTop: 12 }}>DISTRIBUTOR FEE STATEMENT</Tx>
          <Tx s={11} c={C.gray} style={{ marginTop: 2 }}>Ref {ref} · Issued {issued}</Tx>
          <View style={{ flexDirection: 'row', gap: 12, marginTop: 12, paddingBottom: 12, borderBottomWidth: 1, borderColor: C.hairline }}>
            <View style={{ flex: 1 }}>
              <Tx w={700} s={9.5} ls={0.12} c={C.muted}>STATEMENT FOR</Tx>
              <Tx w={700} s={12.5} style={{ marginTop: 3 }}>{distributorName || '—'}</Tx>
            </View>
            <View style={{ flex: 1, alignItems: 'flex-end' }}>
              <Tx w={700} s={9.5} ls={0.12} c={C.muted}>PERIOD</Tx>
              <Tx s={12.5} style={{ marginTop: 3, textAlign: 'right' }}>{period.label}</Tx>
              <Tx s={11} c={C.muted} style={{ textAlign: 'right' }}>{period.startDate} – {period.endDate}</Tx>
            </View>
          </View>
          <Tx s={11} c={C.muted} style={{ marginTop: 14 }}>Total payable to you — inclusive of GST</Tx>
          <Amt w={700} s={26}>₹ {inr(t.share)}</Amt>
          <Tx s={11} c={C.muted} style={{ fontStyle: 'italic', marginTop: 2 }}>{amountInWords(t.share)}</Tx>
          <View style={{ marginTop: 12, padding: 10, borderRadius: 8, backgroundColor: '#FFF6DC', borderWidth: 1, borderColor: C.gold }}>
            <Tx s={11.5} lh={1.5}>This amount already includes GST. Do not add GST on top. Invoice Qode Advisors LLP for <Tx w={700} s={11.5}>₹ {inr(t.share)}</Tx> in total — shown on your invoice as <Tx w={700} s={11.5}>₹ {inr(t.shareNet)}</Tx> plus GST of <Tx w={700} s={11.5}>₹ {inr(t.shareGst)}</Tx>.</Tx>
          </View>
          </View>
        </Card>
        {/* Actions first, so they're visible without scrolling past the breakdown */}
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
          <IconButton label={busy ? 'PREPARING…' : 'SAVE AS PDF'} icon={<Download s={15} c={C.gold} />} primary style={{ flex: 1 }}
            onPress={async () => { if (busy) return; setBusy(true); setPdfErr(''); setPdfSaved(''); try { const r = await savePdf(html(), 'Fee statement ' + ref); if (r && r.savedTo) setPdfSaved(r.savedTo); } catch (e) { setPdfErr(e.message); } setBusy(false); }} />
          <CTA label="RAISE INVOICE" outline onPress={() => onInvoice(period)} style={{ flex: 1, paddingVertical: 11 }} />
        </View>
        {!!pdfErr && <Tx s={12} c={C.red} lh={1.45} style={{ marginTop: 8 }}>{pdfErr}</Tx>}
        {!!pdfSaved && (
          <Tx s={12} c={C.green} lh={1.45} style={{ marginTop: 8 }}>Saved to {pdfSaved}.{'  '}
            <Tx w={700} s={12} c={C.green} style={{ textDecorationLine: 'underline' }} onPress={() => savePdf(html(), 'Fee statement ' + ref, { share: true }).catch(e => setPdfErr(e.message))}>Share</Tx>
          </Tx>
        )}

        <SectionLabel>CALCULATION</SectionLabel>
        <Card style={{ paddingHorizontal: 16, paddingVertical: 4 }}>
          {calc.map(([k, sub, v, kind], i) => (
            <View key={k} style={{ flexDirection: 'row', gap: 10, paddingVertical: 10, borderBottomWidth: i < calc.length - 1 ? 1 : 0, borderColor: C.hairline, ...(kind === 'total' ? { borderTopWidth: 1.5, borderTopColor: C.green } : null) }}>
              <View style={{ flex: 1 }}>
                <Tx w={kind ? 700 : 400} s={12.5}>{k}</Tx>
                {!!sub && <Tx s={10.5} c={C.muted}>{sub}</Tx>}
              </View>
              <Tx w={kind ? 700 : 400} s={12.5} c={v < 0 ? C.red : C.ink}>{money2(v)}</Tx>
            </View>
          ))}
        </Card>

        <SectionLabel>BREAKDOWN BY CLIENT</SectionLabel>
        {clients.map(c => (
          <Card key={c.name} style={{ padding: 14, marginBottom: 8 }}>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Tx w={700} s={12.5}>{c.name}</Tx>
                {c.accounts > 1 && <Tx s={10.5} c={C.muted} style={{ marginTop: 1 }}>{c.accounts} accounts</Tx>}
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Tx w={700} s={12.5}>₹ {inr(c.share)}</Tx>
                <Tx s={9.5} c={C.muted}>you receive (incl. GST)</Tx>
              </View>
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 }}>
              {[['Avg AUM', c.aum], ['Fixed fees', c.fixed], ['Perf. fees', c.perf], ...(disc ? [['Standard fee', c.rack]] : []), [disc ? 'Fee charged' : 'Total fees', c.fees], ...(disc ? [['Your discount', -c.discount]] : [])].map(([k, v]) => (
                <View key={k} style={{ width: '50%', paddingVertical: 3 }}>
                  <Tx s={10} c={C.muted}>{k}</Tx>
                  <Tx s={11.5} c={v < 0 ? C.red : C.ink}>{v < 0 ? '− ' + inr(-v) : v === 0 && k === 'Your discount' ? '—' : inr(v)}</Tx>
                </View>
              ))}
            </View>
          </Card>
        ))}
        {/* Total row of the web table, one labelled figure per line (the web's row runs its numbers together on a phone) */}
        <Card style={{ padding: 14, borderWidth: 1.5, borderColor: C.green }}>
          <View style={{ flexDirection: 'row' }}>
            <Tx w={700} s={13} style={{ flex: 1 }}>Total</Tx>
            <View style={{ alignItems: 'flex-end' }}>
              <Tx w={700} s={13}>₹ {inr(t.share)}</Tx>
              <Tx s={9.5} c={C.muted}>you receive (incl. GST) · {t.ratePct} of standard fee{disc ? ', less your discount' : ''}</Tx>
            </View>
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 8, borderTopWidth: 1, borderColor: C.hairline, paddingTop: 6 }}>
            {[['Avg AUM', t.aum], ['Fixed fees', t.fixed], ['Perf. fees', t.perf], ...(disc ? [['Standard fee', t.rack]] : []), [disc ? 'Fee charged' : 'Total fees', t.fees], ...(disc ? [['Your discount', -t.discount]] : [])].map(([k, v]) => (
              <View key={k} style={{ width: '50%', paddingVertical: 3 }}>
                <Tx s={10} c={C.muted}>{k}</Tx>
                <Tx w={700} s={11.5} c={v < 0 ? C.red : C.ink}>{v < 0 ? '− ' + inr(-v) : inr(v)}</Tx>
              </View>
            ))}
          </View>
        </Card>
        {t.unmapped && <View style={{ marginTop: 12 }}><Msg text="Some clients are not included. One or more clients have no fee share configured, so no amount is shown against them. Contact investor.relations@qodeinvest.com before invoicing." /></View>}
        {t.isLegacyRate && <View style={{ marginTop: 12 }}><Msg text="Provisional rate. This statement uses a share rate held in our portal records rather than a confirmed CRM rate. Please confirm before invoicing." /></View>}


        {/* The web statement's closing notes, verbatim */}
        <Card style={{ padding: 16, marginTop: 14 }}>
          <Tx s={11.5} c={C.muted} lh={1.6}><Tx w={700} s={11.5} c={C.ink}>This is not a tax invoice.</Tx> It is a statement of fees earned, issued for your records. Please raise your own invoice on Qode Advisors LLP for the total shown above.</Tx>
          <Tx s={11.5} c={C.muted} lh={1.6} style={{ marginTop: 10 }}><Tx w={700} s={11.5} c={C.ink}>The total payable to you is inclusive of GST at 18%.</Tx> Your revenue share of {t.ratePct} is calculated on the fees billed to your clients, and GST at 18% is added to your share. Do not add GST on top of the total — the amount payable to you is ₹ {inr(t.share)} in full. On your invoice this is ₹ {inr(t.shareNet)} plus GST of ₹ {inr(t.shareGst)}. Client fee amounts in the table are shown before GST, with GST in its own column.</Tx>
          <Tx s={11.5} c={C.muted} lh={1.6} style={{ marginTop: 10 }}>Fixed fees are billed quarterly and performance fees annually. Fee amounts are as recorded in our systems for the stated period. If any figure appears incorrect, contact investor.relations@qodeinvest.com before invoicing.</Tx>
        </Card>
      </>)}
    </Fade>
  );
}

// ── Raise invoice (web: fees-distribution/invoice) ───────────────────────────
const EMPTY_PROFILE = { legalName: '', gstin: '', pan: '', addressLine1: '', addressLine2: '', city: '', state: '', stateCode: '', pincode: '', bankAccountName: '', bankAccountNumber: '', bankIfsc: '', bankName: '', invoicePrefix: '', lastInvoiceNumber: 0, notes: '' };
const todayIst = () => new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10);

function validateProfile(p, invoiceNumber, invoiceDate) {
  const e = {};
  if (!p.legalName.trim()) e.legalName = 'Enter the name your invoices are raised in';
  if (!p.addressLine1.trim()) e.addressLine1 = 'Enter your registered address';
  if (p.gstin.trim()) {
    const g = validateGstin(p.gstin); if (!g.valid) e.gstin = g.reason;
    else if (p.stateCode && p.gstin.slice(0, 2) !== String(p.stateCode).padStart(2, '0')) e.stateCode = `Your GSTIN is registered in ${GST_STATE_CODES[p.gstin.slice(0, 2)] || 'another state'} — choose that state`;
  }
  const pn = validatePan(p.pan); if (!pn.valid) e.pan = pn.reason;
  else if (p.pan.trim() && p.gstin.trim().length === 15 && p.pan.trim().toUpperCase() !== p.gstin.trim().toUpperCase().slice(2, 12)) e.pan = `This doesn't match the PAN inside your GSTIN (${p.gstin.trim().toUpperCase().slice(2, 12)})`;
  if (!String(invoiceNumber).trim()) e.invoiceNumber = 'Enter an invoice number';
  if (!invoiceDate) e.invoiceDate = 'Enter the invoice date';
  return e;
}

export function Invoice({ period, distributorName, onBack }) {
  const { loading, err, rows, sum } = usePeriodRows(period);
  const prof = useLoad(() => api.invoiceProfile(), []);
  const [p, setP] = useState(null);
  const [num0, setNum] = useState(null);           // null until the partner edits the number
  const [date, setDate] = useState(todayIst());
  const [errs, setErrs] = useState({});
  const [state, setState] = useState({ saving: false, saved: false, issuing: false, msg: '', err: '' });
  const [pickState, setPickState] = useState(false);
  // Web: the partner's saved invoice details pre-fill the form (Save details stores them for next time).
  useEffect(() => { if (prof.data || prof.err) setP({ ...EMPTY_PROFILE, ...((prof.data && prof.data.profile) || {}) }); }, [prof.data, prof.err]);
  if (loading || !p) return <View><BackRow label="Back to fees" onPress={onBack} /><Loading rows={3} h={80} /></View>;
  if (err) return <View><BackRow label="Back to fees" onPress={onBack} /><ErrorBox msg={`We couldn’t load your invoice. ${err}`} /></View>;

  const taxable = rows.reduce((n, r) => n + num(r.yourCommission), 0);
  const tax = computeTax(taxable, p.stateCode, QODE_ENTITY.stateCode, Boolean(p.gstin.trim()));
  const discount = rows.reduce((n, r) => n + num(r.shareDiscount), 0);
  const clientCount = new Set(rows.map(r => String(r.clientName || '').trim().toLowerCase())).size;
  const ratePct = sum.totals.sharePct || '—';
  const last = Number(p.lastInvoiceNumber || 0);
  const invoiceNumber = num0 != null ? num0 : (p.invoicePrefix ? p.invoicePrefix + String(last + 1).padStart(3, '0') : String(last + 1));
  const set = (k, v) => { setP(o => ({ ...o, [k]: v })); if (errs[k]) setErrs(e => ({ ...e, [k]: '' })); setState(s => ({ ...s, saved: false })); };
  const qodeOk = isQodeEntityComplete();
  const ready = qodeOk && p.legalName.trim() && p.addressLine1.trim() && String(invoiceNumber).trim() && taxable * 1.18 > 0;

  const save = async () => {
    const e = validateProfile(p, invoiceNumber, date);
    const profileErrs = Object.fromEntries(Object.entries(e).filter(([k]) => k !== 'invoiceNumber' && k !== 'invoiceDate'));
    if (Object.keys(profileErrs).length) { setErrs(e); return false; }
    setState(s => ({ ...s, saving: true, err: '' }));
    try { await api.saveInvoiceProfile({ ...p, gstin: p.gstin.trim().toUpperCase(), pan: p.pan.trim().toUpperCase(), bankIfsc: p.bankIfsc.trim().toUpperCase() }); setState(s => ({ ...s, saving: false, saved: true })); return true; }
    catch (x) { setErrs(o => ({ ...o, ...((x.data && x.data.errors) || {}) })); setState(s => ({ ...s, saving: false, err: x.message })); return false; }
  };
  const html = () => {
    const lines = [p.addressLine1, p.addressLine2, [p.city, p.state, p.pincode].filter(Boolean).join(', ')].filter(Boolean);
    // Line for line the web's invoice sheet: optional lines only when filled, tax labels from the computed rates.
    const lbl = 'font-size:10px;font-weight:bold;letter-spacing:.12em;text-transform:uppercase;color:#37584F';
    const row = (k, v) => `<tr><td class="r muted s">${k}</td><td class="r">${v}</td></tr>`;
    const pay = [p.bankAccountName, p.bankName, p.bankAccountNumber && 'A/c ' + p.bankAccountNumber, p.bankIfsc && 'IFSC ' + p.bankIfsc].filter(Boolean);
    return `<html><head><meta charset="utf-8"><style>@page{size:A4;margin:22mm 24mm 18mm}body{font-family:Arial,sans-serif;color:#002017;margin:0;font-size:12px}table{width:100%;border-collapse:collapse}td,th{padding:7px 0;vertical-align:top}.r{text-align:right;white-space:nowrap}.muted{color:#37584F}.s{font-size:11px}.sec{padding:14px 0;border-bottom:1px solid #d9d6c3}</style></head><body>
      <table class="sec" style="border-bottom:1px solid #d9d6c3"><tr><td style="padding-bottom:14px"><div style="${lbl}">Tax Invoice</div>
        <div style="font-family:Georgia,serif;font-size:20px;margin-top:4px">${esc(p.legalName || distributorName || 'Your registered name')}</div>
        <div class="muted s" style="margin-top:6px;line-height:1.5">${lines.map(esc).join('<br>')}${p.gstin ? '<br>GSTIN: ' + esc(p.gstin) : ''}${p.pan ? '<br>PAN: ' + esc(p.pan) : ''}</div></td>
      <td class="r s" style="padding-bottom:14px;line-height:1.7"><span class="muted">Invoice no.</span> <b>${esc(invoiceNumber || '—')}</b><br><span class="muted">Date</span> <b>${esc(displayDate(date))}</b><br><span class="muted">Period</span> <b>${esc(period.label)}</b></td></tr></table>
      <div class="sec"><div style="${lbl};margin-bottom:6px">Bill to</div><b>${esc(QODE_ENTITY.name)}</b>
        <div class="muted s" style="margin-top:4px;line-height:1.5">${qodeAddressLines().map(esc).join('<br>')}${QODE_ENTITY.gstin ? '<br>GSTIN: ' + esc(QODE_ENTITY.gstin) : ''}<br>SEBI Registered Portfolio Manager · ${esc(QODE_ENTITY.sebiRegistration)}</div></div>
      <div style="padding:14px 0"><table><tr style="border-bottom:1px solid #d9d6c3"><th style="text-align:left;${lbl}">Description</th><th class="r" style="${lbl}">Amount</th></tr>
      <tr style="border-bottom:1px solid #eee"><td style="padding-right:12px">Distribution fees — ${esc(period.label)}<div class="muted s" style="margin-top:3px">${esc(ratePct)} share of fees on ${clientCount} ${clientCount === 1 ? 'client' : 'clients'}${discount > 0 ? `, net of ₹ ${inr(discount)} in discounts given to clients` : ''}. ${esc(period.startDate)} to ${esc(period.endDate)}.</div></td><td class="r">₹ ${inr(tax.taxableValue)}</td></tr>
      ${row('Taxable value', `₹ ${inr(tax.taxableValue)}`)}
      ${tax.treatment === 'intra_state' ? row(`CGST @ ${tax.cgstRate}%`, `₹ ${inr(tax.cgst)}`) + row(`SGST @ ${tax.sgstRate}%`, `₹ ${inr(tax.sgst)}`) : ''}
      ${tax.treatment === 'inter_state' ? row(`IGST @ ${tax.igstRate}%`, `₹ ${inr(tax.igst)}`) : ''}
      ${tax.treatment === 'unregistered' ? '<tr><td class="r muted s" colspan="2">No GST charged — not registered under GST</td></tr>' : ''}
      <tr style="border-top:2px solid #b9b6a3"><td class="r"><b>Total</b></td><td class="r" style="font-size:14px"><b>₹ ${inr(tax.total)}</b></td></tr></table>
      <div class="muted s" style="margin-top:8px;font-style:italic">${esc(amountInWords(tax.total))}</div></div>
      ${p.bankAccountNumber || p.bankIfsc ? `<div class="sec" style="border-top:1px solid #d9d6c3;border-bottom:0"><div style="${lbl};margin-bottom:6px">Payment details</div><div class="muted s" style="line-height:1.5">${pay.map(esc).join('<br>')}</div></div>` : ''}
      ${p.notes ? `<div class="sec muted s" style="border-top:1px solid #d9d6c3;border-bottom:0">${esc(p.notes).replace(/\n/g, '<br>')}</div>` : ''}
      <div class="muted" style="font-size:10.5px;border-top:1px solid #d9d6c3;padding-top:12px;line-height:1.5">Amounts are for distribution fees earned on client portfolios managed by ${esc(QODE_ENTITY.name)} for the period stated. This invoice is raised by the distributor named above.</div></body></html>`;
  };
  const generate = async () => {
    const e = validateProfile(p, invoiceNumber, date);
    if (Object.keys(e).length) { setErrs(e); return; }
    setState(s => ({ ...s, issuing: true, err: '' }));
    if (!(await save())) { setState(s => ({ ...s, issuing: false })); return; }
    try {
      await api.issueInvoice({ invoiceNumber: String(invoiceNumber).trim(), invoiceDate: date, periodLabel: period.label, periodStart: period.startDate, periodEnd: period.endDate, amountBeforeTax: tax.taxableValue, taxAmount: tax.totalTax, totalAmount: tax.total });
      const n = String(invoiceNumber).match(/(\d+)\s*$/);
      if (n) setP(o => ({ ...o, lastInvoiceNumber: Math.max(Number(o.lastInvoiceNumber || 0), Number(n[1])) }));
      setNum(null);
      // The number is recorded; a PDF problem is reported on its own so it isn't mistaken for a failed invoice.
      try { const r = await savePdf(html(), 'Invoice ' + invoiceNumber); setState(s => ({ ...s, issuing: false, msg: `Invoice ${invoiceNumber} recorded.` + (r && r.savedTo ? ` PDF saved to ${r.savedTo}.` : '') })); }
      catch (pe) { setState(s => ({ ...s, issuing: false, msg: `Invoice ${invoiceNumber} recorded.`, err: pe.message })); }
    } catch (x) { setState(s => ({ ...s, issuing: false, err: x.status === 409 ? x.message : 'Could not record the invoice' })); }
  };
  const F = (k, label, props = {}) => <Field label={label} value={String(p[k] || '')} onChangeText={t => set(k, props.upper ? t.toUpperCase() : t)} error={errs[k]} style={{ marginTop: 14 }} {...props} />;
  return (
    <Fade>
      <BackRow label="Back to fees" onPress={onBack} />
      {!qodeOk && <Msg tone="red" text="Invoicing isn't available yet. Qode's GST details haven't been configured in the portal, and an invoice without them wouldn't be valid. Please contact investor.relations@qodeinvest.com." />}
      <SectionLabel>YOUR INVOICE DETAILS</SectionLabel>
      <Tx s={11.5} c={C.muted} lh={1.5} style={{ marginTop: -4, marginLeft: 2 }}>These appear on the invoice as the party raising it. We save them, so you only need to enter them once — the amounts come from your fees for the period and can't be edited.</Tx>
      <Card style={{ padding: 16, marginTop: 10 }}>
        {F('legalName', 'REGISTERED NAME *', { placeholder: 'As registered — e.g. Acme Capital Services LLP' })}
        {F('gstin', 'GSTIN', { placeholder: '27AABCU9603R1ZX', maxLength: 15, upper: true, autoCapitalize: 'characters', hint: "Leave blank if you aren't GST-registered — the invoice will show no GST." })}
        {F('pan', 'PAN', { placeholder: 'AABCU9603R', maxLength: 10, upper: true, autoCapitalize: 'characters' })}
        {F('addressLine1', 'REGISTERED ADDRESS *', { placeholder: 'Building, street' })}
        {F('addressLine2', 'ADDRESS LINE 2', { placeholder: 'Area, landmark' })}
        {F('city', 'CITY', { placeholder: 'Mumbai' })}
        <Pressable onPress={() => setPickState(true)} style={{ marginTop: 14 }}>
          <Tx w={700} s={10} ls={0.12} c={C.gray}>STATE</Tx>
          <View style={{ borderBottomWidth: errs.stateCode ? 1.5 : 1, borderColor: errs.stateCode ? C.red : C.mutedBorder, paddingVertical: 8, flexDirection: 'row' }}>
            <Tx s={15} c={p.stateCode ? C.ink : C.gray} style={{ flex: 1 }}>{p.stateCode ? p.state : 'Select your state'}</Tx>
            <ChevronDown s={10} c={C.muted} />
          </View>
          {!!errs.stateCode && <Tx s={11} c={C.red} style={{ marginTop: 5 }}>{errs.stateCode}</Tx>}
          {!errs.stateCode && !!p.stateCode && !!p.gstin.trim() && <Tx s={10.5} c={C.gray} style={{ marginTop: 5 }}>{String(p.stateCode).padStart(2, '0') === QODE_ENTITY.stateCode ? 'Same state as Qode — your invoice will show CGST and SGST.' : 'Different state from Qode — your invoice will show IGST.'}</Tx>}
        </Pressable>
        {F('pincode', 'PIN CODE', { placeholder: '400001', maxLength: 6, keyboardType: 'number-pad' })}
        <Field label="INVOICE NUMBER *" value={String(invoiceNumber)} onChangeText={setNum} error={errs.invoiceNumber} hint={last ? `Your last invoice here was number ${last}.` : 'Use your own series — we’ll suggest the next one after this.'} style={{ marginTop: 14 }} />
        {/* Web: a date input — here the platform's own date picker */}
        <View style={{ marginTop: 14 }}>
          <DateField label="INVOICE DATE *" value={new Date(`${date}T00:00:00`)}
            onChange={d => { setDate(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`); if (errs.invoiceDate) setErrs(e => ({ ...e, invoiceDate: '' })); }} />
          {!!errs.invoiceDate && <Tx s={11} c={C.red} style={{ marginTop: 5 }}>{errs.invoiceDate}</Tx>}
        </View>
        {F('invoicePrefix', 'INVOICE PREFIX', { placeholder: 'e.g. ACS/25-26/', hint: 'Optional — used to suggest your next invoice number.' })}
        <Tx w={700} s={11} ls={0.1} c={C.muted} style={{ marginTop: 20 }}>BANK DETAILS FOR PAYMENT</Tx>
        {F('bankAccountName', 'ACCOUNT NAME')}
        {F('bankAccountNumber', 'ACCOUNT NUMBER', { keyboardType: 'number-pad' })}
        {F('bankIfsc', 'IFSC', { maxLength: 11, upper: true, autoCapitalize: 'characters' })}
        {F('bankName', 'BANK NAME')}
      </Card>

      {/* The invoice itself — the web's invoice sheet, updating live as the details above are filled in */}
      <SectionLabel>YOUR INVOICE</SectionLabel>
      <Card style={{ padding: 18 }}>
        <View style={{ paddingBottom: 14, borderBottomWidth: 1, borderColor: C.hairline }}>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Tx w={700} s={10} ls={0.14} c={C.muted}>TAX INVOICE</Tx>
              <Tx f="play" w={600} s={17} style={{ marginTop: 3 }}>{p.legalName || distributorName || 'Your registered name'}</Tx>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              {[['Invoice no.', invoiceNumber || '—'], ['Date', displayDate(date)], ['Period', period.label]].map(([k, v]) => (
                <Tx key={k} s={11} c={C.muted} style={{ marginTop: 2 }}>{k} <Tx w={700} s={11} c={C.ink}>{v}</Tx></Tx>
              ))}
            </View>
          </View>
          {(() => {
            const addr = [p.addressLine1, p.addressLine2, [p.city, p.state, p.pincode].filter(Boolean).join(', ')].filter(Boolean);
            return (addr.length > 0 || !!p.gstin || !!p.pan) && (
              <Tx s={11} c={C.muted} lh={1.5} style={{ marginTop: 6 }}>{[...addr, p.gstin && 'GSTIN: ' + p.gstin, p.pan && 'PAN: ' + p.pan].filter(Boolean).join('\n')}</Tx>
            );
          })()}
        </View>
        <View style={{ paddingVertical: 14, borderBottomWidth: 1, borderColor: C.hairline }}>
          <Tx w={700} s={10} ls={0.12} c={C.muted}>BILL TO</Tx>
          <Tx w={700} s={12.5} style={{ marginTop: 5 }}>{QODE_ENTITY.name}</Tx>
          <Tx s={11} c={C.muted} lh={1.5} style={{ marginTop: 3 }}>{[...qodeAddressLines(), QODE_ENTITY.gstin && 'GSTIN: ' + QODE_ENTITY.gstin, 'SEBI Registered Portfolio Manager · ' + QODE_ENTITY.sebiRegistration].filter(Boolean).join('\n')}</Tx>
        </View>
        <View style={{ paddingTop: 14 }}>
          <View style={{ flexDirection: 'row', paddingBottom: 6, borderBottomWidth: 1, borderColor: C.hairline }}>
            <Tx w={700} s={10} ls={0.08} c={C.muted} style={{ flex: 1 }}>DESCRIPTION</Tx>
            <Tx w={700} s={10} ls={0.08} c={C.muted}>AMOUNT</Tx>
          </View>
          <View style={{ flexDirection: 'row', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderColor: C.hairline }}>
            <View style={{ flex: 1 }}>
              <Tx s={12.5}>Distribution fees — {period.label}</Tx>
              <Tx s={10.5} c={C.muted} lh={1.5} style={{ marginTop: 3 }}>{ratePct} share of fees on {clientCount} {clientCount === 1 ? 'client' : 'clients'}{discount > 0 ? `, net of ₹ ${inr(discount)} in discounts given to clients` : ''}. {period.startDate} to {period.endDate}.</Tx>
            </View>
            <Tx s={12.5}>₹ {inr(tax.taxableValue)}</Tx>
          </View>
          {[['Taxable value', tax.taxableValue],
            ...(tax.treatment === 'intra_state' ? [[`CGST @ ${tax.cgstRate}%`, tax.cgst], [`SGST @ ${tax.sgstRate}%`, tax.sgst]] : []),
            ...(tax.treatment === 'inter_state' ? [[`IGST @ ${tax.igstRate}%`, tax.igst]] : [])].map(([k, v]) => (
            <View key={k} style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 16, paddingVertical: 6 }}>
              <Tx s={11} c={C.muted}>{k}</Tx>
              <Tx s={12.5} style={{ minWidth: 96, textAlign: 'right' }}>₹ {inr(v)}</Tx>
            </View>
          ))}
          {tax.treatment === 'unregistered' && <Tx s={11} c={C.muted} style={{ textAlign: 'right', paddingVertical: 6 }}>No GST charged — not registered under GST</Tx>}
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 16, paddingVertical: 10, borderTopWidth: 2, borderColor: C.hairline, marginTop: 2 }}>
            <Tx w={700} s={12.5}>Total</Tx>
            <Tx w={700} s={15} style={{ minWidth: 96, textAlign: 'right' }}>₹ {inr(tax.total)}</Tx>
          </View>
          <Tx s={11} c={C.muted} style={{ fontStyle: 'italic', marginTop: 4 }}>{amountInWords(tax.total)}</Tx>
        </View>
        {(!!p.bankAccountNumber || !!p.bankIfsc) && (
          <View style={{ paddingTop: 12, marginTop: 12, borderTopWidth: 1, borderColor: C.hairline }}>
            <Tx w={700} s={10} ls={0.12} c={C.muted}>PAYMENT DETAILS</Tx>
            <Tx s={11} c={C.muted} lh={1.5} style={{ marginTop: 5 }}>{[p.bankAccountName, p.bankName, p.bankAccountNumber && 'A/c ' + p.bankAccountNumber, p.bankIfsc && 'IFSC ' + p.bankIfsc].filter(Boolean).join('\n')}</Tx>
          </View>
        )}
        {!!p.notes && <Tx s={11} c={C.muted} lh={1.5} style={{ paddingTop: 12, marginTop: 12, borderTopWidth: 1, borderColor: C.hairline }}>{p.notes}</Tx>}
        <Tx s={10.5} c={C.muted} lh={1.5} style={{ paddingTop: 12, marginTop: 12, borderTopWidth: 1, borderColor: C.hairline }}>Amounts are for distribution fees earned on client portfolios managed by {QODE_ENTITY.name} for the period stated. This invoice is raised by the distributor named above.</Tx>
      </Card>
      {!!state.err && <View style={{ marginTop: 12 }}><Msg tone="red" text={state.err} /></View>}
      {!!state.msg && <Tx s={12} c={C.green} style={{ marginTop: 12 }}>{state.msg}</Tx>}
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
        <CTA label={state.saving ? 'SAVING…' : state.saved ? 'SAVED ✓' : 'SAVE DETAILS'} outline onPress={save} style={{ flex: 1, paddingVertical: 12 }} />
        <CTA label={state.issuing ? 'GENERATING…' : 'GENERATE INVOICE'} onPress={ready ? generate : undefined} style={{ flex: 1, paddingVertical: 12, opacity: ready ? 1 : 0.45 }} />
      </View>
      <Tx s={11} c={C.muted} lh={1.5} style={{ marginTop: 10 }}>{!ready && qodeOk ? 'Fill in your name, address and invoice number first. ' : ''}Your invoice number is recorded when you generate, so each one is only used once.</Tx>
      <Modal visible={pickState} transparent animationType="fade" onRequestClose={() => setPickState(false)}>
        <Pressable onPress={() => setPickState(false)} style={{ flex: 1, backgroundColor: 'rgba(0,32,23,0.55)', justifyContent: 'center', padding: 24 }}>
          <Card style={{ maxHeight: Dimensions.get('window').height * 0.7, paddingVertical: 6 }}>
            <ScrollView>
              {Object.entries(GST_STATE_CODES).sort((a, b) => a[1].localeCompare(b[1])).map(([code, name]) => (
                <Pressable key={code} onPress={() => { set('stateCode', code); set('state', name); setPickState(false); }} style={{ paddingVertical: 12, paddingHorizontal: 18, borderBottomWidth: 1, borderColor: C.hairline }}>
                  <Tx s={13} w={p.stateCode === code ? 700 : 400}>{name}</Tx>
                </Pressable>
              ))}
            </ScrollView>
          </Card>
        </Pressable>
      </Modal>
    </Fade>
  );
}

// ── Decks (web: distributors/documents) ──────────────────────────────────────
const DECKS = [
  { slug: 'corporate-overview', title: 'Corporate overview', asOf: 'August 2026' },
  { slug: 'qode-all-weather', title: 'Qode All Weather', asOf: 'August 2026', strategy: 'Qode All Weather' },
  { slug: 'qode-all-weather-factsheet', title: 'Qode All Weather Factsheet', asOf: 'August 2026', strategy: 'Qode All Weather', kind: 'factsheet' },
  { slug: 'qode-growth-fund', title: 'Qode Growth Fund', asOf: 'August 2026', strategy: 'Qode Growth Fund' },
  { slug: 'qode-growth-fund-factsheet', title: 'Qode Growth Fund Factsheet', asOf: 'August 2026', strategy: 'Qode Growth Fund', kind: 'factsheet' },
  { slug: 'qode-tactical-fund', title: 'Qode Tactical Fund', asOf: 'August 2026', strategy: 'Qode Tactical Fund' },
  { slug: 'qode-tactical-fund-factsheet', title: 'Qode Tactical Fund Factsheet', asOf: 'August 2026', strategy: 'Qode Tactical Fund', kind: 'factsheet' },
];
export function Decks({ onBack }) {
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState({});
  const get = async d => {
    if (busy) return;
    setBusy(d.slug); setErr(e => ({ ...e, [d.slug]: '' }));
    try { await openPdf({ kind: 'deck', slug: d.slug }, 'That document is unavailable just now.'); }
    catch (e) { setErr(o => ({ ...o, [d.slug]: e.status === 401 || e.status === 403 ? 'Please sign in again to download this.' : e.status ? 'That document is unavailable just now.' : 'Download failed. Please check your connection and try again.' })); }
    setBusy('');
  };
  const sections = [['THE FIRM', DECKS.filter(d => !d.strategy)], ['STRATEGY DECKS', DECKS.filter(d => d.strategy && d.kind !== 'factsheet')], ['FACTSHEETS', DECKS.filter(d => d.kind === 'factsheet')]];
  return (
    <Fade>
      <BackRow label="More" onPress={onBack} />
      <Tx s={12.5} c={C.muted}>Download and share with prospective investors.</Tx>
      {sections.map(([h, items]) => items.length > 0 && (
        <View key={h}>
          <SectionLabel>{h}</SectionLabel>
          <Card style={{ overflow: 'hidden' }}>
            {items.map((d, i) => {
              const col = d.strategy ? STRATEGY_COLOR[d.strategy] || NEUTRAL : '#02422b';
              return (
                <View key={d.slug} style={{ padding: 14, borderBottomWidth: i < items.length - 1 ? 1 : 0, borderColor: C.hairline }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <View style={{ width: 38, height: 38, borderRadius: 8, backgroundColor: col + '1a', alignItems: 'center', justifyContent: 'center' }}><DocIcon s={18} c={col} /></View>
                    <View style={{ flex: 1 }}>
                      <Tx w={700} s={13}>{d.title}</Tx>
                      <Tx s={11} c={C.muted}>{d.asOf}</Tx>
                    </View>
                    <Pressable onPress={() => get(d)} style={{ borderWidth: 1, borderColor: C.greenBorder, borderRadius: 8, paddingVertical: 8, paddingHorizontal: 12, opacity: busy && busy !== d.slug ? 0.5 : 1 }}>
                      <Tx w={700} s={11} c={C.green}>{busy === d.slug ? 'PREPARING…' : 'DOWNLOAD'}</Tx>
                    </Pressable>
                  </View>
                  {!!err[d.slug] && <Tx s={11} c={C.red} style={{ marginTop: 6 }}>{err[d.slug]}</Tx>}
                </View>
              );
            })}
          </Card>
        </View>
      ))}
    </Fade>
  );
}

// ── Market indicators (web: valuation-spread-indicator) ──────────────────────
// Figures are the web component's exactly: the same upstream series (/api/mobile/distributor/indicator, same
// parameters), readings before 2006 and null readings dropped (web toSeries), "Latest" = the last reading left,
// to 2 decimals, dated dd-mm-yyyy; the same bands (Risk OFF >= 70, Risk ON <= 30, light 50-70 / 30-50), the dashed
// 50 line and dotted 80 / 20 lines, the same segment names and tooltip ("% rich").
// Layout from the Qode OneView app's VSI screen (Qode_mobile_app/mobile-app, src/app/(tabs)/vsi.tsx): one card per
// segment, stacked, each with its own period filter and touch tooltip, instead of the web's one chart with a
// segment switch. The period filter is an addition (the web zooms by dragging); "Max" is the web's full view.
const SEGMENTS = [['overall', 'Overall VSI', 'Top 750', 'Top 750 companies'], ['large', 'Largecaps', 'Top 100', 'Top 100'], ['mid', 'Midcaps', '101-250', 'Ranks 101–250'], ['small', 'Smallcaps', '251-500', 'Ranks 251–500'], ['micro', 'Microcaps', '500-750', 'Ranks 500–750']];
const HISTORY_START = Date.UTC(2006, 0, 1);
const RISK_OFF = 70, RISK_ON = 30;
const VSI = { ink: '#37584F', line: '#02422B', redOuter: '#f5bfc9', redInner: '#fee5e9', greenInner: '#e5f3ef', greenOuter: '#bdead2', redLabel: '#c00', greenLabel: '#028a3d', gold: '#DABD38', dark: '#002017' };
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const ddmmyyyy = t => { const d = new Date(t); return isNaN(d) ? '' : `${String(d.getUTCDate()).padStart(2, '0')}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${d.getUTCFullYear()}`; };

// web toSeries(): skip null / NaN, skip anything before 2006; keep the upstream order.
function toSeries(entry) {
  const pts = [];
  for (const p of (entry && entry.points) || []) {
    if (p.value === null || p.value === undefined || Number.isNaN(p.value)) continue;
    const t = Date.parse(p.date);
    if (t < HISTORY_START) continue;
    pts.push({ t, v: Number(p.value) });
  }
  return pts;
}

export function Indicators({ onBack }) {   // a tab of its own; onBack only when opened from somewhere else
  const ind = useLoad(() => api.indicator(), []);
  const [info, setInfo] = useState(false);
  const series = useMemo(() => {
    const list = (ind.data && ind.data.series) || [];
    return Object.fromEntries(SEGMENTS.map(s => [s[0], toSeries(list.find(e => e.segment === s[2]))]));
  }, [ind.data]);
  const asOf = useMemo(() => Math.max(0, ...Object.values(series).map(p => (p.length ? p[p.length - 1].t : 0))), [series]);
  return (
    <Fade>
      {!!onBack && <BackRow label="More" onPress={onBack} />}
      <Card big style={{ padding: 16, marginTop: onBack ? 0 : -34 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Tx f="play" w={600} s={18} style={{ flex: 1 }}>Valuation Spread Indicator</Tx>
          <Pressable onPress={() => setInfo(v => !v)} hitSlop={10} accessibilityLabel="How the indicator is calculated" style={{ width: 24, height: 24, borderRadius: 12, borderWidth: 1, borderColor: C.muted, alignItems: 'center', justifyContent: 'center' }}><Tx w={700} s={12} c={C.muted}>i</Tx></Pressable>
        </View>
        <Tx s={12} c={C.muted} lh={1.5} style={{ marginTop: 6 }}>How much of the market is trading rich versus its own history, updated daily from Qode research.{asOf ? ` Data as of ${ddmmyyyy(asOf)}.` : ''}</Tx>
        {info && <Tx s={11.5} c={C.muted} lh={1.55} style={{ marginTop: 8 }}>Each stock's price-to-book is ranked against its own 10-year history. The indicator is the share of the segment trading in the expensive half. Above {RISK_OFF}% Qode underweights the segment (Risk OFF); below {RISK_ON}% it overweights (Risk ON).</Tx>}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 10 }}>
          {[[VSI.redOuter, `Risk OFF · above ${RISK_OFF}%`], [VSI.greenOuter, `Risk ON · below ${RISK_ON}%`]].map(([c, l]) => (
            <View key={l} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <View style={{ width: 12, height: 10, borderRadius: 2, backgroundColor: c }} />
              <Tx s={11} c={C.muted}>{l}</Tx>
            </View>
          ))}
        </View>
      </Card>
      {ind.loading && !ind.data && <View style={{ marginTop: 14 }}><Loading rows={3} h={300} /></View>}
      {!ind.loading && !!ind.err && <View style={{ marginTop: 14 }}><ErrorBox msg={/being rebuilt/i.test(ind.err) ? 'The indicator is being rebuilt. Check back shortly.' : 'We couldn’t load the indicator. Please refresh.'} onRetry={ind.reload} /></View>}
      {!!ind.data && SEGMENTS.map(s => <VsiCard key={s[0]} seg={s} pts={series[s[0]]} />)}
      {!!ind.data && <Tx s={10.5} c={C.gray} style={{ marginTop: 10, marginLeft: 2 }}>Source: Ace Equity, Qode Advisors LLP</Tx>}
    </Fade>
  );
}

function VsiCard({ seg, pts }) {
  const label = seg[1], range = seg[3];
  const latest = pts.length ? pts[pts.length - 1] : null;
  return (
    <Card style={{ padding: 16, marginTop: 14 }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
        <View style={{ flex: 1 }}>
          <Tx f="play" w={600} s={17}>{label}</Tx>
          <Tx s={11} c={C.muted} style={{ marginTop: 1 }}>{range}</Tx>
        </View>
        {latest ? (
          <View style={{ alignItems: 'flex-end' }}>
            <Tx w={700} s={9.5} ls={0.1} c={C.muted}>LATEST</Tx>
            <Amt w={700} s={20} c={latest.v >= RISK_OFF ? VSI.redLabel : latest.v <= RISK_ON ? VSI.greenLabel : C.ink}>{latest.v.toFixed(2)}%</Amt>
            <Tx s={10.5} c={C.muted}>{ddmmyyyy(latest.t)}</Tx>
          </View>
        ) : null}
      </View>
      {pts.length === 0 ? <Tx s={12} c={C.muted} style={{ marginTop: 14 }}>No indicator data is available right now.</Tx> : <VsiChart pts={pts} zone={label} />}
    </Card>
  );
}

const PLOT_H = 220, AXIS_H = 18, GUTTER = 30, TIP_W = 124;
function VsiChart({ pts, zone }) {
  const [w, setW] = useState(0);
  const [at, setAt] = useState(null);   // index into pts under the finger
  const wRef = React.useRef(0);
  const plotW = Math.max(1, w - GUTTER);
  const t0 = pts.length ? pts[0].t : 0, t1 = pts.length ? pts[pts.length - 1].t : 1;
  const x = t => GUTTER + ((t - t0) / Math.max(1, t1 - t0)) * plotW;
  const y = v => (1 - v / 100) * PLOT_H;
  // About two points per pixel: the line reads the same, the SVG stays light.
  const d = useMemo(() => {
    if (!w || !pts.length) return '';
    const step = Math.max(1, Math.floor(pts.length / (plotW * 2)));
    let s = '';
    pts.forEach((p, i) => { if (i % step === 0 || i === pts.length - 1) s += `${s ? 'L' : 'M'}${x(p.t).toFixed(1)},${y(p.v).toFixed(1)}`; });
    return s;
  }, [pts, w]);
  const ticks = useMemo(() => {
    if (!pts.length || t1 <= t0) return [];
    const spanDays = (t1 - t0) / 864e5, out = [];
    if (spanDays < 3 * 365) {   // 1Y / 2Y: month ticks
      const stepM = spanDays <= 400 ? 3 : 6, end = new Date(t1);
      let yr = end.getUTCFullYear(), mo = end.getUTCMonth() - (end.getUTCMonth() % stepM);
      for (;;) { const t = Date.UTC(yr, mo, 1); if (t < t0) break; if (t <= t1) out.unshift({ t, l: `${MON[mo]} ${String(yr).slice(2)}` }); mo -= stepM; if (mo < 0) { mo += 12; yr--; } }
      return out;
    }
    const a = new Date(t0).getUTCFullYear(), b = new Date(t1).getUTCFullYear(), step = Math.max(1, Math.ceil((b - a + 1) / 5));
    for (let yr = b; yr >= a; yr -= step) { const t = Date.UTC(yr, 0, 1); if (t >= t0 && t <= t1) out.unshift({ t, l: String(yr) }); }
    return out;
  }, [pts]);
  const pick = lx => {
    if (!pts.length || wRef.current <= GUTTER) return;
    const t = t0 + ((lx - GUTTER) / (wRef.current - GUTTER)) * (t1 - t0);
    let lo = 0, hi = pts.length - 1;
    while (lo < hi) { const m = (lo + hi) >> 1; if (pts[m].t < t) lo = m + 1; else hi = m; }
    if (lo > 0 && Math.abs(pts[lo - 1].t - t) < Math.abs(pts[lo].t - t)) lo--;
    setAt(lo);
  };
  const pickRef = React.useRef(pick); pickRef.current = pick;
  // Tap or slide sideways for a reading; an up/down swipe still scrolls the page.
  const pan = React.useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > Math.abs(g.dy),
    onPanResponderGrant: e => pickRef.current(e.nativeEvent.locationX),
    onPanResponderMove: e => pickRef.current(e.nativeEvent.locationX),
    onPanResponderTerminationRequest: () => true,
  })).current;
  const p = at != null ? pts[at] : null;
  const tipLeft = p ? Math.min(Math.max(x(p.t) + 8, GUTTER), Math.max(GUTTER, w - TIP_W - 2)) : 0;
  return (
    <View>
    {/* Web axis titles: "Value (%)" on the y-axis, "Date" on the x-axis */}
    <Tx s={10} c={C.muted} style={{ marginTop: 12 }}>Value (%)</Tx>
    <View style={{ marginTop: 4, height: PLOT_H + AXIS_H }} onLayout={e => { wRef.current = e.nativeEvent.layout.width; setW(e.nativeEvent.layout.width); }} {...pan.panHandlers}>
      {w > 0 && (
        <Svg width={w} height={PLOT_H + AXIS_H}>
          <Rect x={GUTTER} y={y(100)} width={plotW} height={y(RISK_OFF) - y(100)} fill={VSI.redOuter} />
          <Rect x={GUTTER} y={y(RISK_OFF)} width={plotW} height={y(50) - y(RISK_OFF)} fill={VSI.redInner} />
          <Rect x={GUTTER} y={y(50)} width={plotW} height={y(RISK_ON) - y(50)} fill={VSI.greenInner} />
          <Rect x={GUTTER} y={y(RISK_ON)} width={plotW} height={y(0) - y(RISK_ON)} fill={VSI.greenOuter} />
          {[0, 20, 40, 60, 80, 100].map(v => <SvgText key={v} x={GUTTER - 5} y={Math.min(PLOT_H - 1, Math.max(9, y(v) + 3.5))} fontSize={9.5} fill={VSI.ink} textAnchor="end">{v}</SvgText>)}
          <SvgText x={GUTTER + 6} y={y(100) + 13} fontSize={10} fontWeight="600" fill={VSI.redLabel}>{`Risk OFF: Underweight ${zone}`}</SvgText>
          <SvgText x={GUTTER + 6} y={y(0) - 6} fontSize={10} fontWeight="600" fill={VSI.greenLabel}>{`Risk ON: Overweight ${zone}`}</SvgText>
          <Line x1={GUTTER} x2={w} y1={y(50)} y2={y(50)} stroke={VSI.dark} strokeWidth={1.5} strokeDasharray="6 4" />
          <Line x1={GUTTER} x2={w} y1={y(80)} y2={y(80)} stroke={VSI.gold} strokeWidth={1.3} strokeDasharray="2 3" />
          <Line x1={GUTTER} x2={w} y1={y(20)} y2={y(20)} stroke={VSI.gold} strokeWidth={1.3} strokeDasharray="2 3" />
          <Path d={d} stroke={VSI.line} strokeWidth={1.5} fill="none" strokeLinejoin="round" />
          <Line x1={GUTTER} x2={w} y1={PLOT_H} y2={PLOT_H} stroke="rgba(55,88,79,0.3)" strokeWidth={1} />
          {ticks.map((tk, i) => { const xx = x(tk.t); return <SvgText key={tk.t} x={Math.min(w - 2, Math.max(GUTTER, xx))} y={PLOT_H + 13} fontSize={9.5} fill={VSI.ink} textAnchor={i === ticks.length - 1 && xx > w - 20 ? 'end' : 'middle'}>{tk.l}</SvgText>; })}
          {p && <Line x1={x(p.t)} x2={x(p.t)} y1={0} y2={PLOT_H} stroke="rgba(55,88,79,0.55)" strokeWidth={1} />}
          {p && <Rect x={x(p.t) - 3.5} y={y(p.v) - 3.5} width={7} height={7} rx={3.5} fill={VSI.line} stroke="#fff" strokeWidth={1.5} />}
        </Svg>
      )}
      {p && (
        // web tooltip: the date, then "% rich: xx.xx"
        <View pointerEvents="none" style={{ position: 'absolute', top: 22, left: tipLeft, width: TIP_W, backgroundColor: '#1F2A27', borderRadius: 6, paddingVertical: 6, paddingHorizontal: 9 }}>
          <Tx w={700} s={11} c={C.cream}>{ddmmyyyy(p.t)}</Tx>
          <Tx s={11} c={C.cream}>% rich: <Tx w={700} s={11} c={C.cream}>{p.v.toFixed(2)}</Tx></Tx>
        </View>
      )}
    </View>
    <Tx s={10} c={C.muted} center style={{ marginTop: 2 }}>Date</Tx>
    </View>
  );
}

// ── Raise a ticket (web: distributors/support) ───────────────────────────────
const TOPICS = [
  ['onboarding', 'Onboarding help', 'An account that is stuck or needs chasing'],
  ['investor', 'Question about an investor', 'Anything specific to one of your clients'],
  ['payout', 'Payout or brokerage', 'What you are due, and when'],
  ['reporting', 'Reporting or statements', 'SOA, valuations, tax documents'],
  ['access', 'Portal access', 'Logging in, or data that looks wrong'],
  ['other', 'Other', 'Anything else'],
];
export function Ticket({ onBack }) {
  const [topic, setTopic] = useState('');
  const [about, setAbout] = useState('');
  const [message, setMessage] = useState('');
  const [st, setSt] = useState({ busy: false, err: '', done: false });
  const hint = (TOPICS.find(t => t[0] === topic) || [])[2];
  const submit = async () => {
    if (st.busy) return;
    if (!topic) return setSt({ busy: false, err: 'Please pick what this is about.', done: false });
    if (!message.trim()) return setSt({ busy: false, err: 'Please tell us what you need.', done: false });
    setSt({ busy: true, err: '', done: false });
    try {
      await api.ticket({ topic, aboutInvestor: topic === 'investor' || topic === 'onboarding' ? about.trim() : '', message: message.trim() });
      setSt({ busy: false, err: '', done: true });
    } catch (e) { setSt({ busy: false, err: e.status ? e.message || 'We couldn’t send that. Please try again.' : 'We couldn’t send that. Please check your connection and try again.', done: false }); }
  };
  if (st.done) return (
    <Fade>
      <BackRow label="More" onPress={onBack} />
      <Card style={{ padding: 20, alignItems: 'center' }}>
        <Tx f="play" w={600} s={20}>Ticket raised</Tx>
        <Tx s={12.5} c={C.muted} lh={1.6} center style={{ marginTop: 8 }}>The partnerships team has it and will reply to you by email. You do not need to send it again.</Tx>
        <CTA label="RAISE ANOTHER" onPress={() => { setTopic(''); setAbout(''); setMessage(''); setSt({ busy: false, err: '', done: false }); }} style={{ marginTop: 18, alignSelf: 'stretch' }} />
        <CTA label="BACK" outline onPress={onBack} style={{ marginTop: 10, alignSelf: 'stretch' }} />
      </Card>
    </Fade>
  );
  return (
    <Fade>
      <BackRow label="More" onPress={onBack} />
      <Tx s={12.5} c={C.muted}>Tell us what you need and the partnerships team will reply by email.</Tx>
      <SectionLabel>WHAT IS THIS ABOUT?</SectionLabel>
      <Card style={{ overflow: 'hidden' }}>
        {TOPICS.map(([k, l, h], i) => (
          <Pressable key={k} onPress={() => { setTopic(k); setSt(s => ({ ...s, err: '' })); }} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderBottomWidth: i < TOPICS.length - 1 ? 1 : 0, borderColor: C.hairline }}>
            <View style={{ width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: topic === k ? C.green : 'rgba(55,88,79,0.4)', alignItems: 'center', justifyContent: 'center' }}>
              {topic === k && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: C.green }} />}
            </View>
            <View style={{ flex: 1 }}>
              <Tx w={700} s={13}>{l}</Tx>
              <Tx s={11} c={C.muted}>{h}</Tx>
            </View>
          </Pressable>
        ))}
      </Card>
      <Card style={{ padding: 16, marginTop: 14 }}>
        {(topic === 'investor' || topic === 'onboarding') && <Field label="WHICH INVESTOR? (OPTIONAL)" value={about} onChangeText={t => setAbout(t.slice(0, 200))} placeholder="Name or email" />}
        <Field label="WHAT DO YOU NEED?" value={message} onChangeText={t => setMessage(t.slice(0, 4000))} multiline maxLength={4000}
          placeholder={(hint ? hint + '. ' : '') + 'The more detail you give, the fewer times we have to come back to you.'}
          hint={`${message.length} / 4000`} style={{ marginTop: topic === 'investor' || topic === 'onboarding' ? 16 : 0 }} />
      </Card>
      {!!st.err && <Tx s={12} c={C.red} style={{ marginTop: 12 }}>{st.err}</Tx>}
      <CTA label={st.busy ? 'SENDING…' : 'RAISE TICKET'} onPress={submit} style={{ marginTop: 16, opacity: st.busy ? 0.6 : 1 }} />
      <Tx s={11.5} c={C.muted} lh={1.5} style={{ marginTop: 14 }}>Or email <Tx w={700} s={11.5} c={C.green} onPress={() => Linking.openURL('mailto:partnerships@qodeinvest.com').catch(() => {})}>partnerships@qodeinvest.com</Tx> or call <Tx w={700} s={11.5} c={C.green} onPress={() => Linking.openURL('tel:+919326535470').catch(() => {})}>+91 9326535470</Tx>.</Tx>
    </Fade>
  );
}

// ── Risk & controls (web links partners to the investor policies page) ───────
export function Policies({ onBack }) {
  const R = content.RISK;
  return (
    <Fade>
      <BackRow label="More" onPress={onBack} />
      {R.intro.map((t, i) => <Tx key={i} s={12.5} c={C.muted} lh={1.5}>{t}</Tx>)}
      {R.policies.map(p => (
        <Card key={p.title} style={{ padding: 16, marginTop: 14 }}>
          <Tx f="play" w={600} s={17}>{p.title}</Tx>
          {p.body.map((t, i) => <Tx key={i} s={12.5} c={C.muted} lh={1.6} style={{ marginTop: 8 }}>{t}</Tx>)}
          {!!p.pdf && <CTA label="VIEW POLICY (PDF)" outline onPress={() => openUrl(p.pdf)} style={{ marginTop: 12, paddingVertical: 11 }} />}
        </Card>
      ))}
    </Fade>
  );
}
