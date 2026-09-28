// The investor menu, shared by the desktop sidebar (src/web/desktop.js) and the phone's More tab
// (src/screens/more.js): the old myQode portal's five groups, with its labels. Plain data.
// Each item opens either a tab (`tab`, a key of state.tab in src/main.js) or a page (`page`, a key of PAGES /
// DESKTOP_PAGES). `icon` names a group icon in src/icons.js (GroupIcon).
export const NAV_GROUPS = [
  { key: 'portfolio', title: 'Portfolio', icon: 'chart', items: [
    { id: 'home', label: 'Overview', tab: 'home' },
    { id: 'portfolio', label: 'Performance', tab: 'portfolio' },
    { id: 'holdings', label: 'Holdings', tab: 'holdings' },
    { id: 'transactions', label: 'Transactions', page: 'transactions' },
    { id: 'reports', label: 'Reports', page: 'reports' },
  ] },
  { key: 'about', title: 'About Qode', icon: 'info', items: [
    { id: 'philosophy', label: 'Qode Philosophy', page: 'philosophy' },
    { id: 'foundation', label: 'Foundation', page: 'foundation' },
    { id: 'strategies', label: 'Strategy Snapshot', page: 'strategies' },
    { id: 'team', label: 'Your Team at Qode', page: 'team' },
  ] },
  { key: 'experience', title: 'Your Qode Experience', icon: 'compass', items: [
    { id: 'guide', label: 'Investor Portal Guide', page: 'guide' },
    { id: 'services', label: 'Account Services', tab: 'services' },
    { id: 'family', label: 'Account Mapping', page: 'family' },
    { id: 'cadence', label: 'Service Cadence', page: 'cadence' },
    { id: 'nuvama', label: 'Your Details on Nuvama', page: 'nuvama' },
  ] },
  { key: 'engagement', title: 'Engagement & Growth', icon: 'trend', items: [
    { id: 'voice', label: 'Your Voice Matters', page: 'voice' },
    { id: 'referral', label: 'Referral Program', page: 'referral' },
    { id: 'insights', label: 'Insights & Events', page: 'insights' },
  ] },
  { key: 'trust', title: 'Trust & Security', icon: 'shield', items: [
    { id: 'docs', label: 'Client Document Vault', tab: 'docs' },
    { id: 'risk', label: 'Risk Management & Controls', page: 'risk' },
    { id: 'grievance', label: 'Escalation and Grievance Redressal', page: 'grievance' },
    { id: 'faq', label: 'FAQs & Glossary', page: 'faq' },
  ] },
];

// Pages kept outside the five groups (legal copy), linked from the profile / settings page.
export const LEGAL_LINKS = [['privacy', 'Privacy Policy'], ['terms', 'Terms and Conditions'], ['cancellation', 'Cancellation and Refund']];

// Old page keys that now live elsewhere: 'contact' was folded into "Your Team at Qode".
export const PAGE_ALIASES = { contact: 'team' };

const ALL = NAV_GROUPS.flatMap(g => g.items.map(it => ({ ...it, group: g })));
/** The menu item for a tab or page key (tab 'holdings', page 'team'…), or undefined. */
export const navItem = id => ALL.find(it => it.id === id);
/** The group a tab or page key belongs to, or undefined. */
export const groupOf = id => { const it = navItem(id); return it ? it.group : undefined; };
/** Items a distributor viewing an investor may open (no services, payments or requests in the client's name). */
export const visibleItems = (g, V) => g.items.filter(it => !(V.viewing && it.id === 'services'));

/** Opens a menu item on the phone or the web. */
export function openItem(V, it) {
  if (it.page) { V.openPage(it.page); return; }
  if (V.page) V.closePage();
  ({ home: V.goHome, portfolio: V.goPortfolio, holdings: V.segHold, docs: V.goDocs, services: V.goServices, reports: V.goReports }[it.tab] || V.goHome)();
}
