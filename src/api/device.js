// This device, described once: for analytics (session_start) and the x-device header on every API call.
// Nothing personal: model, OS and version only.
import { Platform, Dimensions } from 'react-native';
import * as Device from 'expo-device';

const browser = () => {
  const ua = (typeof navigator !== 'undefined' && navigator.userAgent) || '';
  if (/Edg\//.test(ua)) return 'Edge';
  if (/Firefox\//.test(ua)) return 'Firefox';
  if (/Chrome\//.test(ua)) return 'Chrome';
  if (/Safari\//.test(ua)) return 'Safari';
  return 'Browser';
};

const typeOf = () => {
  if (Platform.OS === 'web') return (Dimensions.get('window').width || 0) < 700 ? 'phone' : 'desktop';
  return Device.deviceType === Device.DeviceType.TABLET ? 'tablet' : Device.deviceType === Device.DeviceType.DESKTOP ? 'desktop' : 'phone';
};

export const deviceInfo = (() => {
  try {
    if (Platform.OS === 'web') return { os: 'web', osVersion: null, deviceModel: null, brand: null, deviceType: typeOf(), browser: browser() };
    return { os: Platform.OS, osVersion: Device.osVersion || String(Platform.Version || ''), deviceModel: Device.modelName || null, brand: Device.brand || null, deviceType: typeOf() };
  } catch {
    return { os: Platform.OS, osVersion: null, deviceModel: null, brand: null, deviceType: 'phone' };
  }
})();

// 'iPhone 15 Pro - iOS 18.2', 'Pixel 8 - Android 15', 'Web - Chrome'. ASCII only: it travels as an HTTP header, and the
// dev tunnel rejects any request whose header has a non-ASCII character (e.g. '·'), which broke every API call.
const ascii = t => String(t).replace(/[^\x20-\x7E]/g, '').replace(/\s+/g, ' ').trim();
export const deviceString = (() => {
  const d = deviceInfo;
  if (d.os === 'web') return ascii('Web - ' + (d.browser || 'Browser'));
  const os = d.os === 'ios' ? 'iOS' : d.os === 'android' ? 'Android' : d.os;
  return ascii([d.deviceModel || (d.os === 'ios' ? 'iPhone' : 'Android device'), [os, d.osVersion].filter(Boolean).join(' ')].join(' - ')).slice(0, 80);
})();
