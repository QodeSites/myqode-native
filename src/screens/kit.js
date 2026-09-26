// Small shared pieces for the data-driven screens (documents, services, pages).
import React, { useState, useEffect, useCallback } from 'react';
import { View, Pressable, Linking, Alert } from 'react-native';
import { C, Tx, Card, Skel, CTA } from '../ui';
import { ChevronRight } from '../icons';
import { isDemo } from '../api';

export function useLoad(fn, deps = []) {
  const [st, set] = useState({ loading: true, data: null, err: '' });
  const [tick, setTick] = useState(0);
  const run = useCallback(fn, deps);
  useEffect(() => {
    let dead = false;
    set(s => ({ ...s, loading: true, err: '' }));
    Promise.resolve().then(run)
      .then(d => { if (!dead) set({ loading: false, data: d, err: '' }); })
      .catch(e => { if (!dead) set({ loading: false, data: null, err: (e && e.message) || 'Something went wrong.' }); });
    return () => { dead = true; };
  }, [run, tick]);
  return { ...st, reload: () => setTick(t => t + 1) };
}

export function openUrl(url) {
  if (!url) {
    Alert.alert(isDemo() ? 'Sample document' : 'Unavailable', isDemo() ? 'Sign in with a real account to open your documents.' : 'This file has no link right now. Please try again.');
    return;
  }
  Linking.openURL(url).catch(() => Alert.alert('Unable to open', 'No app on this device can open that file.'));
}

export const fmtSize = b => (!b ? '' : b > 1e6 ? (b / 1e6).toFixed(1) + ' MB' : Math.max(1, Math.round(b / 1e3)) + ' KB');

export function Loading({ rows = 3, h = 64 }) {
  return (
    <View style={{ gap: 12, marginTop: 4 }}>
      {Array.from({ length: rows }).map((_, i) => <Skel key={i} h={h} />)}
    </View>
  );
}

export function ErrorBox({ msg, onRetry }) {
  return (
    <Card style={{ padding: 18, alignItems: 'center' }}>
      <Tx w={700} s={13} center>We couldn’t load this</Tx>
      <Tx s={12} c={C.muted} center lh={1.5} style={{ marginTop: 6 }}>{/server error|\(5\d\d\)/i.test(msg || '') ? 'This is unavailable right now. Please try again later.' : msg}</Tx>
      {onRetry && <CTA label="TRY AGAIN" onPress={onRetry} style={{ marginTop: 14, alignSelf: 'stretch' }} />}
    </Card>
  );
}

export function Empty({ children }) {
  return (
    <Card style={{ padding: 22 }}>
      <Tx s={12.5} c={C.muted} lh={1.6} center>{children}</Tx>
    </Card>
  );
}

export const SectionLabel = ({ children, style }) => (
  <Tx w={700} s={11} ls={0.12} c={C.muted} style={[{ marginTop: 22, marginBottom: 10, marginLeft: 2 }, style]}>{children}</Tx>
);

export function LinkRow({ title, sub, right, onPress, last, icon }) {
  return (
    <Pressable onPress={onPress} style={{
      flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13, paddingHorizontal: 16, minHeight: 48,
      borderBottomWidth: last ? 0 : 1, borderColor: C.hairline,
    }}>
      {icon}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Tx w={700} s={13}>{title}</Tx>
        {!!sub && <Tx s={11} c={C.muted} lh={1.4} style={{ marginTop: 2 }}>{sub}</Tx>}
      </View>
      {right !== undefined ? right : <ChevronRight />}
    </Pressable>
  );
}

// Account picker used by forms and the documents list.
export function AccountChips({ options, value, onPick }) {
  if (!options || options.length < 2) return null;
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
      {options.map(o => {
        const on = o.id === value;
        return (
          <Pressable key={o.id} onPress={() => onPick(o.id)} style={{
            paddingVertical: 8, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1,
            borderColor: on ? C.green : C.mutedBorder35, backgroundColor: on ? C.green : 'transparent',
          }}>
            <Tx w={700} s={11} c={on ? C.cream : C.muted}>{o.label}</Tx>
          </Pressable>
        );
      })}
    </View>
  );
}

// Sign out — the same button in the investor app (More) and the partner app (More): outlined in red, since it
// ends the session.
export function SignOutButton({ onPress, style }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel="Sign out"
      style={({ pressed }) => [{ marginTop: 22, paddingVertical: 13, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(239,68,68,0.45)',
        backgroundColor: pressed ? 'rgba(239,68,68,0.06)' : 'transparent', alignItems: 'center' }, style]}>
      <Tx w={700} s={13} ls={0.04} c={C.red}>Sign out</Tx>
    </Pressable>
  );
}
