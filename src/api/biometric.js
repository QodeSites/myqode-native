// Face ID / fingerprint unlock (expo-local-authentication), for Android and iOS.
// The session token stays in secure storage — the user is signed in until they sign out or uninstall;
// biometrics only gate OPENING the app. Nothing is sent to the server.
//
// Platform notes
//   iOS      Face ID or Touch ID. Needs NSFaceIDUsageDescription (app.json plugin). In Expo Go, Face ID is not
//            available to apps (Expo Go's own limit) and the prompt falls back to the phone passcode; a
//            development or store build uses Face ID.
//   Android  Fingerprint, and face unlock where the phone offers it (class 2 "weak" face unlock included).
//            Needs USE_BIOMETRIC (added by the app.json plugin). Works in Expo Go.
import * as LocalAuthentication from 'expo-local-authentication';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { storeGet, storeSet, storeDel } from './session';

const KEY = 'myqode.biometricLock';   // '1' when the user turned it on
const T = LocalAuthentication.AuthenticationType;
export const inExpoGo = Constants.appOwnership === 'expo' || Constants.executionEnvironment === 'storeClient';

// What to call it on this phone.
function labelFor(types) {
  const face = types.includes(T.FACIAL_RECOGNITION), finger = types.includes(T.FINGERPRINT), iris = types.includes(T.IRIS);
  if (Platform.OS === 'ios') return face ? 'Face ID' : 'Touch ID';
  if (finger && (face || iris)) return 'fingerprint or face unlock';
  if (face) return 'face unlock';
  return 'fingerprint';
}

// null when this phone can't use biometrics (no hardware, or nothing enrolled); otherwise { label, iosFace }.
export async function biometricAvailable() {
  if (Platform.OS === 'web') return null;
  try {
    const [hw, enrolled, types] = await Promise.all([
      LocalAuthentication.hasHardwareAsync(),
      LocalAuthentication.isEnrolledAsync(),
      LocalAuthentication.supportedAuthenticationTypesAsync(),
    ]);
    if (!hw || !enrolled) return null;
    return { label: labelFor(types || []), iosFace: Platform.OS === 'ios' && (types || []).includes(T.FACIAL_RECOGNITION) };
  } catch { return null; }
}

export const biometricEnabled = async () => (await storeGet(KEY)) === '1';
export const setBiometricEnabled = on => (on ? storeSet(KEY, '1') : storeDel(KEY));

// { ok: true } or { ok: false, cancelled, message } — message is shown on the lock screen.
export async function biometricUnlock(label = 'fingerprint') {
  try {
    const r = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Unlock myQode',
      promptSubtitle: 'Use your ' + label,          // Android only
      cancelLabel: 'Cancel',
      disableDeviceFallback: false,                   // phone PIN / passcode is an acceptable fallback
      biometricsSecurityLevel: 'weak',                // Android: allow camera face unlock as well as fingerprint
      requireConfirmation: false,                     // Android: face unlock opens without an extra tap
    });
    if (r.success) return { ok: true };
    const e = r.error;
    const cancelled = e === 'user_cancel' || e === 'system_cancel' || e === 'app_cancel';
    const message =
      cancelled ? '' :
      e === 'lockout' ? 'Too many attempts. Unlock your phone with its PIN or passcode first, then try again.' :
      e === 'not_enrolled' || e === 'passcode_not_set' ? `No ${label} is set up on this phone any more. Sign in with your password.` :
      e === 'not_available' ? `${label[0].toUpperCase() + label.slice(1)} isn’t available right now. Sign in with your password.` :
      e === 'timeout' ? 'That took too long. Try again.' :
      'Not recognised. Try again, or sign in with your password.';
    return { ok: false, cancelled, message };
  } catch {
    return { ok: false, cancelled: false, message: 'Couldn’t start the unlock prompt. Sign in with your password.' };
  }
}
