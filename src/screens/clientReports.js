// Distributor "Download reports" sheet (phone, investor detail in src/screens/partner.js). The web dialog's choices
// (src/web/clientReports.js) in a bottom sheet: report, account ("All accounts" with 2+), period, then savePdf
// (the share sheet on iOS, the chosen folder on Android). Access: clientReports() in src/api gets the distributor's
// read-only view token for this investor; the PDF is built by src/clientReports.js with the Reports page's builders.
import React, { useState, useEffect, useMemo } from 'react';
import { View, Pressable, ScrollView, Modal, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C, Tx, CTA } from '../ui';
import { clientReports } from '../api';
import { savePdf } from './pdfSave';
import { DateField } from './sip';
import {
  REPORT_KINDS, AS_OF, ALL_ID, periodChoices, defaultPeriod, resolvePeriod, periodError, accountChoices, fileName, buildReport, todayIso,
} from '../clientReports';

const errText = e => (e && e.status === 403 ? (e.message && e.message !== 'Forbidden' ? e.message : 'This investor is not in your book.')
  : e && e.status === 503 ? (e.message || 'We couldn’t confirm this investor just now. Please try again in a few minutes.')
  : (e && e.message) || 'Something went wrong. Please try again.');
const pad = v => String(v).padStart(2, '0');
const isoOf = d => (d ? `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` : '');
const dateOf = s => (s ? new Date(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10)) : null);

function Pills({ value, options, onChange }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {options.map(([k, l]) => {
        const on = value === k;
        return (
          <Pressable key={k} onPress={() => onChange(k)} accessibilityRole="button" accessibilityState={{ selected: on }}
            style={({ pressed }) => ({ paddingVertical: 8, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1, borderColor: on ? C.green : C.hairline, backgroundColor: on ? C.green : pressed ? 'rgba(2,66,43,0.05)' : 'transparent' })}>
            <Tx w={700} s={12} c={on ? C.gold : C.ink}>{l}</Tx>
          </Pressable>
        );
      })}
    </View>
  );
}
const Label = ({ children }) => <Tx w={700} s={10} ls={0.12} c={C.muted} style={{ marginTop: 18, marginBottom: 8 }}>{children}</Tx>;

// c: an investor row from the distributor journey ({ name, clientCode }).
export function ClientReportsSheet({ c, visible, onClose }) {
  const insets = useSafeAreaInsets();
  const code = c && c.clientCode;
  const name = (c && c.name) || 'Investor';
  const [acc, setAcc] = useState({ loading: false, err: '', accounts: null, rep: null });
  const [kind, setKind] = useState('transactions');
  const [account, setAccount] = useState('');
  const [period, setPeriod] = useState(defaultPeriod('transactions'));
  const [custom, setCustom] = useState({ from: '', to: '' });
  const [asOf, setAsOf] = useState('latest');
  const [date, setDate] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState({ tone: '', text: '' });
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!visible || !code) return undefined;
    let live = true;
    setAcc({ loading: true, err: '', accounts: null, rep: null }); setMsg({ tone: '', text: '' });
    clientReports(code).then(
      r => { if (!live) return; setAcc({ loading: false, err: '', accounts: r.accounts, rep: r.reports }); const opts = accountChoices(r.accounts); setAccount(opts[0] ? opts[0].id : ''); },
      e => { if (live) setAcc({ loading: false, err: errText(e), accounts: null, rep: null }); });
    return () => { live = false; };
  }, [visible, code, tick]);

  const options = useMemo(() => accountChoices(acc.accounts), [acc.accounts]);
  const ids = options.filter(o => o.id !== ALL_ID).map(o => o.id);
  const today = todayIso();
  const todayD = dateOf(today);
  const pickKind = k => { setKind(k); setPeriod(defaultPeriod(k)); setMsg({ tone: '', text: '' }); };
  const pErr = kind === 'factsheet' ? (asOf === 'date' && !date ? 'Choose a date.' : '') : periodError(period, custom, today);

  const download = async () => {
    if (busy || !acc.rep || !account) return;
    if (pErr) { setMsg({ tone: 'bad', text: pErr }); return; }
    setBusy(true); setMsg({ tone: '', text: 'Preparing the PDF…' });
    try {
      const doc = await buildReport(acc.rep, { kind, account, ids, period, custom, asOf, date });
      const r = await savePdf(doc.html, fileName(name, kind, doc.periodText, account === ALL_ID ? 'All accounts' : account), { source: 'distributor', landscape: doc.landscape });
      const saved = r && r.savedTo ? ` Saved to ${r.savedTo}.` : '';
      setMsg({ tone: doc.note ? 'bad' : 'good', text: `PDF ready.${saved}${doc.note ? ' ' + doc.note : ''}` });
    } catch (e) { setMsg({ tone: 'bad', text: errText(e) }); }
    setBusy(false);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={() => { if (!busy) onClose(); }}>
      <Pressable onPress={() => { if (!busy) onClose(); }} style={{ flex: 1, backgroundColor: 'rgba(0,32,23,0.45)', justifyContent: 'flex-end' }}>
        <Pressable onPress={() => {}} style={{ backgroundColor: C.cream, borderTopLeftRadius: 18, borderTopRightRadius: 18, maxHeight: '90%', paddingBottom: insets.bottom + 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 6 }}>
            <View style={{ flex: 1 }}>
              <Tx w={700} s={10} ls={0.12} c={C.muted}>DOWNLOAD REPORTS</Tx>
              <Tx f="play" w={600} s={19} numberOfLines={1} style={{ marginTop: 2 }}>{name}</Tx>
            </View>
            <Pressable onPress={() => { if (!busy) onClose(); }} hitSlop={10} accessibilityRole="button" accessibilityLabel="Close">
              <Tx w={700} s={12} c={C.muted}>CLOSE</Tx>
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 8 }} keyboardShouldPersistTaps="handled">
            <Tx s={12} c={C.muted} lh={1.5}>Read-only statements from this investor’s account, as they see them in their own Reports page.</Tx>
            {acc.loading && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 18 }}>
                <ActivityIndicator color={C.green} /><Tx s={12.5} c={C.muted}>Checking access to this investor’s accounts…</Tx>
              </View>
            )}
            {!!acc.err && (
              <View style={{ marginTop: 18, gap: 10 }}>
                <Tx s={12.5} c={C.red}>{acc.err}</Tx>
                <CTA label="TRY AGAIN" outline onPress={() => setTick(t => t + 1)} style={{ paddingVertical: 11 }} />
              </View>
            )}
            {!!acc.rep && (<>
              <Label>REPORT</Label>
              <Pills value={kind} options={REPORT_KINDS} onChange={pickKind} />
              <Label>ACCOUNT</Label>
              {options.length ? (
                <View style={{ borderWidth: 1, borderColor: C.hairline, borderRadius: 10, overflow: 'hidden' }}>
                  {options.map((o, i) => {
                    const on = account === o.id;
                    return (
                      <Pressable key={o.id} onPress={() => setAccount(o.id)} accessibilityRole="radio" accessibilityState={{ checked: on }}
                        style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 11, paddingHorizontal: 12, borderTopWidth: i ? 1 : 0, borderColor: C.hairline, backgroundColor: on ? 'rgba(2,66,43,0.06)' : 'transparent' }}>
                        <View style={{ width: 16, height: 16, borderRadius: 8, borderWidth: on ? 5 : 1, borderColor: on ? C.green : 'rgba(55,88,79,0.35)' }} />
                        <Tx w={on ? 700 : 400} s={12.5} c={on ? C.green : C.ink} numberOfLines={1} style={{ flex: 1 }}>{o.label}</Tx>
                      </Pressable>
                    );
                  })}
                </View>
              ) : <Tx s={12.5} c={C.muted}>This investor has no accounts to report on yet.</Tx>}
              {kind === 'factsheet' ? (<>
                <Label>AS OF</Label>
                <Pills value={asOf} options={AS_OF} onChange={setAsOf} />
                {asOf === 'date' && (
                  <View style={{ flexDirection: 'row', marginTop: 12 }}>
                    <DateField label="ON OR BEFORE" value={dateOf(date) || todayD} max={todayD} placeholder={date ? undefined : 'Choose a date'} onChange={d => setDate(isoOf(d))} />
                  </View>
                )}
              </>) : (<>
                <Label>{kind === 'capitalGains' ? 'FINANCIAL YEAR OR PERIOD' : 'PERIOD'}</Label>
                <Pills value={period} options={periodChoices(kind, today)} onChange={setPeriod} />
                {period === 'custom' ? (
                  <View style={{ flexDirection: 'row', gap: 12, marginTop: 12 }}>
                    <DateField label="FROM" value={dateOf(custom.from) || todayD} max={dateOf(custom.to) || todayD} placeholder={custom.from ? undefined : 'Start date'} onChange={d => setCustom(x => ({ ...x, from: isoOf(d) }))} />
                    <DateField label="TO" value={dateOf(custom.to) || todayD} min={dateOf(custom.from) || undefined} max={todayD} placeholder={custom.to ? undefined : 'End date'} onChange={d => setCustom(x => ({ ...x, to: isoOf(d) }))} />
                  </View>
                ) : !!period && <Tx s={11.5} c={C.muted} style={{ marginTop: 8 }}>{resolvePeriod(period, custom, today).label}{kind === 'capitalGains' && !period.startsWith('fy:') ? ' (by sale date)' : ''}</Tx>}
              </>)}
              {!!msg.text && <Tx s={12.5} c={msg.tone === 'bad' ? C.red : msg.tone === 'good' ? C.green : C.muted} lh={1.5} style={{ marginTop: 16 }}>{msg.text}</Tx>}
              <CTA label={busy ? 'PREPARING…' : 'DOWNLOAD PDF'} onPress={download} style={{ marginTop: 18, paddingVertical: 13, opacity: busy || !account ? 0.6 : 1 }} />
            </>)}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
