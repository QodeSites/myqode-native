// Investor Relations contact, phone version. The one place the app shows IR's phone, WhatsApp, email and office,
// all read from content.CONTACT. It sits on "Your Team at Qode"; every other screen shows ContactIRLink, which
// opens that page. Web version: src/web/contact.js.
import React from 'react';
import { View, Pressable, Linking } from 'react-native';
import { C, Tx, Card } from '../ui';
import { Phone, MailIcon, ChevronRight } from '../icons';
import { CONTACT } from '../content';

const open = url => Linking.openURL(url).catch(() => {});
const digits = n => String(n || '').replace(/[^\d]/g, '');

/** Links built from content.CONTACT. code (optional) prefills the client code in the message. */
export function irLinks(code) {
  const phone = CONTACT.phones[0], mail = CONTACT.emails[0], wa = CONTACT.whatsapp;
  return {
    phone, mail, wa,
    tel: phone ? 'tel:+' + digits(phone.number) : '',
    email: subject => (mail ? 'mailto:' + mail.address + (subject ? '?subject=' + encodeURIComponent(subject + ' - ' + (code || 'Investor')) : '') : ''),
    whatsapp: wa ? 'https://wa.me/' + digits(wa.number) + '?text=' + encodeURIComponent('Hi! I am ' + (code || 'an investor') + ' and would like to discuss my account') : '',
  };
}

function Line({ icon, title, sub, onPress, last }) {
  return (
    <Pressable accessibilityRole="link" accessibilityLabel={title + ', ' + sub} onPress={onPress} style={{
      flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13, minHeight: 48,
      borderBottomWidth: last ? 0 : 1, borderColor: C.hairline,
    }}>
      <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(2,66,43,0.08)', alignItems: 'center', justifyContent: 'center' }}>{icon}</View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Tx w={700} s={12.5}>{title}</Tx>
        <Tx s={12} c={C.green} style={{ marginTop: 1 }}>{sub}</Tx>
      </View>
      <ChevronRight />
    </Pressable>
  );
}

/** Investor Relations: call, WhatsApp, email, office and the investor community. */
export function ContactCard({ code, style }) {
  const L = irLinks(code), K = CONTACT;
  return (
    <Card style={[{ paddingVertical: 6, paddingHorizontal: 16 }, style]}>
      <Tx w={700} s={11} ls={0.12} c={C.muted} style={{ marginTop: 10, marginBottom: 2 }}>INVESTOR RELATIONS</Tx>
      {!!L.phone && <Line icon={<Phone s={15} />} title="Call" sub={L.phone.number} onPress={() => open(L.tel)} />}
      {!!L.wa && <Line icon={<Phone s={15} />} title={L.wa.label} sub={L.wa.number + ', ' + L.wa.hours} onPress={() => open(L.whatsapp)} />}
      {!!L.mail && <Line icon={<MailIcon s={15} />} title="Email" sub={L.mail.address} onPress={() => open(L.email('Account Query'))} />}
      {K.address.length > 0 && (
        <View style={{ paddingVertical: 13, borderBottomWidth: K.community ? 1 : 0, borderColor: C.hairline }}>
          <Tx w={700} s={12.5}>Office</Tx>
          {K.address.map((t, i) => <Tx key={i} s={12} c={C.muted} lh={1.5} style={{ marginTop: i ? 0 : 3 }}>{t}</Tx>)}
        </View>
      )}
      {!!K.community && (
        <Pressable accessibilityRole="link" onPress={() => open(K.community.url)} style={{ marginVertical: 12, backgroundColor: C.gold, borderRadius: 8, paddingVertical: 12, alignItems: 'center' }}>
          <Tx w={700} s={12.5} c={C.ink}>Join {K.community.label}</Tx>
          <Tx s={10.5} c={C.ink} style={{ marginTop: 2, opacity: 0.7 }}>{K.community.sub}</Tx>
        </Pressable>
      )}
    </Card>
  );
}

/** Small link to the Investor Relations contact on "Your Team at Qode". */
export function ContactIRLink({ V, label = 'Contact Investor Relations', style, center }) {
  return (
    <Pressable accessibilityRole="link" onPress={() => V && V.openPage('team')} hitSlop={8}
      style={[{ flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: center ? 'center' : 'flex-start', paddingVertical: 6 }, style]}>
      <Tx w={700} s={12.5} c={C.green}>{label}</Tx>
      <ChevronRight s={11} c={C.green} />
    </Pressable>
  );
}
