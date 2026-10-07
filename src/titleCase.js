// Title Case for names, headings, labels and buttons, web and phone alike: every word starts with a capital
// ("Your Accounts", "Login To Nuvama", "Net Invested"). Short joining words stay lower case inside a title ("Profit
// and Loss", "Your Team at Qode"). Abbreviations and codes keep their capitals (NAV, P&L, CAGR, QAW00031, 1Y), and an
// ALL-CAPS label from the data ("TOTAL RETURNS") becomes "Total Returns". Anything not a string comes back as is.
const KEEP = new Set(['NAV', 'SIP', 'STP', 'PMS', 'SI', 'DD', 'IR', 'PDF', 'FAQ', 'FAQS', 'CAGR', 'P&L', 'UCC', 'GST', 'PAN', 'KYC', 'TDS', 'ID', 'XIRR',
  'AUM', 'GSTIN', 'IFSC', 'SOA', 'CSV', 'CML', 'OTP', 'UPI', 'NRI', 'NRE', 'NRO', 'IRR', 'TWRR', 'ETF', 'ETFS', 'MF', 'LTCG', 'STCG', 'LT', 'ST', 'QAW',
  'QTF', 'QGF', 'QFH', 'SEBI', 'NSE', 'BSE', 'CDSL', 'NSDL', 'DP', 'RM', 'AMC', 'SMS', 'ISIN', 'NIFTY', 'HUF', 'LLP', 'INR', 'FY', 'API', 'URL', 'OK']);
const SMALL = new Set(['a', 'an', 'and', 'or', 'nor', 'but', 'the', 'of', 'in', 'on', 'at', 'to', 'for', 'by', 'vs', 'via', 'per', 'as', 'with', 'from']);

export function titleCase(t) {
  if (typeof t !== 'string' || !/[a-z]/i.test(t)) return t;
  const allCaps = t === t.toUpperCase();
  let first = true;
  return t.split(/(\s+)/).map(part => {
    if (/^\s+$/.test(part) || !part) return part;
    const isFirst = first; first = false;
    const bare = part.replace(/[^A-Za-z&0-9]/g, '');
    // codes and abbreviations: QAW00031, NAV, P&L, 1Y, e.g. "(PDF)"
    if (KEEP.has(bare.toUpperCase()) && (allCaps || bare === bare.toUpperCase())) return part.replace(bare, bare.toUpperCase());
    if (/\d/.test(bare) && /[A-Z]/.test(bare)) return part;           // codes: QAW00031, 1Y, Q1
    if (/^(e\.g\.|i\.e\.|etc\.?)$/i.test(part)) return part.toLowerCase();
    if (!allCaps && /[A-Z]/.test(bare.slice(1))) return part;        // already mixed case on purpose: "myQode", "iPhone"
    const w = allCaps ? part.toLowerCase() : part;
    if (!isFirst && SMALL.has(w.toLowerCase().replace(/[^a-z]/g, ''))) return w.toLowerCase();
    // each piece of a hyphenated word: "1-year" → "1-Year", "risk-free" → "Risk-Free"; skip leading punctuation "("
    return w.split('-').map(p => p.replace(/^([^A-Za-z0-9]*)([a-z])/, (m, pre, ch) => pre + ch.toUpperCase())).join('-');
  }).join('');
}
export default titleCase;
