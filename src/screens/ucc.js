// The web's primary-UCC notice (components/primary-ucc-banner.tsx) as a one-time pop-up:
// "See all your schemes in one place on Nuvama's WealthSpectrum portal."
// Shown once per sign-in, over Home, once the dashboard has loaded. Closing it sets `uccSeen` in the root
// state (src/main.js), which sign-out resets — so every fresh sign-in sees it once. Nothing is persisted.
import React, { useState } from 'react';
import { View, Pressable, Modal, ScrollView } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { C, Tx } from '../ui';
import { Copy, Check } from '../icons';
import { meta } from '../api';
import { useLoad } from './kit';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const formatAsOf = iso => { const [y, m, d] = String(iso).split('-').map(Number); return y && m && d ? `${d} ${MONTHS[m - 1]} ${y}` : iso; };

export function UccNotice({ visible, onClose }) {
  const res = useLoad(() => (visible ? meta.primaryUcc() : Promise.resolve(null)), [visible]);
  const primaries = (res.data && res.data.success && res.data.primaries) || [];
  const [copied, setCopied] = useState('');
  if (!visible || !primaries.length) return null;

  const multiple = primaries.length > 1;
  const copy = code => { Clipboard.setStringAsync(code).catch(() => {}); setCopied(code); setTimeout(() => setCopied(''), 1500); };

  // Notification-style card that slides in at the top; the screen behind stays visible (no dimming).
  // Tapping outside, ×, or "Got it" closes it.
  return (
    <Modal transparent animationType="slide" visible onRequestClose={onClose} statusBarTranslucent>
      <Pressable onPress={onClose} style={{ flex: 1, justifyContent: 'flex-start', paddingTop: 54, paddingHorizontal: 14 }}>
        <Pressable onPress={() => {}} style={{ backgroundColor: C.cream, borderRadius: 14, borderWidth: 1, borderColor: C.gold, maxHeight: 300, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 10 }}>
          <ScrollView contentContainerStyle={{ paddingVertical: 12, paddingHorizontal: 14 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={{ width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, borderColor: C.gold, alignItems: 'center', justifyContent: 'center' }}>
                <Tx w={700} s={11} c={C.gold}>i</Tx>
              </View>
              <Tx w={700} s={12.5} lh={1.3} style={{ flex: 1 }}>{multiple ? 'Your primary UCC codes for Nuvama\'s WealthSpectrum portal' : 'Your primary UCC code for Nuvama\'s WealthSpectrum portal'}</Tx>
              <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Close"><Tx w={700} s={18} c={C.muted}>×</Tx></Pressable>
            </View>
            <Tx s={11.5} c={C.muted} lh={1.45} style={{ marginTop: 6 }}>
              {multiple ? 'Sign in with the code of a family group to see all the schemes mapped to it.' : 'Sign in with this code to see all your mapped schemes together; other codes show one scheme each.'}
            </Tx>
            <View style={{ marginTop: 8, gap: 6 }}>
              {primaries.map(p => (
                <View key={p.uccCode} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: C.gold35, backgroundColor: 'rgba(255,255,255,0.7)', borderRadius: 8, paddingVertical: 7, paddingHorizontal: 12 }}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Tx f="inter" w={700} s={15} ls={0.5}>{p.uccCode}</Tx>
                    {multiple && !!p.groupName && <Tx s={10} c={C.muted} numberOfLines={1} style={{ marginTop: 1 }}>{p.groupName}</Tx>}
                  </View>
                  <Pressable onPress={() => copy(p.uccCode)} hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 4, paddingHorizontal: 6 }}>
                    {copied === p.uccCode ? <Check s={12} /> : <Copy s={12} />}
                    <Tx w={700} s={11} c={C.green}>{copied === p.uccCode ? 'Copied' : 'Copy'}</Tx>
                  </Pressable>
                </View>
              ))}
            </View>
            <Tx s={10} c={C.gray} lh={1.45} style={{ marginTop: 8 }}>
              Nuvama's portal only — your myQode login is unchanged.{res.data.dataAsOf ? ` Portfolio data is available as of ${formatAsOf(res.data.dataAsOf)} due to Nuvama downtime.` : ''}
            </Tx>
            <Pressable onPress={onClose} style={{ alignSelf: 'flex-end', marginTop: 6, paddingVertical: 4, paddingHorizontal: 6 }}>
              <Tx w={700} s={11} c={C.green}>GOT IT</Tx>
            </Pressable>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
