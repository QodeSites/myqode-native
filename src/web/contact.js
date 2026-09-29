// Investor Relations contact, web version. The one place the website shows IR's phone, WhatsApp, email and office,
// all read from content.CONTACT. It sits on "Your Team at Qode"; everywhere else shows ContactIRLink, which opens
// that page. Phone version: src/screens/contact.js (irLinks builds the same links for both).
import React from 'react';
import { View, Pressable, Linking } from 'react-native';
import { C, Tx, Panel, Btn } from './kit';
import { Phone, MailIcon, ChevronRight } from '../icons';
import { CONTACT } from '../content';
import { irLinks } from '../screens/contact';

const open = url => Linking.openURL(url).catch(() => {});

function Line({ icon, title, sub, onPress, first }) {
  return (
    <Pressable accessibilityRole="link" accessibilityLabel={title + ', ' + sub} onPress={onPress} style={({ hovered }) => ({
      flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 20,
      borderTopWidth: first ? 0 : 1, borderColor: C.line, backgroundColor: hovered ? C.hover : 'transparent',
    })}>
      <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: C.greenTint, alignItems: 'center', justifyContent: 'center' }}>{icon}</View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Tx w={600} s={13}>{title}</Tx>
        <Tx s={13} c={C.green} style={{ marginTop: 1 }} numberOfLines={1}>{sub}</Tx>
      </View>
      <ChevronRight s={12} c={C.ink3} />
    </Pressable>
  );
}

/** Investor Relations: call, WhatsApp, email, office and the investor community. */
export function ContactCard({ code, style }) {
  const L = irLinks(code), K = CONTACT;
  return (
    <Panel title="Investor Relations" sub="Your regular point of contact at Qode" pad={0} style={style}>
      <View style={{ borderTopWidth: 1, borderColor: C.line }}>
        {!!L.phone && <Line first icon={<Phone s={15} />} title="Call" sub={L.phone.number} onPress={() => open(L.tel)} />}
        {!!L.wa && <Line first={!L.phone} icon={<Phone s={15} />} title={L.wa.label} sub={L.wa.number + ', ' + L.wa.hours} onPress={() => open(L.whatsapp)} />}
        {!!L.mail && <Line icon={<MailIcon s={15} />} title="Email" sub={L.mail.address} onPress={() => open(L.email('Account Query'))} />}
        {K.address.length > 0 && (
          <View style={{ paddingVertical: 12, paddingHorizontal: 20, borderTopWidth: 1, borderColor: C.line }}>
            <Tx w={600} s={13}>Office</Tx>
            {K.address.map((t, i) => <Tx key={i} s={13} c={C.ink2} lh={1.55} style={{ marginTop: i ? 0 : 3 }}>{t}</Tx>)}
          </View>
        )}
        {!!K.community && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 20, borderTopWidth: 1, borderColor: C.line, backgroundColor: C.subtle }}>
            <Btn kind="outline" small label={'Join ' + K.community.label} onPress={() => open(K.community.url)} />
            <Tx s={12} c={C.ink3} style={{ flex: 1 }}>{K.community.sub}</Tx>
          </View>
        )}
      </View>
    </Panel>
  );
}

/** Small link to the Investor Relations contact on "Your Team at Qode". */
export function ContactIRLink({ V, label = 'Contact Investor Relations', style }) {
  return (
    <Pressable accessibilityRole="link" onPress={() => V && V.openPage('team')}
      style={({ hovered }) => [{ flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', opacity: hovered ? 0.7 : 1 }, style]}>
      <Tx w={600} s={13} c={C.green}>{label}</Tx>
      <ChevronRight s={11} c={C.green} />
    </Pressable>
  );
}
