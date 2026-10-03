// More tab: profile and settings at the top, then the investor menu's five groups (NAV_GROUPS in src/nav.js, shared
// with the desktop sidebar), admin, legal and the session. Investor Relations' contact lives on Your Team at Qode.
import React from 'react';
import { View, Pressable, Platform, Alert } from 'react-native';
import { C, Tx, Card, Fade, Toggle } from '../ui';
import { ChevronRight, FaceID, GroupIcon } from '../icons';
import { NAV_GROUPS, LEGAL_LINKS, openItem, visibleItems } from '../nav';
import { SignOutButton, SectionLabel } from './kit';
import { ContactIRLink } from './contact';

import { monitoringOn, reportError } from '../monitoring';
function MenuRow({ label, onPress, last }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={{
      flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 16, minHeight: 46,
      borderBottomWidth: last ? 0 : 1, borderColor: C.hairline,
    }}>
      <Tx w={700} s={13} style={{ flex: 1 }}>{label}</Tx>
      <ChevronRight />
    </Pressable>
  );
}

function GroupTitle({ icon, children }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 24, marginBottom: 10, marginLeft: 2 }}>
      <GroupIcon name={icon} s={16} c={C.green} />
      <Tx f="play" w={600} s={16} role="heading">{children}</Tx>
    </View>
  );
}

export function MoreCream({ V }) {
  // Reports has its own tab on the phone; the menu item goes there instead of opening the page over it.
  const open = it => (it.id === 'reports' && V.goReports ? V.goReports() : openItem(V, it));
  return (
    <Fade>
      {/* Profile and settings */}
      <Card big style={{ marginTop: -34, paddingVertical: 6, paddingHorizontal: 18 }}>
        {V.user && [['Name', V.user.name], ['Email', V.user.email], ['Client code', V.user.clientCode]].filter(r => r[1]).map(([k, v]) => (
          <View key={k} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderColor: C.hairline }}>
            <Tx s={12} c={C.muted}>{k}</Tx>
            <Tx w={700} s={12} numberOfLines={1} style={{ flexShrink: 1 }}>{v}</Tx>
          </View>
        ))}
        <Pressable accessibilityRole="button" onPress={V.openSettings} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, minHeight: 46 }}>
          <Tx w={700} s={13} style={{ flex: 1 }}>Display and accessibility</Tx>
          <ChevronRight />
        </Pressable>
        {!V.viewing && (
          <Pressable accessibilityRole="button" onPress={() => V.openPage('notifications')} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, minHeight: 46, borderTopWidth: 1, borderColor: C.hairline }}>
            <Tx w={700} s={13} style={{ flex: 1 }}>Notifications</Tx>
            <ChevronRight />
          </Pressable>
        )}
      </Card>
      {!!V.bio && (
        <Card style={{ paddingVertical: 14, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 12 }}>
          <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(2,66,43,0.1)', alignItems: 'center', justifyContent: 'center' }}><FaceID s={20} /></View>
          <View style={{ flex: 1 }}>
            <Tx w={700} s={13}>Unlock with {V.bio.label}</Tx>
            <Tx s={11} c={C.muted} style={{ marginTop: 2 }}>{V.bioOn ? 'On: asked each time the app opens' : 'Off: tap to turn on'}</Tx>
            {!!V.bioNote && <Tx s={10.5} c={C.gray} lh={1.4} style={{ marginTop: 4 }}>{V.bioNote}</Tx>}
          </View>
          <Toggle on={V.bioOn} onPress={V.bioToggle} />
        </Card>
      )}
      <ContactIRLink V={V} style={{ marginTop: 10, marginLeft: 2 }} />

      {NAV_GROUPS.map(g => {
        const items = visibleItems(g, V);
        return (
          <View key={g.key}>
            <GroupTitle icon={g.icon}>{g.title}</GroupTitle>
            <Card style={{ overflow: 'hidden' }}>
              {items.map((it, i) => <MenuRow key={it.id} label={it.label} onPress={() => open(it)} last={i === items.length - 1} />)}
            </Card>
          </View>
        );
      })}

      {(V.isSuperAdmin || V.impersonated) && (
        <>
          <SectionLabel>ADMIN</SectionLabel>
          <Card style={{ overflow: 'hidden' }}>
            <MenuRow label={V.impersonated ? 'Admin · exit impersonation' : 'Admin · clients and impersonation'} onPress={() => V.openPage('admin')} last={!(monitoringOn && V.isSuperAdmin)} />
            {monitoringOn && V.isSuperAdmin && (
              <MenuRow label="Admin · send a test error report" last onPress={() => {
                reportError(new Error(`Test report from the myQode app (${Platform.OS}), sent by an admin from More`));
                Alert.alert('Test report sent', 'It should appear in Sentry (qode-app) and Teams within a minute.');
              }} />
            )}
          </Card>
        </>
      )}
      <SectionLabel>LEGAL</SectionLabel>
      <Card style={{ overflow: 'hidden' }}>
        {LEGAL_LINKS.map(([key, label], i) => <MenuRow key={key} label={label} onPress={() => V.openPage(key)} last={i === LEGAL_LINKS.length - 1} />)}
      </Card>
      {V.viewing ? (
        <Pressable onPress={V.exitView} style={{ padding: 12, marginTop: 18 }}>
          <Tx w={700} s={13} c={C.green} center>Back to distributor panel</Tx>
        </Pressable>
      ) : (
        <SignOutButton onPress={V.doLogout} />
      )}
      <Tx s={10.5} c={C.gray} lh={1.6} center style={{ marginTop: 4 }}>
        myQode{'\n'}Qode Advisors LLP · SEBI Registered PMS
      </Tx>
    </Fade>
  );
}
