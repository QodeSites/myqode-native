import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  toBackendData, fromBackendData, accountTypeFor, lockedFieldsFor, docSlotsFor, resolveDocs,
  validateBegin, validateIdentity, validateNominees, validateDocs, dobToIso, formatDobInput, isoToDobDisplay,
  riskProfileFor, resumeStepFor, normalizeMobile, isAdult, satisfiedFromServer,
  cleanName, isValidName, isValidEmail, isValidMobile, isValidPan, isIndividualPan, validateDob, hasPin, validateAmount,
} from '../src/onboarding/mapping.js';

const base = () => ({
  step: 'identity', name: 'Ravi Kumar', email: 'Ravi@Example.com', mobile: '9876543210', dob: '17 / 04 / 1988', addr: '12 MG Road, Indiranagar, Bengaluru 560038',
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
  assert.match(validateNominees({ ...base(), noms: [{ name: 'Asha Rao', rel: 'Son', alloc: '60' }, { name: 'Bela Rao', rel: 'Daughter', alloc: '30' }] }), /90%/);
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

test('document slots satisfied by a saved draft come from verified keys, digioDocKeys and the bank waiver', () => {
  const data = {
    primary_kycStatus: 'verified',
    primary_kycVerifiedKeys: ['primary_fullName', 'primary_pan', 'primary_aadhaarMasked', 'primary_kycStatus'],
    second_kycVerifiedKeys: ['second_pan'],
    digioDocKeys: ['doc_pan_h1', 'doc_digilocker_bundle_h3'],
    primary_bank_accountNumber: '1234',
  };
  assert.deepEqual(satisfiedFromServer(data).sort(), ['doc_aadhaar_h1', 'doc_cancelled_cheque', 'doc_digilocker_bundle_h3', 'doc_pan_h1', 'doc_pan_h2'].sort());
  assert.deepEqual(satisfiedFromServer({}), []);
  assert.deepEqual(satisfiedFromServer(null), []);
});

// ---- Field checks -------------------------------------------------------------------
test('names accept letters and common punctuation only', () => {
  assert.equal(cleanName('Ravi 123 Kumar!'), 'Ravi  Kumar');
  assert.equal(cleanName("D'Souza-Rao Jr."), "D'Souza-Rao Jr.");
  assert.equal(cleanName('x'.repeat(120)).length, 100);
  assert.equal(isValidName('Ravi Kumar'), true);
  assert.equal(isValidName('R'), false);
  assert.equal(isValidName('   '), false);
  assert.equal(isValidName('.-'), false);
});

test('emails need a real domain and no spaces', () => {
  assert.equal(isValidEmail('ravi.kumar+qode@example.co.in'), true);
  assert.equal(isValidEmail('ravi@example'), false);
  assert.equal(isValidEmail('ravi@@example.com'), false);
  assert.equal(isValidEmail('ra vi@example.com'), false);
  assert.equal(isValidEmail('ravi@exa mple.com'), false);
  assert.equal(isValidEmail('ravi@example..com'), false);
  assert.equal(isValidEmail('a@' + 'b'.repeat(250) + '.com'), false);
});

test('mobiles are 10 digits, start with 6-9 and are not a repeated digit', () => {
  assert.equal(isValidMobile('9876543210'), true);
  assert.equal(isValidMobile('+91 98765 43210'), true);
  assert.equal(isValidMobile('5876543210'), false);
  assert.equal(isValidMobile('9999999999'), false);
  assert.equal(isValidMobile('98765'), false);
});

test('PAN shape and holder type', () => {
  assert.equal(isValidPan('ABCPE1234F'), true);
  assert.equal(isValidPan('abcpe1234f'), true);
  assert.equal(isValidPan('ABCDE12345'), false);
  assert.equal(isIndividualPan('ABCPE1234F'), true);
  assert.equal(isIndividualPan('ABCCE1234F'), false);
  assert.equal(isIndividualPan('bad'), false);
});

test('date of birth must be a real date, an adult, and not impossibly old', () => {
  const now = new Date('2026-09-24');
  assert.equal(validateDob('17 / 04 / 1988', now), null);
  assert.match(validateDob('', now), /DD \/ MM \/ YYYY/);
  assert.match(validateDob('31 / 02 / 1990', now), /DD \/ MM \/ YYYY/);
  assert.match(validateDob('24 / 09 / 2010', now), /18 or older/);
  assert.match(validateDob('01 / 01 / 1890', now), /check the year/);
  assert.match(validateDob('01 / 01 / 2030', now), /18 or older/);
});

test('addresses carry a PIN code', () => {
  assert.equal(hasPin('12 MG Road, Bengaluru 560001'), true);
  assert.equal(hasPin('12 MG Road, Bengaluru'), false);
  assert.equal(hasPin('Flat 1234567 Road'), false);
});

test('investment amount respects the PMS minimum', () => {
  assert.equal(validateAmount(5000000), null);
  assert.equal(validateAmount(12500000), null);
  assert.match(validateAmount(4999999), /50,00,000/);
  assert.match(validateAmount(0), /50,00,000/);
  assert.match(validateAmount(NaN), /50,00,000/);
});

test('identity step enforces every field for both holders', () => {
  const ok = { ...base(), pan: 'ABCPK1234F', addr: '12 MG Road, Indiranagar, Bengaluru 560038' };
  assert.equal(validateIdentity(ok, {}), null);
  assert.match(validateIdentity({ ...ok, name: 'R2' }, {}), /name/i);
  assert.match(validateIdentity({ ...ok, pan: 'ABCCK1234F' }, {}), /individual/i);
  assert.match(validateIdentity({ ...ok, addr: '12 MG Road, Indiranagar' }, {}), /PIN/);
  assert.match(validateIdentity({ ...ok, dob: '01 / 01 / 1890' }, {}), /year/);
  const two = { ...ok, h2: true, h2Name: 'Anita Rao', h2Email: '', h2Mobile: '9111111111', h2Pan: 'ABCPA1111A', h2Dob: '01 / 01 / 1990' };
  assert.equal(validateIdentity(two, {}), null);
  assert.match(validateIdentity({ ...two, h2Email: 'nope', h2Mobile: '9111111111' }, {}), /email/i);
  assert.match(validateIdentity({ ...two, h2Pan: 'ABCPK1234F' }, {}), /same PAN/i);
  assert.match(validateIdentity({ ...two, h2Dob: '01 / 01 / 2015' }, {}), /18 or older/);
  assert.match(validateIdentity({ ...two, h2Dob: '' }, {}), /DD \/ MM \/ YYYY/);
});

test('nominee fields are checked individually', () => {
  const good = { ...base(), noms: [{ name: 'Anita Rao', rel: 'Spouse', mob: '', alloc: '100', minor: false, guardian: '' }] };
  assert.equal(validateNominees(good), null);
  assert.match(validateNominees({ ...good, noms: [{ ...good.noms[0], rel: 'Wife 2' }] }), /relationship/i);
  assert.match(validateNominees({ ...good, noms: [{ ...good.noms[0], mob: '12345' }] }), /mobile/i);
  assert.match(validateNominees({ ...good, noms: [{ ...good.noms[0], alloc: '0' }] }), /1 and 100/);
  assert.match(validateNominees({ ...good, noms: [{ ...good.noms[0], alloc: '100.5' }] }), /whole/);
  assert.match(validateNominees({ ...good, noms: [{ ...good.noms[0], minor: true, guardian: 'G' }] }), /guardian/i);
  assert.match(validateNominees({ ...good, noms: [{ ...good.noms[0], name: 'A1' }] }), /name/i);
});
