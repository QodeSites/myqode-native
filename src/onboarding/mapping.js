// Pure mapping between the app's onboarding state (`ob` in main.js) and the
// backend's flat Submission.data blob (keys like primary_fullName). No React
// or native imports here so it can be unit-tested with plain node.
//
// VOCABULARY NOTE: the coded values below (e.g. 'salaried', 'below_25_lakh')
// are the single place to align with the web form's option values in
// lib/form-config.ts. Change them here and nothing else needs to move.

export const ACCOUNT_TYPES = {
  individual: 'resident_individual',
  huf: 'huf',
  entity: ['private_limited', 'public_limited', 'llp', 'partnership', 'trust'],
};
export const ENTITY_LABELS = ['Private Ltd', 'Public Ltd', 'LLP', 'Partnership', 'Trust'];
export const RES_CODES = ['resident', 'nri', 'oci', 'pio'];

const V = {
  gender: ['female', 'male', 'other'],
  marital: ['single', 'married', 'other'],
  belongs: ['self', 'spouse'],
  pep: ['yes', 'no'],
  occ: ['salaried', 'business', 'professional', 'retired'],
  src: ['salary', 'business_income', 'investments', 'inheritance'],
  income: ['below_25_lakh', '25_lakh_to_1_crore', '1_to_5_crore', 'above_5_crore'],
  edu: ['graduate', 'post_graduate', 'professional', 'other'],
  fee: ['hybrid', 'fixed_only', 'performance_only'],
  mode: ['single', 'jointly'],
};

export const HOLDER_PREFIX = ['primary', 'second', 'third'];

// backend key suffix -> app field (holder 1) / holder 2 field
const LOCKABLE = {
  fullName: ['name', 'h2Name'],
  dob: ['dob', 'h2Dob'],
  gender: ['gender', null],
  address: ['addr', null],
  fatherName: ['fatherName', null],
  pan: ['pan', 'h2Pan'],
  aadhaarMasked: ['aadhaar', null],
};

const idx = (list, code, fallback) => { const i = list.indexOf(code); return i === -1 ? fallback : i; };
const clean = s => (s == null ? '' : String(s)).trim();

export function accountTypeFor(ob) {
  if (ob.type === 1) return ACCOUNT_TYPES.huf;
  if (ob.type === 2) return ACCOUNT_TYPES.entity[ob.entitySub || 0];
  return ACCOUNT_TYPES.individual;
}
export function accountLabelFor(accountType) {
  const map = {
    resident_individual: 'Individual', non_resident_individual: 'Individual · NRI', huf: 'HUF',
    private_limited: 'Private Ltd', public_limited: 'Public Ltd', llp: 'LLP', partnership: 'Partnership', trust: 'Trust',
  };
  return map[accountType] || 'Individual';
}
export function isIndividual(accountType) { return accountType === 'resident_individual' || accountType === 'non_resident_individual'; }

// Mobile: keep 10 digits. Accepts "+91 98765 43210" too.
export function normalizeMobile(s) {
  const d = clean(s).replace(/\D/g, '');
  return d.length > 10 ? d.slice(-10) : d;
}
export function isValidMobile(s) { return /^[6-9]\d{9}$/.test(normalizeMobile(s)); }
export function isValidEmail(s) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(clean(s)); }
export function isValidPan(s) { return /^[A-Z]{5}[0-9]{4}[A-Z]$/.test(clean(s).toUpperCase()); }

// DOB in the app is typed as digits and displayed "DD / MM / YYYY".
export function formatDobInput(raw) {
  const d = clean(raw).replace(/\D/g, '').slice(0, 8);
  const parts = [d.slice(0, 2), d.slice(2, 4), d.slice(4, 8)].filter(Boolean);
  return parts.join(' / ');
}
export function dobToIso(display) {
  const d = clean(display).replace(/\D/g, '');
  if (d.length !== 8) return null;
  const dd = +d.slice(0, 2), mm = +d.slice(2, 4), yy = +d.slice(4, 8);
  const dt = new Date(Date.UTC(yy, mm - 1, dd));
  if (dt.getUTCFullYear() !== yy || dt.getUTCMonth() !== mm - 1 || dt.getUTCDate() !== dd) return null;
  return `${yy}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
}
export function isoToDobDisplay(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(clean(iso));
  if (!m) return '';
  return `${m[3]} / ${m[2]} / ${m[1]}`;
}
export function isAdult(iso, now = new Date()) {
  if (!iso) return false;
  const [y, m, d] = iso.split('-').map(Number);
  const cutoff = new Date(Date.UTC(now.getUTCFullYear() - 18, now.getUTCMonth(), now.getUTCDate()));
  return Date.UTC(y, m - 1, d) <= cutoff.getTime();
}

export function riskProfileFor(ans) {
  if (!ans || ans.some(a => a == null)) return null;
  const score = ans.reduce((s, a) => s + a, 0);
  if (score <= 4) return 'Conservative';
  if (score <= 8) return 'Moderate';
  if (score <= 13) return 'Moderate-Aggressive';
  return 'Aggressive';
}

export function nomineesFor(ob) {
  return (ob.noms || []).map(n => ({
    name: clean(n.name), relationship: clean(n.rel), mobile: normalizeMobile(n.mob),
    sharePct: parseInt(n.alloc, 10) || 0, isMinor: !!n.minor, guardianName: n.minor ? clean(n.guardian) : '',
  }));
}

// Backend keys that Digio verified for a holder -> which app fields are locked.
export function lockedFieldsFor(server, prefix = 'primary') {
  const keys = (server && server[`${prefix}_kycVerifiedKeys`]) || [];
  const holder = prefix === 'primary' ? 0 : 1;
  const locked = {};
  keys.forEach(k => {
    const suffix = k.startsWith(prefix + '_') ? k.slice(prefix.length + 1) : k;
    const f = LOCKABLE[suffix] && LOCKABLE[suffix][holder];
    if (f) locked[f] = true;
  });
  return locked;
}

export function verifiedSummary(server, prefix = 'primary') {
  if (!server) return null;
  const g = k => server[`${prefix}_${k}`];
  return {
    verified: g('kycStatus') === 'verified',
    fullName: g('fullName') || '', pan: g('pan') || '', aadhaar: g('aadhaarMasked') || '',
    dob: isoToDobDisplay(g('dob')), gender: g('gender') || '', fatherName: g('fatherName') || '',
    address: g('address') || '', faceMatch: g('faceMatchScore'),
    bank: g('bank_accountNumber') ? {
      accountNumber: String(g('bank_accountNumber')), ifsc: g('bank_ifsc') || '', bankName: g('bank_name') || '',
      beneficiary: g('bank_beneficiaryName') || '',
    } : null,
  };
}

export function maskAccount(n) {
  const s = clean(n);
  return s.length > 4 ? '•••• ' + s.slice(-4) : s;
}

// Full projection of app state to backend keys. Locked (Digio-verified)
// fields and anything the app never owns (kyc*, bank_*) are excluded.
export function toBackendData(ob, server) {
  const d = {};
  const locked = lockedFieldsFor(server, 'primary');
  const locked2 = lockedFieldsFor(server, 'second');
  const put = (k, v, lockField, lockSet) => { if (lockField && lockSet && lockSet[lockField]) return; if (v !== undefined) d[k] = v; };

  const individual = ob.type === 0;
  const nri = individual && ob.subRes > 0;
  d.residencyType = nri ? 'nri' : 'resident';
  d.residencyDetail = individual ? RES_CODES[ob.subRes] || 'resident' : 'resident';
  d.numberOfHolders = ob.h2 ? 2 : 1;
  d.modeOfOperation = ob.h2 ? V.mode[ob.mode] || 'single' : 'single';

  put('primary_fullName', clean(ob.name), 'name', locked);
  d.primary_email = clean(ob.email).toLowerCase();
  d.primary_mobile = normalizeMobile(ob.mobile);
  const iso = dobToIso(ob.dob);
  if (iso) put('primary_dob', iso, 'dob', locked);
  put('primary_gender', V.gender[ob.gender], 'gender', locked);
  d.primary_maritalStatus = V.marital[ob.marital];
  put('primary_address', clean(ob.addr), 'addr', locked);
  if (clean(ob.pan)) put('primary_pan', clean(ob.pan).toUpperCase(), 'pan', locked);
  if (clean(ob.fatherName)) put('primary_fatherName', clean(ob.fatherName), 'fatherName', locked);
  d.primary_mobileBelongsTo = V.belongs[ob.mobBel];
  d.primary_emailBelongsTo = V.belongs[ob.emailBel];
  d.primary_pep = V.pep[ob.pep];
  d.primary_occupation = V.occ[ob.occ];
  d.primary_sourceOfFund = V.src[ob.src];
  d.primary_grossIncome = V.income[ob.income];
  d.primary_education = V.edu[ob.edu];

  if (ob.h2) {
    put('second_fullName', clean(ob.h2Name), 'h2Name', locked2);
    d.second_email = clean(ob.h2Email).toLowerCase();
    d.second_mobile = normalizeMobile(ob.h2Mobile);
    if (clean(ob.h2Pan)) put('second_pan', clean(ob.h2Pan).toUpperCase(), 'h2Pan', locked2);
    const iso2 = dobToIso(ob.h2Dob);
    if (iso2) put('second_dob', iso2, 'h2Dob', locked2);
  }

  d.nominees = nomineesFor(ob);
  d.nomineeOptOut = !!ob.nomOptOut;
  d.feeStructure = V.fee[ob.fee];
  d.riskAnswers = (ob.ans || []).slice();
  const rp = riskProfileFor(ob.ans);
  if (rp) d.riskProfile = rp;
  d.appStep = ob.step;
  d.appClient = 'myqode-native';
  return d;
}

// Backend blob -> partial app state (only keys present on the server).
export function fromBackendData(data, defaults) {
  const ob = { ...defaults };
  if (!data) return ob;
  const has = k => data[k] !== undefined && data[k] !== null && data[k] !== '';
  if (has('primary_fullName')) ob.name = data.primary_fullName;
  if (has('primary_email')) ob.email = data.primary_email;
  if (has('primary_mobile')) ob.mobile = normalizeMobile(data.primary_mobile);
  if (has('primary_dob')) ob.dob = isoToDobDisplay(data.primary_dob);
  if (has('primary_gender')) ob.gender = idx(V.gender, data.primary_gender, ob.gender);
  if (has('primary_maritalStatus')) ob.marital = idx(V.marital, data.primary_maritalStatus, ob.marital);
  if (has('primary_address')) ob.addr = data.primary_address;
  if (has('primary_pan')) ob.pan = data.primary_pan;
  if (has('primary_fatherName')) ob.fatherName = data.primary_fatherName;
  if (has('primary_aadhaarMasked')) ob.aadhaar = data.primary_aadhaarMasked;
  if (has('primary_mobileBelongsTo')) ob.mobBel = idx(V.belongs, data.primary_mobileBelongsTo, ob.mobBel);
  if (has('primary_emailBelongsTo')) ob.emailBel = idx(V.belongs, data.primary_emailBelongsTo, ob.emailBel);
  if (has('primary_pep')) ob.pep = idx(V.pep, data.primary_pep, ob.pep);
  if (has('primary_occupation')) ob.occ = idx(V.occ, data.primary_occupation, ob.occ);
  if (has('primary_sourceOfFund')) ob.src = idx(V.src, data.primary_sourceOfFund, ob.src);
  if (has('primary_grossIncome')) ob.income = idx(V.income, data.primary_grossIncome, ob.income);
  if (has('primary_education')) ob.edu = idx(V.edu, data.primary_education, ob.edu);
  if (has('residencyDetail')) ob.subRes = idx(RES_CODES, data.residencyDetail, ob.subRes);
  else if (has('residencyType')) ob.subRes = data.residencyType === 'nri' ? 1 : 0;
  ob.res = ob.subRes > 0 ? 1 : 0;
  if (data.numberOfHolders >= 2 || has('second_fullName')) {
    ob.h2 = true;
    ob.h2Name = data.second_fullName || '';
    ob.h2Email = data.second_email || '';
    ob.h2Mobile = normalizeMobile(data.second_mobile || '');
    ob.h2Pan = data.second_pan || '';
    ob.h2Dob = isoToDobDisplay(data.second_dob);
    ob.mode = idx(V.mode, data.modeOfOperation, ob.mode);
  }
  if (Array.isArray(data.nominees)) {
    ob.noms = data.nominees.map(n => ({
      name: n.name || '', rel: n.relationship || '', mob: n.mobile || '', alloc: String(n.sharePct ?? 0),
      minor: !!n.isMinor, guardian: n.guardianName || '',
    }));
  }
  if (typeof data.nomineeOptOut === 'boolean') ob.nomOptOut = data.nomineeOptOut;
  if (has('feeStructure')) ob.fee = idx(V.fee, data.feeStructure, ob.fee);
  if (Array.isArray(data.riskAnswers) && data.riskAnswers.length === 6) ob.ans = data.riskAnswers.map(a => (a == null ? null : a));
  if (has('appStep')) ob.step = data.appStep;
  return ob;
}

export function accountTypeToOb(accountType, ob) {
  if (accountType === 'huf') return { ...ob, type: 1 };
  const e = ACCOUNT_TYPES.entity.indexOf(accountType);
  if (e >= 0) return { ...ob, type: 2, entitySub: e };
  return { ...ob, type: 0 };
}

// App step -> the web wizard's coarse step index. The dev backend reports
// totalSteps = 4 for a resident individual (identity/bank verification,
// personal details, investment & risk, documents), so indices stay within 0..3.
export function stepIndexFor(step) {
  const m = { begin: 0, type: 0, identity: 1, fin: 1, noms: 1, q: 2, result: 2, fee: 2, docs: 3, review: 3, tracker: 3 };
  return m[step] ?? 0;
}

// Step the app should land on when resuming. Falls back from the web's
// currentStep when the app never recorded its own step.
export function resumeStepFor(data, currentStep, status) {
  if (status === 'submitted') return 'tracker';
  const valid = ['begin', 'type', 'identity', 'q', 'result', 'fee', 'fin', 'noms', 'docs', 'review'];
  if (data && valid.includes(data.appStep)) return data.appStep === 'q' ? 'identity' : data.appStep;
  return ['identity', 'identity', 'q', 'docs'][currentStep] || 'identity';
}

// Document slots. Keys for resident individuals are confirmed against the
// backend; NRI, HUF and entity keys follow the same naming convention and
// should be aligned with documentsStep() in the web's form-config.
export function docSlotsFor({ accountType, nri, holders, holderNames }) {
  const slots = [];
  const name = i => (holderNames && holderNames[i]) || `Holder ${i + 1}`;
  if (isIndividual(accountType)) {
    for (let h = 1; h <= holders; h++) {
      const hn = name(h - 1);
      slots.push({ key: `doc_pan_h${h}`, label: 'PAN card', holder: hn, digio: true, required: true });
      slots.push({ key: `doc_aadhaar_h${h}`, label: 'Aadhaar card', holder: hn, digio: true, required: !nri });
      if (nri) {
        slots.push({ key: `doc_passport_h${h}`, label: 'Passport', holder: hn, required: true });
        slots.push({ key: `doc_overseas_address_h${h}`, label: 'Overseas address proof', holder: hn, required: true });
      }
    }
    slots.push({ key: 'doc_cancelled_cheque', label: 'Cancelled cheque', holder: name(0), waivable: true, required: true });
  } else if (accountType === 'huf') {
    slots.push({ key: 'doc_huf_pan', label: 'HUF PAN card', holder: 'HUF', required: true });
    slots.push({ key: 'doc_huf_deed', label: 'HUF deed / declaration', holder: 'HUF', required: true });
    slots.push({ key: 'doc_karta_pan', label: 'Karta PAN card', holder: 'Karta', required: true });
    slots.push({ key: 'doc_karta_aadhaar', label: 'Karta Aadhaar card', holder: 'Karta', required: true });
    slots.push({ key: 'doc_cancelled_cheque', label: 'Cancelled cheque', holder: 'HUF', required: true });
  } else {
    slots.push({ key: 'doc_entity_pan', label: 'Entity PAN card', holder: 'Entity', required: true });
    slots.push({ key: 'doc_entity_registration', label: 'Registration certificate / deed', holder: 'Entity', required: true });
    slots.push({ key: 'doc_signatory_pan', label: 'Authorised signatory PAN', holder: 'Signatory', required: true });
    slots.push({ key: 'doc_signatory_aadhaar', label: 'Authorised signatory Aadhaar', holder: 'Signatory', required: true });
    slots.push({ key: 'doc_cancelled_cheque', label: 'Cancelled cheque', holder: 'Entity', required: true });
  }
  return slots;
}

// A DigiLocker fetch satisfies one bundle key per holder on the real backend
// (confirmed against the dev server: docKeys = ["doc_digilocker_bundle_h1"]),
// which covers both the PAN and Aadhaar slots for that holder.
const BUNDLE = /^doc_digilocker_bundle_h(\d+)$/;
function expandKey(k) {
  const m = BUNDLE.exec(k);
  return m ? [k, `doc_pan_h${m[1]}`, `doc_aadhaar_h${m[1]}`] : [k];
}

// Resolve each slot's state from server uploads and Digio-satisfied keys.
export function resolveDocs(slots, uploads, satisfiedKeys) {
  const byKey = {};
  (uploads || []).forEach(u => { expandKey(u.fieldKey).forEach(k => { if (!byKey[k] || u.fieldKey === k) byKey[k] = u; }); });
  const sat = new Set((satisfiedKeys || []).flatMap(expandKey));
  return slots.map(s => {
    const up = byKey[s.key];
    if (up) return { ...s, state: up.source === 'digio' ? 'fetched' : 'uploaded', upload: up };
    if (sat.has(s.key)) return { ...s, state: s.waivable ? 'waived' : 'fetched', upload: null };
    return { ...s, state: 'pending', upload: null };
  });
}

// ---- Validation -----------------------------------------------------------

export function validateBegin(ob) {
  if (!clean(ob.name)) return 'Please add your name so we know what to call you.';
  if (!isValidEmail(ob.email)) return 'That email doesn’t look complete — mind checking it?';
  if (!isValidMobile(ob.mobile)) return 'Your mobile number should be 10 digits, starting with 6 to 9.';
  return null;
}

export function validateIdentity(ob, server) {
  const locked = lockedFieldsFor(server, 'primary');
  if (!clean(ob.name)) return 'Please add the name as it appears on your PAN.';
  if (!isValidEmail(ob.email)) return 'Please add a valid email for holder 1.';
  if (!isValidMobile(ob.mobile)) return 'Please add a valid 10-digit mobile for holder 1.';
  if (ob.type === 0) {
    if (!locked.pan && !isValidPan(ob.pan)) return 'PAN should look like ABCDE1234F.';
    if (!locked.dob) {
      const iso = dobToIso(ob.dob);
      if (!iso) return 'Please enter your date of birth as DD / MM / YYYY.';
      if (!isAdult(iso)) return 'Account holders must be 18 or older.';
    }
    if (!locked.addr && clean(ob.addr).length < 10) return 'Please add your full address as per your proof.';
  }
  if (ob.h2) {
    if (!clean(ob.h2Name)) return 'Please add the second holder’s name.';
    if (!isValidMobile(ob.h2Mobile) && !isValidEmail(ob.h2Email)) return 'Add a mobile or email for the second holder so we can verify them.';
    const locked2 = lockedFieldsFor(server, 'second');
    if (!locked2.h2Pan && !isValidPan(ob.h2Pan)) return 'Second holder’s PAN should look like ABCDE1234F.';
  }
  return null;
}

export function validateNominees(ob) {
  if (ob.nomOptOut || !ob.noms || ob.noms.length === 0) return null;
  for (const n of ob.noms) {
    if (!clean(n.name)) return 'Each nominee needs a name.';
    if (!clean(n.rel)) return 'Tell us how each nominee is related to you.';
    if (n.minor && !clean(n.guardian)) return 'A minor nominee needs a guardian name.';
  }
  const sum = ob.noms.reduce((s, n) => s + (parseInt(n.alloc, 10) || 0), 0);
  if (sum !== 100) return `Allocations should add up to 100%. They’re at ${sum}% now.`;
  return null;
}

export function validateDocs(rows) {
  const missing = rows.filter(r => r.required && r.state === 'pending');
  if (!missing.length) return null;
  const first = missing[0];
  return missing.length === 1
    ? `${first.label} for ${first.holder} is still needed.`
    : `${missing.length} documents are still needed, starting with ${first.label} for ${first.holder}.`;
}

export function validateForSubmit(ob, server, docRows) {
  return validateBegin(ob) || validateIdentity(ob, server)
    || (ob.ans.some(a => a == null) ? 'Please answer all six risk questions.' : null)
    || validateNominees(ob) || validateDocs(docRows);
}
