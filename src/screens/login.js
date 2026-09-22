import React from 'react';
import { View, Pressable, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import { C, Tx, Card, CTA, CurveCap, Field, OtpRow, Rise } from '../ui';

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

export function Login({ V }) {
  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: C.cream }}>
      <DarkHead>
        <Tx f="play" w={600} s={32} c={C.cream}>myQode</Tx>
        <View style={{ width: 44, height: 2, backgroundColor: C.gold, marginTop: 12, marginBottom: 10 }} />
      </DarkHead>
      <ScrollView style={{ flex: 1, marginTop: -46 }} contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
        <CurveCap height={46} />
        <View style={{ backgroundColor: C.cream, flexGrow: 1, paddingHorizontal: 24, paddingBottom: 30 }}>
          <Rise>
            <Card big style={{ marginTop: -30, paddingVertical: 24, paddingHorizontal: 22 }}>
              <Tx w={700} s={11} ls={0.14} c={C.muted}>WELCOME BACK</Tx>
              <Field label="EMAIL OR CLIENT CODE" value={V.email} onChangeText={V.onEmail} placeholder="you@example.com" autoCapitalize="none" style={{ marginTop: 18 }} />
              <Field label="PASSWORD" value={V.pw} onChangeText={V.onPw} placeholder="••••••••" secure style={{ marginTop: 16 }} />
              <Msg V={V} />
              <CTA label={V.authBusy ? 'PLEASE WAIT…' : 'SIGN IN SECURELY'} onPress={V.doLogin} style={{ marginTop: 22, opacity: V.authBusy ? 0.6 : 1 }} />
            </Card>
          </Rise>
          <Pressable onPress={V.doForgot} style={{ marginTop: 18 }}>
            <Tx s={12} c={C.muted} center>Forgot password</Tx>
          </Pressable>
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
                  <Tx s={11} c={C.muted} lh={1.5}>Uses the email or client code typed above. The myQode server must be running in development (NODE_ENV=development).</Tx>
                  <CTA label={V.authBusy ? 'PLEASE WAIT…' : 'SIGN IN AS THIS USER (NO PASSWORD)'} onPress={() => V.bypassLogin()} outline style={{ marginTop: 12, opacity: V.authBusy ? 0.6 : 1 }} />
                  <Field label="FIND A CLIENT" value={V.devQ} onChangeText={V.onDevQ} placeholder="name, email or code" autoCapitalize="none" style={{ marginTop: 14 }} />
                  <Tx s={10} c={C.gray} style={{ marginTop: 6 }}>Server: {V.apiBase}</Tx>
                  {!V.devLoaded && <Tx s={11} c={C.muted} style={{ marginTop: 8 }}>Loading clients…</Tx>}
                  {!!V.devErr && (
                    <Pressable onPress={V.reloadDev} style={{ marginTop: 8 }}>
                      <Tx s={11} c={C.red} lh={1.45}>{V.devErr}</Tx>
                      <Tx w={700} s={11} c={C.green} style={{ marginTop: 4 }}>Tap to retry</Tx>
                    </Pressable>
                  )}
                  {V.devLoaded && !V.devErr && V.devClients.length === 0 && <Tx s={11} c={C.muted} style={{ marginTop: 8 }}>No Discretionary client matches that search. Non-Discretionary accounts aren’t listed — type the code above and use the button instead.</Tx>}
                  {V.devClients.map(c => (
                    <Pressable key={c.clientCode} onPress={() => V.bypassLogin(c.email || c.clientCode)} style={{ paddingVertical: 10, borderBottomWidth: 1, borderColor: C.hairline }}>
                      <Tx w={700} s={12}>{c.name || c.clientCode}</Tx>
                      <Tx s={10.5} c={C.muted} style={{ marginTop: 2 }}>{[c.clientCode, c.email, c.schemeName].filter(Boolean).join(' · ')}</Tx>
                    </Pressable>
                  ))}
                </View>
              )}
            </Card>
          )}
          <Pressable onPress={V.startDemo} style={{ marginTop: 14 }}>
            <Tx w={700} s={12} c={C.green} center>Explore a demo with sample data</Tx>
          </Pressable>
          <Pressable onPress={V.startOb} style={{ marginTop: 14 }}>
            <Tx s={12} c={C.muted} center>New to Qode? <Tx w={700} s={12} c={C.green}>Begin your journey</Tx></Tx>
          </Pressable>
          <Tx s={10} ls={0.08} c={C.gray} center style={{ marginTop: 26 }}>PROTECTED BY 256-BIT ENCRYPTION</Tx>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

export function OtpScreen({ V }) {
  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: C.cream }}>
      <DarkHead pct={0.36}>
        <Tx f="play" w={600} s={26} c={C.cream}>Verify it's you</Tx>
        <View style={{ width: 44, height: 2, backgroundColor: C.gold, marginTop: 12, marginBottom: 10 }} />
        <Tx s={12} c={C.cream65}>Code sent to {V.otpEmailMask}</Tx>
      </DarkHead>
      <ScrollView style={{ flex: 1, marginTop: -46 }} contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
        <CurveCap height={46} />
        <View style={{ backgroundColor: C.cream, flexGrow: 1, paddingHorizontal: 24, paddingBottom: 30 }}>
          <Rise>
            <Card big style={{ marginTop: -30, paddingVertical: 24, paddingHorizontal: 22 }}>
              <Tx w={700} s={11} ls={0.14} c={C.muted}>FIRST-TIME SETUP · ONE-TIME PASSCODE</Tx>
              <View style={{ marginTop: 16 }}>
                <OtpRow boxes={V.otpBoxes} />
              </View>
              <Msg V={V} />
              <CTA label={V.authBusy ? 'PLEASE WAIT…' : 'VERIFY'} onPress={V.verifyOtp} style={{ marginTop: 18, opacity: V.authBusy ? 0.6 : 1 }} />
              <Pressable onPress={V.resendOtp} style={{ marginTop: 14, minHeight: 32, justifyContent: 'center' }}>
                <Tx w={700} s={12} c={C.green} center>Resend code</Tx>
              </Pressable>
            </Card>
          </Rise>
          <Pressable onPress={V.backToLogin} style={{ marginTop: 18 }}>
            <Tx s={12} c={C.muted} center>Back to sign in</Tx>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

export function SetPassword({ V }) {
  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: C.cream }}>
      <DarkHead pct={0.36}>
        <Tx f="play" w={600} s={26} c={C.cream}>Set your password</Tx>
        <View style={{ width: 44, height: 2, backgroundColor: C.gold, marginTop: 12, marginBottom: 10 }} />
        <Tx s={12} c={C.cream65}>Choose a password for {V.otpEmailMask}</Tx>
      </DarkHead>
      <ScrollView style={{ flex: 1, marginTop: -46 }} contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
        <CurveCap height={46} />
        <View style={{ backgroundColor: C.cream, flexGrow: 1, paddingHorizontal: 24, paddingBottom: 30 }}>
          <Rise>
            <Card big style={{ marginTop: -30, paddingVertical: 24, paddingHorizontal: 22 }}>
              <Tx w={700} s={11} ls={0.14} c={C.muted}>NEW PASSWORD</Tx>
              <Field label="PASSWORD" value={V.np} onChangeText={V.onNp} placeholder="••••••••" secure style={{ marginTop: 14 }} />
              <Field label="CONFIRM PASSWORD" value={V.np2} onChangeText={V.onNp2} placeholder="••••••••" secure style={{ marginTop: 16 }} />
              <Tx s={11} c={C.gray} lh={1.5} style={{ marginTop: 12 }}>At least 8 characters, with upper and lower case letters, a number and a symbol.</Tx>
              <Msg V={V} />
              <CTA label={V.authBusy ? 'PLEASE WAIT…' : 'SAVE & SIGN IN'} onPress={V.savePassword} style={{ marginTop: 20, opacity: V.authBusy ? 0.6 : 1 }} />
            </Card>
          </Rise>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
