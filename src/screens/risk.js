// Risk Management & Controls (phone): the policies from src/content.js RISK, one list, each policy's PDF a button.
// Shared by the investor's page (screens/pages.js) and the partner's (screens/partner.js Policies). Its own file so
// partner.js need not import pages.js (pages → reports → partner → pages was a require cycle, 13 Oct 2026).
import React from 'react';
import { View, Pressable } from 'react-native';
import { C, Tx, Card } from '../ui';
import * as content from '../content';
import { openUrl } from './kit';

const P = ({ children, style }) => <Tx s={13} lh={1.6} c={C.ink} style={[{ marginTop: 10 }, style]}>{children}</Tx>;

export function Risk() {
  const R = content.RISK;
  return (
    <>
      {R.intro.map((t, i) => <P key={i} style={i ? null : { marginTop: 0 }}>{t}</P>)}
      {/* One list, as on the web: each policy a row split by lines, its PDF a link under it */}
      <Card style={{ marginTop: 14, paddingHorizontal: 16 }}>
        {R.policies.map((p, k) => (
          <View key={p.title} style={{ paddingVertical: 15, borderTopWidth: k ? 1 : 0, borderColor: C.hairline }}>
            <Tx w={700} s={14}>{p.title}</Tx>
            {p.body.map((t, i) => <Tx key={i} s={12.5} c={C.muted} lh={1.6} style={{ marginTop: 4 }}>{t}</Tx>)}
            {!!p.pdf && (
              <Pressable onPress={() => openUrl(p.pdf)} accessibilityRole="button" accessibilityLabel={'View the ' + p.title + ' (PDF)'} hitSlop={4}
                style={({ pressed }) => ({ marginTop: 10, alignSelf: 'flex-end', minHeight: 34, paddingVertical: 7, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1, borderColor: C.green,
                  backgroundColor: pressed ? 'rgba(2,66,43,0.08)' : 'transparent' })}>
                <Tx w={700} s={11.5} ls={0.04} c={C.green}>View Policy (PDF)</Tx>
              </Pressable>
            )}
          </View>
        ))}
      </Card>
    </>
  );
}
