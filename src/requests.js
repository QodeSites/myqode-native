// My Requests (13 Oct 2026): the requests a client raised from the app or web (strategy questions, queries, account /
// family requests, referrals, strategy switches) with their live status in Zoho — Desk for tickets, the
// CRM for switch plans — from GET /api/mobile/requests (myQode lib/requestTracking.ts). Shared by the phone's
// Services tab (src/screens/services.js) and the web's Account Services page (src/web/services.js).
import { fmtDate } from './adapt';

// state → how the status pill reads: open (gold), on hold (red), closed (green). The label is exactly Zoho's status;
// a request Zoho could not be read for has no status (null) and shows no pill — never a word of our own.
export const STATUS_TONE = { open: 'warn', on_hold: 'bad', closed: 'ok' };
// Zoho Desk's own status colours (16 Oct 2026): Open grey, On Hold and Unverified orange, Closed green; Escalated red,
// so it never looks like Open. Any other status falls back to its state above.
const DESK_TONE = { open: 'neutral', 'on hold': 'warn', unverified: 'warn', escalated: 'bad', closed: 'ok' };
export const statusTone = r => DESK_TONE[String((r && r.status && r.status.label) || '').trim().toLowerCase()] || STATUS_TONE[r && r.status && r.status.state] || 'neutral';
export const statusLabel = r => (r && r.status && r.status.label) || '';
// "What do you need help with?" (Account Services and Support's pop-up): the request types from Zoho Desk
// (services.requestTypes → GET /api/request-types), shown grouped by category in A–N order, codes in number order
// within each, and I6 (unclassified) last of all as "Something else" (16 Oct 2026). The chosen code goes to
// services.helpRequest as typeCode.
const codeKey = c => { const m = String(c || '').match(/^([A-Z]+)(\d+)$/); return m ? [m[1], Number(m[2])] : [String(c || ''), 0]; };
export const OTHER_CODE = 'I6';
export function groupTypes(types) {
  const list = (types || []).filter(t => t && t.code);
  const groups = [];
  list.filter(t => t.code !== OTHER_CODE)
    .sort((a, b) => { const x = codeKey(a.code), y = codeKey(b.code); return x[0] < y[0] ? -1 : x[0] > y[0] ? 1 : x[1] - y[1]; })
    .forEach(t => { let g = groups.find(x => x.category === t.category); if (!g) groups.push(g = { category: t.category, items: [] }); g.items.push(t); });
  // categories come as "C. Account changes": show them without the letter
  groups.forEach(g => { g.label = String(g.category || 'Other').replace(/^[A-Z]\.\s*/, ''); });
  const other = list.find(t => t.code === OTHER_CODE);
  if (other) groups.push({ category: '', label: '', items: [{ ...other, name: 'Something else' }] });
  return groups;
}
// One key per submission of the request form, sent as requestKey: pressing Submit again after a slow answer reuses it,
// so the server treats it as the same request; a new key only after a request went through.
export const newRequestKey = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
// What the form says when the answer is slow or the connection drops: the ticket may already be raised.
export const SLOW_REQUEST = 'This is taking longer than usual, and your request may already have reached us. Check Past Requests before sending it again; pressing Submit again is safe and will not create a second request.';
export const isSlow = e => !!e && (e.code === 'TIMEOUT' || e.code === 'OFFLINE' || e.status >= 500);
export const typeName = (groups, code) => { for (const g of groups || []) { const t = g.items.find(x => x.code === code); if (t) return t.name; } return ''; };

// "Ask About a Strategy · QAW00186 · 12 Oct 2026 · Web"
export const requestMeta = r => [r.accountId, r.createdAt ? fmtDate(r.createdAt) : null, r.channel, r.reference].filter(Boolean).join(' · ');
