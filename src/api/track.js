// Batched screen/event analytics → POST /api/mobile/engagement/analytics (max 100 per call).
import { Platform } from 'react-native';
import { engagement, isDemo } from './index';
import { APP_VERSION } from './config';

let queue = [];
let timer = null;
let session = Math.random().toString(36).slice(2, 10);
let userId = null;
let enabled = false;

export const trackStart = uid => { userId = uid || null; session = Math.random().toString(36).slice(2, 10); enabled = true; };
export const trackStop = () => { flush(); enabled = false; userId = null; };

export function track(type, name, properties) {
  if (!enabled || isDemo()) return;
  queue.push({ type, name, properties: properties || {}, userId, sessionId: session, timestamp: new Date().toISOString(), platform: Platform.OS, appVersion: APP_VERSION });
  if (queue.length >= 50) flush();
  else if (!timer) timer = setTimeout(flush, 20000);
}
export const screen = name => track('screen', name);

export function flush() {
  clearTimeout(timer); timer = null;
  if (!queue.length) return;
  const batch = queue.splice(0, 100);
  engagement.analytics(batch).catch(() => {});
}
