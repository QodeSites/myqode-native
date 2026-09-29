// Desktop "Profile and settings" (the sidebar's user card; address /app/account): the phone's profile and settings
// from src/screens/more.js as a page. Left column: profile, security and display preferences, admin tools and the
// session. Right column: help (a link to Investor Relations on Your Team at Qode) and the legal pages. The investor
// menu itself is in the sidebar (NAV_GROUPS, src/nav.js). Same V and the same handlers as the phone.
import React from 'react';
import { View, Pressable } from 'react-native';
import { C, Tx, Card, Row, PageIntro, Panel, Btn, Chips, Pill } from './kit';
import { ChevronRight } from '../icons';
import { initials } from '../adapt';
import { LEGAL_LINKS } from '../nav';
import { ContactIRLink } from './contact';

export default function DesktopAccount({ V }) {
  return (
    <View style={{ gap: 20 }}>
      <PageIntro sub="Your profile, security and display preferences." />
      <Row top>
        <View style={{ flex: 1.35, minWidth: 0, gap: 20 }}>
          <Profile V={V} />
          <Preferences V={V} />
          {(V.isSuperAdmin || V.impersonated) && <Admin V={V} />}
          <Session V={V} />
        </View>
        <View style={{ flex: 1, minWidth: 0, gap: 20 }}>
          <Panel title="Need help?" sub="Questions about your account, reports or a request">
            <ContactIRLink V={V} />
          </Panel>
          <Panel title="Legal" pad={0}>
            <View style={{ borderTopWidth: 1, borderColor: C.line }}>
              {LEGAL_LINKS.map(([key, label], i) => <ListRow key={key} first={i === 0} label={label} onPress={() => V.openPage(key)} />)}
            </View>
          </Panel>
        </View>
      </Row>
    </View>
  );
}

function Profile({ V }) {
  const u = V.user || {};
  const rows = [['Email', u.email], ['Client code', u.clientCode]].filter(r => r[1]);
  return (
    <Card>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, padding: 20 }}>
        <View style={{ width: 56, height: 56, borderRadius: 12, backgroundColor: C.green, alignItems: 'center', justifyContent: 'center' }}>
          <Tx f="play" w={700} s={20} c={C.gold}>{initials(u.name)}</Tx>
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Tx w={600} s={18} numberOfLines={1} role="heading" aria-level={3}>{u.name || 'Investor'}</Tx>
          <Tx s={12.5} c={C.ink3} style={{ marginTop: 3 }}>Profile</Tx>
        </View>
        {V.impersonated && <Pill label="Impersonating" tone="warn" />}
      </View>
      {rows.map(([k, v]) => (
        <View key={k} style={{ flexDirection: 'row', alignItems: 'center', gap: 16, paddingVertical: 12, paddingHorizontal: 20, borderTopWidth: 1, borderColor: C.line }}>
          <Tx s={13} c={C.ink2} style={{ width: 110 }}>{k}</Tx>
          <Tx w={600} s={13.5} numberOfLines={1} style={{ flex: 1 }}>{v}</Tx>
        </View>
      ))}
    </Card>
  );
}

// A static switch drawn inside a row that is itself the pressable control (one button per setting, not two
// nested ones), so it can carry the switch role and state for screen readers.
function Switch({ on }) {
  return (
    <View style={{ width: 42, height: 24, borderRadius: 12, padding: 3, backgroundColor: on ? C.green : C.line2 }}>
      <View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: C.card, transform: [{ translateX: on ? 18 : 0 }] }} />
    </View>
  );
}

function SettingRow({ title, sub, note, on, onPress }) {
  return (
    <Pressable accessibilityRole="switch" accessibilityState={{ checked: !!on }} accessibilityLabel={title} onPress={onPress}
      style={({ hovered }) => ({ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, paddingHorizontal: 20,
        borderTopWidth: 1, borderColor: C.line, backgroundColor: hovered ? C.hover : 'transparent' })}>
      <View style={{ flex: 1 }}>
        <Tx w={600} s={13.5}>{title}</Tx>
        {!!sub && <Tx s={12} c={C.ink3} style={{ marginTop: 2 }}>{sub}</Tx>}
        {!!note && <Tx s={12} c={C.ink3} lh={1.4} style={{ marginTop: 4 }}>{note}</Tx>}
      </View>
      <Switch on={on} />
    </Pressable>
  );
}

// The Display & accessibility sheet's controls (V.tsChips / hcToggle / rmToggle) inline, plus the phone's
// biometric toggle when the device has one (V.bio is null on web, so it stays hidden there).
function Preferences({ V }) {
  const ts = V.tsChips || [];
  const cur = (ts.find(ch => ch.active) || {}).label;
  return (
    <Panel title="Security and preferences" sub="Saved on this device" pad={0}>
      {!!V.bio && (
        <SettingRow title={'Unlock with ' + V.bio.label} on={V.bioOn} onPress={V.bioToggle} note={V.bioNote}
          sub={V.bioOn ? 'On: asked each time the app opens' : 'Off: click to turn on'} />
      )}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 12, paddingHorizontal: 20, borderTopWidth: 1, borderColor: C.line }}>
        <View style={{ flex: 1 }}>
          <Tx w={600} s={13.5}>Text size</Tx>
          <Tx s={12} c={C.ink3} style={{ marginTop: 2 }}>Applies immediately across the app</Tx>
        </View>
        {ts.length > 0 && (
          <Chips value={cur} options={ts.map(ch => [ch.label, ch.label])}
            onChange={l => { const ch = ts.find(x => x.label === l); if (ch) ch.pick(); }} />
        )}
      </View>
      <SettingRow title="High contrast" sub="Deepens text and borders" on={V.hcOn} onPress={V.hcToggle} />
      <SettingRow title="Reduced motion" sub="Minimises animation throughout" on={V.rmOn} onPress={V.rmToggle} />
    </Panel>
  );
}

function Admin({ V }) {
  return (
    <Panel title="Admin">
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
        <Tx s={13} c={C.ink2} lh={1.55} style={{ flex: 1 }}>
          {V.impersonated ? 'You are signed in as this client through impersonation.' : 'Find a client and view the app as they see it.'}
        </Tx>
        <Btn small kind={V.impersonated ? 'outline' : 'primary'} label={V.impersonated ? 'Exit impersonation' : 'Clients and impersonation'}
          onPress={() => V.openPage('admin')} />
      </View>
    </Panel>
  );
}

function Session({ V }) {
  return (
    <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 16, paddingVertical: 16, paddingHorizontal: 20 }}>
      <View style={{ flex: 1 }}>
        <Tx w={600} s={13.5}>{V.viewing ? 'Viewing an investor account' : 'Session'}</Tx>
        <Tx s={12} c={C.ink3} lh={1.5} style={{ marginTop: 2 }}>myQode · Qode Advisors LLP · SEBI Registered PMS</Tx>
        {V.testMode && (
          <Pressable accessibilityRole="button" onPress={V.reshowUcc} style={{ alignSelf: 'flex-start', marginTop: 6 }}>
            <Tx w={600} s={12} c={C.goldText}>Test: show the UCC pop-up again</Tx>
          </Pressable>
        )}
      </View>
      {/* A partner looking at an investor's account leaves the view instead of signing out (as on the phone). */}
      {V.viewing
        ? <Btn kind="outline" label="Back to distributor panel" onPress={V.exitView} />
        : <Btn kind="danger" label="Sign out" onPress={V.doLogout} style={{ minWidth: 120 }} />}
    </Card>
  );
}

function ListRow({ icon, label, sub, value, onPress, first }) {
  return (
    <Pressable accessibilityRole={onPress ? 'button' : undefined} accessibilityLabel={label} onPress={onPress} disabled={!onPress}
      style={({ hovered }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11, paddingHorizontal: 20,
        borderTopWidth: first ? 0 : 1, borderColor: C.line, backgroundColor: hovered && onPress ? C.hover : 'transparent' })}>
      {({ hovered }) => (
        <>
          {icon}
          <View style={{ flex: 1, minWidth: 0 }}>
            <Tx w={600} s={13.5} numberOfLines={1}>{label}</Tx>
            {!!sub && <Tx s={12} c={C.ink3} numberOfLines={1} style={{ marginTop: 2 }}>{sub}</Tx>}
          </View>
          {!!value && <Tx s={12.5} c={C.ink2} numberOfLines={1}>{value}</Tx>}
          {!!onPress && <ChevronRight c={hovered ? C.green : C.ink3} />}
        </>
      )}
    </Pressable>
  );
}
