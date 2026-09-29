// Usage analytics → POST /api/mobile/engagement/analytics (batched, max 100 per call), stored in
// pms_clients_tracker.pms_mobile_analytics. What is sent:
//   session_start  { os, osVersion, deviceModel, brand, deviceType, browser?, appVersion, mode }  — sign-in, and each
//                  return to the app after 30+ minutes away (a new session id)
//   app_background { seconds }  (time since the app came to the front)   ·   app_foreground {}
//   screen <name>  { prev, prev_seconds }  (the screen left and how long it was open)
//   event <name>   key actions (pdf_download, payment_*, request_submitted, notification_open, logout, …)
// userId: the investor's client code, 'd:' + email for a distributor, 'a:' + email for an admin. Nothing is
// tracked in demo mode or while an admin views a client (trackStart is simply not called for those sessions).
import { Platform, AppState } from 'react-native';
import { engagement, isDemo } from './index';
import { APP_VERSION } from './config';
import { deviceInfo } from './device';

const NEW_SESSION_AFTER = 30 * 60 * 1000;
const newId = () => Math.random().toString(36).slice(2, 10);

let queue = [];
let timer = null;
let session = newId();
let userId = null;
let mode = 'investor';
let enabled = false;
let fgAt = Date.now();          // when the app last came to the front
let bgAt = 0;                   // when it last went to the back
let cur = null, curAt = 0;      // current screen and when it opened

export function track(type, name, properties) {
  if (!enabled || isDemo()) return;
  queue.push({ type, name, properties: properties || {}, userId, sessionId: session, timestamp: new Date().toISOString(), platform: Platform.OS, appVersion: APP_VERSION });
  if (queue.length >= 50) flush();
  else if (!timer) timer = setTimeout(flush, 20000);
}

const sessionStart = () => track('event', 'session_start', { ...deviceInfo, appVersion: APP_VERSION, mode });

/** uid: client code (investor), 'd:' + email (distributor) or 'a:' + email (admin). m: 'investor' | 'distributor' | 'admin'. */
export const trackStart = (uid, m = 'investor') => {
  userId = uid || null; mode = m; session = newId(); enabled = true; fgAt = Date.now(); cur = null;
  sessionStart();
};
export const trackStop = () => { flush(); enabled = false; userId = null; cur = null; };

export const screen = name => {
  const now = Date.now();
  const props = cur && cur !== name ? { prev: cur, prev_seconds: Math.round((now - curAt) / 1000) } : {};
  if (cur === name) return;
  cur = name; curAt = now;
  track('screen', name, props);
};

export function flush() {
  clearTimeout(timer); timer = null;
  if (!queue.length) return;
  const batch = queue.splice(0, 100);
  engagement.analytics(batch).catch(() => {});
}

// Foreground / background: time in the app, and a new session after 30 minutes away.
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', st => {
    if (!enabled) return;
    const now = Date.now();
    if (st === 'background') {
      track('event', 'app_background', { seconds: Math.round((now - fgAt) / 1000), screen: cur });
      bgAt = now; flush();
    } else if (st === 'active' && bgAt) {
      if (now - bgAt > NEW_SESSION_AFTER) { session = newId(); curAt = now; sessionStart(); }
      else { curAt += now - bgAt; track('event', 'app_foreground', {}); }   // time away doesn't count as time on the screen
      fgAt = now; bgAt = 0;
    }
  });
} else if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (!enabled) return;
    const now = Date.now();
    if (document.visibilityState === 'hidden') { track('event', 'app_background', { seconds: Math.round((now - fgAt) / 1000), screen: cur }); bgAt = now; flush(); }
    else if (bgAt) {
      if (now - bgAt > NEW_SESSION_AFTER) { session = newId(); curAt = now; sessionStart(); }
      else { curAt += now - bgAt; track('event', 'app_foreground', {}); }
      fgAt = now; bgAt = 0;
    }
  });
}
