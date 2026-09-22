import Constants from 'expo-constants';
// Build-time flags (EXPO_PUBLIC_* are inlined by Expo). See .env.
const on = v => v === '1' || v === 'true';

// TEST MODE: we may be signed in as a real client, so nothing may reach them —
// no OTP/reset emails, no password changes, no push registration, no payments or SIP changes.
export const TEST_MODE = on(process.env.EXPO_PUBLIC_TEST_MODE);

// DEV BYPASS: shows the passwordless sign-in on the login screen. Only works when the
// myQode server runs with NODE_ENV=development (its login route then skips the password).
export const DEV_BYPASS = on(process.env.EXPO_PUBLIC_DEV_BYPASS);

// The app's own version, read from app.json ("expo.version") so a build never disagrees with itself.
// Bump app.json → expo.version when you make a store build; the server's APP_LATEST_VERSION / APP_MIN_VERSION
// (myQode .env, defaults 1.1.2 / 1.0.0) drive the "update available" / "update required" banner.
export const APP_VERSION = (Constants.expoConfig && Constants.expoConfig.version) || '1.0.0';

// Testing: hide the update banner. In a release build (TEST_MODE off) it always applies.
export const SHOW_UPDATE_BANNER = !TEST_MODE;
