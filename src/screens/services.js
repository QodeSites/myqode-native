// Services tab + request sheets. Every request posts to /api/mobile/services/* or
// /engagement/referral, which email Investor Relations and return an inquiry id.
import React, { useState, useEffect, useRef } from 'react';
import { View, Pressable, ActivityIndicator, Modal, ScrollView, TextInput, Dimensions, Platform } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { C, Tx, Amt, Card, Sheet, Field, CTA, Fade, Skel } from '../ui';
import { Plus, ChevronRight, ChevronDown, Copy, Check } from '../icons';
import { services, payments, documents, isDemo } from '../api';
import { titleCase, inr, fmtDate, fmtD } from '../adapt';
import { useLoad, useQuietRefresh, SectionLabel, AccountChips, Loading, ErrorBox } from './kit';
import { PayOnline } from './pay';
import { clean, check, LIMITS } from '../validate';
import { SetupSip } from './sip';
import { SwitchForm } from './switch';
import { ContactIRLink } from './contact';
import { track } from '../api/track';
import { dayLabel } from './pay';

import { userMessage } from '../errors';
import { statusTone, statusLabel, requestMeta, groupTypes, typeName, newRequestKey, SLOW_REQUEST, isSlow, onRequestRaised, requestRaised } from '../requests';
const STRATS = [['QAW', 'Qode All Weather'], ['QTF', 'Qode Tactical Fund'], ['QGF', 'Qode Growth Fund']];

// Withdrawals are deliberately not offered in the app (Investor Relations handles them); the API route stays.
// Add funds is the big card above this list, so it is not repeated here.
// The Support page's rows (19 Oct 2026, as the web's Support): the two direct actions, then the help pages.
const ACTION_ROWS = [
  { key: 'r-switch', title: 'Switch Strategy', sub: 'Move capital between strategies' },
  { key: 'referral', title: 'Referral Program', sub: 'Refer an investor and earn a reward', page: true },
];
const HELP_ROWS = [
  { key: 'faq', title: 'FAQs & Glossary', sub: 'Answers to common questions, and the terms we use' },
  { key: 'voice', title: 'Your Voice Matters', sub: 'Tell us how we’re doing' },
  { key: 'grievance', title: 'Escalation and Grievance Redressal', sub: 'If something isn’t resolved' },
];
const RowList = ({ V, rows }) => (
  <Card style={{ overflow: 'hidden' }}>
    {rows.map((it, i) => (
      <Pressable key={it.key} onPress={() => (it.key.startsWith('r-') ? V.openReq(it.key) : V.openPage(it.key))} style={{
        flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 16, minHeight: 52,
        borderBottomWidth: i < rows.length - 1 ? 1 : 0, borderColor: C.hairline,
      }}>
        <View style={{ flex: 1 }}>
          <Tx w={700} s={13}>{it.title}</Tx>
          <Tx s={11} c={C.muted} style={{ marginTop: 2 }}>{it.sub}</Tx>
        </View>
        <ChevronRight />
      </Pressable>
    ))}
  </Card>
);

// Support (phone, 19 Oct 2026): Past Requests with "Raise Ticket", the two actions, then the help pages.
export function SupportPage({ V }) {
  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <Tx w={700} s={10} ls={0.12} c={C.gray}>PAST REQUESTS</Tx>
        {!V.viewing && (
          <Pressable onPress={() => V.openReq('r-ticket')} accessibilityRole="button" accessibilityLabel="Raise Ticket"
            style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.green, borderRadius: 999, paddingVertical: 8, paddingHorizontal: 14 }}>
            <Plus s={12} c={C.gold} /><Tx w={700} s={11.5} c={C.gold}>RAISE TICKET</Tx>
          </Pressable>
        )}
      </View>
      <MyRequests V={V} />
      {!V.viewing && <><SectionLabel>REQUESTS</SectionLabel><RowList V={V} rows={ACTION_ROWS} /></>}
      <SectionLabel>HELP</SectionLabel>
      <RowList V={V} rows={HELP_ROWS} />
    </View>
  );
}

// Web: experience/family-account — "Raise Family Request" for a head of family, "Raise Account Request" otherwise,
// with the same examples and placeholder. The email Investor Relations receives is titled the same way.
export function accountRequest(user) {
  const head = !!(user && user.isHeadOfFamily);
  return head
    ? { title: 'Raise Family Request', sub: 'Merge accounts, reassign an owner, split into a new family group, or change the family email.',
        cta: 'RAISE FAMILY REQUEST', placeholder: 'Write your family request here (e.g., merge accounts, reassign owner, update family email)…' }
    : { title: 'Raise Account Request', sub: 'Update your email or personal details, join a family group, or change your account status.',
        cta: 'RAISE ACCOUNT REQUEST', placeholder: 'Write your account request here (e.g., update email, change personal details)…' };
}

// "What do you need help with?": a select row opening a sheet of the Zoho Desk request types grouped by category
// ("Something else" last), a text box and Submit request, which raises a Desk ticket of that type for the account
// picked on this tab (as on the web).
function HelpPicker({ V, accountId }) {
  const T = useLoad(() => services.requestTypes(), []);
  const groups = groupTypes(T.data && T.data.types);
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState(null);
  const [text, setText] = useState('');
  const [st, setSt] = useState({ busy: false, err: '', done: null });
  const reqKey = useRef(newRequestKey());   // this submission's key (kept across a resend)
  const send = async () => {
    const m = text.trim();
    // a type is needed only when there are types to choose; with none (not loaded, or none on the server) it goes as a general query
    if (!code && groups.length) return setSt({ busy: false, err: 'Choose what your request is about.', done: null });
    if (m.length < 5) return setSt({ busy: false, err: 'Please tell us a little more.', done: null });
    if (m.length > 2000) return setSt({ busy: false, err: 'Please keep it under 2000 characters.', done: null });
    if (!accountId) return setSt({ busy: false, err: 'No account to raise this for.', done: null });
    setSt({ busy: true, err: '', done: null });
    try {
      const r = await services.helpRequest({ accountId, typeCode: code || undefined, message: m, requestKey: reqKey.current });
      reqKey.current = newRequestKey();   // went through: the next request is a new one
      requestRaised();   // Past Requests on screen reloads
      track('event', 'help_request', { type: code });
      setText(''); setCode(null);
      setSt({ busy: false, err: '', done: { ticket: r && r.ticket } });
    } catch (e) { setSt({ busy: false, err: isSlow(e) ? SLOW_REQUEST : userMessage(e), done: null }); }
  };
  return (
    <View style={{ paddingVertical: 14, paddingHorizontal: 16 }}>
      <Tx w={700} s={13}>What do you need help with?</Tx>
      {st.done ? (
        <View style={{ marginTop: 10, padding: 14, borderRadius: 10, borderWidth: 1, borderColor: C.green, backgroundColor: 'rgba(2,66,43,0.06)' }}>
          <Tx w={700} s={13} c={C.green}>Request received{st.done.ticket ? ' · Ticket #' + st.done.ticket : ''}</Tx>
          <Tx s={12} c={C.muted} lh={1.5} style={{ marginTop: 5 }}>Investor Relations will get back to you within 24 hours.</Tx>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 18, marginTop: 10 }}>
            {/* in the Raise Ticket sheet on Support: close it, the ticket is in Past Requests right there */}
            <Pressable onPress={() => { V.closeSheet(); if (V.page !== 'support') V.openPage('support'); }} style={{ minHeight: 28, justifyContent: 'center' }}>
              <Tx w={700} s={12} c={C.green}>View in Past Requests ›</Tx>
            </Pressable>
            <Pressable onPress={() => setSt({ busy: false, err: '', done: null })} style={{ minHeight: 28, justifyContent: 'center' }}>
              <Tx w={700} s={12} c={C.muted}>Raise another request</Tx>
            </Pressable>
          </View>
        </View>
      ) : (
        <>
          <Pressable onPress={() => setOpen(true)} accessibilityRole="button" accessibilityLabel="What do you need help with?"
            style={{ marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: code ? C.green : C.mutedBorder35, borderRadius: 8, paddingVertical: 11, paddingHorizontal: 12 }}>
            <Tx s={13} c={code ? C.ink : C.gray} style={{ flex: 1 }}>{code ? typeName(groups, code) : 'Choose what your request is about'}</Tx>
            <ChevronDown s={11} c={C.muted} />
          </Pressable>
          <Field multiline value={text} onChangeText={t => { setText(t); if (st.err) setSt(x => ({ ...x, err: '' })); }}
            placeholder="Tell us a little more so Investor Relations can help faster…" error={st.err} hint={st.err || undefined} style={{ marginTop: 12 }} />
          <CTA label={st.busy ? 'PLEASE WAIT…' : 'SUBMIT REQUEST'} onPress={st.busy ? undefined : send} style={{ marginTop: 12, opacity: st.busy ? 0.6 : 1 }} />
        </>
      )}
      <Sheet visible={open} onClose={() => setOpen(false)}>
        <ScrollView style={{ maxHeight: Dimensions.get('window').height * 0.7 }} contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 0 }}>
          <Tx w={700} s={15} style={{ marginBottom: 6 }}>What do you need help with?</Tx>
          {!groups.length && <Tx s={13} c={C.muted} style={{ paddingVertical: 14 }}>{T.loading ? 'Loading…' : 'No categories to choose from. Just describe your request below.'}</Tx>}
          {groups.filter(g => g.label).map((g, gi, all) => (
            <View key={g.category || 'other'}>
              {/* no line under the last row: the pinned Something else row brings its own */}
              {g.items.map((t, ti) => (
                <Pressable key={t.code} onPress={() => { setCode(t.code); setOpen(false); if (st.err) setSt(x => ({ ...x, err: '' })); }}
                  style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: gi === all.length - 1 && ti === g.items.length - 1 ? 0 : 1, borderColor: C.hairline }}>
                  <Tx w={t.code === code ? 700 : 400} s={13.5} c={t.code === code ? C.green : C.ink} style={{ flex: 1 }}>{t.name}</Tx>
                  {t.code === code && <Check s={15} />}
                </Pressable>
              ))}
            </View>
          ))}
        </ScrollView>
        {/* "Something else" (I6) stays in view under the list */}
        {groups.filter(g => !g.label).flatMap(g => g.items).map(t => (
          <Pressable key={t.code} onPress={() => { setCode(t.code); setOpen(false); if (st.err) setSt(x => ({ ...x, err: '' })); }}
            style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 14, marginHorizontal: 20, marginBottom: 10, borderTopWidth: 1, borderColor: C.mutedBorder35 }}>
            <Tx w={t.code === code ? 700 : 600} s={13.5} c={C.green} style={{ flex: 1 }}>{t.name}</Tx>
            {t.code === code ? <Check s={15} /> : <ChevronRight />}
          </Pressable>
        ))}
      </Sheet>
    </View>
  );
}

export function ServicesCream({ V }) {
  // Activity lives in one place with a switch, instead of three sections stacked under each other:
  // ONLINE & SIPs (Razorpay orders + SIP mandates, per account) | TRANSACTIONS (every cash movement).
  const opts = V.acctOptions;
  const [sel, setSel] = useState(null);
  const accountId = sel && opts.some(o => o.id === sel) ? sel : opts[0] && opts[0].id;
  const inv = useLoad(() => (accountId ? Promise.all([payments.investmentStatus(accountId), services.transactions(accountId)]) : Promise.resolve(null)), [accountId, V.rk]);
  const status = !inv.loading && inv.data ? inv.data[0] : null;
  const all = status ? [...(status.active || []), ...(status.completed || [])] : [];
  const n = x => (inv.loading ? '…' : String(x));
  return (
    <Fade>
      <Pressable onPress={V.openAdd} style={{ marginTop: -34 }}>
        <Card big style={{ paddingVertical: 16, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <View style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: C.green }}><Plus s={18} /></View>
          <View style={{ flex: 1 }}>
            <Tx w={700} s={13}>Add funds</Tx>
            <Tx s={11} c={C.muted} style={{ marginTop: 2 }}>One-time online payment, SIP, or bank transfer</Tx>
          </View>
          <ChevronRight />
        </Card>
      </Pressable>

      <SectionLabel>ONLINE PAYMENTS AND SIPs</SectionLabel>
      <Investments V={V} opts={opts} accountId={accountId} onPickAccount={setSel} inv={inv} all={all} />
      <Pressable onPress={V.goServicesTx} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12, marginLeft: 2 }}>
        <Tx w={700} s={11.5} c={C.green}>Bank transfers and redemptions are under Transactions</Tx><ChevronRight />
      </Pressable>
      <Tx s={11} c={C.gray} style={{ marginTop: 14, marginLeft: 2 }}>As of {V.asOf}</Tx>
    </Fade>
  );
}

// Status pill for a request: Zoho's own label, coloured by state (src/requests.js).
const PILL = { warn: ['rgba(218,189,56,0.18)', '#7A5D00'], bad: ['rgba(239,68,68,0.12)', C.red], ok: ['rgba(2,66,43,0.10)', C.green], neutral: ['rgba(55,88,79,0.10)', C.muted] };
function StatusPill({ r }) {
  if (!statusLabel(r)) return null;
  const [bg, fg] = PILL[statusTone(r)] || PILL.neutral;
  return (
    <View style={{ backgroundColor: bg, borderRadius: 999, paddingVertical: 4, paddingHorizontal: 10 }}>
      <Tx w={700} s={10.5} c={fg}>{statusLabel(r)}</Tx>
    </View>
  );
}
// Past Requests' loading skeleton: rows shaped like the requests (title and status pill, detail, meta line), pulsing.
function RequestSkeleton({ rows = 4 }) {
  const bar = { backgroundColor: 'rgba(55,88,79,0.12)' };
  return (
    <View accessibilityLabel="Loading your requests">
      {Array.from({ length: rows }, (_, i) => (
        <View key={i} style={{ paddingVertical: 13, paddingHorizontal: 16, borderBottomWidth: i < rows - 1 ? 1 : 0, borderColor: C.hairline }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <Skel h={14} style={[bar, { width: ['42%', '30%', '50%', '36%'][i % 4], borderRadius: 4 }]} />
            <Skel h={20} style={[bar, { width: 64, borderRadius: 999 }]} />
          </View>
          <Skel h={12} style={[bar, { width: ['68%', '55%', '74%', '48%'][i % 4], marginTop: 9, borderRadius: 4 }]} />
          <Skel h={10} style={[bar, { width: '28%', marginTop: 8, borderRadius: 4 }]} />
        </View>
      ))}
    </View>
  );
}

// My Requests (its own page, from the Services tab): everything the client raised, with its live status in Zoho
// (services.requests). Reloads with the tab (V.rk).
export function MyRequests({ V }) {
  const L = useLoad(() => services.requests(), [V.rk]);
  useEffect(() => onRequestRaised(() => L.reload()), []);   // a ticket raised from the sheet shows at once
  const data = useQuietRefresh(() => services.requests(), L.data);   // statuses changed meanwhile, every 30 s
  const list = (data && data.requests) || [];
  if (L.loading) return <Card style={{ overflow: 'hidden' }}><RequestSkeleton /></Card>;
  if (L.err) return <Card style={{ padding: 16 }}><Tx s={12} c={C.muted}>We couldn’t load your requests just now.</Tx></Card>;
  if (!list.length) return <Card style={{ padding: 16 }}><Tx s={12} c={C.muted}>Nothing raised yet. Requests you make here show up with their status.</Tx></Card>;
  return (
    <Card style={{ overflow: 'hidden' }}>
      {list.map((r, i) => (
        <View key={r.id} style={{ paddingVertical: 13, paddingHorizontal: 16, borderBottomWidth: i < list.length - 1 ? 1 : 0, borderColor: C.hairline }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Tx w={700} s={13} style={{ flex: 1 }}>{r.title}</Tx>
            <StatusPill r={r} />
          </View>
          {!!r.detail && <Tx s={11.5} c={C.ink} lh={1.45} style={{ marginTop: 3 }}>{r.detail}</Tx>}
          <Tx s={10.5} c={C.muted} style={{ marginTop: 4 }}>{requestMeta(r)}</Tx>
        </View>
      ))}
    </Card>
  );
}

// Pill switch, same look as the Add Funds sheet's mode toggle.
function Segment({ value, onPick, options }) {
  return (
    <View style={{ flexDirection: 'row', borderWidth: 1, borderColor: 'rgba(55,88,79,0.25)', borderRadius: 999, padding: 3, marginBottom: 12 }}>
      {options.map(([k, l]) => (
        <Pressable key={k} onPress={() => onPick(k)} style={{ flex: 1, paddingVertical: 9, borderRadius: 999, alignItems: 'center', backgroundColor: value === k ? C.green : 'transparent' }}>
          <Tx w={700} s={10.5} ls={0.04} c={value === k ? C.gold : C.muted}>{l}</Tx>
        </Pressable>
      ))}
    </View>
  );
}

// Transactions — contributions & withdrawals (bank transfers, redemptions): first few rows, then "show all".
// Received but not in Nuvama's data yet (Razorpay, Zoho Capital Inflows, admin entries): listed above the
// confirmed transactions until the real one appears, so a client never wonders where their money went.
export function PendingRows({ V }) {
  const list = V.inFlight || [];
  if (!list.length) return null;
  return (
    <Card style={{ overflow: 'hidden', marginBottom: 12, borderLeftWidth: 3, borderLeftColor: C.gold }}>
      {list.map((it, i) => (
        <View key={it.orderId} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13, paddingHorizontal: 16, borderBottomWidth: i < list.length - 1 ? 1 : 0, borderColor: C.hairline }}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Tx w={700} s={13}>Money received</Tx>
              <View style={{ backgroundColor: 'rgba(218,189,56,0.18)', borderRadius: 999, paddingHorizontal: 7, paddingVertical: 2 }}><Tx w={700} s={9.5} ls={0.06} c={C.green}>PENDING</Tx></View>
            </View>
            <Tx s={11} c={C.muted} style={{ marginTop: 2 }} numberOfLines={2}>Invested {dayLabel(it.deployOn)} · in your portfolio {dayLabel(it.visibleOn)}{it.strategy ? ' · ' + it.strategy : ''}</Tx>
          </View>
          <Amt s={13} c={C.green}>+{inr(it.amount)}</Amt>
        </View>
      ))}
    </Card>
  );
}

export function CashList({ V, full }) {
  return <><PendingRows V={V} /><CashListConfirmed V={V} full={full} /></>;
}

function CashListConfirmed({ V, full }) {
  const [showAll, setShowAll] = useState(!!full);
  const rows = showAll ? V.txAll : V.txAll.slice(0, 5);
  const foldable = V.txAll.length > 5;
  if (!V.hasTx) {
    return (
      <Card style={{ padding: 18 }}>
        <Tx s={12.5} c={C.muted} lh={1.6} center>No transactions recorded yet.</Tx>
      </Card>
    );
  }
  return (
    <Card style={{ overflow: 'hidden' }}>
      {rows.map((t, i) => (
        <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13, paddingHorizontal: 16, borderBottomWidth: i < rows.length - 1 || foldable ? 1 : 0, borderColor: C.hairline }}>
          <View style={{ flex: 1 }}>
            <Tx w={700} s={13}>{t.title}</Tx>
            <Tx s={11} c={C.muted} style={{ marginTop: 2 }}>{t.sub}</Tx>
          </View>
          <Amt s={13} c={t.color}>{t.amt}</Amt>
        </View>
      ))}
      {foldable && (
        <Pressable onPress={() => setShowAll(v => !v)} style={{ alignItems: 'center', paddingVertical: 12 }}>
          <Tx w={700} s={11} ls={0.08} c={C.green}>{showAll ? 'SHOW FEWER' : 'SHOW ALL ' + V.txAll.length}</Tx>
        </Pressable>
      )}
    </Card>
  );
}

// Online investments (Razorpay orders and SIP mandates) from payments/investment-status
// and services/transactions. Pause/resume/cancel call the SIP routes.
function Investments({ V, opts, accountId, onPickAccount, inv, all }) {
  const [act, setAct] = useState({ busy: '', msg: '', err: '' });
  const [kind, setKind] = useState('all');   // all | one-time | sip
  const [open, setOpen] = useState({});      // orderId → expanded? (default: live ones open, finished ones folded)
  const items = all
    .filter(it => kind === 'all' || (kind === 'sip') === (it.paymentType === 'SIP'))
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  const when = iso => { const d = new Date(iso); return isNaN(d) ? '' : d.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).replace(/\bSept\b/, 'Sep'); };
  const counts = { all: all.length, 'one-time': all.filter(i => i.paymentType !== 'SIP').length, sip: all.filter(i => i.paymentType === 'SIP').length };
  const isOpen = it => (it.orderId in open ? open[it.orderId] : !it.isTerminal);

  const sipAction = async (it, action) => {
    if (act.busy) return;
    setAct({ busy: it.orderId, msg: '', err: '' });
    try {
      const r = action === 'cancel' ? await services.cancelSip(it.orderId, accountId) : await services.pauseResumeSip(it.orderId, accountId, action);
      setAct({ busy: '', msg: (r && r.message) || 'Done.', err: '' });
      inv.reload();
    } catch (e) { setAct({ busy: '', msg: '', err: userMessage(e) }); }
  };

  return (
    <>
      {opts.length > 1 && <View style={{ marginTop: -4, marginBottom: 12 }}><AccountChips options={opts} value={accountId} onPick={onPickAccount} /></View>}
      {inv.loading && (
        <Card style={{ padding: 22, alignItems: 'center' }}>
          <ActivityIndicator color={C.green} />
          <Tx s={12} c={C.muted} style={{ marginTop: 10 }}>Checking your online payments and SIPs…</Tx>
        </Card>
      )}
      {!inv.loading && !!inv.err && <ErrorBox msg={inv.err} onRetry={inv.reload} />}
      {!inv.loading && inv.data && all.length === 0 && (
        <Card style={{ padding: 18, alignItems: 'center' }}>
          <Tx w={700} s={13} center>No online payments or SIPs yet</Tx>
          <Tx s={12} c={C.muted} lh={1.6} center style={{ marginTop: 6 }}>Bank transfers appear under Transactions. Use Add Funds to pay online or set up a SIP.</Tx>
          <CTA label="ADD FUNDS" onPress={V.openAdd} style={{ marginTop: 14, alignSelf: 'stretch', paddingVertical: 12 }} />
        </Card>
      )}
      {!inv.loading && all.length > 0 && (
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
          {[['all', 'All'], ['one-time', 'One-time'], ['sip', 'SIP']].map(([k, l]) => (
            <Pressable key={k} onPress={() => setKind(k)} style={{ flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: kind === k ? C.green : C.mutedBorder35, backgroundColor: kind === k ? C.green : 'transparent' }}>
              <Tx w={700} s={11} c={kind === k ? C.cream : C.muted}>{l} · {counts[k]}</Tx>
            </Pressable>
          ))}
        </View>
      )}
      {!inv.loading && all.length > 0 && items.length === 0 && (
        <Card style={{ padding: 18 }}><Tx s={12.5} c={C.muted} center>Nothing of this type yet.</Tx></Card>
      )}
      {!inv.loading && items.map(it => {
        const sip = it.paymentType === 'SIP', st = it.investmentStatus || '';
        // Razorpay can pause only a subscription whose first instalment has been charged (`active`); one that
        // is only `authenticated` (mandate registered, first charge ahead) can be cancelled but not paused.
        // SIP_AUTHORISED = mandate registered, first instalment ahead (cancel only);
        // SIP_ACTIVE = charged at least once (pause available).
        const canPause = sip && st === 'SIP_ACTIVE', canResume = sip && st === 'SIP_PAUSED';
        const canCancel = sip && !it.isTerminal;
        const charges = sip ? (it.chargeHistory || (it.sip && it.sip.charges) || []) : [];
        const exp = isOpen(it);
        const nd = it.nextChargeDate || (it.sip && it.sip.nextChargeDate);
        const next = nd ? fmtDate(nd) : '';
        return (
          <Card key={it.orderId} style={{ marginBottom: 10, borderLeftWidth: 3, borderLeftColor: it.statusColor || C.gold, overflow: 'hidden' }}>
            <Pressable onPress={() => setOpen(o => ({ ...o, [it.orderId]: !exp }))} style={{ padding: 14 }}>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 10 }}>
                <Tx w={700} s={13} style={{ flex: 1 }}>{sip ? 'SIP · ' + titleCase((it.sip && it.sip.frequency) || it.frequency || '') : it.isNewStrategy ? 'New strategy' : 'One-time investment'}</Tx>
                <Amt s={14}>{inr(Number(it.amount || 0))}</Amt>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 }}>
                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: it.statusColor || C.gold }} />
                <Tx w={700} s={11} c={C.muted} numberOfLines={1} style={{ flex: 1 }}>
                  {it.statusLabel || titleCase(String(st || '').replace(/_/g, ' '))}
                  {!!next && <Tx s={11} c={C.gray}>{'  · next ' + next}</Tx>}
                  {charges.length > 0 && <Tx s={11} c={C.gray}>{'  · ' + charges.length + (charges.length === 1 ? ' instalment' : ' instalments')}</Tx>}
                </Tx>
                <View style={{ transform: [{ rotate: exp ? '180deg' : '0deg' }] }}><ChevronDown s={11} c={C.muted} /></View>
              </View>
            </Pressable>
            {exp && (
              <View style={{ paddingHorizontal: 14, paddingBottom: 14 }}>
                {!!it.statusMessage && <Tx s={11.5} c={C.muted} lh={1.5}>{it.statusMessage}</Tx>}
                {Array.isArray(it.timeline) && it.timeline.length > 0 && (
                  <View style={{ flexDirection: 'row', gap: 6, marginTop: 10 }}>
                    {it.timeline.map((t, i) => (
                      <View key={i} style={{ flex: 1 }}>
                        <View style={{ height: 3, borderRadius: 2, backgroundColor: t.done || t.completed ? C.green : 'rgba(55,88,79,0.18)' }} />
                        <Tx s={9} c={C.muted} numberOfLines={1} style={{ marginTop: 4 }}>{t.label || t.step || t.status}</Tx>
                      </View>
                    ))}
                  </View>
                )}
                <Tx s={10.5} c={C.gray} style={{ marginTop: 8 }}>{sip ? 'Set up ' : 'Placed '}{when(it.createdAt)}{it.paymentTime ? ' · paid ' + when(it.paymentTime) : ''}</Tx>
                {/* subscription id: development builds only */}
                {__DEV__ && sip && <Tx s={10} c={C.gray} style={{ marginTop: 2 }}>Ref {it.orderId}</Tx>}
                {charges.length > 0 && (
                  <View style={{ marginTop: 10, borderTopWidth: 1, borderColor: C.hairline, paddingTop: 8 }}>
                    <Tx w={700} s={10} ls={0.1} c={C.muted}>INSTALMENTS</Tx>
                    {charges.map((ch, i) => (
                      <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 }}>
                        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: ch.status === 'SUCCESS' ? C.pos : ch.status === 'FAILED' ? C.red : C.gold }} />
                        <Tx s={11} c={C.muted} style={{ flex: 1 }}>{ch.installmentNumber ? '#' + ch.installmentNumber + ' · ' : ''}{when(ch.paidAt || ch.chargeDate)}</Tx>
                        <Amt s={11.5}>{inr(Number(ch.amount || 0))}</Amt>
                        <Tx w={700} s={9.5} c={ch.status === 'SUCCESS' ? C.pos : ch.status === 'FAILED' ? C.red : C.muted}>{({ SUCCESS: 'PAID', FAILED: 'FAILED' })[ch.status] || String(ch.status || '').replace(/_/g, ' ')}</Tx>
                      </View>
                    ))}
                  </View>
                )}
                {(canPause || canResume || canCancel) && (
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
                    {canPause && <CTA label={act.busy === it.orderId ? '…' : 'PAUSE'} outline onPress={() => sipAction(it, 'pause')} style={{ flex: 1, paddingVertical: 11 }} />}
                    {canResume && <CTA label={act.busy === it.orderId ? '…' : 'RESUME'} outline onPress={() => sipAction(it, 'resume')} style={{ flex: 1, paddingVertical: 11 }} />}
                    {canCancel && <CTA label={act.busy === it.orderId ? '…' : 'CANCEL SIP'} outline onPress={() => sipAction(it, 'cancel')} style={{ flex: 1, paddingVertical: 11 }} />}
                  </View>
                )}
              </View>
            )}
          </Card>
        );
      })}
      {!!act.err && <Tx s={12} c={C.red} lh={1.45} style={{ marginBottom: 10 }}>{act.err}</Tx>}
      {!!act.msg && <Tx s={12} c={C.green} style={{ marginBottom: 10 }}>{act.msg}</Tx>}
      {!inv.loading && all.length > 0 && (
        <Tx s={11} c={C.gray} lh={1.5} style={{ marginTop: 2, marginLeft: 2 }}>Tap a card for details. Use Add Funds for a new payment or SIP.</Tx>
      )}
    </>
  );
}

function Shell({ V, title, sub, children }) {
  return (
    <Sheet visible onClose={V.closeSheet}>
      <View style={{ paddingHorizontal: 22, paddingTop: 12, paddingBottom: 24 }}>
        <Tx f="play" w={600} s={21}>{title}</Tx>
        {!!sub && <Tx s={12} c={C.muted} lh={1.5} style={{ marginTop: 3 }}>{sub}</Tx>}
        {children}
      </View>
    </Sheet>
  );
}

const Lbl = ({ children }) => <Tx w={700} s={10} ls={0.12} c={C.gray} style={{ marginTop: 18 }}>{children}</Tx>;

export const FORMS = {
  'r-strategy': {
    title: 'Ask About a Strategy', sub: 'Your question goes straight to the investment team.', cta: 'SEND QUESTION',
    fields: [{ k: 'q', label: 'YOUR QUESTION', kind: 'multiline', validate: x => check.text(x, { min: 10, what: 'your question' }) }],
    submit: (a, v) => services.strategyInquiry({ accountId: a, question: v.q.trim() }),
  },
  'r-discussion': {
    title: 'Raise Any Query', sub: 'Tell us your question or what you need help with. Investor Relations will get back to you within 24 hours.', cta: 'RAISE ANY QUERY',
    fields: [{ k: 't', label: 'TOPIC', kind: 'multiline', validate: x => check.text(x, { min: 5, what: 'the topic' }) }],
    submit: (a, v) => services.discussion({ accountId: a, topic: v.t.trim() }),
  },
  'r-account': {
    // title / sub / cta / placeholder come from accountRequest() — they depend on the signed-in user's role
    fields: [{ k: 'm', label: 'YOUR REQUEST', kind: 'multiline', validate: x => check.text(x, { min: 10, what: 'your request' }) }],
    submit: (a, v) => services.accountRequest({ accountId: a, message: v.m.trim() }),
  },
  // Documents tab → "Request document" (app addition: the web's document vault only lists what is there).
  'r-document': {
    title: 'Request a Document', sub: 'Tell us which document you need. Investor Relations will share it with you by email.', cta: 'SEND REQUEST',
    fields: [
      { k: 'category', label: 'WHICH DOCUMENT?', kind: 'choice', options: [['pms-agreement', 'PMS Agreement'], ['account-opening', 'Account opening'], ['cml', 'CML'], ['other', 'Something else']],
        validate: x => (x ? '' : 'Choose the document you need.') },
      { k: 'm', label: 'NOTE (OPTIONAL)', kind: 'multiline', max: 1000, placeholder: 'Anything that helps us find it — e.g. the year, or the exact document name',
        validate: (x, v) => (v.category === 'other' && String(x || '').trim().length < 5 ? 'Tell us which document you need.' : String(x || '').length > 1000 ? 'Please keep the note under 1000 characters.' : '') },
    ],
    submit: (a, v) => documents.request({ accountId: a, category: v.category, message: (v.m || '').trim() || undefined }),
  },
};

// Country codes for a phone field (India first, then the countries Qode's NRI investors most often call from).
const COUNTRIES = [
  ['+91', 'India', '🇮🇳'], ['+971', 'United Arab Emirates', '🇦🇪'], ['+1', 'United States / Canada', '🇺🇸'], ['+44', 'United Kingdom', '🇬🇧'],
  ['+65', 'Singapore', '🇸🇬'], ['+61', 'Australia', '🇦🇺'], ['+966', 'Saudi Arabia', '🇸🇦'], ['+974', 'Qatar', '🇶🇦'], ['+968', 'Oman', '🇴🇲'],
  ['+965', 'Kuwait', '🇰🇼'], ['+973', 'Bahrain', '🇧🇭'], ['+852', 'Hong Kong', '🇭🇰'], ['+60', 'Malaysia', '🇲🇾'], ['+49', 'Germany', '🇩🇪'],
  ['+31', 'Netherlands', '🇳🇱'], ['+41', 'Switzerland', '🇨🇭'], ['+33', 'France', '🇫🇷'], ['+81', 'Japan', '🇯🇵'], ['+64', 'New Zealand', '🇳🇿'],
  ['+353', 'Ireland', '🇮🇪'], ['+27', 'South Africa', '🇿🇦'], ['+254', 'Kenya', '🇰🇪'], ['+94', 'Sri Lanka', '🇱🇰'], ['+977', 'Nepal', '🇳🇵'],
  ['+880', 'Bangladesh', '🇧🇩'], ['+92', 'Pakistan', '🇵🇰'], ['+62', 'Indonesia', '🇮🇩'], ['+66', 'Thailand', '🇹🇭'], ['+63', 'Philippines', '🇵🇭'],
];
export function CountryCode({ value, onPick, error }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const cur = COUNTRIES.find(c => c[0] === value) || COUNTRIES[0];
  const needle = q.trim().toLowerCase();
  const list = needle ? COUNTRIES.filter(c => c[1].toLowerCase().includes(needle) || c[0].includes(needle)) : COUNTRIES;
  return (
    <>
      <Pressable onPress={() => { setQ(''); setOpen(true); }} accessibilityRole="button" accessibilityLabel={`Country code ${cur[0]} ${cur[1]}. Change`}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 8, paddingRight: 8, borderBottomWidth: error ? 1.5 : 1, borderColor: error ? C.red : C.mutedBorder }}>
        <Tx s={15}>{cur[2]}</Tx>
        <Tx w={700} s={14}>{cur[0]}</Tx>
        <ChevronDown s={9} c={C.muted} />
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable onPress={() => setOpen(false)} style={{ flex: 1, backgroundColor: 'rgba(0,32,23,0.45)', justifyContent: 'center', padding: 24 }}>
          {/* a compact, centred box (not the whole page on the web): 380 wide at most, the list scrolling inside */}
          <Pressable onPress={() => {}} style={{ width: '100%', maxWidth: 380, maxHeight: Math.min(520, Dimensions.get('window').height * 0.75), alignSelf: 'center' }}>
            <Card style={{ paddingVertical: 6, overflow: 'hidden', flexShrink: 1 }}>
              <Tx w={700} s={10} ls={0.12} c={C.muted} style={{ paddingHorizontal: 18, paddingTop: 10 }}>COUNTRY CODE</Tx>
              <View style={{ marginHorizontal: 18, marginTop: 8, marginBottom: 4, borderBottomWidth: 1, borderColor: C.mutedBorder }}>
                <TextInput value={q} onChangeText={setQ} placeholder="Search country or code" placeholderTextColor={C.gray} autoCorrect={false} style={{ paddingVertical: 8, fontSize: 14, color: C.ink, ...(Platform.OS === 'web' ? { outlineStyle: 'none' } : null),}} />
              </View>
              <ScrollView keyboardShouldPersistTaps="handled" style={{ flexShrink: 1 }}>
                {list.map(([code, name, flag]) => {
                  const on = code === cur[0];
                  return (
                    <Pressable key={code + name} onPress={() => { onPick(code); setOpen(false); }} accessibilityRole="button" accessibilityState={{ selected: on }}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 11, paddingHorizontal: 18, borderTopWidth: 1, borderColor: C.hairline, backgroundColor: on ? 'rgba(2,66,43,0.06)' : 'transparent' }}>
                      <Tx s={16}>{flag}</Tx>
                      <Tx w={on ? 700 : 400} s={13} c={on ? C.green : C.ink} style={{ flex: 1 }}>{name}</Tx>
                      <Tx w={700} s={12.5} c={C.muted}>{code}</Tx>
                    </Pressable>
                  );
                })}
                {list.length === 0 && <Tx s={12} c={C.muted} center style={{ padding: 16 }}>No country matches “{q}”.</Tx>}
              </ScrollView>
            </Card>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

export function FormBody({ cfg, opts, onDone, doneLabel = 'DONE' }) {
  const [acct, setAcct] = useState(cfg.initAccount && opts.some(o => o.id === cfg.initAccount) ? cfg.initAccount : opts[0] && opts[0].id);
  const [v, setV] = useState(cfg.init || {});
  const [st, setSt] = useState({ busy: false, err: '', ref: null });
  const [errs, setErrs] = useState({});   // field → message, shown under the field
  const set = (k, val) => { setV(p => ({ ...p, [k]: val })); if (errs[k]) setErrs(e => ({ ...e, [k]: '' })); };
  // What typing may put into a field of each kind (letters never reach a phone field, etc.)
  const ccOf = f => v[f.k + 'Cc'] || '+91';   // a phone field's country code lives beside it in the form values
  const tidy = (f, t) => (f.kind === 'phone' ? clean.phoneIntl(t, ccOf(f)) : f.kind === 'email' ? clean.email(t) : f.kind === 'name' ? clean.name(t)
    : clean.text(t, f.max || (f.kind === 'multiline' ? LIMITS.message : LIMITS.name)));

  const submit = async () => {
    if (st.busy) return;
    // Per-field rules first (each field's own `validate`), then the form's cross-field check.
    const fe = {};
    cfg.fields.forEach(f => { const m = f.validate ? f.validate(v[f.k], v) : ''; if (m) fe[f.k] = m; });
    setErrs(fe);
    const bad = Object.values(fe)[0] || (cfg.check ? cfg.check(v) : '');
    // A field's own message already shows under that field — the form-level line only adds what isn't there:
    // a summary when several fields are wrong, or the cross-field check.
    const nFe = Object.keys(fe).length;
    if (bad) return setSt({ busy: false, err: nFe > 1 ? 'Please fix the highlighted fields.' : nFe === 1 ? '' : bad, ref: null });
    setSt({ busy: true, err: '', ref: null });
    try {
      const r = await cfg.submit(acct, v);
      track('event', cfg.event || 'request_submitted', { kind: cfg.title || 'request' });
      setSt({ busy: false, err: '', ref: String((r && r.inquiry_id) || '') });
    } catch (e) { setSt({ busy: false, err: userMessage(e), ref: null }); }
  };

  if (st.ref !== null) {
    return (
      <View style={{ alignItems: 'center', paddingVertical: 18 }}>
        <View style={{ width: 52, height: 52, borderRadius: 26, borderWidth: 1.5, borderColor: C.green, alignItems: 'center', justifyContent: 'center' }}><Check s={22} w={2.4} /></View>
        <Tx w={700} s={15} style={{ marginTop: 14 }}>Request received</Tx>
        <Tx s={12.5} c={C.muted} lh={1.6} center style={{ marginTop: 8 }}>Our Investor Relations team will get back to you shortly.</Tx>
        {!!st.ref && <Tx s={11} c={C.gray} style={{ marginTop: 10 }}>Reference {st.ref}</Tx>}
        <CTA label={doneLabel} onPress={onDone} style={{ marginTop: 20, alignSelf: 'stretch' }} />
      </View>
    );
  }
  return (
    <View>
      {opts.length > 1 && cfg.account !== false && <><Lbl>ACCOUNT</Lbl><AccountChips options={opts} value={acct} onPick={setAcct} /></>}
      {cfg.fields.map(f => (
        <View key={f.k}>
          {f.kind === 'strat' ? (
            <>
              <Lbl>{f.label}</Lbl>
              <AccountChips options={STRATS.map(s => ({ id: s[0], label: s[1] }))} value={v[f.k]} onPick={x => set(f.k, x)} />
            </>
          ) : f.kind === 'choice' ? (
            <>
              <Lbl>{f.label}</Lbl>
              <AccountChips options={f.options.map(([id, label]) => ({ id, label }))} value={v[f.k]} onPick={x => set(f.k, x)} />
              {!!errs[f.k] && <Tx s={11} c={C.red} style={{ marginTop: 6 }}>{errs[f.k]}</Tx>}
            </>
          ) : f.kind === 'phone' ? (
            <View style={{ marginTop: 18 }}>
              <Tx w={700} s={10} ls={0.12} c={C.gray}>{f.label}</Tx>
              <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 10 }}>
                <CountryCode value={ccOf(f)} error={!!errs[f.k]} onPick={code => { set(f.k + 'Cc', code); set(f.k, clean.phoneIntl(v[f.k], code)); }} />
                <Field value={v[f.k] || ''} onChangeText={t => set(f.k, tidy(f, t))} keyboardType="number-pad" placeholder={f.placeholder}
                  maxLength={ccOf(f) === '+91' ? 10 : 15} error={errs[f.k]} hint={f.hint} style={{ flex: 1 }} />
              </View>
            </View>
          ) : f.kind === 'amount' ? (
            <Field label={f.label} value={v[f.k] ? v[f.k].toLocaleString('en-IN') : ''}
              onChangeText={t => set(f.k, parseInt(t.replace(/\D/g, '') || '0', 10))} numeric s={24} prefix="₹" style={{ marginTop: 18 }} />
          ) : (
            <Field label={f.label} value={v[f.k] || ''} onChangeText={t => set(f.k, tidy(f, t))} multiline={f.kind === 'multiline'}
              keyboardType={f.kind === 'email' ? 'email-address' : f.kind === 'phone' ? 'number-pad' : undefined}
              autoCapitalize={f.kind === 'email' ? 'none' : f.kind === 'name' ? 'words' : undefined}
              placeholder={f.placeholder}
              maxLength={f.kind === 'phone' ? 10 : f.max || (f.kind === 'multiline' ? LIMITS.message : f.kind === 'email' ? LIMITS.email : LIMITS.name)}
              error={errs[f.k]} hint={f.kind === 'multiline' && (v[f.k] || '').length > 0 ? `${(v[f.k] || '').length} / ${f.max || LIMITS.message}` : f.hint}
              style={{ marginTop: 18 }} />
          )}
        </View>
      ))}
      {!!st.err && <Tx s={12} c={C.red} lh={1.45} style={{ marginTop: 14 }}>{st.err}</Tx>}
      <CTA label={st.busy ? 'PLEASE WAIT…' : cfg.cta} onPress={submit} style={{ marginTop: 22, opacity: st.busy ? 0.6 : 1 }} />
    </View>
  );
}

function CopyRow({ k, v, last }) {
  const [done, setDone] = useState(false);
  return (
    <Pressable onPress={() => { Clipboard.setStringAsync(String(v)).catch(() => {}); setDone(true); setTimeout(() => setDone(false), 1500); }}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, borderBottomWidth: last ? 0 : 1, borderColor: C.hairline }}>
      <View style={{ flex: 1 }}>
        <Tx w={700} s={9.5} ls={0.1} c={C.muted}>{k}</Tx>
        <Tx w={700} s={13} style={{ marginTop: 3 }}>{v}</Tx>
      </View>
      {done ? <Tx w={700} s={10} c={C.green}>COPIED</Tx> : <Copy />}
    </Pressable>
  );
}

function AddFunds({ V }) {
  const bank = useLoad(() => services.bankDetails(), []);
  // Same values the server returns (and the web's Account Services page shows) — shown at once, replaced by the API answer
  const b = bank.data || (!bank.err && !isDemo() ? { payableTo: 'Qode Advisors LLP', accountNumber: '43377275922', bank: 'SBI Bank – Corporate Account Group Branch', ifsc: 'SBIN0009995', micr: '40000213' } : null);
  const rec = V.payRecover;   // set by main.js when an order / SIP was in the browser and the app reloaded
  const [mode, setMode] = useState(rec && rec.kind === 'sip' ? 'sip' : 'online');
  const subs = { online: 'Top up your investment with a one-time online payment.', sip: 'Set up a recurring investment: authorise once, Razorpay debits automatically on schedule.', bank: 'Transfer from your registered bank account by NEFT, RTGS or IMPS using the details below.' };
  return (
    <Shell V={V} title="Add funds" sub={subs[mode]}>
      <View style={{ marginTop: 14, flexDirection: 'row', borderWidth: 1, borderColor: 'rgba(55,88,79,0.25)', borderRadius: 999, padding: 3 }}>
        {[['online', 'ADD FUNDS'], ['sip', 'SET UP SIP'], ['bank', 'BANK TRANSFER']].map(([k, l]) => (
          <Pressable key={k} onPress={() => setMode(k)} style={{ flex: 1, paddingVertical: 8, borderRadius: 999, alignItems: 'center', backgroundColor: mode === k ? C.green : 'transparent' }}>
            <Tx w={700} s={10.5} ls={0.04} c={mode === k ? C.gold : C.muted}>{l}</Tx>
          </Pressable>
        ))}
      </View>
      {mode === 'online' && <PayOnline V={V} recover={rec && rec.kind !== 'sip' ? rec : null} onDone={() => { if (V.bumpRefresh) V.bumpRefresh(); if (V.reloadInFlight) V.reloadInFlight(); }} />}
      {mode === 'sip' && <SetupSip V={V} recover={rec && rec.kind === 'sip' ? rec : null} onDone={() => V.bumpRefresh && V.bumpRefresh()} />}
      {mode === 'bank' && <>
      {bank.loading && !b && <View style={{ marginTop: 16 }}><Loading rows={2} h={56} /></View>}
      {!!bank.err && <View style={{ marginTop: 16 }}><ErrorBox msg={bank.err} onRetry={bank.reload} /></View>}
      {b && (
        <View style={{ marginTop: 14, borderWidth: 1, borderColor: 'rgba(55,88,79,0.2)', borderRadius: 8, paddingHorizontal: 14 }}>
          <CopyRow k="PAYABLE TO" v={b.payableTo} />
          <CopyRow k="ACCOUNT NUMBER" v={b.accountNumber} />
          <CopyRow k="BANK" v={b.bank} />
          <CopyRow k="IFSC" v={b.ifsc} />
          <CopyRow k="MICR" v={b.micr} last />
        </View>
      )}
      <Tx s={11} c={C.gray} lh={1.5} style={{ marginTop: 14 }}>Please transfer only from your registered bank account and inform Investor Relations after the transfer.</Tx>
      <CTA label="DONE" onPress={V.closeSheet} style={{ marginTop: 18 }} />
      </>}
    </Shell>
  );
}

export function RequestSheets({ V }) {
  const k = V.sheet;
  if (k === 'r-add') return <AddFunds V={V} />;
  if (k === 'r-ticket') {
    const first = (V.acctOptions || [])[0];
    return (
      <Shell V={V} title="Raise a request" sub="Choose what it is about and tell us a little more. Investor Relations will get back to you within 24 hours.">
        <HelpPicker V={V} accountId={first && first.id} />
      </Shell>
    );
  }
  if (k === 'r-switch') {
    return (
      <Shell V={V} title="Switch strategy" sub="Tell us where you'd like to move your investment. Our team will confirm the details with you.">
        <SwitchForm onClose={V.closeSheet} preferName={V.acctName} />
      </Shell>
    );
  }
  let cfg = FORMS[k];
  if (!cfg) return null;
  if (k === 'r-account') {
    const r = accountRequest(V.user);
    cfg = { ...cfg, title: r.title, sub: r.sub + ' It is emailed to Investor Relations with your account code and investor ID.', cta: r.cta, fields: cfg.fields.map(f => ({ ...f, placeholder: r.placeholder })) };
  }
  // Preset values (e.g. Documents → Request for this account and section) fill the form when it opens.
  const preset = V.sheetPreset || {};
  cfg = { ...cfg, init: { ...(cfg.init || {}), ...(preset.category ? { category: preset.category } : {}) }, initAccount: preset.accountId };
  return (
    <Shell V={V} title={cfg.title} sub={cfg.sub}>
      <FormBody key={k + ':' + (preset.accountId || '') + ':' + (preset.category || '')} cfg={cfg} opts={V.acctOptions} onDone={V.closeSheet} />
    </Shell>
  );
}
