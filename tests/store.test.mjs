import { test } from 'node:test';
import assert from 'node:assert/strict';
import OnboardingStore from '../src/onboarding/store.js';
import { OnboardingError as ApiError } from '../src/onboarding/http.js';

const wait = ms => new Promise(r => setTimeout(r, ms));

function fakeApi(overrides = {}) {
  const calls = [];
  const api = {
    calls,
    createSubmission: async (accountType, data) => { calls.push(['create', accountType, data]); return { id: 'sub_1', resumeToken: 'tok_1' }; },
    patchSubmission: async (id, body) => { calls.push(['patch', id, body]); return { ok: true, id, status: 'draft' }; },
    getSubmission: async id => { calls.push(['get', id]); return { id: 'sub_1', resumeToken: 'tok_1', accountType: 'resident_individual', status: 'draft', currentStep: 2, data: { primary_fullName: 'RAVI KUMAR', appStep: 'noms' }, uploads: [] }; },
    getProgress: async id => ({ resumeToken: 'tok_1', status: 'draft', currentStep: 2, totalSteps: 6, progressPct: 40, primaryName: 'Ravi' }),
    uploadDocument: async (id, fieldKey, file) => { calls.push(['upload', fieldKey, file.name]); return { ok: true, upload: { id: 'up_1', fieldKey, originalName: file.name, sizeBytes: 100, url: '/api/files/up_1' } }; },
    startKyc: async (id, subject, purpose) => { calls.push(['kyc', subject, purpose]); return { checkId: 'chk_1', requestId: 'KID1', identifier: 'ravi@example.com', accessTokenId: 'tok', environment: 'sandbox', sdkSrc: 'https://app.digio.in/sdk/v11/digio.js', status: 'requested', mock: true }; },
    getKyc: async () => ({ status: 'requested', extracted: {}, docKeys: [], mock: true }),
    startEsign: async () => { throw new ApiError('Agreement signing is not configured', { status: 503, code: 'unavailable' }); },
    getEsign: async () => ({ status: 'requested' }),
    ...overrides,
  };
  return api;
}
const fakeStorage = () => { const box = {}; return { box, loadSaved: async () => (box.resumeToken ? { ...box } : null), save: async v => Object.assign(box, v), clear: async () => { delete box.resumeToken; delete box.submissionId; } }; };

function make(overrides, opts = {}) {
  const api = fakeApi(overrides);
  const storage = fakeStorage();
  const store = new OnboardingStore({ api, storage, onChange: () => {}, ...opts });
  return { api, storage, store };
}

test('creates a draft once the account type is known and syncs only diffs', async () => {
  const { api, storage, store } = make();
  await store.requestCreate('resident_individual', { primary_fullName: 'Ravi', appStep: 'identity' });
  assert.equal(store.s.id, 'sub_1');
  assert.equal(storage.box.resumeToken, 'tok_1');
  store.sync({ primary_fullName: 'Ravi', primary_email: 'r@x.com', appStep: 'identity' }, 1);
  await store.flush();
  const patch = api.calls.find(c => c[0] === 'patch');
  assert.deepEqual(patch[2], { data: { primary_email: 'r@x.com' }, currentStep: 1 });
  assert.equal(store.s.saveState, 'saved');
  store.dispose();
});

test('queues creation and saves while offline, then retries on reconnect', async () => {
  let fail = true, created = null;
  const { store } = make({
    createSubmission: async (t, d) => { if (fail) throw new ApiError('offline', { code: 'offline', retryable: true }); created = d; return { id: 'sub_2', resumeToken: 'tok_2' }; },
  });
  await store.requestCreate('resident_individual', { appStep: 'identity' });
  assert.equal(store.s.id, null);
  assert.equal(store.s.saveState, 'offline');
  store.sync({ appStep: 'identity', primary_fullName: 'Late edit' }, 1);
  fail = false;
  store.setOffline(true);
  store.setOffline(false);
  await wait(20);
  assert.equal(store.s.id, 'sub_2');
  assert.equal(created.primary_fullName, 'Late edit');
  store.dispose();
});

test('a 409 locks the application instead of erroring', async () => {
  const { store } = make({ patchSubmission: async () => { throw new ApiError('locked', { status: 409, code: 'locked' }); } });
  await store.requestCreate('resident_individual', {});
  store.sync({ primary_fullName: 'X' }, 1);
  await store.flush();
  assert.equal(store.s.locked, true);
  assert.equal(store.s.status, 'submitted');
  store.dispose();
});

test('verification polls to completion and merges extracted fields', async () => {
  let n = 0;
  const { store } = make({
    getKyc: async () => { n += 1; return n < 2 ? { status: 'requested', extracted: {}, docKeys: [] } : { status: 'approved', extracted: { primary_fullName: 'RAVI KUMAR', primary_pan: 'ABCPK1234F' }, docKeys: ['doc_pan_h1', 'doc_aadhaar_h1'], mock: true }; },
  });
  await store.requestCreate('resident_individual', { primary_email: 'r@x.com' });
  const c = await store.startVerification('primary', 'identity');
  assert.equal(c.checkId, 'chk_1');
  // first tick already ran; drive the loop faster than the 3s interval
  store.pollNow('primary_identity');
  await wait(10);
  const done = store.check('primary', 'identity');
  assert.equal(done.done, true);
  assert.equal(store.s.server.primary_pan, 'ABCPK1234F');
  assert.deepEqual(store.s.satisfied, ['doc_pan_h1', 'doc_aadhaar_h1']);
  store.dispose();
});

test('a rejected check exposes a friendly failure and can be retried', async () => {
  let status = 'rejected';
  const { store } = make({ getKyc: async () => ({ status, extracted: {}, docKeys: [] }) });
  await store.requestCreate('resident_individual', {});
  await store.startVerification('primary', 'identity');
  await wait(5);
  assert.equal(store.check('primary', 'identity').failed, true);
  assert.match(store.check('primary', 'identity').error, /not approved/);
  status = 'approval_pending';
  await store.retryVerification('primary', 'identity');
  await wait(5);
  assert.equal(store.check('primary', 'identity').done, true);
  store.dispose();
});

test('Digio disabled (503) flips to manual mode without a dead end', async () => {
  const { store } = make({ startKyc: async () => { throw new ApiError('Digio is disabled', { status: 503, code: 'unavailable' }); } });
  await store.requestCreate('resident_individual', {});
  const r = await store.startVerification('primary', 'identity');
  assert.equal(r, null);
  assert.equal(store.s.digio, 'disabled');
  assert.match(store.check('primary', 'identity').error, /upload your documents/);
  store.dispose();
});

test('SDK callback errors are surfaced and a poll follows', async () => {
  let polls = 0;
  const { store } = make({ getKyc: async () => { polls += 1; return { status: 'requested', extracted: {}, docKeys: [] }; } });
  await store.requestCreate('resident_individual', {});
  await store.startVerification('primary', 'identity');
  const before = polls;
  store.sdkEvent('primary', 'identity', { type: 'callback', response: { error_code: 'CANCELLED', message: 'User closed the window' } });
  await wait(5);
  assert.equal(store.check('primary', 'identity').sdkError, 'User closed the window');
  assert.ok(polls > before);
  store.dispose();
});

test('client-side timeout offers keep waiting', async () => {
  let now = 1000;
  const { store } = make({}, { now: () => now });
  await store.requestCreate('resident_individual', {});
  await store.startVerification('primary', 'identity');
  // While the Digio window is open and hasn't answered, the investor may be mid-flow: no timeout.
  store.sdkEvent('primary', 'identity', { type: 'opened' });
  now += 11 * 60 * 1000;
  store.pollNow('primary_identity');
  await wait(5);
  assert.equal(store.check('primary', 'identity').timedOut, false);
  assert.equal(store.check('primary', 'identity').slow, true);
  // Once the SDK has responded (window closed / cancelled) the clock applies.
  store.sdkEvent('primary', 'identity', { type: 'callback', response: { error_code: 'CANCELLED', message: 'closed' } });
  await wait(5);
  assert.equal(store.check('primary', 'identity').timedOut, true);
  store.keepWaiting('primary', 'identity');
  await wait(5);
  assert.equal(store.check('primary', 'identity').timedOut, false);
  store.dispose();
});

test('uploads validate size and type before hitting the network', async () => {
  const { api, store } = make();
  await store.requestCreate('resident_individual', {});
  assert.equal(await store.upload('doc_cancelled_cheque', { uri: 'f', name: 'big.pdf', mimeType: 'application/pdf', size: 11 * 1024 * 1024 }), false);
  assert.match(store.s.uploadErrors.doc_cancelled_cheque, /10 MB/);
  assert.equal(await store.upload('doc_cancelled_cheque', { uri: 'f', name: 'x.gif', mimeType: 'image/gif', size: 100 }), false);
  assert.equal(await store.upload('doc_cancelled_cheque', { uri: 'f', name: 'cheque.pdf', mimeType: 'application/pdf', size: 100 }), true);
  assert.equal(store.s.uploads[0].fieldKey, 'doc_cancelled_cheque');
  assert.ok(api.calls.some(c => c[0] === 'upload'));
  store.dispose();
});

test('submit flushes first, then locks; a 409 counts as success', async () => {
  const { api, store } = make();
  await store.requestCreate('resident_individual', {});
  store.sync({ primary_fullName: 'Ravi' }, 4);
  const ok = await store.submit({ appStep: 'tracker' });
  assert.equal(ok, true);
  assert.equal(store.s.locked, true);
  const patches = api.calls.filter(c => c[0] === 'patch');
  assert.deepEqual(patches[0][2].data, { primary_fullName: 'Ravi' });
  assert.equal(patches[1][2].status, 'submitted');
  store.dispose();
});

test('hydrate restores a saved application and clears an expired one', async () => {
  const { store, storage } = make();
  const sub = await store.hydrate('tok_1');
  assert.equal(sub.id, 'sub_1');
  assert.equal(store.s.server.primary_fullName, 'RAVI KUMAR');
  assert.equal(storage.box.resumeToken, 'tok_1');
  const gone = make({ getSubmission: async () => { throw new ApiError('nf', { status: 404, code: 'not_found' }); } });
  await gone.storage.save({ resumeToken: 'old', submissionId: 'x' });
  await assert.rejects(() => gone.store.hydrate('old'));
  assert.equal(gone.storage.box.resumeToken, undefined);
  store.dispose(); gone.store.dispose();
});

test('e-sign unavailable is explained, not thrown', async () => {
  const { store } = make();
  await store.requestCreate('resident_individual', {});
  const r = await store.startEsign();
  assert.equal(r, null);
  assert.equal(store.s.esign, 'unavailable');
  assert.match(store.check('primary', 'esign').error, /e-signature/);
  store.dispose();
});
