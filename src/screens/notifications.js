// Settings → Notifications: whether this phone may show popups, and which kinds the login wants
// (GET/PUT /api/mobile/notifications/prefs). Money notifications are always on: they are about the client's money.
// Used by the phone (PAGES) and the desktop web (DESKTOP_PAGES), where only the inbox exists.
import React, { useEffect, useState } from 'react';
import { View, Platform, AppState } from 'react-native';
import { C, Tx, Card, Toggle, CTA } from '../ui';
import { notifications } from '../api';
import { useLoad, Loading, ErrorBox, SectionLabel } from './kit';
import * as push from '../push';

import { userMessage } from '../errors';
const KINDS = [
  ['money', 'Money in and out', 'Payments received, investments and withdrawals recorded, SIP instalments. Always on.'],
  ['portfolio', 'Portfolio updates', 'Your monthly update, new highs, milestones and account anniversaries.'],
  ['reading', 'Reading from Qode', 'New newsletters and perspectives from the fund managers.'],
  ['updates', 'Announcements', 'Occasional news from Qode about your account and our services.'],
];

export function DeviceCard() {
  const [perm, setPerm] = useState(null);
  const [status, setStatus] = useState(push.lastStatus);   // registration result, kept in state so the card updates
  const check = () => push.permission().then(setPerm);
  const reg = () => push.register().then(() => { setStatus(push.lastStatus); check(); });
  useEffect(() => { check(); reg(); const sub = AppState.addEventListener('change', st => { if (st === 'active') check(); }); return () => sub.remove(); }, []);
  if (Platform.OS === 'web' || perm === 'unsupported') {
    return <Card style={{ padding: 16 }}><Tx s={12.5} c={C.muted} lh={1.55}>Popups appear on your phone through the myQode app. Here on the web, they are under the bell at the top of the page.</Tx></Card>;
  }
  if (perm === null) return null;
  const on = perm === 'granted';
  return (
    <Card style={{ padding: 16 }}>
      <Tx w={700} s={13.5}>{on ? 'Notifications are on for this phone' : 'Notifications are off for this phone'}</Tx>
      <Tx s={12} c={C.muted} lh={1.5} style={{ marginTop: 4 }}>
        {on ? 'You’ll get a popup the moment something happens.'
          : perm === 'denied' ? 'Turn them on in your phone’s settings to hear about money in and out of your accounts as it happens.'
            : 'Turn them on to hear about money in and out of your accounts as it happens.'}
      </Tx>
      {on && <Tx s={11} c={C.gray} style={{ marginTop: 6 }}>{status || 'Checking…'}</Tx>}
      {on && !!status && status !== 'Registered' && <CTA outline label="TRY AGAIN" style={{ marginTop: 12, paddingVertical: 10 }} onPress={() => { setStatus(''); reg(); }} />}
      {!on && <CTA label={perm === 'denied' ? 'OPEN SETTINGS' : 'TURN ON NOTIFICATIONS'} style={{ marginTop: 14, paddingVertical: 12 }}
        onPress={async () => { if (perm === 'denied') push.openSettings(); else { const p = await push.ask(); setPerm(p); if (p === 'granted') reg(); } }} />}
    </Card>
  );
}

export function NotificationSettings() {
  const q = useLoad(() => notifications.prefs(), []);
  const [p, setP] = useState(null);
  const [err, setErr] = useState('');
  useEffect(() => { if (q.data) setP(q.data); }, [q.data]);
  if (q.loading && !p) return <Loading />;
  if (q.err && !p) return <ErrorBox msg={q.err} onRetry={q.reload} />;
  const flip = async k => {
    if (k === 'money') return;
    const prev = p, next = { ...p, [k]: !p[k] };
    setP(next); setErr('');
    try { setP(await notifications.savePrefs({ [k]: next[k] })); }
    catch (e) { setP(prev); setErr(userMessage(e, 'We couldn’t save that. Please try again.')); }
  };
  return (
    <>
      <DeviceCard />
      <SectionLabel>WHAT TO TELL YOU ABOUT</SectionLabel>
      <Card style={{ paddingHorizontal: 16, paddingVertical: 4 }}>
        {KINDS.map(([k, title, sub], i) => (
          <View key={k} style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, borderBottomWidth: i < KINDS.length - 1 ? 1 : 0, borderColor: C.hairline }}>
            <View style={{ flex: 1 }}>
              <Tx w={700} s={13}>{title}</Tx>
              <Tx s={11.5} c={C.muted} lh={1.45} style={{ marginTop: 3 }}>{sub}</Tx>
            </View>
            <View style={{ opacity: k === 'money' ? 0.45 : 1 }}><Toggle on={!!(p && p[k])} onPress={() => flip(k)} /></View>
          </View>
        ))}
      </Card>
      {!!err && <Tx s={12} c={C.red} style={{ marginTop: 10 }}>{err}</Tx>}
      <Tx s={11.5} c={C.muted} lh={1.5} style={{ marginTop: 10 }}>Popups are never sent between 9 pm and 9 am, except about money. Everything also stays under the bell.</Tx>
    </>
  );
}

/** Home card: a friendly ask before the system prompt, as banking apps do. "Not now" hides it for 14 days. */
export function PushOfferCard({ V }) {
  if (!V.pushOffer) return null;
  return (
    <Card style={{ padding: 16, marginTop: 16, borderLeftWidth: 3, borderLeftColor: C.gold }}>
      <Tx w={700} s={14}>{V.pushOfferSettings ? 'Notifications are off' : 'Know the moment your money moves'}</Tx>
      <Tx s={12} c={C.muted} lh={1.5} style={{ marginTop: 4 }}>{V.pushOfferSettings
        ? (V.adminMode ? 'Turn them on to get an alert for every new Capital Inflow and Scheme Clarification. Tap below, then switch on Allow Notifications.'
          : 'Turn them on for payments received, investments recorded and your monthly portfolio update. Tap below, then switch on Allow Notifications.')
        : 'Turn on notifications for payments received, investments recorded and your monthly portfolio update.'}</Tx>
      <View style={{ flexDirection: 'row', gap: 10, marginTop: 14, alignItems: 'center' }}>
        <CTA label={V.pushOfferSettings ? 'OPEN SETTINGS' : 'TURN ON'} onPress={V.pushOfferYes} style={{ flex: 1, paddingVertical: 11 }} />
        <Tx w={700} s={12.5} c={C.muted} onPress={V.pushOfferNo} style={{ paddingHorizontal: 14, paddingVertical: 10 }}>Not now</Tx>
      </View>
    </Card>
  );
}
