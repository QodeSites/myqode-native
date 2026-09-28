// "Your details on Nuvama" for the desktop web: what the custodian holds for the investor, so they can check it —
// the primary UCC to sign in to WealthSpectrum with, each account, the registered contact and the bank account.
// Data: GET /api/mobile/nuvama-details (PAN, mobile and bank account arrive masked).
import React, { useState } from 'react';
import { View, Pressable, Linking } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { C, Tx, Row, Panel, Table, KeyVals, Pill, Btn, Loading, ErrorBlock, Label } from './kit';
import { meta } from '../api';
import { useLoad } from '../screens/kit';
import { fmtDate } from '../adapt';

const d = v => (v ? fmtDate(v) : '–');
const title = s => String(s || '').replace(/^QODE ADVISORS LLP\s*-\s*/i, '').toLowerCase().replace(/\b\w/g, c => c.toUpperCase()) || '–';

const ACCOUNT_COLS = [
  { key: 'code', label: 'UCC', flex: 0.9, render: a => <Tx w={600} s={13}>{a.code}</Tx> },
  { key: 'scheme', label: 'Scheme', flex: 1.5, render: a => <View><Tx s={13} numberOfLines={1}>{title(a.scheme)}</Tx><Tx s={11.5} c={C.ink3} numberOfLines={1}>{a.holder || ''}</Tx></View> },
  { key: 'type', label: 'Account type', render: a => <Tx s={13}>{a.accountType || '–'}</Tx> },
  { key: 'opened', label: 'Opened on', render: a => <Tx s={13}>{d(a.openedOn)}</Tx> },
  { key: 'inception', label: 'Inception', render: a => <Tx s={13}>{d(a.inceptionDate)}</Tx> },
  { key: 'rm', label: 'Relationship manager', flex: 1.2, render: a => <Tx s={13} numberOfLines={1}>{a.rm || '–'}</Tx> },
  { key: 'dist', label: 'Distributor', flex: 1.2, render: a => <Tx s={13} numberOfLines={1}>{a.distributor ? title(a.distributor) : 'Direct'}</Tx> },
  { key: 'status', label: 'Status', flex: 0.7, right: true, render: a => <Pill label={a.active ? 'Active' : 'Closed'} tone={a.active ? 'ok' : 'neutral'} /> },
];

export function NuvamaDetails({ compact }) {
  const q = useLoad(() => meta.nuvamaDetails(), []);
  const [copied, setCopied] = useState(false);
  if (q.loading && !q.data) return <Loading rows={3} />;
  if (q.err) return <ErrorBlock msg={q.err} onRetry={q.reload} />;
  const x = q.data || {};
  if (!x.accounts || !x.accounts.length) return null;
  const copy = () => { Clipboard.setStringAsync(x.primary.uccCode).catch(() => {}); setCopied(true); setTimeout(() => setCopied(false), 1500); };
  const open = () => Linking.openURL(x.portalUrl).catch(() => {});

  return (
    <View style={{ gap: 20 }}>
      <Row>
        {/* Sign in to WealthSpectrum */}
        <Panel title="Nuvama WealthSpectrum" sub="Your custodian's portal, with every scheme in one place" style={{ flex: 1.1 }}>
          {x.primary ? (
            <>
              <Label>Sign in with your primary UCC</Label>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 8, borderWidth: 1, borderColor: C.line, borderRadius: 10, paddingVertical: 12, paddingHorizontal: 14, backgroundColor: C.subtle }}>
                <View style={{ flex: 1 }}>
                  <Tx w={700} s={20} ls={0.04}>{x.primary.uccCode}</Tx>
                  <Tx s={12} c={C.ink3} numberOfLines={1}>{title(x.primary.strategy)}{x.primary.groupName ? '  ·  ' + title(x.primary.groupName) : ''}</Tx>
                </View>
                <Btn kind="outline" small label={copied ? 'Copied' : 'Copy'} onPress={copy} />
              </View>
              <Tx s={12.5} c={C.ink2} lh={1.5} style={{ marginTop: 10 }}>Your other codes still work, but each one shows only that scheme.</Tx>
            </>
          ) : <Tx s={13} c={C.ink2} lh={1.5}>Sign in with any of your account codes below.</Tx>}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 14 }}>
            <Btn small label="Open WealthSpectrum" onPress={open} />
            {!!x.dataAsOf && <Tx s={12} c={C.ink3}>Data as of {d(x.dataAsOf)}</Tx>}
          </View>
        </Panel>

        {/* Registered contact */}
        <Panel title="Registered with Nuvama" sub="Contact details on your account. Write to Investor Relations to change them." style={{ flex: 1 }}>
          {(x.holders || []).map((h, i) => (
            <View key={i} style={{ marginTop: i ? 14 : 0 }}>
              {(x.holders || []).length > 1 && <Tx w={600} s={13} style={{ marginBottom: 4 }}>{h.name}</Tx>}
              <KeyVals items={[
                ...((x.holders || []).length > 1 ? [] : [['Holder', h.name || '–']]),
                ['PAN', h.pan || '–'],
                ['Email', h.email || '–'],
                ['Mobile', h.mobile || '–'],
                ['Address', [h.city, h.state, h.pincode].filter(Boolean).join(', ') || '–'],
              ]} />
            </View>
          ))}
        </Panel>

        {/* Registered bank */}
        <Panel title="Bank account" sub="Where redemptions are paid" style={{ flex: 0.9 }}>
          {(x.banks || []).length ? (x.banks || []).map((b, i) => (
            <View key={i} style={{ marginTop: i ? 14 : 0 }}>
              <KeyVals items={[
                ['Account', b.code],
                ['Number', b.account || '–'],
                ['IFSC', b.ifsc || '–'],
                ['Status', <Pill key="s" label={b.status ? String(b.status).replace(/^\w/, c => c.toUpperCase()) : 'On record'} tone={/verif|success|active/i.test(b.status || '') ? 'ok' : 'neutral'} />],
              ]} />
            </View>
          )) : <Tx s={13} c={C.ink2} lh={1.5}>No bank account on record here yet. Investor Relations can help update it.</Tx>}
        </Panel>
      </Row>

      {!compact && (
        <Panel title="Your accounts on Nuvama" sub="Each UCC is one scheme account with Nuvama" pad={0}>
          <Table cols={ACCOUNT_COLS} rows={x.accounts} />
        </Panel>
      )}
    </View>
  );
}
