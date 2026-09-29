// Distributor "Download reports" dialog (web, src/web/distributor.js: Investors table and investor page). One of the
// five statements of the Reports page for one investor, as a PDF: the distributor picks the report, the account
// ("All accounts" with 2+) and the period, and savePdf prints it from a hidden frame (the browser's "Save as PDF").
// Access: clientReports() in src/api gets the distributor's read-only view token for this investor (the server checks
// the investor is in the distributor's book) and every report request is a GET with it. Choices and the PDF itself:
// src/clientReports.js (the Reports page's own builders).
import React, { useState, useEffect, useMemo } from 'react';
import { View, Pressable } from 'react-native';
import { clientReports } from '../api';
import { savePdf } from '../screens/partner';
import {
  REPORT_KINDS, AS_OF, ALL_ID, periodChoices, defaultPeriod, resolvePeriod, periodError, accountChoices, fileName, buildReport, todayIso,
} from '../clientReports';
import { C, Tx, Btn, Chips, Dialog, DateField } from './kit';

const errText = e => (e && e.status === 403 ? (e.message && e.message !== 'Forbidden' ? e.message : 'This investor is not in your book.')
  : e && e.status === 503 ? (e.message || 'We couldn’t confirm this investor just now. Please try again in a few minutes.')
  : (e && e.message) || 'Something went wrong. Please try again.');

function Field({ label, children }) {
  return (
    <View style={{ gap: 8 }}>
      <Tx w={600} s={12.5} c={C.ink2}>{label}</Tx>
      {children}
    </View>
  );
}

// c: an investor row from the distributor journey ({ name, clientCode }). visible / onClose as kit Dialog.
export function ClientReportsDialog({ c, visible, onClose }) {
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
  const pickKind = k => { setKind(k); setPeriod(defaultPeriod(k)); setMsg({ tone: '', text: '' }); };
  const today = todayIso();
  const pErr = kind === 'factsheet' ? (asOf === 'date' && !date ? 'Choose a date.' : '') : periodError(period, custom, today);

  const download = async () => {
    if (busy || !acc.rep || !account) return;
    if (pErr) { setMsg({ tone: 'bad', text: pErr }); return; }
    setBusy(true); setMsg({ tone: '', text: 'Preparing the PDF…' });
    try {
      const doc = await buildReport(acc.rep, { kind, account, ids, period, custom, asOf, date });
      const acctText = account === ALL_ID ? 'All accounts' : account;
      await savePdf(doc.html, fileName(name, kind, doc.periodText, acctText), { source: 'distributor', landscape: doc.landscape });
      setMsg({ tone: doc.note ? 'bad' : 'good', text: doc.note ? `PDF ready. ${doc.note}` : 'PDF ready. Choose “Save as PDF” in the print dialog if it did not save.' });
    } catch (e) { setMsg({ tone: 'bad', text: errText(e) }); }
    setBusy(false);
  };

  const periodBlock = kind === 'factsheet' ? (
    <Field label="As of">
      <Chips value={asOf} options={AS_OF} onChange={setAsOf} />
      {asOf === 'date' && <DateField label="Fact sheet on or before" value={date} max={today} onChangeText={setDate} style={{ maxWidth: 240 }} />}
    </Field>
  ) : (
    <Field label={kind === 'capitalGains' ? 'Financial year or period' : 'Period'}>
      <Chips value={period} options={periodChoices(kind, today)} onChange={setPeriod} />
      {period === 'custom' && (
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <DateField label="From" value={custom.from} max={custom.to || today} onChangeText={v => setCustom(x => ({ ...x, from: v }))} style={{ flex: 1 }} />
          <DateField label="To" value={custom.to} min={custom.from || undefined} max={today} onChangeText={v => setCustom(x => ({ ...x, to: v }))} style={{ flex: 1 }} />
        </View>
      )}
      {period !== 'custom' && !!period && <Tx s={12} c={C.ink3}>{resolvePeriod(period, custom, today).label}{kind === 'capitalGains' && !period.startsWith('fy:') ? ' (by sale date)' : ''}</Tx>}
    </Field>
  );

  return (
    <Dialog visible={visible} onClose={busy ? () => {} : onClose} title={`Download reports for ${name}`} width={620}>
      <View style={{ gap: 20 }}>
        <Tx s={13} c={C.ink2} lh={1.5}>Statements from {name}’s account, read-only, as they see them in their own Reports page.</Tx>
        {acc.loading && <Tx s={13} c={C.ink3}>Checking access to this investor’s accounts…</Tx>}
        {!!acc.err && (
          <View style={{ gap: 10, alignItems: 'flex-start' }}>
            <Tx s={13} c={C.red}>{acc.err}</Tx>
            <Btn small kind="outline" label="Try again" onPress={() => setTick(t => t + 1)} />
          </View>
        )}
        {!!acc.rep && (<>
          <Field label="Report">
            <Chips value={kind} options={REPORT_KINDS} onChange={pickKind} />
          </Field>
          <Field label="Account">
            {options.length ? (
              <View style={{ borderWidth: 1, borderColor: C.line, borderRadius: 8, overflow: 'clip' }}>
                {options.map((o, i) => {
                  const on = account === o.id;
                  return (
                    <Pressable key={o.id} accessibilityRole="radio" accessibilityState={{ checked: on }} onPress={() => setAccount(o.id)}
                      style={({ hovered }) => ({ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9, paddingHorizontal: 12, borderTopWidth: i ? 1 : 0, borderColor: C.line, backgroundColor: on ? C.greenTint : hovered ? C.hover : 'transparent' })}>
                      <View style={{ width: 16, height: 16, borderRadius: 8, borderWidth: on ? 5 : 1, borderColor: on ? C.green : C.line2 }} />
                      <Tx w={on ? 600 : 400} s={13} c={on ? C.green : C.ink} numberOfLines={1} style={{ flex: 1 }}>{o.label}</Tx>
                      {o.all && <Tx s={12} c={C.ink3}>{ids.length} accounts</Tx>}
                    </Pressable>
                  );
                })}
              </View>
            ) : <Tx s={13} c={C.ink3}>This investor has no accounts to report on yet.</Tx>}
          </Field>
          {periodBlock}
          {!!msg.text && <Tx s={13} c={msg.tone === 'bad' ? C.red : msg.tone === 'good' ? C.green : C.ink2} lh={1.5}>{msg.text}</Tx>}
          <View style={{ flexDirection: 'row', gap: 10, justifyContent: 'flex-end' }}>
            <Btn kind="outline" label="Close" onPress={onClose} disabled={busy} />
            <Btn label={busy ? 'Preparing…' : 'Download PDF'} busy={busy} onPress={download} disabled={!account} />
          </View>
        </>)}
      </View>
    </Dialog>
  );
}
