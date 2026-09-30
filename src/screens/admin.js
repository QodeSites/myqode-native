// Admin mode (phone): the backoffice console for the app admin. Data from /api/admin/bo/* (backoffice in
// src/api/index.js, contract in myQode/docs/admin-backoffice-api.md). Navigation (tab, open user) lives in the root
// component's `adm` state so "Back to admin" returns to where the admin left off. The desktop web console
// (src/web/admin.js) reuses the helpers exported here.
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Pressable, TextInput, RefreshControl, Platform, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets, SafeAreaInsetsContext } from 'react-native-safe-area-context';
import { C, Tx, Amt, Card, CTA, Chip, Field, Sheet, GoldThreads, CurveCap, KeyboardScroll, useBackHandler } from '../ui';
import { Refresh, Search } from '../icons';
import { backoffice } from '../api';
import { useLoad, SectionLabel, Loading, ErrorBox, Empty, SignOutButton } from './kit';
import { DeviceCard, PushOfferCard } from './notifications';

// ── Shared helpers (also used by src/web/admin.js) ───────────────────────────────────────────────────────────
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const pad = n => String(n).padStart(2, '0');
export function fmtWhen(v) {
  if (!v) return '';
  const d = new Date(v);
  if (isNaN(d)) return String(v);
  return `${d.getDate()} ${MON[d.getMonth()]} ${d.getFullYear()}, ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
export function fmtDay(v) {
  if (!v) return '';
  const d = new Date(v);
  return isNaN(d) ? String(v) : `${d.getDate()} ${MON[d.getMonth()]} ${d.getFullYear()}`;
}
export function fmtAgo(v) {
  if (!v) return 'never';
  const t = new Date(v).getTime();
  if (isNaN(t)) return String(v);
  const s = Math.max(0, (Date.now() - t) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return Math.floor(s / 60) + ' min ago';
  if (s < 86400) return Math.floor(s / 3600) + ' h ago';
  if (s < 86400 * 30) return Math.floor(s / 86400) + ' d ago';
  return fmtDay(v);
}
export const fmtN = n => (n == null || n === '' ? '0' : Number(n).toLocaleString('en-IN'));
// Backoffice password rule: 8+ characters with a letter and a digit.
export function pwProblem(a, b) {
  if (!a || a.length < 8) return 'Use at least 8 characters.';
  if (!/[A-Za-z]/.test(a) || !/[0-9]/.test(a)) return 'Include at least one letter and one digit.';
  if (b != null && a !== b) return 'The two passwords do not match.';
  return '';
}
export const isEmail = e => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(e || '').trim());
export const TYPE_OPTS = [['all', 'All'], ['investor', 'Investors'], ['distributor', 'Distributors']];
export const STATUS_OPTS = [['all', 'Any status'], ['needs-setup', 'Needs setup'], ['locked', 'Locked'], ['never', 'Never signed in']];
export const ADMIN_TABS = [['overview', 'Overview'], ['users', 'Users'], ['distributors', 'Distributors'], ['managed', 'Managed accounts'], ['notifications', 'Notifications'], ['audit', 'Audit log']];

// Notifications composer (phone and desktop). Samples fill the form with one of each automated kind, to try them
// on your own phone before PUSH_LIVE=1.
export const NOTE_SAMPLES = [
  { key: 'money', label: 'Money', category: 'money', link: 'page:transactions', title: 'Investment recorded', body: '₹5 L was added to your Qode All Weather account on 25 Sep.' },
  { key: 'portfolio', label: 'Portfolio', category: 'portfolio', link: 'tab:portfolio', title: 'Your September update', body: 'Your portfolio returned +2.1% in September and was worth ₹48.2 L at month end.' },
  { key: 'reading', label: 'Reading', category: 'reading', link: 'page:newsletters', title: 'New newsletter', body: 'Our latest newsletter is ready to read in the app.' },
];
export const NOTE_LINKS = [['', 'Home'], ['tab:portfolio', 'Performance'], ['page:transactions', 'Transactions'], ['tab:reports', 'Reports'], ['page:newsletters', 'Newsletters'], ['tab:docs', 'Documents'], ['tab:services', 'Account services'], ['sheet:add', 'Add funds']];
export const AUDIENCES = [['test', 'Only me (test)'], ['all', 'Everyone on the app'], ['strategy', 'One strategy'], ['emails', 'Chosen clients']];

export function useNotifAdmin(tick) {
  const q = useLoad(() => backoffice.notifications(), [tick]);
  const [f, setF] = useState({ title: '', body: '', link: 'tab:portfolio', category: 'updates', type: 'test', value: '' });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);   // { ok, text }
  const set = patch => { setF(x => ({ ...x, ...patch })); setMsg(null); };
  const sample = s => set({ title: s.title, body: s.body, link: s.link, category: s.category, type: 'test' });
  const problem = !f.title.trim() ? 'Add a title' : f.title.length > 90 ? 'Title is too long (90 characters)' : !f.body.trim() ? 'Write the message'
    : f.body.length > 300 ? 'Message is too long (300 characters)' : f.type === 'strategy' && !f.value ? 'Choose a strategy'
      : f.type === 'emails' && !f.value.trim() ? 'Add at least one email' : '';
  const send = async () => {
    if (problem || busy) return;
    setBusy(true); setMsg(null);
    const body = { title: f.title.trim(), body: f.body.trim(), link: f.link || null, category: f.category,
      audience: { type: f.type, value: f.type === 'strategy' || f.type === 'emails' ? f.value : undefined } };
    try {
      if (f.type !== 'test') {
        // Publishing to clients: show the exact recipient count and ask before anything is sent.
        const { recipients } = await backoffice.sendNotification({ ...body, dryRun: true });
        const q = `Send "${body.title}" to ${recipients} ${recipients === 1 ? 'person' : 'people'}? This can't be undone.`;
        const ok = Platform.OS === 'web' ? window.confirm(q)
          : await new Promise(res => Alert.alert('Publish notification', q, [{ text: 'Cancel', style: 'cancel', onPress: () => res(false) }, { text: 'Publish', onPress: () => res(true) }]));
        if (!ok) { setBusy(false); return; }
      }
      const r = await backoffice.sendNotification(body);
      setMsg({ ok: true, text: f.type === 'test' ? 'Sent to you. It should pop up on your phone within a few seconds.' : `Sent to ${r.recipients} ${r.recipients === 1 ? 'person' : 'people'}.` });
      if (f.type !== 'test') setF(x => ({ ...x, title: '', body: '' }));
      q.reload();
    } catch (e) { setMsg({ ok: false, text: e.message || 'Could not send.' }); }
    finally { setBusy(false); }
  };
  return { q, f, set, sample, problem, send, busy, msg };
}
export const campaignStats = st => st ? `${fmtN(st.delivered)} delivered · ${fmtN(st.read)} read${st.inFlight ? ` · ${fmtN(st.inFlight)} sending` : ''}${st.noDevice ? ` · ${fmtN(st.noDevice)} inbox only` : ''}${st.failed ? ` · ${fmtN(st.failed)} failed` : ''}` : '';
export const audienceText = a => !a ? '' : a.type === 'test' ? 'Test' : a.type === 'all' ? 'Everyone' : a.type === 'strategy' ? String(a.value || '').replace(/^QODE ADVISORS LLP\s*-\s*/i, '') : `${(a.value || []).length} clients`;

// Status badges for a user: [label, tone] with tone ok | warn | bad | neutral.
export function userBadges(u) {
  if (!u) return [];
  const b = [[u.type === 'distributor' ? 'Distributor' : 'Investor', 'neutral']];
  if (u.locked) b.push(['Locked', 'bad']);
  if (u.needsSetup) b.push(['Needs setup', 'warn']);
  else if (u.passwordSet) b.push(['Password set', 'ok']);
  if (!u.lastLoginAt) b.push(['Never signed in', 'neutral']);
  if (u.headOfFamily) b.push(['Head of family', 'neutral']);
  return b;
}
export const detailsText = d => {
  if (d == null || d === '') return '';
  if (typeof d === 'string') return d;
  try { return Object.entries(d).map(([k, v]) => k + ': ' + (typeof v === 'object' ? JSON.stringify(v) : v)).join(', '); } catch { return ''; }
};

// Paged user list (search, type, status). Newer queries win; loadMore appends the next page.
// Managed accounts (OneView's book): people QUS… with their QAC accounts, searched on the server (name, email, codes).
export function useManagedList(q, tick) {
  const [dq, setDq] = useState(q);
  useEffect(() => { const t = setTimeout(() => setDq(q), 250); return () => clearTimeout(t); }, [q]);
  return useLoad(() => backoffice.managed(dq.trim()), [dq, tick]);
}
const crore = v => (v == null ? '–' : Math.abs(v) >= 1e7 ? '₹' + (v / 1e7).toFixed(2) + ' Cr' : Math.abs(v) >= 1e5 ? '₹' + (v / 1e5).toFixed(2) + ' L' : '₹' + Math.round(v).toLocaleString('en-IN'));
export const managedMoney = crore;
/** "QAC00081 · Managed · QAW++ · ₹62.08 Cr · 17 Aug 2026" lines for one person's accounts. */
export const managedAccountLine = a => [a.qcode, a.strategy ? 'Managed · ' + a.strategy : null, a.closed ? 'Closed' : crore(a.value), a.asOf ? 'as of ' + fmtDay(a.asOf) : 'no data'].filter(Boolean).join(' · ');

export function useUserList({ q = '', type = 'all', status = 'all', tick = 0 }) {
  const [st, setSt] = useState({ items: [], total: 0, page: 0, loading: true, more: false, err: '' });
  const gen = useRef(0);
  const load = useCallback(async page => {
    const g = page === 1 ? ++gen.current : gen.current;
    setSt(s => ({ ...s, loading: page === 1, more: page > 1, err: '' }));
    try {
      const r = await backoffice.users({ q, type, status, page, limit: 50 });
      if (g !== gen.current) return;
      const got = (r && r.items) || [];
      setSt(s => ({ items: page === 1 ? got : [...s.items, ...got], total: (r && r.total) || 0, page, loading: false, more: false, err: '' }));
    } catch (e) {
      if (g !== gen.current) return;
      setSt(s => ({ ...s, loading: false, more: false, err: (e && e.message) || 'Something went wrong.' }));
    }
  }, [q, type, status]);
  useEffect(() => {
    const t = setTimeout(() => load(1), q ? 300 : 0);   // typing: wait for a pause
    return () => clearTimeout(t);
  }, [load, tick]);
  const hasMore = st.items.length < st.total;
  const loadMore = () => { if (!st.loading && !st.more && !st.err && hasMore) load(st.page + 1); };
  return { ...st, hasMore, loadMore, reload: () => load(1) };
}

// Daily sign-ins as stacked bars (app below, web above). Plain Views, so it works on phone and desktop.
export function DailyBars({ daily, height = 90, appColor = C.green, webColor = C.gold, labelColor = C.muted, TxC = Tx }) {
  const rows = daily || [];
  if (!rows.length) return <TxC s={12} c={labelColor}>No sign-ins in this period.</TxC>;
  const max = Math.max(1, ...rows.map(r => (Number(r.web) || 0) + (Number(r.app) || 0)));
  return (
    <View>
      <View style={{ height, flexDirection: 'row', alignItems: 'flex-end', gap: 2 }}>
        {rows.map(r => {
          const w = Number(r.web) || 0, a = Number(r.app) || 0;
          return (
            <View key={r.date} style={{ flex: 1, justifyContent: 'flex-end', height }} accessibilityLabel={`${r.date}: ${w} web, ${a} app`}>
              {w > 0 && <View style={{ height: Math.max(2, (w / max) * height), backgroundColor: webColor, borderTopLeftRadius: 2, borderTopRightRadius: 2 }} />}
              {a > 0 && <View style={{ height: Math.max(2, (a / max) * height), backgroundColor: appColor, borderTopLeftRadius: w ? 0 : 2, borderTopRightRadius: w ? 0 : 2 }} />}
              {!w && !a && <View style={{ height: 1, backgroundColor: 'rgba(55,88,79,0.2)' }} />}
            </View>
          );
        })}
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
        <TxC s={10.5} c={labelColor}>{fmtDay(rows[0].date)}</TxC>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}><View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: appColor }} /><TxC s={10.5} c={labelColor}>App</TxC></View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}><View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: webColor }} /><TxC s={10.5} c={labelColor}>Web</TxC></View>
        </View>
        <TxC s={10.5} c={labelColor}>{fmtDay(rows[rows.length - 1].date)}</TxC>
      </View>
    </View>
  );
}

// ── Impersonation banner (app, partner panel, desktop dashboard) ─────────────────────────────────────────────
// Sits above the shell; on the phone the shell below gets top inset 0, since the banner already clears the notch.
export function ImpersonationFrame({ V, desktop, children }) {
  const insets = useSafeAreaInsets();
  if (!V.imp) return children;
  const bo = V.imp.backoffice;
  const bar = (
    <View style={{ backgroundColor: C.ink, borderBottomWidth: 1, borderColor: C.gold, paddingTop: desktop ? 8 : insets.top + 6, paddingBottom: 8,
      paddingHorizontal: desktop ? 32 : 16, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Tx w={700} s={9.5} ls={0.14} c={C.gold}>{bo ? 'BACKOFFICE' : 'ADMIN MODE'}</Tx>
        <Tx w={700} s={12.5} c={C.cream} numberOfLines={1} style={{ marginTop: 2 }}>Viewing as {V.imp.name}{bo ? ' (opened from the backoffice)' : ''}</Tx>
      </View>
      <Pressable onPress={bo ? V.closeBackoffice : V.backToAdmin} accessibilityRole="button" accessibilityLabel={bo ? 'Close this session' : 'Back to admin'}
        style={{ backgroundColor: C.gold, borderRadius: 8, paddingVertical: 8, paddingHorizontal: 12 }}>
        <Tx w={700} s={11} c={C.ink}>{bo ? 'Close' : 'Back to admin'}</Tx>
      </Pressable>
    </View>
  );
  if (desktop) return <View style={{ flex: 1 }}>{bar}<View style={{ flex: 1 }}>{children}</View></View>;
  return (
    <View style={{ flex: 1 }}>
      {bar}
      <SafeAreaInsetsContext.Provider value={{ ...insets, top: 0 }}>
        <View style={{ flex: 1 }}>{children}</View>
      </SafeAreaInsetsContext.Provider>
    </View>
  );
}

// ── Phone pieces ─────────────────────────────────────────────────────────────────────────────────────────────
const TONE = { ok: [C.pos, 'rgba(22,163,74,0.1)'], warn: ['#8A700C', 'rgba(218,189,56,0.18)'], bad: [C.red, 'rgba(239,68,68,0.1)'], neutral: [C.muted, 'rgba(55,88,79,0.1)'] };
function Badge({ label, tone = 'neutral' }) {
  const [fg, bg] = TONE[tone] || TONE.neutral;
  return (
    <View style={{ backgroundColor: bg, borderRadius: 6, paddingVertical: 3, paddingHorizontal: 7 }}>
      <Tx w={700} s={10} c={fg}>{label}</Tx>
    </View>
  );
}
const Badges = ({ u, style }) => (
  <View style={[{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }, style]}>
    {userBadges(u).map(([l, t]) => <Badge key={l} label={l} tone={t} />)}
  </View>
);

function Tile({ label, value, note, tone }) {
  return (
    <Card style={{ flexGrow: 1, flexBasis: '46%', padding: 14, borderTopWidth: 2, borderTopColor: C.gold }}>
      <Tx w={700} s={10} ls={0.1} c={C.muted}>{label.toUpperCase()}</Tx>
      <Amt w={700} s={20} c={tone === 'bad' ? C.red : tone === 'warn' ? '#8A700C' : C.ink} style={{ marginTop: 6 }}>{value}</Amt>
      {!!note && <Tx s={11} c={C.muted} style={{ marginTop: 3 }} numberOfLines={1}>{note}</Tx>}
    </Card>
  );
}

function Row({ title, sub, right, onPress, last }) {
  const inner = (
    <>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Tx w={700} s={13} numberOfLines={1}>{title}</Tx>
        {!!sub && <Tx s={11} c={C.muted} lh={1.4} style={{ marginTop: 2 }} numberOfLines={2}>{sub}</Tx>}
      </View>
      {right}
    </>
  );
  const style = { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 11, paddingHorizontal: 14, borderBottomWidth: last ? 0 : 1, borderColor: C.hairline };
  return onPress ? <Pressable onPress={onPress} style={({ pressed }) => [style, pressed && { backgroundColor: 'rgba(218,189,56,0.08)' }]}>{inner}</Pressable> : <View style={style}>{inner}</View>;
}

function Overview({ tick }) {
  const o = useLoad(() => backoffice.overview(), [tick]);
  if (o.loading && !o.data) return <Loading rows={4} h={80} />;
  if (o.err) return <ErrorBox msg={o.err} onRetry={o.reload} />;
  const d = o.data || {}, u = d.users || {}, l = d.logins || {};
  const versions = d.appVersions || [], vmax = Math.max(1, ...versions.map(v => Number(v.users) || 0));
  return (
    <>
      <SectionLabel style={{ marginTop: 4 }}>USERS</SectionLabel>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        <Tile label="Investors" value={fmtN(u.investors)} />
        <Tile label="Distributors" value={fmtN(u.distributors)} />
        <Tile label="Password set" value={fmtN(u.passwordSet)} />
        <Tile label="Needs setup" value={fmtN(u.needsSetup)} tone={u.needsSetup ? 'warn' : ''} />
        <Tile label="Never signed in" value={fmtN(u.neverLoggedIn)} />
        <Tile label="Locked" value={fmtN(u.locked)} tone={u.locked ? 'bad' : ''} />
        <Tile label="Open queries" value={fmtN(d.openQueries)} />
        <Tile label="Errors, 7 days" value={fmtN(d.errors7)} tone={d.errors7 ? 'bad' : ''} />
      </View>

      <SectionLabel>SIGN-INS</SectionLabel>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        <Tile label="Today" value={fmtN(l.today)} />
        <Tile label="7 days" value={fmtN(l.last7)} />
        <Tile label="30 days" value={fmtN(l.last30)} note={`Web ${fmtN(l.web30)} · App ${fmtN(l.app30)}`} />
        <Tile label="App, 30 days" value={fmtN(l.app30)} note={`iOS ${fmtN(l.ios30)} · Android ${fmtN(l.android30)}`} />
      </View>
      <Card style={{ padding: 14, marginTop: 10 }}>
        <Tx w={700} s={12} style={{ marginBottom: 10 }}>Daily sign-ins, last 30 days</Tx>
        <DailyBars daily={d.daily} />
      </Card>

      <SectionLabel>APP VERSIONS</SectionLabel>
      {versions.length ? (
        <Card style={{ padding: 14, gap: 10 }}>
          {versions.map(v => (
            <View key={String(v.version)}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Tx w={700} s={12.5}>{v.version || 'Unknown'}</Tx>
                <Amt s={12}>{fmtN(v.users)} users</Amt>
              </View>
              <View style={{ height: 5, borderRadius: 3, backgroundColor: 'rgba(55,88,79,0.1)', marginTop: 5, overflow: 'hidden' }}>
                <View style={{ width: ((Number(v.users) || 0) / vmax) * 100 + '%', height: 5, backgroundColor: C.green }} />
              </View>
            </View>
          ))}
        </Card>
      ) : <Empty>No app usage recorded in the last 30 days.</Empty>}

      <SectionLabel>RECENT SIGN-INS</SectionLabel>
      {(d.recentLogins || []).length ? (
        <Card style={{ overflow: 'hidden' }}>
          {d.recentLogins.map((r, i, a) => (
            <Row key={i} last={i === a.length - 1} title={r.name || r.email} sub={[r.email, [r.platform, r.os].filter(Boolean).join(' / ')].filter(Boolean).join(' · ')}
              right={<Tx s={11} c={C.muted}>{fmtAgo(r.at)}</Tx>} />
          ))}
        </Card>
      ) : <Empty>No sign-ins yet.</Empty>}

      <SectionLabel>RECENT ERRORS</SectionLabel>
      {(d.recentErrors || []).length ? (
        <Card style={{ overflow: 'hidden' }}>
          {d.recentErrors.map((r, i, a) => (
            <Row key={i} last={i === a.length - 1} title={r.name || 'Error'} sub={r.message}
              right={<View style={{ alignItems: 'flex-end' }}><Amt w={700} s={12} c={C.red}>{fmtN(r.count)}x</Amt><Tx s={10.5} c={C.muted}>{fmtAgo(r.lastAt)}</Tx></View>} />
          ))}
        </Card>
      ) : <Empty>No errors in the last 7 days.</Empty>}
    </>
  );
}

function SearchBox({ value, onChange, placeholder }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.card, borderWidth: 1, borderColor: 'rgba(55,88,79,0.2)', borderRadius: 999, paddingHorizontal: 14, height: 44 }}>
      <Search />
      <TextInput value={value} onChangeText={onChange} placeholder={placeholder} placeholderTextColor={C.gray} autoCapitalize="none" autoCorrect={false}
        style={{ flex: 1, fontFamily: 'Lato_400Regular', fontSize: 14, color: C.ink, paddingVertical: 0 }} />
    </View>
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
    <>
      <Tx s={12} c={C.muted} lh={1.5} style={{ marginBottom: 12 }}>OneView managed accounts (people QUS…, accounts QAC…). Tap a person to view their portfolio in the app, read-only.</Tx>
      <SearchBox value={q} onChange={setQ} placeholder="Search name, email, QUS or QAC code" />
      {!!st.err && <Tx s={12} c={C.red} style={{ marginTop: 10 }}>{st.err}</Tx>}
      <Tx s={11} c={C.muted} style={{ marginTop: 12, marginBottom: 8, marginLeft: 2 }}>{L.loading ? 'Loading…' : `${fmtN(people.length)} ${people.length === 1 ? 'person' : 'people'}`}</Tx>
      {L.loading && !people.length && <Loading rows={5} />}
      {!!L.err && <ErrorBox msg={L.err} onRetry={L.reload} />}
      {!L.loading && !L.err && !people.length && <Empty>No managed accounts match.</Empty>}
      {people.length > 0 && (
        <Card style={{ overflow: 'hidden', opacity: L.loading ? 0.6 : 1 }}>
          {people.map((p, i, a) => (
            <Pressable key={p.icode} onPress={() => open(p)} style={({ pressed }) => [{ paddingVertical: 12, paddingHorizontal: 14, borderBottomWidth: i === a.length - 1 ? 0 : 1, borderColor: C.hairline, opacity: pressed || st.busy === p.icode ? 0.6 : 1 }]}>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
                <Tx w={700} s={13.5} numberOfLines={1} style={{ flex: 1 }}>{p.name}</Tx>
                <Tx w={700} s={11.5} c={C.green}>{st.busy === p.icode ? 'Opening…' : 'View ›'}</Tx>
              </View>
              <Tx s={11.5} c={C.muted} numberOfLines={1} style={{ marginTop: 2 }}>{[p.icode, p.email].filter(Boolean).join(' · ')}</Tx>
              {p.accounts.map(x => <Tx key={x.qcode} s={11} c={x.closed ? C.gray : C.ink} numberOfLines={1} style={{ marginTop: 3 }}>{managedAccountLine(x)}</Tx>)}
            </Pressable>
          ))}
        </Card>
      )}
    </>
  );
}

function UserList({ V, fixedType, endRef, tick }) {
  const [q, setQ] = useState('');
  const [type, setType] = useState('all');
  const [status, setStatus] = useState('all');
  const [mine, setMine] = useState(0);
  const [newOpen, setNewOpen] = useState(false);
  const list = useUserList({ q: q.trim(), type: fixedType || type, status, tick: tick + mine });
  endRef.current = list.loadMore;
  useEffect(() => () => { endRef.current = null; }, []);
  return (
    <>
      {fixedType === 'distributor' && <CTA label="+ NEW DISTRIBUTOR" onPress={() => setNewOpen(true)} style={{ marginBottom: 14 }} />}
      <SearchBox value={q} onChange={setQ} placeholder="Search name, email or client code" />
      {!fixedType && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
          {TYPE_OPTS.map(([k, l]) => <Chip key={k} label={l} active={type === k} onPress={() => setType(k)} />)}
        </View>
      )}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
        {STATUS_OPTS.map(([k, l]) => <Chip key={k} label={l} active={status === k} onPress={() => setStatus(k)} py={6} px={11} s={10.5} />)}
      </View>
      <Tx s={11} c={C.muted} style={{ marginTop: 12, marginBottom: 8, marginLeft: 2 }}>
        {list.loading ? 'Loading…' : `${fmtN(list.total)} ${list.total === 1 ? 'user' : 'users'}`}
      </Tx>
      {list.loading && !list.items.length && <Loading rows={5} />}
      {!!list.err && <ErrorBox msg={list.err} onRetry={list.reload} />}
      {!list.loading && !list.err && !list.items.length && <Empty>No users match.</Empty>}
      {list.items.length > 0 && (
        <Card style={{ overflow: 'hidden', opacity: list.loading ? 0.6 : 1 }}>
          {list.items.map((u, i, a) => (
            <Pressable key={u.email + i} onPress={() => V.setAdm({ email: u.email })} style={({ pressed }) => [{ paddingVertical: 12, paddingHorizontal: 14, borderBottomWidth: i === a.length - 1 ? 0 : 1, borderColor: C.hairline }, pressed && { backgroundColor: 'rgba(218,189,56,0.08)' }]}>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
                <Tx w={700} s={13.5} numberOfLines={1} style={{ flex: 1 }}>{u.name || u.email}</Tx>
                <Tx s={10.5} c={C.muted}>{fmtAgo(u.lastLoginAt)}</Tx>
              </View>
              <Tx s={11.5} c={C.muted} numberOfLines={1} style={{ marginTop: 2 }}>
                {[u.email, u.type === 'distributor' ? fmtN(u.clientCount) + ' investors' : (u.clientCodes || []).join(', ')].filter(Boolean).join(' · ')}
              </Tx>
              <Badges u={u} style={{ marginTop: 7 }} />
            </Pressable>
          ))}
        </Card>
      )}
      {list.more && <Tx s={12} c={C.muted} center style={{ marginTop: 14 }}>Loading more…</Tx>}
      {list.hasMore && !list.more && !list.loading && !list.err && (
        <Pressable onPress={list.loadMore} style={{ padding: 14, alignItems: 'center' }}><Tx w={700} s={12.5} c={C.green}>Load more</Tx></Pressable>
      )}
      <NewDistributorSheet V={V} visible={newOpen} onClose={() => setNewOpen(false)} onDone={() => { setNewOpen(false); setMine(m => m + 1); }} />
    </>
  );
}

function NewDistributorSheet({ V, visible, onClose, onDone }) {
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
    <Sheet visible={visible} onClose={onClose}>
      <View style={{ paddingHorizontal: 22, paddingTop: 8, gap: 16 }}>
        <Tx f="play" w={600} s={19}>New distributor</Tx>
        <Field label="NAME" value={f.name} onChangeText={upd('name')} placeholder="Full name or firm" autoCapitalize="words" />
        <Field label="EMAIL" value={f.email} onChangeText={upd('email')} placeholder="name@example.com" keyboardType="email-address" autoCapitalize="none" />
        <Field label="PASSWORD" value={f.pw} onChangeText={upd('pw')} secure autoCapitalize="none" hint="8+ characters, with a letter and a digit." />
        <Field label="FEE %" value={f.fee} onChangeText={upd('fee')} keyboardType="decimal-pad" placeholder="Optional" />
        {!!err && <Tx s={12} c={C.red}>{err}</Tx>}
        <CTA label={busy ? 'CREATING…' : 'CREATE DISTRIBUTOR'} onPress={submit} />
      </View>
    </Sheet>
  );
}

function PasswordSheet({ visible, onClose, onSave, busy, err: outerErr, name }) {
  const [a, setA] = useState(''), [b, setB] = useState(''), [err, setErr] = useState('');
  useEffect(() => { if (visible) { setA(''); setB(''); setErr(''); } }, [visible]);
  const save = () => { const bad = pwProblem(a, b); if (bad) return setErr(bad); onSave(a); };
  return (
    <Sheet visible={visible} onClose={onClose}>
      <View style={{ paddingHorizontal: 22, paddingTop: 8, gap: 16 }}>
        <View>
          <Tx f="play" w={600} s={19}>Set password</Tx>
          <Tx s={12} c={C.muted} lh={1.5} style={{ marginTop: 4 }}>For {name}. Also clears failed attempts and any lock. The user is not notified.</Tx>
        </View>
        <Field label="NEW PASSWORD" value={a} onChangeText={t => { setA(t); setErr(''); }} secure autoCapitalize="none" hint="8+ characters, with a letter and a digit." />
        <Field label="CONFIRM PASSWORD" value={b} onChangeText={t => { setB(t); setErr(''); }} secure autoCapitalize="none" />
        {!!(err || outerErr) && <Tx s={12} c={C.red}>{err || outerErr}</Tx>}
        <CTA label={busy ? 'SAVING…' : 'SET PASSWORD'} onPress={busy ? undefined : save} />
      </View>
    </Sheet>
  );
}

function ConfirmSheet({ visible, onClose, title, body, label, danger, busy, err, onConfirm }) {
  return (
    <Sheet visible={visible} onClose={onClose}>
      <View style={{ paddingHorizontal: 22, paddingTop: 8, gap: 12 }}>
        <Tx f="play" w={600} s={19}>{title}</Tx>
        <Tx s={13} c={C.muted} lh={1.55}>{body}</Tx>
        {!!err && <Tx s={12} c={C.red}>{err}</Tx>}
        <Pressable onPress={busy ? undefined : onConfirm} style={{ marginTop: 6, borderRadius: 8, paddingVertical: 15, alignItems: 'center', backgroundColor: danger ? C.red : C.green, opacity: busy ? 0.6 : 1 }}>
          <Tx w={700} s={13} ls={0.08} c={danger ? '#fff' : C.gold}>{busy ? 'PLEASE WAIT…' : label}</Tx>
        </Pressable>
        <CTA label="CANCEL" outline onPress={onClose} />
      </View>
    </Sheet>
  );
}

function ActionBtn({ label, onPress, busy, danger, primary }) {
  return (
    <Pressable onPress={busy ? undefined : onPress} style={({ pressed }) => ({
      flexGrow: 1, flexBasis: '46%', paddingVertical: 12, borderRadius: 8, alignItems: 'center', borderWidth: 1,
      backgroundColor: primary ? C.green : pressed ? 'rgba(218,189,56,0.08)' : 'transparent',
      borderColor: primary ? C.green : danger ? 'rgba(239,68,68,0.45)' : 'rgba(2,66,43,0.35)', opacity: busy ? 0.6 : 1,
    })}>
      <Tx w={700} s={12} c={primary ? C.gold : danger ? C.red : C.green}>{busy ? 'Please wait…' : label}</Tx>
    </Pressable>
  );
}

// The actions on one user, shared by phone and desktop (state + calls; each layout draws its own buttons).
export function useUserActions({ V, email, name, reload, onDeleted }) {
  const [sheet, setSheet] = useState(null);   // 'pw' | 'reset' | 'unlock' | 'delete'
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');
  const run = async (key, fn, okMsg, after) => {
    if (busy) return;
    setBusy(key); setErr('');
    try {
      await fn();
      if (okMsg) V.toast(okMsg);
      setSheet(null);
      if (after) after(); else if (reload) reload();
    } catch (e) { setErr((e && e.message) || 'Something went wrong.'); }
    finally { setBusy(''); }
  };
  return {
    sheet, busy, err,
    open: k => { setErr(''); setSheet(k); }, close: () => { setSheet(null); setErr(''); },
    openAsUser: () => run('open', () => V.openAsUser({ email, name }), '', () => {}),
    setPassword: pw => run('pw', () => backoffice.setPassword(email, pw), 'Password updated'),
    resetLink: () => run('reset', () => backoffice.resetLink(email), 'Reset link sent'),
    unlock: () => run('unlock', () => backoffice.unlock(email), 'Account unlocked'),
    remove: () => run('delete', () => backoffice.deleteDistributor(email), 'Distributor deleted', onDeleted),
  };
}

function KV({ k, v }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 7 }}>
      <Tx s={12} c={C.muted}>{k}</Tx>
      <Tx w={700} s={12} style={{ flexShrink: 1, textAlign: 'right' }}>{v}</Tx>
    </View>
  );
}

function UserDetail({ V, email, onBack }) {
  const det = useLoad(() => backoffice.userDetail(email), [email]);
  const [allLogins, setAllLogins] = useState(false);
  const d = det.data || {}, u = d.user || null;
  const name = (u && (u.name || u.email)) || email;
  const A = useUserActions({ V, email, name, reload: det.reload, onDeleted: onBack });
  const back = (
    <Pressable onPress={onBack} style={{ paddingVertical: 6, marginBottom: 8, alignSelf: 'flex-start' }}>
      <Tx w={700} s={12.5} c={C.green}>‹ Back</Tx>
    </Pressable>
  );
  if (det.loading && !det.data) return <>{back}<Loading rows={4} h={80} /></>;
  if (det.err) return <>{back}<ErrorBox msg={det.err} onRetry={det.reload} /></>;
  if (!u) return <>{back}<Empty>This user was not found.</Empty></>;
  const isDist = u.type === 'distributor';
  const logins = d.logins || [];
  return (
    <>
      {back}
      <Card style={{ padding: 16 }}>
        <Tx f="play" w={600} s={20}>{u.name || u.email}</Tx>
        <Tx s={12} c={C.muted} style={{ marginTop: 3 }}>{u.email}</Tx>
        <Badges u={u} style={{ marginTop: 10 }} />
        <View style={{ marginTop: 10, borderTopWidth: 1, borderColor: C.hairline, paddingTop: 4 }}>
          {!isDist && !!(u.clientCodes || []).length && <KV k="Client codes" v={u.clientCodes.join(', ')} />}
          {isDist && <KV k="Investors" v={fmtN(u.clientCount)} />}
          {!!u.intermediary && <KV k="Intermediary" v={u.intermediary} />}
          {!!u.groupId && <KV k="Group" v={String(u.groupId)} />}
          <KV k="Last sign-in" v={u.lastLoginAt ? fmtWhen(u.lastLoginAt) : 'Never'} />
          <KV k="Sign-ins" v={`${fmtN(u.loginCount)} (web ${fmtN(u.webLogins)}, app ${fmtN(u.appLogins)})`} />
        </View>
      </Card>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
        <ActionBtn primary label="Open as user" busy={A.busy === 'open'} onPress={A.openAsUser} />
        <ActionBtn label="Set password" onPress={() => A.open('pw')} />
        <ActionBtn label="Send reset link" onPress={() => A.open('reset')} />
        <ActionBtn label="Unlock" onPress={() => A.open('unlock')} />
        {isDist && <ActionBtn danger label="Delete distributor" onPress={() => A.open('delete')} />}
      </View>
      {!!A.err && !A.sheet && <Tx s={12} c={C.red} style={{ marginTop: 10 }}>{A.err}</Tx>}

      {!isDist && (
        <>
          <SectionLabel>ACCOUNTS</SectionLabel>
          {(d.accounts || []).length ? (
            <Card style={{ overflow: 'hidden' }}>
              {d.accounts.map((a, i, arr) => (
                <Row key={a.clientId || a.clientCode || i} last={i === arr.length - 1} title={[a.clientCode, a.strategy].filter(Boolean).join(' · ')}
                  sub={[a.name, a.headOfFamily ? 'Head of family' : '', a.groupId ? 'Group ' + a.groupId : '', a.maturityDate ? 'Matures ' + fmtDay(a.maturityDate) : ''].filter(Boolean).join(' · ')}
                  right={a.status ? <Badge label={String(a.status)} tone={/active/i.test(a.status) ? 'ok' : 'neutral'} /> : null} />
              ))}
            </Card>
          ) : <Empty>No accounts.</Empty>}
        </>
      )}

      {isDist && (
        <>
          <SectionLabel>INVESTORS</SectionLabel>
          {(d.investors || []).length ? (
            <Card style={{ overflow: 'hidden' }}>
              {d.investors.map((x, i, arr) => (
                <Row key={(x.email || '') + i} last={i === arr.length - 1} title={x.name || x.email} sub={[x.email, (x.clientCodes || []).join(', ')].filter(Boolean).join(' · ')}
                  onPress={x.email ? () => V.setAdm({ email: x.email }) : undefined} />
              ))}
            </Card>
          ) : <Empty>No investors under this distributor.</Empty>}
        </>
      )}

      <SectionLabel>RECENT SIGN-INS</SectionLabel>
      {logins.length ? (
        <Card style={{ overflow: 'hidden' }}>
          {(allLogins ? logins : logins.slice(0, 8)).map((r, i, arr) => (
            <Row key={i} last={i === arr.length - 1} title={fmtWhen(r.at)} right={<Tx s={11.5} c={C.muted}>{[r.platform, r.os].filter(Boolean).join(' / ')}</Tx>} />
          ))}
          {logins.length > 8 && (
            <Pressable onPress={() => setAllLogins(v => !v)} style={{ padding: 12, alignItems: 'center', borderTopWidth: 1, borderColor: C.hairline }}>
              <Tx w={700} s={12} c={C.green}>{allLogins ? 'Show fewer' : `Show all ${logins.length}`}</Tx>
            </Pressable>
          )}
        </Card>
      ) : <Empty>No sign-ins recorded.</Empty>}

      <SectionLabel>APP</SectionLabel>
      {d.app ? (
        <Card style={{ paddingHorizontal: 14, paddingVertical: 6 }}>
          <KV k="Version" v={d.app.lastVersion || 'Unknown'} />
          <KV k="Platform" v={d.app.platform || 'Unknown'} />
          <KV k="Last seen" v={fmtWhen(d.app.lastSeenAt) || 'Unknown'} />
        </Card>
      ) : <Empty>Has not used the app.</Empty>}

      <SectionLabel>BACKOFFICE ACTIONS</SectionLabel>
      {(d.audit || []).length ? (
        <Card style={{ overflow: 'hidden' }}>
          {d.audit.map((r, i, arr) => (
            <Row key={i} last={i === arr.length - 1} title={r.action} sub={[r.admin, detailsText(r.details)].filter(Boolean).join(' · ')}
              right={<Tx s={11} c={C.muted}>{fmtAgo(r.at)}</Tx>} />
          ))}
        </Card>
      ) : <Empty>No backoffice actions on this user.</Empty>}

      <PasswordSheet visible={A.sheet === 'pw'} onClose={A.close} onSave={A.setPassword} busy={A.busy === 'pw'} err={A.err} name={name} />
      <ConfirmSheet visible={A.sheet === 'reset'} onClose={A.close} title="Send reset link" busy={A.busy === 'reset'} err={A.err} onConfirm={A.resetLink}
        label="SEND LINK" body={`Email ${u.email} the standard link to set a new password.`} />
      <ConfirmSheet visible={A.sheet === 'unlock'} onClose={A.close} title="Unlock account" busy={A.busy === 'unlock'} err={A.err} onConfirm={A.unlock}
        label="UNLOCK" body="Clears failed sign-in attempts and any lock, so the user can sign in again straight away." />
      <ConfirmSheet visible={A.sheet === 'delete'} onClose={A.close} title="Delete distributor" danger busy={A.busy === 'delete'} err={A.err} onConfirm={A.remove}
        label="DELETE" body={`Delete the distributor login for ${u.email}? This cannot be undone. Their investors are not changed.`} />
    </>
  );
}

function AuditList({ V, tick }) {
  const a = useLoad(() => backoffice.audit({ limit: 100 }), [tick]);
  if (a.loading && !a.data) return <Loading rows={6} />;
  if (a.err) return <ErrorBox msg={a.err} onRetry={a.reload} />;
  const items = (a.data && a.data.items) || [];
  if (!items.length) return <Empty>No backoffice actions yet.</Empty>;
  return (
    <Card style={{ overflow: 'hidden' }}>
      {items.map((r, i) => (
        <Row key={r.id || i} last={i === items.length - 1} title={r.action + (r.target ? ' · ' + r.target : '')}
          sub={[fmtWhen(r.at), r.admin, detailsText(r.details)].filter(Boolean).join(' · ')}
          onPress={r.target && /@/.test(r.target) ? () => V.setAdm({ email: r.target }) : undefined} />
      ))}
    </Card>
  );
}

// Notifications (phone): the same composer as the desktop console, compact.
function NotifList({ tick }) {
  const { q, f, set, sample, problem, send, busy, msg } = useNotifAdmin(tick);
  const d = q.data;
  if (q.loading && !d) return <Loading rows={4} />;
  if (q.err && !d) return <ErrorBox msg={q.err} onRetry={q.reload} />;
  if (d && d.ready === false) return <Empty>The notification tables aren’t created on the server yet.</Empty>;
  const pill = (k, l, on, onPress) => <Chip key={k} label={l} active={on} onPress={onPress} />;
  return (
    <>
      {/* this phone's own permission: admin mode has no Home card or More → Notifications, so it is asked here */}
      <DeviceCard />
      <View style={{ height: 12 }} />
      <Card style={{ padding: 16 }}>
        <Tx w={700} s={13}>{d.live ? 'Automatic notifications are on' : 'Automatic notifications are off (PUSH_LIVE)'}. Your own notifications can be published any time.</Tx>
        <Tx s={11.5} c={C.muted} style={{ marginTop: 4 }}>{fmtN(d.devices && d.devices.active)} phones · {fmtN(d.outbox && d.outbox.created24h)} sent in 24 h · {fmtN(d.outbox && d.outbox.failed24h)} failed</Tx>
      </Card>
      <SectionLabel>NEW NOTIFICATION</SectionLabel>
      <Card style={{ padding: 16, gap: 12 }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{NOTE_SAMPLES.map(x => pill(x.key, 'Sample: ' + x.label, false, () => sample(x)))}</View>
        <Field label={`TITLE (${f.title.length}/90)`} value={f.title} onChangeText={t => set({ title: t })} s={14} />
        <Field label={`MESSAGE (${f.body.length}/300)`} value={f.body} onChangeText={t => set({ body: t })} multiline s={14} />
        <Tx w={700} s={10.5} ls={0.12} c={C.muted}>OPENS</Tx>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{NOTE_LINKS.map(([k, l]) => pill(k || 'home', l, f.link === k, () => set({ link: k })))}</View>
        <Tx w={700} s={10.5} ls={0.12} c={C.muted}>SEND TO</Tx>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{AUDIENCES.map(([k, l]) => pill(k, l, f.type === k, () => set({ type: k, value: '' })))}</View>
        {f.type === 'strategy' && <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{(d.strategies || []).map(x => pill(x, x.replace(/^QODE ADVISORS LLP\s*-\s*/i, ''), f.value === x, () => set({ value: x })))}</View>}
        {f.type === 'emails' && <Field label="CLIENT EMAILS" value={f.value} onChangeText={t => set({ value: t })} multiline s={14} autoCapitalize="none" />}
        {!!msg && <Tx s={12.5} c={msg.ok ? C.pos : C.red}>{msg.text}</Tx>}
        <CTA label={busy ? 'SENDING…' : f.type === 'test' ? 'SEND TO MY PHONE' : 'SEND'} onPress={send} style={{ opacity: problem || busy ? 0.5 : 1 }} />
        {!!problem && <Tx s={11.5} c={C.muted} center>{problem}</Tx>}
      </Card>
      <SectionLabel>SENT</SectionLabel>
      {(d.campaigns || []).length ? (
        <Card style={{ overflow: 'hidden' }}>
          {d.campaigns.map((c, i) => <Row key={c.id} last={i === d.campaigns.length - 1} title={c.title} sub={[fmtWhen(c.createdAt), audienceText(c.audience), campaignStats(c.stats)].filter(Boolean).join(' · ')} />)}
        </Card>
      ) : <Empty>Nothing sent yet.</Empty>}
    </>
  );
}

// ── The console ──────────────────────────────────────────────────────────────────────────────────────────────
export function AdminConsole({ V }) {
  const insets = useSafeAreaInsets();
  const tab = V.adm.tab || 'overview', email = V.adm.email || null;
  const [tick, setTick] = useState(0);
  const endRef = useRef(null);
  const scrollRef = useRef(null);
  const go = t => V.setAdm({ tab: t, email: null });
  useBackHandler(() => {
    if (V.adm.email) { V.setAdm({ email: null }); return true; }
    if ((V.adm.tab || 'overview') !== 'overview') { go('overview'); return true; }
    return false;
  });
  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTo({ y: 0, animated: false }); }, [tab, email]);
  const onScroll = e => {
    const { layoutMeasurement: l, contentOffset: o, contentSize: c } = e.nativeEvent;
    if (!email && l.height + o.y >= c.height - 600 && endRef.current) endRef.current();
  };
  const name = (V.user && (V.user.name || V.user.email)) || 'Admin';
  return (
    <View style={{ flex: 1, backgroundColor: C.cream }}>
      <KeyboardScroll ref={scrollRef} onScroll={onScroll} contentContainerStyle={{ paddingBottom: 80 }}
        refreshControl={<RefreshControl refreshing={false} onRefresh={() => setTick(t => t + 1)} tintColor={C.gold} />}>
        <LinearGradient colors={C.darkGrad} locations={[0, 0.62, 1]} start={{ x: 0.1, y: 0 }} end={{ x: 0.6, y: 1 }} style={{ paddingBottom: 80 }}>
          <GoldThreads height={260} />
          <View style={{ paddingTop: insets.top + 12, paddingHorizontal: 22, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Tx w={700} s={10} ls={0.18} c={C.gold}>MYQODE ADMIN</Tx>
              <Tx f="play" w={600} s={21} c={C.cream} numberOfLines={1} style={{ marginTop: 4 }}>{name}</Tx>
            </View>
            <Pressable onPress={() => setTick(t => t + 1)} accessibilityLabel="Refresh" style={{ width: 42, height: 42, borderRadius: 21, borderWidth: 1, borderColor: 'rgba(239,236,211,0.22)', alignItems: 'center', justifyContent: 'center' }}>
              <Refresh />
            </Pressable>
          </View>
          {V.testMode && (
            <View style={{ paddingTop: 10, paddingHorizontal: 22, flexDirection: 'row' }}>
              <View style={{ borderWidth: 1, borderColor: C.red, borderRadius: 999, paddingVertical: 4, paddingHorizontal: 10 }}>
                <Tx w={700} s={9.5} ls={0.18} c={C.red}>TEST MODE · RESET EMAILS BLOCKED</Tx>
              </View>
            </View>
          )}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 22, marginTop: 16 }}>
            {ADMIN_TABS.map(([k, l]) => {
              const on = tab === k;
              return (
                <Pressable key={k} onPress={() => (on && !email ? null : go(k))} accessibilityRole="tab" accessibilityState={{ selected: on }}
                  style={{ paddingVertical: 7, paddingHorizontal: 13, borderRadius: 999, borderWidth: 1, borderColor: on ? C.gold : 'rgba(239,236,211,0.3)', backgroundColor: on ? C.gold : 'transparent' }}>
                  <Tx w={700} s={11.5} c={on ? C.ink : C.cream80}>{l}</Tx>
                </Pressable>
              );
            })}
          </View>
        </LinearGradient>
        <View style={{ marginTop: -46 }}><CurveCap height={44} /></View>
        <View style={{ backgroundColor: C.cream, paddingHorizontal: 20, minHeight: 420 }}>
          {email ? <UserDetail key={email} V={V} email={email} onBack={() => V.setAdm({ email: null })} />
            : tab === 'users' ? <UserList key="users" V={V} endRef={endRef} tick={tick} />
            : tab === 'distributors' ? <UserList key="dist" V={V} fixedType="distributor" endRef={endRef} tick={tick} />
            : tab === 'managed' ? <ManagedList V={V} tick={tick} />
            : tab === 'audit' ? <AuditList V={V} tick={tick} />
            : tab === 'notifications' ? <NotifList tick={tick} />
            : <>{/* notifications off on this phone: one tap to Settings, so Zoho alerts reach it */}<PushOfferCard V={V} /><View style={{ height: V.pushOffer ? 12 : 0 }} /><Overview tick={tick} /></>}
          <SignOutButton onPress={V.doLogout} style={{ marginTop: 30 }} />
        </View>
      </KeyboardScroll>
    </View>
  );
}
