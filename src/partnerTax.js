// Invoice rules for the partner app — verbatim ports of the web's libs, so the app's invoice matches the web's:
//   computeTax, GST_STATE_CODES, validateGstin, validatePan   ← myQode/lib/invoiceTax.ts
//   amountInWords                                            ← myQode/lib/amountInWords.ts
//   QODE_ENTITY, qodeAddressLines, isQodeEntityComplete      ← myQode/lib/qodeEntity.ts
export const GST_RATE = 18;
const round2 = n => Math.round((n + Number.EPSILON) * 100) / 100;

export function computeTax(taxableValue, supplierStateCode, recipientStateCode, supplierHasGstin) {
  const base = round2(Math.max(0, taxableValue));
  if (!supplierHasGstin) return { treatment: 'unregistered', taxableValue: base, cgst: 0, sgst: 0, igst: 0, totalTax: 0, total: base, cgstRate: 0, sgstRate: 0, igstRate: 0 };
  const sameState = Boolean(supplierStateCode) && Boolean(recipientStateCode)
    && String(supplierStateCode).padStart(2, '0') === String(recipientStateCode).padStart(2, '0');
  if (sameState) {
    const half = round2((base * (GST_RATE / 2)) / 100);
    return { treatment: 'intra_state', taxableValue: base, cgst: half, sgst: half, igst: 0, totalTax: round2(half * 2), total: round2(base + half * 2), cgstRate: GST_RATE / 2, sgstRate: GST_RATE / 2, igstRate: 0 };
  }
  const igst = round2((base * GST_RATE) / 100);
  return { treatment: 'inter_state', taxableValue: base, cgst: 0, sgst: 0, igst, totalTax: igst, total: round2(base + igst), cgstRate: 0, sgstRate: 0, igstRate: GST_RATE };
}

export const GST_STATE_CODES = {
  '01': 'Jammu and Kashmir', '02': 'Himachal Pradesh', '03': 'Punjab', '04': 'Chandigarh', '05': 'Uttarakhand',
  '06': 'Haryana', '07': 'Delhi', '08': 'Rajasthan', '09': 'Uttar Pradesh', '10': 'Bihar', '11': 'Sikkim',
  '12': 'Arunachal Pradesh', '13': 'Nagaland', '14': 'Manipur', '15': 'Mizoram', '16': 'Tripura', '17': 'Meghalaya',
  '18': 'Assam', '19': 'West Bengal', '20': 'Jharkhand', '21': 'Odisha', '22': 'Chhattisgarh', '23': 'Madhya Pradesh',
  '24': 'Gujarat', '26': 'Dadra and Nagar Haveli and Daman and Diu', '27': 'Maharashtra', '29': 'Karnataka', '30': 'Goa',
  '31': 'Lakshadweep', '32': 'Kerala', '33': 'Tamil Nadu', '34': 'Puducherry', '35': 'Andaman and Nicobar Islands',
  '36': 'Telangana', '37': 'Andhra Pradesh', '38': 'Ladakh', '97': 'Other Territory',
};

export function validateGstin(gstin) {
  const value = String(gstin || '').trim().toUpperCase();
  if (!value) return { valid: false, reason: 'Enter your GSTIN' };
  if (value.length !== 15) return { valid: false, reason: 'A GSTIN is 15 characters' };
  if (!/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z][Z][0-9A-Z]$/.test(value)) return { valid: false, reason: "That doesn't look like a valid GSTIN" };
  if (!GST_STATE_CODES[value.slice(0, 2)]) return { valid: false, reason: `${value.slice(0, 2)} is not a valid state code` };
  const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let sum = 0;
  for (let i = 0; i < 14; i++) {
    const code = chars.indexOf(value[i]);
    if (code < 0) return { valid: false, reason: "That doesn't look like a valid GSTIN" };
    const product = code * (i % 2 === 0 ? 1 : 2);
    sum += Math.floor(product / 36) + (product % 36);
  }
  if (chars[(36 - (sum % 36)) % 36] !== value[14]) return { valid: false, reason: 'That GSTIN fails its check digit — please re-check it' };
  return { valid: true };
}

export function validatePan(pan) {
  const value = String(pan || '').trim().toUpperCase();
  if (!value) return { valid: true };
  if (!/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(value)) return { valid: false, reason: "That doesn't look like a valid PAN" };
  return { valid: true };
}

export function amountInWords(n) {
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const two = x => (x < 20 ? ones[x] : `${tens[Math.floor(x / 10)]}${x % 10 ? ' ' + ones[x % 10] : ''}`);
  const three = x => (x >= 100 ? `${ones[Math.floor(x / 100)]} Hundred${x % 100 ? ' ' + two(x % 100) : ''}` : two(x));
  const whole = Math.floor(Math.abs(n));
  const paise = Math.round((Math.abs(n) - whole) * 100);
  if (whole === 0 && paise === 0) return 'Zero Rupees Only';
  const crore = Math.floor(whole / 10000000), lakh = Math.floor((whole % 10000000) / 100000), thousand = Math.floor((whole % 100000) / 1000), rest = whole % 1000;
  const parts = [];
  if (crore) parts.push(`${three(crore)} Crore`);
  if (lakh) parts.push(`${three(lakh)} Lakh`);
  if (thousand) parts.push(`${three(thousand)} Thousand`);
  if (rest) parts.push(three(rest));
  const rupees = parts.join(' ') || 'Zero';
  return paise ? `${rupees} Rupees and ${two(paise)} Paise Only` : `${rupees} Rupees Only`;
}

export const QODE_ENTITY = {
  name: 'Qode Advisors LLP', gstin: '27AABFQ1993R1ZG', pan: 'AABFQ1993R',
  addressLine1: 'Floor 2, Office No. 203, Hamam House', addressLine2: 'Ambalal Doshi Marg, Fort',
  city: 'Mumbai', state: 'Maharashtra', stateCode: '27', pincode: '400001', sebiRegistration: 'INP000008914',
};
export const isQodeEntityComplete = (e = QODE_ENTITY) => Boolean(e.name.trim() && e.gstin.trim() && e.addressLine1.trim() && e.stateCode.trim());
export const qodeAddressLines = (e = QODE_ENTITY) =>
  [e.addressLine1, e.addressLine2, [e.city, e.state, e.pincode].filter(Boolean).join(', ')].map(l => l.trim()).filter(Boolean);
