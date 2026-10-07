// The investor's Relationship Manager (name, phone and email), for the profile (web src/web/account.js, phone src/screens/more.js): the owner
// of their Zoho CRM investor record (meta.relationshipManager → GET /api/mobile/experience/relationship-manager).
// The lookup goes to Zoho and takes a second or two the first time, so it starts as soon as the portfolio loads
// (prefetchRm, from main.js loadSnapshot) and is kept per signed-in user: the profile is usually ready on arrival.
import { useState, useEffect } from 'react';
import { meta } from './api';

const cache = new Map();   // key (signed-in email) → Promise<string | null>
const known = new Map();   // key → the answer, once in: a page opened later shows it on its first paint
export function prefetchRm(key) {
  const k = String(key || '');
  if (!cache.has(k)) cache.set(k, meta.relationshipManager().then(d => { const n = { name: (d && d.name) || null, phone: (d && d.name && d.phone) || null, email: (d && d.name && d.email) || null }; known.set(k, n); return n; }).catch(() => { cache.delete(k); return { name: null, phone: null, email: null }; }));
  return cache.get(k);
}

// { name, phone, email, done }: done once the lookup has answered (name null: none on record, the row is left out;
// phone null: no number on record, only the name shows).
export function useRmName(key) {
  const k = String(key || '');
  const [st, set] = useState(() => (known.has(k) ? { k, rm: known.get(k) } : { k: null, rm: null }));
  useEffect(() => {
    let live = true;
    prefetchRm(k).then(rm => { if (live) set({ k, rm }); });
    return () => { live = false; };
  }, [k]);
  const rm = st.k === k && st.rm ? st.rm : { name: null, phone: null, email: null };
  return { name: rm.name, phone: rm.phone, email: rm.email, done: st.k === k };
}
