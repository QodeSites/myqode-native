// Full-screen pages opened from the More tab: family, insights, guide, referral,
// about / trust copy, contact and legal. Copy lives in src/content.js.
import React, { useState } from 'react';
import { View, Pressable, ScrollView, Linking, TextInput } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C, Tx, Amt, Card, CTA, Fade } from '../ui';
import { ChevronLeft, ChevronRight, Phone, MailIcon } from '../icons';
import { experience, engagement, admin } from '../api';
import * as content from '../content';
import { FormBody } from './services';
import { useLoad, openUrl, fmtSize, Loading, ErrorBox, Empty, SectionLabel, LinkRow } from './kit';

const P = ({ children, style }) => <Tx s={13} lh={1.6} c={C.ink} style={[{ marginTop: 10 }, style]}>{children}</Tx>;

function Article({ data }) {
  return (
    <>
      {(data.intro || []).map((t, i) => <P key={'i' + i}>{t}</P>)}
      {(data.sections || []).map((s, i) => (
        <View key={i} style={{ marginTop: 22 }}>
          {!!s.h && <Tx f="play" w={600} s={18}>{s.h}</Tx>}
          {(s.p || []).map((t, j) => <P key={j}>{t}</P>)}
        </View>
      ))}
    </>
  );
}

function Family() {
  const fam = useLoad(() => experience.family(), []);
  const [open, setOpen] = useState({});
  if (fam.loading) return <Loading rows={3} h={84} />;
  if (fam.err) return <ErrorBox msg={fam.err} onRetry={fam.reload} />;
  const tree = (fam.data && fam.data.tree) || [];
  if (!tree.length) return <Empty>No family accounts to show.</Empty>;
  return tree.map(g => (
    <View key={g.groupId || g.groupName}>
      <SectionLabel style={{ marginTop: 6 }}>{String(g.groupName).toUpperCase()}</SectionLabel>
      {g.owners.map(o => {
        const isOpen = open[o.ownerId] !== false;
        return (
          <Card key={o.ownerId} style={{ overflow: 'hidden', marginBottom: 12 }}>
            <Pressable onPress={() => setOpen(s => ({ ...s, [o.ownerId]: !isOpen }))} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 }}>
              <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: C.green, alignItems: 'center', justifyContent: 'center' }}>
                <Tx w={700} s={11} c={C.cream}>{String(o.ownerName || '?').split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase()}</Tx>
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Tx w={700} s={13.5}>{o.ownerName}</Tx>
                {!!o.ownerEmail && <Tx s={11} c={C.muted} style={{ marginTop: 2 }}>{o.ownerEmail}</Tx>}
              </View>
              <View style={{ transform: [{ rotate: isOpen ? '90deg' : '0deg' }] }}><ChevronRight /></View>
            </Pressable>
            {isOpen && o.accounts.map((a, i) => (
              <View key={a.clientcode} style={{ borderTopWidth: 1, borderColor: C.hairline, paddingVertical: 12, paddingHorizontal: 16 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Tx w={700} s={12.5} style={{ flex: 1 }}>{a.clientcode}{a.relation ? ' · ' + a.relation : ''}</Tx>
                  <View style={{ borderWidth: 1, borderColor: a.status === 'Active' ? C.green : C.mutedBorder35, borderRadius: 999, paddingVertical: 2, paddingHorizontal: 8 }}>
                    <Tx w={700} s={8.5} ls={0.1} c={a.status === 'Active' ? C.green : C.muted}>{String(a.status).toUpperCase()}</Tx>
                  </View>
                </View>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginTop: 8 }}>
                  {a.portfolioValue > 0 && <Amt s={12} c={C.muted}>₹{Math.round(a.portfolioValue).toLocaleString('en-IN')}</Amt>}
                  {!!a.pannumber && <Tx s={11} c={C.muted}>PAN {a.pannumber}</Tx>}
                  {!!a.mobile && <Tx s={11} c={C.muted}>{a.mobile}</Tx>}
                  {!!a.city && <Tx s={11} c={C.muted}>{a.city}</Tx>}
                </View>
              </View>
            ))}
          </Card>
        );
      })}
    </View>
  ));
}

function Insights() {
  const tabs = [['Newsletters', 'newsletters'], ['Perspectives', 'perspectives'], ['Events', 'events']];
  const [tab, setTab] = useState('newsletters');
  const list = useLoad(() => engagement[tab](), [tab]);
  const items = (list.data && list.data.items) || [];
  return (
    <>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {tabs.map(([l, k]) => (
          <Pressable key={k} onPress={() => setTab(k)} style={{
            flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: 999, borderWidth: 1,
            borderColor: tab === k ? C.green : C.mutedBorder35, backgroundColor: tab === k ? C.green : 'transparent',
          }}><Tx w={700} s={11} c={tab === k ? C.cream : C.muted}>{l}</Tx></Pressable>
        ))}
      </View>
      <View style={{ marginTop: 16 }}>
        {list.loading && <Loading />}
        {!!list.err && <ErrorBox msg={list.err} onRetry={list.reload} />}
        {!list.loading && !list.err && !items.length && <Empty>Nothing published here yet.</Empty>}
        {!list.loading && items.length > 0 && (
          <Card style={{ overflow: 'hidden' }}>
            {items.map((it, i) => (
              <LinkRow key={it.key} title={it.title} sub={[it.type === 'pdf' ? 'PDF' : 'File', fmtSize(it.size)].filter(Boolean).join(' · ')}
                onPress={() => openUrl(it.url)} last={i === items.length - 1} />
            ))}
          </Card>
        )}
      </View>
    </>
  );
}

function Guide() {
  const guide = useLoad(() => engagement.portalGuide(), []);
  const videos = (guide.data && guide.data.videos) || [];
  return (
    <>
      <P style={{ marginTop: 0 }}>Reports available on the Nuvama WealthSpectrum portal, and how to read them.</P>
      {videos.length > 0 && (
        <>
          <SectionLabel>VIDEO TUTORIALS</SectionLabel>
          <Card style={{ overflow: 'hidden' }}>
            {videos.map((v, i) => <LinkRow key={v.key} title={v.reportName || v.filename} sub="Watch tutorial" onPress={() => openUrl(v.url)} last={i === videos.length - 1} />)}
          </Card>
        </>
      )}
      <SectionLabel>REPORTS</SectionLabel>
      <Card style={{ overflow: 'hidden' }}>
        {content.REPORTS.map((r, i) => (
          <View key={r.title} style={{ paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: i < content.REPORTS.length - 1 ? 1 : 0, borderColor: C.hairline }}>
            <Tx w={700} s={13}>{r.title}</Tx>
            {!!r.desc && <Tx s={11.5} c={C.muted} lh={1.5} style={{ marginTop: 3 }}>{r.desc}</Tx>}
          </View>
        ))}
      </Card>
    </>
  );
}

const REFERRAL_FORM = {
  cta: 'SUBMIT REFERRAL', account: true,
  fields: [
    { k: 'name', label: 'REFERRED PERSON’S NAME', kind: 'text' },
    { k: 'email', label: 'EMAIL', kind: 'email' },
    { k: 'phone', label: 'PHONE', kind: 'phone' },
    { k: 'desc', label: 'NOTE (OPTIONAL)', kind: 'multiline' },
  ],
  check: v => (!(v.name || '').trim() ? 'Please add their name.' : !/.+@.+\..+/.test(v.email || '') ? 'That email doesn’t look complete.' : (v.phone || '').replace(/\D/g, '').length < 10 ? 'Enter a 10-digit phone number.' : ''),
  submit: (a, v) => engagement.referral({ accountId: a, name: v.name.trim(), email: v.email.trim(), phone: v.phone.trim(), description: v.desc || undefined }),
};

function Referral({ V }) {
  return (
    <>
      <Article data={{ intro: content.REFERRAL.intro }} />
      {content.REFERRAL.points.length > 0 && (
        <Card style={{ padding: 16, marginTop: 16 }}>
          {content.REFERRAL.points.map((t, i) => (
            <View key={i} style={{ flexDirection: 'row', gap: 10, marginTop: i ? 10 : 0 }}>
              <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: C.gold, marginTop: 8 }} />
              <Tx s={13} lh={1.55} style={{ flex: 1 }}>{t}</Tx>
            </View>
          ))}
        </Card>
      )}
      <SectionLabel>REFER SOMEONE</SectionLabel>
      <Card style={{ padding: 16, paddingTop: 4 }}>
        <FormBody cfg={REFERRAL_FORM} opts={V.acctOptions} onDone={V.closePage} />
      </Card>
    </>
  );
}

function Faq() {
  const [open, setOpen] = useState(null);
  return (
    <>
      {content.FAQ.map((g, gi) => (
        <View key={g.topic}>
          <SectionLabel style={{ marginTop: gi ? 22 : 0 }}>{g.topic.toUpperCase()}</SectionLabel>
          <Card style={{ overflow: 'hidden' }}>
            {g.items.map((it, i) => {
              const id = gi + ':' + i, on = open === id;
              return (
                <View key={id} style={{ borderBottomWidth: i < g.items.length - 1 ? 1 : 0, borderColor: C.hairline }}>
                  <Pressable onPress={() => setOpen(on ? null : id)} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 15 }}>
                    <Tx w={700} s={13} lh={1.4} style={{ flex: 1 }}>{it.q}</Tx>
                    <View style={{ transform: [{ rotate: on ? '90deg' : '0deg' }] }}><ChevronRight /></View>
                  </Pressable>
                  {on && <Tx s={12.5} c={C.muted} lh={1.6} style={{ paddingHorizontal: 15, paddingBottom: 15 }}>{it.a}</Tx>}
                </View>
              );
            })}
          </Card>
        </View>
      ))}
      <SectionLabel style={{ marginTop: 26 }}>GLOSSARY</SectionLabel>
      <Card style={{ overflow: 'hidden' }}>
        {content.GLOSSARY.map((g, i) => (
          <View key={g.term} style={{ padding: 15, borderBottomWidth: i < content.GLOSSARY.length - 1 ? 1 : 0, borderColor: C.hairline }}>
            <Tx w={700} s={13}>{g.term}</Tx>
            <Tx s={12.5} c={C.muted} lh={1.55} style={{ marginTop: 4 }}>{g.def}</Tx>
          </View>
        ))}
      </Card>
    </>
  );
}

function Grievance() {
  const G = content.GRIEVANCE;
  return (
    <>
      {G.intro.map((t, i) => <P key={i} style={i ? null : { marginTop: 0 }}>{t}</P>)}
      {G.levels.map(l => (
        <Card key={l.level + l.title} style={{ padding: 16, marginTop: 14, borderLeftWidth: 3, borderLeftColor: C.gold }}>
          <Tx w={700} s={10} ls={0.12} c={C.muted}>{String(l.level).toUpperCase()}</Tx>
          <Tx w={700} s={14} style={{ marginTop: 4 }}>{l.title}</Tx>
          {l.body.map((t, i) => <Tx key={i} s={12.5} c={C.muted} lh={1.55} style={{ marginTop: 6 }}>{t}</Tx>)}
          {l.contact.map((t, i) => <Tx key={'c' + i} w={700} s={12.5} c={C.green} style={{ marginTop: 6 }}>{t}</Tx>)}
        </Card>
      ))}
      {G.protection.length > 0 && (
        <>
          <SectionLabel>INVESTOR PROTECTION</SectionLabel>
          <Card style={{ padding: 16 }}>
            {G.protection.map((t, i) => <Tx key={i} s={12.5} lh={1.6} style={{ marginTop: i ? 8 : 0 }}>{t}</Tx>)}
          </Card>
        </>
      )}
    </>
  );
}

function Risk() {
  const R = content.RISK;
  return (
    <>
      {R.intro.map((t, i) => <P key={i} style={i ? null : { marginTop: 0 }}>{t}</P>)}
      {R.policies.map(p => (
        <Card key={p.title} style={{ padding: 16, marginTop: 14 }}>
          <Tx f="play" w={600} s={17}>{p.title}</Tx>
          {p.body.map((t, i) => <Tx key={i} s={12.5} c={C.muted} lh={1.6} style={{ marginTop: 8 }}>{t}</Tx>)}
          {!!p.pdf && <CTA label="VIEW POLICY (PDF)" outline onPress={() => openUrl(p.pdf)} style={{ marginTop: 12, paddingVertical: 11 }} />}
        </Card>
      ))}
    </>
  );
}

function Strategies() {
  return (
    <>
      {content.STRATEGIES.map(s => (
        <Card key={s.prefix + s.name} style={{ padding: 16, marginBottom: 14 }}>
          <Tx w={700} s={10} ls={0.12} c={C.muted}>{s.prefix}</Tx>
          <Tx f="play" w={600} s={18} style={{ marginTop: 4 }}>{s.name}</Tx>
          {!!s.tagline && <Tx s={12.5} c={C.muted} lh={1.55} style={{ marginTop: 6 }}>{s.tagline}</Tx>}
          {s.points.map((t, i) => (
            <View key={i} style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
              <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: C.gold, marginTop: 8 }} />
              <Tx s={12.5} lh={1.55} style={{ flex: 1 }}>{t}</Tx>
            </View>
          ))}
        </Card>
      ))}
      {content.STRATEGY_GLOSSARY.length > 0 && <SectionLabel>GLOSSARY</SectionLabel>}
      {content.STRATEGY_GLOSSARY.map(g => (
        <View key={g.term} style={{ marginBottom: 12 }}>
          <Tx w={700} s={13}>{g.term}</Tx>
          <Tx s={12.5} c={C.muted} lh={1.55} style={{ marginTop: 3 }}>{g.def}</Tx>
        </View>
      ))}
    </>
  );
}

function Team() {
  return content.TEAM.map(t => (
    <Card key={t.name} style={{ padding: 16, marginBottom: 12 }}>
      <Tx w={700} s={14}>{t.name}</Tx>
      {!!t.role && <Tx w={700} s={10.5} ls={0.08} c={C.muted} style={{ marginTop: 3 }}>{t.role}</Tx>}
      {!!t.bio && <Tx s={12.5} c={C.muted} lh={1.55} style={{ marginTop: 8 }}>{t.bio}</Tx>}
    </Card>
  ));
}

function Contact() {
  const K = content.CONTACT;
  const go = url => Linking.openURL(url).catch(() => {});
  return (
    <>
      {K.phones.length > 0 && <SectionLabel style={{ marginTop: 0 }}>CALL</SectionLabel>}
      {K.phones.length > 0 && (
        <Card style={{ overflow: 'hidden' }}>
          {K.phones.map((p, i) => (
            <LinkRow key={p.number} title={p.label} sub={p.number} icon={<Phone />} right={null}
              onPress={() => go('tel:' + String(p.number).replace(/[^\d+]/g, ''))} last={i === K.phones.length - 1} />
          ))}
        </Card>
      )}
      {K.emails.length > 0 && <SectionLabel>EMAIL</SectionLabel>}
      {K.emails.length > 0 && (
        <Card style={{ overflow: 'hidden' }}>
          {K.emails.map((e, i) => <LinkRow key={e.address} title={e.label} sub={e.address} icon={<MailIcon />} right={null} onPress={() => go('mailto:' + e.address)} last={i === K.emails.length - 1} />)}
        </Card>
      )}
      {(K.address.length > 0 || K.hours.length > 0) && <SectionLabel>OFFICE</SectionLabel>}
      {(K.address.length > 0 || K.hours.length > 0) && (
        <Card style={{ padding: 16 }}>
          {K.address.map((t, i) => <Tx key={i} s={13} lh={1.55}>{t}</Tx>)}
          {K.hours.map((t, i) => <Tx key={'h' + i} s={12} c={C.muted} style={{ marginTop: 8 }}>{t}</Tx>)}
        </Card>
      )}
    </>
  );
}

// ── Developer: what each screen needs, what the backend has, and how to close the gaps ──
const REQS = [
  { s: 'Home, Portfolio, Holdings', ok: true, has: 'portfolio/snapshot, performance, nav, drawdown, monthly-pl, quarterly-pl, cashflow (+ combined-* for owner/family).', gap: 'XIRR, TWRR, Sharpe/Sortino/beta and “today’s change” are not computed by the API. To show them: add them to /portfolio/performance from pms_master_sheet cash flows and daily NAV (server-side), or accept they stay off the app.' },
  { s: 'Holdings · stock-level detail', ok: false, has: 'Only strategy accounts with their value/return (from performance per account code).', gap: 'Security-level holdings live with the custodian (Nuvama WealthSpectrum), not in pms_master_sheet. Needs a nightly import into a new holdings table + GET /api/mobile/portfolio/holdings?accountId.' },
  { s: 'Documents', ok: true, has: 'documents/list + documents/files/{category} — the web’s Account Documents page, section for section (PMS Agreement, Account Opening Documents, CML) from S3 docs/client-documents/{clientid}/, 5-minute signed links.', gap: 'Statements, factsheets, capital-gains and fee invoices are not stored anywhere yet: add S3 folders under docs/client-documents/{clientid}/ plus category ids in documents/list. S3 listing needs valid AWS keys on the server (the dev server currently answers InvalidAccessKeyId). Owner/family ids return 404, so the app asks per account code.' },
  { s: 'Services · requests', ok: true, has: 'services/withdrawal, switch, strategy-inquiry, discussion, account-request, engagement/referral, services/bank-details.', gap: 'No history: every request only returns an inquiry_id. To show past requests add GET /api/mobile/services/inquiries reading pms_clients_tracker.qode_microsite_inquiries by user_email.' },
  { s: 'Services · pay online / SIP', ok: true, has: 'One-time top-ups through Razorpay: payments/razorpay/create-order → hosted Checkout in a WebView → payments/razorpay/verify (signature + gateway check) → payments/investment-status; a signed webhook (payments/razorpay/webhook) keeps the status current. Existing SIPs: verify-sip, pause-resume-sip, cancel-sip.', gap: 'New SIP mandates (UPI Autopay / eMandate) need Razorpay Subscriptions — not built. The Cashfree routes remain for the web. Client notifications for Razorpay payments are off unless RAZORPAY_NOTIFY_CLIENT=true on the server. Production needs live Razorpay keys, the webhook registered on the live URL, and a store build if you later switch to the native Razorpay SDK.' },
  { s: 'Notifications (bell)', ok: false, has: 'services/register-push-token (POST/DELETE). Push is sent by the Cashfree webhook via lib/notifications.ts.', gap: 'No inbox endpoint. Needs a notifications table written wherever notifyClientById is called + GET /api/mobile/notifications. Push itself needs expo-notifications, an EAS project id, and Firebase (FCM) credentials for Android. Registration is blocked in test mode so the client is never pushed.' },
  { s: 'Family accounts', ok: true, has: 'experience/family (group → owner → accounts with masked PAN, mobile, city, status).', gap: 'Family-mapping changes go through services/account-request (email to IR); there is no self-service edit.' },
  { s: 'Insights & events, Portal guide', ok: true, has: 'engagement/newsletters, perspectives, events (S3 docs/newsletters, docs/prespectives, docs/events), engagement/portal-guide (S3 videos/reports-tutorial, images/reports-snapshot).', gap: 'Lists are empty until files exist in those S3 prefixes. Report descriptions are static text from the web page.' },
  { s: 'Profile, KYC, bank & nominee', ok: false, has: 'auth/me (name, email, client code, account codes only).', gap: 'Needs GET /api/mobile/profile from pms_clients_master (PAN masked, address, mobile, bank, nominee, KYC status). Edits should stay request-based (services/account-request).' },
  { s: 'Nuvama primary UCC banner', ok: false, has: 'Web only: /api/primary-ucc (cookie session).', gap: 'Add GET /api/mobile/primary-ucc using lib/primaryUcc.ts with the mobile JWT.' },
  { s: 'Login · first-time password, forgot', ok: true, has: 'check-identifier, login, send-setup-otp, verify-setup-otp, complete-otp-setup, forgot (emails a web reset link).', gap: 'No in-app reset for an existing password: add POST /api/mobile/auth/reset {token,newPassword} or deep-link myqode.qodeinvest.com/reset-password into the app. Emails and password changes are blocked in test mode.' },
  { s: 'New-investor onboarding', ok: false, has: 'Nothing — the 8-step flow in the app is a static design demo.', gap: 'Needs a full onboarding backend (application record, OTP, document upload to S3, risk profile, nominees, e-sign/KYC). Keep disabled until then.' },
  { s: 'App version, analytics, admin', ok: true, has: 'app-version (checked on launch), engagement/analytics (screen events batched every 20s), admin/clients, admin/impersonate, admin/analytics (super-admin only).', gap: 'app-version is driven by APP_MIN_VERSION / APP_LATEST_VERSION env vars on the server; the app version is APP_VERSION in src/api/config.js.' },
];

function Requirements() {
  return (
    <>
      <P style={{ marginTop: 0 }}>Every /api/mobile route is wired. Rows marked with a dot still need data or native work. Nothing here contacts the client.</P>
      {REQS.map(r => (
        <Card key={r.s} style={{ padding: 16, marginTop: 12, borderLeftWidth: 3, borderLeftColor: r.ok ? C.green : C.gold }}>
          <Tx w={700} s={13.5}>{r.s}</Tx>
          <Tx w={700} s={9.5} ls={0.12} c={C.muted} style={{ marginTop: 10 }}>USES</Tx>
          <Tx s={12} c={C.muted} lh={1.5} style={{ marginTop: 3 }}>{r.has}</Tx>
          <Tx w={700} s={9.5} ls={0.12} c={C.muted} style={{ marginTop: 10 }}>{r.ok ? 'TO IMPROVE' : 'MISSING · HOW TO BRING IT'}</Tx>
          <Tx s={12} lh={1.5} style={{ marginTop: 3 }}>{r.gap}</Tx>
        </Card>
      ))}
    </>
  );
}

function AdminPage({ V }) {
  const [q, setQ] = useState('');
  const list = useLoad(() => admin.clients('', 1, 500), []);
  const [st, setSt] = useState({ busy: '', err: '' });
  const rows = ((list.data && list.data.clients) || []).filter(c => {
    const t = q.trim().toLowerCase();
    return !t || [c.ownerName, c.email, c.headClientCode, ...(c.accountCodes || [])].some(x => String(x || '').toLowerCase().includes(t));
  }).slice(0, 60);
  const go = async c => {
    const code = c.headClientCode || (c.accountCodes || [])[0];
    if (!code || st.busy) return;
    setSt({ busy: code, err: '' });
    try { await V.impersonate(code); } catch (e) { setSt({ busy: '', err: e.message }); }
  };
  return (
    <>
      {V.impersonated ? (
        <Card style={{ padding: 16, borderWidth: 1, borderColor: C.red }}>
          <Tx w={700} s={13}>You are viewing as {V.user && V.user.name}</Tx>
          <CTA label="EXIT IMPERSONATION" outline onPress={V.exitImpersonation} style={{ marginTop: 12 }} />
        </Card>
      ) : (
        <>
          <P style={{ marginTop: 0 }}>Open the app as any client with a 4-hour scoped token. Admin calls keep using your own token.</P>
          <TextInput value={q} onChangeText={setQ} placeholder="Search name, email or code" placeholderTextColor={C.gray} autoCapitalize="none"
            style={{ marginTop: 12, backgroundColor: C.card, borderWidth: 1, borderColor: 'rgba(55,88,79,0.2)', borderRadius: 999, paddingHorizontal: 16, height: 44, fontFamily: 'Lato_400Regular', fontSize: 14, color: C.ink }} />
          {list.loading && <View style={{ marginTop: 14 }}><Loading /></View>}
          {!!list.err && <View style={{ marginTop: 14 }}><ErrorBox msg={list.err} onRetry={list.reload} /></View>}
          {!!st.err && <Tx s={12} c={C.red} style={{ marginTop: 10 }}>{st.err}</Tx>}
          {rows.length > 0 && (
            <Card style={{ overflow: 'hidden', marginTop: 14 }}>
              {rows.map((c, i) => (
                <LinkRow key={c.ownerId + i} title={c.ownerName || c.email} last={i === rows.length - 1} onPress={() => go(c)}
                  sub={[c.headClientCode, c.email, (c.accountCodes || []).length + ' accounts', c.lastLogin ? 'last login ' + String(c.lastLogin).slice(0, 10) : 'never logged in'].filter(Boolean).join(' · ')}
                  right={st.busy === (c.headClientCode || (c.accountCodes || [])[0]) ? <Tx s={11} c={C.muted}>…</Tx> : undefined} />
              ))}
            </Card>
          )}
        </>
      )}
    </>
  );
}

const PAGES = {
  requirements: { title: 'Data requirements & API coverage', body: () => <Requirements /> },
  admin: { title: 'Admin', body: V => <AdminPage V={V} /> },
  family: { title: 'Family accounts', body: () => <Family /> },
  insights: { title: 'Insights & events', body: () => <Insights /> },
  guide: { title: 'Investor portal guide', body: () => <Guide /> },
  referral: { title: 'Referral programme', body: V => <Referral V={V} /> },
  cadence: { title: content.CADENCE.title || 'Service cadence', body: () => <Article data={content.CADENCE} /> },
  philosophy: { title: 'Qode philosophy', body: () => <Article data={content.PHILOSOPHY} /> },
  foundation: { title: content.FOUNDATION.title || 'Foundation', body: () => <Article data={content.FOUNDATION} /> },
  strategies: { title: 'Strategy snapshot', body: () => <Strategies /> },
  team: { title: 'Your team at Qode', body: () => <Team /> },
  faq: { title: 'FAQ & glossary', body: () => <Faq /> },
  grievance: { title: 'Grievance redressal', body: () => <Grievance /> },
  risk: { title: 'Risk management', body: () => <Risk /> },
  contact: { title: 'Contact us', body: () => <Contact /> },
  privacy: { title: content.LEGAL.privacy.title || 'Privacy policy', body: () => <Article data={content.LEGAL.privacy} /> },
  terms: { title: content.LEGAL.terms.title || 'Terms & conditions', body: () => <Article data={content.LEGAL.terms} /> },
  cancellation: { title: content.LEGAL.cancellation.title || 'Cancellation & refund', body: () => <Article data={content.LEGAL.cancellation} /> },
};

export function PageHost({ V }) {
  const insets = useSafeAreaInsets();
  const pg = PAGES[V.page];
  if (!pg) return null;
  return (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: C.cream }}>
      <LinearGradient colors={C.darkGrad} locations={[0, 0.62, 1]} start={{ x: 0.1, y: 0 }} end={{ x: 0.6, y: 1 }}
        style={{ paddingTop: insets.top + 10, paddingBottom: 22, paddingHorizontal: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Pressable onPress={V.closePage} hitSlop={10} style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}>
            <ChevronLeft />
          </Pressable>
          <Tx f="play" w={600} s={20} c={C.cream} numberOfLines={2} style={{ flex: 1 }}>{pg.title}</Tx>
        </View>
        <View style={{ width: 44, height: 2, backgroundColor: C.gold, marginTop: 10, marginLeft: 46 }} />
      </LinearGradient>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 40 }}>
        <Fade key={V.page}>{pg.body(V)}</Fade>
      </ScrollView>
    </View>
  );
}
