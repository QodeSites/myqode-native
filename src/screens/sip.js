// Set up a SIP (recurring investment) through Razorpay — mirrors pay.js's proven flow:
//   amount + frequency + start date → create Plan+Subscription → Razorpay Checkout in the SYSTEM BROWSER
//   (mandate authorisation: UPI Autopay / eNACH / card) → browser bounces back into the app → the app
//   re-verifies the subscription with the server → result screen.
// Once authorised, Razorpay auto-debits on schedule — no further app interaction. Pause/Resume/Cancel for
// an existing SIP are on the Investments card in services.js; this screen is only for creating a new one.
// Works in Expo Go. With test keys nobody is charged and the client's real contact details never reach Razorpay.
import React, { useState, useRef, useEffect } from 'react';
import { View, Pressable, Platform, ActivityIndicator, Modal } from 'react-native';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';   // bundled in Expo Go
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { C, Tx, Amt, Field, CTA } from '../ui';
import { Check } from '../icons';
import { services, BASE_URL, isDemo } from '../api';
import { AccountChips, useLoad } from './kit';
import { savePendingPayment, clearPendingPayment, hintFromReturnUrl, autoReturn } from './pay';

const CHIPS = [5000, 10000, 25000, 50000];
const MIN = 100, MAX = 500000;
const FREQS = [['monthly', 'Monthly'], ['quarterly', 'Quarterly'], ['yearly', 'Yearly']];
const fmt = v => '₹' + Number(v || 0).toLocaleString('en-IN');
const Lbl = ({ children, style }) => <Tx w={700} s={10} ls={0.12} c={C.gray} style={[{ marginTop: 18 }, style]}>{children}</Tx>;

// Start and end dates come from the investor through the platform's own date picker. Every charge falls on
// the start date's day of the month — monthly, every third month, or yearly. Earliest start is tomorrow
// (server requirement); the end date is optional and defaults to 10 years after the start (Razorpay needs a
// finite number of cycles). Local dates throughout, no timezone shift.
const pad = n => String(n).padStart(2, '0');
const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const niceDate = d => `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
const ordinal = n => n + ([, 'st', 'nd', 'rd'][(n % 100 >> 3 ^ 1 && n % 10)] || 'th');
const addMonths = (d, n) => new Date(d.getFullYear(), d.getMonth() + n, d.getDate());
function today() { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), n.getDate()); }
function tomorrow() { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), n.getDate() + 1); }
const isToday = d => d.getTime() === today().getTime();
function defaultStart() { const t = tomorrow(); return t.getDate() <= 5 ? new Date(t.getFullYear(), t.getMonth(), 5) : new Date(t.getFullYear(), t.getMonth() + 1, 5); }
const defaultEnd = start => addMonths(start, 120);

// A tappable date row that opens the platform's own date picker:
//   Android → the system date dialog (imperative API; nothing to lay out, nothing opens twice)
//   iOS     → a bottom sheet with the native wheel picker and Cancel / Done (the wheel needs full width;
//             inline between two half-width fields it was unusable)
//   web     → a typed YYYY-MM-DD field (the native picker does not exist there)
const clamp = (d, min, max) => (min && d < min ? min : max && d > max ? max : d);
const dayOnly = d => new Date(d.getFullYear(), d.getMonth(), d.getDate());
function DateField({ label, value, min, max, onChange, hint }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);
  const openPicker = () => {
    if (Platform.OS === 'android') {
      // v9 API: onValueChange fires only on Set; onDismiss on Cancel/back (no event.type checks needed)
      DateTimePickerAndroid.open({ value, mode: 'date', minimumDate: min, maximumDate: max, onValueChange: (_e, d) => { if (d) onChange(clamp(dayOnly(d), min, max)); }, onDismiss: () => {} });
      return;
    }
    setDraft(value); setOpen(true);
  };
  return (
    <View style={{ flex: 1 }}>
      <Tx w={700} s={10} ls={0.12} c={C.gray}>{label}</Tx>
      {Platform.OS === 'web' ? (
        <Field value={iso(value)} placeholder="YYYY-MM-DD" onChangeText={t => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t.trim()); if (!m) return; const d = new Date(+m[1], +m[2] - 1, +m[3]); if (!isNaN(d)) onChange(clamp(d, min, max)); }} s={14} style={{ marginTop: 6 }} />
      ) : (
        <Pressable onPress={openPicker} style={{ marginTop: 6, borderWidth: 1, borderColor: open ? C.green : C.mutedBorder35, borderRadius: 8, paddingVertical: 10, paddingHorizontal: 12 }}>
          <Tx w={700} s={13}>{niceDate(value)}</Tx>
          {!!hint && <Tx s={10.5} c={C.gray} style={{ marginTop: 2 }}>{hint}</Tx>}
        </Pressable>
      )}
      {Platform.OS === 'ios' && (
        <Modal transparent animationType="slide" visible={open} onRequestClose={() => setOpen(false)}>
          <Pressable onPress={() => setOpen(false)} style={{ flex: 1, backgroundColor: 'rgba(0,32,23,0.35)', justifyContent: 'flex-end' }}>
            <Pressable onPress={() => {}} style={{ backgroundColor: C.cream, borderTopLeftRadius: 16, borderTopRightRadius: 16, paddingBottom: 28 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 12 }}>
                <Pressable onPress={() => setOpen(false)} hitSlop={8}><Tx w={700} s={12} c={C.muted}>CANCEL</Tx></Pressable>
                <Tx w={700} s={12} center style={{ flex: 1 }}>{label}</Tx>
                <Pressable onPress={() => { onChange(clamp(dayOnly(draft), min, max)); setOpen(false); }} hitSlop={8}><Tx w={700} s={12} c={C.green}>DONE</Tx></Pressable>
              </View>
              <DateTimePicker value={draft} mode="date" display="spinner" themeVariant="light" minimumDate={min} maximumDate={max} onValueChange={(_e, d) => { if (d) setDraft(d); }} style={{ alignSelf: 'stretch' }} />
            </Pressable>
          </Pressable>
        </Modal>
      )}
    </View>
  );
}

const RESULT = {
  success: { title: 'SIP set up', text: 'Your mandate is registered. Razorpay will debit your account automatically on each due date — no further action needed here. Pause becomes available once the first instalment has been charged.' },
  failed:  { title: 'SIP not set up', text: 'The bank did not authorise the mandate and nothing was charged. You can try again with another account.' },
  cancelled: { title: 'SIP not completed', text: 'The mandate was not authorised — the window was closed or nothing was submitted. Nothing was charged. Try again whenever you like.' },
  pending: { title: 'Almost there', text: 'Your authorisation went through and Razorpay is finalising the mandate. Tap Check status in a moment — nothing else is needed.' },
  expired: { title: 'Set-up link expired', text: 'This set-up was not completed in time. Please start again.' },
  error:   { title: 'Could not confirm the SIP', text: 'We could not reach Qode to confirm the mandate. Check your connection and tap Check status.' },
};

// `recover` = { sub: { subscriptionId }, hint } from main.js when the app was reopened (deep link or fresh
// start) with a mandate still in the browser — Expo Go reloads the project on the return link, so the
// sheet that opened the browser is gone. We just re-verify the subscription with the server.
export function SetupSip({ V, onDone, recover }) {
  const opts = V.acctOptions;
  const [acct, setAcct] = useState(opts[0] && opts[0].id);
  const [amt, setAmt] = useState(0);
  const [freq, setFreq] = useState('monthly');
  const [from, setFromRaw] = useState(defaultStart);
  const [until, setUntil] = useState(() => defaultEnd(defaultStart()));   // optional end: defaults to 10 years
  const [untilTouched, setUntilTouched] = useState(false);
  const setFrom = d => { setFromRaw(d); if (!untilTouched || until <= d) setUntil(defaultEnd(d)); };
  const startDate = iso(from), endDate = iso(until);
  const day = from.getDate();
  // Registered bank on file for the chosen account — shown here and prefilled on Razorpay's mandate form.
  const bankQ = useLoad(() => (acct ? services.registeredBank(acct) : Promise.resolve(null)), [acct]);
  const bank = bankQ.data && bankQ.data.bank;
  const [st, setSt] = useState({ step: recover ? 'verify' : 'form', busy: false, err: '', sub: recover ? recover.sub : null, kind: '', detail: '', result: null });
  const alive = useRef(true);
  useEffect(() => () => { alive.current = false; }, []);
  useEffect(() => { if (recover) verify(recover.sub, recover.hint || ''); }, []);
  const set = p => { if (alive.current) setSt(s => ({ ...s, ...p })); };

  // An unauthorised subscription is dead weight on Razorpay and shows as "pending" in Investments — void it
  // when the client gives up (Try again / Done after a failure), so only real mandates remain in the list.
  // Never voids a subscription the client actually authorised (server says `authorised`) — only unauthorised leftovers.
  const abandon = (sub, result) => { if (result && result.authorised) return; if (sub && sub.subscriptionId && !isDemo()) services.cancelSip(sub.subscriptionId, sub.accountId || acct).catch(() => {}); };

  const finish = (kind, result, detail = '') => {
    set({ step: 'done', kind, result, detail, busy: false });
    if (kind !== 'error') clearPendingPayment();   // decided: nothing to recover later
    if (kind === 'success' && onDone) onDone(result);
  };

  // Decide from the server's view of the subscription. Only a successful authorisation makes it active; a
  // subscription still "pending" after the browser has closed is NOT going to complete on its own, so it is
  // reported as not completed (with Razorpay's reason when the bank declined) — never left "confirming".
  const verify = async (sub, hint, tries = 4) => {
    set({ step: 'verify', err: '' });
    try {
      let v = null;
      const polls = hint === 'success' ? tries : 1;   // only a success redirect is worth waiting on
      for (let i = 0; i < polls; i++) {
        v = await services.verifySip(sub.subscriptionId);
        if (v.isActive || v.isFailed) break;
        if (i < polls - 1) await new Promise(r => setTimeout(r, 2500));
      }
      if (v.isActive) return finish('success', v);
      if (v.isFailed) return finish(v.razorpaySubscriptionStatus === 'expired' ? 'expired' : 'failed', v, v.lastError || '');
      if (hint === 'failed' || v.lastError) return finish('failed', v, v.lastError || '');
      // Authorised on our side (or the browser said success) but Razorpay still catching up: not a failure.
      if (v.authorised || hint === 'success') return finish('pending', v);
      return finish('cancelled', v);
    } catch (e) { finish('error', null, e.message); }
  };

  const start = async () => {
    if (st.busy) return;
    if (!amt || amt < MIN) return set({ err: `Enter at least ${fmt(MIN)}.` });
    if (amt > MAX) return set({ err: `SIP amount is capped at ${fmt(MAX)} per cycle.` });
    set({ busy: true, err: '' });
    let sub;
    try { sub = await services.setupSip({ accountId: acct, amount: amt, frequency: freq, startDate, endDate }); }
    catch (e) { return set({ busy: false, err: e.message }); }
    set({ sub });
    if (isDemo()) return finish('success', await services.verifySip(sub.subscriptionId));

    // Remembered on the device first, so a reload on the way back can still recover it (see `recover`).
    await savePendingPayment({ subscriptionId: sub.subscriptionId, accountId: acct, amount: amt, tab: V.tab, scope: V.scopeKey });
    const ret = Linking.createURL('payment-return');
    const url = BASE_URL + sub.checkoutPath + '&ret=' + encodeURIComponent(ret);
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined') window.open(url, '_blank');
      return set({ step: 'browser', busy: false });
    }
    let res;
    // Pull the app back as soon as the mandate is decided (Chrome will not do it for us — see autoReturn).
    const stopWatch = autoReturn({ subId: sub.subscriptionId }, ret);
    try {
      res = await WebBrowser.openAuthSessionAsync(url, ret, { createTask: false, showInRecents: false, dismissButtonStyle: 'close', toolbarColor: '#02422B', controlsColor: '#DABD38' });
    } catch (e) { stopWatch(); return finish('error', null, 'Could not open the authorisation window: ' + e.message); }
    stopWatch();
    if (res && res.type === 'success' && res.url) return verify(sub, hintFromReturnUrl(res.url));
    verify(sub, 'cancelled');   // browser closed by hand
  };

  const reset = () => { clearPendingPayment(); if (st.kind === 'failed' || st.kind === 'cancelled') abandon(st.sub, st.result); set({ step: 'form', busy: false, err: '', sub: null, kind: '', detail: '', result: null }); };
  const done = () => { if (st.kind === 'failed' || st.kind === 'cancelled') abandon(st.sub, st.result); V.closeSheet(); };

  if (st.step === 'verify') {
    return <View style={{ alignItems: 'center', paddingVertical: 28 }}><ActivityIndicator color={C.green} /><Tx s={12.5} c={C.muted} style={{ marginTop: 12 }}>Confirming your SIP…</Tx></View>;
  }
  if (st.step === 'browser') {
    return (
      <View style={{ paddingVertical: 14 }}>
        <Tx w={700} s={14}>Authorise the mandate in the new tab</Tx>
        <Tx s={12.5} c={C.muted} lh={1.5} style={{ marginTop: 8 }}>When you're done, come back here and tap Check status.</Tx>
        <CTA label="CHECK STATUS" onPress={() => verify(st.sub, '')} style={{ marginTop: 18 }} />
        <Pressable onPress={reset} style={{ marginTop: 12, alignItems: 'center' }}><Tx s={12} c={C.muted}>Cancel</Tx></Pressable>
      </View>
    );
  }
  if (st.step === 'done') {
    const r = RESULT[st.kind] || RESULT.cancelled, v = st.result, ok = st.kind === 'success';
    const bad = st.kind === 'failed' || st.kind === 'error' || st.kind === 'expired';
    return (
      <View style={{ alignItems: 'center', paddingVertical: 18 }}>
        <View style={{ width: 52, height: 52, borderRadius: 26, borderWidth: 1.5, borderColor: ok ? C.green : bad ? C.red : C.gold, alignItems: 'center', justifyContent: 'center' }}>
          {ok ? <Check s={22} w={2.4} /> : <Tx w={700} s={22} c={bad ? C.red : C.gold}>{bad ? '!' : '…'}</Tx>}
        </View>
        <Tx w={700} s={15} style={{ marginTop: 14 }}>{r.title}</Tx>
        {!!(v && v.amount) && <Amt s={20} style={{ marginTop: 6 }}>{fmt(v.amount)} · {(v.frequency || freq)}</Amt>}
        <Tx s={12.5} c={C.muted} lh={1.6} center style={{ marginTop: 8 }}>{r.text}</Tx>
        {!!st.detail && <Tx s={11.5} c={bad ? C.red : C.muted} lh={1.5} center style={{ marginTop: 8 }}>{st.detail}</Tx>}
        {!!(v && v.nextChargeDate) && <Tx s={11} c={C.gray} center style={{ marginTop: 10 }}>Next charge {v.nextChargeDate}</Tx>}
        {!!(st.sub && st.sub.subscriptionId) && <Tx s={11} c={C.gray} style={{ marginTop: 4 }}>Ref {st.sub.subscriptionId}</Tx>}
        {(st.kind === 'error' || st.kind === 'pending') && <CTA label="CHECK STATUS" outline onPress={() => verify(st.sub, 'success')} style={{ marginTop: 18, alignSelf: 'stretch' }} />}
        {(st.kind === 'failed' || st.kind === 'cancelled' || st.kind === 'expired') && <CTA label="TRY AGAIN" outline onPress={reset} style={{ marginTop: 18, alignSelf: 'stretch' }} />}
        <CTA label="DONE" onPress={done} style={{ marginTop: 10, alignSelf: 'stretch' }} />
      </View>
    );
  }
  return (
    <View>
      {opts.length > 1 && <><Lbl style={{ marginTop: 14 }}>ACCOUNT</Lbl><AccountChips options={opts} value={acct} onPick={setAcct} /></>}
      <Lbl style={{ marginTop: 14 }}>AMOUNT PER CYCLE</Lbl>
      <Field value={amt ? amt.toLocaleString('en-IN') : ''} onChangeText={t => { const n = parseInt(t.replace(/\D/g, '') || '0', 10); setAmt(Math.min(n, MAX)); set({ err: n > MAX ? `SIP amount is capped at ${fmt(MAX)} per cycle — amount set to the maximum.` : '' }); }} numeric s={26} prefix="₹" />
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
        {CHIPS.map(v => (
          <Pressable key={v} onPress={() => { setAmt(v); set({ err: '' }); }} style={{ borderWidth: 1, borderColor: C.greenBorder, borderRadius: 999, paddingVertical: 8, paddingHorizontal: 14 }}>
            <Amt s={12} c={C.green}>{fmt(v)}</Amt>
          </Pressable>
        ))}
      </View>
      <Lbl>FREQUENCY</Lbl>
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
        {FREQS.map(([id, label]) => (
          <Pressable key={id} onPress={() => setFreq(id)} style={{ flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 999, borderWidth: 1, borderColor: freq === id ? C.green : C.mutedBorder35, backgroundColor: freq === id ? C.green : 'transparent' }}>
            <Tx w={700} s={11.5} c={freq === id ? C.cream : C.muted}>{label}</Tx>
          </Pressable>
        ))}
      </View>
      <View style={{ flexDirection: 'row', gap: 10, marginTop: 18 }}>
        <DateField label="START DATE" value={from} min={today()} max={addMonths(tomorrow(), 12)} onChange={setFrom} hint={isToday(from) ? 'today · charged at authorisation' : 'first charge'} />
        <DateField label="END DATE (OPTIONAL)" value={until} min={addMonths(from, 1)} max={addMonths(from, 120)} onChange={d => { setUntil(d); setUntilTouched(true); }} hint={untilTouched ? 'last charge on or before' : '10 years · default'} />
      </View>
      <Tx s={11.5} c={C.muted} lh={1.5} style={{ marginTop: 12 }}>{isToday(from) ? <>First instalment of <Tx w={700} s={11.5}>{fmt(amt)}</Tx> is collected when you authorise, then</> : <>First charge on <Tx w={700} s={11.5}>{niceDate(from)}</Tx>, then</>} on the {ordinal(day)} of {freq === 'monthly' ? 'every month' : freq === 'quarterly' ? 'every third month' : `${MONTHS_LONG[from.getMonth()]} every year`} until <Tx w={700} s={11.5}>{niceDate(until)}</Tx>, unless you cancel earlier.{day > 28 ? ' In shorter months the debit falls on the last day.' : ''}</Tx>
      <Lbl>DEBIT ACCOUNT</Lbl>
      <View style={{ marginTop: 8, borderWidth: 1, borderColor: bank ? C.greenBorder : C.gold35, borderRadius: 8, paddingVertical: 10, paddingHorizontal: 12 }}>
        {bankQ.loading && !bankQ.data ? <Tx s={12} c={C.muted}>Checking your registered bank…</Tx>
          : bank ? (
            <>
              <Tx w={700} s={13}>{bank.bankCode} ••••{bank.last4}</Tx>
              <Tx s={11} c={C.muted} style={{ marginTop: 2 }}>{bank.holderName} · IFSC {bank.ifsc}{bank.verified ? ' · verified' : ''}</Tx>
              <Tx s={10.5} c={C.gray} lh={1.45} style={{ marginTop: 4 }}>Your registered bank account. Razorpay's mandate form opens filled in with it — you only authorise.</Tx>
            </>
          ) : (
            <Tx s={11.5} c={C.muted} lh={1.5}>No registered bank account on file for this account. You will enter the account details on Razorpay's page — the mandate must be on the bank account registered with Qode, or the bank will reject the debits.</Tx>
          )}
      </View>
      {!!st.err && <Tx s={12} c={C.red} lh={1.45} style={{ marginTop: 12 }}>{st.err}</Tx>}
      <Tx s={11} c={C.gray} lh={1.5} style={{ marginTop: 12 }}>You'll authorise a recurring mandate on Razorpay's secure page (UPI Autopay or net banking) and be brought back here. Razorpay then debits automatically each cycle — no app interaction needed. Minimum {fmt(MIN)}, maximum {fmt(MAX)} per cycle.{isDemo() ? ' Demo: no real mandate is created.' : ''}</Tx>
      <CTA label={st.busy ? 'PLEASE WAIT…' : 'AUTHORISE SIP OF ' + fmt(amt)} onPress={start} style={{ marginTop: 16, opacity: st.busy ? 0.6 : 1 }} />
    </View>
  );
}
