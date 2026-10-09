// Preferences (text size, high contrast, reduced motion), saved on this device: localStorage on the web, the
// keychain / keystore on the phone. Applied through UICtx (src/ui.js: text size, text colours, animation) and, on
// the web, a small global stylesheet for what inline styles can't reach (borders, CSS transitions). 9 Oct 2026.
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const KEY = 'myqode_prefs';
const web = Platform.OS === 'web' && typeof document !== 'undefined';

export async function loadPrefs() {
  try {
    const raw = web ? window.localStorage.getItem(KEY) : await SecureStore.getItemAsync(KEY);
    const p = raw ? JSON.parse(raw) : {};
    // first visit on the web: follow the system's "reduce motion" setting
    if (p.rm == null && web && window.matchMedia) p.rm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    return { ts: [0, 1, 2, 3].includes(p.ts) ? p.ts : 1, hc: !!p.hc, rm: !!p.rm };
  } catch (e) { return null; }
}

export async function savePrefs({ ts, hc, rm }) {
  const raw = JSON.stringify({ ts, hc: !!hc, rm: !!rm });
  try { if (web) window.localStorage.setItem(KEY, raw); else await SecureStore.setItemAsync(KEY, raw); } catch (e) { /* storage unavailable */ }
}

// Web only: high contrast deepens the hairline and control borders (inline rgba values from src/web/kit.js and
// src/ui.js); reduced motion turns off CSS transitions and animations.
const HC_CSS = [
  ['rgba(55, 88, 79, 0.12)', 'rgba(34, 66, 58, 0.45)'],
  ['rgba(55, 88, 79, 0.15)', 'rgba(34, 66, 58, 0.5)'],
  ['rgba(55, 88, 79, 0.3)', 'rgba(34, 66, 58, 0.75)'],
].map(([a, b]) => `[style*="border-color: ${a}"],[style*="border-top-color: ${a}"],[style*="border-bottom-color: ${a}"],[style*="border-left-color: ${a}"],[style*="border-right-color: ${a}"]{border-color:${b}!important}`
  + `[style*="background-color: ${a}"]{background-color:${b}!important}`).join('');
const RM_CSS = '*,*::before,*::after{transition-duration:0s!important;transition-delay:0s!important;animation-duration:0s!important;animation-iteration-count:1!important;scroll-behavior:auto!important}';

export function applyWebPrefs({ hc, rm }) {
  if (!web) return;
  let el = document.getElementById('myqode-prefs');
  if (!el) { el = document.createElement('style'); el.id = 'myqode-prefs'; document.head.appendChild(el); }
  el.textContent = (hc ? HC_CSS : '') + (rm ? RM_CSS : '');
}
