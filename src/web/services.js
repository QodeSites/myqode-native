// Desktop Services section: the phone's Services tab (src/screens/services.js) as a desktop dashboard. A summary row
// on top, then the activity table (online payments, SIPs and transactions) on the left and Add funds plus the
// request list in a right-hand column. Same V, same API calls, same request sheets (RequestSheets renders them as
// centred dialogs on desktop), same SIP guards.
import React, { useState, useEffect } from 'react';
import { View, Pressable } from 'react-native';
import { C, Tx, Amt, Row, PageIntro, Panel, Stat, DarkCard, Btn, Chips, Tabs, Table, Pill, Loading, ErrorBlock, Dialog } from './kit';
import { Plus, ChevronRight, Swap } from '../icons';
import { services, payments } from '../api';
import { titleCase, inr, fmtDate } from '../adapt';
import { useLoad } from '../screens/kit';
import { accountRequest } from '../screens/services';

// Same list as the phone (ITEMS in src/screens/services.js, which is not exported): withdrawals are deliberately
// not offered in the app, and Add funds is the call to action above the list.
const ITEMS = [
  { key: 'r-switch', title: 'Switch strategy', sub: 'Move capital between strategies' },
  { key: 'r-strategy', title: 'Ask about a strategy', sub: 'Send a question to the investment team' },
  { key: 'r-discussion', title: 'Book a discussion', sub: 'Request a call with Investor Relations' },
  { key: 'r-account' },   // title from accountRequest(): family or account request, by role
];

const recentJump = j => !!j && Date.now() - j < 2000;   // Home > Recent transactions > View all

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
  const [view, setView] = useState(recentJump(V.svcJump) ? 'cash' : 'online');
  useEffect(() => { if (recentJump(V.svcJump)) setView('cash'); }, [V.svcJump]);
  const opts = V.acctOptions;
  const [sel, setSel] = useState(null);
  const accountId = sel && opts.some(o => o.id === sel) ? sel : opts[0] && opts[0].id;
  const inv = useLoad(() => (accountId ? Promise.all([payments.investmentStatus(accountId), services.transactions(accountId)]) : Promise.resolve(null)), [accountId, V.rk]);
  const status = !inv.loading && inv.data ? inv.data[0] : null;
  const all = status ? [...(status.active || []), ...(status.completed || [])] : [];
  const n = x => (inv.loading ? '…' : String(x));
  const items = ITEMS.map(it => (it.key === 'r-account' ? { ...it, ...accountRequest(V.user) } : it));

  // Summary figures, all from the same investment-status response the table shows.
  const sips = all.filter(i => i.paymentType === 'SIP');
  const liveSips = sips.filter(i => !i.isTerminal && i.investmentStatus !== 'SIP_PAUSED');   // paused mandates are not charged
  const upcoming = liveSips.map(nextDate).filter(Boolean).sort((a, b) => new Date(a) - new Date(b))[0];
  const acctLabel = (opts.find(o => o.id === accountId) || {}).label;

  return (
    <View style={{ gap: 20 }}>
      <PageIntro sub="Add funds, raise a request with Investor Relations, and follow your online payments, SIPs and transactions." />

      <Row gap={16}>
        <Stat style={{ flex: 1 }} label="Online payments and SIPs" value={n(all.length)} note={opts.length > 1 ? acctLabel : null} />
        <Stat style={{ flex: 1 }} label="Active SIPs" value={n(sips.filter(i => i.investmentStatus === 'SIP_ACTIVE').length)} note={inv.loading ? null : sips.length + (sips.length === 1 ? ' SIP' : ' SIPs') + ' in total'} />
        <Stat style={{ flex: 1 }} label="Next SIP charge" value={inv.loading ? '…' : upcoming ? fmtDate(upcoming) : '–'} note={upcoming ? null : 'No instalment scheduled'} />
        <Stat style={{ flex: 1 }} label="Transactions" value={String(V.txAll.length)} note={V.asOf ? 'As of ' + V.asOf : null} />
      </Row>

      <Row top>
        <Panel title="Activity" pad={0} style={{ flex: 1, minWidth: 0 }}
          sub={view === 'online' ? 'Online payments and SIP mandates for one account' : 'Bank transfers in and redemptions out'}
          right={!!V.asOf && <Tx s={12} c={C.ink3}>As of {V.asOf}</Tx>}>
          <Tabs value={view} onChange={setView} style={{ paddingHorizontal: 20 }}
            options={[['online', 'Online and SIPs · ' + n(all.length)], ['cash', 'Transactions · ' + V.txAll.length]]} />
          {view === 'online'
            ? <Investments V={V} opts={opts} accountId={accountId} onPickAccount={setSel} inv={inv} all={all} />
            : <CashTable V={V} />}
        </Panel>

        <View style={{ width: 340, gap: 20 }}>
          <DarkCard style={{ padding: 22 }}>
            <Tx w={600} s={13} c={C.cream60}>Add funds</Tx>
            <Tx f="play" w={600} s={21} c={C.cream} style={{ marginTop: 6 }}>Top up your investment</Tx>
            <Tx s={13} c={C.cream60} lh={1.55} style={{ marginTop: 10 }}>
              Pay once online, set up a SIP that debits automatically on schedule, or transfer by NEFT, RTGS or IMPS from your registered bank account.
            </Tx>
            <Btn kind="gold" label="Add funds" icon={<Plus s={16} c={C.ink} />} onPress={V.openAdd} style={{ marginTop: 16, alignSelf: 'flex-start' }} />
          </DarkCard>

          <Panel title="Requests and support" sub="Sent to Investor Relations" pad={0}>
            <View style={{ borderTopWidth: 1, borderColor: C.line }}>
              {items.map((it, i) => <RequestRow key={it.key} it={it} last={i === items.length - 1} onPress={() => V.openReq(it.key)} />)}
            </View>
          </Panel>
        </View>
      </Row>
    </View>
  );
}

function RequestRow({ it, onPress, last }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={it.title} onPress={onPress}
      style={({ hovered }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13, paddingHorizontal: 20,
        borderBottomWidth: last ? 0 : 1, borderColor: C.line, backgroundColor: hovered ? C.hover : 'transparent' })}>
      {({ hovered }) => (
        <>
          <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: C.greenTint, alignItems: 'center', justifyContent: 'center' }}>
            {it.key === 'r-switch' ? <Swap s={16} c={C.green} /> : <Tx w={600} s={13} c={C.green}>{it.title.charAt(0)}</Tx>}
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Tx w={600} s={13.5} numberOfLines={1}>{it.title}</Tx>
            {!!it.sub && <Tx s={12} c={C.ink3} numberOfLines={1} style={{ marginTop: 2 }}>{it.sub}</Tx>}
          </View>
          <ChevronRight c={hovered ? C.green : C.ink3} />
        </>
      )}
    </Pressable>
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
    } catch (e) { setAct({ busy: '', msg: '', err: e.message }); }
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
          <Tx w={600} s={15} center>No online payments or SIPs yet</Tx>
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
        <View style={{ marginTop: 18, borderRadius: 10, overflow: 'hidden', borderWidth: 1, borderColor: C.line }}>
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
