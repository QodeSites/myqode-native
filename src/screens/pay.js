// One-time top-up through Razorpay.
//   amount → create order → Razorpay Checkout in the SYSTEM BROWSER (Chrome Custom Tab / Safari sheet; real UPI
//   apps and bank OTP pages work there) → Razorpay posts the result to the server → browser bounces back into
//   the app → the app re-verifies the order with the server → result screen.
// Every outcome is handled: success, failed, cancelled/closed, still pending, link expired, offline/verify error.
// Works in Expo Go. With test keys nobody is charged and the client's real contact details never reach the gateway.
//
// Coming back: the return page redirects the browser to `Linking.createURL('payment-return')` — myqode://… in a
// build, exp://<dev host>/--/payment-return in Expo Go — and the auth session closes the browser and hands the
// URL back here. Because Expo Go may instead RELOAD the project on that link (state lost), the order in progress
// is also written to device storage: src/main.js finds it on the next start / deep link and reopens this sheet in
// recovery mode (`recover` prop), which just re-verifies the order with the server.
import React, { useState, useRef, useEffect } from 'react';
import { View, Pressable, Platform, ActivityIndicator, AppState } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { C, Tx, Amt, Field, CTA } from '../ui';
import { Check } from '../icons';
import { payments, BASE_URL, isDemo } from '../api';
import { storeGet, storeSet, storeDel } from '../api/session';
import { AccountChips } from './kit';

const PENDING_KEY = 'myqode.pendingPayment';
const PENDING_MAX_AGE = 45 * 60 * 1000;   // a Razorpay order is payable for ~this long
export async function readPendingPayment() {
  try { const p = JSON.parse((await storeGet(PENDING_KEY)) || 'null'); return p && p.orderId && Date.now() - p.at < PENDING_MAX_AGE ? p : null; } catch { return null; }
}
export const clearPendingPayment = () => storeDel(PENDING_KEY);
// status=… from the return page's redirect → the verify hint
export const hintFromReturnUrl = url => { const s = ((Linking.parse(url || '').queryParams || {}).status) || ''; return s === 'success' ? 'success' : s === 'failed' ? 'failed' : s === 'expired' ? 'expired' : ''; };

const CHIPS = [100000, 500000, 1000000];
const MIN = 100, MAX = 500000;
const fmt = v => '₹' + Number(v || 0).toLocaleString('en-IN');
const Lbl = ({ children, style }) => <Tx w={700} s={10} ls={0.12} c={C.gray} style={[{ marginTop: 18 }, style]}>{children}</Tx>;

const RESULT = {
  success: { title: 'Payment successful', text: 'Funds received. Units are allotted at the next applicable NAV, and the status appears under Online investments.' },
  failed:  { title: 'Payment failed', text: 'The payment did not go through and nothing was charged. You can try again or use a bank transfer.' },
  pending: { title: 'Payment pending', text: 'We have not received a confirmation yet. If money was debited it will show under Online investments once the bank confirms — usually within a few minutes.' },
  cancelled: { title: 'Payment not completed', text: 'The payment window was closed before a payment was recorded. If you did pay, tap Check status — nothing is charged twice.' },
  expired: { title: 'Payment link expired', text: 'This payment link is no longer valid. Please start again.' },
  error:   { title: 'Could not confirm the payment', text: 'We could not reach Qode to confirm the payment. Check your connection and tap Check status.' },
};

export function PayOnline({ V, onDone, recover }) {
  const opts = V.acctOptions;
  const [acct, setAcct] = useState(opts[0] && opts[0].id);
  const [amt, setAmt] = useState(0);
  const [st, setSt] = useState({ step: recover ? 'verify' : 'form', busy: false, err: '', order: recover ? recover.order : null, kind: '', detail: '', result: null, ret: '' });
  const alive = useRef(true);
  useEffect(() => () => { alive.current = false; }, []);
  // Recovery: the app was reopened (deep link or fresh start) with an order still in progress — ask the server.
  useEffect(() => { if (recover) verify(recover.order, recover.hint || ''); }, []);
  // Whenever the app comes back to the foreground with an undecided order (browser closed early, phone
  // switched apps, old bundle…), ask the server again — the payment may have completed meanwhile.
  const stRef = useRef(st); stRef.current = st;
  useEffect(() => {
    const sub = AppState.addEventListener('change', a => {
      const cur = stRef.current;
      if (a === 'active' && cur.order && cur.step === 'done' && (cur.kind === 'cancelled' || cur.kind === 'pending' || cur.kind === 'error')) verify(cur.order, '', 2);
    });
    return () => sub.remove();
  }, []);
  const set = p => { if (alive.current) setSt(s => ({ ...s, ...p })); };

  const finish = (kind, result, detail = '') => {
    set({ step: 'done', kind, result, detail, busy: false });
    if (kind === 'success' || kind === 'failed' || kind === 'expired') clearPendingPayment();   // decided: nothing to recover later
    if (kind === 'success' && onDone) onDone(result);
  };

  // Ask the server what Razorpay says about the order — the single source of truth for the result screen.
  // Capture can lag the bank page by a few seconds, so an undecided order is re-checked a few times before we
  // settle on a result. "Cancelled" is only shown when Razorpay says the user never attempted a payment.
  const verify = async (order, hint, tries = 4) => {
    set({ step: 'verify', err: '' });
    try {
      let v = null;
      for (let i = 0; i < tries; i++) {
        v = await payments.razorpay.verify({ razorpay_order_id: order.orderId });
        if (v.isSuccess || v.isFailed || (hint === 'cancelled' && !v.attempts) || hint === 'expired') break;
        if (i < tries - 1) await new Promise(r => setTimeout(r, 2500));
      }
      if (v.isSuccess) return finish('success', v);
      if (v.isFailed) return finish('failed', v, (v.payment && v.payment.message) || '');
      if (hint === 'expired') return finish('expired', v);
      if (hint === 'cancelled' && !v.attempts) return finish('cancelled', v);
      return finish('pending', v, hint === 'failed' ? 'The bank reported a failure; waiting for Razorpay to confirm.' : '');
    } catch (e) { finish('error', null, e.message); }
  };

  const start = async () => {
    if (st.busy) return;
    if (!amt || amt < MIN) return set({ err: `Enter at least ${fmt(MIN)}.` });
    if (amt > MAX) return set({ err: `Online payments are capped at ${fmt(MAX)} per transaction. For larger amounts please use a bank transfer.` });
    set({ busy: true, err: '' });
    let order;
    try { order = await payments.razorpay.createOrder({ accountId: acct, amount: amt }); }
    catch (e) { return set({ busy: false, err: e.message }); }
    set({ order });
    if (isDemo()) return finish('success', await payments.razorpay.verify({ razorpay_order_id: order.orderId }));

    // Where the return page sends the browser: myqode://payment-return in a build, exp://<dev host>/--/payment-return
    // in Expo Go. The order is remembered on the device first, so a reload on the way back can still recover it.
    const ret = Linking.createURL('payment-return');
    await storeSet(PENDING_KEY, JSON.stringify({ orderId: order.orderId, accountId: acct, amount: amt, at: Date.now() }));
    set({ ret });
    const url = BASE_URL + order.checkoutPath + '&ret=' + encodeURIComponent(ret);
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined') window.open(url, '_blank');
      return set({ step: 'browser', busy: false });
    }
    let res;
    try {
      // Auth session: the browser tab closes by itself when it reaches `ret`, and the URL comes back here.
      // createTask:false keeps the tab in the app's own task, so a manual close also lands on this screen.
      res = await WebBrowser.openAuthSessionAsync(url, ret, { createTask: false, showInRecents: false, dismissButtonStyle: 'close', toolbarColor: '#02422B', controlsColor: '#DABD38' });
    } catch (e) { return finish('error', null, 'Could not open the payment window: ' + e.message); }
    if (res && res.type === 'success' && res.url) return verify(order, hintFromReturnUrl(res.url));
    // browser closed by hand: the user may have paid, failed or cancelled — the server knows
    verify(order, 'cancelled');
  };

  const reset = () => { clearPendingPayment(); set({ step: 'form', busy: false, err: '', order: null, kind: '', detail: '', result: null, ret: '' }); };

  if (st.step === 'verify') {
    return <View style={{ alignItems: 'center', paddingVertical: 28 }}><ActivityIndicator color={C.green} /><Tx s={12.5} c={C.muted} style={{ marginTop: 12 }}>Confirming your payment…</Tx></View>;
  }
  if (st.step === 'browser') {
    return (
      <View style={{ paddingVertical: 14 }}>
        <Tx w={700} s={14}>Complete the payment in the new tab</Tx>
        <Tx s={12.5} c={C.muted} lh={1.5} style={{ marginTop: 8 }}>When you're done, come back here and tap Check status.</Tx>
        <CTA label="CHECK STATUS" onPress={() => verify(st.order, '')} style={{ marginTop: 18 }} />
        <Pressable onPress={reset} style={{ marginTop: 12, alignItems: 'center' }}><Tx s={12} c={C.muted}>Cancel</Tx></Pressable>
      </View>
    );
  }
  if (st.step === 'done') {
    const r = RESULT[st.kind] || RESULT.pending, v = st.result, ok = st.kind === 'success';
    const bad = st.kind === 'failed' || st.kind === 'error' || st.kind === 'expired';
    return (
      <View style={{ alignItems: 'center', paddingVertical: 18 }}>
        <View style={{ width: 52, height: 52, borderRadius: 26, borderWidth: 1.5, borderColor: ok ? C.green : bad ? C.red : C.gold, alignItems: 'center', justifyContent: 'center' }}>
          {ok ? <Check s={22} w={2.4} /> : <Tx w={700} s={22} c={bad ? C.red : C.gold}>{bad ? '!' : '…'}</Tx>}
        </View>
        <Tx w={700} s={15} style={{ marginTop: 14 }}>{r.title}</Tx>
        {!!(v && v.amount) && <Amt s={20} style={{ marginTop: 6 }}>{fmt(v.amount)}</Amt>}
        <Tx s={12.5} c={C.muted} lh={1.6} center style={{ marginTop: 8 }}>{r.text}</Tx>
        {!!st.detail && <Tx s={11.5} c={bad ? C.red : C.muted} lh={1.5} center style={{ marginTop: 8 }}>{st.detail}</Tx>}
        {v && v.payment && <Tx s={11} c={C.gray} center style={{ marginTop: 10 }}>{[v.payment.method && v.payment.method.toUpperCase(), v.payment.vpa || v.payment.bank, v.payment.reference && 'Ref ' + v.payment.reference].filter(Boolean).join(' · ')}</Tx>}
        {!!(st.order && st.order.orderId) && <Tx s={11} c={C.gray} style={{ marginTop: 4 }}>Order {st.order.orderId}</Tx>}
        {V.testMode && !!st.ret && <Tx s={10} c={C.gray} center style={{ marginTop: 4 }}>Return link: {st.ret}</Tx>}
        {(st.kind === 'pending' || st.kind === 'error' || st.kind === 'cancelled') && <CTA label="CHECK STATUS" outline onPress={() => verify(st.order, '')} style={{ marginTop: 18, alignSelf: 'stretch' }} />}
        {(st.kind === 'failed' || st.kind === 'cancelled' || st.kind === 'expired') && <CTA label="TRY AGAIN" outline onPress={reset} style={{ marginTop: 10, alignSelf: 'stretch' }} />}
        <CTA label="DONE" onPress={V.closeSheet} style={{ marginTop: 10, alignSelf: 'stretch' }} />
      </View>
    );
  }
  return (
    <View>
      {opts.length > 1 && <><Lbl style={{ marginTop: 14 }}>ACCOUNT</Lbl><AccountChips options={opts} value={acct} onPick={setAcct} /></>}
      <Lbl style={{ marginTop: 14 }}>AMOUNT</Lbl>
      <Field value={amt ? amt.toLocaleString('en-IN') : ''} onChangeText={t => { setAmt(Math.min(parseInt(t.replace(/\D/g, '') || '0', 10), MAX)); set({ err: '' }); }} numeric s={26} prefix="₹" />
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
        {CHIPS.map(v => (
          <Pressable key={v} onPress={() => { setAmt(a => Math.min((a || 0) + v, MAX)); set({ err: '' }); }} style={{ borderWidth: 1, borderColor: C.greenBorder, borderRadius: 999, paddingVertical: 8, paddingHorizontal: 14 }}>
            <Amt s={12} c={C.green}>+{fmt(v)}</Amt>
          </Pressable>
        ))}
      </View>
      {!!st.err && <Tx s={12} c={C.red} lh={1.45} style={{ marginTop: 12 }}>{st.err}</Tx>}
      <Tx s={11} c={C.gray} lh={1.5} style={{ marginTop: 12 }}>You'll be taken to Razorpay's secure payment page (UPI, cards, net banking, wallets) and brought back here. Minimum {fmt(MIN)}, maximum {fmt(MAX)} per transaction. Funds received before 2:00 PM IST are invested at the next available NAV.{isDemo() ? ' Demo: no real payment is made.' : ''}</Tx>
      <CTA label={st.busy ? 'PLEASE WAIT…' : 'PAY ' + fmt(amt) + ' SECURELY'} onPress={start} style={{ marginTop: 16, opacity: st.busy ? 0.6 : 1 }} />
    </View>
  );
}
