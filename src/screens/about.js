// More-tab pages rebuilt to match the web (myQode/app/(protected)/…) in content and structure, laid out for a phone:
//   Foundation        about/foundation            — fund-manager photos, names, letters, Mission / Vision cards
//   ReportsReviews    experience/service-cadence  — four sections of icon cards with bold labels and bullet lists
//   StrategySnapshot  about/strategy-snapshot     — each strategy in its own Qode colour gradient, pillars grid
//   PortalGuide       experience/investor-portal-guide — banner, WealthSpectrum links, access table, reports with snapshots/videos
//   Team              about/your-team-at-qode     — the four channels with their actions (forms, mail, booking, WhatsApp)
//   Escalation        trust/escalation-and-grievance-redressal
// Text is the web's, verbatim. Images are served by the live web app (public/).
import React, { useState } from 'react';
import { View, Pressable, Image, Linking, ScrollView, Modal, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path, Circle, Rect } from 'react-native-svg';
import { C, Tx, Card, CTA } from '../ui';
import { MailIcon, Phone, ChevronRight } from '../icons';
import { engagement } from '../api';
import { useLoad, openUrl, Loading } from './kit';

const WEB = 'https://myqode.qodeinvest.com';
const go = url => Linking.openURL(url).catch(() => {});

// ── shared bits ──────────────────────────────────────────────────────────────
const Body = ({ children, style }) => <Tx s={13} lh={1.65} c={C.muted} style={style}>{children}</Tx>;
// "Label: text" with the label bold, as the web's <strong> lines.
const Labelled = ({ label, children, style }) => (
  <Tx s={12.5} lh={1.6} c={C.muted} style={style}><Tx w={700} s={12.5} c={C.ink}>{label}: </Tx>{children}</Tx>
);
const Bullets = ({ items, color = C.gold }) => items.map((t, i) => (
  <View key={i} style={{ flexDirection: 'row', gap: 10, marginTop: 6 }}>
    <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: color, marginTop: 8 }} />
    <Tx s={12.5} lh={1.55} c={C.muted} style={{ flex: 1 }}>{t}</Tx>
  </View>
));
const Heading = ({ children, style }) => (
  <View style={[{ marginTop: 26, marginBottom: 12, paddingBottom: 8, borderBottomWidth: 1, borderColor: 'rgba(55,88,79,0.2)' }, style]}>
    <Tx f="play" w={600} s={19}>{children}</Tx>
  </View>
);
const Banner = ({ children }) => (
  <View style={{ backgroundColor: C.green, borderRadius: 10, paddingVertical: 14, paddingHorizontal: 16 }}>
    <Tx s={13} lh={1.55} c={C.cream}>{children}</Tx>
  </View>
);
// Small line icons for the cards (lucide shapes the web uses).
const ICON = {
  mail: 'M4 6h16v12H4z M4 7l8 6 8-6',
  chart: 'M4 20V10 M10 20V4 M16 20v-7 M3 20h18',
  calendar: 'M5 6h14v14H5z M5 10h14 M9 3v4 M15 3v4 M12 14v3l2 1',
  shield: 'M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z M9 12l2 2 4-4',
  clipboard: 'M8 4h8v3H8z M6 5h2 M16 5h2 M6 5v15h12V5 M9 12l2 2 4-4',
  message: 'M4 5h16v11H9l-5 4z',
  trend: 'M3 17l6-6 4 4 8-8 M15 7h6v6',
  user: 'M12 12a4 4 0 100-8 4 4 0 000 8z M4 20c1.5-3.5 4.5-5 8-5s6.5 1.5 8 5',
};
const LineIcon = ({ name, c = C.green, s = 18 }) => (
  <Svg width={s} height={s} viewBox="0 0 24 24" fill="none"><Path d={ICON[name]} stroke={c} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" /></Svg>
);
const IconDot = ({ name }) => (
  <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(2,66,43,0.1)', alignItems: 'center', justifyContent: 'center' }}>
    <LineIcon name={name} />
  </View>
);

// ── Note from Fund Managers ───────────────────────────────────────────────────
const MANAGERS = [
  {
    name: 'Rishabh Nahar', role: 'Fund Manager', photo: WEB + '/fund-manager/Rishabh.jpg',
    letter: [
      'Investing, to me, has always been about process. Markets are unpredictable in the short run, but data, when studied carefully, reveals patterns that can guide us with discipline.',
      'At Qode, our approach is rooted in systematic models that help us identify opportunities objectively, free from bias or noise.',
      'But models alone are not enough — they must be applied with judgment, constant review, and a deep respect for risk. That\'s why we combine quantitative insights with robust portfolio construction, always seeking to maximize outcomes while protecting against drawdowns.',
      'My goal is simple: to give investors confidence that every decision we take is grounded in evidence, tested rigorously, and aligned with the long-term compounding of their wealth.',
    ],
  },
  {
    name: 'Gaurav Didwania', role: 'Fund Manager', photo: WEB + '/fund-manager/Gaurav.jpg',
    letter: [
      'Over the last 15+ years in Indian markets, I\'ve seen cycles of euphoria and panic, trends that come and go, and businesses that either endure or fade.',
      'What I\'ve learned is that wealth creation doesn\'t come from chasing momentum alone — it comes from conviction in the right businesses and the patience to stay invested through volatility.',
      'At Qode, I focus on marrying deep fundamental research with a long-term mindset. We look beyond stock prices to understand management quality, competitive advantage, financial strength, and industry dynamics.',
      'For me, Qode is about trust and transparency — ensuring our investors not only achieve returns, but also understand the rationale behind every decision. That understanding builds confidence, and confidence is what allows compounding to work its magic.',
    ],
  },
];

export function Foundation() {
  return (
    <>
      {MANAGERS.map((m, i) => (
        <Card key={m.name} style={{ overflow: 'hidden', marginTop: i ? 16 : 0 }}>
          <Image source={{ uri: m.photo }} style={{ width: '100%', aspectRatio: 1, backgroundColor: 'rgba(55,88,79,0.1)' }} resizeMode="cover" accessibilityLabel={m.name} />
          <View style={{ padding: 18 }}>
            <Tx f="play" w={700} s={22}>{m.name}</Tx>
            <Tx w={700} s={12} ls={0.06} c={C.green} style={{ marginTop: 2 }}>{m.role}</Tx>
            <View style={{ width: 36, height: 2, backgroundColor: C.gold, marginTop: 12, marginBottom: 4 }} />
            {m.letter.map((t, j) => <Body key={j} style={{ marginTop: 10 }}>{t}</Body>)}
          </View>
        </Card>
      ))}
      {[['Mission', 'To support investors with data-driven, high-quality investment solutions that deliver superior risk-adjusted returns.'],
        ['Vision', 'To transform investment management with innovation and discipline, creating lasting value for our investors.']].map(([h, t]) => (
        <Card key={h} style={{ overflow: 'hidden', marginTop: 16 }}>
          <View style={{ backgroundColor: C.green, paddingVertical: 12, paddingHorizontal: 18 }}>
            <Tx f="play" w={600} s={18} c={C.gold}>{h}</Tx>
          </View>
          <Body style={{ padding: 18 }}>{t}</Body>
        </Card>
      ))}
    </>
  );
}

// ── Reports & Reviews ─────────────────────────────────────────────────────────
const CADENCE = [
  { h: 'Monthly Report', note: 'We will send fund-level performance; individual returns may differ', cards: [
    { icon: 'mail', t: 'Delivered via Email', lines: [['How', 'Sent directly to your registered email ID.']] },
    { icon: 'chart', t: 'Performance Updates', lines: [['Content', 'Performance summary across Qode strategies (QAW, QTF, QGF).']] },
    { icon: 'calendar', t: 'Timeline & Purpose', lines: [['Timeline', 'Within the first 15 days of the following month.'], ['Purpose', 'Keeps you updated consistently, without waiting for quarterly or annual reviews.']] },
  ] },
  { h: 'Quarterly Report', cards: [
    { icon: 'shield', t: 'Regulatory Disclosure', lines: [['Mandated by SEBI', 'Shared within 15 days of quarter‑end.']] },
    { icon: 'clipboard', t: 'What You Receive', bullets: ['Portfolio holdings & transactions', 'Performance vs. benchmark', 'Regulatory disclosures'] },
    { icon: 'chart', t: 'Why It Matters', lines: [['Purpose', 'Ensures full transparency and keeps you aligned with your portfolio on a regulatory‑mandated frequency.']] },
  ] },
  { h: 'Annual Review', cards: [
    { icon: 'message', t: 'One‑on‑One Engagement', lines: [['Format', 'Review session with your Fund Manager and Investor Relations team.']] },
    { icon: 'chart', t: 'Deep‑Dive Agenda', bullets: ['Annual performance across strategies', 'Risk‑return attribution & positioning', 'Forward outlook & strategic adjustments'] },
    { icon: 'calendar', t: 'Cadence & Outcomes', lines: [['Timeline', 'Once every year.'], ['Purpose', 'Align long‑term goals, review progress, and set expectations for the year ahead.']] },
  ] },
  { h: 'Response SLA', cards: [
    { icon: 'message', t: 'Standard Queries', lines: [['Email / WhatsApp', 'Response within 1 business day.']] },
    { icon: 'clipboard', t: 'Operational Requests', lines: [['Top‑up, withdrawal, KYC', 'Acknowledged next day, executed as per regulatory timelines.']] },
    { icon: 'shield', t: 'Escalations', lines: [['Routing', 'Escalated within 24 hours to Compliance if not resolved.']] },
  ] },
];

export function ReportsReviews() {
  return (
    <>
      <Body>Stay consistently informed with structured reports and timely reviews. From monthly updates to annual reviews, everything is designed to keep you aligned with your portfolio and goals.</Body>
      {CADENCE.map(sec => (
        <View key={sec.h}>
          <Heading>{sec.h}</Heading>
          {!!sec.note && <Tx s={12} c={C.muted} style={{ fontStyle: 'italic', marginTop: -4, marginBottom: 10 }}>{sec.note}</Tx>}
          {sec.cards.map(c => (
            <Card key={c.t} style={{ padding: 16, marginBottom: 10, flexDirection: 'row', gap: 14 }}>
              <IconDot name={c.icon} />
              <View style={{ flex: 1 }}>
                <Tx w={700} s={14}>{c.t}</Tx>
                {(c.lines || []).map(([l, t]) => <Labelled key={l} label={l} style={{ marginTop: 6 }}>{t}</Labelled>)}
                {!!c.bullets && <Bullets items={c.bullets} color={C.green} />}
              </View>
            </Card>
          ))}
        </View>
      ))}
    </>
  );
}

// ── Strategy Snapshot ─────────────────────────────────────────────────────────
// Colours: myQode/lib/strategyConfig.ts STRATEGY_COLORS + the snapshot page's gradient ends.
const STRATS = [
  { code: 'QAW', title: 'Qode All Weather (QAW)™', color: '#008455', accent: '#001E13', benchmark: 'NIFTY 50',
    desc: 'Qode All Weather (QAW) is a multi-asset portfolio crafted to deliver consistent long-term performance without timing the markets. This robust framework ensures strong probability of outperforming large cap indices over longer horizons.',
    pills: ['Large cap Alpha', 'Highest Sharpe*', 'Smart Asset Mix', 'Downside Cushion'] },
  { code: 'QTF', title: 'Qode Tactical Fund (QTF)™', color: '#550E0E', accent: '#360404', benchmark: 'NIFTY MIDCAP 150',
    desc: 'Qode Tactical Fund harnesses the power of momentum, systematically allocating to the strongest market trends while avoiding laggards. This allows the strategy to capture upside faster and deliver higher long-term returns.',
    pills: ['Momentum Driven', 'Tactical Rebalance', 'Regime Switch', 'Hedge Overlay*'] },
  { code: 'QGF', title: 'Qode Growth Fund (QGF)™', color: '#0A3452', accent: '#051E31', benchmark: 'NIFTY SMLCAP 250',
    desc: 'Qode Growth Fund (QGF) is a factor-based small-cap strategy designed to outperform over long periods. The strategy identifies fundamentally strong, high-growth businesses using a disciplined quantitative model.',
    pills: ['Quantitative Strategy', 'Small cap focused', 'Multifactor Model', 'Growth Investing'] },
];
const GLOSSARY = [
  ['Highest Sharpe*', 'A measure of risk-adjusted returns - higher values indicate better performance per unit of risk taken.'],
  ['Hedge Overlay*', 'Risk management technique using derivatives to protect against adverse market movements while maintaining upside potential.'],
  ['Uncharted*', 'Investing in lesser-known companies with limited analyst coverage, potentially offering undiscovered opportunities.'],
];
// Dotted circles, as the web card's pattern overlay.
const Dots = () => (
  <Svg width="100%" height="100%" style={{ position: 'absolute', opacity: 0.1 }} viewBox="0 0 200 200" preserveAspectRatio="xMaxYMin slice">
    {[30, 55, 80, 105].map(r => <Circle key={r} cx={200} cy={0} r={r} stroke="#fff" strokeWidth={1} strokeDasharray="2 5" fill="none" />)}
  </Svg>
);

export function StrategySnapshot() {
  const [open, setOpen] = useState(null);
  return (
    <>
      <Body>Discover Qode's investment strategies and their core pillars designed for different risk profiles and investment horizons.</Body>
      {STRATS.map(s => (
        <LinearGradient key={s.code} colors={[s.color, s.accent]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={{ borderRadius: 20, marginTop: 16, overflow: 'hidden', padding: 20 }}>
          <Dots />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={{ width: 28, height: 4, borderRadius: 2, backgroundColor: '#fff' }} />
            <Tx w={700} s={11} ls={0.2} c="rgba(255,255,255,0.8)">{s.code}</Tx>
          </View>
          <Tx f="play" w={700} s={22} c="#fff" style={{ marginTop: 10 }}>{s.title}</Tx>
          <Tx s={13} lh={1.6} c="rgba(255,255,255,0.9)" style={{ marginTop: 8 }}>{s.desc}</Tx>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 16 }}>
            {s.pills.map(p => (
              <View key={p} style={{ width: '48%', flexGrow: 1, backgroundColor: 'rgba(255,255,255,0.92)', borderRadius: 10, borderWidth: 2, borderColor: s.color, paddingVertical: 10, paddingHorizontal: 10 }}>
                <Tx w={700} s={12} c="#1F2937" center>{p}</Tx>
              </View>
            ))}
          </View>
          <Tx s={11} c="rgba(255,255,255,0.75)" style={{ marginTop: 14 }}>Benchmark: {s.benchmark}</Tx>
        </LinearGradient>
      ))}
      <Card style={{ padding: 16, marginTop: 20, backgroundColor: '#F9FAFB' }}>
        <Tx f="play" w={600} s={18}>Glossary</Tx>
        {GLOSSARY.map(([t, d], i) => (
          <Pressable key={t} onPress={() => setOpen(open === t ? null : t)} style={{ marginTop: 12, paddingTop: i ? 12 : 0, borderTopWidth: i ? 1 : 0, borderColor: C.hairline }}>
            <Tx w={700} s={13}>{t}</Tx>
            <Tx s={12.5} c={C.muted} lh={1.55} style={{ marginTop: 3 }}>{d}</Tx>
          </Pressable>
        ))}
      </Card>
    </>
  );
}

// ── Investor Portal Guide ─────────────────────────────────────────────────────
const WEALTHSPECTRUM = 'https://eclientreporting.nuvamaassetservices.com/wealthspectrum/app/';
const PASSWORD_PDF = WEB + '/tutorial-document/How%20to%20Generate%20Your%20Password%20on%20Wealth%20Spectrum.pdf';
const ACCESS = [
  ['Dashboard', 'Gives you a quick snapshot of your portfolio with total assets, number of strategies, and linked accounts. The asset allocation chart shows how your investments are distributed across equity, fixed income, options, and cash.'],
  ['Portfolio', 'Shows detailed information about your holdings, including cost, market value, unrealized gains/losses, and percentage allocation for each security.'],
  ['Performance', 'Tracks how your portfolio has performed over time. You can view overall portfolio returns, compare with benchmarks, and check trailing returns for 1M, 3M, and 6M periods.'],
  ['Allocations', 'Provides a clear breakdown of investments across asset classes and strategies, helping you understand portfolio diversification.'],
  ['Transactions', 'Lists all portfolio activities including purchases, sales, and cash movements, along with realized gains and losses.'],
  ['Reports', 'Access a variety of detailed reports that you will require. Below is the detailed breakdown with snapshots and video tutorials.'],
];
const REPORT_GROUPS = [
  ['Accounting & Financial Report', [['Account Statement - Non unitized'], ['Account Statement'], ['Profit and Loss Account - Balance Sheet', 'Annual Compliance Reports'], ['Trial Balance']]],
  ['Activity Report', [['Transaction Statement', 'Annual Compliance Reports'], ['Capital Register', 'Annual Compliance Reports'], ['Bank Book']]],
  ['Income, Expenses & Tax Report', [['Statement of Interest'], ['Statement of Dividend'], ['Corporate Benefit', 'Annual Compliance Reports'], ['Statement of Expenses', 'Annual Compliance Reports'], ['Statement of Capital Gain/Loss', 'Annual Compliance Reports']]],
  ['Portfolio Reporting & Performance', [['Portfolio Fact Sheet'], ['Portfolio Position Analysis'], ['Portfolio Performance Summary'], ['Performance Appraisal', 'Annual Compliance Reports'], ['Portfolio Performance with Benchmarks'], ['Performance by Security Since Inception'], ['Portfolio Appraisal']]],
  ['Combined Report', [['PMS Investor Report', 'Quarterly Compliance Reports']]],
];
// Same matching as the web: a video is <report name>.mp4, snapshots sit in a folder named after the report;
// "Statement of Capital Gain/Loss" is stored without the slash.
const norm = s => String(s || '').toLowerCase().replace(/\.[a-z0-9]+$/, '').replace(/\//g, ' ').replace(/\s+/g, ' ').trim();

function SnapshotViewer({ report, images, onClose }) {
  const W = Dimensions.get('window').width;
  const [i, setI] = useState(0);
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,16,8,0.94)', paddingTop: 50 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18 }}>
          <View style={{ flex: 1 }}>
            <Tx w={700} s={14} c={C.cream} numberOfLines={1}>{report}</Tx>
            <Tx s={11} c={C.cream60}>Snapshot {i + 1} of {images.length}</Tx>
          </View>
          <Pressable onPress={onClose} hitSlop={12} style={{ padding: 8 }}><Tx w={700} s={13} c={C.gold}>CLOSE</Tx></Pressable>
        </View>
        <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} style={{ flex: 1, marginTop: 14 }}
          onMomentumScrollEnd={e => setI(Math.round(e.nativeEvent.contentOffset.x / W))}>
          {images.map(im => (
            <View key={im.key} style={{ width: W, paddingHorizontal: 12, justifyContent: 'center' }}>
              <Image source={{ uri: im.url }} style={{ width: '100%', height: '85%' }} resizeMode="contain" />
            </View>
          ))}
        </ScrollView>
        <Tx s={11} c={C.cream60} center style={{ paddingBottom: 30 }}>Swipe for more</Tx>
      </View>
    </Modal>
  );
}

export function PortalGuide() {
  const g = useLoad(() => engagement.portalGuide(), []);
  const [viewer, setViewer] = useState(null);
  const videos = (g.data && g.data.videos) || [];
  const snapByFolder = (g.data && g.data.byReport && g.data.byReport.snapshots) || {};
  const videoFor = name => videos.find(v => norm(v.filename) === norm(name));
  const snapsFor = name => { const k = Object.keys(snapByFolder).find(f => norm(f) === norm(name)); return k ? snapByFolder[k] : []; };
  let n = 0;
  return (
    <>
      <Banner>Access all your portfolio details anytime on our secure reporting portal.</Banner>
      <Body style={{ marginTop: 14 }}>At Qode, transparency is central to our philosophy. That's why we provide 24x7 access to your portfolio through <Tx w={700} s={13} c={C.ink}>WealthSpectrum</Tx>, our secure reporting partner. From performance snapshots to tax packs, everything you need is organized in one place.</Body>
      <Image source={{ uri: WEB + '/nuvama-dashboard.png' }} style={{ width: '100%', aspectRatio: 16 / 10, borderRadius: 10, marginTop: 16, borderWidth: 1, borderColor: C.hairline, backgroundColor: '#fff' }} resizeMode="contain" accessibilityLabel="Nuvama WealthSpectrum Dashboard screenshot" />
      <CTA label="OPEN WEALTHSPECTRUM PORTAL" onPress={() => go(WEALTHSPECTRUM)} style={{ marginTop: 16 }} />
      <Tx s={11.5} c={C.muted} center style={{ fontStyle: 'italic', marginTop: 8 }}>Your WealthSpectrum login can be either your Account ID or your registered Email ID.</Tx>
      <Card style={{ padding: 14, marginTop: 14, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Tx s={12.5} c={C.muted} lh={1.5} style={{ flex: 1 }}>Need help setting up your password on the WealthSpectrum portal?</Tx>
        <Pressable onPress={() => openUrl(PASSWORD_PDF)} style={{ borderWidth: 1, borderColor: C.greenBorder, borderRadius: 8, paddingVertical: 9, paddingHorizontal: 12 }}>
          <Tx w={700} s={11} c={C.green}>GUIDE (PDF)</Tx>
        </Pressable>
      </Card>

      <Heading>What You Can Access</Heading>
      <Card style={{ overflow: 'hidden' }}>
        {ACCESS.map(([f, d], i) => (
          <View key={f} style={{ padding: 14, borderBottomWidth: i < ACCESS.length - 1 ? 1 : 0, borderColor: C.hairline }}>
            <Tx w={700} s={13} c={C.green}>{f}</Tx>
            <Tx s={12.5} c={C.muted} lh={1.55} style={{ marginTop: 4 }}>{d}</Tx>
          </View>
        ))}
      </Card>

      <Heading>Reports Available</Heading>
      {g.loading && <Tx s={11.5} c={C.muted} style={{ marginBottom: 10 }}>Loading snapshots and video tutorials…</Tx>}
      {!!g.err && <Tx s={11.5} c={C.red} style={{ marginBottom: 10 }}>Unable to load snapshots and videos. Some content may not be available.</Tx>}
      {REPORT_GROUPS.map(([type, reports]) => (
        <View key={type} style={{ marginBottom: 14 }}>
          <Tx w={700} s={10.5} ls={0.1} c={C.muted} style={{ marginBottom: 8, marginLeft: 2 }}>{type.toUpperCase()}</Tx>
          <Card style={{ overflow: 'hidden' }}>
            {reports.map(([name, usedFor], i) => {
              n += 1;
              const v = videoFor(name), snaps = snapsFor(name);
              return (
                <View key={name} style={{ paddingVertical: 12, paddingHorizontal: 14, borderBottomWidth: i < reports.length - 1 ? 1 : 0, borderColor: C.hairline }}>
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <Tx w={700} s={11} c={C.gray} style={{ width: 20 }}>{n}</Tx>
                    <View style={{ flex: 1 }}>
                      <Tx w={700} s={13}>{name}</Tx>
                      {!!usedFor && <Tx s={11} c={C.muted} style={{ marginTop: 2 }}>Used for: {usedFor}</Tx>}
                      {(snaps.length > 0 || !!v) && (
                        <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                          {snaps.length > 0 && (
                            <Pressable onPress={() => setViewer({ report: name, images: snaps })} style={{ borderWidth: 1, borderColor: C.greenBorder, borderRadius: 999, paddingVertical: 6, paddingHorizontal: 12 }}>
                              <Tx w={700} s={10.5} c={C.green}>SNAPSHOT{snaps.length > 1 ? 'S · ' + snaps.length : ''}</Tx>
                            </Pressable>
                          )}
                          {!!v && (
                            <Pressable onPress={() => openUrl(v.url)} style={{ backgroundColor: C.green, borderRadius: 999, paddingVertical: 6, paddingHorizontal: 12 }}>
                              <Tx w={700} s={10.5} c={C.gold}>▶ WATCH</Tx>
                            </Pressable>
                          )}
                        </View>
                      )}
                    </View>
                  </View>
                </View>
              );
            })}
          </Card>
        </View>
      ))}
      {!!viewer && <SnapshotViewer report={viewer.report} images={viewer.images} onClose={() => setViewer(null)} />}
    </>
  );
}

// ── Your Team at Qode ─────────────────────────────────────────────────────────
const BOOKING = 'https://crm.zoho.in/bookings/30minutesmeeting?rid=5ec313c47c4d600297f76c4db5ed16b9ec7023047ad9adae51cf7233a95aed39b78a114a405bd5ecb516bbd5c82eb973gid34d89af86b644a5bbc06e671dae756f5663840a52f688352fdf9715c33a97bcd';
const IR = 'investor.relations@qodeinvest.com';

function ChannelCard({ icon, title, children }) {
  return (
    <Card style={{ padding: 16, marginTop: 14 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingBottom: 10, borderBottomWidth: 1, borderColor: C.hairline }}>
        <IconDot name={icon} />
        <Tx f="play" w={600} s={18} style={{ flex: 1 }}>{title}</Tx>
      </View>
      {children}
    </Card>
  );
}

export function Team({ V }) {
  const code = (V && V.acctCode) || (V && V.user && V.user.clientCode) || '';
  return (
    <>
      <View><Banner>We believe investing is a partnership. Here are the people and channels dedicated to supporting you.</Banner></View>

      <ChannelCard icon="trend" title="Fund Manager">
        <Labelled label="Role" style={{ marginTop: 10 }}>Oversees your portfolio strategy and ensures alignment with Qode's philosophy.</Labelled>
        <Labelled label="When to Contact" style={{ marginTop: 6 }}>Strategy-specific queries and high-level portfolio discussions.</Labelled>
        <CTA label="ASK A QUESTION ON STRATEGY" onPress={() => V && V.openReq('r-strategy')} style={{ marginTop: 14, paddingVertical: 12 }} />
      </ChannelCard>

      <ChannelCard icon="user" title="Investor Relations">
        <Labelled label="Role" style={{ marginTop: 10 }}>Your regular point of contact. Shares monthly updates, schedules review calls, and addresses queries. Also helps with operations: onboarding, top‑ups, withdrawals, portal access.</Labelled>
        <Labelled label="When to Contact" style={{ marginTop: 6 }}>For reports, account queries, operational clarifications, and all quarterly/annual reviews.</Labelled>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
          <CTA label="CONTACT IR TEAM" onPress={() => go(`mailto:${IR}?subject=${encodeURIComponent('IR Support Request - ' + (code || 'Account'))}`)} style={{ flex: 1, paddingVertical: 12 }} />
          {/* web: "Raise Any Query" opens the discussion-topic form (inquiry_type 'discussion') */}
          <CTA label="RAISE ANY QUERY" outline onPress={() => V && V.openReq('r-discussion')} style={{ flex: 1, paddingVertical: 12 }} />
        </View>
        <Tx s={11} c={C.gray} style={{ marginTop: 8 }}>We will get back to you promptly.</Tx>
      </ChannelCard>

      <ChannelCard icon="calendar" title="Book A Call">
        <Labelled label="Purpose" style={{ marginTop: 10 }}>Quick, hassle‑free scheduling of calls with your IR team.</Labelled>
        <CTA label="BOOK A CALL" onPress={() => go(BOOKING)} style={{ marginTop: 14, paddingVertical: 12 }} />
      </ChannelCard>

      <ChannelCard icon="message" title="WhatsApp / Email">
        <Pressable onPress={() => go(`https://wa.me/919820300028?text=${encodeURIComponent('Hi! I am ' + (code || 'a client') + ' and would like to discuss my account')}`)} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12 }}>
          <Phone />
          <View style={{ flex: 1 }}>
            <Tx w={700} s={12.5}>WhatsApp (IR Desk)</Tx>
            <Tx s={12} c={C.green}>+91 98203 00028 · 9 AM – 5 PM</Tx>
          </View>
          <ChevronRight />
        </Pressable>
        <Pressable onPress={() => go(`mailto:${IR}?subject=${encodeURIComponent('Account Query - ' + (code || 'Client'))}`)} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12 }}>
          <MailIcon />
          <View style={{ flex: 1 }}>
            <Tx w={700} s={12.5}>Email</Tx>
            <Tx s={12} c={C.green}>{IR}</Tx>
          </View>
          <ChevronRight />
        </Pressable>
        <Labelled label="Purpose" style={{ marginTop: 12 }}>Instant, informal, and quick communication.</Labelled>
        <Pressable onPress={() => go('https://chat.whatsapp.com/IW7eHWZjWAq54MyKvZtQdC')} style={{ marginTop: 14, backgroundColor: C.gold, borderRadius: 8, paddingVertical: 13, alignItems: 'center' }}>
          <Tx w={700} s={12.5} ls={0.06} c={C.ink}>JOIN QODE INVESTOR CIRCLE</Tx>
        </Pressable>
        <Tx s={11} c={C.gray} center style={{ marginTop: 6 }}>WhatsApp community for Qode investors</Tx>
      </ChannelCard>
    </>
  );
}

// ── Escalation Framework ──────────────────────────────────────────────────────
const LEVELS = [
  { n: 1, t: 'Investor Relations (IR)', lines: [['Role', 'Your first point of contact for all queries — from portfolio updates to operational requests.'], ['Response SLA', 'Within 1 business day.']],
    contacts: [['investor.relations@qodeinvest.com', 'mailto:investor.relations@qodeinvest.com'], ['WhatsApp IR Desk', 'https://wa.me/919820300028']] },
  { n: 2, t: 'Compliance Officer', lines: [['Role', "If an issue isn't resolved by IR, it's escalated to the Compliance Officer for review and redressal."], ['Scope', 'Regulatory matters, delayed responses, or unresolved service issues.'], ['Escalation Timeline', 'Within 24 hours of non‑resolution at Level 1.']],
    contacts: [['compliance@qodeinvest.com', 'mailto:compliance@qodeinvest.com']] },
  { n: 3, t: 'Principal Officer', lines: [['Role', 'Final level of escalation, handled directly by the Principal Officer.'], ['Scope', 'Persistent grievances or concerns requiring senior oversight.'], ['Escalation Timeline', 'If unresolved at Compliance level within prescribed timeframes.']],
    contacts: [['karan.salecha@qodeinvest.com', 'mailto:karan.salecha@qodeinvest.com']] },
];

export function Escalation() {
  return (
    <>
      <Body>We take every investor query seriously. If something isn't resolved quickly by our Investor Relations team, this structured framework ensures clarity and accountability.</Body>
      {LEVELS.map((l, i) => (
        <View key={l.n} style={{ flexDirection: 'row', gap: 14, marginTop: 16 }}>
          {/* step rail */}
          <View style={{ alignItems: 'center' }}>
            <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: C.green, alignItems: 'center', justifyContent: 'center' }}>
              <Tx w={700} s={13} c={C.gold}>{l.n}</Tx>
            </View>
            {i < LEVELS.length - 1 && <View style={{ flex: 1, width: 2, backgroundColor: 'rgba(2,66,43,0.2)', marginTop: 4 }} />}
          </View>
          <Card style={{ flex: 1, padding: 16 }}>
            <Tx w={700} s={10} ls={0.12} c={C.muted}>LEVEL {l.n}</Tx>
            <Tx w={700} s={15} style={{ marginTop: 2 }}>{l.t}</Tx>
            {l.lines.map(([k, t]) => <Labelled key={k} label={k} style={{ marginTop: 6 }}>{t}</Labelled>)}
            <View style={{ marginTop: 10, gap: 6 }}>
              {l.contacts.map(([label, url]) => (
                <Pressable key={label} onPress={() => go(url)} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  {url.startsWith('mailto') ? <MailIcon s={14} /> : <Phone s={14} />}
                  <Tx w={700} s={12.5} c={C.green} style={{ flex: 1 }}>{label}</Tx>
                </Pressable>
              ))}
            </View>
          </Card>
        </View>
      ))}
      <Card style={{ padding: 16, marginTop: 18, borderWidth: 1, borderColor: C.gold35 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <LineIcon name="shield" />
          <Tx w={700} s={14}>Investor Protection</Tx>
        </View>
        <Body style={{ marginTop: 6 }}>All complaints and resolutions are documented and reviewed periodically.</Body>
      </Card>
    </>
  );
}
