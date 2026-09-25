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
import { View, Pressable, ScrollView, TextInput, Linking, Modal, Dimensions } from 'react-native';
import Svg, { Path, Rect, Line, Text as SvgText } from 'react-native-svg';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';
import { C, Tx, Amt, Card, CTA, Fade, Field } from '../ui';
import { ChevronDown, ChevronLeft, ChevronRight, DocIcon, MailIcon, Phone } from '../icons';
import { distributor as api, BASE_URL } from '../api';
import { useLoad, openUrl, SectionLabel, Loading, ErrorBox } from './kit';
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
    <Tx s={12} c={tone === 'red' ? C.red : C.muted} lh={1.5}>{text}</Tx>
  </Card>
);

// Opens a statement / deck PDF from a signed 5-minute link, without leaving the app:
//   iOS      in-app viewer (Safari view) — shows the PDF, "Done" returns to the app, share button to save/send;
//   Android  downloads it into the app's cache, then the system sheet: open in a PDF viewer, save or send.
//            (Handing the URL to Chrome made it download silently and left the user outside the app.)
async function openPdf(body, fail) {
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

export function InvestorDetail({ c, status, onBack, onboardingSequence }) {
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
      <Msg text={msg} />
      {!!c.email && <CTA label={busy ? 'WORKING…' : 'DOWNLOAD SOA'} outline onPress={soa} style={{ marginTop: 14, paddingVertical: 12 }} />}

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
  const m = s.match(/MF([\d.]+)/i), p = s.match(/PF([\d.]+)/i), h = s.match(/\bH([\d.]+)/i);
  return { mf: m ? m[1] : null, pf: p ? p[1] : null, h: h ? h[1] : null };
};
const GST_RATE = 18;

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
    g.gst += num(r.totalFeesGst); g.share += commissionOf(r) * 1.18; g.shareOfFee += r.yourShareOfFee != null ? num(r.yourShareOfFee) : num(r.distributorShare);
    g.commission += commissionOf(r); g.shareDiscount += num(r.shareDiscount); g.discount += num(r.discountAmount);
    if (r.rateSource !== 'unmapped') g.unmapped = false;
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
  useEffect(() => { if (periods.data && !period) setPeriod(defaultPeriod(periods.data)); }, [periods.data]);
  const rows = useLoad(() => (period ? api.feeRows(period) : Promise.resolve(null)), [period && period.label]);
  const list = Array.isArray(rows.data) ? rows.data : [];
  const { clients, totals: t } = useMemo(() => summarise(list, search), [rows.data, search]);

  if (periods.loading && !periods.data) return <View style={{ marginTop: -30 }}><Loading rows={3} h={90} /></View>;
  if (periods.err) return <View style={{ marginTop: -30 }}><ErrorBox msg={'Could not load periods. ' + periods.err} onRetry={periods.reload} /></View>;
  const ps = periods.data.periods || [];
  const group = period ? ps.filter(p => p.type === period.type) : [];
  const gi = period ? group.findIndex(p => p.label === period.label) : -1;
  const groups = [['All time', ps.filter(p => p.type === 'Since Inception')], ['Quarters', ps.filter(p => p.type === 'Quarter').reverse()], ['Financial years', ps.filter(p => p.type === 'Year').reverse()]];
  return (
    <Fade>
      <Card big style={{ marginTop: -34, padding: 16 }}>
        <Tx w={700} s={10.5} ls={0.12} c={C.muted}>PERIOD</Tx>
        {groups.map(([h, items]) => items.length > 0 && (
          <View key={h} style={{ marginTop: 10 }}>
            <Tx s={10.5} c={C.gray} style={{ marginBottom: 6 }}>{h}</Tx>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {items.map((p, i) => {
                const on = period && p.label === period.label;
                return (
                  <Pressable key={p.label} onPress={() => { setPeriod(p); setOpen({}); }} style={{ paddingVertical: 7, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1, borderColor: on ? C.green : C.mutedBorder35, backgroundColor: on ? C.green : 'transparent' }}>
                    <Tx w={700} s={11} c={on ? C.cream : C.muted}>{p.label}{h === 'Quarters' && i === 0 ? ' · latest' : ''}</Tx>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        ))}
        {!!period && <Tx s={11} c={C.muted} style={{ marginTop: 10 }}>{period.label} · {period.startDate} – {period.endDate}</Tx>}
        {!!period && period.type !== 'Since Inception' && group.length > 1 && (
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
            <CTA label="← EARLIER" outline onPress={() => gi > 0 && setPeriod(group[gi - 1])} style={{ flex: 1, paddingVertical: 9, opacity: gi > 0 ? 1 : 0.4 }} />
            <CTA label="LATER →" outline onPress={() => gi < group.length - 1 && setPeriod(group[gi + 1])} style={{ flex: 1, paddingVertical: 9, opacity: gi < group.length - 1 ? 1 : 0.4 }} />
          </View>
        )}
      </Card>

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
          {!!t.sharePct && <Tx s={12} c={C.muted} lh={1.5} style={{ marginTop: 8 }}>Your revenue share <Tx w={700} s={12} c={C.green}>{t.sharePct}</Tx> of the standard fee for your clients{t.discount > 0 ? ', less the discounts you’ve given' : ''}</Tx>}
          {t.shareNet > 0 && <Tx s={12} lh={1.5} style={{ marginTop: 6 }}>Plus GST of <Tx w={700} s={12}>₹ {inr(t.shareGst)}</Tx> — invoice ₹ {inr(t.share)} in total</Tx>}
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
            <CTA label="RAISE INVOICE" onPress={() => onInvoice(period)} style={{ flex: 1, paddingVertical: 11 }} />
            <CTA label="FEE STATEMENT" outline onPress={() => onStatement(period)} style={{ flex: 1, paddingVertical: 11 }} />
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
        </Card>

        {!!t.sharePct && (<>
          <SectionLabel>HOW YOUR SHARE WAS CALCULATED</SectionLabel>
          <Card style={{ paddingHorizontal: 16, paddingVertical: 4 }}>
            {[
              ...(t.perfFees > 0
                ? [['Management fees your clients were charged', 'charged quarterly on their assets', t.fixedFees], ['Performance fees your clients were charged', 'charged annually on gains above the hurdle', t.perfFees]]
                : [['Fees your clients were charged', 'charged quarterly on their assets', t.totalFees]]),
              ...(t.shareDiscount > 0
                ? [[`Your share, ${t.sharePct} of those fees`, 'your revenue share, per your agreement with Qode', t.shareOfFee], ['Less the discount you gave', 'the lower fee you agreed with your clients', -t.shareDiscount, 'neg'], ['Your commission', 'at your net fee rate in the CRM', t.shareNet, 'sub']]
                : [[`Your commission, ${t.sharePct} of those fees`, 'your revenue share, per your agreement with Qode', t.shareNet, 'sub']]),
              ['Plus GST at 18%', 'the statutory rate on your commission', t.shareGst],
              ['Payable to you', 'invoice this amount in full — GST is already included', t.share, 'total'],
            ].map(([k, sub, v, kind], i, a) => (
              <View key={k} style={{ flexDirection: 'row', gap: 10, paddingVertical: 10, borderBottomWidth: i < a.length - 1 ? 1 : 0, borderColor: C.hairline, ...(kind === 'total' ? { borderTopWidth: 1.5, borderTopColor: C.green } : null) }}>
                <View style={{ flex: 1 }}>
                  <Tx w={kind ? 700 : 400} s={12.5}>{k}</Tx>
                  <Tx s={10.5} c={C.muted}>{sub}</Tx>
                </View>
                <Tx w={kind === 'total' || kind === 'sub' ? 700 : 400} s={12.5} c={kind === 'neg' ? C.red : C.ink}>{v < 0 ? `− ₹ ${inr(-v)}` : `₹ ${inr(v)}`}</Tx>
              </View>
            ))}
          </Card>
        </>)}

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
          const terms = parseBillgroup(g.accounts[0] && g.accounts[0].billGroup);
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
                  </View>
                  <View style={{ justifyContent: 'center', transform: [{ rotate: exp ? '180deg' : '0deg' }] }}><ChevronDown s={10} c={C.muted} /></View>
                </View>
              </Pressable>
              {exp && (
                <View style={{ paddingHorizontal: 14, paddingBottom: 14 }}>
                  {(terms.mf || terms.pf || terms.h) && (
                    <Tx s={11} c={C.muted} style={{ marginBottom: 8 }}>{[terms.mf && `Management ${terms.mf}%`, terms.pf && `Performance ${terms.pf}%`, terms.h && `Hurdle ${terms.h}%`].filter(Boolean).join(' · ')}</Tx>
                  )}
                  {g.accounts.map((a, i) => (
                    <View key={i} style={{ borderTopWidth: 1, borderColor: C.hairline, paddingTop: 10, marginTop: i ? 10 : 0 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <View style={{ width: 9, height: 9, borderRadius: 2, backgroundColor: SCHEME_COLOR[code3(a)] || NEUTRAL }} />
                        <Tx w={700} s={12.5} style={{ flex: 1 }}>{a.isZeroFee ? 'No fee arrangement' : SCHEME[code3(a)] || a.strategy}</Tx>
                      </View>
                      <Tx s={10.5} c={C.gray} style={{ marginTop: 2 }}>{a.accountcode || a.strategy}{a.inceptionDate ? ' · opened ' + displayDate(a.inceptionDate) : ''}</Tx>
                      {a.isZeroFee ? <Tx s={11.5} c={C.muted} style={{ marginTop: 6, fontStyle: 'italic' }}>No fees charged on this account</Tx> : (
                        <View style={{ marginTop: 4 }}>
                          <FeeLine k="Client assets" v={a.averageAum} />
                          <FeeLine k="Management fee (before GST)" v={a.fixedFees} sub={num(a.fixedFees) > 0 && a.actualFeeChargedPct != null ? `(${a.actualFeeChargedPct}%)` : ''} />
                          <FeeLine k="Performance fee (before GST)" v={num(a.performanceFees) > 0 ? a.performanceFees : '—'} sub={num(a.performanceFees) > 0 && a.rackPerfFeePct != null ? `(${a.rackPerfFeePct}% over ${a.hurdlePct ?? 0}%)` : 'billed annually'} />
                          <FeeLine k="Your share (share category × fee)" v={a.rateSource === 'unmapped' ? '—' : a.yourShareOfFee} sub={a.rateSource === 'unmapped' ? '' : `(${a.distributorPercentage}%)`} />
                          {a.netFeePct != null && num(a.shareDiscount) > 0 && <FeeLine k="Discount (share − commission)" v={'− ' + a.shareDiscount} red />}
                          <FeeLine k="Your commission (before GST)" v={a.yourCommission ?? a.distributorShare} bold sub={a.netFeePctOfAum != null ? `(${a.netFeePctOfAum}% ${a.netFeePctBasis === 'performance' ? 'of gains' : 'p.a.'})` : ''} />
                        </View>
                      )}
                    </View>
                  ))}
                  {g.accounts.length > 1 && (
                    <View style={{ borderTopWidth: 1.5, borderColor: C.green, marginTop: 10, paddingTop: 6 }}>
                      <FeeLine k="Total client assets" v={inr(g.aum)} />
                      <FeeLine k="Total your share" v={inr(g.shareOfFee)} />
                      {g.shareDiscount > 0 && <FeeLine k="Total discount" v={'− ' + inr(g.shareDiscount)} red />}
                      <FeeLine k="Total commission" v={inr(g.commission)} bold />
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
const FeeLine = ({ k, v, sub, bold, red }) => (
  <View style={{ flexDirection: 'row', gap: 10, paddingVertical: 4 }}>
    <Tx s={11.5} c={C.muted} style={{ flex: 1 }}>{k}</Tx>
    <View style={{ alignItems: 'flex-end' }}>
      <Tx w={bold ? 700 : 400} s={12} c={red ? C.red : C.ink}>{v}</Tx>
      {!!sub && <Tx s={10} c={C.gray}>{sub}</Tx>}
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
async function savePdf(html, fileName) {
  const { uri } = await Print.printToFileAsync({ html });
  if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: fileName, UTI: 'com.adobe.pdf' });
  else await Print.printAsync({ uri });
}

// ── Fee statement (web: fees-distribution/statement) ─────────────────────────
// Payable figure = the fees page's (Σ commission × 1.18). The web statement sums distributorShare instead, which
// ignores the CRM net-rate conversion and so disagrees with the fees page and the invoice; the app keeps all three
// on the same figure.
export function Statement({ period, distributorName, onBack, onInvoice }) {
  const { loading, err, rows, sum, reload } = usePeriodRows(period);
  const [busy, setBusy] = useState(false);
  const t = sum.totals;
  const ref = `QFS-${String(period.label).replace(/\s+/g, '')}-${(distributorName || 'DST').split(/\s+/).slice(0, 3).map(w => w[0]).join('').toUpperCase()}`;
  const issued = formatDate(new Date().toISOString());
  const unmapped = rows.some(r => r.rateSource === 'unmapped'), legacy = rows.some(r => r.rateSource === 'legacy');
  const ratePct = t.sharePct || '—';
  const html = () => `<html><head><meta charset="utf-8"><style>body{font-family:Arial,sans-serif;color:#002017;padding:18px;font-size:12px}h1{font-size:18px;margin:0}table{width:100%;border-collapse:collapse;margin-top:10px}td,th{padding:6px;border-bottom:1px solid #ddd;text-align:right}td:first-child,th:first-child{text-align:left}.tot td{font-weight:bold;border-top:2px solid #02422B}.box{background:#FFF6DC;border:1px solid #DABD38;padding:10px;margin:12px 0}.muted{color:#37584F}</style></head><body>
    <table style="margin:0"><tr><td style="border:0;vertical-align:top"><b>Qode Advisors LLP</b><br>SEBI Registered Portfolio Manager · INP000008914<br>Mumbai, India<br>investor.relations@qodeinvest.com</td>
    <td style="border:0;vertical-align:top"><h1>Distributor Fee Statement</h1>Ref ${esc(ref)}<br>Issued ${esc(issued)}</td></tr></table>
    <p><b>Statement for</b> ${esc(distributorName || '—')}<br><b>Period</b> ${esc(period.label)} · ${esc(period.startDate)} – ${esc(period.endDate)}</p>
    <p class="muted">Total payable to you — inclusive of GST</p><h1>₹ ${inr(t.share)}</h1><i>${esc(amountInWords(t.share))}</i>
    <div class="box">This amount already includes GST. Do not add GST on top.<br>Invoice Qode Advisors LLP for <b>₹ ${inr(t.share)}</b> in total — shown on your invoice as <b>₹ ${inr(t.shareNet)}</b> plus GST of <b>₹ ${inr(t.shareGst)}</b>.</div>
    <table><tr><td>Fees billed to your clients</td><td>₹ ${inr(t.totalFees)}</td></tr><tr><td>Your share at ${esc(ratePct)}</td><td>₹ ${inr(t.shareOfFee)}</td></tr>
    ${t.shareDiscount > 0 ? `<tr><td>Less: the discount you agreed with your clients</td><td>− ₹ ${inr(t.shareDiscount)}</td></tr>` : ''}
    <tr class="tot"><td>Your share for the period</td><td>₹ ${inr(t.shareNet)}</td></tr><tr><td>Add: GST at 18%</td><td>₹ ${inr(t.shareGst)}</td></tr><tr class="tot"><td>Payable to you</td><td>₹ ${inr(t.share)}</td></tr></table>
    <h3>Breakdown by client</h3><table><tr><th>Client</th><th>Avg AUM</th><th>Fixed Fees</th><th>Perf. Fees</th><th>Total Fees</th><th>You Receive (incl. GST)</th></tr>
    ${sum.all.map(g => `<tr><td>${esc(g.name)}${g.accounts.length > 1 ? ` · ${g.accounts.length} accounts` : ''}</td><td>${inr(g.aum)}</td><td>${inr(g.fixedFees)}</td><td>${inr(g.perfFees)}</td><td>${inr(g.totalFees)}</td><td>${inr(g.share)}</td></tr>`).join('')}
    <tr class="tot"><td>Total</td><td>${inr(t.aum)}</td><td>${inr(t.fixedFees)}</td><td>${inr(t.perfFees)}</td><td>${inr(t.totalFees)}</td><td>${inr(t.share)}</td></tr></table>
    ${unmapped ? '<p><b>Some clients are not included.</b> One or more clients have no fee share configured, so no amount is shown against them. Contact investor.relations@qodeinvest.com before invoicing.</p>' : ''}
    ${legacy ? '<p><b>Provisional rate.</b> This statement uses a share rate held in our portal records rather than a confirmed CRM rate. Please confirm before invoicing.</p>' : ''}
    <p class="muted"><b>This is not a tax invoice.</b> It is a statement of fees earned, issued for your records. Please raise your own invoice on Qode Advisors LLP for the total shown above.</p>
    <p class="muted"><b>The total payable to you is inclusive of GST at 18%.</b> Your revenue share of ${esc(ratePct)} is calculated on the fees billed to your clients, and GST at 18% is added to your share. Do not add GST on top of the total — the amount payable to you is ₹ ${inr(t.share)} in full. On your invoice this is ₹ ${inr(t.shareNet)} plus GST of ₹ ${inr(t.shareGst)}.</p>
    <p class="muted">Fixed fees are billed quarterly and performance fees annually. Fee amounts are as recorded in our systems for the stated period. If any figure appears incorrect, contact investor.relations@qodeinvest.com before invoicing.</p></body></html>`;
  return (
    <Fade>
      <BackRow label="Back to fees" onPress={onBack} />
      {loading && <Tx s={12} c={C.muted}>Preparing your statement…</Tx>}
      {!!err && <ErrorBox msg={`We couldn’t prepare the statement. ${err}.`} onRetry={reload} />}
      {!loading && !err && (<>
        <Card style={{ padding: 18 }}>
          <Tx w={700} s={10.5} ls={0.12} c={C.muted}>DISTRIBUTOR FEE STATEMENT</Tx>
          <Tx s={11} c={C.gray} style={{ marginTop: 2 }}>Ref {ref} · Issued {issued}</Tx>
          <Tx s={12} style={{ marginTop: 10 }}>Statement for <Tx w={700} s={12}>{distributorName || '—'}</Tx></Tx>
          <Tx s={12} c={C.muted}>{period.label} · {period.startDate} – {period.endDate}</Tx>
          <Tx s={11} c={C.muted} style={{ marginTop: 14 }}>Total payable to you — inclusive of GST</Tx>
          <Amt w={700} s={26}>₹ {inr(t.share)}</Amt>
          <Tx s={11} c={C.muted} style={{ fontStyle: 'italic', marginTop: 2 }}>{amountInWords(t.share)}</Tx>
          <View style={{ marginTop: 12, padding: 10, borderRadius: 8, backgroundColor: '#FFF6DC', borderWidth: 1, borderColor: C.gold }}>
            <Tx s={11.5} lh={1.5}>This amount already includes GST. Do not add GST on top. Invoice Qode Advisors LLP for <Tx w={700} s={11.5}>₹ {inr(t.share)}</Tx> in total — shown on your invoice as <Tx w={700} s={11.5}>₹ {inr(t.shareNet)}</Tx> plus GST of <Tx w={700} s={11.5}>₹ {inr(t.shareGst)}</Tx>.</Tx>
          </View>
        </Card>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
          <CTA label={busy ? 'PREPARING…' : 'SAVE AS PDF'} onPress={async () => { if (busy) return; setBusy(true); try { await savePdf(html(), ref); } catch {} setBusy(false); }} style={{ flex: 1, paddingVertical: 11 }} />
          <CTA label="RAISE INVOICE" outline onPress={() => onInvoice(period)} style={{ flex: 1, paddingVertical: 11 }} />
        </View>
        <Tx s={11} c={C.muted} lh={1.5} style={{ marginTop: 10 }}>This statement is not a tax invoice — use Raise invoice to generate one. Save as PDF opens the share sheet, where you can save or send it.</Tx>
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
    else if (p.stateCode && p.gstin.slice(0, 2) !== String(p.stateCode).padStart(2, '0')) e.stateCode = `Your GSTIN begins ${p.gstin.slice(0, 2)} (${GST_STATE_CODES[p.gstin.slice(0, 2)]}) — it must match your state`;
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
    return `<html><head><meta charset="utf-8"><style>body{font-family:Arial,sans-serif;color:#002017;padding:18px;font-size:12px}h1{font-size:20px;margin:0 0 8px}table{width:100%;border-collapse:collapse;margin-top:12px}td,th{padding:6px;border-bottom:1px solid #ddd;text-align:right}td:first-child,th:first-child{text-align:left}.tot td{font-weight:bold;border-top:2px solid #02422B}.muted{color:#37584F}</style></head><body>
      <h1>Tax Invoice</h1>
      <table style="margin:0"><tr><td style="border:0;vertical-align:top"><b>${esc(p.legalName || distributorName || 'Your registered name')}</b><br>${lines.map(esc).join('<br>')}${p.gstin ? '<br>GSTIN: ' + esc(p.gstin) : ''}${p.pan ? '<br>PAN: ' + esc(p.pan) : ''}</td>
      <td style="border:0;vertical-align:top">Invoice no. <b>${esc(invoiceNumber || '—')}</b><br>Date ${esc(displayDate(date))}<br>Period ${esc(period.label)}</td></tr></table>
      <p><b>Bill to</b><br>${esc(QODE_ENTITY.name)}<br>${qodeAddressLines().map(esc).join('<br>')}<br>GSTIN: ${QODE_ENTITY.gstin}<br>SEBI Registered Portfolio Manager · ${QODE_ENTITY.sebiRegistration}</p>
      <table><tr><th>Description</th><th>Amount</th></tr>
      <tr><td>Distribution fees — ${esc(period.label)}<br><span class="muted">${esc(ratePct)} share of fees on ${clientCount} ${clientCount === 1 ? 'client' : 'clients'}${discount > 0 ? `, net of ₹ ${inr(discount)} in discounts given to clients` : ''}. ${esc(period.startDate)} to ${esc(period.endDate)}.</span></td><td>₹ ${inr(tax.taxableValue)}</td></tr>
      <tr><td>Taxable value</td><td>₹ ${inr(tax.taxableValue)}</td></tr>
      ${tax.treatment === 'intra_state' ? `<tr><td>CGST @ 9%</td><td>₹ ${inr(tax.cgst)}</td></tr><tr><td>SGST @ 9%</td><td>₹ ${inr(tax.sgst)}</td></tr>` : tax.treatment === 'inter_state' ? `<tr><td>IGST @ 18%</td><td>₹ ${inr(tax.igst)}</td></tr>` : '<tr><td>No GST charged — not registered under GST</td><td>—</td></tr>'}
      <tr class="tot"><td>Total</td><td>₹ ${inr(tax.total)}</td></tr></table><p><i>${esc(amountInWords(tax.total))}</i></p>
      ${p.bankAccountNumber || p.bankIfsc ? `<p><b>Payment details</b><br>${esc(p.bankAccountName)}<br>${esc(p.bankName)}<br>A/c ${esc(p.bankAccountNumber)}<br>IFSC ${esc(p.bankIfsc)}</p>` : ''}
      ${p.notes ? `<p>${esc(p.notes)}</p>` : ''}
      <p class="muted">Amounts are for distribution fees earned on client portfolios managed by Qode Advisors LLP for the period stated. This invoice is raised by the distributor named above.</p></body></html>`;
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
      await savePdf(html(), 'Invoice ' + invoiceNumber);
      setState(s => ({ ...s, issuing: false, msg: `Invoice ${invoiceNumber} recorded.` }));
    } catch (x) { setState(s => ({ ...s, issuing: false, err: x.status === 409 ? x.message : 'Could not record the invoice' })); }
  };
  const F = (k, label, props = {}) => <Field label={label} value={String(p[k] || '')} onChangeText={t => set(k, props.upper ? t.toUpperCase() : t)} error={errs[k]} style={{ marginTop: 14 }} {...props} />;
  return (
    <Fade>
      <BackRow label="Back to fees" onPress={onBack} />
      {!qodeOk && <Msg tone="red" text="Invoicing isn't available yet. Qode's GST details haven't been configured in the portal, and an invoice without them wouldn't be valid. Please contact investor.relations@qodeinvest.com." />}
      <Card style={{ padding: 18 }}>
        <Tx w={700} s={10.5} ls={0.12} c={C.muted}>TAX INVOICE · {String(period.label).toUpperCase()}</Tx>
        <View style={{ marginTop: 8 }}>
          {[['Taxable value', tax.taxableValue], ...(tax.treatment === 'intra_state' ? [['CGST @ 9%', tax.cgst], ['SGST @ 9%', tax.sgst]] : tax.treatment === 'inter_state' ? [['IGST @ 18%', tax.igst]] : [])].map(([k, v]) => <FeeLine key={k} k={k} v={'₹ ' + inr(v)} />)}
          {tax.treatment === 'unregistered' && <Tx s={11} c={C.muted}>No GST charged — not registered under GST</Tx>}
          <View style={{ borderTopWidth: 1.5, borderColor: C.green, marginTop: 6, paddingTop: 6 }}><FeeLine k="Total" v={'₹ ' + inr(tax.total)} bold /></View>
          <Tx s={10.5} c={C.muted} style={{ fontStyle: 'italic' }}>{amountInWords(tax.total)}</Tx>
        </View>
      </Card>
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
            <Tx s={15} c={p.stateCode ? C.ink : C.gray} style={{ flex: 1 }}>{p.stateCode ? `${p.state} (${p.stateCode})` : 'Select your state'}</Tx>
            <ChevronDown s={10} c={C.muted} />
          </View>
          {!!errs.stateCode && <Tx s={11} c={C.red} style={{ marginTop: 5 }}>{errs.stateCode}</Tx>}
          {!errs.stateCode && !!p.stateCode && !!p.gstin.trim() && <Tx s={10.5} c={C.gray} style={{ marginTop: 5 }}>{String(p.stateCode).padStart(2, '0') === QODE_ENTITY.stateCode ? 'Same state as Qode — your invoice will show CGST and SGST.' : 'Different state from Qode — your invoice will show IGST.'}</Tx>}
        </Pressable>
        {F('pincode', 'PIN CODE', { placeholder: '400001', maxLength: 6, keyboardType: 'number-pad' })}
        <Field label="INVOICE NUMBER *" value={String(invoiceNumber)} onChangeText={setNum} error={errs.invoiceNumber} hint={last ? `Your last invoice here was number ${last}.` : 'Use your own series — we’ll suggest the next one after this.'} style={{ marginTop: 14 }} />
        <Field label="INVOICE DATE * (YYYY-MM-DD)" value={date} onChangeText={t => setDate(t.replace(/[^\d-]/g, '').slice(0, 10))} error={errs.invoiceDate} keyboardType="numbers-and-punctuation" style={{ marginTop: 14 }} />
        {F('invoicePrefix', 'INVOICE PREFIX', { placeholder: 'e.g. ACS/25-26/', hint: 'Optional — used to suggest your next invoice number.' })}
        <Tx w={700} s={11} ls={0.1} c={C.muted} style={{ marginTop: 20 }}>BANK DETAILS FOR PAYMENT</Tx>
        {F('bankAccountName', 'ACCOUNT NAME')}
        {F('bankAccountNumber', 'ACCOUNT NUMBER', { keyboardType: 'number-pad' })}
        {F('bankIfsc', 'IFSC', { maxLength: 11, upper: true, autoCapitalize: 'characters' })}
        {F('bankName', 'BANK NAME')}
      </Card>
      {!!state.err && <View style={{ marginTop: 12 }}><Msg tone="red" text={state.err} /></View>}
      {!!state.msg && <Tx s={12} c={C.green} style={{ marginTop: 12 }}>{state.msg}</Tx>}
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
        <CTA label={state.saving ? 'SAVING…' : state.saved ? 'SAVED ✓' : 'SAVE DETAILS'} outline onPress={save} style={{ flex: 1, paddingVertical: 12 }} />
        <CTA label={state.issuing ? 'GENERATING…' : 'GENERATE INVOICE'} onPress={ready ? generate : undefined} style={{ flex: 1, paddingVertical: 12, opacity: ready ? 1 : 0.45 }} />
      </View>
      <Tx s={11} c={C.muted} lh={1.5} style={{ marginTop: 10 }}>{!ready && qodeOk ? 'Fill in your name, address and invoice number first. ' : ''}Your invoice number is recorded when you generate, so each one is only used once. The PDF opens in the share sheet to save or send.</Tx>
      <Modal visible={pickState} transparent animationType="fade" onRequestClose={() => setPickState(false)}>
        <Pressable onPress={() => setPickState(false)} style={{ flex: 1, backgroundColor: 'rgba(0,32,23,0.55)', justifyContent: 'center', padding: 24 }}>
          <Card style={{ maxHeight: Dimensions.get('window').height * 0.7, paddingVertical: 6 }}>
            <ScrollView>
              {Object.entries(GST_STATE_CODES).map(([code, name]) => (
                <Pressable key={code} onPress={() => { set('stateCode', code); set('state', name); setPickState(false); }} style={{ paddingVertical: 12, paddingHorizontal: 18, borderBottomWidth: 1, borderColor: C.hairline }}>
                  <Tx s={13} w={p.stateCode === code ? 700 : 400}>{name} ({code})</Tx>
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
const SEGMENTS = [['overall', 'Overall VSI', 'Top 750'], ['large', 'Largecaps', 'Top 100'], ['mid', 'Midcaps', '101-250'], ['small', 'Smallcaps', '251-500'], ['micro', 'Microcaps', '500-750']];
const HISTORY_START = Date.UTC(2006, 0, 1);
const ddmmyyyy = iso => { const d = new Date(iso); return isNaN(d) ? '' : `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`; };

export function Indicators({ onBack }) {   // a tab of its own; onBack only when opened from somewhere else
  const ind = useLoad(() => api.indicator(), []);
  const [seg, setSeg] = useState('overall');
  const [info, setInfo] = useState(false);
  const W = Dimensions.get('window').width - 72, H = 240;
  const s = SEGMENTS.find(x => x[0] === seg);
  const pts = useMemo(() => {
    const series = ((ind.data && ind.data.series) || []).find(x => x.segment === s[2]);
    return ((series && series.points) || []).filter(p => p.value != null && !isNaN(p.value) && new Date(p.date).getTime() >= HISTORY_START).map(p => ({ t: new Date(p.date).getTime(), v: Number(p.value), date: p.date }));
  }, [ind.data, seg]);
  const latest = pts[pts.length - 1];
  const t0 = pts.length ? pts[0].t : 0, t1 = pts.length ? pts[pts.length - 1].t : 1;
  const x = t => ((t - t0) / Math.max(1, t1 - t0)) * W, y = v => H - (v / 100) * H;
  const step = Math.max(1, Math.floor(pts.length / 600));
  const d = pts.filter((_, i) => i % step === 0 || i === pts.length - 1).map((p, i) => `${i ? 'L' : 'M'}${x(p.t).toFixed(1)},${y(p.v).toFixed(1)}`).join(' ');
  const years = pts.length ? [...new Set(pts.map(p => new Date(p.t).getFullYear()))].filter((yr, i, a) => i % Math.ceil(a.length / 5) === 0) : [];
  return (
    <Fade>
      {!!onBack && <BackRow label="More" onPress={onBack} />}
      <Card big style={{ padding: 16, marginTop: onBack ? 0 : -34 }}>
        <Tx s={12} c={C.muted} lh={1.5} style={{ marginBottom: 10 }}>How much of the market is trading rich versus its own history, updated daily from Qode research.</Tx>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Tx f="play" w={600} s={18} style={{ flex: 1 }}>Valuation Spread Indicator</Tx>
          <Pressable onPress={() => setInfo(v => !v)} hitSlop={10} accessibilityLabel="How the indicator is calculated" style={{ width: 24, height: 24, borderRadius: 12, borderWidth: 1, borderColor: C.muted, alignItems: 'center', justifyContent: 'center' }}><Tx w={700} s={12} c={C.muted}>i</Tx></Pressable>
        </View>
        {info && <Tx s={11.5} c={C.muted} lh={1.55} style={{ marginTop: 8 }}>Each stock's price-to-book is ranked against its own 10-year history. The indicator is the share of the segment trading in the expensive half. Above 70% Qode underweights the segment (Risk OFF); below 30% it overweights (Risk ON).</Tx>}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }} style={{ marginTop: 12 }}>
          {SEGMENTS.map(([k, l]) => (
            <Pressable key={k} onPress={() => setSeg(k)} style={{ paddingVertical: 7, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1, borderColor: seg === k ? C.green : C.mutedBorder35, backgroundColor: seg === k ? C.green : 'transparent' }}>
              <Tx w={700} s={11} c={seg === k ? C.cream : C.muted}>{l}</Tx>
            </Pressable>
          ))}
        </ScrollView>
        {ind.loading && <View style={{ marginTop: 14 }}><Loading rows={1} h={H} /></View>}
        {!ind.loading && ind.err && <Tx s={12} c={C.red} style={{ marginTop: 14 }}>{/being rebuilt/i.test(ind.err) ? 'The indicator is being rebuilt. Check back shortly.' : 'We couldn’t load the indicator. Please refresh.'}</Tx>}
        {!ind.loading && !ind.err && pts.length === 0 && <Tx s={12} c={C.muted} style={{ marginTop: 14 }}>No indicator data is available right now.</Tx>}
        {pts.length > 0 && (<>
          <Tx s={12.5} style={{ marginTop: 12 }}>Latest: <Tx w={700} s={12.5}>{latest.v.toFixed(2)}%</Tx> <Tx s={11} c={C.muted}>{ddmmyyyy(latest.date)}</Tx></Tx>
          <View style={{ flexDirection: 'row', marginTop: 10 }}>
            <View style={{ width: 26, height: H, justifyContent: 'space-between' }}>
              {[100, 80, 60, 40, 20, 0].map(v => <Tx key={v} s={9} c="#37584F">{v}</Tx>)}
            </View>
            <Svg width={W} height={H + 16}>
              <Rect x={0} y={y(100)} width={W} height={y(70) - y(100)} fill="#f5bfc9" />
              <Rect x={0} y={y(70)} width={W} height={y(50) - y(70)} fill="#fee5e9" />
              <Rect x={0} y={y(50)} width={W} height={y(30) - y(50)} fill="#e5f3ef" />
              <Rect x={0} y={y(30)} width={W} height={y(0) - y(30)} fill="#bdead2" />
              <SvgText x={4} y={y(100) + 12} fontSize={10} fontWeight="600" fill="#cc0000">{`Risk OFF: Underweight ${s[1]}`}</SvgText>
              <SvgText x={4} y={y(0) - 5} fontSize={10} fontWeight="600" fill="#028a3d">{`Risk ON: Overweight ${s[1]}`}</SvgText>
              <Line x1={0} x2={W} y1={y(50)} y2={y(50)} stroke="#002017" strokeWidth={1.5} strokeDasharray="6 4" />
              <Line x1={0} x2={W} y1={y(80)} y2={y(80)} stroke="#DABD38" strokeWidth={1.2} strokeDasharray="2 3" />
              <Line x1={0} x2={W} y1={y(20)} y2={y(20)} stroke="#DABD38" strokeWidth={1.2} strokeDasharray="2 3" />
              <Path d={d} stroke="#02422B" strokeWidth={1.6} fill="none" />
              {years.map(yr => { const xx = x(Date.UTC(yr, 0, 1)); return xx >= 0 && xx <= W ? <SvgText key={yr} x={Math.min(W - 26, Math.max(0, xx))} y={H + 13} fontSize={9} fill="#37584F">{yr}</SvgText> : null; })}
            </Svg>
          </View>
          <Tx s={10.5} c={C.gray} style={{ marginTop: 8 }}>Source: Ace Equity, Qode Advisors LLP</Tx>
        </>)}
      </Card>
    </Fade>
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
          hint={message.length ? `${message.length} / 4000` : ''} style={{ marginTop: topic === 'investor' || topic === 'onboarding' ? 16 : 0 }} />
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
