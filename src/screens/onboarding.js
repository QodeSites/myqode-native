// 6-step onboarding journey: details → OTP → account type → personal →
// nominees → fee → risk questions → result → documents → review → tracker →
// account opened → fund sheet.
import React from 'react';
import { View, Pressable, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';
import {
  C, Tx, Amt, Card, CTA, Chip, ChipRow, CurveCap, Field, OtpRow,
  Radio, Rise, Hairline, GoldThreads, Sheet, useUI,
} from '../ui';
import { ChevronLeft, Check, SmallCheck, Copy } from '../icons';
import { ARTICLES } from '../data';

const Sub = ({ children, style }) => <Tx w={700} s={10} ls={0.12} c={C.gray} style={style}>{children}</Tx>;

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

export default function Onboarding({ V }) {
  const insets = useSafeAreaInsets();
  const { z } = useUI();
  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: C.cream }}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
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
            <Pressable onPress={V.obSaveExit} style={{ paddingVertical: 12, paddingLeft: 12 }}>
              <Tx w={700} s={11} ls={0.1} c={C.cream60}>SAVE & EXIT</Tx>
            </Pressable>
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

          {V.obBegin && (
            <Rise>
              <Card big style={{ marginTop: -28, paddingVertical: 22, paddingHorizontal: 20 }}>
                <Field label="FULL NAME" value={V.obName} onChangeText={V.onObName} placeholder="As it appears on your PAN" />
                <Field label="EMAIL" value={V.obEmail} onChangeText={V.onObEmail} placeholder="you@example.com" style={{ marginTop: 18 }} />
                <Field label="MOBILE" value={V.obMobile} onChangeText={V.onObMobile} placeholder="10-digit mobile" numeric prefix="+91" style={{ marginTop: 18 }} />
                {V.obHasErr && <Tx s={12} c={C.red} style={{ marginTop: 12 }}>{V.obErr}</Tx>}
                <CTA label="CONTINUE" onPress={V.obBeginNext} style={{ marginTop: 22 }} />
              </Card>
              <Tx s={12} c={C.muted} center style={{ marginTop: 16 }}>Takes about 15 minutes. Save and resume anytime.</Tx>
            </Rise>
          )}

          {V.obOtpStep && (
            <Rise>
              <Card big style={{ marginTop: -28, paddingVertical: 22, paddingHorizontal: 20 }}>
                <Sub>CODE SENT TO +91 {V.obMobileMask}</Sub>
                <View style={{ marginTop: 14 }}>
                  <OtpRow boxes={V.obOtpBoxes} />
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'baseline', gap: 14, marginTop: 14 }}>
                  <Tx s={12} c={C.gray}>Resend code in 00:24</Tx>
                  <Pressable onPress={V.obEditNum}><Tx w={700} s={12} c={C.green}>Edit number</Tx></Pressable>
                </View>
                <CTA label="VERIFY" onPress={V.obOtpNext} style={{ marginTop: 16 }} />
              </Card>
            </Rise>
          )}

          {V.obType && (
            <Rise>
              <View style={{ gap: 12, marginTop: -28 }}>
                {V.obTypes.map((ty, i) => (
                  <RadioCard key={i} item={ty}>
                    {ty.showRes && (
                      <ChipRow chips={V.obResChips} style={{ marginTop: 12 }} py={7} px={13} />
                    )}
                  </RadioCard>
                ))}
              </View>
              <Card style={{ paddingVertical: 18, paddingHorizontal: 20, marginTop: 16 }}>
                <Field label="SET A PASSWORD" value={V.obPw} onChangeText={V.onObPw} placeholder="At least 8 characters" secure />
                <View style={{ flexDirection: 'row', gap: 6, marginTop: 12, alignItems: 'center' }}>
                  {V.obSegs.map((col, i) => (
                    <View key={i} style={{ flex: 1, height: 3, borderRadius: 2, backgroundColor: col }} />
                  ))}
                  <Tx w={700} s={10} ls={0.08} c={C.muted} style={{ marginLeft: 6, minWidth: 44 }}>{V.obPwLabel}</Tx>
                </View>
              </Card>
              <CTA label="CONTINUE" onPress={V.obTypeNext} style={{ marginTop: 18 }} />
            </Rise>
          )}

          {V.obIdentity && (
            <Rise>
              <Card big style={{ marginTop: -28, padding: 20 }}>
                <Sub>RESIDENCY</Sub>
                <ChipRow chips={V.obResidency} flex round={false} py={10} s={11.5} style={{ marginTop: 10 }} />
                <Hairline style={{ marginVertical: 18 }} />
                <Tx w={700} s={11} ls={0.14} c={C.muted}>HOLDER 1</Tx>
                <Field label="NAME AS PER PAN" value={V.obName} onChangeText={V.onObName} style={{ marginTop: 14 }} />
                <Sub style={{ marginTop: 16 }}>GENDER</Sub>
                <ChipRow chips={V.obGender} style={{ marginTop: 8 }} />
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
                  <Field label="EMAIL" value={V.obEmail} onChangeText={V.onObEmail} s={14} style={{ flex: 1 }} />
                  <View style={{ flex: 1 }}>
                    <Sub>BELONGS TO</Sub>
                    <ChipRow chips={V.obEmailBelongs} py={7} s={10.5} style={{ marginTop: 8 }} />
                  </View>
                </View>
                <Field label="DATE OF BIRTH" value={V.obDob} onChangeText={V.onObDob} placeholder="DD / MM / YYYY" s={14} style={{ marginTop: 16 }} />
                <Field label="ADDRESS AS PER PROOF" value={V.obAddr} onChangeText={V.onObAddr} placeholder="Flat, street, city, PIN" s={14} style={{ marginTop: 16 }} />
              </Card>
              {V.obNoH2 && <Dashed label="+ Add second holder" onPress={V.obAddH2} />}
              {V.obH2 && (
                <Card style={{ paddingVertical: 18, paddingHorizontal: 20, marginTop: 14 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <Tx w={700} s={11} ls={0.14} c={C.muted}>HOLDER 2</Tx>
                    <Pressable onPress={V.obRemoveH2}><Tx w={700} s={11} c={C.red}>Remove</Tx></Pressable>
                  </View>
                  <Field label="NAME AS PER PAN" value={V.obH2Name} onChangeText={V.onObH2Name} placeholder="Second holder's name" style={{ marginTop: 14 }} />
                  <Sub style={{ marginTop: 16 }}>MODE OF OPERATION</Sub>
                  <ChipRow chips={V.obMode} flex round={false} py={9} style={{ marginTop: 8 }} />
                </Card>
              )}
              <CTA label="CONTINUE" onPress={V.obIdentityNext} style={{ marginTop: 18 }} />
            </Rise>
          )}

          {/* FINANCIAL PROFILE (v2) */}
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
                    <Field label="FULL NAME" value={nm.name} onChangeText={nm.onName} s={14} style={{ marginTop: 14 }} />
                    <View style={{ flexDirection: 'row', gap: 14, marginTop: 14 }}>
                      <Field label="RELATIONSHIP" value={nm.rel} onChangeText={nm.onRel} placeholder="e.g. Spouse" s={14} style={{ flex: 1 }} />
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
                      <Field label="GUARDIAN NAME" value={nm.guardian} onChangeText={nm.onGuardian} s={14} style={{ marginTop: 10 }} />
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
                  Based on your <Tx w={700} s={12.5} c={C.ink}>Moderate-Aggressive</Tx> profile, here is the structure and what it costs. Nothing sits in fine print.
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
                <Tx f="play" w={600} s={26} c={C.green} style={{ marginTop: 10 }}>Moderate-Aggressive</Tx>
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
              <Card big style={{ marginTop: -28, overflow: 'hidden' }}>
                {V.obDocRows.map((dr, i) => (
                  <View key={i} style={{ paddingVertical: 14, paddingHorizontal: 16, borderBottomWidth: i < 3 ? 1 : 0, borderColor: C.hairline }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                      <View style={{ flex: 1 }}>
                        <Tx w={700} s={13}>{dr.label}</Tx>
                        {dr.isDone && <Tx s={11} c={C.muted} style={{ marginTop: 3 }}>{dr.file}</Tx>}
                        {dr.isErr && <Tx s={11} c={C.red} style={{ marginTop: 3 }}>{dr.err}</Tx>}
                        {dr.isPend && <Tx s={11} c={C.gray} style={{ marginTop: 3 }}>PDF or photo, up to 10 MB</Tx>}
                      </View>
                      {dr.isDone && (
                        <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: 'rgba(2,66,43,0.1)', alignItems: 'center', justifyContent: 'center' }}>
                          <Check s={13} />
                        </View>
                      )}
                      {dr.isErr && (
                        <Pressable onPress={dr.act} style={{ borderWidth: 1, borderColor: 'rgba(239,68,68,0.5)', borderRadius: 999, paddingVertical: 7, paddingHorizontal: 14 }}>
                          <Tx w={700} s={11} ls={0.08} c={C.red}>RETRY</Tx>
                        </Pressable>
                      )}
                      {dr.isPend && (
                        <Pressable onPress={dr.act} style={{ borderWidth: 1.5, borderStyle: 'dashed', borderColor: 'rgba(2,66,43,0.45)', borderRadius: 999, paddingVertical: 7, paddingHorizontal: 14 }}>
                          <Tx w={700} s={11} ls={0.08} c={C.green}>UPLOAD</Tx>
                        </Pressable>
                      )}
                    </View>
                  </View>
                ))}
              </Card>
              <Tx s={11.5} c={C.muted} lh={1.55} center style={{ marginTop: 12 }}>
                PDF or photo, up to 10 MB each. Save & exit anytime — your uploads keep their place.
              </Tx>
              {V.obIsNri && (
                <View style={{ backgroundColor: 'rgba(2,66,43,0.06)', borderWidth: 1, borderColor: 'rgba(2,66,43,0.15)', borderRadius: 8, paddingVertical: 14, paddingHorizontal: 16, marginTop: 14 }}>
                  <Tx w={700} s={10} ls={0.12} c={C.green}>FOR NRI / OCI / PIO APPLICANTS</Tx>
                  <Tx s={12} c={C.muted} lh={1.55} style={{ marginTop: 6 }}>
                    We'll also need your PIS permission letter, overseas address proof, and NRE/NRO account details. Your RM will collect these after submission.
                  </Tx>
                </View>
              )}
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
                      <Pressable onPress={rg.edit}><Tx w={700} s={12} c={C.green}>Edit</Tx></Pressable>
                    </View>
                    {rg.rows.map((rr, j) => (
                      <View key={j} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 16, paddingTop: 8 }}>
                        <Tx s={12} c={C.muted}>{rr.k}</Tx>
                        <Tx w={700} s={12} right style={{ flexShrink: 1 }}>{rr.v}</Tx>
                      </View>
                    ))}
                  </Card>
                ))}
              </View>
              <Tx s={11.5} c={C.muted} lh={1.55} center style={{ marginTop: 16 }}>
                By submitting you confirm the details above are accurate. Your PMS agreement and custody documents follow by email for e-sign.
              </Tx>
              <CTA label="SUBMIT APPLICATION" onPress={V.obSubmit} style={{ marginTop: 14 }} />
            </Rise>
          )}

          {V.obTracker && (
            <Rise>
              <Card big style={{ marginTop: -28, padding: 20 }}>
                {V.obTrack.map((tk, i) => (
                  <View key={i} style={{ flexDirection: 'row', gap: 14, paddingLeft: 2 }}>
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
                      {tk.pending && (
                        <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: 'rgba(55,88,79,0.3)' }} />
                      )}
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
                ))}
              </Card>
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
              <Pressable onPress={V.obToOpened} style={{ padding: 8, marginTop: 18 }}>
                <Tx s={11} c={C.gray} center>(Prototype) Custodian approved — view account opened →</Tx>
              </Pressable>
            </Rise>
          )}

          {V.obOpened && (
            <Rise>
              <Card big style={{ marginTop: -28, paddingVertical: 24, paddingHorizontal: 22, alignItems: 'center' }}>
                <Tx w={700} s={10} ls={0.18} c={C.muted}>YOUR ACCOUNT CODE</Tx>
                <Pressable onPress={V.obCopy}>
                  <Amt s={30} c={C.green} noHide style={{ marginTop: 10 }}>PMS 00891</Amt>
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
      </ScrollView>

      {/* keeps status-bar icons legible when content scrolls beneath them */}
      <LinearGradient colors={['rgba(0,16,8,0.9)', 'rgba(0,16,8,0)']}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, height: insets.top + 14, pointerEvents: 'none' }} />

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
                  {k === 'Account no.' ? <Amt s={12} noHide>{v}</Amt> : <Tx w={700} s={12}>{v}</Tx>}
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
            <Amt s={26} c={C.green} noHide style={{ marginTop: 6 }}>{V.obAmtFmt}</Amt>
            <Tx s={12} c={C.muted} lh={1.55} center style={{ marginTop: 12 }}>
              We'll confirm once funds clear and invest at the next NAV.{'\n'}A receipt follows to your registered email.
            </Tx>
            <CTA label="GO TO DASHBOARD" onPress={V.obFinish} style={{ marginTop: 20, alignSelf: 'stretch' }} />
          </View>
        )}
      </Sheet>
    </KeyboardAvoidingView>
  );
}
