// Device popups (push notifications) for the phone app. The server decides what to send (myQode lib/appNotify.ts);
// this file only gets permission, registers the device, shows popups while the app is open and reports taps.
// Web has no push: every function is a no-op there and the bell's inbox is the whole feature.
//
// Reliability on the device side:
//  - the token is (re)registered on every start and whenever it changes, so a missed registration heals itself;
//  - sign-out unregisters the device BEFORE the session is dropped, so the next person on the phone gets nothing
//    meant for the previous one;
//  - a tap that launched the app is read once the app is ready (getLastNotificationResponse), never lost.
import { Platform, Linking } from 'react-native';
import Constants from 'expo-constants';
import { services } from './api';
import { storeGet, storeSet, storeDel } from './api/session';

// Expo Go dropped the push-notification native module in SDK 53, and importing expo-notifications there
// crashes the app before it renders ("runtime not ready"). So the module is only loaded outside Expo Go;
// in Expo Go (and on web) every function below is a no-op and permission() reports 'unsupported'.
const inExpoGo = Constants.executionEnvironment === 'storeClient';
let Notifications = null;
if ((Platform.OS === 'ios' || Platform.OS === 'android') && !inExpoGo) {
  try { Notifications = require('expo-notifications'); } catch { Notifications = null; }
}
const native = !!Notifications;
const TOKEN_KEY = 'myqode.pushToken';
const ASKED_KEY = 'myqode.pushAskedAt';
const projectId = () => (Constants.expoConfig && Constants.expoConfig.extra && Constants.expoConfig.extra.eas && Constants.expoConfig.extra.eas.projectId)
  || (Constants.easConfig && Constants.easConfig.projectId);

if (native) {
  // Popups show even while the app is open, like a banking app.
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: true }),
  });
}

async function channel() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('default', {
    name: 'Updates from Qode', importance: Notifications.AndroidImportance.HIGH, vibrationPattern: [0, 200, 120, 200], lightColor: '#DABD38',
  });
}

/** 'granted' | 'denied' | 'undetermined' | 'unsupported' */
export async function permission() {
  if (!native) return 'unsupported';
  try {
    const p = await Notifications.getPermissionsAsync();
    if (p.granted || (p.ios && p.ios.status === Notifications.IosAuthorizationStatus.PROVISIONAL)) return 'granted';
    return p.canAskAgain === false || p.status === 'denied' ? 'denied' : 'undetermined';
  } catch { return 'unsupported'; }
}

/** Shows the system prompt (once iOS allows it). Returns the new permission. */
export async function ask() {
  if (!native) return 'unsupported';
  await storeSet(ASKED_KEY, String(Date.now()));
  await channel();
  try { await Notifications.requestPermissionsAsync({ ios: { allowAlert: true, allowBadge: true, allowSound: true } }); } catch {}
  return permission();
}

/** Whether to offer the in-app "turn on notifications" card: not decided yet, and not dismissed in the past 14 days. */
export async function shouldOffer() {
  if ((await permission()) !== 'undetermined') return false;
  const at = Number(await storeGet(ASKED_KEY)) || 0;
  return Date.now() - at > 14 * 86400000;
}
export const snooze = () => storeSet(ASKED_KEY, String(Date.now()));

/** Registers this device for the signed-in login when permission is granted. Safe to call any number of times. */
export async function register() {
  if (!native || (await permission()) !== 'granted') return null;
  await channel();
  const id = projectId();
  if (!id) return null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId: id });
      await services.registerPushToken(token);
      await storeSet(TOKEN_KEY, token);
      return token;
    } catch (e) {
      if (e && e.code === 'TEST_MODE') return null;   // TEST_MODE builds never register (real client logins)
      await new Promise(r => setTimeout(r, 1500 * (attempt + 1)));
    }
  }
  return null;
}

/** Call before the session is cleared: this phone stops receiving the signed-out login's popups. */
export async function unregister() {
  if (!native) return;
  const token = await storeGet(TOKEN_KEY);
  if (!token) return;
  try { await services.unregisterPushToken(token); } catch {}
  await storeDel(TOKEN_KEY);
  try { await Notifications.setBadgeCountAsync(0); } catch {}
}

export const setBadge = n => { if (native) Notifications.setBadgeCountAsync(Math.max(0, n || 0)).catch(() => {}); };
export const openSettings = () => Linking.openSettings().catch(() => {});

/**
 * Listens for popups arriving while the app is open (onReceive) and for taps (onTap(link, id)), and replays the
 * tap that launched the app. Returns an unsubscribe function.
 */
export function listen({ onReceive, onTap, onToken }) {
  if (!native) return () => {};
  const dataOf = r => (r && r.notification && r.notification.request && r.notification.request.content && r.notification.request.content.data) || {};
  const tapped = r => { const d = dataOf(r); onTap(d.link || '', Number(d.notificationId) || 0); };
  const subs = [
    Notifications.addNotificationReceivedListener(() => onReceive && onReceive()),
    Notifications.addNotificationResponseReceivedListener(r => { tapped(r); Notifications.clearLastNotificationResponse(); }),
    Notifications.addPushTokenListener(() => onToken && onToken()),
  ];
  try {
    const last = Notifications.getLastNotificationResponse();
    if (last) { tapped(last); Notifications.clearLastNotificationResponse(); }
  } catch {}
  return () => subs.forEach(s => s && s.remove());
}
