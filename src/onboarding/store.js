// OnboardingStore — the single owner of everything that talks to the backend
// during onboarding: lazy draft creation, debounced autosave with offline
// retry, Digio verification polling, uploads, submit and resume.
//
// It is framework-agnostic: main.js hands it an onChange callback and reads
// `store.s` (a plain snapshot) when computing view values. The api/storage
// modules are injectable so the logic can be unit-tested in node.
import { isOffline } from './http.js';
import { satisfiedFromServer } from './mapping.js';
import { TIMINGS, UPLOAD } from './config.js';

const KYC_DONE = ['approved', 'success', 'approval_pending'];
const KYC_FAILED = ['rejected', 'failed', 'expired'];
const ESIGN_DONE = ['completed', 'signed', 'approved'];

const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

export function initialState() {
  return {
    id: null, resumeToken: null, accountType: null, status: 'none', locked: false,
    server: {}, uploads: [], satisfied: [], checks: {}, esign: null,
    digio: 'unknown', digioMessage: null,
    progress: null, submittedAt: null, currentStep: 0,
    saveState: 'idle', saving: false, saveError: null, lastSavedAt: null, retryAt: null,
    offline: false,
    creating: false, createError: null,
    hydrating: false, hydrateError: null,
    submitting: false, submitError: null,
    uploading: {}, uploadErrors: {},
    notice: null,
    saved: null,
  };
}

export const FRIENDLY = {
  sdk_load_failed: 'We couldn’t load the verification window. Check your connection and try again.',
  sdk_missing: 'The verification window didn’t start properly. Please try again.',
  rejected: 'The verification was not approved. You can upload your documents instead and our team will review them.',
  failed: 'The verification didn’t complete. You can try again or upload your documents instead.',
  expired: 'The verification link expired. Start it again or upload your documents instead.',
  timeout: 'We haven’t heard back yet. You can keep waiting, or continue and upload your documents.',
};

export default class OnboardingStore {
  // api: the endpoint bindings (src/api/onboarding.js); storage: the secure
  // token store (src/onboarding/storage.js). Both are injected so this file
  // has no native imports and runs under plain node for tests.
  constructor({ onChange, api, storage, now }) {
    this.api = api;
    this.storage = storage;
    this.now = now || (() => Date.now());
    this.onChange = onChange || (() => {});
    this.s = initialState();
    this.pending = {};
    this.baseline = {};
    this.stepIndex = 0;
    this.wantCreate = null;
    this.inflight = null;
    this.again = false;
    this.retryCount = 0;
    this.t = { save: null, retry: null, notice: null, polls: {} };
    this.disposed = false;
  }

  // ---- plumbing -----------------------------------------------------------
  set(p) { if (this.disposed) return; this.s = { ...this.s, ...p }; this.onChange(this.s); }
  setCheck(key, p) { this.set({ checks: { ...this.s.checks, [key]: { ...(this.s.checks[key] || {}), ...p } } }); }
  notice(kind, text) {
    clearTimeout(this.t.notice);
    this.set({ notice: { kind, text, at: this.now() } });
    this.t.notice = setTimeout(() => this.set({ notice: null }), 4500);
  }
  clearNotice() { clearTimeout(this.t.notice); this.set({ notice: null }); }
  dispose() {
    this.disposed = true;
    clearTimeout(this.t.save); clearTimeout(this.t.retry); clearTimeout(this.t.notice);
    Object.values(this.t.polls).forEach(clearTimeout);
  }
  hasSubmission() { return !!this.s.id; }
  hasUnsaved() { return Object.keys(this.pending).length > 0 || !!this.wantCreate; }

  // ---- saved session ------------------------------------------------------
  async loadSaved() {
    const saved = await this.storage.loadSaved();
    this.set({ saved });
    return saved;
  }
  async peekProgress(token) {
    try {
      const p = await this.api.getProgress(token);
      this.set({ progress: p });
      return p;
    } catch (e) {
      if (e.code === 'not_found') { await this.storage.clear(); this.set({ saved: null }); }
      return null;
    }
  }
  async forget() {
    await this.storage.clear();
    this.reset();
  }
  reset() {
    clearTimeout(this.t.save); clearTimeout(this.t.retry);
    Object.values(this.t.polls).forEach(clearTimeout); this.t.polls = {};
    this.pending = {}; this.baseline = {}; this.wantCreate = null; this.retryCount = 0; this.again = false;
    this.set({ ...initialState(), offline: this.s.offline, saved: null });
  }

  // ---- connectivity / lifecycle -------------------------------------------
  setOffline(off) {
    const was = this.s.offline;
    if (was === off) return;
    this.set({ offline: off, saveState: off && this.hasUnsaved() ? 'offline' : this.s.saveState });
    if (was && !off) { this.retryCount = 0; this.kick(); this.resumePolling(); }
  }
  onForeground() {
    this.retryCount = 0;
    this.kick();
    this.resumePolling();
    if (this.s.locked) this.refreshProgress();
  }
  onBackground() {
    Object.values(this.t.polls).forEach(clearTimeout); this.t.polls = {};
    if (this.hasUnsaved()) this.flush();
  }
  kick() {
    clearTimeout(this.t.retry);
    if (!this.s.id && this.wantCreate) return this.ensureCreate();
    return this.flush();
  }
  scheduleRetry() {
    const delay = Math.min(TIMINGS.saveRetryBaseMs * Math.pow(2, this.retryCount), TIMINGS.saveRetryMaxMs);
    this.retryCount += 1;
    clearTimeout(this.t.retry);
    this.t.retry = setTimeout(() => this.kick(), delay);
    this.set({ retryAt: this.now() + delay });
  }

  // ---- draft creation -----------------------------------------------------
  // Called once the account type is known. Creation is queued and retried
  // automatically, so the investor keeps filling the form even when the
  // first attempt fails.
  requestCreate(accountType, data) {
    if (this.s.id && this.s.accountType === accountType) return Promise.resolve(this.s.id);
    if (this.s.id && this.s.accountType !== accountType) {
      // Account type is fixed at creation on the backend: start a fresh draft
      // and mark the old one so ops can tell it was superseded.
      const oldId = this.s.id;
      this.api.patchSubmission(oldId, { data: { supersededInApp: true } }).catch(() => {});
      Object.values(this.t.polls).forEach(clearTimeout); this.t.polls = {};
      this.pending = {}; this.baseline = {};
      this.set({ id: null, resumeToken: null, accountType: null, status: 'none', uploads: [], satisfied: [], checks: {}, server: {}, saveState: 'idle' });
    }
    this.wantCreate = { accountType, data: data || {} };
    return this.ensureCreate();
  }
  async ensureCreate() {
    if (this.s.id || !this.wantCreate || this.s.creating) return this.s.id;
    this.set({ creating: true, createError: null });
    const { accountType, data } = this.wantCreate;
    const initial = { ...data, ...this.pending };
    try {
      const res = await this.api.createSubmission(accountType, initial);
      this.baseline = { ...initial };
      this.pending = {};
      this.wantCreate = null;
      this.retryCount = 0;
      const saved = { resumeToken: res.resumeToken, submissionId: res.id };
      await this.storage.save(saved);
      this.set({
        id: res.id, resumeToken: res.resumeToken, accountType, status: 'draft', locked: false,
        creating: false, createError: null, server: { ...initial }, saveState: 'saved', lastSavedAt: this.now(), offline: false, saved,
      });
      return res.id;
    } catch (e) {
      const off = isOffline(e);
      this.set({ creating: false, createError: e.message, offline: off || this.s.offline, saveState: off ? 'offline' : 'error', saveError: e.message });
      if (e.retryable || off) this.scheduleRetry();
      return null;
    }
  }

  // ---- autosave -----------------------------------------------------------
  setBaseline(projection) { this.baseline = { ...projection }; this.pending = {}; }
  sync(projection, stepIndex) {
    if (this.s.locked) return;
    this.stepIndex = stepIndex;
    let dirty = false;
    Object.keys(projection).forEach(k => {
      if (eq(projection[k], this.baseline[k])) { if (k in this.pending) delete this.pending[k]; }
      else { if (!eq(this.pending[k], projection[k])) dirty = true; this.pending[k] = projection[k]; }
    });
    if (Object.keys(this.pending).length === 0) return;
    if (dirty && this.s.saveState !== 'saving') this.set({ saveState: this.s.offline ? 'offline' : 'dirty' });
    clearTimeout(this.t.save);
    this.t.save = setTimeout(() => this.flush(), TIMINGS.autosaveDebounceMs);
  }
  // Persist keys the form projection does not own (Digio check ids, digioDocKeys) the way the
  // web wizard does, so a resume can rebuild what a verification produced. They ride the next
  // autosave and never collide with sync(), which only touches projected keys.
  stash(patch) {
    Object.assign(this.pending, patch);
    if (this.s.id) { clearTimeout(this.t.save); this.t.save = setTimeout(() => this.flush(), 0); }
  }
  async flush() {
    clearTimeout(this.t.save);
    if (this.s.locked || this.disposed) return;
    if (!this.s.id) { if (this.wantCreate) await this.ensureCreate(); if (!this.s.id) return; }
    if (this.inflight) { this.again = true; return this.inflight; }
    if (Object.keys(this.pending).length === 0) return;
    const sent = this.pending;
    this.pending = {};
    this.set({ saving: true, saveState: 'saving' });
    this.inflight = (async () => {
      try {
        await this.api.patchSubmission(this.s.id, { data: sent, currentStep: this.stepIndex });
        this.baseline = { ...this.baseline, ...sent };
        this.retryCount = 0;
        this.set({
          saving: false, saveError: null, offline: false, retryAt: null, lastSavedAt: this.now(),
          saveState: Object.keys(this.pending).length ? 'dirty' : 'saved',
          server: { ...this.s.server, ...sent },
        });
      } catch (e) {
        this.pending = { ...sent, ...this.pending };
        if (e.code === 'locked') { this.markLocked(); this.notice('warn', e.message); }
        else if (e.code === 'not_found') { this.set({ saving: false, saveState: 'error', saveError: e.message }); this.notice('err', e.message); }
        else {
          const off = isOffline(e);
          this.set({ saving: false, saveState: off ? 'offline' : 'error', saveError: e.message, offline: off || this.s.offline });
          this.scheduleRetry();
        }
      } finally {
        this.inflight = null;
        if (this.again) { this.again = false; clearTimeout(this.t.save); this.t.save = setTimeout(() => this.flush(), 200); }
      }
    })();
    return this.inflight;
  }
  markLocked() {
    this.pending = {};
    this.set({ locked: true, status: 'submitted', saveState: 'saved', saving: false, submitting: false });
  }

  // ---- resume -------------------------------------------------------------
  async hydrate(token) {
    this.set({ hydrating: true, hydrateError: null });
    try {
      const sub = await this.api.getSubmission(token);
      const server = sub.data || {};
      const saved = { resumeToken: sub.resumeToken, submissionId: sub.id };
      await this.storage.save(saved);
      this.pending = {}; this.baseline = {}; this.wantCreate = null;
      this.set({
        hydrating: false, id: sub.id, resumeToken: sub.resumeToken, accountType: sub.accountType,
        status: sub.status, locked: sub.status === 'submitted', server, uploads: sub.uploads || [],
        satisfied: satisfiedFromServer(server),
        checks: {}, saved, currentStep: sub.currentStep || 0, submittedAt: sub.submittedAt || null,
        saveState: 'saved', createError: null, saveError: null,
      });
      if (sub.status !== 'submitted') await this.catchUp(server);
      if (sub.status === 'submitted') this.refreshProgress();
      return sub;
    } catch (e) {
      this.set({ hydrating: false, hydrateError: e.message, offline: isOffline(e) || this.s.offline });
      if (e.code === 'not_found') { await this.storage.clear(); this.set({ saved: null }); }
      throw e;
    }
  }
  async refreshUploads() {
    if (!this.s.id) return;
    try {
      const sub = await this.api.getSubmission(this.s.id);
      this.set({ uploads: sub.uploads || [], server: { ...this.s.server, ...(sub.data || {}) }, status: sub.status, locked: sub.status === 'submitted' || this.s.locked });
    } catch (e) { /* best effort */ }
  }
  async refreshProgress() {
    if (!this.s.id) return null;
    try { const p = await this.api.getProgress(this.s.id); this.set({ progress: p }); return p; } catch (e) { return null; }
  }

  // One quiet poll per check id the draft remembers (the web wizard's syncOnce): a verification
  // that finished after the app was closed is applied; anything unfinished is left alone. Checks
  // whose result is already on the draft are skipped — each poll costs a Digio round trip.
  async catchUp(server) {
    const ids = [];
    ['primary', 'second', 'third'].forEach(p => {
      if (server[`${p}_kycCheckId`] && server[`${p}_kycStatus`] !== 'verified') ids.push(server[`${p}_kycCheckId`]);
      if (server[`${p}_bankCheckId`] && !server[`${p}_bank_accountNumber`]) ids.push(server[`${p}_bankCheckId`]);
    });
    for (const id of ids) {
      try {
        const r = await this.api.getKyc(id);
        if (KYC_DONE.includes(r.status)) this.applyDone(r);
      } catch (e) { /* best effort — the investor can verify again */ }
    }
  }
  // Merge a finished check into the draft: verified fields, the document slots it satisfies,
  // and (persisted, like the web wizard's digioDocKeys) so a resume keeps them.
  applyDone(r) {
    const extracted = r.extracted || {};
    const docKeys = r.docKeys || [];
    const server = { ...this.s.server, ...extracted };
    const satisfied = Array.from(new Set([...(this.s.satisfied || []), ...docKeys]));
    this.set({ server, satisfied });
    const known = Array.isArray(server.digioDocKeys) ? server.digioDocKeys : [];
    const merged = Array.from(new Set([...known, ...docKeys]));
    if (merged.length !== known.length) this.stash({ digioDocKeys: merged });
    this.refreshUploads();
  }

  // ---- Digio verification -------------------------------------------------
  static checkKey(subject, purpose) { return `${subject}_${purpose}`; }
  check(subject, purpose) { return this.s.checks[OnboardingStore.checkKey(subject, purpose)] || null; }

  async startVerification(subject, purpose) {
    const key = OnboardingStore.checkKey(subject, purpose);
    const prev = this.s.checks[key] || {};
    if (prev.done) return prev;
    if (this.s.locked) { this.notice('warn', 'This application has been submitted and can no longer be changed.'); return null; }
    this.setCheck(key, { key, subject, purpose, kind: 'kyc', starting: true, error: null, errorCode: null, sdkError: null, failed: false, timedOut: false, slow: false });
    await this.flush();
    if (!this.s.id) {
      this.setCheck(key, { starting: false, error: this.s.offline ? 'You appear to be offline. Reconnect to verify online, or upload your documents instead.' : 'We couldn’t start your application on our server yet. Try again in a moment.', errorCode: 'no_submission' });
      return null;
    }
    try {
      const p = await this.api.startKyc(this.s.id, subject, purpose);
      const check = {
        key, subject, purpose, kind: 'kyc', ...p, startedAt: this.now(), lastPolledAt: null, attempt: (prev.attempt || 0) + 1,
        done: false, failed: false, slow: false, timedOut: false, starting: false, error: null, errorCode: null, sdkError: null,
        opened: false, sdkResponded: false, sdkCancelled: false, extracted: {}, docKeys: [],
      };
      this.set({ digio: 'enabled', digioMessage: null, checks: { ...this.s.checks, [key]: check } });
      // Remembered on the draft so a resume can catch up on the outcome (see catchUp).
      this.stash({ [`${subject}_${purpose === 'bank' ? 'bankCheckId' : 'kycCheckId'}`]: p.checkId });
      this.startPolling(key);
      return check;
    } catch (e) {
      let msg = e.message;
      if (e.code === 'unavailable') {
        this.set({ digio: 'disabled', digioMessage: e.message });
        msg = 'Online verification isn’t available right now. You can upload your documents instead — nothing else changes.';
      } else if (e.code === 'locked') { this.markLocked(); }
      else if (isOffline(e)) { this.set({ offline: true }); msg = 'You appear to be offline. Reconnect to verify online, or upload your documents instead.'; }
      this.setCheck(key, { starting: false, error: msg, errorCode: e.code });
      return null;
    }
  }
  async retryVerification(subject, purpose) {
    const key = OnboardingStore.checkKey(subject, purpose);
    clearTimeout(this.t.polls[key]);
    const prev = this.s.checks[key] || {};
    const checks = { ...this.s.checks }; delete checks[key];
    this.set({ checks });
    this.setCheck(key, { attempt: prev.attempt || 0 });
    return this.startVerification(subject, purpose);
  }
  // After a client-side timeout the investor may choose to keep waiting:
  // restart the clock and the poll loop on the same Digio request.
  keepWaiting(subject, purpose) {
    const key = OnboardingStore.checkKey(subject, purpose);
    const c = this.s.checks[key];
    if (!c || !c.checkId) return;
    this.setCheck(key, { timedOut: false, slow: false, error: null, startedAt: this.now() });
    this.startPolling(key);
  }
  dismissCheck(subject, purpose) {
    const key = OnboardingStore.checkKey(subject, purpose);
    clearTimeout(this.t.polls[key]);
    const checks = { ...this.s.checks }; delete checks[key];
    this.set({ checks });
  }
  isActive(c) { return c && c.checkId && !c.done && !c.failed && !c.timedOut; }
  resumePolling() {
    Object.keys(this.s.checks).forEach(key => { if (this.isActive(this.s.checks[key])) this.startPolling(key); });
  }
  startPolling(key) {
    clearTimeout(this.t.polls[key]);
    this.tick(key);
  }
  pollNow(key) { this.startPolling(key); }
  async tick(key) {
    const c = this.s.checks[key];
    if (!c || !this.isActive(c) || this.disposed) return;
    const schedule = (ms) => { clearTimeout(this.t.polls[key]); this.t.polls[key] = setTimeout(() => this.tick(key), ms); };
    try {
      const r = c.kind === 'esign' ? await this.api.getEsign(c.checkId) : await this.api.getKyc(c.checkId);
      const elapsed = this.now() - c.startedAt;
      const doneList = c.kind === 'esign' ? ESIGN_DONE : KYC_DONE;
      const upd = { status: r.status, mock: r.mock ?? c.mock, lastPolledAt: this.now(), slow: elapsed > TIMINGS.slowAfterMs, error: null };
      if (doneList.includes(r.status)) {
        upd.done = true; upd.slow = false;
        upd.extracted = r.extracted || {}; upd.docKeys = r.docKeys || [];
        this.applyDone(r);
        this.setCheck(key, upd);
        this.notice('ok', c.kind === 'esign' ? 'Agreement signed.' : (c.purpose === 'bank' ? 'Bank account verified.' : 'Identity verified.'));
        return;
      }
      if (KYC_FAILED.includes(r.status)) {
        upd.failed = true; upd.error = FRIENDLY[r.status] || FRIENDLY.failed;
        this.setCheck(key, upd);
        return;
      }
      // Never time out while the Digio window is open and the investor may
      // still be mid-flow (OTP, selfie); the slow banner covers that case.
      const midFlow = c.opened && !c.sdkResponded && !c.sdkError;
      if (elapsed > TIMINGS.giveUpAfterMs && !midFlow) {
        upd.timedOut = true; upd.error = FRIENDLY.timeout;
        this.setCheck(key, upd);
        return;
      }
      this.setCheck(key, upd);
      schedule(TIMINGS.pollIntervalMs);
    } catch (e) {
      if (e.code === 'not_found') { this.setCheck(key, { failed: true, error: 'This verification is no longer available. Start it again or upload your documents.' }); return; }
      if (e.code === 'locked') { this.markLocked(); return; }
      if (isOffline(e)) this.set({ offline: true });
      this.setCheck(key, { lastPolledAt: this.now(), slow: (this.now() - c.startedAt) > TIMINGS.slowAfterMs });
      schedule(isOffline(e) ? TIMINGS.pollIntervalMs * 3 : TIMINGS.pollIntervalMs);
    }
  }
  // Messages from the WebView bridge (src/onboarding/digio-html.js) and the Digio exit
  // redirect the sheet intercepts (screens/verify.js → parseDigioReturn).
  //   opened   — our page is up and has handed over to Digio; clears any earlier outcome.
  //   return   — Digio's exit page navigated to our return URL: status=success|cancel,
  //              message, and error_code=TERMINATED on a hard failure (not a user cancel).
  //   callback — the SDK callback (popup/iframe modes only; kept for completeness).
  //   error    — the page could not load or start the SDK.
  //   loading / log — informational, never change the outcome.
  sdkEvent(subject, purpose, msg) {
    const key = OnboardingStore.checkKey(subject, purpose);
    const c = this.s.checks[key];
    if (!c || !msg) return;
    if (msg.type === 'opened') { this.setCheck(key, { opened: true, sdkResponded: false, sdkError: null, sdkCancelled: false }); return; }
    if (msg.type === 'callback') {
      const r = msg.response || {};
      const failedInSdk = !!r.error_code;
      this.setCheck(key, { sdkResponded: true, sdkError: failedInSdk ? (r.message || 'The verification was not completed.') : null, sdkCancelled: r.error_code === 'CANCELLED' });
      this.pollNow(key);
      return;
    }
    if (msg.type === 'return') {
      const ok = msg.status === 'success' && !msg.errorCode;
      this.setCheck(key, {
        sdkResponded: true,
        sdkError: ok ? null : (msg.message || 'The verification was not completed.'),
        sdkCancelled: !ok && !msg.errorCode,
      });
      this.pollNow(key);
      return;
    }
    if (msg.type === 'error') {
      this.setCheck(key, { sdkError: FRIENDLY[msg.message] || 'The verification window ran into a problem. You can try again or upload your documents instead.', sdkCancelled: false });
    }
  }

  // ---- e-sign (dormant until the backend template exists) -----------------
  async startEsign() {
    const key = OnboardingStore.checkKey('primary', 'esign');
    if (this.s.locked === false) await this.flush();
    if (!this.s.id) return null;
    this.setCheck(key, { key, subject: 'primary', purpose: 'esign', kind: 'esign', starting: true, error: null });
    try {
      const p = await this.api.startEsign(this.s.id);
      const check = { key, subject: 'primary', purpose: 'esign', kind: 'esign', ...p, startedAt: this.now(), done: false, failed: false, slow: false, timedOut: false, starting: false, error: null, sdkError: null, extracted: {}, docKeys: [] };
      this.set({ checks: { ...this.s.checks, [key]: check }, esign: 'available' });
      this.startPolling(key);
      return check;
    } catch (e) {
      const unavailable = e.code === 'unavailable';
      this.set({ esign: unavailable ? 'unavailable' : this.s.esign });
      this.setCheck(key, { starting: false, error: unavailable ? 'Your PMS agreement will be sent to your email for e-signature once it is ready.' : e.message, errorCode: e.code });
      return null;
    }
  }

  // ---- uploads ------------------------------------------------------------
  validateFile(file) {
    const size = file.size ?? file.fileSize ?? 0;
    if (size > UPLOAD.maxBytes) return 'That file is larger than 10 MB. Try a smaller photo or a compressed PDF.';
    const mime = (file.mimeType || '').toLowerCase();
    if (mime && !UPLOAD.allowedMime.includes(mime)) return 'Please use a PDF, PNG, JPG or WebP file.';
    return null;
  }
  async upload(fieldKey, file) {
    if (this.s.locked) { this.notice('warn', 'This application has been submitted and can no longer be changed.'); return false; }
    const bad = this.validateFile(file);
    const errs = { ...this.s.uploadErrors };
    if (bad) { errs[fieldKey] = bad; this.set({ uploadErrors: errs }); return false; }
    await this.flush();
    if (!this.s.id) {
      errs[fieldKey] = this.s.offline ? 'You appear to be offline. Reconnect and try the upload again.' : 'We couldn’t reach our server to save this yet. Try again in a moment.';
      this.set({ uploadErrors: errs });
      return false;
    }
    delete errs[fieldKey];
    this.set({ uploading: { ...this.s.uploading, [fieldKey]: true }, uploadErrors: errs });
    try {
      const r = await this.api.uploadDocument(this.s.id, fieldKey, file);
      const up = { id: r.upload.id, fieldKey, originalName: r.upload.originalName || file.name, sizeBytes: r.upload.sizeBytes || file.size, mimeType: file.mimeType, source: 'client', createdAt: new Date(this.now()).toISOString() };
      const uploads = this.s.uploads.filter(u => u.fieldKey !== fieldKey).concat(up);
      const uploading = { ...this.s.uploading }; delete uploading[fieldKey];
      this.set({ uploads, uploading });
      this.notice('ok', `${file.name || 'File'} uploaded.`);
      return true;
    } catch (e) {
      const uploading = { ...this.s.uploading }; delete uploading[fieldKey];
      if (e.code === 'locked') this.markLocked();
      this.set({ uploading, uploadErrors: { ...this.s.uploadErrors, [fieldKey]: e.message }, offline: isOffline(e) || this.s.offline });
      return false;
    }
  }
  clearUploadError(fieldKey) { const e = { ...this.s.uploadErrors }; delete e[fieldKey]; this.set({ uploadErrors: e }); }

  // ---- submit -------------------------------------------------------------
  async submit(finalData) {
    if (this.s.locked) return true;
    if (this.s.submitting) return false;
    this.set({ submitting: true, submitError: null });
    await this.flush();
    if (!this.s.id) {
      this.set({ submitting: false, submitError: this.s.offline ? 'You appear to be offline. Reconnect and tap Submit again — everything you entered is kept.' : 'We couldn’t reach our server. Please try again in a moment.' });
      return false;
    }
    if (Object.keys(this.pending).length) {
      this.set({ submitting: false, submitError: 'We couldn’t save your latest changes. Check your connection and tap Submit again.' });
      return false;
    }
    try {
      await this.api.patchSubmission(this.s.id, { status: 'submitted', currentStep: this.stepIndex, data: finalData || {} });
      this.markLocked();
      this.set({ submittedAt: new Date(this.now()).toISOString() });
      this.refreshProgress();
      return true;
    } catch (e) {
      if (e.code === 'locked') { this.markLocked(); return true; }
      this.set({ submitting: false, submitError: e.message, offline: isOffline(e) || this.s.offline });
      return false;
    }
  }
}
