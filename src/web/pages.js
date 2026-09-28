// Desktop web versions of the content pages (src/screens/pages.js + about.js). Same data, calls and actions as the
// phone pages, laid out with the web design system (./kit): articles in a reading column with a sticky
// "On this page" rail, tables for tabular data, multi-column grids for everything else.
import React, { useState } from 'react';
import { View, Pressable, Image, Linking, Platform } from 'react-native';
import { C, Tx, Amt, Card, Row, Grid, Label, Panel, Stat, DarkCard, Btn, Chips, Tabs, Table, KeyVals, TextLink, Pill, Loading, Empty, ErrorBlock, Dialog, sentence } from './kit';
import { NuvamaDetails } from './nuvama';
import { inr } from '../adapt';
import { ChevronRight, ChevronDown, Phone, MailIcon } from '../icons';
import { experience, engagement } from '../api';
import * as content from '../content';
import { FormBody } from '../screens/services';
import { useLoad, openUrl, fmtSize } from '../screens/kit';
import { REFERRAL_FORM } from '../screens/pages';
import {
  WEB, MANAGERS, CADENCE, STRATS, STRAT_GLOSSARY, WEALTHSPECTRUM, PASSWORD_PDF, ACCESS, REPORT_GROUPS, norm,
  BOOKING, IR, LEVELS, LineIcon,
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
  about: [['philosophy', 'Qode philosophy'], ['foundation', 'Note from our fund managers'], ['strategies', 'Strategy snapshot'], ['team', 'Your team at Qode']],
  legal: [['privacy', 'Privacy policy'], ['terms', 'Terms and conditions'], ['cancellation', 'Cancellation and refund'], ['risk', 'Risk management'], ['grievance', 'Grievance redressal']],
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
          <Card style={{ overflow: 'hidden' }}>
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
        <Card style={{ flex: 1, padding: 12, justifyContent: 'center' }}>
          <Image source={{ uri: WEB + '/nuvama-dashboard.png' }} style={{ width: '100%', aspectRatio: 16 / 10, borderRadius: 8, backgroundColor: '#fff' }} resizeMode="contain" accessibilityLabel="Nuvama WealthSpectrum Dashboard screenshot" />
        </Card>
      </Row>

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
      <Card style={{ overflow: 'hidden' }}>
        <Table dense cols={cols} rows={rows} />
      </Card>
      {!!viewer && <SnapshotDialog report={viewer.report} images={viewer.images} onClose={() => setViewer(null)} />}
    </View>
  );
}

/* ── Referral ──────────────────────────────────────────────────────────────────────────────────────────── */
function Referral({ V }) {
  const pts = content.REFERRAL.points.map(t => { const i = t.indexOf(':'); return i > 0 ? [t.slice(0, i), t.slice(i + 1).trim()] : ['', t]; });
  return (
    <Row top gap={24}>
      <View style={{ flex: 1.1, gap: 16, minWidth: 0 }}>
        <DarkCard style={{ padding: 28 }}>
          <Tx w={600} s={12.5} c={C.gold}>Refer an investor</Tx>
          <Tx f="play" w={600} s={24} c={C.cream} style={{ marginTop: 8 }}>Share the Qode experience.</Tx>
          {content.REFERRAL.intro.map((t, i) => <Tx key={i} s={13.5} lh={1.65} c={C.cream60} style={{ marginTop: 10 }}>{t}</Tx>)}
        </DarkCard>
        {pts.length > 0 && (
          <Panel title="How rewards work" pad={0}>
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
function Cadence({ V }) {
  const toc = CADENCE.map(s => [slug(s.h), sc(s.h)]);
  return (
    <WithRail rail={<Rail V={V} toc={toc} related={[['reports', 'Reports'], ['team', 'Your team at Qode'], ['grievance', 'Grievance redressal']]} />}>
      <Lead style={{ marginBottom: 20 }}>Stay consistently informed with structured reports and timely reviews. From monthly updates to annual reviews, everything is designed to keep you aligned with your portfolio and goals.</Lead>
      <View style={{ gap: 20 }}>
        {CADENCE.map(sec => (
          <View key={sec.h} nativeID={slug(sec.h)}>
            <Panel title={sc(sec.h)} sub={sec.note} pad={0}>
              <View style={{ flexDirection: 'row', borderTopWidth: 1, borderColor: C.line }}>
                {sec.cards.map((c, i) => (
                  <View key={c.t} style={{ flex: 1, padding: 18, borderLeftWidth: i ? 1 : 0, borderColor: C.line }}>
                    <IconChip name={c.icon} />
                    <Tx w={600} s={13.5} style={{ marginTop: 12 }}>{sc(c.t)}</Tx>
                    {(c.lines || []).map(([l, t]) => <Labelled key={l} label={l} style={{ marginTop: 8 }}>{t}</Labelled>)}
                    {!!c.bullets && c.bullets.map((b, j) => <Bullet key={j}>{b}</Bullet>)}
                  </View>
                ))}
              </View>
            </Panel>
          </View>
        ))}
      </View>
    </WithRail>
  );
}

/* ── Note from our fund managers ───────────────────────────────────────────────────────────────────────── */
function Foundation() {
  const MV = [['Mission', 'To support investors with data-driven, high-quality investment solutions that deliver superior risk-adjusted returns.'],
    ['Vision', 'To transform investment management with innovation and discipline, creating lasting value for our investors.']];
  return (
    <View style={{ gap: 20 }}>
      <DarkCard style={{ flexDirection: 'row', padding: 0 }}>
        {MV.map(([h, t], i) => (
          <View key={h} style={{ flex: 1, padding: 26, borderLeftWidth: i ? 1 : 0, borderColor: 'rgba(255,255,255,0.12)' }}>
            <Tx w={600} s={12.5} c={C.gold}>{h}</Tx>
            <Tx f="play" w={500} s={19} lh={1.45} c={C.cream} style={{ marginTop: 8 }}>{t}</Tx>
          </View>
        ))}
      </DarkCard>
      <Row top gap={20}>
        {MANAGERS.map(m => (
          <Card key={m.name} style={{ flex: 1, overflow: 'hidden' }}>
            <View style={{ flexDirection: 'row', gap: 16, paddingVertical: 20, paddingHorizontal: 24, alignItems: 'center', borderBottomWidth: 1, borderColor: C.line }}>
              <Image source={{ uri: m.photo }} style={{ width: 72, height: 72, borderRadius: 12, backgroundColor: C.subtle }} resizeMode="cover" accessibilityLabel={m.name} />
              <View style={{ flex: 1 }}>
                <Tx f="play" w={600} s={21}>{m.name}</Tx>
                <Tx w={600} s={12.5} c={C.green} style={{ marginTop: 3 }}>{m.role}</Tx>
              </View>
            </View>
            <View style={{ paddingVertical: 22, paddingHorizontal: 24 }}>
              {m.letter.map((t, j) => <Body key={j} style={{ marginTop: j ? 12 : 0 }}>{t}</Body>)}
            </View>
          </Card>
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
          <Card key={s.code} style={{ flex: 1, overflow: 'hidden' }}>
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
      <Row top gap={20} style={{ marginTop: 20 }}>
        <Panel title="Core pillars" pad={0} style={{ flex: 1.8, minWidth: 0 }}>
          <Table cols={[
            { key: 'code', label: 'Strategy', flex: 1.3, render: s => (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={{ width: 3, height: 24, borderRadius: 2, backgroundColor: s.color }} />
                <Tx w={600} s={13.5}>{s.code}</Tx>
              </View>) },
            ...[0, 1, 2, 3].map(i => ({ key: 'p' + i, label: 'Pillar ' + (i + 1), flex: 1.2, render: s => <Tx s={13}>{s.pills[i]}</Tx> })),
          ]} rows={STRATS.map(s => ({ ...s, id: s.code }))} />
        </Panel>
        <Panel title="Glossary" style={{ flex: 1, minWidth: 0 }}>
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
const ContactLine = ({ icon, title, sub, onPress }) => (
  <Pressable accessibilityRole="link" onPress={onPress} style={({ hovered }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, borderColor: C.line, backgroundColor: hovered ? C.hover : C.card, marginTop: 10 })}>
    {icon}
    <View style={{ flex: 1 }}>
      <Tx w={600} s={13}>{title}</Tx>
      <Tx s={13} c={C.green} style={{ marginTop: 1 }}>{sub}</Tx>
    </View>
    <ChevronRight s={12} c={C.ink3} />
  </Pressable>
);

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
            <Btn label="Contact IR team" onPress={() => go(`mailto:${IR}?subject=${encodeURIComponent('IR Support Request - ' + (code || 'Account'))}`)} />
            <Btn kind="outline" label="Raise any query" onPress={() => V.openReq('r-discussion')} />
            <Tx s={12} c={C.ink3}>We will get back to you promptly.</Tx>
          </View>
        </Channel>
      </Row>
      <Row gap={20}>
        <Channel icon="calendar" title="Book a call" dark>
          <Labelled dark label="Purpose">Quick, hassle‑free scheduling of calls with your IR team.</Labelled>
          <View style={{ flex: 1 }} />
          <Btn kind="gold" label="Book a call" onPress={() => go(BOOKING)} style={{ marginTop: 18, alignSelf: 'flex-start' }} />
        </Channel>
        <Channel icon="message" title="WhatsApp and email">
          <Labelled label="Purpose">Instant, informal, and quick communication.</Labelled>
          <Row gap={10}>
            <View style={{ flex: 1 }}>
              <ContactLine icon={<Phone />} title="WhatsApp (IR desk)" sub="+91 98203 00028, 9 AM to 5 PM"
                onPress={() => go(`https://wa.me/919820300028?text=${encodeURIComponent('Hi! I am ' + (code || 'a client') + ' and would like to discuss my account')}`)} />
            </View>
            <View style={{ flex: 1 }}>
              <ContactLine icon={<MailIcon />} title="Email" sub={IR} onPress={() => go(`mailto:${IR}?subject=${encodeURIComponent('Account Query - ' + (code || 'Client'))}`)} />
            </View>
          </Row>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 16 }}>
            <Btn kind="outline" label="Join Qode Investor Circle" onPress={() => go('https://chat.whatsapp.com/IW7eHWZjWAq54MyKvZtQdC')} />
            <Tx s={12} c={C.ink3} style={{ flex: 1 }}>WhatsApp community for Qode investors</Tx>
          </View>
        </Channel>
      </Row>
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
          <Card style={{ overflow: 'hidden' }}>
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
          <Card style={{ overflow: 'hidden' }}>
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
function Grievance() {
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
            <Btn kind="gold" label="Email Investor Relations" onPress={() => go('mailto:investor.relations@qodeinvest.com')} />
            <Btn kind="outline" label="WhatsApp IR desk" onPress={() => go('https://wa.me/919820300028')} />
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

/* ── Contact us ────────────────────────────────────────────────────────────────────────────────────────── */
function Contact() {
  const K = content.CONTACT;
  return (
    <Row top gap={20}>
      {K.phones.length > 0 && (
        <Panel title="Call" style={{ flex: 1 }}>
          {K.phones.map(p => (
            <ContactLine key={p.number} icon={<Phone />} title={p.label} sub={p.number} onPress={() => go('tel:' + String(p.number).replace(/[^\d+]/g, ''))} />
          ))}
        </Panel>
      )}
      {K.emails.length > 0 && (
        <Panel title="Email" style={{ flex: 1 }}>
          {K.emails.map(e => <ContactLine key={e.address} icon={<MailIcon />} title={e.label} sub={e.address} onPress={() => go('mailto:' + e.address)} />)}
        </Panel>
      )}
      {(K.hours.length > 0 || K.address.length > 0) && (
        <View style={{ flex: 1, gap: 20 }}>
          {K.hours.length > 0 && (
            <DarkCard>
              <Tx w={600} s={12.5} c={C.gold}>Hours</Tx>
              {K.hours.map((t, i) => <Tx key={i} w={600} s={16} lh={1.45} c={C.cream} style={{ marginTop: 8 }}>{t}</Tx>)}
            </DarkCard>
          )}
          {K.address.length > 0 && (
            <Panel title="Office">
              {K.address.map((t, i) => <Tx key={i} s={13.5} lh={1.6} c={i ? C.ink2 : C.ink} style={{ marginTop: i ? 2 : 0 }}>{t}</Tx>)}
            </Panel>
          )}
        </View>
      )}
    </Row>
  );
}

const L = content.LEGAL;
export const DESKTOP_PAGES = {
  family: { title: 'Family accounts', body: () => <Family /> },
  nuvama: { title: 'Your details on Nuvama', body: () => <NuvamaDetails /> },
  insights: { title: 'Insights', body: () => <Insights /> },
  guide: { title: 'Investor portal guide', body: () => <PortalGuide /> },
  referral: { title: 'Referral programme', body: V => <Referral V={V} /> },
  cadence: { title: 'Service cadence', body: V => <Cadence V={V} /> },
  philosophy: { title: 'Qode philosophy', body: V => <ArticlePage V={V} data={content.PHILOSOPHY} related={RELATED.about} /> },
  foundation: { title: 'Note from our fund managers', body: () => <Foundation /> },
  strategies: { title: 'Strategy snapshot', body: () => <Strategies /> },
  team: { title: 'Your team at Qode', body: V => <Team V={V} /> },
  faq: { title: 'FAQ and glossary', body: () => <Faq /> },
  grievance: { title: 'Grievance redressal', body: () => <Grievance /> },
  risk: { title: 'Risk management', body: () => <Risk /> },
  contact: { title: 'Contact us', body: () => <Contact /> },
  privacy: { title: L.privacy.title || 'Privacy policy', body: V => <ArticlePage V={V} data={L.privacy} related={RELATED.legal} /> },
  terms: { title: L.terms.title || 'Terms and conditions', body: V => <ArticlePage V={V} data={L.terms} related={RELATED.legal} /> },
  cancellation: { title: L.cancellation.title || 'Cancellation and refund', body: V => <ArticlePage V={V} data={L.cancellation} related={RELATED.legal} /> },
};
