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

// file: { uri, name, mimeType }
export function uploadDocument(submissionId, fieldKey, file) {
  const fd = new FormData();
  fd.append('submissionId', submissionId);
  fd.append('fieldKey', fieldKey);
  fd.append('file', { uri: file.uri, name: file.name, type: file.mimeType });
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
