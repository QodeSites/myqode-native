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

// Expo Go has no remote push since SDK 53 (on Android its push calls throw on start): everything here is off
// there, as on the web. Development builds, TestFlight and store builds are unaffected.
// Expo Go on Android crashes while merely LOADING expo-notifications (its module sets up a push-token listener as it
// loads), so the library is required only outside Expo Go and never imported at the top of the file. Metro runs a
// module's code on its first require(), so in Expo Go the library's code never runs at all.
const expoGo = Constants.appOwnership === 'expo' || Constants.executionEnvironment === 'storeClient';
const native = (Platform.OS === 'ios' || Platform.OS === 'android') && !expoGo;
const Notifications = native ? require('expo-notifications') : null;
const TOKEN_KEY = 'myqode.pushToken';
const ASKED_KEY = 'myqode.pushAskedAt';
const OFFER_KEY = 'myqode.pushOfferDismissedAt';   // "Not now" on the in-app card
const projectId = () => (Constants.expoConfig && Constants.expoConfig.extra && Constants.expoConfig.extra.eas && Constants.expoConfig.extra.eas.projectId)
  || (Constants.easConfig && Constants.easConfig.projectId);

if (native) {
  // Popups show even while the app is open, like a banking app.
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: true }),
  });
}

async function channel() {
  if (!Notifications || Platform.OS !== 'android') return;
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
  let err = null;
  try { await Notifications.requestPermissionsAsync({ ios: { allowAlert: true, allowBadge: true, allowSound: true } }); } catch (e) { err = String((e && e.message) || e); }
  const p = await permission();
  services.pushDiag({ stage: 'ask', result: p, error: err });
  return p;
}
// Last outcome of register(), shown on the Notifications settings card.
export let lastStatus = '';

/**
 * Whether to offer the in-app "turn on notifications" card, and which kind: 'ask' (not decided yet: the system
 * prompt) or 'settings' (turned off: iOS never shows its prompt again, even for a new build of the same app, so the
 * card opens this app's page in Settings). False when on, or dismissed in the past 14 days.
 */
export async function shouldOffer() {
  const p = await permission();
  if (p !== 'undetermined' && p !== 'denied') return false;
  const at = Number(await storeGet(OFFER_KEY)) || 0;
  if (Date.now() - at <= 14 * 86400000) return false;
  if (p === 'undetermined' && Date.now() - (Number(await storeGet(ASKED_KEY)) || 0) <= 14 * 86400000) return false;
  return p === 'denied' ? 'settings' : 'ask';
}
export const snooze = () => storeSet(OFFER_KEY, String(Date.now()));

/** Reports this phone's starting point (permission, whether we asked before) to the server log. */
export async function reportStart(mode) {
  if (!native) return;
  services.pushDiag({ stage: 'start', mode, perm: await permission(), askedBefore: !!(await storeGet(ASKED_KEY)), projectId: !!projectId() });
}

/** True the first time only: permission not decided yet and the app has never shown the iPhone's prompt. */
export async function shouldAskNow() {
  if ((await permission()) !== 'undetermined') return false;
  return !(await storeGet(ASKED_KEY));
}

/** Registers this device for the signed-in login when permission is granted. Safe to call any number of times. */
export async function register() {
  if (!native) return null;
  const perm = await permission();
  if (perm !== 'granted') { lastStatus = 'Permission: ' + perm; return null; }
  await channel();
  const id = projectId();
  if (!id) { lastStatus = 'No project id in this build'; services.pushDiag({ stage: 'projectId', error: 'missing' }); return null; }
  let stage = 'token', err = '';
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      stage = 'token';
      const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId: id });
      stage = 'server';
      await services.registerPushToken(token);
      await storeSet(TOKEN_KEY, token);
      lastStatus = 'Registered';
      return token;
    } catch (e) {
      if (e && e.code === 'TEST_MODE') { lastStatus = 'Test-mode build: not registered'; return null; }
      err = String((e && e.message) || e);
      await new Promise(r => setTimeout(r, 1500 * (attempt + 1)));
    }
  }
  lastStatus = `Couldn't register (${stage}): ${err}`;
  services.pushDiag({ stage, error: err.slice(0, 400) });
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
