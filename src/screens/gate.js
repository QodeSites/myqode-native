// Full-screen gates shown over everything: the biometric lock on start-up, and the app-update prompt.
import React from 'react';
import { View, Pressable, Modal, Linking, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { C, Tx, CTA, Card } from '../ui';
import { FaceID } from '../icons';

// Start-up lock when the user has turned on Face ID / fingerprint. The session is intact underneath; a
// failed or cancelled prompt just waits here. "Sign in with password" signs the session out.
export function LockScreen({ V }) {
  return (
    <LinearGradient colors={C.darkGrad} locations={[0, 0.55, 1]} start={{ x: 0.1, y: 0 }} end={{ x: 0.6, y: 1 }} style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
      <Tx f="play" w={600} s={34} c={C.cream}>myQode</Tx>
      <View style={{ width: 44, height: 2, backgroundColor: C.gold, marginTop: 14, marginBottom: 34 }} />
      <Pressable onPress={V.lockGone ? undefined : V.lockRetry} style={{ width: 72, height: 72, borderRadius: 36, borderWidth: 1, borderColor: 'rgba(239,236,211,0.3)', alignItems: 'center', justifyContent: 'center' }}>
        <FaceID s={30} c={C.gold} />
      </Pressable>
      <Tx w={700} s={14} c={C.cream} style={{ marginTop: 18 }}>{V.lockBusy ? 'Checking…' : V.lockGone ? 'Sign in again' : 'Unlock to continue'}</Tx>
      <Tx s={12} c={V.lockErr ? C.gold : C.cream60} center lh={1.5} style={{ marginTop: 6 }}>{V.lockErr || `Use your ${V.lockLabel} to open your account.`}</Tx>
      {!V.lockGone && <CTA label={V.lockBusy ? 'PLEASE WAIT…' : 'UNLOCK'} onPress={V.lockRetry} style={{ marginTop: 26, alignSelf: 'stretch', opacity: V.lockBusy ? 0.6 : 1 }} />}
      {V.lockGone
        ? <CTA label="SIGN IN WITH PASSWORD" onPress={V.lockUsePassword} style={{ marginTop: 26, alignSelf: 'stretch' }} />
        : (
          <Pressable onPress={V.lockUsePassword} style={{ marginTop: 18, paddingVertical: 8 }}>
            <Tx s={12} c={C.cream60} center>Sign in with password instead</Tx>
          </Pressable>
        )}
    </LinearGradient>
  );
}

// Update prompt: a pop-up that sends the user to the store. A forced update cannot be dismissed.
export function UpdatePrompt({ V }) {
  const u = V.update;
  if (!u) return null;
  const url = u.updateUrls && u.updateUrls[Platform.OS === 'ios' ? 'ios' : 'android'];
  return (
    <Modal transparent visible animationType="fade" onRequestClose={u.force ? undefined : V.dismissUpdate} statusBarTranslucent>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,32,23,0.6)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 }}>
        <Card big style={{ alignSelf: 'stretch', padding: 22 }}>
          <Tx w={700} s={10.5} ls={0.14} c={C.muted}>{u.force ? 'UPDATE REQUIRED' : 'UPDATE AVAILABLE'}</Tx>
          <Tx f="play" w={600} s={21} style={{ marginTop: 8 }}>myQode {u.latestVersion ? 'v' + u.latestVersion : 'update'}</Tx>
          <Tx s={12.5} c={C.muted} lh={1.6} style={{ marginTop: 8 }}>{u.message || 'A new version of myQode is available. Please update for the latest features.'}</Tx>
          <CTA label={Platform.OS === 'ios' ? 'OPEN THE APP STORE' : 'OPEN GOOGLE PLAY'} onPress={() => url && Linking.openURL(url).catch(() => {})} style={{ marginTop: 20 }} />
          {!u.force && <CTA label="LATER" outline onPress={V.dismissUpdate} style={{ marginTop: 10 }} />}
        </Card>
      </View>
    </Modal>
  );
}
