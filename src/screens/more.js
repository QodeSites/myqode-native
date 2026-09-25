// More tab: profile, Investor Relations contact and the web app's menu groups.
import React from 'react';
import { View, Pressable, Linking } from 'react-native';
import { C, Tx, Card, Fade, Toggle } from '../ui';
import { ChevronRight, Phone, MailIcon, FaceID } from '../icons';
import { CONTACT } from '../content';
import { SectionLabel } from './kit';

const GROUPS = [
  { title: 'EXPERIENCE', items: [['Family accounts', 'family'], ['Investor portal guide', 'guide'], ['Service cadence', 'cadence']] },
  { title: 'ENGAGEMENT', items: [['Insights & events', 'insights'], ['Referral programme', 'referral']] },
  { title: 'ABOUT QODE', items: [['Qode philosophy', 'philosophy'], ['Strategy snapshot', 'strategies'], ['Note from our fund managers', 'foundation'], ['Your team at Qode', 'team']] },
  { title: 'TRUST', items: [['FAQ & glossary', 'faq'], ['Risk management', 'risk'], ['Grievance redressal', 'grievance']] },
  { title: 'SUPPORT & LEGAL', items: [['Contact us', 'contact'], ['Privacy policy', 'privacy'], ['Terms & conditions', 'terms'], ['Cancellation & refund', 'cancellation']] },
];

const go = url => Linking.openURL(url).catch(() => {});

export function MoreCream({ V }) {
  const phone = CONTACT.phones[0], mail = CONTACT.emails[0];
  return (
    <Fade>
      <Card big style={{ marginTop: -34, paddingVertical: 16, paddingHorizontal: 18 }}>
        <Tx w={700} s={11} ls={0.12} c={C.muted}>INVESTOR RELATIONS</Tx>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 12 }}>
          <View style={{ flex: 1 }}>
            <Tx w={700} s={13}>{mail ? mail.label : 'Investor Relations'}</Tx>
            <Tx s={11} c={C.muted} lh={1.4} style={{ marginTop: 2 }}>{CONTACT.hours[0] || 'We’re here to help'}</Tx>
          </View>
          {phone && (
            <Pressable onPress={() => go('tel:' + String(phone.number).replace(/[^\d+]/g, ''))} style={{ width: 42, height: 42, borderRadius: 21, borderWidth: 1, borderColor: C.greenBorder, alignItems: 'center', justifyContent: 'center' }}>
              <Phone />
            </Pressable>
          )}
          {mail && (
            <Pressable onPress={() => go('mailto:' + mail.address)} style={{ width: 42, height: 42, borderRadius: 21, borderWidth: 1, borderColor: C.greenBorder, alignItems: 'center', justifyContent: 'center' }}>
              <MailIcon />
            </Pressable>
          )}
        </View>
      </Card>
      {V.user && (
        <Card style={{ paddingVertical: 6, paddingHorizontal: 18, marginTop: 14 }}>
          {[['Name', V.user.name], ['Email', V.user.email], ['Client code', V.user.clientCode]].filter(r => r[1]).map(([k, v], i, a) => (
            <View key={k} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 12, borderBottomWidth: i < a.length - 1 ? 1 : 0, borderColor: C.hairline }}>
              <Tx s={12} c={C.muted}>{k}</Tx>
              <Tx w={700} s={12} numberOfLines={1} style={{ flexShrink: 1 }}>{v}</Tx>
            </View>
          ))}
        </Card>
      )}
      {!!V.bio && (
        <>
          <SectionLabel>SECURITY</SectionLabel>
          <Card style={{ paddingVertical: 14, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(2,66,43,0.1)', alignItems: 'center', justifyContent: 'center' }}><FaceID s={20} /></View>
            <View style={{ flex: 1 }}>
              <Tx w={700} s={13}>Unlock with {V.bio.label}</Tx>
              <Tx s={11} c={C.muted} style={{ marginTop: 2 }}>{V.bioOn ? 'On — asked each time the app opens' : 'Off — tap to turn on'}</Tx>
              {!!V.bioNote && <Tx s={10.5} c={C.gray} lh={1.4} style={{ marginTop: 4 }}>{V.bioNote}</Tx>}
            </View>
            <Toggle on={V.bioOn} onPress={V.bioToggle} />
          </Card>
        </>
      )}
      {GROUPS.map(g => (
        <View key={g.title}>
          <SectionLabel>{g.title}</SectionLabel>
          <Card style={{ overflow: 'hidden' }}>
            {g.items.map(([label, key], i) => (
              <Pressable key={key} onPress={() => V.openPage(key)} style={{
                flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 16, minHeight: 46,
                borderBottomWidth: i < g.items.length - 1 ? 1 : 0, borderColor: C.hairline,
              }}>
                <Tx w={700} s={13} style={{ flex: 1 }}>{label}</Tx>
                <ChevronRight />
              </Pressable>
            ))}
          </Card>
        </View>
      ))}
      {(V.isSuperAdmin || V.impersonated) && (
        <>
          <SectionLabel>ADMIN</SectionLabel>
          <Card style={{ overflow: 'hidden' }}>
            <Pressable onPress={() => V.openPage('admin')} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 16, minHeight: 46 }}>
              <Tx w={700} s={13} style={{ flex: 1 }}>{V.impersonated ? 'Admin · exit impersonation' : 'Admin · clients & impersonation'}</Tx>
              <ChevronRight />
            </Pressable>
          </Card>
        </>
      )}
      <SectionLabel>SETTINGS</SectionLabel>
      <Card style={{ overflow: 'hidden' }}>
        <Pressable onPress={V.openSettings} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 16, minHeight: 46 }}>
          <Tx w={700} s={13} style={{ flex: 1 }}>Display & accessibility</Tx>
          <ChevronRight />
        </Pressable>
      </Card>
      <Pressable onPress={V.doLogout} style={{ padding: 12, marginTop: 18 }}>
        <Tx w={700} s={13} c={C.red} center>Sign out</Tx>
      </Pressable>
      {V.testMode && (
        <Pressable onPress={V.reshowUcc} style={{ padding: 8 }}>
          <Tx w={700} s={11} c={C.gold} center>TEST: show the UCC pop-up again</Tx>
        </Pressable>
      )}
      <Tx s={10.5} c={C.gray} lh={1.6} center style={{ marginTop: 4 }}>
        myQode{'\n'}Qode Advisors LLP · SEBI Registered PMS
      </Tx>
    </Fade>
  );
}
