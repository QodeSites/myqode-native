// Shared form validation for the app. Two halves per field type:
//   clean.*  — applied while typing, so impossible input never gets into the field (letters in a phone, >10 digits…)
//   check.*  — applied on submit, returns an error message or ''.
// Email and mobile rules are the onboarding ones (src/onboarding/mapping.js), so every form agrees.
import { isValidEmail, isValidMobile, normalizeMobile } from './onboarding/mapping';

export const LIMITS = { name: 80, email: 120, note: 500, message: 1000 };

export const clean = {
  // Indian mobile: digits only, a leading +91 / 0 dropped, at most 10 digits.
  phone: t => {
    let d = String(t || '').replace(/\D/g, '');
    if (d.length > 10 && d.startsWith('91')) d = d.slice(2);
    if (d.length > 10 && d.startsWith('0')) d = d.slice(1);
    return d.slice(0, 10);
  },
  email: t => String(t || '').replace(/\s/g, '').slice(0, LIMITS.email),
  // Person's name: letters, spaces and . ' - only (no digits or symbols), single spaces.
  name: t => String(t || '').replace(/[^A-Za-zÀ-ɏ .'-]/g, '').replace(/\s{2,}/g, ' ').slice(0, LIMITS.name),
  text: (t, max = LIMITS.message) => String(t || '').slice(0, max),
  digits: (t, max = 3) => String(t || '').replace(/\D/g, '').slice(0, max),
};

export const check = {
  name: (v, what = 'the name') => {
    const s = String(v || '').trim();
    if (!s) return `Please enter ${what}.`;
    if (s.replace(/[^A-Za-zÀ-ɏ]/g, '').length < 2) return `Please enter ${what} in full.`;
    return '';
  },
  email: v => (!String(v || '').trim() ? 'Please enter an email address.' : !isValidEmail(v) ? 'That email address doesn’t look right (for example name@example.com).' : ''),
  phone: v => {
    const d = normalizeMobile(v);
    if (!d) return 'Please enter a mobile number.';
    if (d.length !== 10) return 'Mobile number must be 10 digits.';
    if (!isValidMobile(d)) return 'Enter a valid Indian mobile number (starting with 6, 7, 8 or 9).';
    return '';
  },
  text: (v, { min = 5, max = LIMITS.message, what = 'a few words' } = {}) => {
    const s = String(v || '').trim();
    if (s.length < min) return `Please write ${what} (at least ${min} characters).`;
    if (s.length > max) return `Please keep it under ${max} characters.`;
    return '';
  },
};

// First error of a list of checks.
export const firstError = (...errs) => errs.find(Boolean) || '';
