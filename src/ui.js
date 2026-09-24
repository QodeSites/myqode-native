// Shared design system: colors, typography, and primitives ported from the
// myQode Curtain design. Text scaling / high contrast / reduced motion
// all flow through UICtx.
import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import {
  View, Text, TextInput, Pressable, Animated, Easing, Modal,
  ScrollView, Dimensions, Keyboard, Platform,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';

export const C = {
  ink: '#002017',
  green: '#02422B',
  gold: '#DABD38',
  cream: '#EFECD3',
  card: '#F7F5E9',
  muted: '#37584F',
  gray: '#9CA3AF',
  red: '#EF4444',
  pos: '#16A34A',   // positive figures — the web's green-600; C.green is the dark brand green and reads as black on numbers
  cream40: 'rgba(239,236,211,0.4)',
  cream55: 'rgba(239,236,211,0.55)',
  cream60: 'rgba(239,236,211,0.6)',
  cream65: 'rgba(239,236,211,0.65)',
  cream80: 'rgba(239,236,211,0.8)',
  gold25: 'rgba(218,189,56,0.25)',
  gold30: 'rgba(218,189,56,0.3)',
  gold35: 'rgba(218,189,56,0.35)',
  gold45: 'rgba(218,189,56,0.45)',
  mutedBorder: 'rgba(55,88,79,0.3)',
  mutedBorder35: 'rgba(55,88,79,0.35)',
  hairline: 'rgba(55,88,79,0.12)',
  greenBorder: 'rgba(2,66,43,0.3)',
  darkGrad: ['#02422B', '#002017', '#000000'],
};

export const UICtx = createContext({ z: 1, hc: false, rm: false });
export const useUI = () => useContext(UICtx);

const FAM = {
  lato: { 400: 'Lato_400Regular', 700: 'Lato_700Bold', 900: 'Lato_900Black' },
  inter: { 400: 'Inter_400Regular', 600: 'Inter_600SemiBold', 700: 'Inter_700Bold' },
  play: { 500: 'PlayfairDisplay_500Medium', 600: 'PlayfairDisplay_600SemiBold', 700: 'PlayfairDisplay_700Bold' },
};

// High-contrast: deepen the two muted tones used for secondary text.
const HC_MAP = { '#37584F': '#22423A', '#9CA3AF': '#6B7280' };

export function Tx({ f = 'lato', w = 400, s = 13, c = C.ink, ls = 0, lh, center, right, style, children, ...rest }) {
  const { z, hc } = useUI();
  const size = s * z;
  return (
    <Text
      {...rest}
      style={[{
        fontFamily: FAM[f][w],
        fontSize: size,
        color: hc && HC_MAP[c] ? HC_MAP[c] : c,
        letterSpacing: ls ? ls * size : undefined,
        lineHeight: lh ? lh * size : undefined,
        textAlign: center ? 'center' : right ? 'right' : undefined,
      }, style]}
    >{children}</Text>
  );
}

// Tabular-numeral amount.
export function Amt({ w = 600, s = 13, c = C.ink, center, style, children, ...rest }) {
  const { z } = useUI();
  return (
    <Text {...rest} style={[{
      fontFamily: FAM.inter[w], fontSize: s * z, color: c,
      fontVariant: ['tabular-nums'], textAlign: center ? 'center' : undefined,
    }, style]}>{children}</Text>
  );
}

export function Card({ style, children, big }) {
  return (
    <View style={[{
      backgroundColor: C.card, borderRadius: 8,
      shadowColor: C.ink, shadowOpacity: big ? 0.2 : 0.08, shadowRadius: big ? 15 : 3,
      shadowOffset: { width: 0, height: big ? 10 : 1 }, elevation: big ? 6 : 1,
    }, style]}>{children}</View>
  );
}

export function CTA({ label, onPress, outline, style, ls = 0.08 }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [{
        borderRadius: 8, paddingVertical: 15, alignItems: 'center',
        backgroundColor: outline ? 'transparent' : C.green,
        borderWidth: outline ? 1 : 0, borderColor: 'rgba(2,66,43,0.35)',
        transform: [{ scale: pressed ? 0.98 : 1 }],
      }, style]}
    >
      <Tx w={700} s={13} ls={ls} c={outline ? C.green : C.gold} center>{label}</Tx>
    </Pressable>
  );
}

export function Chip({ label, active, onPress, flex, py = 8, px = 14, s = 11, round = true }) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        flex: flex ? 1 : undefined, alignItems: 'center', justifyContent: 'center',
        paddingVertical: py, paddingHorizontal: flex ? 0 : px,
        borderRadius: round ? 999 : 8, borderWidth: 1,
        borderColor: active ? C.green : C.mutedBorder35,
        backgroundColor: active ? C.green : 'transparent',
      }}
    >
      <Tx w={700} s={s} c={active ? C.cream : C.muted}>{label}</Tx>
    </Pressable>
  );
}

export function ChipRow({ chips, flex, gap = 8, py, s, round, style }) {
  return (
    <View style={[{ flexDirection: 'row', flexWrap: flex ? 'nowrap' : 'wrap', gap }, style]}>
      {chips.map((ch, i) => (
        <Chip key={i} label={ch.label} active={ch.active} onPress={ch.pick} flex={flex} py={py} s={s} round={round} />
      ))}
    </View>
  );
}

export function Radio({ active, size = 18 }) {
  return (
    <View style={{
      width: size, height: size, borderRadius: size / 2, borderWidth: 2,
      borderColor: active ? C.green : 'rgba(55,88,79,0.4)',
      alignItems: 'center', justifyContent: 'center',
    }}>
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: C.green, opacity: active ? 1 : 0 }} />
    </View>
  );
}

export function Toggle({ on, onPress }) {
  const v = useRef(new Animated.Value(on ? 1 : 0)).current;
  useEffect(() => {
    Animated.timing(v, { toValue: on ? 1 : 0, duration: 200, useNativeDriver: false }).start();
  }, [on]);
  return (
    <Pressable onPress={onPress} hitSlop={8}>
      <Animated.View style={{
        width: 46, height: 26, borderRadius: 999, padding: 3,
        backgroundColor: v.interpolate({ inputRange: [0, 1], outputRange: [C.mutedBorder, C.green] }),
      }}>
        <Animated.View style={{
          width: 20, height: 20, borderRadius: 10, backgroundColor: C.cream,
          shadowColor: C.ink, shadowOpacity: 0.3, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 2,
          transform: [{ translateX: v.interpolate({ inputRange: [0, 1], outputRange: [0, 20] }) }],
        }} />
      </Animated.View>
    </Pressable>
  );
}

// Underline text field with tiny uppercase label (the design's input style).
export function Field({ label, value, onChangeText, placeholder, secure, numeric, s = 15, style, prefix, autoFocus, autoCapitalize, multiline, keyboardType }) {
  const { z } = useUI();
  return (
    <View style={style}>
      {label ? <Tx w={700} s={10} ls={0.12} c={C.gray}>{label}</Tx> : null}
      <View style={{ flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderColor: C.mutedBorder }}>
        {prefix ? <Tx s={15} c={C.muted} style={{ marginRight: 8 }}>{prefix}</Tx> : null}
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={C.gray}
          secureTextEntry={secure}
          keyboardType={keyboardType || (numeric ? 'number-pad' : 'default')}
          multiline={multiline}
          autoFocus={autoFocus}
          autoCapitalize={autoCapitalize}
          autoCorrect={false}
          style={{
            flex: 1, fontFamily: 'Lato_400Regular', fontSize: s * z, color: C.ink,
            paddingVertical: 8, paddingHorizontal: 0, minWidth: 0,
            ...(multiline ? { minHeight: 84, textAlignVertical: 'top' } : null),
          }}
        />
      </View>
    </View>
  );
}

// Six OTP boxes with auto-advance / backspace-retreat.
export function OtpRow({ boxes }) {
  const { z } = useUI();
  return (
    <View style={{ flexDirection: 'row', gap: 9, justifyContent: 'space-between' }}>
      {boxes.map((o, i) => (
        <TextInput
          key={i}
          ref={o.ref}
          value={o.val}
          onChangeText={o.change}
          onKeyPress={({ nativeEvent }) => { if (nativeEvent.key === 'Backspace') o.back(); }}
          keyboardType="number-pad"
          maxLength={1}
          style={{
            flex: 1, maxWidth: 48, height: 52, borderWidth: 1, borderColor: C.mutedBorder35,
            borderRadius: 8, textAlign: 'center', fontFamily: 'Inter_600SemiBold',
            fontSize: 20 * z, color: C.ink, backgroundColor: 'transparent',
          }}
        />
      ))}
    </View>
  );
}

// ── Curved cream cap (the "curtain" edge) ────────────────────────────────
// Replaces the design's elliptical border-radius. Optional progress arc for
// onboarding (track + gold fill by fraction 0..1).
const ARC = 'M0,44 C110,4 292,4 402,44';
const ARC_LEN = 410;

export function CurveCap({ color = C.cream, stroke = C.gold, height = 44, progress }) {
  return (
    <View style={{ height, marginBottom: -1 }}>
      <Svg width="100%" height="100%" viewBox="0 0 402 44" preserveAspectRatio="none">
        <Path d={`${ARC} L402,44 L402,45 L0,45 Z`} fill={color} />
        <Path d={ARC} fill="none" stroke={progress !== undefined ? 'rgba(218,189,56,0.28)' : stroke} strokeWidth={2} />
        {progress !== undefined && (
          <Path d={ARC} fill="none" stroke={C.gold} strokeWidth={2}
            strokeDasharray={ARC_LEN} strokeDashoffset={(1 - progress) * ARC_LEN} />
        )}
      </Svg>
    </View>
  );
}

// Decorative gold thread curves over dark headers.
export function GoldThreads({ height = 260, top = 0 }) {
  return (
    <View style={{ position: 'absolute', left: 0, right: 0, top, height, pointerEvents: 'none' }}>
      <Svg width="100%" height="100%" viewBox="0 0 402 260" preserveAspectRatio="none">
        <Path d="M-20,120 C90,80 210,150 420,100" fill="none" stroke={C.gold} strokeWidth={1} opacity={0.07} />
        <Path d="M-20,190 C110,150 250,230 420,170" fill="none" stroke={C.gold} strokeWidth={1} opacity={0.05} />
        <Path d="M-20,250 C130,210 260,280 420,230" fill="none" stroke={C.gold} strokeWidth={1} opacity={0.04} />
      </Svg>
    </View>
  );
}

// ── Entrance animations ──────────────────────────────────────────────────
export function Rise({ children, style, dy = 28, duration = 300, delay = 0 }) {
  const { rm } = useUI();
  const v = useRef(new Animated.Value(rm ? 1 : 0)).current;
  useEffect(() => {
    Animated.timing(v, { toValue: 1, duration: rm ? 0 : duration, delay, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
  }, []);
  return (
    <Animated.View style={[style, {
      opacity: v,
      transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [dy, 0] }) }],
    }]}>{children}</Animated.View>
  );
}

export function Fade({ children, style, duration = 300 }) {
  const { rm } = useUI();
  const v = useRef(new Animated.Value(rm ? 1 : 0)).current;
  useEffect(() => {
    Animated.timing(v, { toValue: 1, duration: rm ? 0 : duration, useNativeDriver: true }).start();
  }, []);
  return <Animated.View style={[style, { opacity: v }]}>{children}</Animated.View>;
}

// Pulsing skeleton block (stands in for the shimmer gradient).
export function Skel({ h, style }) {
  const v = useRef(new Animated.Value(0.6)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(v, { toValue: 1, duration: 700, useNativeDriver: true }),
      Animated.timing(v, { toValue: 0.6, duration: 700, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, []);
  return <Animated.View style={[{ height: h, borderRadius: 8, backgroundColor: C.card, opacity: v }, style]} />;
}

export function Hairline({ style }) {
  return <View style={[{ height: 1, backgroundColor: C.hairline }, style]} />;
}

// ── Bottom sheet (native Modal) ──────────────────────────────────────────
export function Sheet({ visible, onClose, children, maxH = 0.86 }) {
  const { rm } = useUI();
  const H = Dimensions.get('window').height;
  const y = useRef(new Animated.Value(H)).current;
  const fade = useRef(new Animated.Value(0)).current;
  // Keyboard height: inside a Modal the window is not resized for the keyboard (Android especially), so the
  // sheet is lifted by hand and its max height reduced so the field being typed into stays visible.
  const [kb, setKb] = useState(0);
  useEffect(() => {
    const showEv = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEv = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const a = Keyboard.addListener(showEv, e => setKb(e.endCoordinates ? e.endCoordinates.height : 0));
    const b = Keyboard.addListener(hideEv, () => setKb(0));
    return () => { a.remove(); b.remove(); };
  }, []);
  useEffect(() => {
    if (visible) {
      y.setValue(H); fade.setValue(0);
      Animated.parallel([
        Animated.timing(y, { toValue: 0, duration: rm ? 0 : 300, easing: Easing.bezier(0.32, 0.72, 0.25, 1), useNativeDriver: true }),
        Animated.timing(fade, { toValue: 1, duration: rm ? 0 : 200, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);
  if (!visible) return null;
  return (
    <Modal transparent visible onRequestClose={onClose} statusBarTranslucent>
      <View style={{ flex: 1 }}>
        <Animated.View style={[{ flex: 1, backgroundColor: 'rgba(0,32,23,0.55)', opacity: fade }]}>
          <Pressable style={{ flex: 1 }} onPress={() => { Keyboard.dismiss(); onClose(); }} />
        </Animated.View>
        <Animated.View style={{
          position: 'absolute', left: 0, right: 0, bottom: kb,
          backgroundColor: C.card, borderTopLeftRadius: 16, borderTopRightRadius: 16,
          maxHeight: Math.max(220, H * maxH - kb), transform: [{ translateY: y }],
          shadowColor: C.ink, shadowOpacity: 0.3, shadowRadius: 16, shadowOffset: { width: 0, height: -8 }, elevation: 16,
        }}>
          <View style={{ alignItems: 'center', paddingTop: 10, paddingBottom: 2 }}>
            <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: C.mutedBorder }} />
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentContainerStyle={{ paddingBottom: 24 }}>
            {children}
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}
