// Desktop web versions of the content pages (src/screens/pages.js + about.js). Same data, calls and actions as the
// phone pages, laid out with the web design system (./kit): articles in a reading column with a sticky
// "On this page" rail, tables for tabular data, multi-column grids for everything else.
import React, { useState } from 'react';
import { View, Pressable, Image, Linking, Platform } from 'react-native';
import { C, Tx, Amt, Card, Row, Grid, Label, Panel, Stat, DarkCard, Btn, Chips, Tabs, Table, KeyVals, TextLink, Pill, Loading, Empty, ErrorBlock, Dialog, sentence } from './kit';
import { DesktopVoice } from './voice';
import { DesktopTransactions } from './transactions';
import { NuvamaDetails } from './nuvama';
import { inr } from '../adapt';
import { ChevronRight, ChevronDown, Phone, MailIcon } from '../icons';
import { experience, engagement } from '../api';
import * as content from '../content';
import { FormBody } from '../screens/services';
import { useLoad, openUrl, fmtSize } from '../screens/kit';
import { REFERRAL_FORM } from '../screens/pages';
import { irLinks } from '../screens/contact';
import { ContactCard } from './contact';
import { NotificationSettings } from '../screens/notifications';
import {
  WEB, MANAGERS, CADENCE, STRATS, STRAT_GLOSSARY, WEALTHSPECTRUM, PASSWORD_PDF, ACCESS, REPORT_GROUPS, norm,
  BOOKING, LEVELS, LineIcon,
} from '../screens/about';

const go = url => Linking.openURL(url).catch(() => {});
const slug = s => 'sec-' + String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const scrollTo = id => {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
};
const sticky = Platform.OS === 'web' ? { position: 'sticky', top: 0 } : null;

// Title Case copy from the shared content ("Timeline & Purpose") reads as a sentence on the web.
const KEEP_WORDS = new Set(['Qode', 'SEBI', 'IR', 'KYC', 'WhatsApp', 'QAW', 'QTF', 'QGF', 'PMS']);
const sc = t => String(t || '').split(' ').map((w, i) => (i === 0 || KEEP_WORDS.has(w.replace(/[^A-Za-z]/g, '')) || w === w.toUpperCase() ? w : w.toLowerCase())).join(' ');

/* ── Local pieces ──────────────────────────────────────────────────────────────────────────────────────── */
const Body = ({ children, style, s = 14 }) => <Tx s={s} lh={1.7} c={C.ink2} style={style}>{children}</Tx>;
const Labelled = ({ label, children, style, dark }) => (
  <Tx s={13} lh={1.6} c={dark ? C.cream60 : C.ink2} style={style}><Tx w={600} s={13} c={dark ? C.cream : C.ink}>{sc(label)}: </Tx>{children}</Tx>
);
const Bullet = ({ children }) => (
  <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
    <View style={{ width: 5, height: 5, borderRadius: 1, backgroundColor: C.green, marginTop: 8 }} />
    <Tx s={13} lh={1.55} c={C.ink2} style={{ flex: 1 }}>{children}</Tx>
  </View>
);
const IconChip = ({ name, dark }) => (
  <View style={{ width: 34, height: 34, borderRadius: 8, backgroundColor: dark ? 'rgba(255,255,255,0.08)' : C.greenTint, alignItems: 'center', justifyContent: 'center' }}>
    <LineIcon name={name} c={dark ? C.gold : C.green} />
  </View>
);
const SectionTitle = ({ children, sub, right, style }) => (
  <View style={[{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, marginTop: 32, marginBottom: 14 }, style]}>
    <View style={{ flexShrink: 1 }}>
      <Tx w={600} s={16} role="heading" aria-level={2}>{sentence(children)}</Tx>
      {!!sub && <Tx s={12.5} c={C.ink3} style={{ marginTop: 3 }}>{sub}</Tx>}
    </View>
    {right}
  </View>
);
const Lead = ({ children, style }) => <Tx s={15} lh={1.65} c={C.ink2} style={[{ maxWidth: 760 }, style]}>{children}</Tx>;

/* ── Side rail: "On this page" + related pages ─────────────────────────────────────────────────────────── */
const RELATED = {
  about: [['philosophy', 'Qode Philosophy'], ['foundation', 'Foundation'], ['strategies', 'Strategy Snapshot'], ['team', 'Your Team at Qode']],
  legal: [['privacy', 'Privacy policy'], ['terms', 'Terms and conditions'], ['cancellation', 'Cancellation and refund'], ['risk', 'Risk Management & Controls'], ['grievance', 'Escalation and Grievance Redressal']],
};
function Rail({ V, toc, related, children }) {
  const rel = related ? related.filter(([k]) => k !== V.page) : [];
  return (
    <View style={[{ width: 300, gap: 16 }, sticky]}>
      {toc && toc.length > 1 && (
        <Panel title="On this page" pad={10}>
          {toc.map(([id, label]) => (
            <Pressable key={id} accessibilityRole="link" onPress={() => scrollTo(id)} style={({ hovered }) => ({
              paddingVertical: 7, paddingHorizontal: 10, borderRadius: 6, borderLeftWidth: 2,
              borderLeftColor: hovered ? C.green : C.line, backgroundColor: hovered ? C.hover : 'transparent', marginTop: 2,
            })}>
              <Tx s={13} c={C.ink2} numberOfLines={2}>{label}</Tx>
            </Pressable>
          ))}
        </Panel>
      )}
      {children}
      {rel.length > 0 && (
        <Panel title="Related">
          <View style={{ gap: 12 }}>
            {rel.map(([k, l]) => <TextLink key={k} label={l} onPress={() => V.openPage(k)} />)}
          </View>
        </Panel>
      )}
    </View>
  );
}

/** Two columns: a ~720 px reading column and the sticky rail. */
const WithRail = ({ children, rail }) => (
  <Row top gap={32}>
    <View style={{ flex: 1, maxWidth: 740, minWidth: 0 }}>{children}</View>
    {rail}
  </Row>
);

/* ── Articles (philosophy, legal) ──────────────────────────────────────────────────────────────────────── */
function ArticleBody({ data }) {
  const intro = data.intro || [];
  return (
    <Card style={{ paddingVertical: 36, paddingHorizontal: 44 }}>
      {intro.map((t, i) => <Tx key={'i' + i} s={i ? 14.5 : 16} lh={1.7} c={i ? C.ink2 : C.ink} style={{ marginTop: i ? 12 : 0 }}>{t}</Tx>)}
      {(data.sections || []).map((s, i) => (
        <View key={i} nativeID={s.h ? slug(s.h) : undefined} style={{ marginTop: i || intro.length ? 30 : 0, paddingTop: i || intro.length ? 26 : 0, borderTopWidth: i || intro.length ? 1 : 0, borderColor: C.line }}>
          {!!s.h && <Tx f="play" w={600} s={21} lh={1.3} role="heading" aria-level={2} style={{ marginBottom: 6 }}>{s.h}</Tx>}
          {(s.p || []).map((t, j) => <Body key={j} s={14.5} style={{ marginTop: j ? 12 : 6 }}>{t}</Body>)}
        </View>
      ))}
    </Card>
  );
}
function ArticlePage({ V, data, related }) {
  const toc = (data.sections || []).filter(s => s.h).map(s => [slug(s.h), s.h.replace(/:$/, '')]);
  return (
    <WithRail rail={<Rail V={V} toc={toc} related={related} />}>
      <ArticleBody data={data} />
    </WithRail>
  );
}

/* ── Family accounts ───────────────────────────────────────────────────────────────────────────────────── */
const initials = n => String(n || '?').split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase();
const dash = v => v || '–';
const FAMILY_COLS = [
  { key: 'clientcode', label: 'Account', flex: 1.1, render: a => <Tx w={600} s={13.5}>{a.clientcode}</Tx> },
  { key: 'relation', label: 'Relation', flex: 0.9, render: a => <Tx s={13} c={C.ink2}>{dash(a.relation)}</Tx> },
  { key: 'value', label: 'Portfolio value', right: true, flex: 1.2, render: a => <Amt s={13.5} w={600}>{a.portfolioValue > 0 ? inr(a.portfolioValue) : '–'}</Amt> },
  { key: 'pan', label: 'PAN', flex: 1, render: a => <Tx s={13} c={C.ink2}>{dash(a.pannumber)}</Tx> },
  { key: 'mobile', label: 'Mobile', flex: 1, render: a => <Tx s={13} c={C.ink2}>{dash(a.mobile)}</Tx> },
  { key: 'city', label: 'City', flex: 0.9, render: a => <Tx s={13} c={C.ink2}>{dash(a.city)}</Tx> },
  { key: 'status', label: 'Status', right: true, flex: 0.8, render: a => <Pill label={String(a.status || '–')} tone={a.status === 'Active' ? 'ok' : 'neutral'} /> },
];
function Family() {
  const fam = useLoad(() => experience.family(), []);
  if (fam.loading) return <Loading rows={4} />;
  if (fam.err) return <ErrorBlock msg={fam.err} onRetry={fam.reload} />;
  const tree = (fam.data && fam.data.tree) || [];
  if (!tree.length) return <Empty>No family accounts to show.</Empty>;
  return (
    <View style={{ gap: 32 }}>
      {tree.map(g => {
        const accts = g.owners.flatMap(o => o.accounts);
        const total = accts.reduce((s, a) => s + (Number(a.portfolioValue) || 0), 0);
        const active = accts.filter(a => a.status === 'Active').length;
        return (
          <View key={g.groupId || g.groupName} style={{ gap: 16 }}>
            <Row>
              <Card style={{ flex: 1.4, paddingVertical: 16, paddingHorizontal: 18, justifyContent: 'center', borderLeftWidth: 3, borderLeftColor: C.green }}>
                <Label>Family group</Label>
                <Tx w={600} s={20} style={{ marginTop: 6 }} numberOfLines={1}>{g.groupName}</Tx>
              </Card>
              <Stat label="Members" value={String(g.owners.length)} style={{ flex: 1 }} />
              <Stat label="Accounts" value={String(accts.length)} note={active + ' active'} style={{ flex: 1 }} />
              {total > 0 && <Stat label="Combined value" value={inr(total)} style={{ flex: 1.3 }} />}
            </Row>
            {g.owners.map(o => {
              const sub = o.accounts.reduce((s, a) => s + (Number(a.portfolioValue) || 0), 0);
              const count = o.accounts.length + (o.accounts.length === 1 ? ' account' : ' accounts');
              return (
                <Panel key={o.ownerId} pad={0} title={
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <View style={{ width: 36, height: 36, borderRadius: 8, backgroundColor: C.greenTint, alignItems: 'center', justifyContent: 'center' }}>
                      <Tx w={600} s={12} c={C.green}>{initials(o.ownerName)}</Tx>
                    </View>
                    <View>
                      <Tx w={600} s={14.5}>{o.ownerName}</Tx>
                      {!!o.ownerEmail && <Tx s={12} c={C.ink3}>{o.ownerEmail}</Tx>}
                    </View>
                  </View>
                } right={
                  <View style={{ alignItems: 'flex-end' }}>
                    <Tx s={12} c={C.ink3}>{count}</Tx>
                    {sub > 0 && <Amt w={600} s={15} style={{ marginTop: 2 }}>{inr(sub)}</Amt>}
                  </View>
                }>
                  <Table dense cols={FAMILY_COLS} rows={o.accounts.map(a => ({ ...a, id: a.clientcode }))} empty="No accounts." />
                </Panel>
              );
            })}
          </View>
        );
      })}
      <Tx s={12.5} c={C.ink3}>To change how accounts are grouped, raise an account request from Services.</Tx>
    </View>
  );
}

/* ── Insights ──────────────────────────────────────────────────────────────────────────────────────────── */
const INSIGHT_ABOUT = {
  newsletters: ['Monthly newsletters', 'Our regular letters to investors: markets, strategy updates and what changed in the portfolios.'],
  perspectives: ['Perspectives', 'Longer reads from the fund managers on the ideas behind how Qode invests.'],
};
function Insights() {
  const [tab, setTab] = useState('newsletters');
  const list = useLoad(() => engagement[tab](), [tab]);
  const items = (list.data && list.data.items) || [];
  const cols = [
    { key: 'title', label: 'Title', flex: 3, render: it => <Tx w={600} s={13.5} numberOfLines={2}>{it.title}</Tx> },
    { key: 'type', label: 'Format', flex: 0.8, render: it => <Pill label={it.type === 'pdf' ? 'PDF' : 'File'} /> },
    { key: 'size', label: 'Size', flex: 0.8, right: true, render: it => <Tx s={13} c={C.ink2}>{fmtSize(it.size) || '–'}</Tx> },
    { key: 'open', label: '', flex: 0.7, right: true, render: () => <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}><Tx w={600} s={13} c={C.green}>Open</Tx><ChevronRight s={11} c={C.green} /></View> },
  ];
  const [aboutTitle, aboutText] = INSIGHT_ABOUT[tab];
  return (
    <Row top gap={24}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Tabs value={tab} options={[['newsletters', 'Newsletters'], ['perspectives', 'Perspectives']]} onChange={setTab} style={{ marginBottom: 18 }} />
        {list.loading && <Loading rows={5} />}
        {!!list.err && <ErrorBlock msg={list.err} onRetry={list.reload} />}
        {!list.loading && !list.err && !items.length && <Empty>Nothing published here yet.</Empty>}
        {!list.loading && !list.err && items.length > 0 && (
          <Card style={{ overflow: 'clip' }}>
            <Table cols={cols} rows={items.map(it => ({ ...it, id: it.key }))} onRowPress={it => openUrl(it.url)} />
          </Card>
        )}
      </View>
      <View style={[{ width: 300, gap: 16 }, sticky]}>
        <Panel title={aboutTitle} sub="From the Qode desk">
          <Body s={13}>{aboutText}</Body>
          {!list.loading && !list.err && (
            <KeyVals style={{ marginTop: 12, borderTopWidth: 1, borderColor: C.line }} items={[['Published', String(items.length)]]} />
          )}
        </Panel>
      </View>
    </Row>
  );
}

/* ── Investor portal guide ─────────────────────────────────────────────────────────────────────────────── */
function SnapshotDialog({ report, images, onClose }) {
  const [i, setI] = useState(0);
  const im = images[i];
  return (
    <Dialog visible title={report} onClose={onClose} width={960}>
      <Image source={{ uri: im.url }} style={{ width: '100%', aspectRatio: 16 / 10, backgroundColor: '#fff', borderRadius: 8 }} resizeMode="contain" accessibilityLabel={report + ' snapshot ' + (i + 1)} />
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14 }}>
        <Btn label="Previous" kind="outline" small disabled={i === 0} onPress={() => setI(i - 1)} />
        <Tx s={13} c={C.ink2}>Snapshot {i + 1} of {images.length}</Tx>
        <Btn label="Next" kind="outline" small disabled={i >= images.length - 1} onPress={() => setI(i + 1)} />
      </View>
    </Dialog>
  );
}

function PortalGuide() {
  // Hidden for now (4 Oct 2026): only the WealthSpectrum card shows. The snapshots / video tutorials and the
  // sections below are kept here to switch back on.
  /*
  const g = useLoad(() => engagement.portalGuide(), []);
  const [viewer, setViewer] = useState(null);
  const [grp, setGrp] = useState('all');
  const videos = (g.data && g.data.videos) || [];
  const snapByFolder = (g.data && g.data.byReport && g.data.byReport.snapshots) || {};
  const videoFor = name => videos.find(v => norm(v.filename) === norm(name));
  const snapsFor = name => { const k = Object.keys(snapByFolder).find(f => norm(f) === norm(name)); return k ? snapByFolder[k] : []; };
  let n = 0;
  const rows = REPORT_GROUPS.flatMap(([type, reports]) => reports.map(([name, usedFor]) => ({ id: name, n: ++n, name, usedFor, type })))
    .filter(r => grp === 'all' || r.type === grp);
  const cols = [
    { key: 'n', label: '#', flex: 0.3, render: r => <Tx s={12.5} c={C.ink3}>{r.n}</Tx> },
    { key: 'name', label: 'Report', flex: 2.2, render: r => <Tx w={600} s={13.5}>{r.name}</Tx> },
    { key: 'type', label: 'Type', flex: 1.8, render: r => <Tx s={13} c={C.ink2}>{r.type}</Tx> },
    { key: 'used', label: 'Used for', flex: 1.5, render: r => r.usedFor ? <Pill label={r.usedFor} /> : <Tx s={13} c={C.ink3}>–</Tx> },
    { key: 'act', label: 'Tutorials', flex: 1.7, right: true, render: r => {
      const v = videoFor(r.name), snaps = snapsFor(r.name);
      if (!v && !snaps.length) return <Tx s={13} c={C.ink3}>–</Tx>;
      return (
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {snaps.length > 0 && <Btn small kind="outline" label={snaps.length > 1 ? 'Snapshots (' + snaps.length + ')' : 'Snapshot'} onPress={() => setViewer({ report: r.name, images: snaps })} />}
          {!!v && <Btn small label="Watch video" onPress={() => openUrl(v.url)} />}
        </View>
      );
    } },
  ];
  */
  return (
    <View>
      <Row>
        <DarkCard style={{ flex: 1, justifyContent: 'center', padding: 28 }}>
          <Tx w={600} s={12.5} c={C.gold}>WealthSpectrum, available 24x7</Tx>
          <Tx f="play" w={600} s={24} c={C.cream} lh={1.3} style={{ marginTop: 10 }}>Access all your portfolio details anytime on our secure reporting portal.</Tx>
          <Tx s={13.5} lh={1.65} c={C.cream60} style={{ marginTop: 12 }}>At Qode, transparency is central to our philosophy. That's why we provide 24x7 access to your portfolio through WealthSpectrum, our secure reporting partner. From performance snapshots to tax packs, everything you need is organized in one place.</Tx>
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 20, flexWrap: 'wrap' }}>
            <Btn kind="gold" label="Open WealthSpectrum portal" onPress={() => go(WEALTHSPECTRUM)} />
            <Btn kind="outline" label="Password set-up guide (PDF)" onPress={() => openUrl(PASSWORD_PDF)} />
          </View>
          <Tx s={12} c={C.cream60} style={{ marginTop: 14 }}>Your WealthSpectrum login can be either your Account ID or your registered Email ID.</Tx>
        </DarkCard>
        {/*
        <Card style={{ flex: 1, padding: 12, justifyContent: 'center' }}>
          <Image source={{ uri: WEB + '/nuvama-dashboard.png' }} style={{ width: '100%', aspectRatio: 16 / 10, borderRadius: 8, backgroundColor: '#fff' }} resizeMode="contain" accessibilityLabel="Nuvama WealthSpectrum Dashboard screenshot" />
        </Card>
        */}
      </Row>

      {/*
      <SectionTitle>What you can access</SectionTitle>
      <Grid min={330}>
        {ACCESS.map(([f, d]) => (
          <Card key={f} style={{ padding: 18, flex: 1 }}>
            <Tx w={600} s={14.5}>{f}</Tx>
            <Body s={13} style={{ marginTop: 6 }}>{d}</Body>
          </Card>
        ))}
      </Grid>

      <SectionTitle right={g.loading ? <Tx s={12.5} c={C.ink3}>Loading snapshots and video tutorials…</Tx> : g.err ? <Tx s={12.5} c={C.red}>Unable to load snapshots and videos. Some content may not be available.</Tx> : null}>
        Reports available
      </SectionTitle>
      <Chips value={grp} options={[['all', 'All reports'], ...REPORT_GROUPS.map(([t]) => [t, t])]} onChange={setGrp} style={{ marginBottom: 14 }} />
      <Card style={{ overflow: 'clip' }}>
        <Table dense cols={cols} rows={rows} />
      </Card>
      {!!viewer && <SnapshotDialog report={viewer.report} images={viewer.images} onClose={() => setViewer(null)} />}
      */}
    </View>
  );
}

/* ── Referral ──────────────────────────────────────────────────────────────────────────────────────────── */
function Referral({ V }) {
  const pts = content.REFERRAL.points.map(t => { const i = t.indexOf(':'); return i > 0 ? [t.slice(0, i), t.slice(i + 1).trim()] : ['', t]; });
  return (
    // Both columns end on the same line: the rewards panel grows to the form's height.
    <Row gap={24}>
      <View style={{ flex: 1.1, gap: 16, minWidth: 0 }}>
        <DarkCard style={{ padding: 28 }}>
          <Tx w={600} s={12.5} c={C.gold}>Refer an investor</Tx>
          <Tx f="play" w={600} s={24} c={C.cream} style={{ marginTop: 8 }}>Share the Qode experience.</Tx>
          {/* the intro opens with the headline itself; say it once */}
          {content.REFERRAL.intro.map((t, i) => <Tx key={i} s={13.5} lh={1.65} c={C.cream60} style={{ marginTop: 10 }}>{t.replace(/^Share the Qode experience\.\s*/, '')}</Tx>)}
        </DarkCard>
        {pts.length > 0 && (
          <Panel title="How rewards work" pad={0} style={{ flex: 1 }}>
            <Table dense cols={[
              { key: 'k', label: 'Term', flex: 0.8, render: r => <Tx w={600} s={13}>{r.k ? sc(r.k) : '–'}</Tx> },
              { key: 'v', label: 'Detail', flex: 2.4, render: r => <Tx s={13} c={C.ink2} lh={1.5}>{r.v}</Tx> },
            ]} rows={pts.map(([k, v], i) => ({ id: i, k, v }))} />
          </Panel>
        )}
      </View>
      <Panel title="Refer someone" style={{ flex: 1, minWidth: 0 }}>
        <FormBody cfg={REFERRAL_FORM} opts={V.acctOptions} onDone={V.closePage} />
      </Panel>
    </Row>
  );
}

/* ── Service cadence ───────────────────────────────────────────────────────────────────────────────────── */
// The rhythm of contact through a year: one strip across the financial year (Apr–Mar) showing when each report
// lands, the three touchpoints side by side, then response times. Same facts as the phone page (about.js CADENCE).
const FY_MONTHS = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'];
const QUARTERLY_IN = { Jul: 'Q1', Oct: 'Q2', Jan: 'Q3', Apr: 'Q4' };   // report for the quarter just ended, by the 15th
const TOUCHPOINTS = [
  { k: 'Monthly', h: 'Monthly report', icon: 'mail', when: 'By the 15th of the following month', how: 'Email to your registered address',
    what: ['Performance summary across Qode strategies (QAW, QTF, QGF)'], note: 'Fund-level performance; your own returns may differ.' },
  { k: 'Quarterly', h: 'Quarterly report', icon: 'shield', when: 'Within 15 days of quarter-end', how: 'Mandated by SEBI',
    what: ['Portfolio holdings and transactions', 'Performance against the benchmark', 'Regulatory disclosures'] },
  { k: 'Yearly', h: 'Annual review', icon: 'message', when: 'Once a year', how: 'One-on-one with your fund manager and Investor Relations',
    what: ['Annual performance across strategies', 'Risk–return attribution and positioning', 'Outlook and any strategic changes'] },
];
const RESPONSE = [
  ['1 business day', 'Standard queries', 'Email or WhatsApp'],
  ['Next day', 'Operational requests', 'Top-ups, withdrawals and KYC are acknowledged the next day and carried out within regulatory timelines'],
  ['24 hours', 'Escalations', 'Anything unresolved goes to Compliance within 24 hours'],
];

function YearStrip() {
  const dot = (on, gold) => <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: on ? (gold ? C.gold : C.cream) : 'rgba(255,255,255,0.14)' }} />;
  return (
    <DarkCard style={{ paddingVertical: 24, paddingHorizontal: 28 }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12 }}>
        <View>
          <Tx w={600} s={12} c={C.gold}>Your year with Qode</Tx>
          <Tx f="play" w={600} s={22} c={C.cream} style={{ marginTop: 6 }}>12 monthly reports, 4 quarterly reports, 1 review</Tx>
        </View>
        <View style={{ flexDirection: 'row', gap: 18 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>{dot(true)}<Tx s={12} c="rgba(239,236,211,0.7)">Monthly report</Tx></View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>{dot(true, true)}<Tx s={12} c="rgba(239,236,211,0.7)">Quarterly report</Tx></View>
        </View>
      </View>
      <View style={{ flexDirection: 'row', marginTop: 22 }}>
        {FY_MONTHS.map((m, i) => (
          <View key={m} style={{ flex: 1, alignItems: 'center', gap: 8, borderLeftWidth: i ? 1 : 0, borderColor: 'rgba(255,255,255,0.08)', paddingVertical: 4 }}>
            <Tx w={600} s={11.5} c="rgba(239,236,211,0.55)">{m}</Tx>
            {dot(true)}
            {QUARTERLY_IN[m] ? <View style={{ alignItems: 'center', gap: 4 }}>{dot(true, true)}<Tx w={700} s={10.5} c={C.gold}>{QUARTERLY_IN[m]}</Tx></View> : <View style={{ height: 25 }} />}
          </View>
        ))}
      </View>
      <Tx s={12} c="rgba(239,236,211,0.6)" style={{ marginTop: 14 }}>Each report arrives by the 15th of the month shown, for the month or quarter just ended. Your annual review is set up once a year with your fund manager.</Tx>
    </DarkCard>
  );
}

function Cadence({ V }) {
  return (
    <View style={{ gap: 24 }}>
      <Lead>Structured reports and regular reviews, so you always know how your portfolio is doing and what comes next.</Lead>
      <YearStrip />
      <Row gap={16} style={{ alignItems: 'stretch' }}>
        {TOUCHPOINTS.map(t => (
          <Card key={t.k} style={{ flex: 1, padding: 22, gap: 14 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <IconChip name={t.icon} />
              <Pill label={t.k} />
            </View>
            <View>
              <Tx f="play" w={600} s={19}>{t.h}</Tx>
              <Tx w={600} s={13.5} c={C.green} style={{ marginTop: 6 }}>{t.when}</Tx>
              <Tx s={13} c={C.ink3} style={{ marginTop: 2 }}>{t.how}</Tx>
            </View>
            <View style={{ borderTopWidth: 1, borderColor: C.line, paddingTop: 6 }}>
              {t.what.map(w => <Bullet key={w}>{w}</Bullet>)}
            </View>
            {!!t.note && <Tx s={12} c={C.ink3} lh={1.5}>{t.note}</Tx>}
          </Card>
        ))}
      </Row>
      <View>
        <SectionTitle sub="How quickly we come back to you" style={{ marginTop: 8 }}>Response times</SectionTitle>
        <Card style={{ flexDirection: 'row', flexWrap: 'wrap', padding: 0 }}>
          {RESPONSE.map(([big, h, t], i) => (
            <View key={h} style={{ flex: 1, minWidth: 220, paddingVertical: 20, paddingHorizontal: 22, borderLeftWidth: i ? 1 : 0, borderColor: C.line }}>
              <Tx f="play" w={600} s={24} c={C.green}>{big}</Tx>
              <Tx w={600} s={13.5} style={{ marginTop: 6 }}>{h}</Tx>
              <Tx s={12.5} lh={1.55} c={C.ink2} style={{ marginTop: 3 }}>{t}</Tx>
            </View>
          ))}
        </Card>
      </View>
      <RelatedRow V={V} keys={['reports', 'team', 'grievance']} />
    </View>
  );
}

/* ── Note from our fund managers ───────────────────────────────────────────────────────────────────────── */
function Foundation({ V }) {
  const MV = [['Mission', 'To support investors with data-driven, high-quality investment solutions that deliver superior risk-adjusted returns.'],
    ['Vision', 'To transform investment management with innovation and discipline, creating lasting value for our investors.']];
  return (
    <View style={{ gap: 20 }}>
      <DarkCard style={{ flexDirection: 'row', padding: 0 }}>
        {MV.map(([h, t], i) => (
          <View key={h} style={{ flex: 1, paddingVertical: 30, paddingHorizontal: 32, borderLeftWidth: i ? 1 : 0, borderColor: 'rgba(255,255,255,0.12)' }}>
            <Tx w={600} s={15} c={C.gold}>Our {h.toLowerCase()}</Tx>
            <Tx f="play" w={500} s={21} lh={1.45} c={C.cream} style={{ marginTop: 10 }}>{t}</Tx>
          </View>
        ))}
      </DarkCard>
      <SectionTitle sub="Why we invest the way we do, in their own words">A note from our fund managers</SectionTitle>
      {/* Letters side by side at equal height, signed at the foot like a letter. */}
      <Row gap={20}>
        {MANAGERS.map(m => (
          <Card key={m.name} style={{ flex: 1, paddingVertical: 28, paddingHorizontal: 30, justifyContent: 'space-between' }}>
            <View>
              <Tx f="play" w={700} s={56} lh={0.9} c={C.gold} style={{ height: 34 }}>{'“'}</Tx>
              {m.letter.map((t, j) => <Body key={j} s={14.5} style={{ marginTop: j ? 14 : 6 }}>{t}</Body>)}
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 24, paddingTop: 18, borderTopWidth: 1, borderColor: C.line }}>
              <Image source={{ uri: m.photo }} style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: C.subtle }} resizeMode="cover" accessibilityLabel={m.name} />
              <View>
                <Tx f="play" w={600} s={18}>{m.name}</Tx>
                <Tx w={600} s={12.5} c={C.green} style={{ marginTop: 2 }}>{m.role}, Qode Advisors LLP</Tx>
              </View>
            </View>
          </Card>
        ))}
      </Row>
      <RelatedRow V={V} keys={['philosophy', 'strategies', 'team']} />
    </View>
  );
}

/* ── Qode philosophy ────────────────────────────────────────────────────────────────────────────────────── */
const PHILO_ICON = { 'Who We Are': 'user', 'What We Do': 'chart', 'How We Work': 'clipboard', 'Why It Matters': 'shield' };
function Philosophy({ V }) {
  const secs = content.PHILOSOPHY.sections;
  const [, ...rest] = secs;   // the first section's text is replaced by the intro below (6 Oct 2026)
  return (
    <View style={{ gap: 20 }}>
      <DarkCard style={{ paddingVertical: 36, paddingHorizontal: 40 }}>
        <Tx w={600} s={12.5} c={C.gold}>Qode philosophy</Tx>
        <Tx f="play" w={600} s={32} lh={1.25} c={C.cream} style={{ marginTop: 12, maxWidth: 820 }}>Guided by evidence. Driven by data. Built for the long term.</Tx>
        <Tx s={15} lh={1.7} c={C.cream60} style={{ marginTop: 16, maxWidth: 860 }}>Qode is a SEBI-registered PMS that puts evidence at the heart of every investment decision. Backed by over a decade of experience in Indian markets, we offer a disciplined, transparent and research-led approach to growing your wealth over the long term.</Tx>
      </DarkCard>
      <Row gap={20}>
        {rest.map((sec, i) => (
          <Card key={sec.h} style={{ flex: 1, paddingVertical: 26, paddingHorizontal: 26 }}>
            <IconChip name={PHILO_ICON[sec.h] || 'chart'} />
            <Tx f="play" w={600} s={21} style={{ marginTop: 18 }}>{sec.h}</Tx>
            {sec.p.map((t, j) => <Body key={j} style={{ marginTop: 10 }}>{t}</Body>)}
          </Card>
        ))}
      </Row>
      <RelatedRow V={V} keys={['foundation', 'strategies', 'team']} />
    </View>
  );
}

// "Continue reading": the neighbouring About Qode pages as link cards across the width.
const RELATED_TEXT = {
  philosophy: ['Qode Philosophy', 'What we believe and why'], foundation: ['Foundation', 'Mission, vision and our fund managers'],
  strategies: ['Strategy Snapshot', 'Each strategy, its benchmark and pillars'], team: ['Your Team at Qode', 'Who to reach and how'],
  reports: ['Reports', 'Statements and reports to download'], grievance: ['Grievance redressal', 'If something isn’t resolved'],
};
function RelatedRow({ V, keys }) {
  return (
    <View>
      <SectionTitle>Continue reading</SectionTitle>
      <Row gap={16}>
        {keys.map(k => (
          <Pressable key={k} accessibilityRole="link" onPress={() => V.openPage(k)} style={({ hovered }) => ({ flex: 1 })}>
            {({ hovered }) => (
              <Card style={{ paddingVertical: 18, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', gap: 12, borderColor: hovered ? C.green : C.line }}>
                <View style={{ flex: 1 }}>
                  <Tx w={600} s={14.5} c={C.green}>{RELATED_TEXT[k][0]}</Tx>
                  <Tx s={12.5} c={C.ink3} style={{ marginTop: 3 }}>{RELATED_TEXT[k][1]}</Tx>
                </View>
                <Tx w={600} s={18} c={hovered ? C.green : C.ink3}>{'›'}</Tx>
              </Card>
            )}
          </Pressable>
        ))}
      </Row>
    </View>
  );
}

/* ── Strategy snapshot ─────────────────────────────────────────────────────────────────────────────────── */
function Strategies() {
  return (
    <View>
      <Lead style={{ marginBottom: 20 }}>Discover Qode's investment strategies and their core pillars designed for different risk profiles and investment horizons.</Lead>
      <Row gap={16}>
        {STRATS.map(s => (
          <Card key={s.code} style={{ flex: 1, overflow: 'clip' }}>
            <View style={{ height: 4, backgroundColor: s.color }} />
            <View style={{ padding: 22, flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: s.color }} />
                <Tx w={600} s={12} c={C.ink3}>{s.code}</Tx>
              </View>
              <Tx f="play" w={600} s={20} style={{ marginTop: 8 }}>{s.title}</Tx>
              <Body s={13} style={{ marginTop: 8, flex: 1 }}>{s.desc}</Body>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 22, paddingVertical: 12, borderTopWidth: 1, borderColor: C.line, backgroundColor: C.subtle }}>
              <Tx s={12.5} c={C.ink3}>Benchmark</Tx>
              <Tx w={600} s={13}>{s.benchmark}</Tx>
            </View>
          </Card>
        ))}
      </Row>
      {/* Lined up with the cards above: pillars span the first two columns (+ the gap between them), the glossary
          the third; both stretch to the same height. */}
      <Row gap={16} style={{ marginTop: 16 }}>
        <Panel title="Core pillars" pad={0} style={{ flexGrow: 2, flexShrink: 1, flexBasis: 16, minWidth: 0 }}>
          <Table cols={[
            { key: 'code', label: 'Strategy', flex: 1.3, render: s => (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={{ width: 3, height: 24, borderRadius: 2, backgroundColor: s.color }} />
                <Tx w={600} s={13.5}>{s.code}</Tx>
              </View>) },
            ...[0, 1, 2, 3].map(i => ({ key: 'p' + i, label: 'Pillar ' + (i + 1), flex: 1.2, render: s => <Tx s={13}>{s.pills[i]}</Tx> })),
          ]} rows={STRATS.map(s => ({ ...s, id: s.code }))} />
        </Panel>
        <Panel title="Glossary" style={{ flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0 }}>
          {STRAT_GLOSSARY.map(([t, d], i) => (
            <View key={t} style={{ paddingTop: i ? 12 : 0, marginTop: i ? 12 : 0, borderTopWidth: i ? 1 : 0, borderColor: C.line }}>
              <Tx w={600} s={13.5}>{t}</Tx>
              <Body s={13} style={{ marginTop: 4 }}>{d}</Body>
            </View>
          ))}
        </Panel>
      </Row>
    </View>
  );
}

/* ── Your team at Qode ─────────────────────────────────────────────────────────────────────────────────── */
function Channel({ icon, title, children, dark }) {
  const inner = (
    <>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <IconChip name={icon} dark={dark} />
        <Tx w={600} s={16} c={dark ? C.cream : C.ink} style={{ flex: 1 }}>{title}</Tx>
      </View>
      <View style={{ flex: 1, marginTop: 14 }}>{children}</View>
    </>
  );
  return dark ? <DarkCard style={{ flex: 1 }}>{inner}</DarkCard> : <Card style={{ flex: 1, padding: 24 }}>{inner}</Card>;
}

function Team({ V }) {
  const code = (V && V.acctCode) || (V && V.user && V.user.clientCode) || '';
  return (
    <View style={{ gap: 20 }}>
      <Lead>We believe investing is a partnership. Here are the people and channels dedicated to supporting you.</Lead>
      <Row gap={20}>
        <Channel icon="trend" title="Fund manager">
          <Labelled label="Role">Oversees your portfolio strategy and ensures alignment with Qode's philosophy.</Labelled>
          <Labelled label="When to contact" style={{ marginTop: 8 }}>Strategy-specific queries and high-level portfolio discussions.</Labelled>
          <View style={{ flex: 1 }} />
          <Btn label="Ask a question on strategy" onPress={() => V.openReq('r-strategy')} style={{ marginTop: 18, alignSelf: 'flex-start' }} />
        </Channel>
        <Channel icon="user" title="Investor relations">
          <Labelled label="Role">Your regular point of contact. Shares monthly updates, schedules review calls, and addresses queries. Also helps with operations: onboarding, top‑ups, withdrawals, portal access.</Labelled>
          <Labelled label="When to contact" style={{ marginTop: 8 }}>For reports, account queries, operational clarifications, and all quarterly/annual reviews.</Labelled>
          <View style={{ flex: 1 }} />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 18, flexWrap: 'wrap' }}>
            <Btn label="Contact IR team" onPress={() => go(irLinks(code || 'Account').email('IR Support Request'))} />
            <Btn kind="outline" label="Raise any query" onPress={() => V.openReq('r-discussion')} />
            <Tx s={12} c={C.ink3}>We will get back to you promptly.</Tx>
          </View>
        </Channel>
      </Row>
      {/* A slim full-width strip: as a card beside the contact details it stretched to their height around one line of text. */}
      <DarkCard style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 16, paddingVertical: 18 }}>
        <IconChip name="calendar" dark />
        <View style={{ flexGrow: 1, flexShrink: 1, flexBasis: 280, minWidth: 0 }}>
          <Tx w={600} s={16} c={C.cream}>Book a call</Tx>
          <Labelled dark label="Purpose" style={{ marginTop: 4 }}>Quick, hassle‑free scheduling of calls with your IR team.</Labelled>
        </View>
        <Btn kind="gold" label="Book a call" onPress={() => go(BOOKING)} />
      </DarkCard>
      <ContactCard code={code} />
    </View>
  );
}

/* ── FAQ and glossary ──────────────────────────────────────────────────────────────────────────────────── */
function Faq() {
  const topics = [...content.FAQ.map(g => g.topic), 'Glossary'];
  const [topic, setTopic] = useState(topics[0]);
  const [open, setOpen] = useState(null);
  const g = content.FAQ.find(x => x.topic === topic);
  return (
    <Row top gap={24}>
      <View style={[{ width: 260 }, sticky]}>
        <Panel title="Topics" pad={8}>
          {topics.map(t => {
            const on = t === topic, count = t === 'Glossary' ? content.GLOSSARY.length : content.FAQ.find(x => x.topic === t).items.length;
            return (
              <Pressable key={t} accessibilityRole="tab" accessibilityState={{ selected: on }} onPress={() => { setTopic(t); setOpen(null); }} style={({ hovered }) => ({
                flexDirection: 'row', alignItems: 'center', paddingVertical: 9, paddingHorizontal: 12, borderRadius: 8, marginTop: 2,
                backgroundColor: on ? C.greenTint : hovered ? C.hover : 'transparent',
              })}>
                <Tx w={600} s={13} c={on ? C.green : C.ink2} style={{ flex: 1 }}>{t}</Tx>
                <Tx s={12} c={on ? C.green : C.ink3}>{count}</Tx>
              </Pressable>
            );
          })}
        </Panel>
      </View>
      <View style={{ flex: 1, minWidth: 0, maxWidth: 860 }}>
        <Tx w={600} s={18} role="heading" aria-level={2} style={{ marginBottom: 14 }}>{topic}</Tx>
        {g ? (
          <Card style={{ overflow: 'clip' }}>
            {g.items.map((it, i) => {
              const on = open === i;
              return (
                <View key={i} style={{ borderBottomWidth: i < g.items.length - 1 ? 1 : 0, borderColor: C.line }}>
                  <Pressable accessibilityRole="button" accessibilityState={{ expanded: on }} onPress={() => setOpen(on ? null : i)} style={({ hovered }) => ({
                    flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 16, paddingHorizontal: 20, backgroundColor: hovered ? C.hover : 'transparent',
                  })}>
                    <Tx w={600} s={14} lh={1.45} style={{ flex: 1 }}>{it.q}</Tx>
                    <View style={{ transform: [{ rotate: on ? '180deg' : '0deg' }] }}><ChevronDown s={12} c={C.ink3} /></View>
                  </Pressable>
                  {on && <Body style={{ paddingHorizontal: 20, paddingBottom: 18, marginTop: -4 }}>{it.a}</Body>}
                </View>
              );
            })}
          </Card>
        ) : (
          <Card style={{ overflow: 'clip' }}>
            <Table cols={[
              { key: 'term', label: 'Term', flex: 1, render: r => <Tx w={600} s={13.5}>{r.term}</Tx> },
              { key: 'def', label: 'Meaning', flex: 2.6, render: r => <Tx s={13} c={C.ink2} lh={1.5}>{r.def}</Tx> },
            ]} rows={content.GLOSSARY.map(x => ({ ...x, id: x.term }))} />
          </Card>
        )}
      </View>
    </Row>
  );
}

/* ── Grievance redressal ───────────────────────────────────────────────────────────────────────────────── */
function Grievance({ V }) {
  const field = (l, k) => (l.lines.find(([x]) => x === k) || [])[1];
  const cols = [
    { key: 'n', label: 'Level', flex: 0.5, render: l => (
      <View style={{ width: 28, height: 28, borderRadius: 7, backgroundColor: C.greenTint, alignItems: 'center', justifyContent: 'center' }}>
        <Tx w={600} s={13} c={C.green}>{l.n}</Tx>
      </View>) },
    { key: 't', label: 'Contact point', flex: 1.4, render: l => <Tx w={600} s={13.5}>{l.t}</Tx> },
    { key: 'role', label: 'Role and scope', flex: 3, render: l => (
      <View>
        <Tx s={13} lh={1.5} c={C.ink2}>{field(l, 'Role')}</Tx>
        {!!field(l, 'Scope') && <Tx s={13} lh={1.5} c={C.ink2} style={{ marginTop: 4 }}><Tx w={600} s={13} c={C.ink}>Scope: </Tx>{field(l, 'Scope')}</Tx>}
      </View>) },
    { key: 'sla', label: 'Timeline', flex: 1.6, render: l => <Tx s={13} lh={1.5}>{field(l, 'Response SLA') || field(l, 'Escalation Timeline')}</Tx> },
    { key: 'reach', label: 'Reach', flex: 1.8, render: l => (
      <View style={{ gap: 6 }}>
        {l.contacts.map(([label, url]) => (
          <Pressable key={label} accessibilityRole="link" onPress={() => go(url)} style={({ hovered }) => ({ flexDirection: 'row', alignItems: 'center', gap: 6, opacity: hovered ? 0.75 : 1 })}>
            {url.startsWith('mailto') ? <MailIcon s={13} /> : <Phone s={13} />}
            <Tx w={600} s={12.5} c={C.green} numberOfLines={1}>{label}</Tx>
          </Pressable>
        ))}
      </View>) },
  ];
  return (
    <View style={{ gap: 20 }}>
      <Lead>We take every investor query seriously. If something isn't resolved quickly by our Investor Relations team, this structured framework ensures clarity and accountability.</Lead>
      <Panel title="Escalation framework" sub="Three levels, starting with Investor Relations" pad={0}>
        <Table cols={cols} rows={LEVELS.map(l => ({ ...l, id: l.n }))} />
      </Panel>
      <Row gap={20}>
        <Card style={{ flex: 1, padding: 24 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <IconChip name="shield" />
            <Tx w={600} s={15}>Investor protection</Tx>
          </View>
          <Body style={{ marginTop: 12 }}>All complaints and resolutions are documented and reviewed periodically.</Body>
        </Card>
        <DarkCard style={{ flex: 1 }}>
          <Tx w={600} s={12.5} c={C.gold}>Start here</Tx>
          <Tx f="play" w={600} s={19} c={C.cream} style={{ marginTop: 8 }}>Most questions are resolved at Level 1.</Tx>
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
            <Btn kind="gold" label="Contact Investor Relations" onPress={() => V.openPage('team')} />
          </View>
        </DarkCard>
      </Row>
    </View>
  );
}

/* ── Risk management ───────────────────────────────────────────────────────────────────────────────────── */
function Risk() {
  const R = content.RISK;
  return (
    <View>
      {R.intro.map((t, i) => <Lead key={i} style={{ marginBottom: 20 }}>{t}</Lead>)}
      <Grid min={250} gap={16}>
        {R.policies.map(p => (
          <Card key={p.title} style={{ padding: 22, flex: 1 }}>
            <IconChip name="shield" />
            <Tx w={600} s={15} style={{ marginTop: 14 }}>{sc(p.title)}</Tx>
            <View style={{ flex: 1 }}>
              {p.body.map((t, i) => <Body key={i} s={13} style={{ marginTop: 8 }}>{t}</Body>)}
            </View>
            {!!p.pdf && <Btn kind="outline" small label="View policy (PDF)" onPress={() => openUrl(p.pdf)} style={{ marginTop: 18, alignSelf: 'flex-start' }} />}
          </Card>
        ))}
      </Grid>
    </View>
  );
}

const L = content.LEGAL;
export const DESKTOP_PAGES = {
  notifications: { title: 'Notifications', body: () => <NotificationSettings /> },
  family: { title: 'Account Mapping', body: () => <Family /> },
  // One web page for Nuvama: the WealthSpectrum card, then the investor's own sign-in code and accounts.
  nuvama: { title: 'Login To Nuvama', body: V => <View style={{ gap: 20 }}><PortalGuide /><NuvamaDetails V={V} /></View> },
  insights: { title: 'Insights & Events', body: () => <Insights /> },
  guide: { title: 'Login To Nuvama', body: V => <View style={{ gap: 20 }}><PortalGuide /><NuvamaDetails V={V} /></View> },
  referral: { title: 'Referral Program', body: V => <Referral V={V} /> },
  cadence: { title: 'Service Cadence', body: V => <Cadence V={V} /> },
  philosophy: { title: 'Qode Philosophy', body: V => <Philosophy V={V} /> },
  foundation: { title: 'Foundation', body: V => <Foundation V={V} /> },
  strategies: { title: 'Strategy Snapshot', body: () => <Strategies /> },
  team: { title: 'Your Team at Qode', body: V => <Team V={V} /> },
  faq: { title: 'FAQs & Glossary', body: () => <Faq /> },
  grievance: { title: 'Escalation and Grievance Redressal', body: V => <Grievance V={V} /> },
  risk: { title: 'Risk Management & Controls', body: () => <Risk /> },
  voice: { title: 'Your Voice Matters', body: V => <DesktopVoice V={V} /> },
  transactions: { title: 'Transactions', body: V => <DesktopTransactions V={V} /> },
  privacy: { title: L.privacy.title || 'Privacy policy', body: V => <ArticlePage V={V} data={L.privacy} related={RELATED.legal} /> },
  terms: { title: L.terms.title || 'Terms and conditions', body: V => <ArticlePage V={V} data={L.terms} related={RELATED.legal} /> },
  cancellation: { title: L.cancellation.title || 'Cancellation and refund', body: V => <ArticlePage V={V} data={L.cancellation} related={RELATED.legal} /> },
};
