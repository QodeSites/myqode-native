// Investor Relations contact, web version. The one place the website shows IR's phone, WhatsApp, email and office,
// all read from content.CONTACT. It sits on "Your Team at Qode"; everywhere else shows ContactIRLink, which opens
// that page. Phone version: src/screens/contact.js (irLinks builds the same links for both).
import { titleCase } from '../titleCase';
import React from 'react';
import { View, Pressable, Linking } from 'react-native';
import { C, Tx, Panel, Btn } from './kit';
import { ChevronRight } from '../icons';
import { CONTACT } from '../content';
import { irLinks } from '../screens/contact';

const open = url => Linking.openURL(url).catch(() => {});

// One contact row: label, then the value on the same line (the mockup's "Call  +91 …  ›").
function Line({ title, sub, onPress }) {
  const body = (
    <>
      <Tx w={600} s={13}>{titleCase(title)}</Tx>
      <Tx s={13} c={onPress ? C.green : C.ink2} style={{ flex: 1, minWidth: 0 }} numberOfLines={onPress ? 1 : undefined} lh={onPress ? undefined : 1.5}>{sub}</Tx>
      {!!onPress && <ChevronRight s={12} c={C.ink3} />}
    </>
  );
  const row = { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44, paddingVertical: 10, paddingHorizontal: 20, borderTopWidth: 1, borderColor: C.line };
  return onPress
    ? <Pressable accessibilityRole="link" accessibilityLabel={title + ', ' + sub} onPress={onPress} style={({ hovered }) => [row, { backgroundColor: hovered ? C.hover : 'transparent' }]}>{body}</Pressable>
    : <View style={row}>{body}</View>;
}

// Two columns (Call and WhatsApp | Email and Office) that stack when the page is narrow.
const col = { flexGrow: 1, flexShrink: 1, flexBasis: 340, minWidth: 0 };

/** Investor Relations: call, WhatsApp, email, office and the investor community. */
export function ContactCard({ code, style }) {
  const L = irLinks(code), K = CONTACT;
  return (
    <Panel title="Investor Relations" sub="Your regular point of contact at Qode" pad={0} style={style}>
      <View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          <View style={col}>
            {!!L.phone && <Line title="Call" sub={L.phone.number} onPress={() => open(L.tel)} />}
            {!!L.wa && <Line title={L.wa.label} sub={L.wa.number + ', ' + L.wa.hours} onPress={() => open(L.whatsapp)} />}
          </View>
          <View style={col}>
            {!!L.mail && <Line title="Email" sub={L.mail.address} onPress={() => open(L.email('Account Query'))} />}
            {K.address.length > 0 && <Line title="Office" sub={K.address.join(', ')} />}
          </View>
        </View>
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
