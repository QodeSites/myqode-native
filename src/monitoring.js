// Crash and error reporting to Qode's self-hosted Sentry (project "qode-app" on sentry.qodeinvest.com; alerts reach
// Teams through the server's sentry-teams-relay). On in release builds that carry EXPO_PUBLIC_SENTRY_DSN (.env /
// .env.production, not in git) — phone apps and the web app at /app — never in development.
// Privacy: no user identity, no request bodies, no console logs; emails, PANs, phone numbers, client codes and long
// digit runs are masked in whatever text does go out.
import * as Sentry from '@sentry/react-native';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

const DSN = process.env.EXPO_PUBLIC_SENTRY_DSN || '';
export const monitoringOn = !!DSN && !__DEV__;

const MASKS = [
  [/[\w.+-]+@[\w-]+\.[\w.]+/g, '[email]'],
  [/\b[A-Z]{5}\d{4}[A-Z]\b/g, '[pan]'],
  [/\bQ[A-Z]{2}\d{3,6}\b/g, '[account]'],
  [/(\+91[\s-]?)?\b\d{10}\b/g, '[phone]'],
  [/\b\d{11,}\b/g, '[number]'],
];
const mask = s => (typeof s === 'string' ? MASKS.reduce((t, [re, to]) => t.replace(re, to), s) : s);

function scrub(event) {
  delete event.user;
  if (event.request) { delete event.request.data; delete event.request.cookies; delete event.request.headers; if (event.request.url) event.request.url = event.request.url.split('?')[0]; }
  if (event.message) event.message = mask(event.message);
  for (const ex of (event.exception && event.exception.values) || []) ex.value = mask(ex.value);
  if (event.breadcrumbs) event.breadcrumbs = event.breadcrumbs.map(b => ({ ...b, message: mask(b.message), data: b.data && b.data.url ? { ...b.data, url: String(b.data.url).split('?')[0] } : b.data }));
  return event;
}

export function initMonitoring() {
  if (!monitoringOn) return;
  const version = (Constants.expoConfig && Constants.expoConfig.version) || '0';
  Sentry.init({
    dsn: DSN,
    // myqode-testing.qodeinvest.com IS the production server since the 6 Oct 2026 launch, so the name says nothing;
    // EXPO_PUBLIC_APP_ENV (e.g. "staging") marks any other build.
    environment: process.env.EXPO_PUBLIC_APP_ENV || 'production',
    release: `myqode-app@${version}`,
    dist: Platform.OS,
    sendDefaultPii: false,
    tracesSampleRate: 0.1,               // a sample of screen loads and API calls, for "slow on some phones" questions
    beforeSend: scrub,
    beforeBreadcrumb: b => (b.category === 'console' ? null : b),   // logs can hold figures; keep taps, navigation, requests
  });
}

/** Report a handled error (e.g. the crash screen); a no-op when monitoring is off. */
export function reportError(error, extra) {
  if (!monitoringOn || !error) return;
  try { Sentry.captureException(error, extra ? { extra } : undefined); } catch (_) { /* never let reporting break the app */ }
}

export const wrapRoot = App => (monitoringOn ? Sentry.wrap(App) : App);
