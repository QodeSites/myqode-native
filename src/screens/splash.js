import React, { useEffect, useRef } from 'react';
import { View, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import { C, Tx, useUI } from '../ui';

export default function Splash() {
  const { rm } = useUI();
  const thread = useRef(new Animated.Value(rm ? 1 : 0)).current;
  useEffect(() => {
    Animated.timing(thread, { toValue: 1, duration: rm ? 0 : 1000, useNativeDriver: false }).start();
  }, []);
  return (
    <View style={{ flex: 1 }}>
      <LinearGradient colors={C.darkGrad} locations={[0, 0.55, 1]} start={{ x: 0.1, y: 0 }} end={{ x: 0.6, y: 1 }} style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <View style={{ position: 'absolute', top: 120, left: 0, right: 0, height: 300, opacity: 0.6, pointerEvents: 'none' }}>
          <Svg width="100%" height="100%" viewBox="0 0 402 300" preserveAspectRatio="none">
            <Path d="M-20,80 C90,40 210,110 420,60" fill="none" stroke={C.gold} strokeWidth={1} opacity={0.08} />
            <Path d="M-20,140 C110,100 250,180 420,120" fill="none" stroke={C.gold} strokeWidth={1} opacity={0.06} />
            <Path d="M-20,205 C130,165 260,245 420,185" fill="none" stroke={C.gold} strokeWidth={1} opacity={0.05} />
          </Svg>
        </View>
        <Tx f="play" w={600} s={42} c={C.cream}>myQode</Tx>
        <Animated.View style={{
          height: 2, backgroundColor: C.gold, marginTop: 18, marginBottom: 16,
          width: thread.interpolate({ inputRange: [0, 1], outputRange: [0, 52] }),
        }} />
        <Tx w={700} s={11} ls={0.34} c={C.gold} style={{ paddingLeft: 4 }}>PRIVATE WEALTH</Tx>
        <View style={{ position: 'absolute', bottom: 64, left: 0, right: 0, alignItems: 'center' }}>
          <Tx s={10} ls={0.1} c={C.cream40}>QODE ADVISORS LLP · SEBI REGISTERED PMS</Tx>
        </View>
      </LinearGradient>
    </View>
  );
}
