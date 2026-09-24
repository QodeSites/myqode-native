// Endpoint bindings for the onboarding backend (see the web repo's handoff:
// every route below is the same one the web wizard calls; access is by
// possession of the submission id or resume token).
import { API_BASE, TIMINGS } from './config.js';
import { request } from './http.js';

const enc = encodeURIComponent;

export function createSubmission(accountType, data) {
  return request('/api/submissions', { method: 'POST', body: { accountType, data: data || {} } });
}

export function getSubmission(idOrToken) {
  return request(`/api/submissions/${enc(idOrToken)}`);
}

export function patchSubmission(idOrToken, body) {
  return request(`/api/submissions/${enc(idOrToken)}`, { method: 'PATCH', body });
}

export function getProgress(idOrToken) {
  return request(`/api/submissions/${enc(idOrToken)}/progress`);
}

// Multipart part for a picked file. Expo SDK 54+ replaces global fetch with expo/fetch, whose
// encoder rejects React Native's { uri, name, type } parts ("Unsupported FormDataPart
// implementation") and wants a Blob or anything with bytes(). This default reads the URI
// through fetch (web blob: URIs, node data: URIs); main.js injects the native builder from
// file-native.js, which reads the picker's file:// URI with expo-file-system.
export async function blobFilePart(file) {
  const blob = await (await fetch(file.uri)).blob();
  return new File([blob], file.name || 'file', { type: file.mimeType || blob.type });
}

// file: { uri, name, mimeType, size }
export async function uploadDocument(submissionId, fieldKey, file, toPart = blobFilePart) {
  if (typeof console !== 'undefined' && console.log) {
    console.log(`[onboarding] upload ${fieldKey}: ${String(file.uri).slice(0, 60)}… name=${file.name} type=${file.mimeType} size=${file.size}`);
  }
  const part = await toPart(file);
  const fd = new FormData();
  fd.append('submissionId', submissionId);
  fd.append('fieldKey', fieldKey);
  fd.append('file', part);
  return request('/api/upload', { method: 'POST', formData: fd, timeoutMs: TIMINGS.uploadTimeoutMs });
}

export function fileUrl(uploadId) {
  return `${API_BASE}/api/files/${enc(uploadId)}`;
}

export function startKyc(submissionId, subject, purpose) {
  return request('/api/kyc/start', { method: 'POST', body: { submissionId, subject, purpose } });
}

export function getKyc(checkId) {
  return request(`/api/kyc/${enc(checkId)}`);
}

export function startEsign(submissionId) {
  return request('/api/esign/start', { method: 'POST', body: { submissionId } });
}

export function getEsign(checkId) {
  return request(`/api/esign/${enc(checkId)}`);
}
