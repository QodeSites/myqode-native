// Onboarding journey: details → account type → identity (DigiLocker + bank
// verification in-app) → risk questions → result → fee → financial profile →
// nominees → documents → review → tracker. Every step autosaves to the
// onboarding backend; the V object (main.js obVals) carries state + handlers.
import React, { useState } from 'react';
import { View, Pressable, ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  C, Tx, Amt, Card, CTA, ChipRow, CurveCap, Field,
  Radio, Rise, Hairline, GoldThreads, Sheet, useUI,
} from '../ui';
import { ChevronLeft, Check, SmallCheck, Copy } from '../icons';
import { ARTICLES } from '../data';
import VerifySheet from './verify';

const Sub = ({ children, style }) => <Tx w={700} s={10} ls={0.12} c={C.gray} style={style}>{children}</Tx>;

function Pill({ label, tone = 'gold' }) {
  const bg = tone === 'gold' ? C.gold : tone === 'red' ? 'rgba(239,68,68,0.12)' : 'rgba(55,88,79,0.12)';
  const fg = tone === 'gold' ? C.ink : tone === 'red' ? C.red : C.muted;
  return (
    <View style={{ backgroundColor: bg, borderRadius: 999, paddingVertical: 3, paddingHorizontal: 9, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      {tone === 'gold' && <Check s={9} c={C.ink} w={3} />}
      <Tx w={700} s={8.5} ls={0.12} c={fg}>{label}</Tx>
    </View>
  );
}

function RadioCard({ item, children }) {
  return (
    <Pressable onPress={item.pick}>
      <Card style={{ padding: 16, borderLeftWidth: 2, borderLeftColor: item.active ? C.gold : 'transparent' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ flex: 1 }}>
            <Tx w={700} s={14}>{item.name}</Tx>
            <Tx s={11.5} c={C.muted} lh={1.5} style={{ marginTop: 3 }}>{item.sub}</Tx>
          </View>
          <Radio active={item.active} />
        </View>
        {children}
      </Card>
    </Pressable>
  );
}

function Dashed({ label, onPress }) {
  return (
    <Pressable onPress={onPress} style={{
      marginTop: 14, borderWidth: 1.5, borderStyle: 'dashed', borderColor: 'rgba(55,88,79,0.4)',
      borderRadius: 8, padding: 14, alignItems: 'center',
    }}>
      <Tx w={700} s={12} c={C.muted}>{label}</Tx>
    </Pressable>
  );
}

function Note({ children, tone = 'green', style }) {
  const bg = tone === 'gold' ? 'rgba(218,189,56,0.28)' : tone === 'red' ? 'rgba(239,68,68,0.08)' : 'rgba(2,66,43,0.06)';
  const border = tone === 'gold' ? 'rgba(218,189,56,0.6)' : tone === 'red' ? 'rgba(239,68,68,0.3)' : 'rgba(2,66,43,0.15)';
  return (
    <View style={[{ backgroundColor: bg, borderWidth: 1, borderColor: border, borderRadius: 10, paddingVertical: 12, paddingHorizontal: 14 }, style]}>
      {children}
    </View>
  );
}

// A Digio-verified value: label, value, gold VERIFIED badge.
function VerifiedRow({ k, v, last }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12, paddingVertical: 10, borderBottomWidth: last ? 0 : 1, borderColor: C.hairline }}>
      <View style={{ flex: 1 }}>
        <Sub>{k}</Sub>
        <Tx s={14.5} style={{ marginTop: 4 }}>{v}</Tx>
      </View>
      <Pill label="VERIFIED" />
    </View>
  );
}

// One verification (identity or bank) for one holder, with every state it can be in.
function VerifyBlock({ kind, title, desc, btn, check, onPress, onSkip, bank }) {
  const tone = check.tone === 'gold' ? 'gold' : check.tone === 'red' ? 'red' : 'muted';
  return (
    <View style={{ marginTop: 18, borderWidth: 1, borderColor: 'rgba(2,66,43,0.3)', borderRadius: 12, paddingVertical: 14, paddingHorizontal: 16, backgroundColor: 'rgba(2,66,43,0.04)' }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
        <View style={{ flex: 1 }}>
          <Sub>{kind}</Sub>
          <Tx s={13} style={{ marginTop: 4 }}>{title}</Tx>
        </View>
        <Pill label={check.status} tone={tone} />
      </View>
      {check.done && bank && (
        <View style={{ marginTop: 10 }}>
          {[['Bank', bank.bankName || 'Bank'], ['Account', bank.masked + (bank.ifsc ? ' · ' + bank.ifsc : '')], ['Name on account', bank.beneficiary || '—']].map(([k, v], i) => (
            <View key={k} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: i < 2 ? 1 : 0, borderColor: C.hairline }}>
              <Tx s={12} c={C.muted}>{k}</Tx>
              {k === 'Account' ? <Amt s={12}>{v}</Amt> : <Tx w={700} s={12}>{v}</Tx>}
            </View>
          ))}
          <Tx s={11} c={C.muted} lh={1.5} style={{ marginTop: 8 }}>₹1 was deposited to this account. No cancelled cheque needed.</Tx>
        </View>
      )}
      {check.done && !bank && (
        <Tx s={11.5} c={C.muted} lh={1.5} style={{ marginTop: 8 }}>Your details were filled in from DigiLocker and are locked above.</Tx>
      )}
      {!check.done && (
        <>
          {check.error ? <Tx s={11.5} c={C.red} lh={1.5} style={{ marginTop: 10 }}>{check.error}</Tx> : null}
          {check.active && !check.error ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 }}>
              <ActivityIndicator size="small" color={C.gold} />
              <Tx s={11.5} c={C.muted} style={{ flex: 1 }}>Checking in the background. Reopen to finish the steps.</Tx>
            </View>
          ) : null}
          <CTA label={check.active ? 'REOPEN VERIFICATION' : check.error ? 'TRY AGAIN' : btn} onPress={onPress} style={{ marginTop: 12, paddingVertical: 12 }} />
          {desc ? <Tx s={11} c={C.muted} lh={1.5} style={{ marginTop: 8 }}>{desc}</Tx> : null}
          {check.manual ? (
            <Tx s={11} c={C.muted} lh={1.5} style={{ marginTop: 6 }}>You chose to fill this in yourself. You can still verify online any time.</Tx>
          ) : (
            <Pressable onPress={onSkip} style={{ paddingVertical: 8 }}>
              <Tx w={700} s={11} c={C.green}>Skip and fill in the details myself →</Tx>
            </Pressable>
          )}
        </>
      )}
    </View>
  );
}

const CAM = ({ c = C.green }) => <Tx s={13} c={c}>📷</Tx>;

function Pickers({ r }) {
  return (
    <View>
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
        {[['Camera', r.pickCamera], ['Photos', r.pickPhotos], ['PDF file', r.pickFile]].map(([t, fn]) => (
          <Pressable key={t} onPress={fn} style={{ flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(2,66,43,0.3)', borderRadius: 10 }}>
            <Tx w={700} s={11} c={C.green}>{t}</Tx>
          </Pressable>
        ))}
      </View>
      <Tx s={10.5} c={C.gray} style={{ marginTop: 8 }}>PDF, PNG, JPG or WebP up to 10 MB.</Tx>
    </View>
  );
}

function DocRow({ r, last }) {
  const [replacing, setReplacing] = useState(false);
  const done = r.state === 'fetched' || r.state === 'uploaded';
  const sub = r.uploading ? 'Uploading…'
    : r.state === 'fetched' ? 'Fetched from DigiLocker'
    : r.state === 'waived' ? 'Bank verified by ₹1 deposit · not needed'
    : r.state === 'uploaded' ? [r.fileName, r.sizeText, 'uploaded by you'].filter(Boolean).join(' · ')
    : r.required ? 'Required · upload a clear image or PDF' : 'Optional';
  return (
    <View style={{ paddingVertical: 14, borderBottomWidth: last ? 0 : 1, borderColor: C.hairline }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ flex: 1 }}>
          <Tx w={700} s={13}>{r.label}</Tx>
          <Tx s={11} c={r.err ? C.red : C.muted} style={{ marginTop: 3 }}>{r.err || sub}</Tx>
        </View>
        {r.uploading && <ActivityIndicator size="small" color={C.green} />}
        {!r.uploading && r.state === 'waived' && <Pill label="WAIVED" />}
        {!r.uploading && done && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            {r.state === 'uploaded' && (
              <Pressable onPress={() => setReplacing(x => !x)} hitSlop={8}>
                <Tx w={700} s={11} c={C.green}>{replacing ? 'Cancel' : 'Replace'}</Tx>
              </Pressable>
            )}
            <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: C.green, alignItems: 'center', justifyContent: 'center' }}>
              <Check s={12} c={C.gold} w={2.4} />
            </View>
          </View>
        )}
      </View>
      {!r.uploading && (r.state === 'pending' || replacing) && <Pickers r={r} />}
    </View>
  );
}

function Track({ tk }) {
  return (
    <View style={{ flexDirection: 'row', gap: 14, paddingLeft: 2 }}>
      <View style={{ alignItems: 'center' }}>
        {tk.done && (
          <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: C.green, alignItems: 'center', justifyContent: 'center' }}>
            <Check s={11} c={C.gold} w={2.4} />
          </View>
        )}
        {tk.active && (
          <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: C.gold, alignItems: 'center', justifyContent: 'center' }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: C.gold }} />
          </View>
        )}
        {tk.pending && <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: 'rgba(55,88,79,0.3)' }} />}
        {tk.notLast && <View style={{ width: 2, flex: 1, minHeight: 26, backgroundColor: tk.railColor }} />}
      </View>
      <View style={{ paddingBottom: 18, flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <Tx w={700} s={13} c={tk.titleColor}>{tk.title}</Tx>
          {tk.active && (
            <View style={{ backgroundColor: C.gold, borderRadius: 999, paddingVertical: 3, paddingHorizontal: 9 }}>
              <Tx w={700} s={8.5} ls={0.12} c={C.ink}>IN PROGRESS</Tx>
            </View>
          )}
        </View>
        <Tx s={11} c={C.muted} style={{ marginTop: 3 }}>{tk.sub}</Tx>
      </View>
    </View>
  );
}

// Shown while a resume link or the saved draft is being opened.
export function ResumeScreen({ V }) {
  const insets = useSafeAreaInsets();
  const notFound = V.resumeErrorCode === 'not_found';
  return (
    <View style={{ flex: 1, backgroundColor: C.cream }}>
      <LinearGradient colors={C.darkGrad} locations={[0, 0.62, 1]} start={{ x: 0.1, y: 0 }} end={{ x: 0.6, y: 1 }}
        style={{ paddingTop: insets.top + 24, paddingHorizontal: 22, paddingBottom: 78, minHeight: 220 }}>
        <GoldThreads height={220} />
        <Tx f="play" w={600} s={26} c={C.cream} lh={1.25} style={{ marginTop: 20 }}>{V.resumeLoading ? 'Opening your application' : 'We hit a snag'}</Tx>
        <Tx w={700} s={10} ls={0.22} c={C.gold} style={{ marginTop: 12 }}>WELCOME BACK</Tx>
      </LinearGradient>
      <View style={{ marginTop: -42 }}><CurveCap height={42} /></View>
      <View style={{ paddingHorizontal: 22, flex: 1 }}>
        <Rise>
          <Card big style={{ marginTop: -28, paddingVertical: 24, paddingHorizontal: 22, alignItems: 'center' }}>
            {V.resumeLoading ? (
              <>
                <ActivityIndicator color={C.green} />
                <Tx s={12.5} c={C.muted} lh={1.55} center style={{ marginTop: 14 }}>Fetching everything you saved so you can pick up where you left off.</Tx>
              </>
            ) : (
              <>
                <Tx s={12.5} c={C.muted} lh={1.55} center>{V.resumeError}</Tx>
                {!notFound && <CTA label="TRY AGAIN" onPress={V.resumeRetry} style={{ marginTop: 18, alignSelf: 'stretch' }} />}
                <CTA label="START A NEW APPLICATION" onPress={V.resumeStartNew} outline style={{ marginTop: 10, alignSelf: 'stretch' }} />
                <Pressable onPress={V.resumeToLogin} style={{ marginTop: 14, padding: 8 }}>
                  <Tx s={12} c={C.muted} center>Back to sign in</Tx>
                </Pressable>
              </>
            )}
          </Card>
        </Rise>
      </View>
    </View>
  );
}

export default function Onboarding({ V }) {
  const insets = useSafeAreaInsets();
  const { z } = useUI();
  return (
    <View style={{ flex: 1, backgroundColor: C.cream }}>
      <KeyboardScroll style={{ flex: 1 }} contentContainerStyle={{ flexGrow: 1 }}>
        {/* dark anchor */}
        <LinearGradient colors={C.darkGrad} locations={[0, 0.62, 1]} start={{ x: 0.1, y: 0 }} end={{ x: 0.6, y: 1 }}
          style={{ paddingTop: insets.top + 10, paddingHorizontal: 22, paddingBottom: 78, minHeight: V.obTall ? 260 : 190 }}>
          <GoldThreads height={220} />
          <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: 32 }}>
            {V.obShowBack && (
              <Pressable onPress={V.obBack} style={{ width: 44, height: 44, marginLeft: -12, alignItems: 'center', justifyContent: 'center' }}>
                <ChevronLeft s={20} c={C.cream} />
              </Pressable>
            )}
            <View style={{ flex: 1 }} />
            {!!V.obSaveLabel && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginRight: 14 }}>
                {V.obSaveLabel === 'SAVED' && <Check s={10} c={C.cream60} w={2.5} />}
                <Tx w={700} s={9.5} ls={0.1} c={V.obSaveLabel.startsWith('SAVE FAILED') ? C.gold : C.cream60}>{V.obSaveLabel}</Tx>
              </View>
            )}
            {!V.obLocked && (
              <Pressable onPress={V.obSaveExit} style={{ paddingVertical: 12, paddingLeft: 4 }}>
                <Tx w={700} s={11} ls={0.1} c={C.cream60}>SAVE & EXIT</Tx>
              </Pressable>
            )}
            {V.obLocked && (
              <Pressable onPress={V.obExitToLogin} style={{ paddingVertical: 12, paddingLeft: 4 }}>
                <Tx w={700} s={11} ls={0.1} c={C.cream60}>DONE</Tx>
              </Pressable>
            )}
          </View>
          <View style={{ marginTop: 14 }}>
            <Tx f="play" w={600} s={V.obTitleSize} c={C.cream} lh={1.25}>{V.obTitle}</Tx>
            <Tx w={700} s={10} ls={0.22} c={C.gold} style={{ marginTop: 12 }}>{V.obStepLabel}</Tx>
          </View>
        </LinearGradient>

        <View style={{ marginTop: -42 }}>
          <CurveCap height={42} progress={V.obProg} />
        </View>
        <View style={{ backgroundColor: C.cream, paddingHorizontal: 22, paddingBottom: 44, minHeight: 400, flexGrow: 1 }}>

          {V.obOffline && (
            <Note tone="gold" style={{ marginTop: -28, marginBottom: 14, zIndex: 2 }}>
              <Tx w={700} s={11} ls={0.1} c={C.ink}>YOU’RE OFFLINE</Tx>
              <Tx s={11.5} c={C.muted} lh={1.5} style={{ marginTop: 3 }}>{V.obOfflineMsg}</Tx>
            </Note>
          )}
          {!!V.obCreateError && !V.obOffline && (
            <Pressable onPress={V.obRetrySave}>
              <Note tone="red" style={{ marginTop: V.obOffline ? 0 : -28, marginBottom: 14, zIndex: 2 }}>
                <Tx w={700} s={11} ls={0.1} c={C.red}>NOT SAVED YET</Tx>
                <Tx s={11.5} c={C.muted} lh={1.5} style={{ marginTop: 3 }}>{V.obCreateError} Keep going — we retry automatically, or tap to retry now.</Tx>
              </Note>
            </Pressable>
          )}

          {V.obBegin && (
            <Rise>
              <Card big style={{ marginTop: V.obOffline ? 0 : -28, paddingVertical: 22, paddingHorizontal: 20 }}>
                <Field label="FULL NAME" value={V.obName} onChangeText={V.onObName} placeholder="As it appears on your PAN" autoCapitalize="words" />
                <Field label="EMAIL" value={V.obEmail} onChangeText={V.onObEmail} placeholder="you@example.com" autoCapitalize="none" keyboardType="email-address" style={{ marginTop: 18 }} />
                <Field label="MOBILE" value={V.obMobile} onChangeText={V.onObMobile} placeholder="10-digit mobile" numeric prefix="+91" style={{ marginTop: 18 }} />
                {V.obHasErr && <Tx s={12} c={C.red} style={{ marginTop: 12 }}>{V.obErr}</Tx>}
                <CTA label="CONTINUE" onPress={V.obBeginNext} style={{ marginTop: 22 }} />
              </Card>
              <Tx s={12} c={C.muted} center style={{ marginTop: 16 }}>Takes about 15 minutes. Your progress is saved as you go — pick it up on any device.</Tx>
            </Rise>
          )}

          {V.obType && (
            <Rise>
              <View style={{ gap: 12, marginTop: -28 }}>
                {V.obTypes.map((ty, i) => (
                  <RadioCard key={i} item={ty}>
                    {ty.showRes && <ChipRow chips={V.obResChips} style={{ marginTop: 12 }} py={7} px={13} />}
                    {ty.showEntity && <ChipRow chips={V.obEntityChips} style={{ marginTop: 12 }} py={7} px={13} />}
                  </RadioCard>
                ))}
              </View>
              <Note style={{ marginTop: 14 }}>
                <Tx s={12} c={C.muted} lh={1.55}>{V.obTypeNote}</Tx>
              </Note>
              <CTA label="CONTINUE" onPress={V.obTypeNext} style={{ marginTop: 18 }} />
            </Rise>
          )}

          {V.obIdentity && (
            <Rise>
              {!!V.obDigioOffMsg && (
                <Note tone="gold" style={{ marginTop: -28, marginBottom: 14 }}>
                  <Tx s={12} c={C.ink} lh={1.55}>{V.obDigioOffMsg}</Tx>
                </Note>
              )}
              <Card big style={{ marginTop: V.obDigioOffMsg ? 0 : -28, padding: 20 }}>
                {V.obIsIndividual && (
                  <>
                    <Sub>RESIDENCY</Sub>
                    <ChipRow chips={V.obResidency} flex round={false} py={10} s={11.5} style={{ marginTop: 10 }} />
                    <Hairline style={{ marginVertical: 18 }} />
                  </>
                )}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Tx w={700} s={11} ls={0.14} c={C.muted}>{V.obIsIndividual ? 'HOLDER 1' : 'PRIMARY CONTACT'}</Tx>
                  {V.obVerified && <Pill label="FETCHED FROM DIGILOCKER" />}
                </View>
                {V.obVerified ? (
                  <View style={{ marginTop: 6 }}>
                    {V.obVerifiedRows.map((r, i) => <VerifiedRow key={r[0]} k={r[0]} v={r[1]} last={i === V.obVerifiedRows.length - 1} />)}
                    <Tx s={11} c={C.muted} lh={1.5} style={{ marginTop: 10 }}>
                      Verified fields can’t be edited here.{V.obFaceMatch ? ' Face match ' + V.obFaceMatch + '.' : ''}
                    </Tx>
                  </View>
                ) : (
                  <>
                    <Field label="NAME AS PER PAN" value={V.obName} onChangeText={V.onObName} autoCapitalize="words" style={{ marginTop: 14 }} />
                    {V.obIsIndividual && (
                      <>
                        <View style={{ flexDirection: 'row', gap: 14, marginTop: 16 }}>
                          <Field label="PAN" value={V.obPan} onChangeText={V.onObPan} placeholder="ABCDE1234F" autoCapitalize="characters" s={14} style={{ flex: 1 }} />
                          <Field label="DATE OF BIRTH" value={V.obDob} onChangeText={V.onObDob} placeholder="DD / MM / YYYY" numeric s={14} style={{ flex: 1 }} />
                        </View>
                        <Sub style={{ marginTop: 16 }}>GENDER</Sub>
                        <ChipRow chips={V.obGender} style={{ marginTop: 8 }} />
                        <Field label="ADDRESS AS PER PROOF" value={V.obAddr} onChangeText={V.onObAddr} placeholder="Flat, street, city, PIN" s={14} multiline style={{ marginTop: 16 }} />
                      </>
                    )}
                  </>
                )}
                <Sub style={{ marginTop: 16 }}>MARITAL STATUS</Sub>
                <ChipRow chips={V.obMarital} style={{ marginTop: 8 }} />
                <View style={{ flexDirection: 'row', gap: 14, marginTop: 16 }}>
                  <Field label="MOBILE" value={V.obMobile} onChangeText={V.onObMobile} numeric s={14} style={{ flex: 1 }} />
                  <View style={{ flex: 1 }}>
                    <Sub>BELONGS TO</Sub>
                    <ChipRow chips={V.obMobBelongs} py={7} s={10.5} style={{ marginTop: 8 }} />
                  </View>
                </View>
                <View style={{ flexDirection: 'row', gap: 14, marginTop: 16 }}>
                  <Field label="EMAIL" value={V.obEmail} onChangeText={V.onObEmail} autoCapitalize="none" keyboardType="email-address" s={14} style={{ flex: 1 }} />
                  <View style={{ flex: 1 }}>
                    <Sub>BELONGS TO</Sub>
                    <ChipRow chips={V.obEmailBelongs} py={7} s={10.5} style={{ marginTop: 8 }} />
                  </View>
                </View>
                {V.obDigioOn && (
                  <>
                    <VerifyBlock kind="IDENTITY" title="Fetch PAN and Aadhaar from DigiLocker" btn="VERIFY WITH DIGILOCKER" check={V.obIdCheck}
                      onPress={V.obStartIdentity} onSkip={() => V.obSkipVerify('primary', 'identity')}
                      desc="Takes about two minutes. Keep your Aadhaar-linked mobile handy for the OTP. Your name, date of birth, address and PAN fill in automatically." />
                    <VerifyBlock kind="BANK ACCOUNT" title="Confirm your bank with a ₹1 penny drop" btn="VERIFY BANK ACCOUNT" check={V.obBankCheck} bank={V.obBank}
                      onPress={V.obStartBank} onSkip={() => V.obSkipVerify('primary', 'bank')}
                      desc="We deposit ₹1 to confirm the account is yours. If it matches, you won’t need to upload a cancelled cheque." />
                  </>
                )}
              </Card>
              {V.obNoH2 && <Dashed label="+ Add second holder" onPress={V.obAddH2} />}
              {V.obH2 && (
                <Card style={{ paddingVertical: 18, paddingHorizontal: 20, marginTop: 14 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <Tx w={700} s={11} ls={0.14} c={C.muted}>HOLDER 2</Tx>
                    <Pressable onPress={V.obRemoveH2}><Tx w={700} s={11} c={C.red}>Remove</Tx></Pressable>
                  </View>
                  {V.obH2Verified ? (
                    <View style={{ marginTop: 6 }}>
                      <VerifiedRow k="NAME AS PER PAN" v={V.obH2Verified.fullName} />
                      <VerifiedRow k="PAN" v={V.obH2Verified.pan} last />
                    </View>
                  ) : (
                    <>
                      <Field label="NAME AS PER PAN" value={V.obH2Name} onChangeText={V.onObH2Name} placeholder="Second holder's name" autoCapitalize="words" style={{ marginTop: 14 }} />
                      <View style={{ flexDirection: 'row', gap: 14, marginTop: 16 }}>
                        <Field label="PAN" value={V.obH2Pan} onChangeText={V.onObH2Pan} placeholder="ABCDE1234F" autoCapitalize="characters" s={14} style={{ flex: 1 }} />
                        <Field label="DATE OF BIRTH" value={V.obH2Dob} onChangeText={V.onObH2Dob} placeholder="DD / MM / YYYY" numeric s={14} style={{ flex: 1 }} />
                      </View>
                    </>
                  )}
                  <View style={{ flexDirection: 'row', gap: 14, marginTop: 16 }}>
                    <Field label="MOBILE" value={V.obH2Mobile} onChangeText={V.onObH2Mobile} numeric s={14} style={{ flex: 1 }} />
                    <Field label="EMAIL" value={V.obH2Email} onChangeText={V.onObH2Email} autoCapitalize="none" keyboardType="email-address" s={14} style={{ flex: 1 }} />
                  </View>
                  <Sub style={{ marginTop: 16 }}>MODE OF OPERATION</Sub>
                  <ChipRow chips={V.obMode} flex round={false} py={9} style={{ marginTop: 8 }} />
                  {V.obDigioOn && (
                    <VerifyBlock kind="IDENTITY · HOLDER 2" title="Fetch PAN and Aadhaar from DigiLocker" btn="VERIFY HOLDER 2" check={V.obH2Check}
                      onPress={V.obStartH2Identity} onSkip={() => V.obSkipVerify('second', 'identity')} desc="The second holder completes this on their own Aadhaar-linked mobile." />
                  )}
                </Card>
              )}
              {V.obHasErr && <Tx s={12} c={C.red} lh={1.5} style={{ marginTop: 14 }}>{V.obErr}</Tx>}
              <CTA label="CONTINUE" onPress={V.obIdentityNext} style={{ marginTop: 18 }} />
            </Rise>
          )}

          {/* FINANCIAL PROFILE */}
          {V.obFin && (
            <Rise>
              <Card big style={{ marginTop: -28, padding: 20 }}>
                <View style={{ borderLeftWidth: 2, borderLeftColor: C.gold, paddingLeft: 10 }}>
                  <Tx s={12} c={C.muted} lh={1.55}>SEBI requires us to ask these questions before opening a PMS account.</Tx>
                </View>
                <Sub style={{ marginTop: 18 }}>OCCUPATION</Sub>
                <ChipRow chips={V.obOcc} style={{ marginTop: 8 }} />
                <Sub style={{ marginTop: 16 }}>SOURCE OF FUNDS</Sub>
                <ChipRow chips={V.obSrc} style={{ marginTop: 8 }} />
                <Sub style={{ marginTop: 16 }}>ANNUAL INCOME</Sub>
                <ChipRow chips={V.obIncome} style={{ marginTop: 8 }} />
                <Sub style={{ marginTop: 16 }}>EDUCATION</Sub>
                <ChipRow chips={V.obEdu} style={{ marginTop: 8 }} />
                <Sub style={{ marginTop: 16 }}>POLITICALLY EXPOSED PERSON (PEP)</Sub>
                <ChipRow chips={V.obPep} px={16} style={{ marginTop: 8 }} />
                <Tx s={11} c={C.gray} lh={1.5} style={{ marginTop: 10 }}>
                  A PEP is someone entrusted with a prominent public function, or their family member or close associate.
                </Tx>
              </Card>
              <CTA label="CONTINUE" onPress={V.obFinNext} style={{ marginTop: 18 }} />
            </Rise>
          )}

          {V.obNoms && (
            <Rise>
              <View style={{ gap: 12, marginTop: -28 }}>
                {V.obNomList.map((nm, i) => (
                  <Card key={i} style={{ paddingVertical: 18, paddingHorizontal: 20 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
                      <Tx w={700} s={11} ls={0.14} c={C.muted}>NOMINEE {nm.n}</Tx>
                      <Pressable onPress={nm.remove}><Tx w={700} s={11} c={C.red}>Remove</Tx></Pressable>
                    </View>
                    <Field label="FULL NAME" value={nm.name} onChangeText={nm.onName} autoCapitalize="words" s={14} style={{ marginTop: 14 }} />
                    <View style={{ flexDirection: 'row', gap: 14, marginTop: 14 }}>
                      <Field label="RELATIONSHIP" value={nm.rel} onChangeText={nm.onRel} placeholder="e.g. Spouse" autoCapitalize="words" s={14} style={{ flex: 1 }} />
                      <Field label="SHARE %" value={nm.alloc} onChangeText={nm.onAlloc} numeric s={14} style={{ width: 92 }} />
                    </View>
                    <Field label="MOBILE" value={nm.mob} onChangeText={nm.onMob} numeric s={14} style={{ marginTop: 14 }} />
                    <Pressable onPress={nm.toggleMinor} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14, minHeight: 32 }}>
                      <View style={{
                        width: 16, height: 16, borderRadius: 4, borderWidth: 1.5,
                        borderColor: nm.isMinor ? C.green : 'rgba(55,88,79,0.4)',
                        backgroundColor: nm.isMinor ? C.green : 'transparent',
                        alignItems: 'center', justifyContent: 'center',
                      }}>
                        <SmallCheck on={nm.isMinor} />
                      </View>
                      <Tx s={12.5} c={C.muted}>Nominee is a minor</Tx>
                    </Pressable>
                    {nm.isMinor && (
                      <Field label="GUARDIAN NAME" value={nm.guardian} onChangeText={nm.onGuardian} autoCapitalize="words" s={14} style={{ marginTop: 10 }} />
                    )}
                  </Card>
                ))}
              </View>
              {V.obCanAddNom && <Dashed label="+ Add another nominee" onPress={V.obAddNom} />}
              {V.obNomErr && <Tx s={12} c={C.red} center style={{ marginTop: 12 }}>{V.obNomErrMsg}</Tx>}
              <CTA label="CONTINUE" onPress={V.obNomsNext} style={{ marginTop: 18 }} />
              <Pressable onPress={V.obOptOut} style={{ padding: 8, marginTop: 12 }}>
                <Tx s={12} c={C.muted} center>I do not wish to nominate anyone — <Tx w={700} s={12} c={C.green}>sign the SEBI opt-out declaration</Tx></Tx>
              </Pressable>
              <Pressable onPress={V.obSkipNoms} style={{ padding: 8, marginTop: 2 }}>
                <Tx s={12} c={C.muted} center>Decide later</Tx>
              </Pressable>
            </Rise>
          )}

          {V.obFeeStep && (
            <Rise>
              <Card big style={{ marginTop: -28, paddingVertical: 16, paddingHorizontal: 18 }}>
                <Tx s={12.5} c={C.muted} lh={1.6}>
                  Based on your <Tx w={700} s={12.5} c={C.ink}>{V.obRiskLabel}</Tx> profile, here is the structure and what it costs. Nothing sits in fine print.
                </Tx>
              </Card>
              <View style={{ gap: 12, marginTop: 14 }}>
                {V.obFees.map((fe, i) => <RadioCard key={i} item={fe} />)}
              </View>
              <Tx s={11} c={C.gray} lh={1.5} style={{ marginTop: 12 }}>
                Exact fee terms are set out in your PMS agreement before you sign. All fees are charged to the account, never collected separately.
              </Tx>
              <CTA label="CONTINUE" onPress={V.obFeeNext} style={{ marginTop: 16 }} />
            </Rise>
          )}

          {V.obQ && (
            <Rise>
              <Card big style={{ marginTop: -28, overflow: 'hidden' }}>
                {V.obAnswers.map((an, i) => (
                  <Pressable key={i} onPress={an.pick} style={{
                    flexDirection: 'row', alignItems: 'center', gap: 12,
                    paddingVertical: 16, paddingHorizontal: 18, minHeight: 44,
                    borderBottomWidth: i < V.obAnswers.length - 1 ? 1 : 0, borderColor: C.hairline,
                    backgroundColor: an.active ? 'rgba(2,66,43,0.06)' : 'transparent',
                  }}>
                    <Radio active={an.active} />
                    <Tx s={14}>{an.label}</Tx>
                  </Pressable>
                ))}
              </Card>
              <Tx s={11} c={C.gray} center style={{ marginTop: 12 }}>There are no wrong answers. This shapes your strategy mix.</Tx>
            </Rise>
          )}

          {V.obResult && (
            <Rise>
              <Card big style={{ marginTop: -28, paddingVertical: 24, paddingHorizontal: 22, alignItems: 'center' }}>
                <Tx w={700} s={10} ls={0.18} c={C.muted}>YOUR RISK PROFILE</Tx>
                <Tx f="play" w={600} s={26} c={C.green} style={{ marginTop: 10 }}>{V.obRiskLabel}</Tx>
                <View style={{ width: 44, height: 2, backgroundColor: C.gold, marginTop: 14 }} />
                <Tx s={12.5} c={C.muted} lh={1.6} center style={{ marginTop: 14 }}>
                  Based on your six answers. Your portfolio manager will review this with you before any investment is made. You can change it at any time.
                </Tx>
              </Card>
              <CTA label="CONTINUE" onPress={V.obResultNext} style={{ marginTop: 18 }} />
            </Rise>
          )}

          {V.obDocsStep && (
            <Rise>
              <View style={{ gap: 14, marginTop: -28 }}>
                {V.obDocGroups.map(g => (
                  <Card key={g.holder} big style={{ paddingVertical: 6, paddingHorizontal: 16 }}>
                    <Tx w={700} s={11} ls={0.14} c={C.muted} style={{ marginTop: 12 }}>{String(g.holder).toUpperCase()}</Tx>
                    {g.rows.map((r, i) => <DocRow key={r.key} r={r} last={i === g.rows.length - 1} />)}
                  </Card>
                ))}
              </View>
              <Tx s={11.5} c={C.muted} lh={1.55} center style={{ marginTop: 12 }}>
                Anything fetched from DigiLocker or covered by a verified bank account is already done. Save & exit anytime — uploads keep their place.
              </Tx>
              {V.obIsNri && (
                <Note style={{ marginTop: 14 }}>
                  <Tx w={700} s={10} ls={0.12} c={C.green}>FOR NRI / OCI / PIO APPLICANTS</Tx>
                  <Tx s={12} c={C.muted} lh={1.55} style={{ marginTop: 6 }}>
                    We’ll also need your PIS permission letter and NRE/NRO account details. Your RM will collect these after submission.
                  </Tx>
                </Note>
              )}
              {!!V.obDocErr && <Tx s={12} c={C.red} lh={1.5} center style={{ marginTop: 12 }}>{V.obDocErr}</Tx>}
              <CTA label="CONTINUE TO REVIEW" onPress={V.obDocsNext} style={{ marginTop: 18 }} />
            </Rise>
          )}

          {V.obReview && (
            <Rise>
              <View style={{ gap: 12, marginTop: -28 }}>
                {V.obReviewGroups.map((rg, i) => (
                  <Card key={i} style={{ paddingVertical: 14, paddingHorizontal: 18 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
                      <Tx w={700} s={10.5} ls={0.14} c={C.muted}>{rg.title}</Tx>
                      {!V.obLocked && <Pressable onPress={rg.edit}><Tx w={700} s={12} c={C.green}>Edit</Tx></Pressable>}
                    </View>
                    {rg.rows.map((rr, j) => (
                      <View key={j} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 16, paddingTop: 8 }}>
                        <Tx s={12} c={C.muted}>{rr.k}</Tx>
                        <Tx w={700} s={12} right style={{ flexShrink: 1 }}>{rr.v}</Tx>
                      </View>
                    ))}
                    {rg.badge && <View style={{ flexDirection: 'row', marginTop: 10 }}><Pill label={rg.badge} /></View>}
                  </Card>
                ))}
              </View>
              <Tx s={11.5} c={C.muted} lh={1.55} center style={{ marginTop: 16 }}>
                By submitting you confirm the details above are accurate. Your application locks after submission; your relationship manager can request changes. Your PMS agreement follows for e-sign.
              </Tx>
              {V.obHasErr && <Tx s={12} c={C.red} lh={1.5} center style={{ marginTop: 12 }}>{V.obErr}</Tx>}
              {!!V.obSubmitError && <Tx s={12} c={C.red} lh={1.5} center style={{ marginTop: 12 }}>{V.obSubmitError}</Tx>}
              <CTA label={V.obSubmitting ? 'SUBMITTING…' : 'SUBMIT APPLICATION'} onPress={V.obSubmitting ? undefined : V.obSubmit} style={{ marginTop: 14, opacity: V.obSubmitting ? 0.6 : 1 }} />
            </Rise>
          )}

          {V.obTracker && (
            <Rise>
              <Card big style={{ marginTop: -28, padding: 20 }}>
                {V.obTrack.map((tk, i) => <Track key={i} tk={tk} />)}
              </Card>
              <Pressable onPress={V.obRefresh}>
                <Note style={{ marginTop: 14 }}>
                  <Tx w={700} s={10} ls={0.12} c={C.green}>SUBMITTED · READ ONLY</Tx>
                  <Tx s={11.5} c={C.muted} lh={1.55} style={{ marginTop: 4 }}>{V.obTrackNote} Tap to refresh the status.</Tx>
                </Note>
              </Pressable>
              <Tx w={700} s={11} ls={0.12} c={C.muted} style={{ marginTop: 22, marginBottom: 10, marginLeft: 2 }}>WHILE YOU WAIT</Tx>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingBottom: 4 }}>
                {ARTICLES.map((a, i) => (
                  <Card key={i} style={{ width: 220, padding: 16 }}>
                    <Tx w={700} s={10} ls={0.12} c={C.gold}>{a.read}</Tx>
                    <Tx f="play" w={600} s={15} lh={1.35} style={{ marginTop: 8 }}>{a.title}</Tx>
                    <Tx s={11.5} c={C.muted} style={{ marginTop: 6 }}>{a.sub}</Tx>
                  </Card>
                ))}
              </ScrollView>
            </Rise>
          )}

          {V.obOpened && (
            <Rise>
              <Card big style={{ marginTop: -28, paddingVertical: 24, paddingHorizontal: 22, alignItems: 'center' }}>
                <Tx w={700} s={10} ls={0.18} c={C.muted}>YOUR ACCOUNT CODE</Tx>
                <Pressable onPress={V.obCopy}>
                  <Amt s={30} c={C.green} style={{ marginTop: 10 }}>PMS 00891</Amt>
                </Pressable>
                <Pressable onPress={V.obCopy} style={{
                  flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10,
                  borderWidth: 1, borderColor: C.greenBorder, borderRadius: 999, paddingVertical: 6, paddingHorizontal: 14,
                }}>
                  <Copy />
                  <Tx w={700} s={11} c={C.green}>{V.obCopyLabel}</Tx>
                </Pressable>
                <Tx s={12} c={C.muted} lh={1.55} center style={{ marginTop: 14 }}>
                  Securities will be held with our custodian in your own name. Your PMS agreement is in Documents.
                </Tx>
              </Card>
              <CTA label="FUND YOUR ACCOUNT" onPress={V.obOpenFund} style={{ marginTop: 18 }} />
              <CTA label="VIEW TRANSFER INSTRUCTIONS" onPress={V.obOpenFund} outline style={{ marginTop: 12 }} />
            </Rise>
          )}

          <Tx s={9.5} c={C.gray} lh={1.6} center style={{ marginTop: 28 }}>
            Qode is a SEBI-registered Portfolio Manager (Reg. No. INP000008914).{'\n'}Investments are subject to market risks.
          </Tx>
        </View>
      </KeyboardScroll>

      {/* keeps status-bar icons legible when content scrolls beneath them */}
      <LinearGradient colors={['rgba(0,16,8,0.9)', 'rgba(0,16,8,0)']}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, height: insets.top + 14, pointerEvents: 'none' }} />

      {/* transient notices: "Identity verified", upload results, warnings */}
      {!!V.obNotice && (
        <Pressable onPress={V.obDismissNotice} style={{ position: 'absolute', left: 22, right: 22, bottom: insets.bottom + 18 }}>
          <View style={{
            backgroundColor: V.obNotice.kind === 'err' ? '#7A1F1B' : V.obNotice.kind === 'warn' ? C.ink : C.green,
            borderRadius: 12, paddingVertical: 12, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 10,
            shadowColor: C.ink, shadowOpacity: 0.3, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 8,
          }}>
            {V.obNotice.kind === 'ok' && <Check s={14} c={C.gold} w={2.4} />}
            <Tx w={700} s={12} c={C.cream} style={{ flex: 1 }}>{V.obNotice.text}</Tx>
          </View>
        </Pressable>
      )}

      <VerifySheet open={V.obVerifyOpen} check={V.obVerifyCheck} title={V.obVerifyTitle} subtitle={V.obVerifySub}
        onClose={V.obVerifyClose} onManual={V.obVerifyManual} onRetry={V.obVerifyRetry} onKeepWaiting={V.obVerifyKeepWaiting} onEvent={V.obVerifyEvent} />

      {/* Fund-your-account sheet */}
      <Sheet visible={V.obFundOpen} onClose={V.obCloseFund}>
        {V.obFundForm && (
          <View style={{ paddingHorizontal: 22, paddingTop: 12, paddingBottom: 24 }}>
            <Tx f="play" w={600} s={21}>Fund your account</Tx>
            <Tx s={12} c={C.muted} style={{ marginTop: 3 }}>First contribution to PMS 00891</Tx>
            <Tx w={700} s={11} ls={0.12} c={C.muted} style={{ marginTop: 20, marginBottom: 8 }}>AMOUNT</Tx>
            <Field value={V.obAmtStr} onChangeText={V.onObAmt} numeric s={26} prefix="₹" />
            <Tx s={11} c={C.gray} style={{ marginTop: 8 }}>Minimum initial contribution ₹50,00,000.00 as per SEBI PMS regulations.</Tx>
            <Tx w={700} s={11} ls={0.12} c={C.muted} style={{ marginTop: 20, marginBottom: 8 }}>TRANSFER TO YOUR OWN PMS ACCOUNT</Tx>
            <View style={{ borderWidth: 1, borderColor: 'rgba(55,88,79,0.2)', borderRadius: 8, paddingHorizontal: 16, paddingVertical: 4 }}>
              {[['Account name', 'Rohan Mehta — PMS'], ['Bank', 'HDFC Bank, Fort, Mumbai'], ['Account no.', '50100 4821 0891'], ['IFSC', 'HDFC0000060']].map(([k, v], i) => (
                <View key={k} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: i < 3 ? 1 : 0, borderColor: C.hairline }}>
                  <Tx s={12} c={C.muted}>{k}</Tx>
                  {k === 'Account no.' ? <Amt s={12}>{v}</Amt> : <Tx w={700} s={12}>{v}</Tx>}
                </View>
              ))}
            </View>
            <Tx s={11} c={C.gray} lh={1.5} style={{ marginTop: 14 }}>
              This account is in your name with our custodian. Funds received before 2:00 PM IST are invested at the next available NAV.
            </Tx>
            <CTA label="I'VE INITIATED THE TRANSFER" onPress={V.obFundConfirm} style={{ marginTop: 18 }} />
          </View>
        )}
        {V.obFundDone && (
          <View style={{ paddingHorizontal: 22, paddingTop: 20, paddingBottom: 24, alignItems: 'center' }}>
            <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: C.green, alignItems: 'center', justifyContent: 'center', marginTop: 8 }}>
              <Check s={28} c={C.gold} w={2.2} />
            </View>
            <Tx f="play" w={600} s={20} style={{ marginTop: 16 }}>Transfer noted</Tx>
            <Amt s={26} c={C.green} style={{ marginTop: 6 }}>{V.obAmtFmt}</Amt>
            <Tx s={12} c={C.muted} lh={1.55} center style={{ marginTop: 12 }}>
              We'll confirm once funds clear and invest at the next NAV.{'\n'}A receipt follows to your registered email.
            </Tx>
            <CTA label="GO TO DASHBOARD" onPress={V.obFinish} style={{ marginTop: 20, alignSelf: 'stretch' }} />
          </View>
        )}
      </Sheet>
    </View>
  );
}
