import React from 'react';
import { View, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { C, Tx, Amt, Fade, CTA } from '../ui';
import { ChevronLeft, ChevronRight, CarGrid, CarEye, CarDoc, Download } from '../icons';

function Rings({ children }) {
  return (
    <View style={{ width: 96, height: 96, borderRadius: 48, borderWidth: 1, borderColor: C.gold30, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ width: 72, height: 72, borderRadius: 36, borderWidth: 1, borderColor: C.gold, alignItems: 'center', justifyContent: 'center' }}>
        {children}
      </View>
    </View>
  );
}

function Slide({ icon, title, body, children }) {
  return (
    <Fade style={{ alignItems: 'center' }}>
      <Rings>{icon}</Rings>
      <Tx f="play" w={600} s={26} c={C.cream} center style={{ marginTop: 26 }}>{title}</Tx>
      <Tx s={13.5} c={C.cream65} lh={1.6} center style={{ marginTop: 12, maxWidth: 300 }}>{body}</Tx>
      {children}
    </Fade>
  );
}

export default function Carousel({ V }) {
  const insets = useSafeAreaInsets();
  const i = V.carIdx;
  return (
    <LinearGradient colors={C.darkGrad} locations={[0, 0.55, 1]} start={{ x: 0.1, y: 0 }} end={{ x: 0.6, y: 1 }} style={{ flex: 1 }}>
      <View style={{ alignItems: 'flex-end', paddingTop: insets.top + 8, paddingHorizontal: 22 }}>
        <Pressable onPress={V.carSkip} style={{ padding: 12 }}>
          <Tx w={700} s={11} ls={0.12} c={C.cream60}>SKIP</Tx>
        </Pressable>
      </View>

      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 36 }}>
        {i === 0 && (
          <Slide key={0} icon={<CarGrid />} title="Your money, at a glance" body="Portfolio value, returns, drawdown and trailing performance the moment you sign in.">
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 28 }}>
              <View style={{ width: 110, backgroundColor: C.card, borderRadius: 8, padding: 11 }}>
                <Tx w={700} s={7.5} ls={0.12} c={C.muted}>TOTAL RETURNS</Tx>
                <Amt s={13} c={C.green} noHide style={{ marginTop: 5 }}>+₹64,52,300</Amt>
              </View>
              <View style={{ width: 110, backgroundColor: C.card, borderRadius: 8, padding: 11 }}>
                <Tx w={700} s={7.5} ls={0.12} c={C.muted}>XIRR (SI)</Tx>
                <Amt s={13} c={C.green} noHide style={{ marginTop: 5 }}>+24.3%</Amt>
              </View>
            </View>
          </Slide>
        )}
        {i === 1 && (
          <Slide key={1} icon={<CarEye />} title="Private by design" body="Face ID sign-in, and a privacy eye that hides every amount with one tap.">
            <View style={{ marginTop: 28, width: 210, backgroundColor: C.card, borderRadius: 8, padding: 13, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Tx w={700} s={7.5} ls={0.12} c={C.muted}>PORTFOLIO VALUE</Tx>
                <Amt s={14} c={C.ink} noHide style={{
                  marginTop: 5, color: 'transparent', textShadowColor: C.ink,
                  textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 6,
                }}>₹1,84,52,300</Amt>
              </View>
              <CarEye s={18} />
            </View>
          </Slide>
        )}
        {i === 2 && (
          <Slide key={2} icon={<CarDoc />} title="Documents, one tap away" body="Statements, capital gains and agreements — downloaded instantly, ready for tax season.">
            <View style={{ marginTop: 28, width: 230, backgroundColor: C.card, borderRadius: 8, paddingVertical: 13, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Tx w={700} s={7.5} ls={0.12} c={C.muted}>CAPITAL GAINS STATEMENT</Tx>
                <Tx s={11} c={C.ink} style={{ marginTop: 5 }}>FY 2025-26 · PDF</Tx>
              </View>
              <Download s={16} c={C.green} />
            </View>
          </Slide>
        )}
      </View>

      <View style={{ paddingHorizontal: 28, paddingBottom: Math.max(insets.bottom, 20) + 34 }}>
        <View style={{ height: 2, backgroundColor: C.gold25, borderRadius: 1, overflow: 'hidden' }}>
          <View style={{ height: '100%', backgroundColor: C.gold, width: `${V.carProg * 100}%` }} />
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 20, minHeight: 48 }}>
          {V.carHasPrev && (
            <Pressable onPress={V.carPrev} style={{ width: 48, height: 48, borderRadius: 24, borderWidth: 1, borderColor: 'rgba(239,236,211,0.3)', alignItems: 'center', justifyContent: 'center' }}>
              <ChevronLeft s={18} c={C.cream} w={1.7} />
            </Pressable>
          )}
          <View style={{ flex: 1 }} />
          {!V.carLast && (
            <Pressable onPress={V.carNext} style={({ pressed }) => ({
              width: 48, height: 48, borderRadius: 24, backgroundColor: C.green, borderWidth: 1, borderColor: C.gold,
              alignItems: 'center', justifyContent: 'center', transform: [{ scale: pressed ? 0.96 : 1 }],
            })}>
              <ChevronRight s={18} c={C.gold} w={1.7} />
            </Pressable>
          )}
          {V.carLast && (
            <CTA label="EXPLORE THE NEW MYQODE" onPress={V.carDone} style={{ flex: 1, borderWidth: 1, borderColor: C.gold }} />
          )}
        </View>
      </View>
    </LinearGradient>
  );
}
