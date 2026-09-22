import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const KEY = 'myqode.token';
const web = Platform.OS === 'web';

export async function getToken() {
  try {
    return web ? globalThis.localStorage?.getItem(KEY) || null : await SecureStore.getItemAsync(KEY);
  } catch { return null; }
}

export async function setToken(token) {
  try {
    if (web) globalThis.localStorage?.setItem(KEY, token);
    else await SecureStore.setItemAsync(KEY, token);
  } catch {}
}

export async function clearToken() {
  try {
    if (web) globalThis.localStorage?.removeItem(KEY);
    else await SecureStore.deleteItemAsync(KEY);
  } catch {}
}

// Small persistent key/value store for app state that must survive a reload (e.g. a payment in progress).
export async function storeGet(key) {
  try { return web ? globalThis.localStorage?.getItem(key) || null : await SecureStore.getItemAsync(key); } catch { return null; }
}
export async function storeSet(key, value) {
  try { if (web) globalThis.localStorage?.setItem(key, value); else await SecureStore.setItemAsync(key, value); } catch {}
}
export async function storeDel(key) {
  try { if (web) globalThis.localStorage?.removeItem(key); else await SecureStore.deleteItemAsync(key); } catch {}
}
