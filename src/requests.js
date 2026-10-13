// My Requests (13 Oct 2026): the requests a client raised from the app or web (strategy questions, queries, account /
// family requests, referrals, strategy switches) with their live status in Zoho — Desk for tickets, the
// CRM for switch plans — from GET /api/mobile/requests (myQode lib/requestTracking.ts). Shared by the phone's
// Services tab (src/screens/services.js) and the web's Account Services page (src/web/services.js).
import { fmtDate } from './adapt';

// state → how the status pill reads: open (gold), on hold (red), closed (green). The label is exactly Zoho's status;
// a request Zoho could not be read for has no status (null) and shows no pill — never a word of our own.
export const STATUS_TONE = { open: 'warn', on_hold: 'bad', closed: 'ok' };
export const statusTone = r => STATUS_TONE[r && r.status && r.status.state] || 'neutral';
export const statusLabel = r => (r && r.status && r.status.label) || '';
// "Ask About a Strategy · QAW00186 · 12 Oct 2026 · Web"
export const requestMeta = r => [r.accountId, r.createdAt ? fmtDate(r.createdAt) : null, r.channel, r.reference].filter(Boolean).join(' · ');
