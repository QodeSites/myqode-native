// "Your Voice Matters" (phone): the old app's feedback form — four required 1–5 ratings and an optional comment.
// POST engagement.feedback → stored on the server and emailed to Investor Relations only. Rendered as a page body
// (PageHost gives the header and scroll). The form state lives in useVoiceForm, shared with src/web/voice.js.
import React, { useState } from 'react';
import { View, Pressable } from 'react-native';
import { C, Tx, Card, CTA, Field } from '../ui';
import { Check } from '../icons';
import { engagement } from '../api';
import { track } from '../api/track';

import { userMessage } from '../errors';
export const VOICE_QUESTIONS = [
  { k: 'recommend', q: 'How likely are you to recommend Qode?' },
  { k: 'satisfaction', q: 'Overall satisfaction with Qode?' },
  { k: 'clarity', q: 'Clarity and usefulness of portfolio updates and review calls?' },
  { k: 'ease', q: 'Ease of key processes: onboarding, top-ups, withdrawals?' },
];
export const VOICE_HINTS = ['Not likely', 'Very likely'];
export const VOICE_MAX = 2000;

/** Form state and submit for both layouts. `blocked` is a reason the form cannot be sent (partner view, admin view). */
export function useVoiceForm(V) {
  const [r, setR] = useState({});
  const [comment, setComment] = useState('');
  const [errs, setErrs] = useState({});
  const [st, setSt] = useState({ busy: false, err: '', done: false });
  const blocked = V && V.viewing ? 'You are viewing this account as a partner, so feedback cannot be sent from here.'
    : V && V.impersonated ? 'You are viewing this account as an admin. Only the investor can send feedback.' : '';
  const rate = (k, n) => { setR(p => ({ ...p, [k]: n })); if (errs[k]) setErrs(e => ({ ...e, [k]: '' })); };
  const submit = async () => {
    if (st.busy || blocked) return;
    const fe = {};
    VOICE_QUESTIONS.forEach(({ k }) => { if (!r[k]) fe[k] = 'Please choose a rating.'; });
    setErrs(fe);
    if (Object.keys(fe).length) return setSt({ busy: false, err: 'Please rate all four questions.', done: false });
    if (comment.trim().length > VOICE_MAX) return setSt({ busy: false, err: `Please keep your comment under ${VOICE_MAX} characters.`, done: false });
    setSt({ busy: true, err: '', done: false });
    try {
      await engagement.feedback({ ...r, comment: comment.trim() });
      track('event', 'feedback_submitted', { recommend: r && r.recommend });
      setSt({ busy: false, err: '', done: true });
    } catch (e) {
      setSt({ busy: false, err: userMessage(e, 'Could not send your feedback. Please try again.'), done: false });
    }
  };
  const reset = () => { setR({}); setComment(''); setErrs({}); setSt({ busy: false, err: '', done: false }); };
  return { r, rate, comment, setComment: t => setComment(String(t || '').slice(0, VOICE_MAX)), errs, st, submit, reset, blocked };
}

function RatingRow({ q, value, onPick, error, first }) {
  return (
    <View style={{ paddingTop: first ? 0 : 18, marginTop: first ? 0 : 18, borderTopWidth: first ? 0 : 1, borderColor: C.hairline }}>
      <Tx w={700} s={13.5} lh={1.4}>{q}</Tx>
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }} accessibilityRole="radiogroup" accessibilityLabel={q}>
        {[1, 2, 3, 4, 5].map(n => {
          const on = value === n;
          return (
            <Pressable key={n} onPress={() => onPick(n)} accessibilityRole="radio" accessibilityState={{ selected: on }} accessibilityLabel={`${n} of 5`}
              style={({ pressed }) => ({
                flex: 1, height: 44, borderRadius: 8, alignItems: 'center', justifyContent: 'center', borderWidth: 1,
                borderColor: on ? C.green : error ? C.red : C.mutedBorder35, backgroundColor: on ? C.green : 'transparent',
                transform: [{ scale: pressed ? 0.96 : 1 }],
              })}>
              <Tx w={700} s={15} c={on ? C.gold : C.muted}>{n}</Tx>
            </Pressable>
          );
        })}
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
        <Tx s={10.5} c={C.gray}>{VOICE_HINTS[0]}</Tx>
        <Tx s={10.5} c={C.gray}>{VOICE_HINTS[1]}</Tx>
      </View>
      {!!error && <Tx s={11} c={C.red} style={{ marginTop: 4 }}>{error}</Tx>}
    </View>
  );
}

export function VoicePage({ V }) {
  const f = useVoiceForm(V);
  if (f.st.done) {
    return (
      <Card style={{ padding: 24, alignItems: 'center' }}>
        <View style={{ width: 56, height: 56, borderRadius: 28, borderWidth: 1.5, borderColor: C.green, alignItems: 'center', justifyContent: 'center' }}>
          <Check s={24} w={2.4} />
        </View>
        <Tx f="play" w={600} s={20} center style={{ marginTop: 16 }}>Thank you</Tx>
        <Tx s={12.5} c={C.muted} lh={1.6} center style={{ marginTop: 8 }}>
          Your feedback has reached our Investor Relations team. We read every response and use it to improve how we serve you.
        </Tx>
        <CTA label="DONE" onPress={V && V.closePage} style={{ marginTop: 22, alignSelf: 'stretch' }} />
      </Card>
    );
  }
  return (
    <View>
      <Tx s={13} c={C.muted} lh={1.6}>Your feedback helps us serve you better. It takes under a minute: rate each question from 1 to 5, and tell us anything we could do better.</Tx>
      <Card style={{ padding: 16, marginTop: 16 }}>
        {VOICE_QUESTIONS.map(({ k, q }, i) => (
          <RatingRow key={k} q={q} value={f.r[k]} onPick={n => f.rate(k, n)} error={f.errs[k]} first={i === 0} />
        ))}
      </Card>
      <Card style={{ padding: 16, marginTop: 14 }}>
        <Field label="WHAT COULD WE DO BETTER? (OPTIONAL)" value={f.comment} onChangeText={f.setComment} multiline maxLength={VOICE_MAX}
          placeholder="One thing we could do to improve your experience"
          hint={f.comment.length ? `${f.comment.length} / ${VOICE_MAX}` : undefined} />
      </Card>
      {!!f.blocked && <Tx s={12} c={C.muted} lh={1.5} style={{ marginTop: 14 }}>{f.blocked}</Tx>}
      {!!f.st.err && <Tx s={12} c={C.red} lh={1.45} style={{ marginTop: 14 }}>{f.st.err}</Tx>}
      <CTA label={f.st.busy ? 'PLEASE WAIT…' : 'SUBMIT FEEDBACK'} onPress={f.submit}
        style={{ marginTop: 20, opacity: f.st.busy || f.blocked ? 0.5 : 1 }} />
    </View>
  );
}
