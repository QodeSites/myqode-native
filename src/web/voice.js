// "Your Voice Matters" (desktop web): the same feedback form as the phone (src/screens/voice.js, whose useVoiceForm
// holds the state and the engagement.feedback call), laid out as a centred ~720 px card in the web kit.
import React from 'react';
import { View, Pressable } from 'react-native';
import { C, Tx, Panel, Btn, Input } from './kit';
import { Check } from '../icons';
import { useVoiceForm, VOICE_QUESTIONS, VOICE_HINTS, VOICE_MAX } from '../screens/voice';

function Rating({ q, value, onPick, error, first }) {
  return (
    <View style={{ paddingVertical: 18, borderTopWidth: first ? 0 : 1, borderColor: C.line }}>
      <Tx w={600} s={14} c={C.ink}>{q}</Tx>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 12 }}>
        <Tx s={12} c={C.ink3} style={{ width: 70 }}>{VOICE_HINTS[0]}</Tx>
        <View style={{ flex: 1, flexDirection: 'row', gap: 8 }} accessibilityRole="radiogroup" accessibilityLabel={q}>
          {[1, 2, 3, 4, 5].map(n => {
            const on = value === n;
            return (
              <Pressable key={n} onPress={() => onPick(n)} accessibilityRole="radio" accessibilityState={{ selected: on }} accessibilityLabel={`${n} of 5`}
                style={({ hovered }) => ({
                  flex: 1, height: 40, borderRadius: 8, borderWidth: 1, alignItems: 'center', justifyContent: 'center', outlineStyle: 'none',
                  borderColor: on ? C.green : error ? C.red : C.line2,
                  backgroundColor: on ? C.green : hovered ? C.hover : C.card,
                })}>
                <Tx w={600} s={14} c={on ? C.gold : C.ink2}>{n}</Tx>
              </Pressable>
            );
          })}
        </View>
        <Tx s={12} c={C.ink3} right style={{ width: 70 }}>{VOICE_HINTS[1]}</Tx>
      </View>
      {!!error && <Tx s={12} c={C.red} style={{ marginTop: 6 }}>{error}</Tx>}
    </View>
  );
}

export function DesktopVoice({ V }) {
  const f = useVoiceForm(V);
  const wrap = { width: '100%' };   // full width of the page, like the other pages
  if (f.st.done) {
    return (
      <Panel style={wrap} pad={36}>
        <View style={{ alignItems: 'center' }}>
          <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: C.greenTint, alignItems: 'center', justifyContent: 'center' }}>
            <Check s={24} w={2.4} />
          </View>
          <Tx f="play" w={600} s={24} c={C.green} center style={{ marginTop: 16 }}>Thank you for your feedback</Tx>
          <Tx s={14} c={C.ink2} lh={1.6} center style={{ marginTop: 8, maxWidth: 480 }}>
            It has reached our Investor Relations team. We read every response and use it to improve how we serve you.
          </Tx>
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 24 }}>
            {!!(V && V.closePage) && <Btn label="Done" onPress={V.closePage} />}
            <Btn label="Send another response" kind="outline" onPress={f.reset} />
          </View>
        </View>
      </Panel>
    );
  }
  return (
    <Panel style={wrap} title="Your voice matters" sub="Rate each question from 1 to 5. It takes under a minute."
      footer={
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
          <Tx s={12.5} c={f.st.err ? C.red : C.ink3} style={{ flex: 1 }}>{f.st.err || f.blocked || 'Sent to Investor Relations only.'}</Tx>
          <Btn label="Submit feedback" onPress={f.submit} busy={f.st.busy} disabled={!!f.blocked} />
        </View>
      }>
      {VOICE_QUESTIONS.map(({ k, q }, i) => (
        <Rating key={k} q={q} value={f.r[k]} onPick={n => f.rate(k, n)} error={f.errs[k]} first={i === 0} />
      ))}
      <View style={{ borderTopWidth: 1, borderColor: C.line, paddingTop: 18 }}>
        <Input label="What could we do better? (optional)" value={f.comment} onChangeText={f.setComment} multiline
          placeholder="One thing we could do to improve your experience"
          hint={f.comment.length ? `${f.comment.length} / ${VOICE_MAX}` : undefined} />
      </View>
    </Panel>
  );
}
