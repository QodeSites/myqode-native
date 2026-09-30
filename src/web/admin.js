// Admin mode on desktop web (/app on a wide screen): the backoffice console built from src/web/kit.js. Same data
// and actions as the phone console (src/screens/admin.js, whose helpers it reuses); navigation lives in V.adm.
import React, { useState, useEffect, useRef } from 'react';
import { View, ScrollView, Pressable } from 'react-native';
import { C, Tx, Amt, Card, Grid, Row, PageIntro, Panel, Stat, Btn, Chips, Tabs, Input, Table, BarList, KeyVals, Pill, Loading, Empty, ErrorBlock, Dialog, TextLink } from './kit';
import { Refresh } from '../icons';
import { backoffice } from '../api';
import { useLoad } from '../screens/kit';
import {
  fmtWhen, fmtDay, fmtAgo, fmtN, pwProblem, isEmail, userBadges, detailsText, useUserList, useUserActions, DailyBars,
  TYPE_OPTS, STATUS_OPTS, ADMIN_TABS, useNotifAdmin, NOTE_SAMPLES, NOTE_LINKS, AUDIENCES, campaignStats, audienceText,
  useManagedList, managedMoney, managedAccountLine,
} from '../screens/admin';

const Badges = ({ u }) => (
  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
    {userBadges(u).map(([l, t]) => <Pill key={l} label={l} tone={t} />)}
  </View>
);
const small = (t, c = C.ink2) => <Tx s={12.5} c={c} numberOfLines={2}>{t}</Tx>;

function Overview({ tick }) {
  const o = useLoad(() => backoffice.overview(), [tick]);
  if (o.loading && !o.data) return <Loading rows={5} />;
  if (o.err) return <ErrorBlock msg={o.err} onRetry={o.reload} />;
  const d = o.data || {}, u = d.users || {}, l = d.logins || {};
  const versions = d.appVersions || [], vTotal = versions.reduce((s, v) => s + (Number(v.users) || 0), 0) || 1;
  const screens = d.topScreens || [], sMax = Math.max(1, ...screens.map(s => Number(s.views) || 0));
  return (
    <View style={{ gap: 20 }}>
      <Grid min={180} gap={14}>
        <Stat label="Investors" value={fmtN(u.investors)} />
        <Stat label="Distributors" value={fmtN(u.distributors)} />
        <Stat label="Password set" value={fmtN(u.passwordSet)} />
        <Stat label="Needs setup" value={fmtN(u.needsSetup)} color={u.needsSetup ? C.goldText : C.ink} />
        <Stat label="Never signed in" value={fmtN(u.neverLoggedIn)} />
        <Stat label="Locked" value={fmtN(u.locked)} color={u.locked ? C.red : C.ink} />
      </Grid>
      <Grid min={180} gap={14}>
        <Stat label="Sign-ins today" value={fmtN(l.today)} />
        <Stat label="Sign-ins, 7 days" value={fmtN(l.last7)} />
        <Stat label="Sign-ins, 30 days" value={fmtN(l.last30)} note={`Web ${fmtN(l.web30)} · App ${fmtN(l.app30)}`} />
        <Stat label="App, 30 days" value={fmtN(l.app30)} note={`iOS ${fmtN(l.ios30)} · Android ${fmtN(l.android30)}`} />
        <Stat label="Open queries" value={fmtN(d.openQueries)} />
        <Stat label="Errors, 7 days" value={fmtN(d.errors7)} color={d.errors7 ? C.red : C.ink} />
      </Grid>
      <Panel title="Daily sign-ins" sub="Last 30 days, app and web">
        <DailyBars daily={d.daily} height={140} labelColor={C.ink3} TxC={Tx} />
      </Panel>
      <Row top>
        <Panel title="App versions" sub="Users in the last 30 days" style={{ flex: 1 }}>
          {versions.length ? <BarList items={versions.map(v => ({ key: String(v.version), label: v.version || 'Unknown', value: fmtN(v.users) + ' users', pct: ((Number(v.users) || 0) / vTotal) * 100 }))} />
            : small('No app usage recorded.')}
        </Panel>
        <Panel title="Top screens" sub="Views in the last 30 days" style={{ flex: 1 }}>
          {screens.length ? <BarList items={screens.slice(0, 8).map(s => ({ key: s.name, label: s.name, value: fmtN(s.views), pct: ((Number(s.views) || 0) / sMax) * 100, color: C.gold }))} />
            : small('No screen views recorded.')}
        </Panel>
      </Row>
      <Row top>
        <Panel title="Recent sign-ins" pad={0} style={{ flex: 1 }}>
          <Table dense rows={d.recentLogins || []} empty="No sign-ins yet." cols={[
            { key: 'name', label: 'User', flex: 2, render: r => <View><Tx w={600} s={13} numberOfLines={1}>{r.name || r.email}</Tx>{!!r.name && small(r.email, C.ink3)}</View> },
            { key: 'platform', label: 'Where', render: r => small([r.platform, r.os].filter(Boolean).join(' / ')) },
            { key: 'at', label: 'When', right: true, render: r => small(fmtAgo(r.at)) },
          ]} />
        </Panel>
        <Panel title="Recent errors" pad={0} style={{ flex: 1 }}>
          <Table dense rows={d.recentErrors || []} empty="No errors in the last 7 days." cols={[
            { key: 'name', label: 'Error', flex: 2.4, render: r => <View><Tx w={600} s={13} numberOfLines={1}>{r.name || 'Error'}</Tx>{small(r.message, C.ink3)}</View> },
            { key: 'count', label: 'Count', right: true, render: r => <Amt s={13} c={C.red}>{fmtN(r.count)}</Amt> },
            { key: 'lastAt', label: 'Last', right: true, render: r => small(fmtAgo(r.lastAt)) },
          ]} />
        </Panel>
      </Row>
    </View>
  );
}

function NewDistributorDialog({ V, visible, onClose, onDone }) {
  const [f, setF] = useState({ name: '', email: '', pw: '', fee: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (visible) { setF({ name: '', email: '', pw: '', fee: '' }); setErr(''); } }, [visible]);
  const upd = k => t => { setF(s => ({ ...s, [k]: t })); setErr(''); };
  const submit = async () => {
    if (busy) return;
    const name = f.name.trim(), email = f.email.trim().toLowerCase();
    const fee = f.fee.trim() === '' ? undefined : Number(f.fee.replace(',', '.'));
    const bad = !name ? 'Enter the distributor name.' : !isEmail(email) ? 'Enter a valid email.' : pwProblem(f.pw)
      || (fee !== undefined && (!isFinite(fee) || fee < 0 || fee > 100) ? 'Fee must be a percentage between 0 and 100.' : '');
    if (bad) return setErr(bad);
    setBusy(true);
    try {
      await backoffice.createDistributor({ name, email, password: f.pw, ...(fee !== undefined ? { feePercentage: fee } : {}) });
      V.toast('Distributor created');
      onDone();
    } catch (e) { setErr(e.status === 409 ? 'A user with this email already exists.' : e.message); }
    finally { setBusy(false); }
  };
  return (
    <Dialog visible={visible} onClose={onClose} title="New distributor" width={480}>
      <View style={{ gap: 14 }}>
        <Input label="Name" value={f.name} onChangeText={upd('name')} placeholder="Full name or firm" autoFocus />
        <Input label="Email" value={f.email} onChangeText={upd('email')} placeholder="name@example.com" keyboardType="email-address" />
        <Input label="Password" value={f.pw} onChangeText={upd('pw')} secure hint="8+ characters, with a letter and a digit." />
        <Input label="Fee %" value={f.fee} onChangeText={upd('fee')} placeholder="Optional" keyboardType="decimal-pad" onSubmitEditing={submit} />
        {!!err && <Tx s={12.5} c={C.red}>{err}</Tx>}
        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10 }}>
          <Btn kind="outline" label="Cancel" onPress={onClose} />
          <Btn label="Create distributor" busy={busy} onPress={submit} />
        </View>
      </View>
    </Dialog>
  );
}

function ManagedList({ V, tick }) {
  const [q, setQ] = useState('');
  const [st, setSt] = useState({ busy: '', err: '' });
  const L = useManagedList(q, tick);
  const people = (L.data && L.data.people) || [];
  const open = async p => {
    if (st.busy) return;
    setSt({ busy: p.icode, err: '' });
    try { await V.openAsUser({ icode: p.icode, name: p.name }); setSt({ busy: '', err: '' }); } catch (e) { setSt({ busy: '', err: e.message || 'Could not open this account.' }); }
  };
  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 14, flexWrap: 'wrap', marginBottom: 16 }}>
        <Input value={q} onChangeText={setQ} placeholder="Search name, email, QUS or QAC code" style={{ width: 360 }} />
        <Tx s={12.5} c={C.ink3} style={{ flex: 1, minWidth: 240 }}>OneView managed accounts. Open one to see that person's portfolio, read-only.</Tx>
      </View>
      {!!st.err && <Tx s={12.5} c={C.red} style={{ marginBottom: 10 }}>{st.err}</Tx>}
      {!!L.err && <ErrorBlock msg={L.err} onRetry={L.reload} />}
      {!L.err && (L.loading && !people.length ? <Loading rows={6} /> : (
        <Panel pad={0} title={`${fmtN(people.length)} ${people.length === 1 ? 'person' : 'people'}`} style={{ opacity: L.loading ? 0.6 : 1 }}>
          <Table rows={people} empty="No managed accounts match." onRowPress={open} cols={[
            { key: 'name', label: 'Person', flex: 2, render: p => <View><Tx w={600} s={13.5} numberOfLines={1}>{p.name}</Tx>{small([p.icode, p.email].filter(Boolean).join(' · '), C.ink3)}</View> },
            { key: 'accounts', label: 'Accounts', flex: 3, render: p => <View style={{ gap: 2 }}>{p.accounts.map(x => <Tx key={x.qcode} s={12.5} c={x.closed ? C.ink3 : C.ink2} numberOfLines={1}>{managedAccountLine(x)}</Tx>)}</View> },
            { key: 'total', label: 'Total', right: true, render: p => small(managedMoney(p.total)) },
            { key: 'open', label: '', right: true, render: p => <Btn kind="outline" label={st.busy === p.icode ? 'Opening…' : 'View'} busy={st.busy === p.icode} onPress={() => open(p)} /> },
          ]} />
        </Panel>
      ))}
    </View>
  );
}

function UserList({ V, fixedType, tick }) {
  const [q, setQ] = useState('');
  const [type, setType] = useState('all');
  const [status, setStatus] = useState('all');
  const [mine, setMine] = useState(0);
  const [newOpen, setNewOpen] = useState(false);
  const list = useUserList({ q: q.trim(), type: fixedType || type, status, tick: tick + mine });
  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 14, flexWrap: 'wrap', marginBottom: 16 }}>
        <Input value={q} onChangeText={setQ} placeholder="Search name, email or client code" style={{ width: 360 }} />
        {!fixedType && <Chips value={type} options={TYPE_OPTS} onChange={setType} />}
        <Chips value={status} options={STATUS_OPTS} onChange={setStatus} />
        <View style={{ flex: 1 }} />
        {fixedType === 'distributor' && <Btn label="New distributor" onPress={() => setNewOpen(true)} />}
      </View>
      {!!list.err && <ErrorBlock msg={list.err} onRetry={list.reload} />}
      {!list.err && (list.loading && !list.items.length ? <Loading rows={6} /> : (
        <Panel pad={0} title={`${fmtN(list.total)} ${list.total === 1 ? 'user' : 'users'}`} style={{ opacity: list.loading ? 0.6 : 1 }}>
          <Table rows={list.items} empty="No users match." onRowPress={u => V.setAdm({ email: u.email })} cols={[
            { key: 'name', label: 'User', flex: 2.2, render: u => <View><Tx w={600} s={13.5} numberOfLines={1}>{u.name || u.email}</Tx>{small(u.email, C.ink3)}</View> },
            { key: 'codes', label: fixedType === 'distributor' ? 'Investors' : 'Client codes', flex: 1.4, render: u => small(u.type === 'distributor' ? fmtN(u.clientCount) + ' investors' : (u.clientCodes || []).join(', ')) },
            { key: 'status', label: 'Status', flex: 2, render: u => <Badges u={u} /> },
            { key: 'logins', label: 'Sign-ins', right: true, render: u => small(`${fmtN(u.webLogins)} web · ${fmtN(u.appLogins)} app`) },
            { key: 'last', label: 'Last sign-in', right: true, render: u => small(fmtAgo(u.lastLoginAt)) },
          ]} />
        </Panel>
      ))}
      {list.hasMore && !list.err && (
        <View style={{ alignItems: 'center', marginTop: 16 }}>
          <Btn kind="outline" label={`Load more (${fmtN(list.items.length)} of ${fmtN(list.total)})`} busy={list.more} onPress={list.loadMore} />
        </View>
      )}
      <NewDistributorDialog V={V} visible={newOpen} onClose={() => setNewOpen(false)} onDone={() => { setNewOpen(false); setMine(m => m + 1); }} />
    </View>
  );
}

function PasswordDialog({ visible, onClose, onSave, busy, err: outerErr, name }) {
  const [a, setA] = useState(''), [b, setB] = useState(''), [err, setErr] = useState('');
  useEffect(() => { if (visible) { setA(''); setB(''); setErr(''); } }, [visible]);
  const save = () => { const bad = pwProblem(a, b); if (bad) return setErr(bad); onSave(a); };
  return (
    <Dialog visible={visible} onClose={onClose} title="Set password" width={460}>
      <View style={{ gap: 14 }}>
        <Tx s={13} c={C.ink2} lh={1.5}>For {name}. Also clears failed attempts and any lock. The user is not notified.</Tx>
        <Input label="New password" value={a} onChangeText={t => { setA(t); setErr(''); }} secure hint="8+ characters, with a letter and a digit." autoFocus />
        <Input label="Confirm password" value={b} onChangeText={t => { setB(t); setErr(''); }} secure onSubmitEditing={save} />
        {!!(err || outerErr) && <Tx s={12.5} c={C.red}>{err || outerErr}</Tx>}
        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10 }}>
          <Btn kind="outline" label="Cancel" onPress={onClose} />
          <Btn label="Set password" busy={busy} onPress={save} />
        </View>
      </View>
    </Dialog>
  );
}

function ConfirmDialog({ visible, onClose, title, body, label, danger, busy, err, onConfirm }) {
  return (
    <Dialog visible={visible} onClose={onClose} title={title} width={460}>
      <Tx s={13.5} c={C.ink2} lh={1.55}>{body}</Tx>
      {!!err && <Tx s={12.5} c={C.red} style={{ marginTop: 10 }}>{err}</Tx>}
      <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}>
        <Btn kind="outline" label="Cancel" onPress={onClose} />
        <Btn kind={danger ? 'danger' : 'primary'} label={label} busy={busy} onPress={onConfirm} />
      </View>
    </Dialog>
  );
}

function UserDetail({ V, email, onBack }) {
  const det = useLoad(() => backoffice.userDetail(email), [email]);
  const d = det.data || {}, u = d.user || null;
  const name = (u && (u.name || u.email)) || email;
  const A = useUserActions({ V, email, name, reload: det.reload, onDeleted: onBack });
  const back = <View style={{ marginBottom: 14, alignSelf: 'flex-start' }}><TextLink label="Back" onPress={onBack} /></View>;
  if (det.loading && !det.data) return <>{back}<Loading rows={4} /></>;
  if (det.err) return <>{back}<ErrorBlock msg={det.err} onRetry={det.reload} /></>;
  if (!u) return <>{back}<Empty title="Not found">This user was not found.</Empty></>;
  const isDist = u.type === 'distributor';
  return (
    <View>
      {back}
      <PageIntro title={u.name || u.email} sub={u.email} right={
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <Btn label="Open as user" busy={A.busy === 'open'} onPress={A.openAsUser} />
          <Btn kind="outline" label="Set password" onPress={() => A.open('pw')} />
          <Btn kind="outline" label="Send reset link" onPress={() => A.open('reset')} />
          <Btn kind="outline" label="Unlock" onPress={() => A.open('unlock')} />
          {isDist && <Btn kind="danger" label="Delete distributor" onPress={() => A.open('delete')} />}
        </View>
      } />
      <Badges u={u} />
      {!!A.err && !A.sheet && <Tx s={12.5} c={C.red} style={{ marginTop: 10 }}>{A.err}</Tx>}
      <Row top style={{ marginTop: 20 }}>
        <Panel title="Summary" style={{ flex: 1 }}>
          <KeyVals items={[
            ...(isDist ? [['Investors', fmtN(u.clientCount)]] : [['Client codes', (u.clientCodes || []).join(', ') || 'None']]),
            ...(u.intermediary ? [['Intermediary', String(u.intermediary)]] : []),
            ...(u.groupId ? [['Group', String(u.groupId)]] : []),
            ['Last sign-in', u.lastLoginAt ? fmtWhen(u.lastLoginAt) : 'Never'],
            ['Last web sign-in', u.lastWebLoginAt ? fmtWhen(u.lastWebLoginAt) : 'Never'],
            ['Last app sign-in', u.lastAppLoginAt ? fmtWhen(u.lastAppLoginAt) : 'Never'],
            ['Sign-ins', `${fmtN(u.loginCount)} (web ${fmtN(u.webLogins)}, app ${fmtN(u.appLogins)})`],
          ]} />
        </Panel>
        <Panel title="App" style={{ flex: 1 }}>
          {d.app ? <KeyVals items={[['Version', d.app.lastVersion || 'Unknown'], ['Platform', d.app.platform || 'Unknown'], ['Last seen', fmtWhen(d.app.lastSeenAt) || 'Unknown']]} />
            : small('Has not used the app.')}
        </Panel>
      </Row>
      {!isDist && (
        <Panel title="Accounts" pad={0} style={{ marginTop: 20 }}>
          <Table dense rows={d.accounts || []} empty="No accounts." cols={[
            { key: 'clientCode', label: 'Code' },
            { key: 'strategy', label: 'Strategy', flex: 1.6 },
            { key: 'name', label: 'Holder', flex: 1.6 },
            { key: 'status', label: 'Status', render: a => (a.status ? <Pill label={a.status} tone={/active/i.test(a.status) ? 'ok' : 'neutral'} /> : null) },
            { key: 'group', label: 'Group', render: a => small([a.groupId, a.headOfFamily ? 'head' : ''].filter(Boolean).join(' · ')) },
            { key: 'maturityDate', label: 'Maturity', right: true, render: a => small(fmtDay(a.maturityDate)) },
          ]} />
        </Panel>
      )}
      {isDist && (
        <Panel title="Investors" pad={0} style={{ marginTop: 20 }}>
          <Table dense rows={d.investors || []} empty="No investors under this distributor." onRowPress={x => x.email && V.setAdm({ email: x.email })} cols={[
            { key: 'name', label: 'Investor', flex: 1.6 },
            { key: 'email', label: 'Email', flex: 1.6 },
            { key: 'codes', label: 'Client codes', flex: 1.4, render: x => small((x.clientCodes || []).join(', ')) },
          ]} />
        </Panel>
      )}
      <Row top style={{ marginTop: 20 }}>
        <Panel title="Recent sign-ins" pad={0} style={{ flex: 1 }}>
          <Table dense rows={d.logins || []} empty="No sign-ins recorded." cols={[
            { key: 'at', label: 'When', flex: 1.6, render: r => small(fmtWhen(r.at), C.ink) },
            { key: 'platform', label: 'Platform' },
            { key: 'os', label: 'OS' },
          ]} />
        </Panel>
        <Panel title="Backoffice actions" pad={0} style={{ flex: 1 }}>
          <Table dense rows={d.audit || []} empty="No backoffice actions on this user." cols={[
            { key: 'at', label: 'When', render: r => small(fmtWhen(r.at)) },
            { key: 'action', label: 'Action' },
            { key: 'admin', label: 'By', render: r => small(r.admin) },
            { key: 'details', label: 'Details', flex: 1.4, render: r => small(detailsText(r.details), C.ink3) },
          ]} />
        </Panel>
      </Row>
      <PasswordDialog visible={A.sheet === 'pw'} onClose={A.close} onSave={A.setPassword} busy={A.busy === 'pw'} err={A.err} name={name} />
      <ConfirmDialog visible={A.sheet === 'reset'} onClose={A.close} title="Send reset link" busy={A.busy === 'reset'} err={A.err} onConfirm={A.resetLink}
        label="Send link" body={`Email ${u.email} the standard link to set a new password.`} />
      <ConfirmDialog visible={A.sheet === 'unlock'} onClose={A.close} title="Unlock account" busy={A.busy === 'unlock'} err={A.err} onConfirm={A.unlock}
        label="Unlock" body="Clears failed sign-in attempts and any lock, so the user can sign in again straight away." />
      <ConfirmDialog visible={A.sheet === 'delete'} onClose={A.close} title="Delete distributor" danger busy={A.busy === 'delete'} err={A.err} onConfirm={A.remove}
        label="Delete" body={`Delete the distributor login for ${u.email}? This cannot be undone. Their investors are not changed.`} />
    </View>
  );
}

function Audit({ V, tick }) {
  const [action, setAction] = useState('');
  const [target, setTarget] = useState('');
  const [f, setF] = useState({ action: '', target: '' });
  useEffect(() => { const t = setTimeout(() => setF({ action: action.trim(), target: target.trim() }), 300); return () => clearTimeout(t); }, [action, target]);
  const a = useLoad(() => backoffice.audit({ limit: 200, action: f.action, target: f.target }), [tick, f.action, f.target]);
  return (
    <View>
      <View style={{ flexDirection: 'row', gap: 14, marginBottom: 16 }}>
        <Input value={action} onChangeText={setAction} placeholder="Filter by action, e.g. user.impersonate" style={{ width: 300 }} />
        <Input value={target} onChangeText={setTarget} placeholder="Filter by target email" style={{ width: 300 }} />
      </View>
      {a.err ? <ErrorBlock msg={a.err} onRetry={a.reload} /> : a.loading && !a.data ? <Loading rows={6} /> : (
        <Panel pad={0} style={{ opacity: a.loading ? 0.6 : 1 }}>
          <Table dense rows={(a.data && a.data.items) || []} empty="No backoffice actions yet."
            onRowPress={r => r.target && /@/.test(r.target) && V.setAdm({ email: r.target })} cols={[
              { key: 'at', label: 'When', flex: 1.2, render: r => small(fmtWhen(r.at), C.ink) },
              { key: 'admin', label: 'Admin', flex: 1.4, render: r => small(r.admin) },
              { key: 'action', label: 'Action', flex: 1.2 },
              { key: 'target', label: 'Target', flex: 1.6, render: r => small(r.target) },
              { key: 'details', label: 'Details', flex: 2, render: r => small(detailsText(r.details), C.ink3) },
              { key: 'ip', label: 'IP', render: r => small(r.ip, C.ink3) },
            ]} />
        </Panel>
      )}
    </View>
  );
}

// Notifications: write one, try it on your own phone, then send it. Delivery health for every campaign.
function Notifications({ tick }) {
  const { q, f, set, sample, problem, send, busy, msg } = useNotifAdmin(tick);
  const d = q.data;
  if (q.loading && !d) return <Loading rows={4} />;
  if (q.err && !d) return <ErrorBlock msg={q.err} onRetry={q.reload} />;
  if (d && d.ready === false) return <Empty title="Notification tables aren’t created yet">Run the migration on the server (node scripts/migrate-app-notifications.mjs --apply), then refresh.</Empty>;
  const audienceOpts = AUDIENCES;
  return (
    <View style={{ gap: 20 }}>
      <PageIntro title="Notifications" sub="Popups on clients’ phones and the inbox under the bell. Money, portfolio and reading notifications are sent automatically." />
      <Grid>
        <Stat label="Automatic notifications" value={d.live ? 'On' : 'Off'} note={d.live ? 'Money, portfolio and reading go to clients' : 'Off until PUSH_LIVE=1. Your own notifications can be published any time.'} />
        <Stat label="Phones registered" value={fmtN(d.devices && d.devices.active)} note={`${fmtN(d.devices && d.devices.logins)} logins · ${fmtN(d.devices && d.devices.ios)} iOS · ${fmtN(d.devices && d.devices.android)} Android`} />
        <Stat label="Last 24 hours" value={fmtN(d.outbox && d.outbox.created24h)} note={`${fmtN(d.outbox && d.outbox.pending)} waiting · ${fmtN(d.outbox && d.outbox.failed24h)} failed`} />
      </Grid>
      <Row top>
        <Panel title="New notification" sub="Try it on your own phone first" style={{ flex: 1 }}>
          <View style={{ gap: 14 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <Tx s={12.5} c={C.ink3}>Fill with a sample:</Tx>
              {NOTE_SAMPLES.map(x => <Btn key={x.key} small kind="outline" label={x.label} onPress={() => sample(x)} />)}
            </View>
            <Input label={`Title (${f.title.length}/90)`} value={f.title} onChangeText={t => set({ title: t })} placeholder="Your September update" />
            <Input label={`Message (${f.body.length}/300)`} value={f.body} onChangeText={t => set({ body: t })} multiline placeholder="What should the client know?" />
            <View style={{ gap: 6 }}><Tx s={12.5} w={600} c={C.ink2}>Opens</Tx><Chips small value={f.link} options={NOTE_LINKS} onChange={v => set({ link: v })} /></View>
            <View style={{ gap: 6 }}><Tx s={12.5} w={600} c={C.ink2}>Send to</Tx><Chips small value={f.type} options={audienceOpts} onChange={v => set({ type: v, value: '' })} /></View>
            
            {f.type === 'strategy' && <Chips small value={f.value} options={(d.strategies || []).map(x => [x, x.replace(/^QODE ADVISORS LLP\s*-\s*/i, '')])} onChange={v => set({ value: v })} />}
            {f.type === 'emails' && <Input label="Client emails" value={f.value} onChangeText={t => set({ value: t })} multiline placeholder="one@example.com, two@example.com" />}
            {!!msg && <Tx s={13} c={msg.ok ? C.pos : C.red}>{msg.text}</Tx>}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Btn label={busy ? 'Sending…' : f.type === 'test' ? 'Send to my phone' : 'Send'} onPress={send} disabled={!!problem || busy} />
              {!!problem && <Tx s={12.5} c={C.ink3}>{problem}</Tx>}
            </View>
          </View>
        </Panel>
        <Panel title="Preview" sub="How it appears on the phone" style={{ width: 360 }}>
          <View style={{ borderRadius: 16, backgroundColor: 'rgba(30,30,30,0.06)', padding: 12, gap: 4 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={{ width: 20, height: 20, borderRadius: 5, backgroundColor: C.green }} />
              <Tx s={11.5} c={C.ink3} style={{ flex: 1 }}>MYQODE</Tx><Tx s={11.5} c={C.ink3}>now</Tx>
            </View>
            <Tx w={700} s={13.5}>{f.title || 'Title'}</Tx>
            <Tx s={13} c={C.ink2} numberOfLines={4}>{f.body || 'Your message'}</Tx>
          </View>
        </Panel>
      </Row>
      <Panel title="Sent" sub="Delivered means Apple or Google accepted it for the phone" pad={0}>
        {(d.campaigns || []).length ? (
          <Table rows={d.campaigns} cols={[
            { key: 'at', label: 'When', render: c => small(fmtWhen(c.createdAt), C.ink) },
            { key: 'title', label: 'Notification', flex: 2.4, render: c => <View><Tx w={600} s={13} numberOfLines={1}>{c.title}</Tx>{small(c.body, C.ink3)}</View> },
            { key: 'to', label: 'To', render: c => small(audienceText(c.audience)) },
            { key: 'stats', label: 'Delivery', flex: 1.8, render: c => small(campaignStats(c.stats)) },
            { key: 'by', label: 'By', render: c => small(c.createdBy, C.ink3) },
          ]} />
        ) : <Empty title="Nothing sent yet">Your first test will show here.</Empty>}
      </Panel>
    </View>
  );
}

export default function DesktopAdmin({ V }) {
  const tab = V.adm.tab || 'overview', email = V.adm.email || null;
  const [tick, setTick] = useState(0);
  const who = (V.user && (V.user.name || V.user.email)) || '';
  let body;
  if (email) body = <UserDetail key={email} V={V} email={email} onBack={() => V.setAdm({ email: null })} />;
  else if (tab === 'users') body = <UserList key="users" V={V} tick={tick} />;
  else if (tab === 'distributors') body = <UserList key="dist" V={V} fixedType="distributor" tick={tick} />;
  else if (tab === 'managed') body = <ManagedList V={V} tick={tick} />;
  else if (tab === 'audit') body = <Audit V={V} tick={tick} />;
  else if (tab === 'notifications') body = <Notifications tick={tick} />;
  else body = <Overview tick={tick} />;
  return (
    <View style={{ flex: 1, backgroundColor: C.canvas }}>
      <View style={{ height: 64, paddingHorizontal: 28, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: 1, borderColor: C.line, backgroundColor: C.card }}>
        <Tx f="play" w={600} s={20} c={C.green} role="heading" aria-level={1}>myQode admin</Tx>
        {V.testMode && <Pill label="Test mode" tone="bad" />}
        <View style={{ flex: 1 }} />
        {!!who && <Tx s={13} c={C.ink2} numberOfLines={1}>{who}</Tx>}
        <Pressable accessibilityRole="button" accessibilityLabel="Refresh" onPress={() => setTick(t => t + 1)} style={({ hovered }) => ({ width: 36, height: 36, borderRadius: 8, borderWidth: 1, borderColor: C.line2, backgroundColor: hovered ? C.hover : C.card, alignItems: 'center', justifyContent: 'center' })}>
          <Refresh c={C.ink2} s={16} />
        </Pressable>
        <Btn small kind="outline" label="Sign out" onPress={V.doLogout} />
      </View>
      <View style={{ paddingHorizontal: 28, backgroundColor: C.card }}>
        <Tabs value={email ? null : tab} options={ADMIN_TABS} onChange={k => V.setAdm({ tab: k, email: null })} style={{ borderBottomWidth: 0 }} />
      </View>
      <ScrollView style={{ flex: 1, borderTopWidth: 1, borderColor: C.line }} contentContainerStyle={{ padding: 28, paddingBottom: 48 }}>
        <View style={{ maxWidth: 1480, width: '100%' }}>{body}</View>
      </ScrollView>
    </View>
  );
}
