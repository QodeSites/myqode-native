import React from 'react';
import { View, Pressable, KeyboardAvoidingView, Platform, ScrollView, Linking } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import { PhoneMaskField, C, Tx, Card, CTA, CurveCap, Field, OtpRow, Rise, KeyboardScroll, useKeyboardHeight, Wordmark } from '../ui';

import { SHOW_ONBOARDING } from '../api/config';
// The mobile number is a 10-digit Indian number (+91), in a field with a 00000 00000 mask (PhoneMaskField, src/ui.js;
// decided 13 Oct 2026 — the SMS code goes through 2Factor, Indian numbers only). The server applies the same rule.
// What the fields accept as they are typed: letters (with space . ' -) for the name; digits only for the number
export const cleanName = t => t.replace(/[^A-Za-z .'’-]/g, '').replace(/\s{2,}/g, ' ');
export const cleanPhone = t => t.replace(/\D/g, '').slice(0, 10);
// Each check names the field and says exactly what is wrong ('' when fine).
export const nameProblem = raw => {
  const t = String(raw || '').trim();
  if (!t) return 'Enter your full name.';
  if (/[^A-Za-z .'’-]/.test(t)) return 'Your name can only have letters, spaces, dots, apostrophes and hyphens.';
  if (t.replace(/[^A-Za-z]/g, '').length < 2) return 'Your name needs at least 2 letters.';
  if (t.length > 80) return 'Your name can be at most 80 characters.';
  return '';
};
export const emailProblem = raw => {
  const t = String(raw || '').trim();
  if (!t) return 'Enter your email address.';
  if (/\s/.test(t)) return 'Your email address cannot have spaces.';
  if ((t.match(/@/g) || []).length !== 1) return 'Your email address needs one @, like name@example.com.';
  const [user, domain] = t.split('@');
  if (!user) return 'Your email address needs something before the @.';
  if (!/^[^@]+\.[A-Za-z]{2,}$/.test(domain)) return 'Your email address needs a domain after the @, like gmail.com.';
  if (t.length > 120) return 'Your email address can be at most 120 characters.';
  return '';
};
export const phoneProblem = raw => {
  const t = String(raw || '').trim();
  const d = t.replace(/\D/g, '');
  if (!d) return 'Enter your 10-digit mobile number.';
  if (d.length !== 10) return 'Enter all 10 digits of your mobile number; ' + d.length + (d.length === 1 ? ' is' : ' are') + ' filled in.';
  if (!/^[6-9]/.test(d)) return 'A mobile number starts with 6, 7, 8 or 9.';
  return '';
};
// The text links under the sign-in card are tappable on their words only (plus a little side padding), not across the
// whole width, so a tap beside a link does nothing.
const textLink = { alignSelf: 'center', paddingHorizontal: 10 };

function DarkHead({ children, pct = 0.42 }) {
  return (
    <LinearGradient colors={C.darkGrad} locations={[0, 0.6, 1]} start={{ x: 0.1, y: 0 }} end={{ x: 0.6, y: 1 }}
      style={{ height: `${pct * 100}%`, justifyContent: 'center' }}>
      <View style={{ position: 'absolute', left: 0, right: 0, top: '40%', height: 120, pointerEvents: 'none' }}>
        <Svg width="100%" height="100%" viewBox="0 0 402 120" preserveAspectRatio="none">
          <Path d="M-20,60 C90,20 210,90 420,40" fill="none" stroke={C.gold} strokeWidth={1} opacity={0.07} />
          <Path d="M-20,110 C110,70 250,150 420,90" fill="none" stroke={C.gold} strokeWidth={1} opacity={0.05} />
        </Svg>
      </View>
      <View style={{ alignItems: 'center' }}>{children}</View>
    </LinearGradient>
  );
}

function Msg({ V }) {
  if (!V.authErr && !V.authInfo) return null;
  return (
    <Tx s={12} c={V.authErr ? C.red : C.green} lh={1.45} style={{ marginTop: 14 }}>{V.authErr || V.authInfo}</Tx>
  );
}

// Sign-up card (13 Oct 2026, in place of the open demo link): name, email and mobile; then "our team will get back to
// you", with the OneView login where the person can fetch their portfolio.
const ONEVIEW_LOGIN = 'https://oneview.qodeinvest.com/login';
function SignupCard({ V, onBack }) {
  const [f, setF] = React.useState({ name: '', email: '', phone: '', otp: '' });
  const [err, setErr] = React.useState('');
  const [done, setDone] = React.useState(false);
  // the code: sent → { to: the number it went to, wait: seconds until Resend, hint: the test server's code }
  const [sent, setSent] = React.useState(null);
  const [sending, setSending] = React.useState(false);
  React.useEffect(() => { if (!sent || sent.wait <= 0) return undefined; const t = setTimeout(() => setSent(s => (s ? { ...s, wait: s.wait - 1 } : s)), 1000); return () => clearTimeout(t); }, [sent]);
  const set = k => t => { setErr(''); V.clearAuthMsg(); setF(x => ({ ...x, [k]: t })); };   // the server's last word goes too
  const checkDetails = () => {
    const name = f.name.trim(), email = f.email.trim(), phone = f.phone.trim();
    const bad = nameProblem(name) || emailProblem(email) || phoneProblem(phone);
    if (bad) return setErr(bad) || null;
    return { name, email, phone };
  };
  const sendCode = async () => {
    const d = checkDetails(); if (!d || sending) return;
    setSending(true);
    try { const r = await V.signupSendOtp(d.phone); setSent({ to: d.phone, wait: r.resendAfterSec || 60, hint: r.devOtp || '' }); setF(x => ({ ...x, otp: '' })); }
    catch (e) {
      // sent a minute ago (e.g. the page was reloaded): that code is still valid, so ask for it
      if (e.code === 'TOO_SOON') { setSent({ to: d.phone, wait: (e.data && e.data.retryAfterSec) || 60, hint: '' }); setErr('A code was already sent to this number a moment ago. Enter it below.'); }
      else setErr(e.message || 'We could not send the code. Please try again.');
    }
    finally { setSending(false); }
  };
  const submit = async () => {
    const d = checkDetails(); if (!d) return;
    if (!sent || sent.to !== d.phone) return sendCode();   // number changed since the code went: a new code
    if (!/^\d{6}$/.test(f.otp.trim())) return setErr('Enter the 6-digit code we sent to your mobile.');
    const r = await V.doSignup({ ...d, otp: f.otp.trim() });
    if (r.ok) setDone(true);
    else if (r.code === 'OTP_LOCKED' || r.code === 'OTP_EXPIRED') { setSent(null); setF(x => ({ ...x, otp: '' })); }   // this code is spent: back to "send a code"
  };
  if (done) {
    return (
      <Card big style={{ marginTop: -30, paddingVertical: 24, paddingHorizontal: 22 }}>
        <Tx w={700} s={11} ls={0.14} c={C.muted}>THANK YOU</Tx>
        <Tx f="play" w={600} s={20} style={{ marginTop: 8 }}>{`Thanks, ${f.name.trim().split(/\s+/)[0]}.`}</Tx>
        <Tx s={12.5} c={C.muted} lh={1.55} style={{ marginTop: 8 }}>Our team will get back to you shortly. Meanwhile, fetch your portfolio in OneView.</Tx>
        <CTA label="OPEN ONEVIEW" onPress={() => Linking.openURL(ONEVIEW_LOGIN).catch(() => {})} style={{ marginTop: 20 }} />
        <Pressable onPress={onBack} style={[{ marginTop: 14, minHeight: 32, justifyContent: 'center' }, textLink]}>
          <Tx s={12} c={C.muted} center>Back to sign in</Tx>
        </Pressable>
      </Card>
    );
  }
  return (
    <Card big style={{ marginTop: -30, paddingVertical: 24, paddingHorizontal: 22 }}>
      <Tx w={700} s={11} ls={0.14} c={C.muted}>NEW TO QODE</Tx>
      <Tx s={12} c={C.muted} lh={1.5} style={{ marginTop: 6 }}>Leave your details and our team will get back to you.</Tx>
      <Field label="FULL NAME" value={f.name} onChangeText={t => set('name')(cleanName(t))} placeholder="Your name" autoCapitalize="words" style={{ marginTop: 14 }} />
      <Field label="EMAIL" value={f.email} onChangeText={t => set('email')(t.replace(/\s/g, ''))} placeholder="you@example.com" keyboardType="email-address" autoCapitalize="none" style={{ marginTop: 14 }} />
      <View style={{ marginTop: 14 }}>
        <Tx w={700} s={10} ls={0.12} c={C.gray}>MOBILE NUMBER</Tx>
        <PhoneMaskField variant="line" value={f.phone} onChange={t => set('phone')(cleanPhone(t))} />
      </View>
      {sent && sent.to === f.phone.trim() && (
        <View style={{ marginTop: 14 }}>
          <Field label="VERIFICATION CODE" value={f.otp} onChangeText={t => set('otp')(t.replace(/\D/g, '').slice(0, 6))} placeholder="6-digit code" keyboardType="number-pad" maxLength={6}
            hint={sent.hint ? `Test server: the code is ${sent.hint}` : `Sent by SMS to ${sent.to}. Valid for 10 minutes.`} />
          <Pressable onPress={sent.wait > 0 ? undefined : sendCode} style={[{ marginTop: 8, minHeight: 28, justifyContent: 'center' }, textLink]}>
            <Tx s={11.5} c={sent.wait > 0 ? C.gray : C.green} center>{sent.wait > 0 ? `Resend code in ${sent.wait}s` : 'Resend code'}</Tx>
          </Pressable>
        </View>
      )}
      {err ? <Tx s={12} c={C.red} lh={1.45} style={{ marginTop: 14 }}>{err}</Tx> : <Msg V={V} />}
      <CTA label={V.authBusy || sending ? 'PLEASE WAIT…' : sent && sent.to === f.phone.trim() ? 'VERIFY AND SIGN UP' : 'SEND VERIFICATION CODE'} onPress={submit} style={{ marginTop: 22, opacity: V.authBusy || sending ? 0.6 : 1 }} />
      <Pressable onPress={onBack} style={[{ marginTop: 14, minHeight: 32, justifyContent: 'center' }, textLink]}>
        <Tx s={12} c={C.muted} center>Already an investor? Sign in</Tx>
      </Pressable>
    </Card>
  );
}

export function Login({ V }) {
  // The sign-in card never scrolls: the dark head and the card are fixed, and only what sits below them (the DEV
  // sign-in with its client list, the demo link, a saved application, "Begin your journey") scrolls in its own
  // area. The head gives up height while the keyboard is open, and while the DEV list is expanded, so the card
  // always stays on screen.
  const kb = useKeyboardHeight();
  const headPct = kb > 0 ? 0.16 : V.devBypass && V.devOpen ? 0.26 : 0.42;
  const [mode, setMode] = React.useState('login');   // 'login' | 'signup'
  return (
    <View style={{ flex: 1, backgroundColor: C.cream }}>
      <DarkHead pct={headPct}>
        <Wordmark s={kb > 0 ? 24 : 32} />
        <View style={{ width: 44, height: 2, backgroundColor: C.gold, marginTop: kb > 0 ? 6 : 12, marginBottom: kb > 0 ? 0 : 10 }} />
      </DarkHead>
      <View style={{ marginTop: -46 }}>
        <CurveCap height={46} />
        <View style={{ backgroundColor: C.cream, paddingHorizontal: 24 }}>
          <Rise>
            {mode === 'signup' ? <SignupCard V={V} onBack={() => { V.clearAuthMsg(true); setMode('login'); }} /> : (
            <Card big style={{ marginTop: -30, paddingVertical: 24, paddingHorizontal: 22 }}>
              <Tx w={700} s={11} ls={0.14} c={C.muted}>WELCOME BACK</Tx>
              <View style={{ marginTop: 14, flexDirection: 'row', borderWidth: 1, borderColor: 'rgba(55,88,79,0.25)', borderRadius: 999, padding: 3 }}>
                {[['client', 'INVESTOR'], ['distributor', 'PARTNER']].map(([k, l]) => (
                  <Pressable key={k} onPress={() => V.setLoginAs(k)} accessibilityRole="button" accessibilityState={{ selected: V.loginAs === k }}
                    style={{ flex: 1, paddingVertical: 9, borderRadius: 999, alignItems: 'center', backgroundColor: V.loginAs === k ? C.green : 'transparent' }}>
                    <Tx w={700} s={10.5} ls={0.06} c={V.loginAs === k ? C.gold : C.muted}>{l}</Tx>
                  </Pressable>
                ))}
              </View>
              <Field label={V.loginAs === 'distributor' ? 'PARTNER EMAIL' : 'EMAIL OR ACCOUNT CODE'} value={V.email} onChangeText={V.onEmail} placeholder={V.loginAs === 'distributor' ? 'name@firm.com' : 'you@example.com'} autoCapitalize="none" style={{ marginTop: 18 }} />
              <Field label="PASSWORD" value={V.pw} onChangeText={V.onPw} placeholder="••••••••" secure style={{ marginTop: 16 }} />
              <Msg V={V} />
              <CTA label={V.authBusy ? 'PLEASE WAIT…' : 'SIGN IN SECURELY'} onPress={V.doLogin} style={{ marginTop: 22, opacity: V.authBusy ? 0.6 : 1 }} />
            </Card>
            )}
          </Rise>
          {mode === 'login' && (
            <Pressable onPress={V.doForgot} style={[{ marginTop: 14, minHeight: 32, justifyContent: 'center' }, textLink]}>
              <Tx s={12} c={C.muted} center>Forgot password</Tx>
            </Pressable>
          )}
        </View>
      </View>
      {/* Everything below the card scrolls on its own; the card above stays put. */}
      <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 30 }}>
        <View>
          {V.devBypass && (
            <Card style={{ marginTop: 18, padding: 16, borderWidth: 1, borderColor: C.gold45 }}>
              <Pressable onPress={V.toggleDev} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={{ backgroundColor: C.gold, borderRadius: 999, paddingVertical: 3, paddingHorizontal: 8 }}>
                  <Tx w={700} s={9} ls={0.14} c={C.ink}>DEV</Tx>
                </View>
                <Tx w={700} s={12} style={{ flex: 1 }}>Sign in without password</Tx>
                <Tx s={11} c={C.muted}>{V.devOpen ? 'Hide' : 'Show'}</Tx>
              </Pressable>
              {V.devOpen && (
                <View style={{ marginTop: 12 }}>
                  <Tx s={11} c={C.muted} lh={1.5}>Uses the email or account code typed above. The myQode server must be running in development (NODE_ENV=development).</Tx>
                  <CTA label={V.authBusy ? 'PLEASE WAIT…' : 'SIGN IN AS THIS USER (NO PASSWORD)'} onPress={() => V.bypassLogin()} outline style={{ marginTop: 12, opacity: V.authBusy ? 0.6 : 1 }} />
                  <Field label={V.loginAs === 'distributor' ? 'FIND A PARTNER' : 'FIND AN INVESTOR'} value={V.devQ} onChangeText={V.onDevQ} placeholder="name, email or code" autoCapitalize="none" style={{ marginTop: 14 }} />
                  <Tx s={10} c={C.gray} style={{ marginTop: 6 }}>Server: {V.apiBase}</Tx>
                  {!V.devLoaded && <Tx s={11} c={C.muted} style={{ marginTop: 8 }}>Loading investors…</Tx>}
                  {!!V.devErr && (
                    <Pressable onPress={V.reloadDev} style={{ marginTop: 8 }}>
                      <Tx s={11} c={C.red} lh={1.45}>{V.devErr}</Tx>
                      <Tx w={700} s={11} c={C.green} style={{ marginTop: 4 }}>Tap to retry</Tx>
                    </Pressable>
                  )}
                  {V.devLoaded && !V.devErr && V.devClients.length === 0 && <Tx s={11} c={C.muted} style={{ marginTop: 8 }}>{V.loginAs === 'distributor' ? 'No partner login matches that search.' : 'No Discretionary investor matches that search. Non-Discretionary accounts aren’t listed — type the code above and use the button instead.'}</Tx>}
                  {V.devClients.length > 0 && (
                    <View style={{ marginTop: 8, maxHeight: 260, borderWidth: 1, borderColor: C.hairline, borderRadius: 8 }}>
                      <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 10 }}>
                        {V.devClients.map((c, i) => (
                          <Pressable key={c.clientCode || 'p:' + i + ':' + c.email} onPress={() => V.bypassLogin(c.email || c.clientCode)} style={{ paddingVertical: 10, borderBottomWidth: i < V.devClients.length - 1 ? 1 : 0, borderColor: C.hairline }}>
                            <Tx w={700} s={12}>{c.name || c.clientCode}</Tx>
                            <Tx s={10.5} c={C.muted} style={{ marginTop: 2 }}>{[c.clientCode, c.email, c.schemeName].filter(Boolean).join(' · ')}</Tx>
                          </Pressable>
                        ))}
                      </ScrollView>
                      <Tx s={10} c={C.gray} center style={{ paddingVertical: 4 }}>{V.devClients.length} {V.devClients.length === 1 ? 'match' : 'matches'} · scroll the list</Tx>
                    </View>
                  )}
                </View>
              )}
            </Card>
          )}
          {mode === 'login' && (
            <Pressable onPress={() => { V.clearAuthMsg(); setMode('signup'); }} style={[{ marginTop: 14 }, textLink]}>
              <Tx s={12} c={C.muted} center>New to Qode? <Tx w={700} s={12} c={C.green}>Sign up</Tx></Tx>
            </Pressable>
          )}
          {V.hasResume && (
            <Card style={{ marginTop: 18, padding: 16, borderWidth: 1, borderColor: C.gold45 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={{ backgroundColor: C.gold, borderRadius: 999, paddingVertical: 3, paddingHorizontal: 8 }}>
                  <Tx w={700} s={9} ls={0.14} c={C.ink}>{V.resumeInfo.status === 'submitted' ? 'SUBMITTED' : 'IN PROGRESS'}</Tx>
                </View>
                <Tx w={700} s={12} style={{ flex: 1 }}>{V.resumeInfo.name ? 'Welcome back, ' + V.resumeInfo.name.split(' ')[0] : 'Your application'}</Tx>
              </View>
              <Tx s={11.5} c={C.muted} lh={1.5} style={{ marginTop: 8 }}>{V.resumeInfo.stepText}{V.resumeInfo.pct ? ' · ' + V.resumeInfo.pct + '% complete' : ''}</Tx>
              <View style={{ marginTop: 10, height: 4, borderRadius: 2, backgroundColor: 'rgba(55,88,79,0.15)' }}>
                <View style={{ width: Math.max(4, V.resumeInfo.pct) + '%', height: 4, borderRadius: 2, backgroundColor: C.gold }} />
              </View>
              <CTA label={V.resumeInfo.status === 'submitted' ? 'TRACK MY APPLICATION' : 'CONTINUE MY APPLICATION'} onPress={V.resumeGo} style={{ marginTop: 14 }} />
              <Pressable onPress={V.resumeDiscard} style={{ marginTop: 10, minHeight: 32, justifyContent: 'center' }}>
                <Tx s={11} c={C.muted} center>Not you? Remove this from the device</Tx>
              </Pressable>
            </Card>
          )}
          {SHOW_ONBOARDING && (
            <Pressable onPress={V.startOb} style={[{ marginTop: 14 }, textLink]}>
              <Tx s={12} c={C.muted} center>New to Qode? <Tx w={700} s={12} c={C.green}>Begin your journey</Tx></Tx>
            </Pressable>
          )}
          <Tx s={10} ls={0.08} c={C.gray} center style={{ marginTop: 26 }}>PROTECTED BY 256-BIT ENCRYPTION</Tx>
        </View>
      </ScrollView>
      {/* iOS does not resize the window for the keyboard: keep the card above it */}
      {Platform.OS === 'ios' && kb > 0 && <View style={{ height: kb }} />}
    </View>
  );
}

export function OtpScreen({ V }) {
  return (
    <View style={{ flex: 1, backgroundColor: C.cream }}>
      <DarkHead pct={0.36}>
        <Tx f="play" w={600} s={26} c={C.cream}>Verify It's You</Tx>
        <View style={{ width: 44, height: 2, backgroundColor: C.gold, marginTop: 12, marginBottom: 10 }} />
        <Tx s={12} c={C.cream65}>Code sent to {V.otpEmailMask}</Tx>
      </DarkHead>
      <KeyboardScroll style={{ flex: 1, marginTop: -46 }} contentContainerStyle={{ flexGrow: 1 }} >
        <CurveCap height={46} />
        <View style={{ backgroundColor: C.cream, flexGrow: 1, paddingHorizontal: 24, paddingBottom: 30 }}>
          <Rise>
            <Card big style={{ marginTop: -30, paddingVertical: 24, paddingHorizontal: 22 }}>
              <Tx w={700} s={11} ls={0.14} c={C.muted}>FIRST-TIME SETUP · ONE-TIME PASSCODE</Tx>
              <View style={{ marginTop: 16 }}>
                <OtpRow boxes={V.otpBoxes} />
              </View>
              <Msg V={V} />
              {V.otpLocked
                ? <CTA label={V.authBusy ? 'PLEASE WAIT…' : 'REQUEST A NEW CODE'} onPress={V.resendOtp} style={{ marginTop: 18, opacity: V.authBusy ? 0.6 : 1 }} />
                : (<>
                  <CTA label={V.authBusy ? 'PLEASE WAIT…' : 'VERIFY'} onPress={V.verifyOtp} style={{ marginTop: 18, opacity: V.authBusy ? 0.6 : 1 }} />
                  <Pressable onPress={V.resendOtp} style={{ marginTop: 14, minHeight: 32, justifyContent: 'center' }}>
                    <Tx w={700} s={12} c={C.green} center>Resend code</Tx>
                  </Pressable>
                </>)}
            </Card>
          </Rise>
          <Pressable onPress={V.backToLogin} style={{ marginTop: 18 }}>
            <Tx s={12} c={C.muted} center>Back to sign in</Tx>
          </Pressable>
        </View>
      </KeyboardScroll>
    </View>
  );
}

export function SetPassword({ V }) {
  return (
    <View style={{ flex: 1, backgroundColor: C.cream }}>
      <DarkHead pct={0.36}>
        <Tx f="play" w={600} s={26} c={C.cream}>Set Your Password</Tx>
        <View style={{ width: 44, height: 2, backgroundColor: C.gold, marginTop: 12, marginBottom: 10 }} />
        <Tx s={12} c={C.cream65}>Choose a password for {V.otpEmailMask}</Tx>
      </DarkHead>
      <KeyboardScroll style={{ flex: 1, marginTop: -46 }} contentContainerStyle={{ flexGrow: 1 }} >
        <CurveCap height={46} />
        <View style={{ backgroundColor: C.cream, flexGrow: 1, paddingHorizontal: 24, paddingBottom: 30 }}>
          <Rise>
            <Card big style={{ marginTop: -30, paddingVertical: 24, paddingHorizontal: 22 }}>
              <Tx w={700} s={11} ls={0.14} c={C.muted}>NEW PASSWORD</Tx>
              <Field label="PASSWORD" value={V.np} onChangeText={V.onNp} placeholder="••••••••" secure style={{ marginTop: 14 }} />
              <Field label="CONFIRM PASSWORD" value={V.np2} onChangeText={V.onNp2} placeholder="••••••••" secure style={{ marginTop: 16 }} />
              <Tx s={11} c={C.gray} lh={1.5} style={{ marginTop: 12 }}>At least 8 characters, with upper and lower case letters, a number and a symbol. No spaces.</Tx>
              <Msg V={V} />
              <CTA label={V.authBusy ? 'PLEASE WAIT…' : 'SAVE & SIGN IN'} onPress={V.savePassword} style={{ marginTop: 20, opacity: V.authBusy ? 0.6 : 1 }} />
            </Card>
          </Rise>
        </View>
      </KeyboardScroll>
    </View>
  );
}
