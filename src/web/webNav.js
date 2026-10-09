// The web sidebar (desktop only; the phone's More tab keeps NAV_GROUPS in src/nav.js): four labelled sections, one
// icon per item, nothing collapsible. Everything else sits one click deeper, on the About Qode and Support hub pages
// (src/web/pages.js) or Profile. `covers` lists the pages an item stands for, so it stays highlighted on them and
// the breadcrumb leads back to it. Decided 6 Oct 2026.
import React from 'react';
import Svg, { Path, Rect, Circle } from 'react-native-svg';

const L = ({ c, s = 20, children }) => (
  <Svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">{children}</Svg>
);
const ICONS = {
  dashboard: (c, s) => <L c={c} s={s}><Rect x={3} y={3} width={7} height={9} rx={1} /><Rect x={14} y={3} width={7} height={5} rx={1} /><Rect x={14} y={12} width={7} height={9} rx={1} /><Rect x={3} y={16} width={7} height={5} rx={1} /></L>,
  pie: (c, s) => <L c={c} s={s}><Path d="M21.21 15.89A10 10 0 1 1 8 2.83" /><Path d="M22 12A10 10 0 0 0 12 2v10z" /></L>,
  trend: (c, s) => <L c={c} s={s}><Path d="m22 7-8.5 8.5-5-5L2 17" /><Path d="M16 7h6v6" /></L>,
  list: (c, s) => <L c={c} s={s}><Path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" /></L>,
  report: (c, s) => <L c={c} s={s}><Path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" /><Path d="M14 2v4a2 2 0 0 0 2 2h4M10 9H8M16 13H8M16 17H8" /></L>,
  doc: (c, s) => <L c={c} s={s}><Path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" /><Path d="M14 2v4a2 2 0 0 0 2 2h4" /></L>,
  info: (c, s) => <L c={c} s={s}><Circle cx={12} cy={12} r={10} /><Path d="M12 16v-4M12 8h.01" /></L>,
  user: (c, s) => <L c={c} s={s}><Path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" /><Circle cx={12} cy={7} r={4} /></L>,
  signout: (c, s) => <L c={c} s={s}><Path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><Path d="m16 17 5-5-5-5M21 12H9" /></L>,
  news: (c, s) => <L c={c} s={s}><Path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2" /><Path d="M18 14h-8M15 18h-5M10 6h8v4h-8z" /></L>,
  shield: (c, s) => <L c={c} s={s}><Path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" /><Path d="m9 12 2 2 4-4" /></L>,
  layers: (c, s) => <L c={c} s={s}><Path d="m12 2 9 5-9 5-9-5 9-5Z" /><Path d="m3 12 9 5 9-5" /><Path d="m3 17 9 5 9-5" /></L>,
  clipboard: (c, s) => <L c={c} s={s}><Rect x={8} y={2} width={8} height={4} rx={1} /><Path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" /><Path d="M9 12h6M9 16h6" /></L>,
  help: (c, s) => <L c={c} s={s}><Circle cx={12} cy={12} r={10} /><Path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3M12 17h.01" /></L>,
};
export const NavIcon = ({ name, c, s }) => (ICONS[name] || ICONS.doc)(c, s);

// Grouped by purpose (decided 7 Oct 2026): your investments, what happened, your papers, Qode itself — which, since
// 9 Oct 2026, also holds Account Services and Support, so every request and help page is one click from the sidebar.
// Profile (`hidden`) is reached from the profile card and is listed here only so the pages it covers keep it highlighted.
export const WEB_NAV = [
  { title: 'Investments', items: [
    { id: 'home', label: 'Overview', tab: 'home', icon: 'dashboard' },
    { id: 'portfolio', label: 'Returns & Risk', tab: 'portfolio', icon: 'trend' },
    { id: 'holdings', label: 'Portfolio', tab: 'holdings', icon: 'pie' },
  ] },
  { title: 'Activity', items: [
    { id: 'transactions', label: 'Transactions', page: 'transactions', icon: 'list' },
    { id: 'reports', label: 'Reports', page: 'reports', icon: 'report' },
  ] },
  { title: 'Documents', items: [
    { id: 'docs', label: 'Documents', tab: 'docs', icon: 'doc' },
    { id: 'risk', label: 'Risk Management & Controls', page: 'risk', icon: 'shield' },
  ] },
  { title: 'Qode', items: [
    { id: 'services', label: 'Account Services', tab: 'services', icon: 'clipboard' },
    { id: 'about', label: 'About Qode', page: 'about', icon: 'info', covers: ['philosophy', 'foundation', 'team', 'cadence'] },
    { id: 'strategies', label: 'Strategy', page: 'strategies', icon: 'layers' },
    { id: 'insights', label: 'Insights & Events', page: 'insights', icon: 'news' },
    { id: 'support', label: 'Support', page: 'support', icon: 'help', covers: ['faq', 'grievance', 'voice', 'referral'] },
  ] },
  { title: 'Profile', hidden: true, items: [
    { id: 'account', label: 'Profile', tab: 'more', icon: 'user', covers: ['family', 'guide', 'nuvama', 'notifications', 'privacy', 'terms', 'cancellation', 'admin'] },
  ] },
];

const ITEMS = WEB_NAV.flatMap(s => s.items);
/** The sidebar item a tab / page key belongs to (the item itself, or the hub that covers it). */
export const webNavFor = id => ITEMS.find(it => it.id === id || (it.covers || []).includes(id));
