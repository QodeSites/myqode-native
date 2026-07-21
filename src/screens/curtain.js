// Full-screen curtain that lifts away to reveal the app (design's liftUp).
import React, { useEffect, useRef } from 'react';
import { Animated, Dimensions, Easing, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import { C, Tx } from '../ui';

export default function Curtain({ onDone, rm }) {
  const H = Dimensions.get('window').height;
  const y = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(y, {
      toValue: -(H + 60), duration: rm ? 0 : 700, delay: rm ? 0 : 150,
      easing: Easing.bezier(0.45, 0, 0.2, 1), useNativeDriver: true,
    }).start(({ finished }) => { if (finished) onDone(); });
  }, []);
  return (
    <Animated.View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: H + 50, pointerEvents: 'none', transform: [{ translateY: y }] }}>
      <LinearGradient colors={C.darkGrad} locations={[0, 0.55, 1]} start={{ x: 0.1, y: 0 }} end={{ x: 0.6, y: 1 }}
        style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Tx f="play" w={600} s={32} c={C.cream}>myQode</Tx>
        <View style={{ width: 44, height: 2, backgroundColor: C.gold, marginTop: 12 }} />
      </LinearGradient>
      {/* curved bottom edge with gold trim */}
      <View style={{ height: 46, marginTop: -1 }}>
        <Svg width="100%" height="100%" viewBox="0 0 402 46" preserveAspectRatio="none">
          <Path d="M0,0 L402,0 L402,2 C292,42 110,42 0,2 Z" fill="#000" />
          <Path d="M0,2 C110,42 292,42 402,2" fill="none" stroke={C.gold} strokeWidth={2} />
        </Svg>
      </View>
    </Animated.View>
  );
}
