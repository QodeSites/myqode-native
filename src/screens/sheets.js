// Bottom sheets for the main app: add/withdraw funds, family account switch,
// display & accessibility settings.
import React from 'react';
import { View, Pressable } from 'react-native';
import { C, Tx, Amt, Sheet, Field, CTA, Chip, ChipRow, Toggle, Hairline } from '../ui';
import { Crown, ChevronRight } from '../icons';

// "For your attention" — notifications sheet (v2).
export function NotifsSheet({ V }) {
  return (
    <Sheet visible={V.sheetNotifs} onClose={V.closeSheet}>
      <View style={{ paddingHorizontal: 22, paddingTop: 12, paddingBottom: 24 }}>
        <Tx f="play" w={600} s={21}>For your attention</Tx>
        <Tx s={12} c={C.muted} style={{ marginTop: 3 }}>Everything that needs you, in one place</Tx>
        {V.notifEmpty && (
          <View style={{ alignItems: 'center', paddingTop: 34, paddingHorizontal: 20, paddingBottom: 18 }}>
            <View style={{ width: 44, height: 2, backgroundColor: C.gold }} />
            <Tx s={13} c={C.muted} lh={1.6} center style={{ marginTop: 16 }}>Nothing needs your attention right now.</Tx>
          </View>
        )}
        {V.notifHas && (
          <View style={{ marginTop: 16, borderWidth: 1, borderColor: 'rgba(55,88,79,0.2)', borderRadius: 8, overflow: 'hidden' }}>
            {V.notifList.map((nt, i) => (
              <Pressable key={nt.title} onPress={nt.pick} style={{
                flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 16,
                minHeight: 44, borderBottomWidth: i < V.notifList.length - 1 ? 1 : 0, borderColor: C.hairline,
              }}>
                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: C.gold }} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Tx w={700} s={13}>{nt.title}</Tx>
                  <Tx s={11} c={C.muted} style={{ marginTop: 2 }}>{nt.sub}</Tx>
                </View>
                <ChevronRight />
              </Pressable>
            ))}
          </View>
        )}
      </View>
    </Sheet>
  );
}

export function MoneySheet({ V }) {
  return (
    <Sheet visible={V.sheetMoney} onClose={V.closeSheet}>
      <View style={{ paddingHorizontal: 22, paddingTop: 12, paddingBottom: 24 }}>
        <Tx f="play" w={600} s={21}>{V.sheetTitle}</Tx>
        <Tx s={12} c={C.muted} style={{ marginTop: 3 }}>{V.sheetSub}</Tx>
        <Tx w={700} s={11} ls={0.12} c={C.muted} style={{ marginTop: 22, marginBottom: 8 }}>AMOUNT</Tx>
        <Field value={V.amtStr} onChangeText={V.onAmt} numeric s={26} prefix="₹" />
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
          {V.amtChips.map(ch => (
            <Pressable key={ch.label} onPress={ch.pick} style={{ borderWidth: 1, borderColor: C.greenBorder, borderRadius: 999, paddingVertical: 8, paddingHorizontal: 14 }}>
              <Amt s={12} c={C.green}>{ch.label}</Amt>
            </Pressable>
          ))}
        </View>
        <Tx w={700} s={11} ls={0.12} c={C.muted} style={{ marginTop: 24, marginBottom: 8 }}>METHOD</Tx>
        <ChipRow chips={V.methods} flex gap={10} py={11} s={11.5} round={false} />
        <Tx s={11} c={C.gray} lh={1.5} style={{ marginTop: 16 }}>{V.sheetNote}</Tx>
        <CTA label={V.sheetCta} onPress={V.confirmMoney} ls={0.06} style={{ marginTop: 20 }} />
      </View>
    </Sheet>
  );
}

export function SwitchSheet({ V }) {
  return (
    <Sheet visible={V.sheetSwitch} onClose={V.closeSheet}>
      <View style={{ paddingHorizontal: 22, paddingTop: 12, paddingBottom: 24 }}>
        <Tx f="play" w={600} s={21}>Family Accounts</Tx>
        <Tx s={12} c={C.muted} style={{ marginTop: 3 }}>Switch between linked PMS accounts</Tx>
        <View style={{ marginTop: 18, borderWidth: 1, borderColor: 'rgba(55,88,79,0.2)', borderRadius: 8, overflow: 'hidden' }}>
          {V.acctList.map((a, i) => (
            <View key={a.id}>
            <Pressable onPress={a.pick} style={{
              flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14,
              borderBottomWidth: i < V.acctList.length - 1 ? 1 : 0, borderColor: C.hairline,
              backgroundColor: a.active ? 'rgba(2,66,43,0.06)' : 'transparent',
              borderLeftWidth: 2, borderLeftColor: a.active ? C.gold : 'transparent',
            }}>
              <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: C.green, alignItems: 'center', justifyContent: 'center' }}>
                <Tx w={700} s={11} c={C.cream}>{a.initials}</Tx>
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Tx w={700} s={13}>{a.name}</Tx>
                  {a.crown && <Crown />}
                </View>
                <View style={{ marginTop: 4, flexDirection: 'row' }}>
                  <View style={{ borderWidth: 1, borderColor: C.mutedBorder35, borderRadius: 999, paddingVertical: 2, paddingHorizontal: 8 }}>
                    <Tx w={700} s={8.5} ls={0.1} c={C.muted}>{a.role}</Tx>
                  </View>
                </View>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Amt s={13}>{a.value}</Amt>
                <Tx s={10} c={C.gray} style={{ marginTop: 2 }}>{a.code} · all strategies</Tx>
              </View>
            </Pressable>
            {a.subs.map(x => (
              <Pressable key={x.id} onPress={x.pick} style={{
                flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 11, paddingRight: 14, paddingLeft: 62, minHeight: 44,
                borderBottomWidth: 1, borderColor: C.hairline,
                backgroundColor: x.active ? 'rgba(2,66,43,0.06)' : 'transparent',
                borderLeftWidth: 2, borderLeftColor: x.active ? C.gold : 'transparent',
              }}>
                <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: x.color }} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Tx w={700} s={12}>{x.name}</Tx>
                  <Tx s={10} c={C.gray} style={{ marginTop: 1 }}>{x.code}</Tx>
                </View>
                <Amt s={12}>{x.value}</Amt>
              </Pressable>
            ))}
            </View>
          ))}
        </View>
        {V.hasFamily && <Pressable onPress={V.pickFamily} style={{
          marginTop: 12, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14,
          borderWidth: 1, borderRadius: 8,
          borderColor: V.famActive ? C.gold : 'rgba(55,88,79,0.2)',
          backgroundColor: V.famActive ? 'rgba(218,189,56,0.08)' : 'transparent',
        }}>
          <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: C.gold, alignItems: 'center', justifyContent: 'center' }}>
            <Tx w={700} s={11} c={C.ink}>MF</Tx>
          </View>
          <View style={{ flex: 1 }}>
            <Tx w={700} s={13}>Entire Family</Tx>
            <Tx s={11} c={C.muted} style={{ marginTop: 2 }}>Combined view of all family members</Tx>
          </View>
          <Amt s={13}>{V.familyTotal}</Amt>
        </Pressable>}
      </View>
    </Sheet>
  );
}

export function SettingsSheet({ V }) {
  return (
    <Sheet visible={V.sheetSettings} onClose={V.closeSheet}>
      <View style={{ paddingHorizontal: 22, paddingTop: 12, paddingBottom: 24 }}>
        <Tx f="play" w={600} s={21}>Display & accessibility</Tx>
        <Tx s={12} c={C.muted} style={{ marginTop: 3 }}>Applies immediately across the app</Tx>
        <Tx w={700} s={11} ls={0.12} c={C.muted} style={{ marginTop: 22, marginBottom: 8 }}>TEXT SIZE</Tx>
        <ChipRow chips={V.tsChips} flex py={11} s={12} round={false} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 16, marginTop: 14, borderBottomWidth: 1, borderColor: C.hairline }}>
          <View style={{ flex: 1 }}>
            <Tx w={700} s={13}>High contrast</Tx>
            <Tx s={11} c={C.muted} style={{ marginTop: 2 }}>Deepens text and borders</Tx>
          </View>
          <Toggle on={V.hcOn} onPress={V.hcToggle} />
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 16 }}>
          <View style={{ flex: 1 }}>
            <Tx w={700} s={13}>Reduced motion</Tx>
            <Tx s={11} c={C.muted} style={{ marginTop: 2 }}>Minimises animation throughout</Tx>
          </View>
          <Toggle on={V.rmOn} onPress={V.rmToggle} />
        </View>
      </View>
    </Sheet>
  );
}
