// Desktop web sign-in (browser ≥ 1024 px wide, every signed-out phase). Same view-model V as the phone screens in
// src/screens/login.js, splash.js and gate.js — every field, handler, error and busy flag is theirs — laid out as a
// split screen: a dark-green brand panel on the left, the form centred on cream on the right. Onboarding is the
// phone flow itself, hosted in a fixed-width right panel, so the long 8-step form isn't maintained twice.
import React, { useEffect, useRef, useState } from 'react';
import { View, Pressable, ScrollView, TextInput, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import { C, Tx, Card, Wordmark, useUI } from '../ui';
import { FaceID, ChevronLeft } from '../icons';
import Onboarding, { ResumeScreen } from '../screens/onboarding';
import { ActivityIndicator } from 'react-native';

import { SHOW_ONBOARDING } from '../api/config';
import { AppLinks } from './kit';
// The sign-in screens keep the brand look (green and gold on cream, Lato) with their own small controls, so the
// dashboard's design system can change without touching them.
const Label = ({ children, style, c = C.muted }) => <Tx w={700} s={10.5} ls={0.12} c={c} style={style}>{children}</Tx>;

function Btn({ label, onPress, kind = 'primary', icon, disabled, busy, style, small }) {
  const pal = {
    primary: { bg: C.green, hov: C.ink, fg: C.gold, bd: C.green },
    outline: { bg: 'transparent', hov: 'rgba(2,66,43,0.06)', fg: C.green, bd: C.mutedBorder35 },
    gold: { bg: C.gold, hov: '#e8cc4e', fg: C.ink, bd: C.gold },
    ghost: { bg: 'transparent', hov: 'rgba(2,66,43,0.06)', fg: C.green, bd: 'transparent' },
    danger: { bg: 'transparent', hov: 'rgba(239,68,68,0.06)', fg: C.red, bd: 'rgba(239,68,68,0.5)' },
  }[kind];
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled: !!disabled, busy: !!busy }} onPress={disabled || busy ? undefined : onPress} style={({ hovered }) => [{
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
      paddingVertical: small ? 8 : 12, paddingHorizontal: small ? 14 : 20, borderRadius: 8, borderWidth: 1,
      backgroundColor: hovered && !disabled ? pal.hov : pal.bg, borderColor: pal.bd, opacity: disabled ? 0.45 : 1,
    }, style]}>
      {busy ? <ActivityIndicator size="small" color={pal.fg} /> : icon}
      <Tx w={700} s={small ? 12 : 13} ls={0.04} c={pal.fg}>{label}</Tx>
    </Pressable>
  );
}

// Email fields are plain text inputs with the email keyboard (inputMode): browser add-ons that restyle
// <input type="email"> (mail-alias extensions) leave them alone, and autofill still offers the saved address.
function Input({ label, value, onChangeText, placeholder, secure, error, hint, right, keyboardType, autoFocus, onSubmitEditing, style }) {
  const [focus, setFocus] = useState(false);
  const email = keyboardType === 'email-address';
  // react-native-web renders inputMode="email" as type="email"; switch the element itself back to text.
  const ref = useRef(null);
  useEffect(() => { const n = ref.current; if (email && n && n.setAttribute) n.setAttribute('type', 'text'); }, [email]);
  return (
    <View style={style}>
      {!!label && <Label style={{ marginBottom: 7 }}>{label}</Label>}
      <View style={{ flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 8, backgroundColor: '#fff',
        borderColor: error ? C.red : focus ? C.green : C.mutedBorder35, paddingHorizontal: 14, minHeight: 48 }}>
        <TextInput ref={ref} value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor={C.gray}
          secureTextEntry={secure} keyboardType={email ? 'default' : keyboardType} inputMode={email ? 'email' : undefined}
          autoComplete={email ? 'username' : secure ? 'current-password' : undefined} autoFocus={autoFocus} autoCapitalize="none" autoCorrect={false}
          spellCheck={false} onFocus={() => setFocus(true)} onBlur={() => setFocus(false)} onSubmitEditing={onSubmitEditing}
          style={{ flex: 1, alignSelf: 'stretch', minHeight: 46, width: '100%', paddingVertical: 12, fontSize: 14, lineHeight: 20, backgroundColor: 'transparent', borderWidth: 0, color: C.ink, fontFamily: 'Lato_400Regular', outlineStyle: 'none' }} />
        {right}
      </View>
      {!!(error || hint) && <Tx s={11.5} c={error ? C.red : C.muted} style={{ marginTop: 6 }}>{error || hint}</Tx>}
    </View>
  );
}

const GOLD_TINT = 'rgba(218,189,56,0.12)';

/* ── frame ──────────────────────────────────────────────────────────────────────────────────────────────── */
// Faint gold threads, the phone's splash/login motif, stretched across the whole panel.
function Threads({ opacity = 1 }) {
  return (
    <View style={{ position: 'absolute', left: 0, right: 0, top: '22%', height: '60%', opacity, pointerEvents: 'none' }}>
      <Svg width="100%" height="100%" viewBox="0 0 600 400" preserveAspectRatio="none">
        <Path d="M-20,90 C160,30 330,160 620,70" fill="none" stroke={C.gold} strokeWidth={1} opacity={0.09} />
        <Path d="M-20,190 C190,120 380,260 620,170" fill="none" stroke={C.gold} strokeWidth={1} opacity={0.07} />
        <Path d="M-20,300 C220,230 400,370 620,280" fill="none" stroke={C.gold} strokeWidth={1} opacity={0.05} />
      </Svg>
    </View>
  );
}

// Brand copy per context: sign-in talks about the portfolio, onboarding about opening an account.
const COPY = {
  signin: {
    head: 'All your Qode accounts, in one sign\u2011in',
    points: [
      ['Performance at a glance', 'Portfolio value, returns, drawdown and trailing performance against the benchmark, for every account in your family.'],
      ['Statements when you need them', 'Transactions, capital gains, expenses and your portfolio fact sheet, ready to download as PDF.'],
      ['Act in a few clicks', 'Top up, set up a SIP, switch strategies or raise a request with our Investor Relations team.'],
    ],
  },
  ob: {
    head: 'Open your Qode account, entirely online.',
    points: [
      ['Verify with DigiLocker', 'Fetch your PAN and Aadhaar securely, with no paperwork to upload.'],
      ['Confirm your bank', 'A ₹1 penny drop checks your bank account in seconds.'],
      ['Pick up where you left off', 'Your application saves as you go, so you can finish it later.'],
    ],
  },
};

function BrandPanel({ V, kind = 'signin' }) {
  const copy = COPY[kind];
  return (
    <LinearGradient colors={C.darkGrad} locations={[0, 0.6, 1]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
      style={{ flex: 1, minWidth: 420, paddingHorizontal: 64, paddingVertical: 52, justifyContent: 'space-between', overflow: 'hidden' }}>
      <Threads />
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <View>
          <Wordmark s={40} />
          <Tx w={700} s={9.5} ls={0.18} c={C.cream55} style={{ marginTop: 6 }}>QODE ADVISORS LLP · PMS</Tx>
          <View style={{ width: 44, height: 2, backgroundColor: C.gold, marginTop: 16 }} />
        </View>
        {V.testMode && (
          <View style={{ borderWidth: 1, borderColor: C.red, borderRadius: 4, paddingVertical: 4, paddingHorizontal: 12 }}>
            <Tx w={700} s={10} ls={0.1} c={C.red}>TEST MODE</Tx>
          </View>
        )}
      </View>
      <View style={{ maxWidth: 560, marginVertical: 40 }}>
        <Tx f="play" w={600} s={42} c={C.cream} lh={1.18}>{copy.head}</Tx>
        <View style={{ marginTop: 34, gap: 24 }}>
          {copy.points.map(([t, b], i) => (
            <View key={t} style={{ flexDirection: 'row', gap: 16 }}>
              <View style={{ width: 30, height: 30, borderRadius: 15, borderWidth: 1, borderColor: C.gold45, backgroundColor: GOLD_TINT, alignItems: 'center', justifyContent: 'center' }}>
                <Tx f="inter" w={600} s={12} c={C.gold}>{i + 1}</Tx>
              </View>
              <View style={{ flex: 1 }}>
                <Tx w={700} s={15} c={C.cream}>{t}</Tx>
                <Tx s={13} c={C.cream60} lh={1.55} style={{ marginTop: 4 }}>{b}</Tx>
              </View>
            </View>
          ))}
        </View>
      </View>
      <View style={{ borderTopWidth: 1, borderColor: 'rgba(239,236,211,0.12)', paddingTop: 18 }}>
        <Tx s={11.5} c={C.cream40} lh={1.5}>Qode Advisors LLP · SEBI Registered Portfolio Manager</Tx>
      </View>
    </LinearGradient>
  );
}

// Split screen: brand left, cream form column right (scrolls on short windows, form centred when it fits).
function Split({ V, children, kind }) {
  return (
    <View style={{ flex: 1, flexDirection: 'row', backgroundColor: C.cream }}>
      <BrandPanel V={V} kind={kind} />
      <View style={{ flex: 1, minWidth: 540, maxWidth: 760, backgroundColor: C.cream }}>
        <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ flexGrow: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 48, paddingVertical: 16 }}>
          <View style={{ width: 440, maxWidth: '100%' }}>{children}</View>
        </ScrollView>
        <Tx s={10} ls={0.1} c={C.gray} center style={{ paddingBottom: 12 }}>PROTECTED BY 256-BIT ENCRYPTION</Tx>
      </View>
    </View>
  );
}

/* ── pieces ─────────────────────────────────────────────────────────────────────────────────────────────── */
function Heading({ eyebrow, title, sub }) {
  return (
    <View style={{ marginBottom: 22 }}>
      {!!eyebrow && <Label style={{ marginBottom: 10 }}>{eyebrow}</Label>}
      <Tx f="play" w={600} s={34} lh={1.2}>{title}</Tx>
      <View style={{ width: 40, height: 2, backgroundColor: C.gold, marginTop: 14 }} />
      {!!sub && <Tx s={13.5} c={C.muted} lh={1.55} style={{ marginTop: 10 }}>{sub}</Tx>}
    </View>
  );
}

// V.authErr / V.authInfo, the phone's Msg, as a tinted banner.
function Msg({ V }) {
  if (!V.authErr && !V.authInfo) return null;
  const err = !!V.authErr;
  return (
    <View accessibilityLiveRegion="polite" style={{ marginTop: 16, borderRadius: 8, borderWidth: 1, paddingVertical: 10, paddingHorizontal: 14,
      borderColor: err ? 'rgba(239,68,68,0.4)' : C.greenBorder, backgroundColor: err ? 'rgba(239,68,68,0.06)' : 'rgba(2,66,43,0.05)' }}>
      <Tx s={12.5} c={err ? C.red : C.green} lh={1.45}>{V.authErr || V.authInfo}</Tx>
    </View>
  );
}

const Link = ({ label, onPress, c = C.green, w = 700, s = 12.5, style }) => (
  <Pressable onPress={onPress} accessibilityRole="button" style={({ hovered }) => [{ opacity: hovered ? 0.7 : 1 }, style]}>
    <Tx w={w} s={s} c={c}>{label}</Tx>
  </Pressable>
);

const BackLink = ({ label, onPress }) => (
  <Pressable onPress={onPress} accessibilityRole="button" style={({ hovered }) => ({ flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', marginBottom: 26, opacity: hovered ? 0.7 : 1 })}>
    <ChevronLeft s={16} c={C.muted} />
    <Tx w={700} s={12.5} c={C.muted}>{label}</Tx>
  </Pressable>
);

// Password field with a Show / Hide toggle (kit Input has no eye of its own).
function PwInput({ label, value, onChangeText, onSubmitEditing, style, autoFocus }) {
  const [shown, setShown] = useState(false);
  return (
    <Input label={label} value={value} onChangeText={onChangeText} placeholder="••••••••" secure={!shown} autoFocus={autoFocus}
      onSubmitEditing={onSubmitEditing} style={style}
      right={(
        <Pressable onPress={() => setShown(v => !v)} accessibilityRole="button" accessibilityLabel={shown ? 'Hide password' : 'Show password'} hitSlop={8} style={{ paddingLeft: 10, paddingVertical: 6 }}>
          <Tx w={700} s={11.5} c={C.muted}>{shown ? 'Hide' : 'Show'}</Tx>
        </Pressable>
      )} />
  );
}

// Client | Partner switch (V.loginAs is 'client' or 'distributor', as on the phone).
function RoleSwitch({ V }) {
  return (
    <View accessibilityRole="tablist" style={{ flexDirection: 'row', borderWidth: 1, borderColor: C.mutedBorder35, borderRadius: 10, padding: 4, backgroundColor: C.card, marginBottom: 22 }}>
      {[['client', 'Investor'], ['distributor', 'Partner']].map(([k, l]) => {
        const on = V.loginAs === k;
        return (
          <Pressable key={k} onPress={() => V.setLoginAs(k)} accessibilityRole="button" accessibilityState={{ selected: on }}
            style={({ hovered }) => ({ flex: 1, paddingVertical: 10, borderRadius: 7, alignItems: 'center',
              backgroundColor: on ? C.green : hovered ? 'rgba(2,66,43,0.05)' : 'transparent' })}>
            <Tx w={700} s={12.5} ls={0.03} c={on ? C.gold : C.muted}>{l}</Tx>
          </Pressable>
        );
      })}
    </View>
  );
}

/* ── sign in ────────────────────────────────────────────────────────────────────────────────────────────── */
function DevCard({ V }) {
  return (
    <Card style={{ marginTop: 22, padding: 16, borderWidth: 1, borderColor: C.gold45 }}>
      <Pressable onPress={V.toggleDev} accessibilityRole="button" style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <View style={{ backgroundColor: C.gold, borderRadius: 4, paddingVertical: 3, paddingHorizontal: 8 }}>
          <Tx w={700} s={9} ls={0.14} c={C.ink}>DEV</Tx>
        </View>
        <Tx w={700} s={12.5} style={{ flex: 1 }}>Sign in without password</Tx>
        <Tx s={11.5} c={C.muted}>{V.devOpen ? 'Hide' : 'Show'}</Tx>
      </Pressable>
      {V.devOpen && (
        <View style={{ marginTop: 12 }}>
          <Tx s={11.5} c={C.muted} lh={1.5}>Uses the email or account code typed above. The myQode server must be running in development (NODE_ENV=development).</Tx>
          <Btn label="Sign in as this user (no password)" kind="outline" busy={V.authBusy} onPress={() => V.bypassLogin()} style={{ marginTop: 12 }} />
          <Input label={V.loginAs === 'distributor' ? 'FIND A PARTNER' : 'FIND AN INVESTOR'} value={V.devQ} onChangeText={V.onDevQ} placeholder="name, email or code" style={{ marginTop: 14 }} />
          <Tx s={10.5} c={C.gray} style={{ marginTop: 6 }}>Server: {V.apiBase}</Tx>
          {!V.devLoaded && <Tx s={11.5} c={C.muted} style={{ marginTop: 8 }}>Loading investors…</Tx>}
          {!!V.devErr && (
            <Pressable onPress={V.reloadDev} accessibilityRole="button" style={{ marginTop: 8 }}>
              <Tx s={11.5} c={C.red} lh={1.45}>{V.devErr}</Tx>
              <Tx w={700} s={11.5} c={C.green} style={{ marginTop: 4 }}>Click to retry</Tx>
            </Pressable>
          )}
          {V.devLoaded && !V.devErr && V.devClients.length === 0 && <Tx s={11.5} c={C.muted} lh={1.5} style={{ marginTop: 8 }}>{V.loginAs === 'distributor' ? 'No partner login matches that search.' : 'No Discretionary investor matches that search. Non-Discretionary accounts aren’t listed. Type the code above and use the button instead.'}</Tx>}
          <View style={{ maxHeight: 280, marginTop: 6 }}>
            <ScrollView>
              {V.devClients.map((c, i) => (
                <Pressable key={c.clientCode || 'p:' + i + ':' + c.email} onPress={() => V.bypassLogin(c.email || c.clientCode)} accessibilityRole="button"
                  style={({ hovered }) => ({ paddingVertical: 10, paddingHorizontal: 6, borderBottomWidth: 1, borderColor: C.hairline, backgroundColor: hovered ? GOLD_TINT : 'transparent' })}>
                  <Tx w={700} s={12.5}>{c.name || c.clientCode}</Tx>
                  <Tx s={11} c={C.muted} style={{ marginTop: 2 }}>{[c.clientCode, c.email, c.schemeName].filter(Boolean).join(' · ')}</Tx>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </View>
      )}
    </Card>
  );
}

// Saved onboarding application on this device (V.hasResume is only true in the login phase).
function ResumeCard({ V }) {
  const R = V.resumeInfo;
  const done = R.status === 'submitted';
  return (
    <Card style={{ marginBottom: 26, padding: 18, borderWidth: 1, borderColor: C.gold45 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <View style={{ backgroundColor: C.gold, borderRadius: 4, paddingVertical: 3, paddingHorizontal: 8 }}>
          <Tx w={700} s={9} ls={0.14} c={C.ink}>{done ? 'SUBMITTED' : 'IN PROGRESS'}</Tx>
        </View>
        <Tx w={700} s={13} style={{ flex: 1 }}>{R.name ? 'Welcome back, ' + R.name.split(' ')[0] : 'Your application'}</Tx>
      </View>
      <Tx s={12} c={C.muted} lh={1.5} style={{ marginTop: 8 }}>{R.stepText}{R.pct ? ' · ' + R.pct + '% complete' : ''}</Tx>
      <View style={{ marginTop: 10, height: 4, borderRadius: 2, backgroundColor: 'rgba(55,88,79,0.15)' }}>
        <View style={{ width: Math.max(4, R.pct) + '%', height: 4, borderRadius: 2, backgroundColor: C.gold }} />
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14, gap: 12 }}>
        <Link label="Not you? Remove from this browser" onPress={V.resumeDiscard} c={C.muted} w={400} s={11.5} />
        <Btn label={done ? 'Track my application' : 'Continue my application'} small onPress={V.resumeGo} />
      </View>
    </Card>
  );
}

function SignIn({ V }) {
  // Forgot password is an inline sub-view: the phone's doForgot reads V.email, so it shares the email field.
  const [forgot, setForgot] = useState(false);
  const partner = V.loginAs === 'distributor';
  if (forgot) {
    return (
      <View>
        <BackLink label="Back to sign in" onPress={() => setForgot(false)} />
        <Heading title="Reset your password" sub="Enter your registered email and we’ll send you a link to set a new password." />
        <Input label="REGISTERED EMAIL" value={V.email} onChangeText={V.onEmail} placeholder={partner ? 'name@firm.com' : 'you@example.com'} keyboardType="email-address" autoFocus onSubmitEditing={V.doForgot} />
        <Msg V={V} />
        <Btn label="Send reset link" onPress={V.doForgot} busy={V.authBusy} style={{ marginTop: 22, paddingVertical: 14 }} />
      </View>
    );
  }
  return (
    <View>
      {V.hasResume && <ResumeCard V={V} />}
      <Heading title="Welcome back"
        sub={partner ? 'Sign in to your Qode partner account.' : 'Sign in to see your Qode portfolio.'} />
      <RoleSwitch V={V} />
      <Input label={partner ? 'PARTNER EMAIL' : 'EMAIL OR ACCOUNT CODE'} value={V.email} onChangeText={V.onEmail}
        placeholder={partner ? 'Enter your registered email' : 'Enter your account code or email'} autoFocus onSubmitEditing={V.doLogin} />
      <PwInput label="PASSWORD" value={V.pw} onChangeText={V.onPw} onSubmitEditing={V.doLogin} style={{ marginTop: 18 }} />
      <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 12 }}>
        <Link label="Forgot password?" onPress={() => setForgot(true)} s={12} />
      </View>
      <Msg V={V} />
      <Btn label="Sign in securely" onPress={V.doLogin} busy={V.authBusy} style={{ marginTop: 20, paddingVertical: 14 }} />
      {V.devBypass && <DevCard V={V} />}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 20 }}>
        <View style={{ flex: 1, height: 1, backgroundColor: C.hairline }} />
        <Tx w={700} s={10} ls={0.12} c={C.gray}>OR</Tx>
        <View style={{ flex: 1, height: 1, backgroundColor: C.hairline }} />
      </View>
      <Btn label="Explore a demo with sample data" kind="outline" onPress={V.startDemo} style={{ marginTop: 16 }} />
      <AppLinks center style={{ marginTop: 20 }} />
      {SHOW_ONBOARDING && (
        <Pressable onPress={V.startOb} accessibilityRole="button" style={({ hovered }) => ({ marginTop: 22, alignSelf: 'center', opacity: hovered ? 0.7 : 1 })}>
          <Tx s={13} c={C.muted} center>New to Qode? <Tx w={700} s={13} c={C.green}>Begin your journey</Tx></Tx>
        </Pressable>
      )}
    </View>
  );
}

/* ── first-time setup: OTP, then a new password ─────────────────────────────────────────────────────────── */
// The phone's OtpRow boxes at desktop size. Refs and auto-advance come from V.otpBoxes (main.js), so the
// last digit still auto-verifies; Enter verifies too.
function OtpBoxes({ V }) {
  const { z } = useUI();
  return (
    <View style={{ flexDirection: 'row', gap: 10, justifyContent: 'space-between' }}>
      {V.otpBoxes.map((o, i) => (
        <TextInput key={i} ref={o.ref} value={o.val} onChangeText={o.change} autoFocus={i === 0}
          onKeyPress={({ nativeEvent }) => { if (nativeEvent.key === 'Backspace') o.back(); }}
          onSubmitEditing={V.verifyOtp} keyboardType="number-pad" maxLength={1} accessibilityLabel={`Digit ${i + 1} of 6`}
          style={{ flex: 1, maxWidth: 60, height: 62, borderWidth: 1, borderColor: o.val ? C.green : C.mutedBorder35, borderRadius: 10,
            backgroundColor: '#fff', textAlign: 'center', fontFamily: 'Inter_600SemiBold', fontSize: 24 * z, color: C.ink, outlineStyle: 'none' }} />
      ))}
    </View>
  );
}

function Otp({ V }) {
  return (
    <View>
      <BackLink label="Back to sign in" onPress={V.backToLogin} />
      <Heading eyebrow="FIRST-TIME SETUP · ONE-TIME PASSCODE" title="Verify it’s you" sub={`We’ve sent a 6-digit code to ${V.otpEmailMask}.`} />
      <OtpBoxes V={V} />
      <Msg V={V} />
      {V.otpLocked
        ? <Btn label="Request a new code" onPress={V.resendOtp} busy={V.authBusy} style={{ marginTop: 24, paddingVertical: 14 }} />
        : (<>
          <Btn label="Verify" onPress={V.verifyOtp} busy={V.authBusy} style={{ marginTop: 24, paddingVertical: 14 }} />
          <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, marginTop: 20 }}>
            <Tx s={12.5} c={C.muted}>Didn’t get it?</Tx>
            <Link label="Resend code" onPress={V.resendOtp} />
          </View>
        </>)}
    </View>
  );
}

function SetPw({ V }) {
  return (
    <View>
      <Heading eyebrow="FIRST-TIME SETUP · NEW PASSWORD" title="Set your password" sub={`Choose a password for ${V.otpEmailMask}.`} />
      <PwInput label="PASSWORD" value={V.np} onChangeText={V.onNp} onSubmitEditing={V.savePassword} autoFocus />
      <PwInput label="CONFIRM PASSWORD" value={V.np2} onChangeText={V.onNp2} onSubmitEditing={V.savePassword} style={{ marginTop: 18 }} />
      <Tx s={11.5} c={C.muted} lh={1.5} style={{ marginTop: 12 }}>At least 8 characters, with upper and lower case letters, a number and a symbol. No spaces.</Tx>
      <Msg V={V} />
      <Btn label="Save & sign in" onPress={V.savePassword} busy={V.authBusy} style={{ marginTop: 22, paddingVertical: 14 }} />
    </View>
  );
}

/* ── lock (biometric gate / offline on start-up) ────────────────────────────────────────────────────────── */
function Lock({ V }) {
  if (V.lockOffline) {
    // Signed in, but the server couldn't be reached on start-up: the session is kept, only a retry is offered.
    return (
      <View>
        <Heading eyebrow="CONNECTION" title="We can’t reach Qode right now" sub="Check your internet connection and try again. You are still signed in." />
        <Btn label="Try again" onPress={V.lockRetry} style={{ paddingVertical: 14 }} />
      </View>
    );
  }
  return (
    <View>
      <Pressable onPress={V.lockGone ? undefined : V.lockRetry} accessibilityRole="button" accessibilityLabel="Unlock" disabled={V.lockGone}
        style={{ width: 72, height: 72, borderRadius: 36, borderWidth: 1, borderColor: C.gold45, backgroundColor: GOLD_TINT, alignItems: 'center', justifyContent: 'center', marginBottom: 24 }}>
        <FaceID s={30} c={C.green} />
      </Pressable>
      <Heading title={V.lockBusy ? 'Checking…' : V.lockGone ? 'Sign in again' : 'Unlock to continue'}
        sub={V.lockErr || `Use your ${V.lockLabel} to open your account.`} />
      {!V.lockGone && <Btn label="Unlock" onPress={V.lockRetry} busy={V.lockBusy} style={{ paddingVertical: 14 }} />}
      {V.lockGone
        ? <Btn label="Sign in with password" onPress={V.lockUsePassword} style={{ paddingVertical: 14 }} />
        : <Link label="Sign in with password instead" onPress={V.lockUsePassword} c={C.muted} style={{ alignSelf: 'center', marginTop: 18 }} />}
    </View>
  );
}

/* ── splash ─────────────────────────────────────────────────────────────────────────────────────────────── */
function DesktopSplash() {
  const { rm } = useUI();
  const thread = useRef(new Animated.Value(rm ? 1 : 0)).current;
  useEffect(() => { Animated.timing(thread, { toValue: 1, duration: rm ? 0 : 1000, useNativeDriver: false }).start(); }, []);
  return (
    <LinearGradient colors={C.darkGrad} locations={[0, 0.55, 1]} start={{ x: 0.1, y: 0 }} end={{ x: 0.7, y: 1 }} style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Threads opacity={0.8} />
      <Wordmark s={60} />
      <Animated.View style={{ height: 2, backgroundColor: C.gold, marginTop: 22, width: thread.interpolate({ inputRange: [0, 1], outputRange: [0, 64] }) }} />
      <View style={{ position: 'absolute', bottom: 48, left: 0, right: 0, alignItems: 'center' }}>
        <Tx s={11} ls={0.12} c={C.cream40}>QODE ADVISORS LLP · SEBI REGISTERED PMS</Tx>
      </View>
    </LinearGradient>
  );
}

/* ── entry ──────────────────────────────────────────────────────────────────────────────────────────────── */
export default function DesktopAuth({ V }) {
  // No carousel on desktop (boot() already goes to login there). If the phase is ever 'carousel', show the sign-in
  // form straight away and move state on with the carousel's own Skip, so login-only fields (hasResume) catch up.
  useEffect(() => { if (V.isCarousel) V.carSkip(); }, [V.isCarousel]);

  if (V.isSplash) return <DesktopSplash />;
  if (V.isOb || V.isResume) {
    // The phone onboarding flow, unchanged, in a phone-width column beside the brand panel.
    return (
      <View style={{ flex: 1, flexDirection: 'row', backgroundColor: C.cream }}>
        <BrandPanel V={V} kind="ob" />
        <View style={{ width: 520, overflow: 'hidden', backgroundColor: '#001008', boxShadow: '-20px 0 40px rgba(0,0,0,0.25)' }}>
          {V.isOb ? <Onboarding V={V} /> : <ResumeScreen V={V} />}
        </View>
      </View>
    );
  }
  let body = null;
  if (V.isLock) body = <Lock V={V} />;
  else if (V.isOtp) body = <Otp V={V} />;
  else if (V.isSetPw) body = <SetPw V={V} />;
  else if (V.isLogin || V.isCarousel) body = <SignIn V={V} />;
  if (!body) return null;
  return <Split V={V}>{body}</Split>;
}

