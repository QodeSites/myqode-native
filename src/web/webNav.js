// The web sidebar (desktop only; the phone's More tab keeps NAV_GROUPS in src/nav.js): three labelled sections, one
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
  help: (c, s) => <L c={c} s={s}><Circle cx={12} cy={12} r={10} /><Path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3M12 17h.01" /></L>,
};
export const NavIcon = ({ name, c, s }) => (ICONS[name] || ICONS.doc)(c, s);

export const WEB_NAV = [
  { title: 'Overview', items: [
    { id: 'home', label: 'Dashboard', tab: 'home', icon: 'dashboard' },
    { id: 'holdings', label: 'Portfolio', tab: 'holdings', icon: 'pie' },
    { id: 'portfolio', label: 'Performance', tab: 'portfolio', icon: 'trend' },
  ] },
  { title: 'Activity', items: [
    { id: 'transactions', label: 'Transactions', page: 'transactions', icon: 'list' },
    { id: 'reports', label: 'Reports', page: 'reports', icon: 'report' },
    { id: 'docs', label: 'Documents', tab: 'docs', icon: 'doc' },
  ] },
  { title: 'Account', items: [
    { id: 'about', label: 'About Qode', page: 'about', icon: 'info', covers: ['philosophy', 'foundation', 'strategies', 'team', 'cadence'] },
    { id: 'insights', label: 'Insights & Events', page: 'insights', icon: 'news' },
    { id: 'account', label: 'Profile', tab: 'more', icon: 'user', covers: ['family', 'guide', 'nuvama', 'notifications', 'privacy', 'terms', 'cancellation', 'admin'] },
    { id: 'support', label: 'Support', page: 'support', icon: 'help', covers: ['services', 'faq', 'grievance', 'risk', 'voice', 'referral'] },
  ] },
];

const ITEMS = WEB_NAV.flatMap(s => s.items);
/** The sidebar item a tab / page key belongs to (the item itself, or the hub that covers it). */
export const webNavFor = id => ITEMS.find(it => it.id === id || (it.covers || []).includes(id));
