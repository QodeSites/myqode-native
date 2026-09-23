// Onboarding backend configuration. This is a DIFFERENT server from the
// myQode investor API in src/api (which serves signed-in clients): the
// onboarding form lives at onboarding.qodeinvest.com and is unauthenticated,
// keyed by submission id / resume token.
//
// Override per environment with an Expo public env var (baked in at bundle
// time; restart with `npx expo start -c` after changing it):
//   EXPO_PUBLIC_ONBOARDING_API_BASE=https://0v6phzxb-3099.inc1.devtunnels.ms
// Android emulators reach a local backend at http://10.0.2.2:3099; physical
// devices need the machine's LAN IP or a tunnel.
const fromEnv = typeof process !== 'undefined' && process.env && process.env.EXPO_PUBLIC_ONBOARDING_API_BASE;

export const API_BASE = (fromEnv || 'https://onboarding.qodeinvest.com').replace(/\/+$/, '');

// Web resume links look like https://onboarding.qodeinvest.com/onboard/{token}.
export const RESUME_HOSTS = ['onboarding.qodeinvest.com'];

export const TIMINGS = {
  requestTimeoutMs: 30000,
  uploadTimeoutMs: 90000,
  autosaveDebounceMs: 800,
  saveRetryBaseMs: 2000,
  saveRetryMaxMs: 60000,
  pollIntervalMs: 3000,
  slowAfterMs: 30000,
  giveUpAfterMs: 10 * 60 * 1000,
};

export const UPLOAD = {
  maxBytes: 10 * 1024 * 1024,
  allowedMime: ['application/pdf', 'image/png', 'image/jpeg', 'image/webp'],
};

export const SECURE_KEYS = {
  resumeToken: 'qode.onboarding.resumeToken',
  submissionId: 'qode.onboarding.submissionId',
};
