import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  toBackendData, fromBackendData, accountTypeFor, lockedFieldsFor, docSlotsFor, resolveDocs,
  validateBegin, validateIdentity, validateNominees, validateDocs, dobToIso, formatDobInput, isoToDobDisplay,
  riskProfileFor, resumeStepFor, normalizeMobile, isAdult,
} from '../src/onboarding/mapping.js';

const base = () => ({
  step: 'identity', name: 'Ravi Kumar', email: 'Ravi@Example.com', mobile: '9876543210', dob: '17 / 04 / 1988', addr: '12 MG Road, Indiranagar, Bengaluru',
  pan: 'abcpk1234f', fatherName: '', aadhaar: '', type: 0, subRes: 0, entitySub: 0, res: 0, gender: 1, marital: 1, mobBel: 0, emailBel: 0, pep: 1,
  occ: 0, src: 0, income: 2, edu: 1, h2: false, h2Name: '', h2Email: '', h2Mobile: '', h2Pan: '', h2Dob: '', mode: 0,
  noms: [{ name: 'Priya', rel: 'Spouse', mob: '9876500000', alloc: '100', minor: false, guardian: '' }], nomOptOut: false,
  fee: 1, ans: [1, 2, 2, 1, 2, 1], manual: {},
});

test('projects app state to backend keys', () => {
  const d = toBackendData(base(), {});
  assert.equal(d.primary_fullName, 'Ravi Kumar');
  assert.equal(d.primary_email, 'ravi@example.com');
  assert.equal(d.primary_mobile, '9876543210');
  assert.equal(d.primary_dob, '1988-04-17');
  assert.equal(d.primary_pan, 'ABCPK1234F');
  assert.equal(d.primary_gender, 'male');
  assert.equal(d.residencyType, 'resident');
  assert.equal(d.numberOfHolders, 1);
  assert.equal(d.feeStructure, 'fixed_only');
  assert.equal(d.riskProfile, 'Moderate-Aggressive');
  assert.deepEqual(d.nominees, [{ name: 'Priya', relationship: 'Spouse', mobile: '9876500000', sharePct: 100, isMinor: false, guardianName: '' }]);
  assert.equal(d.appStep, 'identity');
});

test('never overwrites Digio-verified fields', () => {
  const server = { primary_kycVerifiedKeys: ['primary_fullName', 'primary_dob', 'primary_pan', 'primary_address'] };
  const d = toBackendData({ ...base(), name: 'Typed Over' }, server);
  assert.equal(d.primary_fullName, undefined);
  assert.equal(d.primary_dob, undefined);
  assert.equal(d.primary_pan, undefined);
  assert.equal(d.primary_address, undefined);
  assert.equal(d.primary_email, 'ravi@example.com');
  assert.deepEqual(lockedFieldsFor(server, 'primary'), { name: true, dob: true, pan: true, addr: true });
});

test('round-trips backend data into app state', () => {
  const d = toBackendData(base(), {});
  const ob = fromBackendData(d, { ...base(), name: '', email: '', mobile: '', dob: '', pan: '', gender: 0, fee: 0, ans: [null, null, null, null, null, null], noms: [] });
  assert.equal(ob.name, 'Ravi Kumar');
  assert.equal(ob.dob, '17 / 04 / 1988');
  assert.equal(ob.gender, 1);
  assert.equal(ob.fee, 1);
  assert.deepEqual(ob.ans, [1, 2, 2, 1, 2, 1]);
  assert.equal(ob.noms.length, 1);
  assert.equal(ob.noms[0].alloc, '100');
});

test('NRI and joint holder projection', () => {
  const ob = { ...base(), subRes: 1, res: 1, h2: true, h2Name: 'Anita', h2Mobile: '9111111111', h2Pan: 'abcpa1111a', mode: 1 };
  const d = toBackendData(ob, {});
  assert.equal(d.residencyType, 'nri');
  assert.equal(d.residencyDetail, 'nri');
  assert.equal(d.numberOfHolders, 2);
  assert.equal(d.modeOfOperation, 'jointly');
  assert.equal(d.second_fullName, 'Anita');
  assert.equal(d.second_pan, 'ABCPA1111A');
  const back = fromBackendData(d, base());
  assert.equal(back.h2, true);
  assert.equal(back.subRes, 1);
});

test('account type selection', () => {
  assert.equal(accountTypeFor({ type: 0 }), 'resident_individual');
  assert.equal(accountTypeFor({ type: 1 }), 'huf');
  assert.equal(accountTypeFor({ type: 2, entitySub: 2 }), 'llp');
});

test('document slots and resolution', () => {
  const slots = docSlotsFor({ accountType: 'resident_individual', nri: false, holders: 2, holderNames: ['Ravi', 'Anita'] });
  assert.deepEqual(slots.map(s => s.key), ['doc_pan_h1', 'doc_aadhaar_h1', 'doc_pan_h2', 'doc_aadhaar_h2', 'doc_cancelled_cheque']);
  const rows = resolveDocs(slots, [
    { id: 'u1', fieldKey: 'doc_pan_h1', source: 'digio' },
    { id: 'u2', fieldKey: 'doc_pan_h2', source: 'client', originalName: 'pan.pdf' },
  ], ['doc_aadhaar_h1', 'doc_cancelled_cheque']);
  assert.deepEqual(rows.map(r => r.state), ['fetched', 'fetched', 'uploaded', 'pending', 'waived']);
  const err = validateDocs(rows);
  assert.match(err, /Aadhaar card for Anita/);
  assert.equal(validateDocs(rows.map(r => ({ ...r, state: 'uploaded' }))), null);
  // The real backend reports one DigiLocker bundle key per holder; it covers PAN + Aadhaar.
  const bundled = resolveDocs(slots, [{ id: 'u9', fieldKey: 'doc_digilocker_bundle_h2', source: 'digio' }], ['doc_digilocker_bundle_h1']);
  assert.deepEqual(bundled.map(r => r.state), ['fetched', 'fetched', 'fetched', 'fetched', 'pending']);
});

test('validation catches the common mistakes', () => {
  assert.equal(validateBegin(base()), null);
  assert.match(validateBegin({ ...base(), mobile: '12345' }), /10 digits/);
  assert.match(validateBegin({ ...base(), email: 'nope' }), /email/);
  assert.equal(validateIdentity(base(), {}), null);
  assert.match(validateIdentity({ ...base(), pan: 'BAD' }, {}), /PAN/);
  assert.match(validateIdentity({ ...base(), dob: '17 / 04 / 2020' }, {}), /18 or older/);
  // A verified PAN/DOB is not re-validated from the typed field.
  assert.equal(validateIdentity({ ...base(), pan: '', dob: '' }, { primary_kycVerifiedKeys: ['primary_pan', 'primary_dob'] }), null);
  assert.match(validateNominees({ ...base(), noms: [{ name: 'A', rel: 'Son', alloc: '60' }, { name: 'B', rel: 'Daughter', alloc: '30' }] }), /90%/);
  assert.equal(validateNominees({ ...base(), noms: [], nomOptOut: true }), null);
});

test('dates, mobiles, risk and resume helpers', () => {
  assert.equal(formatDobInput('17041988'), '17 / 04 / 1988');
  assert.equal(dobToIso('31 / 02 / 1990'), null);
  assert.equal(isoToDobDisplay('1988-04-17'), '17 / 04 / 1988');
  assert.equal(isAdult('2000-01-01', new Date('2026-09-23')), true);
  assert.equal(normalizeMobile('+91 98765 43210'), '9876543210');
  assert.equal(riskProfileFor([0, 0, 0, 0, 0, 1]), 'Conservative');
  assert.equal(riskProfileFor([3, 3, 3, 3, 3, 3]), 'Aggressive');
  assert.equal(riskProfileFor([1, null, 1, 1, 1, 1]), null);
  assert.equal(resumeStepFor({ appStep: 'docs' }, 1, 'draft'), 'docs');
  assert.equal(resumeStepFor({}, 2, 'draft'), 'q');
  assert.equal(resumeStepFor({}, 3, 'draft'), 'docs');
  assert.equal(resumeStepFor({ appStep: 'docs' }, 1, 'submitted'), 'tracker');
  assert.equal(resumeStepFor({ appStep: 'q' }, 1, 'draft'), 'identity');
});
