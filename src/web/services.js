// Desktop Services section: the phone's Services tab (src/screens/services.js) as a desktop dashboard. A summary row
// on top, then the activity table (online payments and SIPs) beside Add funds, both the same height (the table
// scrolls inside its panel), then the request types as a 2 × 2 of cards across the page. Past requests are on
// Support, not here (13 Oct 2026). Same V, same API calls, same request sheets (RequestSheets renders them as
// centred dialogs on desktop), same SIP guards.
import React, { useState, useEffect, useRef } from 'react';
import { View, Pressable, ScrollView } from 'react-native';
import { C, Tx, Amt, Row, PageIntro, Panel, Stat, DarkCard, Btn, Chips, Tabs, Table, Pill, Loading, ErrorBlock, Dialog, Card, Grid, Input, Dropdown } from './kit';
import { Plus, ChevronRight } from '../icons';
import { services, payments } from '../api';
import { titleCase, inr, fmtDate } from '../adapt';
import { useLoad, useQuietRefresh } from '../screens/kit';

import { userMessage } from '../errors';
import { statusTone, statusLabel, requestMeta, groupTypes, typeName, newRequestKey, SLOW_REQUEST, isSlow } from '../requests';
import { track } from '../api/track';
import { Skel } from '../ui';
const recentJump = j => !!j && Date.now() - j < 2000;   // Home > Recent transactions > View all
const ROW_H = 360;   // the payments panel and Add funds, side by side: fits the empty state and the dark card's text

const when = iso => { const d = new Date(iso); return isNaN(d) ? '' : d.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).replace(/\bSept\b/, 'Sep'); };

// The server sends a colour, not a tone; map the status code onto the kit's pill tones.
function tone(st) {
  const s = String(st || '').toUpperCase();
  if (/FAIL|CANCEL|EXPIRE|REJECT|HALT/.test(s)) return 'bad';
  if (/PAUSE|PENDING|AUTHORI|CREATED|PROCESS|INITIAT/.test(s)) return 'warn';
  if (/ACTIVE|SUCCESS|DEPLOY|INVEST|PAID|CAPTUR|COMPLETE/.test(s)) return 'ok';
  return 'neutral';
}
const statusText = it => it.statusLabel || titleCase(String(it.investmentStatus || '').replace(/_/g, ' '));
const typeText = it => (it.paymentType === 'SIP' ? 'SIP · ' + titleCase((it.sip && it.sip.frequency) || it.frequency || '') : it.isNewStrategy ? 'New strategy' : 'One-time');
const nextDate = it => it.nextChargeDate || (it.sip && it.sip.nextChargeDate) || null;

export default function DesktopServices({ V }) {
  const opts = V.acctOptions;
  const [sel, setSel] = useState(null);
  const accountId = sel && opts.some(o => o.id === sel) ? sel : opts[0] && opts[0].id;
  const inv = useLoad(() => (accountId ? Promise.all([payments.investmentStatus(accountId), services.transactions(accountId)]) : Promise.resolve(null)), [accountId, V.rk]);
  const status = !inv.loading && inv.data ? inv.data[0] : null;
  const all = status ? [...(status.active || []), ...(status.completed || [])] : [];
  const n = x => (inv.loading ? '…' : String(x));

  // Summary figures, all from the same investment-status response the table shows.
  const sips = all.filter(i => i.paymentType === 'SIP');
  const liveSips = sips.filter(i => !i.isTerminal && i.investmentStatus !== 'SIP_PAUSED');   // paused mandates are not charged
  const upcoming = liveSips.map(nextDate).filter(Boolean).sort((a, b) => new Date(a) - new Date(b))[0];
  const acctLabel = (opts.find(o => o.id === accountId) || {}).label;

  return (
    <View style={{ gap: 20 }}>
      <PageIntro sub="Add funds, set up or manage SIPs, and raise a request with Investor Relations." />

      <Row gap={16}>
        <Stat style={{ flex: 1 }} label="Online payments and SIPs" value={n(all.length)} note={opts.length > 1 ? acctLabel : null} />
        <Stat style={{ flex: 1 }} label="Active SIPs" value={n(sips.filter(i => i.investmentStatus === 'SIP_ACTIVE').length)} note={inv.loading ? null : sips.length + (sips.length === 1 ? ' SIP' : ' SIPs') + ' in total'} />
        <Stat style={{ flex: 1 }} label="Next SIP charge" value={inv.loading ? '…' : upcoming ? fmtDate(upcoming) : '–'} note={upcoming ? null : 'No instalment scheduled'} />
      </Row>

      {/* one height for both: the panel's body scrolls when there are many rows, Add funds never changes size */}
      <Row style={{ height: ROW_H }}>
        <Panel title="Online payments and SIPs" pad={0} style={{ flex: 1, minWidth: 0 }} bodyStyle={{ flex: 1, minHeight: 0 }}
          sub="Payments made here and SIP mandates, for one account. Bank transfers are under Transactions."
          right={!!V.asOf && <Tx s={12} c={C.ink3}>As of {V.asOf}</Tx>}>
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ flexGrow: 1 }}>
            <Investments V={V} opts={opts} accountId={accountId} onPickAccount={setSel} inv={inv} all={all} />
          </ScrollView>
        </Panel>

        <DarkCard style={{ width: 340, padding: 22, justifyContent: 'center' }}>
          <Tx w={600} s={13} c={C.cream60}>Add funds</Tx>
          <Tx f="play" w={600} s={21} c={C.cream} style={{ marginTop: 6 }}>Top Up Your Investment</Tx>
          <Tx s={13} c={C.cream60} lh={1.55} style={{ marginTop: 10 }}>
            Pay once online, set up a SIP that debits automatically on schedule, or transfer by NEFT, RTGS or IMPS from your registered bank account.
          </Tx>
          <Btn kind="gold" label="Add funds" icon={<Plus s={16} c={C.ink} />} onPress={V.openAdd} style={{ marginTop: 16, alignSelf: 'flex-start' }} />
        </DarkCard>
      </Row>


    </View>
  );
}

// Past Requests' loading skeleton: rows shaped like the requests (title and status pill, detail, meta line), pulsing.
function RequestSkeleton({ rows = 4 }) {
  const bar = { backgroundColor: 'rgba(55,88,79,0.12)' };
  return (
    <View accessibilityLabel="Loading your requests">
      {Array.from({ length: rows }, (_, i) => (
        <View key={i} style={{ paddingVertical: 14, paddingHorizontal: 20, borderBottomWidth: i < rows - 1 ? 1 : 0, borderColor: C.line }}>
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

// Past requests: everything the client raised, each with its status exactly as it stands in Zoho (services.requests,
// src/requests.js). The full list is its own page (Support › Past requests, and "View all"); with \`limit\` it is the
// overview on Account Services: the latest few and a "View all" link to the page.
export function MyRequests({ V, limit, action, reload }) {
  const L = useLoad(() => services.requests(), [V.rk, reload]);
  const data = useQuietRefresh(() => services.requests(), L.data);   // statuses changed meanwhile, every 30 s
  const all = (data && data.requests) || [];
  const list = limit ? all.slice(0, limit) : all;
  const note = L.loading ? null : L.err ? 'We couldn’t load your requests just now.' : !all.length ? 'Nothing raised yet. Requests you make here show up with their status.' : null;
  const more = !!limit && all.length > 0;
  return (
    <Panel title="Past requests" pad={0}
      right={action || more && (
        <Pressable accessibilityRole="link" onPress={() => V.openPage('requests')} style={({ hovered }) => ({ flexDirection: 'row', alignItems: 'center', gap: 4, opacity: hovered ? 0.7 : 1 })}>
          <Tx w={600} s={13} c={C.green}>View all{all.length > list.length ? ' · ' + all.length : ''}</Tx>
          <ChevronRight s={11} c={C.green} />
        </Pressable>
      )}>
      {/* a long list scrolls inside the panel (about five requests in view), so the page keeps its length */}
      <ScrollView style={{ borderTopWidth: 1, borderColor: C.line, maxHeight: limit ? undefined : 520 }}>
        {L.loading ? <RequestSkeleton /> : note ? <Tx s={12.5} c={C.ink3} style={{ padding: 16 }}>{note}</Tx> : list.map((r, i) => (
          <View key={r.id} style={{ paddingVertical: 12, paddingHorizontal: 20, borderBottomWidth: i < list.length - 1 ? 1 : 0, borderColor: C.line }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Tx w={600} s={13.5} style={{ flex: 1, minWidth: 0 }}>{r.title}</Tx>
              {!!statusLabel(r) && <Pill label={statusLabel(r)} tone={statusTone(r)} />}
            </View>
            {!!r.detail && <Tx s={12.5} c={C.ink2} lh={1.5} style={{ marginTop: 3 }}>{r.detail}</Tx>}
            <Tx s={11.5} c={C.ink3} style={{ marginTop: 4 }}>{requestMeta(r)}</Tx>
          </View>
        ))}
      </ScrollView>
    </Panel>
  );
}

// "What do you need help with?" beside the request cards: the request types from Zoho Desk in a dropdown grouped by
// category ("Something else" last), a text box, and Submit request, which raises a Desk ticket of that type
// (services.helpRequest, typeCode) for the account picked on this page. Then a confirmation with the ticket number.
// No fixed height (16 Oct 2026): the pop-up is exactly as tall as the form. The type menu is kept short enough
// (listMax, with Something else pinned under it) to open inside the form without growing or being cut off.
const HELP_LIST_MAX = 150;
function HelpPicker({ V, accountId, onDone, onRaised }) {
  const T = useLoad(() => services.requestTypes(), []);
  const groups = groupTypes(T.data && T.data.types);
  const [code, setCode] = useState(null);
  const [text, setText] = useState('');
  const [st, setSt] = useState({ busy: false, err: '', done: null });
  const reqKey = useRef(newRequestKey());   // this submission's key (kept across a resend)
  const send = async () => {
    const m = text.trim();
    if (!code) return setSt({ busy: false, err: 'Choose what your request is about.', done: null });
    if (m.length < 5) return setSt({ busy: false, err: 'Please tell us a little more.', done: null });
    if (m.length > 2000) return setSt({ busy: false, err: 'Please keep it under 2000 characters.', done: null });
    if (!accountId) return setSt({ busy: false, err: 'No account to raise this for.', done: null });
    setSt({ busy: true, err: '', done: null });
    try {
      const r = await services.helpRequest({ accountId, typeCode: code, message: m, requestKey: reqKey.current });
      reqKey.current = newRequestKey();   // went through: the next request is a new one
      if (onRaised) onRaised();
      track('event', 'help_request', { type: code });
      setText(''); setCode(null);
      setSt({ busy: false, err: '', done: { ticket: r && r.ticket } });
    } catch (e) { setSt({ busy: false, err: isSlow(e) ? SLOW_REQUEST : userMessage(e), done: null }); }
  };
  if (st.done) {
    return (
      <View>
        <Tx w={600} s={15} c={C.green}>What do you need help with?</Tx>
        <View style={{ marginTop: 12, padding: 18, borderRadius: 10, borderWidth: 1, borderColor: C.green, backgroundColor: C.greenTint }}>
          <Tx w={600} s={14.5} c={C.green}>Request received{st.done.ticket ? ' · Ticket #' + st.done.ticket : ''}</Tx>
          <Tx s={13} c={C.ink2} lh={1.55} style={{ marginTop: 6 }}>Investor Relations will get back to you within 24 hours.</Tx>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 20, marginTop: 12 }}>
            {/* the request's status lives in Past Requests (Support), straight from Zoho */}
            {/* in the pop-up on Support: close it, the request is in the Past Requests list right there (already reloaded) */}
            <Pressable accessibilityRole="link" onPress={() => (onDone ? onDone() : V.openPage('requests'))} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              {({ hovered }) => <><Tx w={600} s={13} c={C.green} style={{ textDecorationLine: hovered ? 'underline' : 'none' }}>View in Past Requests</Tx><ChevronRight s={11} c={C.green} /></>}
            </Pressable>
            <Pressable accessibilityRole="button" onPress={() => (onDone ? onDone() : setSt({ busy: false, err: '', done: null }))}>
              {({ hovered }) => <Tx w={600} s={13} c={C.ink2} style={{ textDecorationLine: hovered ? 'underline' : 'none' }}>{onDone ? 'Close' : 'Raise another request'}</Tx>}
            </Pressable>
          </View>
        </View>
      </View>
    );
  }
  // "Something else" (I6, the last group, no header) is pinned under the scrolling list, so it is always in view
  // one plain list, no category headings (16 Oct 2026), still in category order
  const options = groups.flatMap(g => g.items.map(t => ({ id: t.code, label: t.name, ...(g.label ? {} : { pin: true }) })));
  return (
    <View>
      <Tx w={600} s={15} c={C.green}>What do you need help with?</Tx>
      {/* the menu opens over the text box below it: this row sits above it */}
      <View style={{ marginTop: 12, zIndex: 5 }}>
        <Dropdown text={code ? typeName(groups, code) : 'Choose what your request is about'} value={code} onPick={c => { setCode(c); if (st.err) setSt(x => ({ ...x, err: '' })); }}
          options={options} width="100%" maxWidth={720} menuWidth={460} listMax={HELP_LIST_MAX} stretch height={44} a11yLabel="What do you need help with?"
          empty={T.err ? 'We couldn’t load the request types. Please try again shortly.' : 'Loading…'} />
      </View>
      <View style={{ marginTop: 12, zIndex: 1 }}>
        <Input multiline value={text} onChangeText={t => { setText(t); if (st.err) setSt(x => ({ ...x, err: '' })); }}
          placeholder="Tell us a little more so Investor Relations can help faster…" error={st.err} boxHeight={120} />
        <Btn label="Submit request" onPress={send} busy={st.busy} style={{ marginTop: 12, alignSelf: 'flex-start', paddingHorizontal: 22 }} />
      </View>
    </View>
  );
}

// Support > "Raise Ticket": the request form in a pop-up, for the first account.
export function RequestPicker({ V, visible, onClose, onRaised }) {
  const first = (V.acctOptions || [])[0];
  return (
    <Dialog visible={visible} onClose={onClose} title="Raise a Request" width={560}>
      {visible && <HelpPicker V={V} accountId={first && first.id} onDone={onClose} onRaised={onRaised} />}
    </Dialog>
  );
}

// Every cash movement (bank transfers in, redemptions out), already shaped by vals() > txAll.
function CashTable({ V }) {
  if (!V.hasTx) return <Tx s={13} c={C.ink3} style={{ padding: 20 }}>No transactions recorded yet.</Tx>;
  return (
    <Table rows={V.txAll} cols={[
      { key: 'sub', label: 'Date', flex: 1, render: t => <Tx s={13.5} c={C.ink2}>{t.sub}</Tx> },
      { key: 'title', label: 'Type', flex: 1.4, render: t => <Tx w={600} s={13.5}>{t.title}</Tx> },
      { key: 'amt', label: 'Amount', flex: 1, right: true, render: t => <Amt s={13.5} c={t.color}>{t.amt}</Amt> },
    ]} />
  );
}

// Online payments and SIP mandates for one account (payments/investment-status). Pause / resume / cancel call the
// SIP routes with exactly the phone's guards; a row opens its details (message, timeline, instalments).
function Investments({ V, opts, accountId, onPickAccount, inv, all }) {
  const [act, setAct] = useState({ busy: '', msg: '', err: '' });
  const [kind, setKind] = useState('all');   // all | one-time | sip
  const [detail, setDetail] = useState(null);
  const rows = all
    .filter(it => kind === 'all' || (kind === 'sip') === (it.paymentType === 'SIP'))
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  const counts = { all: all.length, 'one-time': all.filter(i => i.paymentType !== 'SIP').length, sip: all.filter(i => i.paymentType === 'SIP').length };

  const sipAction = async (it, action) => {
    if (act.busy) return;
    setAct({ busy: it.orderId, msg: '', err: '' });
    try {
      const r = action === 'cancel' ? await services.cancelSip(it.orderId, accountId) : await services.pauseResumeSip(it.orderId, accountId, action);
      setAct({ busy: '', msg: (r && r.message) || 'Done.', err: '' });
      inv.reload();
    } catch (e) { setAct({ busy: '', msg: '', err: userMessage(e) }); }
  };
  // SIP_AUTHORISED = mandate registered, first instalment ahead (cancel only); SIP_ACTIVE = charged at least once
  // (Razorpay can pause only then).
  const guards = it => {
    const sip = it.paymentType === 'SIP', st = it.investmentStatus || '';
    return { canPause: sip && st === 'SIP_ACTIVE', canResume: sip && st === 'SIP_PAUSED', canCancel: sip && !it.isTerminal };
  };
  const nextOf = it => { const nd = nextDate(it); return nd ? fmtDate(nd) : '–'; };

  const actions = it => {
    const g = guards(it), busy = act.busy === it.orderId;
    if (!g.canPause && !g.canResume && !g.canCancel) return <Tx s={13} c={C.ink3}>–</Tx>;
    return (
      <View style={{ flexDirection: 'row', gap: 6, justifyContent: 'flex-end' }}>
        {g.canPause && <Btn small kind="outline" label="Pause" busy={busy} onPress={() => sipAction(it, 'pause')} />}
        {g.canResume && <Btn small kind="outline" label="Resume" busy={busy} onPress={() => sipAction(it, 'resume')} />}
        {g.canCancel && <Btn small kind="danger" label="Cancel" busy={busy} onPress={() => sipAction(it, 'cancel')} />}
      </View>
    );
  };

  return (
    <View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingHorizontal: 20, paddingVertical: 14 }}>
        {opts.length > 1
          ? <Chips value={accountId} onChange={onPickAccount} options={opts.map(o => [o.id, o.label])} />
          : <View />}
        {!inv.loading && all.length > 0 && (
          <Chips value={kind} onChange={setKind} options={[['all', 'All · ' + counts.all], ['one-time', 'One-time · ' + counts['one-time']], ['sip', 'SIP · ' + counts.sip]]} />
        )}
      </View>
      {inv.loading && <View style={{ paddingHorizontal: 20, paddingBottom: 20 }}><Loading rows={3} /></View>}
      {!inv.loading && !!inv.err && <View style={{ paddingHorizontal: 20, paddingBottom: 20 }}><ErrorBlock msg={inv.err} onRetry={inv.reload} /></View>}
      {!inv.loading && inv.data && all.length === 0 && (
        <View style={{ padding: 32, alignItems: 'center', borderTopWidth: 1, borderColor: C.line }}>
          <Tx w={600} s={15} center>No Online Payments or SIPs Yet</Tx>
          <Tx s={13} c={C.ink2} lh={1.6} center style={{ marginTop: 6, maxWidth: 480 }}>Bank transfers appear under Transactions. Use Add funds to pay online or set up a SIP.</Tx>
          <Btn label="Add funds" onPress={V.openAdd} style={{ marginTop: 14 }} />
        </View>
      )}
      {!inv.loading && all.length > 0 && (
        <Table rows={rows.map(it => ({ ...it, id: it.orderId }))} onRowPress={setDetail} empty="Nothing of this type yet." cols={[
          { key: 'date', label: 'Date', flex: 1, render: it => <Tx s={13.5} c={C.ink2}>{fmtDate(it.createdAt)}</Tx> },
          { key: 'type', label: 'Type', flex: 1.2, render: it => <Tx w={600} s={13.5}>{typeText(it)}</Tx> },
          { key: 'amount', label: 'Amount', flex: 1, right: true, render: it => <Amt s={13.5}>{inr(Number(it.amount || 0))}</Amt> },
          { key: 'status', label: 'Status', flex: 1.1, render: it => <Pill label={statusText(it)} tone={tone(it.investmentStatus)} /> },
          { key: 'next', label: 'Next charge', flex: 1, render: it => <Tx s={13.5} c={C.ink2}>{it.paymentType === 'SIP' ? nextOf(it) : '–'}</Tx> },
          { key: 'actions', label: 'Actions', flex: 1.6, right: true, render: actions },
        ]} />
      )}
      {(!!act.err || !!act.msg) && (
        <Tx s={13} c={act.err ? C.red : C.pos} lh={1.45} style={{ paddingHorizontal: 20, paddingTop: 12 }}>{act.err || act.msg}</Tx>
      )}
      {!inv.loading && all.length > 0 && (
        <Tx s={12} c={C.ink3} style={{ paddingHorizontal: 20, paddingVertical: 14, borderTopWidth: 1, borderColor: C.line, backgroundColor: C.subtle }}>Click a row for details. Use Add funds for a new payment or SIP.</Tx>
      )}
      <Detail it={detail} onClose={() => setDetail(null)} />
    </View>
  );
}

function Detail({ it, onClose }) {
  if (!it) return null;
  const sip = it.paymentType === 'SIP';
  const charges = sip ? (it.chargeHistory || (it.sip && it.sip.charges) || []) : [];
  const chTone = s => (s === 'SUCCESS' ? 'ok' : s === 'FAILED' ? 'bad' : 'neutral');
  return (
    <Dialog visible onClose={onClose} title={typeText(it) + ' · ' + inr(Number(it.amount || 0))}>
      <Pill label={statusText(it)} tone={tone(it.investmentStatus)} />
      {!!it.statusMessage && <Tx s={13.5} c={C.ink2} lh={1.55} style={{ marginTop: 12 }}>{it.statusMessage}</Tx>}
      {Array.isArray(it.timeline) && it.timeline.length > 0 && (
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 16 }}>
          {it.timeline.map((t, i) => (
            <View key={i} style={{ flex: 1 }}>
              <View style={{ height: 3, borderRadius: 2, backgroundColor: t.done || t.completed ? C.green : C.line }} />
              <Tx s={11.5} c={C.ink2} numberOfLines={2} style={{ marginTop: 6 }}>{t.label || t.step || t.status}</Tx>
            </View>
          ))}
        </View>
      )}
      <Tx s={12.5} c={C.ink3} style={{ marginTop: 14 }}>{sip ? 'Set up ' : 'Placed '}{when(it.createdAt)}{it.paymentTime ? ' · paid ' + when(it.paymentTime) : ''}</Tx>
      {__DEV__ && sip && <Tx s={11.5} c={C.ink3} style={{ marginTop: 2 }}>Ref {it.orderId}</Tx>}
      {charges.length > 0 && (
        <View style={{ marginTop: 18, borderRadius: 10, overflow: 'clip', borderWidth: 1, borderColor: C.line }}>
          <Table dense rows={charges} cols={[
            { key: 'n', label: 'Instalment', flex: 0.8, render: ch => <Tx s={13}>{ch.installmentNumber ? '#' + ch.installmentNumber : '–'}</Tx> },
            { key: 'd', label: 'Date', flex: 1.4, render: ch => <Tx s={13} c={C.ink2}>{when(ch.paidAt || ch.chargeDate)}</Tx> },
            { key: 'a', label: 'Amount', flex: 1, right: true, render: ch => <Amt s={13}>{inr(Number(ch.amount || 0))}</Amt> },
            { key: 's', label: 'Status', flex: 0.9, right: true, render: ch => <View><Pill tone={chTone(ch.status)} label={({ SUCCESS: 'Paid', FAILED: 'Failed' })[ch.status] || titleCase(String(ch.status || '').replace(/_/g, ' '))} /></View> },
          ]} />
        </View>
      )}
    </Dialog>
  );
}
