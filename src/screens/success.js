// Full-screen payment/withdrawal success overlay with drawn-in check ring.
import React, { useEffect, useRef } from 'react';
import { View, Animated, Easing, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Path } from 'react-native-svg';
import { C, Tx, Amt, Card, CTA, CurveCap, Rise, useUI } from '../ui';

const ACircle = Animated.createAnimatedComponent(Circle);
const APath = Animated.createAnimatedComponent(Path);
const RING = 2 * Math.PI * 40;
const TICK = 41;

function DrawnCheck() {
  const { rm } = useUI();
  const ring = useRef(new Animated.Value(rm ? 0 : RING)).current;
  const tick = useRef(new Animated.Value(rm ? 0 : TICK)).current;
  useEffect(() => {
    if (rm) return;
    Animated.sequence([
      Animated.timing(ring, { toValue: 0, duration: 700, easing: Easing.out(Easing.quad), useNativeDriver: false }),
      Animated.timing(tick, { toValue: 0, duration: 450, easing: Easing.out(Easing.quad), useNativeDriver: false }),
    ]).start();
  }, []);
  return (
    <Svg width={88} height={88} viewBox="0 0 88 88">
      <Circle cx={44} cy={44} r={40} fill="none" stroke={C.gold25} strokeWidth={2} />
      <ACircle cx={44} cy={44} r={40} fill="none" stroke={C.gold} strokeWidth={2}
        strokeDasharray={RING} strokeDashoffset={ring} transform="rotate(-90 44 44)" />
      <APath d="M28 45.5l11 11L61 33" fill="none" stroke={C.gold} strokeWidth={2.5}
        strokeLinecap="round" strokeLinejoin="round" strokeDasharray={TICK} strokeDashoffset={tick} />
    </Svg>
  );
}

export default function Success({ V }) {
  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: C.cream }]}>
      <LinearGradient colors={C.darkGrad} locations={[0, 0.6, 1]} start={{ x: 0.1, y: 0 }} end={{ x: 0.6, y: 1 }}
        style={{ height: '44%', alignItems: 'center', justifyContent: 'center' }}>
        <DrawnCheck />
        <Tx f="play" w={600} s={22} c={C.cream} style={{ marginTop: 18 }}>{V.successTitle}</Tx>
        <Amt s={30} c={C.gold} noHide style={{ marginTop: 8 }}>{V.successAmt}</Amt>
      </LinearGradient>
      <View style={{ flex: 1, marginTop: -46 }}>
        <CurveCap height={46} />
        <View style={{ backgroundColor: C.cream, flex: 1, paddingHorizontal: 24 }}>
          <Rise delay={200}>
            <Card big style={{ marginTop: -26, paddingVertical: 6, paddingHorizontal: 18 }}>
              {[
                ['Reference no.', 'QD-2026-071412', true],
                ['Account', V.successAcct],
                ['Method', V.successMethod],
                ['Date', '14 Jul 2026, 6:04 PM'],
              ].map(([k, v, mono], i) => (
                <View key={k} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 11, borderBottomWidth: i < 3 ? 1 : 0, borderColor: C.hairline }}>
                  <Tx s={12} c={C.muted}>{k}</Tx>
                  {mono ? <Amt s={12} noHide>{v}</Amt> : <Tx w={700} s={12}>{v}</Tx>}
                </View>
              ))}
            </Card>
          </Rise>
          <Tx s={11.5} c={C.muted} lh={1.5} center style={{ marginTop: 16 }}>{V.successNote}</Tx>
          <CTA label="BACK TO DASHBOARD" onPress={V.doneSuccess} style={{ marginTop: 20 }} />
        </View>
      </View>
    </View>
  );
}
