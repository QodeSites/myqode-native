import React from 'react';
import { View, Pressable, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import { C, Tx, Card, CTA, CurveCap, Field, OtpRow, Rise } from '../ui';
import { FaceID } from '../icons';

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
              <Field label="EMAIL" value={V.email} onChangeText={V.onEmail} placeholder="rohan@mehta.com" style={{ marginTop: 18 }} />
              <Field label="PASSWORD" value={V.pw} onChangeText={V.onPw} placeholder="••••••••" secure style={{ marginTop: 16 }} />
              <CTA label="SIGN IN SECURELY" onPress={V.doLogin} style={{ marginTop: 24 }} />
              <Pressable onPress={V.doLogin} style={{ marginTop: 14, minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <FaceID />
                <Tx w={700} s={13} c={C.green}>Use Face ID</Tx>
              </Pressable>
            </Card>
          </Rise>
          <Pressable style={{ marginTop: 18 }}>
            <Tx s={12} c={C.muted} center>Forgot password</Tx>
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
        <Tx s={12} c={C.cream65}>Code sent to r•••n@mehta.com</Tx>
      </DarkHead>
      <ScrollView style={{ flex: 1, marginTop: -46 }} contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
        <CurveCap height={46} />
        <View style={{ backgroundColor: C.cream, flexGrow: 1, paddingHorizontal: 24, paddingBottom: 30 }}>
          <Rise>
            <Card big style={{ marginTop: -30, paddingVertical: 24, paddingHorizontal: 22 }}>
              <Tx w={700} s={11} ls={0.14} c={C.muted}>ONE-TIME PASSCODE</Tx>
              <View style={{ marginTop: 16 }}>
                <OtpRow boxes={V.otpBoxes} />
              </View>
              <Tx s={12} c={C.gray} center style={{ marginTop: 16 }}>Resend code in 00:24</Tx>
              <CTA label="VERIFY" onPress={V.startApp} style={{ marginTop: 18 }} />
            </Card>
          </Rise>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
