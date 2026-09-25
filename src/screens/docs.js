// Documents tab = the web's "Account Documents" page (app/(protected)/trust/client-document-vault/page.tsx),
// section for section: PMS Agreement, Account Opening Documents, CML — files listed with an "Open" link.
// All sections start collapsed and are drawn at once; the file counts fill in when the S3 listing arrives
// (cached in src/api, warmed at app start). Data: /api/mobile/documents/list + /documents/files/{category}
// (S3, 5-minute signed links).
import React, { useState } from 'react';
import { View, Pressable } from 'react-native';
import { C, Tx, Card, Fade } from '../ui';
import { DocIcon, ChevronRight } from '../icons';
import { documents } from '../api';
import { useLoad, openUrl, ErrorBox, Empty, SectionLabel, AccountChips } from './kit';

// Policies are not listed here: they live on More → Risk management (with the Referral Policy), as on the web.

// Same three sections, titles and descriptions as the web page. The mobile API also has a 4th
// folder (disclosures); the web does not show it, so neither do we.
const SECTIONS = [
  { id: 'pms-agreement', title: 'PMS Agreement', description: 'Your official agreement with Qode, executed at onboarding.' },
  { id: 'account-opening', title: 'Account Opening Documents', description: 'Verification of linked bank and demat accounts.' },
  { id: 'cml', title: 'CML', description: 'Capital Market License and regulatory documents.' },
];

function Section({ sec, accountId, count, reloadKey }) {
  const [open, setOpen] = useState(false);   // the client opens the section they want; nothing loads until then
  const files = useLoad(() => (open ? documents.files(sec.id, accountId) : Promise.resolve(null)), [open, sec.id, accountId, reloadKey]);
  const list = (files.data && files.data.files) || [];
  return (
    <Card style={{ overflow: 'hidden', marginBottom: 12 }}>
      <Pressable onPress={() => setOpen(o => !o)} style={{ padding: 16, minHeight: 56 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={{ transform: [{ rotate: open ? '90deg' : '0deg' }] }}><ChevronRight /></View>
          <Tx f="play" w={600} s={17} style={{ flex: 1 }}>{sec.title}</Tx>
          {count > 0 && (
            <View style={{ borderWidth: 1, borderColor: C.mutedBorder35, borderRadius: 999, paddingVertical: 2, paddingHorizontal: 8 }}>
              <Tx w={700} s={9.5} c={C.muted}>{count} {count === 1 ? 'file' : 'files'}</Tx>
            </View>
          )}
        </View>
        <Tx s={12} c={C.muted} lh={1.5} style={{ marginTop: 6, marginLeft: 24 }}>{sec.description}</Tx>
      </Pressable>
      {open && (
        <View style={{ borderTopWidth: 1, borderColor: C.hairline }}>
          {files.loading && <Tx s={12} c={C.muted} style={{ padding: 16 }}>Loading files…</Tx>}
          {!!files.err && (
            <Pressable onPress={files.reload} style={{ padding: 16 }}>
              <Tx s={12} c={C.red} lh={1.45}>{/server error|\(5\d\d\)/i.test(files.err) ? 'Documents are unavailable right now. Please try again later.' : files.err}</Tx>
              <Tx w={700} s={12} c={C.green} style={{ marginTop: 6 }}>Retry</Tx>
            </Pressable>
          )}
          {files.data && list.length === 0 && <Tx s={12} c={C.muted} style={{ padding: 16 }}>No files found in this section.</Tx>}
          {list.map((f, i) => (
            <View key={f.key} style={{
              flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13, paddingHorizontal: 16, minHeight: 48,
              borderBottomWidth: i < list.length - 1 ? 1 : 0, borderColor: C.hairline,
            }}>
              <DocIcon s={16} c={C.muted} />
              <Tx w={700} s={12.5} numberOfLines={1} style={{ flex: 1, minWidth: 0 }}>{f.filename}</Tx>
              <Pressable onPress={() => openUrl(f.url)} hitSlop={8}>
                <Tx w={700} s={12.5} c={C.green} style={{ textDecorationLine: 'underline' }}>Open</Tx>
              </Pressable>
            </View>
          ))}
        </View>
      )}
    </Card>
  );
}

export function DocsCream({ V }) {
  const opts = V.acctOptions;
  const [sel, setSel] = useState(null);
  const accountId = sel && opts.some(o => o.id === sel) ? sel : opts[0] && opts[0].id;
  const cats = useLoad(() => (accountId ? documents.list(accountId) : Promise.resolve(null)), [accountId, V.rk]);
  const counts = {};
  ((cats.data && cats.data.categories) || []).forEach(c => { counts[c.id] = c.fileCount; });
  return (
    <Fade>
      <Card big style={{ marginTop: -34, padding: 16 }}>
        <Tx f="play" w={600} s={20}>Account Documents</Tx>
        <Tx s={12} c={C.muted} lh={1.5} style={{ marginTop: 4 }}>Access important documents related to your Qode PMS account.</Tx>
        <AccountChips options={opts} value={accountId} onPick={setSel} />
      </Card>
      <SectionLabel style={{ marginTop: 20 }}>DOCUMENT LIST</SectionLabel>
      {!accountId && <Empty>No active account found.</Empty>}
      {!!cats.err && <ErrorBox msg={cats.err} onRetry={cats.reload} />}
      {/* Sections are drawn straight away; the "n files" badges appear once the listing arrives. */}
      {!!accountId && SECTIONS.map(sec => <Section key={sec.id + accountId} sec={sec} accountId={accountId} count={counts[sec.id] || 0} reloadKey={V.rk} />)}
    </Fade>
  );
}
