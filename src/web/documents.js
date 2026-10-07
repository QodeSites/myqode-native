// Desktop Documents (web ≥ 1024 px): the web's "Account Documents" page as a dashboard (section cards and the open
// section's files on the left; a summary and the Policies PDFs in a right-hand column). Same sections and data as
// the phone tab (src/screens/docs.js): /api/mobile/documents/list for the counts, /documents/files/{category} for
// a section's files (S3, 5-minute signed links; src/api caches a listing for 4 minutes). Below them, the Policies
// PDFs from More → Risk management (content.RISK), which the web serves from /policies/.
import React, { useState, useEffect } from 'react';
import { View, Pressable } from 'react-native';
import { C, Tx, Card, Row, Grid, PageIntro, Panel, Chips, Table, KeyVals, TextLink, Pill, Loading, Empty, ErrorBlock } from './kit';
import { DocIcon, ChevronRight } from '../icons';
import { documents, isDemo } from '../api';
import { useLoad, openUrl, fmtSize } from '../screens/kit';
import { fmtDate } from '../adapt';
import { RISK } from '../content';
import { track } from '../api/track';

// Same three sections, titles and descriptions as the web page (the API's 4th folder, disclosures, is not shown there).
const SECTIONS = [
  { id: 'pms-agreement', title: 'PMS Agreement', description: 'Your official agreement with Qode, executed at onboarding.' },
  { id: 'account-opening', title: 'Account Opening Documents', description: 'Verification of linked bank and demat accounts.' },
  { id: 'cml', title: 'CML', description: 'Client Master List (CML): your demat account record from the depository participant.' },
];
const REFRESH_MS = 4 * 60 * 1000;   // signed links last 5 minutes: re-list the open section before they expire

// openUrl() reports a missing link with Alert, which does nothing in a browser, so say it on the page instead.
function useOpener() {
  const [note, setNote] = useState('');
  const open = url => {
    if (!url) { setNote(isDemo() ? 'This is a sample document. Sign in with a real account to open your documents.' : 'This file has no link right now. Please try again.'); return; }
    setNote('');
    openUrl(url);
  };
  return { note, open };
}

function SectionCard({ sec, count, countLoading, active, onPress }) {
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ selected: active }} accessibilityLabel={`${sec.title}, ${count || 0} files`} onPress={onPress} style={{ flex: 1 }}>
      {({ hovered }) => (
        <Card style={{ flex: 1, padding: 18, minHeight: 168, borderColor: active ? C.green : hovered ? C.line2 : C.line, backgroundColor: active ? '#FBFCFA' : C.card,
          ...(active ? { outlineWidth: 1, outlineColor: C.green, outlineStyle: 'solid' } : null) }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ width: 36, height: 36, borderRadius: 8, backgroundColor: active ? C.green : C.greenTint, alignItems: 'center', justifyContent: 'center' }}>
              <DocIcon s={17} c={active ? '#FFFFFF' : C.green} />
            </View>
            {countLoading ? <Tx s={12} c={C.ink3}>Counting files…</Tx> : <Pill label={`${count || 0} ${count === 1 ? 'file' : 'files'}`} tone={count ? 'ok' : 'neutral'} />}
          </View>
          <Tx w={600} s={15} style={{ marginTop: 14 }} numberOfLines={2}>{sec.title}</Tx>
          <Tx s={12.5} c={C.ink2} lh={1.5} style={{ marginTop: 6, flex: 1 }}>{sec.description}</Tx>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 12 }}>
            <Tx w={600} s={12.5} c={C.green}>{active ? 'Showing files' : 'View files'}</Tx>
            <View style={{ transform: [{ rotate: active ? '90deg' : '0deg' }] }}><ChevronRight s={11} c={C.green} /></View>
          </View>
        </Card>
      )}
    </Pressable>
  );
}

function FilesPanel({ sec, accountId, reloadKey, onOpen }) {
  const files = useLoad(() => documents.files(sec.id, accountId), [sec.id, accountId, reloadKey]);
  // Keep the links fresh while the panel is open (useLoad keeps the old list on screen while it reloads).
  useEffect(() => { const t = setInterval(files.reload, REFRESH_MS); return () => clearInterval(t); }, [sec.id, accountId]);
  const list = ((files.data && files.data.files) || []).map(f => ({ ...f, id: f.key }));
  const cols = [
    { key: 'filename', label: 'File name', flex: 3, render: f => (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <DocIcon s={16} c={C.ink3} />
        <Tx w={600} s={13} numberOfLines={1} style={{ flex: 1 }}>{f.filename}</Tx>
      </View>
    ) },
    { key: 'size', label: 'Size', flex: 0.8, render: f => <Tx s={12.5} c={C.ink2}>{fmtSize(f.size) || '–'}</Tx> },
    { key: 'lastModified', label: 'Updated', flex: 1, render: f => <Tx s={12.5} c={C.ink2}>{f.lastModified ? fmtDate(f.lastModified) : '–'}</Tx> },
    { key: 'open', label: '', flex: 0.7, right: true, render: f => <TextLink label="Open" onPress={() => { track('event', 'document_open', { category: sec.id, source: 'documents' }); onOpen(f.url); }} /> },
  ];
  return (
    <Panel title={sec.title} sub={files.data ? `${list.length} ${list.length === 1 ? 'file' : 'files'}` : sec.description} pad={0}>
      {files.loading && !files.data ? <View style={{ padding: 20 }}><Loading rows={2} /></View>
        : files.err && !files.data ? <View style={{ padding: 20 }}><ErrorBlock msg={/server error|\(5\d\d\)/i.test(files.err) ? 'Documents are unavailable right now. Please try again later.' : files.err} onRetry={files.reload} /></View>
          : <Table cols={cols} rows={list} empty="No files found in this section." />}
    </Panel>
  );
}

// Policies PDFs as a compact list for the right-hand column.
function Policies({ onOpen }) {
  return (
    <Panel title="Policies" sub={RISK.intro[0]}>
      {RISK.policies.map((p, i) => (
        <View key={p.title} style={{ paddingVertical: 12, borderTopWidth: i ? 1 : 0, borderColor: C.line, marginTop: i ? 0 : -6 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <DocIcon s={15} c={C.ink3} />
            <Tx w={600} s={13} numberOfLines={1} style={{ flex: 1 }}>{p.title}</Tx>
            <TextLink label="Open" onPress={() => { track('event', 'document_open', { category: 'policy', source: 'documents' }); onOpen(p.pdf); }} />
          </View>
          <Tx s={12} c={C.ink2} lh={1.45} numberOfLines={2} style={{ marginTop: 4, marginLeft: 25 }}>{p.body[0]}</Tx>
        </View>
      ))}
    </Panel>
  );
}

export default function DesktopDocuments({ V }) {
  const opts = V.acctOptions || [];
  const [sel, setSel] = useState(null);
  const [pick, setSecId] = useState(undefined);   // undefined: nothing chosen yet, open the first section with files
  const accountId = sel && opts.some(o => o.id === sel) ? sel : opts[0] && opts[0].id;
  const cats = useLoad(() => (accountId ? documents.list(accountId) : Promise.resolve(null)), [accountId, V.rk]);
  const { note, open } = useOpener();
  const counts = {};
  ((cats.data && cats.data.categories) || []).forEach(c => { counts[c.id] = c.fileCount; });
  const secId = pick === undefined ? ((SECTIONS.find(s => counts[s.id] > 0) || SECTIONS[0]) || {}).id : pick;
  const sec = SECTIONS.find(s => s.id === secId);
  const counting = cats.loading && !cats.data;
  const total = SECTIONS.reduce((n, s) => n + (counts[s.id] || 0), 0);
  const acct = opts.find(o => o.id === accountId);

  return (
    <View>
      <PageIntro title="Account documents" sub="Important documents for your Qode PMS account. Choose a section to see its files."
        right={opts.length > 1 ? <Chips value={accountId} options={opts.map(o => [o.id, o.label])} onChange={id => { setSel(id); setSecId(undefined); }} /> : null} />
      {!!note && (
        <View style={{ marginBottom: 16, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 8, backgroundColor: C.goldTint, borderWidth: 1, borderColor: C.gold35 }}>
          <Tx s={13} c={C.ink}>{note}</Tx>
        </View>
      )}
      <Row top>
        <View style={{ flex: 1, minWidth: 0, gap: 16 }}>
          {!accountId ? <Empty>No active account found.</Empty> : (
            <>
              {!!cats.err && <ErrorBlock msg={cats.err} onRetry={cats.reload} />}
              {/* Cards are drawn straight away; the file counts fill in when the listing arrives. */}
              <Grid min={220} gap={16}>
                {SECTIONS.map(s => (
                  <SectionCard key={s.id} sec={s} count={counts[s.id]} countLoading={counting}
                    active={secId === s.id} onPress={() => setSecId(secId === s.id ? null : s.id)} />
                ))}
              </Grid>
              {sec
                ? <FilesPanel key={sec.id + accountId} sec={sec} accountId={accountId} reloadKey={V.rk} onOpen={open} />
                : (
                  <Card style={{ paddingVertical: 40, paddingHorizontal: 28, alignItems: 'center', borderStyle: 'dashed', borderColor: C.line2, backgroundColor: 'transparent' }}>
                    <DocIcon s={22} c={C.ink3} />
                    <Tx w={600} s={14.5} center style={{ marginTop: 10 }}>No section selected</Tx>
                    <Tx s={13} c={C.ink2} center lh={1.55} style={{ marginTop: 4, maxWidth: 420 }}>Select a section above to list its files. Each file opens in a new tab.</Tx>
                  </Card>
                )}
            </>
          )}
          {/* Policies live on their own page (Trust & Security → Risk Management & Controls); the summary panel was dropped. */}
          <Pressable accessibilityRole="link" onPress={() => V.openPage('risk')} style={({ hovered }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 18, borderRadius: 10, borderWidth: 1, borderColor: hovered ? C.green : C.line, backgroundColor: C.card })}>
            <DocIcon s={16} c={C.green} />
            <View style={{ flex: 1 }}>
              <Tx w={600} s={13.5} c={C.green}>Qode policies</Tx>
              <Tx s={12.5} c={C.ink3} style={{ marginTop: 2 }}>Hedging, liquidity, rebalancing, concentration and referral policies, on Risk Management & Controls</Tx>
            </View>
            <Tx w={600} s={13} c={C.green}>View policies ›</Tx>
          </Pressable>
        </View>
      </Row>
    </View>
  );
}
