// "Your details on Nuvama" (phone): what the custodian holds for the investor — primary UCC for WealthSpectrum,
// each account, the registered contact and bank account (masked by the server). Data: meta.nuvamaDetails().
import React, { useState } from 'react';
import { View, Pressable, Linking } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { C, Tx, Card, CTA } from '../ui';
import { meta } from '../api';
import { useLoad, Loading, ErrorBox, SectionLabel } from './kit';
import { fmtDate } from '../adapt';

const d = v => (v ? fmtDate(v) : '–');
const title = s => String(s || '').replace(/^QODE ADVISORS LLP\s*-\s*/i, '').toLowerCase().replace(/\b\w/g, c => c.toUpperCase()) || '–';

function Line({ k, v, last }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 14, paddingVertical: 10, borderBottomWidth: last ? 0 : 1, borderColor: C.hairline }}>
      <Tx s={12} c={C.muted}>{k}</Tx>
      <Tx w={700} s={12.5} right style={{ flexShrink: 1 }}>{v}</Tx>
    </View>
  );
}

export function NuvamaPage() {
  const q = useLoad(() => meta.nuvamaDetails(), []);
  const [copied, setCopied] = useState(false);
  if (q.loading && !q.data) return <Loading />;
  if (q.err) return <ErrorBox msg={q.err} onRetry={q.reload} />;
  const x = q.data || {};
  const copy = () => { Clipboard.setStringAsync(x.primary.uccCode).catch(() => {}); setCopied(true); setTimeout(() => setCopied(false), 1500); };
  return (
    <>
      <Card style={{ padding: 16 }}>
        <Tx w={700} s={10.5} ls={0.12} c={C.muted}>SIGN IN TO NUVAMA WEALTHSPECTRUM</Tx>
        {x.primary ? (
          <>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10 }}>
              <View style={{ flex: 1 }}>
                <Tx w={700} s={20} ls={0.04}>{x.primary.uccCode}</Tx>
                <Tx s={11.5} c={C.muted} numberOfLines={1}>{title(x.primary.strategy)}</Tx>
              </View>
              <Pressable onPress={copy} hitSlop={8} style={{ borderWidth: 1, borderColor: C.mutedBorder35, borderRadius: 8, paddingVertical: 7, paddingHorizontal: 12 }}>
                <Tx w={700} s={12} c={C.green}>{copied ? 'COPIED' : 'COPY'}</Tx>
              </Pressable>
            </View>
            <Tx s={11.5} c={C.muted} lh={1.5} style={{ marginTop: 8 }}>Use this primary UCC to see all your schemes together. Your other codes still work, but each shows only that scheme.</Tx>
          </>
        ) : <Tx s={12} c={C.muted} style={{ marginTop: 8 }}>Sign in with any of your account codes below.</Tx>}
        <CTA label="OPEN WEALTHSPECTRUM" onPress={() => Linking.openURL(x.portalUrl).catch(() => {})} style={{ marginTop: 14, paddingVertical: 12 }} />
        {!!x.dataAsOf && <Tx s={11} c={C.muted} center style={{ marginTop: 8 }}>Data as of {d(x.dataAsOf)}</Tx>}
      </Card>

      {(x.holders || []).map((h, i) => (
        <View key={i}>
          <SectionLabel>{(x.holders || []).length > 1 ? 'REGISTERED DETAILS · ' + String(h.name || '').toUpperCase() : 'REGISTERED WITH NUVAMA'}</SectionLabel>
          <Card style={{ paddingHorizontal: 16, paddingVertical: 4 }}>
            <Line k="Holder" v={h.name || '–'} />
            <Line k="PAN" v={h.pan || '–'} />
            <Line k="Email" v={h.email || '–'} />
            <Line k="Mobile" v={h.mobile || '–'} />
            <Line k="Address" v={[h.city, h.state, h.pincode].filter(Boolean).join(', ') || '–'} last />
          </Card>
        </View>
      ))}

      <SectionLabel>BANK ACCOUNT</SectionLabel>
      <Card style={{ paddingHorizontal: 16, paddingVertical: 4 }}>
        {(x.banks || []).length ? (x.banks || []).map((b, i) => (
          <View key={i}>
            <Line k="Account" v={b.code} />
            <Line k="Number" v={b.account || '–'} />
            <Line k="IFSC" v={b.ifsc || '–'} />
            <Line k="Status" v={b.status ? String(b.status).replace(/^\w/, c => c.toUpperCase()) : 'On record'} last={i === x.banks.length - 1} />
          </View>
        )) : <Tx s={12} c={C.muted} style={{ paddingVertical: 12 }}>No bank account on record here yet. Investor Relations can help update it.</Tx>}
      </Card>

      <SectionLabel>YOUR ACCOUNTS ON NUVAMA</SectionLabel>
      {(x.accounts || []).map(a => (
        <Card key={a.code} style={{ paddingHorizontal: 16, paddingVertical: 4, marginBottom: 10 }}>
          <Line k="UCC" v={a.code} />
          <Line k="Scheme" v={title(a.scheme)} />
          <Line k="Account type" v={a.accountType || '–'} />
          <Line k="Opened on" v={d(a.openedOn)} />
          <Line k="Inception" v={d(a.inceptionDate)} />
          <Line k="Relationship manager" v={a.rm || '–'} />
          <Line k="Distributor" v={a.distributor ? title(a.distributor) : 'Direct'} />
          <Line k="Status" v={a.active ? 'Active' : 'Closed'} last />
        </Card>
      ))}
      <Tx s={11.5} c={C.muted} lh={1.5} style={{ marginTop: 6 }}>To change any of these details, write to Investor Relations from Services.</Tx>
    </>
  );
}
