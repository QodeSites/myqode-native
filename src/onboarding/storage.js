// Secure persistence for the resume credential. The resume token grants full
// access to an application, so it lives in the platform keychain/keystore,
// never in plain storage, analytics or logs.
import * as SecureStore from 'expo-secure-store';
import { SECURE_KEYS } from './config';

async function safeGet(key) {
  try { return await SecureStore.getItemAsync(key); } catch (e) { return null; }
}
async function safeSet(key, value) {
  try { await SecureStore.setItemAsync(key, value, { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY }); } catch (e) { /* storage unavailable; session continues in memory */ }
}
async function safeDelete(key) {
  try { await SecureStore.deleteItemAsync(key); } catch (e) { /* ignore */ }
}

export async function loadSaved() {
  const [resumeToken, submissionId] = await Promise.all([safeGet(SECURE_KEYS.resumeToken), safeGet(SECURE_KEYS.submissionId)]);
  return resumeToken ? { resumeToken, submissionId } : null;
}

export async function save({ resumeToken, submissionId }) {
  await Promise.all([safeSet(SECURE_KEYS.resumeToken, resumeToken || ''), safeSet(SECURE_KEYS.submissionId, submissionId || '')]);
}

export async function clear() {
  await Promise.all([safeDelete(SECURE_KEYS.resumeToken), safeDelete(SECURE_KEYS.submissionId)]);
}
