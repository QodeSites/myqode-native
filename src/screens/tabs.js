// Cream-zone content for each tab of the main app (Curtain v2).
import React from 'react';
import { View, Pressable, ScrollView, TextInput } from 'react-native';
import { C, Tx, Amt, Card, Chip, ChipRow, Fade, Skel, useUI } from '../ui';
import { Plus, ArrowDown, DocIcon, Bars, Download, ChevronRight, Phone, MailIcon, Search, InfoCircle, GoldDocIcon } from '../icons';
import { NavChart, Donut } from './charts';
import { TRAILING, HOLD } from '../data';

const Label = ({ children, style }) => (
  <Tx w={700} s={11} ls={0.12} c={C.muted} style={[{ marginTop: 22, marginBottom: 10, marginLeft: 2 }, style]}>{children}</Tx>
);

// Two-up grid row that never collapses to one column: fixed 48% widths with
// space-between (no horizontal gap that could overflow on narrow screens).
export function Grid2({ children, style }) {
  return (
    <View style={[{ flexDirection: 'row', flexWrap: 'wrap', rowGap: 12, justifyContent: 'space-between' }, style]}>
      {children}
    </View>
  );
}

function RangeRow({ ranges, style }) {
  return (
    <View style={[{ flexDirection: 'row', gap: 8 }, style]}>
      {ranges.map(r => <Chip key={r.label} label={r.label} active={r.active} onPress={r.pick} flex py={7} />)}
    </View>
  );
}

function Tile({ t }) {
  return (
    <Card style={{ width: '48%', paddingVertical: 13, paddingHorizontal: 14 }}>
      <Tx w={700} s={10.5} ls={0.12} c={C.muted}>{t.label}</Tx>
      <Amt s={16} c={t.color} style={{ marginTop: 6 }}>{t.value}</Amt>
    </Card>
  );
}

function TxRow({ t, last, status }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13, paddingHorizontal: 16, borderBottomWidth: last ? 0 : 1, borderColor: C.hairline }}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Tx w={700} s={13}>{t.title}</Tx>
        <Tx s={11} c={C.muted} style={{ marginTop: 2 }}>{t.sub}</Tx>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Amt s={13} c={t.color}>{t.amt}</Amt>
        {status && <Tx w={700} s={8.5} ls={0.1} c={t.stColor} style={{ marginTop: 4 }}>{t.status}</Tx>}
      </View>
    </View>
  );
}

function Action({ icon, label, onPress, primary }) {
  return (
    <Pressable onPress={onPress} style={{ alignItems: 'center', gap: 7, flex: 1 }}>
      <View style={{
        width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center',
        backgroundColor: primary ? C.green : C.card,
        borderWidth: primary ? 0 : 1, borderColor: C.greenBorder,
        shadowColor: C.ink, shadowOpacity: primary ? 0.25 : 0, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: primary ? 4 : 0,
      }}>{icon}</View>
      <Tx w={700} s={11}>{label}</Tx>
    </Pressable>
  );
}

export function HomeSkeleton() {
  return (
    <View style={{ marginTop: -34 }}>
      <Skel h={212} />
      <Grid2 style={{ marginTop: 16 }}>
        <Skel h={72} style={{ width: '48%' }} /><Skel h={72} style={{ width: '48%' }} />
        <Skel h={72} style={{ width: '48%' }} /><Skel h={72} style={{ width: '48%' }} />
      </Grid2>
      <Skel h={180} style={{ marginTop: 16 }} />
    </View>
  );
}

export function OtherSkeleton() {
  return (
    <View style={{ marginTop: -34 }}>
      <Skel h={150} />
      <Skel h={64} style={{ marginTop: 14 }} />
      <Skel h={64} style={{ marginTop: 12 }} />
      <Skel h={64} style={{ marginTop: 12 }} />
    </View>
  );
}

export function HomeCream({ V }) {
  return (
    <Fade>
      <Card big style={{ marginTop: -34, paddingTop: 16, paddingHorizontal: 16, paddingBottom: 14 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <Tx w={700} s={11} ls={0.12} c={C.muted}>PORTFOLIO NAV</Tx>
          <Amt s={14} noHide>156.83</Amt>
        </View>
        <View style={{ marginTop: 10 }}>
          <NavChart line={V.linePath} area={V.areaPath} bench={V.benchPath} />
        </View>
        <RangeRow ranges={V.ranges} style={{ marginTop: 12 }} />
        <Tx s={11} c={C.muted} style={{ marginTop: 12 }}>{V.navSummary}</Tx>
      </Card>
      <View style={{ flexDirection: 'row', gap: 10, marginTop: 20 }}>
        <Action icon={<Plus />} label="Add Funds" onPress={V.openAdd} primary />
        <Action icon={<ArrowDown />} label="Withdraw" onPress={V.openWithdraw} />
        <Action icon={<DocIcon />} label="Statement" onPress={V.goDocs} />
        <Action icon={<Bars />} label="Reports" onPress={V.goPortfolio} />
      </View>
      <Grid2 style={{ marginTop: 22 }}>
        {V.tiles.map(t => <Tile key={t.label} t={t} />)}
      </Grid2>
      <Tx s={11} c={C.gray} style={{ marginTop: 10, marginLeft: 2 }}>As of 14 Jul 2026</Tx>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 24, marginBottom: 10, marginHorizontal: 2 }}>
        <Tx w={700} s={11} ls={0.12} c={C.muted}>RECENT ACTIVITY</Tx>
        <Pressable onPress={V.goServices}><Tx w={700} s={12} c={C.green}>View all</Tx></Pressable>
      </View>
      <Card style={{ overflow: 'hidden' }}>
        {V.tx3.map((t, i) => <TxRow key={i} t={t} last={i === V.tx3.length - 1} />)}
      </Card>
    </Fade>
  );
}

// Collapsible "Detailed metrics" card: trailing returns, risk & return detail,
// capital flows, tap-to-explain credibility metrics.
function DetailedMetrics({ V }) {
  return (
    <Card style={{ overflow: 'hidden', marginTop: 22 }}>
      <Pressable onPress={V.toggleDet} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 15, paddingHorizontal: 16, minHeight: 44 }}>
        <Tx w={700} s={11} ls={0.12} style={{ flex: 1 }}>DETAILED METRICS</Tx>
        {!!V.detHint && <Tx s={11} c={C.gray}>{V.detHint}</Tx>}
        <View style={{ transform: [{ rotate: V.detOpen ? '90deg' : '0deg' }] }}>
          <ChevronRight s={12} c={C.muted} />
        </View>
      </Pressable>
      {V.detOpen && (
        <Fade duration={200} style={{ borderTopWidth: 1, borderColor: C.hairline, paddingTop: 14, paddingHorizontal: 16, paddingBottom: 18 }}>
          <Tx w={700} s={10} ls={0.12} c={C.muted}>TRAILING RETURNS</Tx>
          <View style={{ gap: 10, marginTop: 10 }}>
            {TRAILING.map(tr => (
              <View key={tr.p} style={{ backgroundColor: C.cream, borderRadius: 8, paddingVertical: 12, paddingHorizontal: 14 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <Tx w={700} s={11} ls={0.12}>{tr.p}</Tx>
                  <Amt s={16} c={C.green} noHide>{tr.pf}</Amt>
                </View>
                <View style={{ flexDirection: 'row', gap: 18, marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderColor: C.hairline }}>
                  <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
                    <Tx s={10.5} ls={0.06} c={C.muted}>NIFTY 50</Tx><Amt s={12} noHide>{tr.n}</Amt>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
                    <Tx s={10.5} ls={0.06} c={C.muted}>EXCESS</Tx><Amt s={12} c={C.gold} noHide>{tr.x}</Amt>
                  </View>
                </View>
              </View>
            ))}
          </View>
          <Tx w={700} s={10} ls={0.12} c={C.muted} style={{ marginTop: 18 }}>RISK & RETURN DETAIL</Tx>
          <View style={{ gap: 8, marginTop: 10 }}>
            {V.riskRows.map(rw => (
              <View key={rw.k} style={{ backgroundColor: C.cream, borderRadius: 8, paddingVertical: 12, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'baseline', gap: 12 }}>
                <Tx w={700} s={10.5} ls={0.1} c={C.muted}>{rw.k}</Tx>
                <Tx s={10.5} c={C.gray} right style={{ flex: 1 }}>{rw.note}</Tx>
                <Amt s={14} c={rw.vc} noHide>{rw.v}</Amt>
              </View>
            ))}
          </View>
          <Tx w={700} s={10} ls={0.12} c={C.muted} style={{ marginTop: 18 }}>CAPITAL FLOWS</Tx>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', rowGap: 8, justifyContent: 'space-between', marginTop: 10 }}>
            {V.flows.map(f => (
              <View key={f.label} style={{ width: '48.5%', backgroundColor: C.cream, borderRadius: 8, paddingVertical: 11, paddingHorizontal: 12 }}>
                <Tx w={700} s={9.5} ls={0.1} c={C.muted}>{f.label}</Tx>
                <Amt s={13} c={f.color} style={{ marginTop: 5 }}>{f.value}</Amt>
              </View>
            ))}
          </View>
          <Tx w={700} s={10} ls={0.12} c={C.muted} style={{ marginTop: 18 }}>CREDIBILITY METRICS</Tx>
          <View style={{ gap: 8, marginTop: 10 }}>
            {V.credItems.map(cm => (
              <Pressable key={cm.label} onPress={cm.pick} style={{ backgroundColor: C.cream, borderRadius: 8, paddingVertical: 12, paddingHorizontal: 14 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <Tx w={700} s={10.5} ls={0.1} c={C.muted} style={{ flex: 1 }}>{cm.label}</Tx>
                  <Amt s={14} noHide>{cm.value}</Amt>
                  <InfoCircle />
                </View>
                {cm.open && (
                  <Fade duration={200}>
                    <Tx s={11.5} c={C.muted} lh={1.5} style={{ marginTop: 8 }}>{cm.def}</Tx>
                  </Fade>
                )}
              </Pressable>
            ))}
          </View>
          <Tx s={11} c={C.gray} style={{ marginTop: 12 }}>As of 14 Jul 2026 · TWRR, net of fees · Since inception unless stated</Tx>
        </Fade>
      )}
    </Card>
  );
}

// Profit & Loss: FY pills, monthly/quarterly toggle, All-Years accordion.
function ProfitLoss({ V }) {
  return (
    <>
      <Tx w={700} s={11} ls={0.12} c={C.muted} style={{ marginTop: 24, marginLeft: 2 }}>PROFIT & LOSS</Tx>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 4 }} contentContainerStyle={{ gap: 18, paddingHorizontal: 2, paddingBottom: 2 }}>
        {V.pnlPills.map(fp => (
          <Pressable key={fp.label} onPress={fp.pick} style={{ paddingTop: 8, paddingBottom: 6, minHeight: 32 }}>
            <Tx w={700} s={11.5} ls={0.06} c={fp.active ? C.ink : C.muted}>{fp.label}</Tx>
            <View style={{ height: 2, backgroundColor: C.gold, marginTop: 5, opacity: fp.active ? 1 : 0 }} />
          </Pressable>
        ))}
      </ScrollView>
      {V.pnlIsYear && (
        <Fade key={'y' + V.pnlFy} duration={200}>
          <ChipRow chips={V.pnlSegChips} flex py={8} s={11} style={{ marginTop: 14 }} />
          <View style={{ gap: 10, marginTop: 12 }}>
            {V.pnlRows.map(m => (
              <Card key={m.m} style={{ paddingVertical: 13, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center' }}>
                <View style={{ flex: 1 }}>
                  <Tx w={700} s={13}>{m.m}</Tx>
                  <Tx s={11} c={C.muted} style={{ marginTop: 2 }}>{m.note}</Tx>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Amt s={14} c={m.color}>{m.v}</Amt>
                  <Amt s={11} c={m.color} noHide style={{ marginTop: 2 }}>{m.p}</Amt>
                </View>
              </Card>
            ))}
          </View>
          <Card style={{ paddingVertical: 14, paddingHorizontal: 16, marginTop: 12, borderLeftWidth: 2, borderLeftColor: C.gold, flexDirection: 'row', alignItems: 'center' }}>
            <Tx w={700} s={11.5} ls={0.1} style={{ flex: 1 }}>{V.fyLabel} TOTAL</Tx>
            <Amt s={15} c={V.fyColor}>{V.fyTotal}</Amt>
          </Card>
        </Fade>
      )}
      {V.pnlIsAll && (
        <Fade key="all" duration={200} style={{ gap: 10, marginTop: 14 }}>
          {V.allYears.map(y => (
            <Card key={y.label} style={{ overflow: 'hidden', borderLeftWidth: 2, borderLeftColor: y.open ? C.gold : 'transparent' }}>
              <Pressable onPress={y.pick} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 14, paddingHorizontal: 16, minHeight: 44 }}>
                <Tx w={700} s={13} style={{ flex: 1 }}>{y.label}</Tx>
                <Amt s={14} c={y.color}>{y.total}</Amt>
                <View style={{ transform: [{ rotate: y.open ? '90deg' : '0deg' }] }}>
                  <ChevronRight s={12} c={C.muted} />
                </View>
              </Pressable>
              {y.open && (
                <Fade duration={200} style={{ borderTopWidth: 1, borderColor: C.hairline, paddingTop: 4, paddingHorizontal: 16, paddingBottom: 10 }}>
                  {y.rows.map(ym => (
                    <View key={ym.m} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', paddingVertical: 8, borderBottomWidth: 1, borderColor: 'rgba(55,88,79,0.08)' }}>
                      <Tx s={12} c={C.muted}>{ym.m}</Tx>
                      <Amt s={12} c={ym.color}>{ym.v}</Amt>
                    </View>
                  ))}
                </Fade>
              )}
            </Card>
          ))}
        </Fade>
      )}
      <Tx s={11} c={C.gray} style={{ marginTop: 12, marginLeft: 2 }}>As of 14 Jul 2026 · Net of fees</Tx>
    </>
  );
}

export function PortfolioCream({ V }) {
  return (
    <Fade>
      <Card big style={{ marginTop: -34, padding: 16, flexDirection: 'row' }}>
        {[['XIRR (SI)', '+24.3%'], ['1Y RETURN', '+21.4%'], ['CURRENT DD', '−2.1%', true], ['EXCESS (SI)', '+8.5%']].map(([k, v, dd]) => (
          <View key={k} style={{ flex: 1 }}>
            <Tx w={700} s={9.5} ls={0.1} c={C.muted}>{k}</Tx>
            <Amt s={13.5} c={dd ? C.red : C.green} noHide style={{ marginTop: 5 }}>{v}</Amt>
          </View>
        ))}
      </Card>
      <RangeRow ranges={V.ranges} style={{ marginTop: 16 }} />
      <DetailedMetrics V={V} />
      <ProfitLoss V={V} />
    </Fade>
  );
}

export function HoldingsCream({ V }) {
  return (
    <Fade>
      <Card big style={{ marginTop: -34, paddingVertical: 18, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 18 }}>
        <Donut slices={HOLD.map(h => ({ pct: h.alloc, color: h.color }))} />
        <View style={{ flex: 1, gap: 8 }}>
          {HOLD.map(h => (
            <View key={h.name} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: h.color }} />
              <Tx s={12} style={{ flex: 1 }}>{h.name.replace('Qode ', '')}</Tx>
              <Amt s={12} noHide>{h.alloc}%</Amt>
            </View>
          ))}
        </View>
      </Card>
      <View style={{ gap: 12, marginTop: 16 }}>
        {V.holdings.map(h => (
          <Card key={h.name} style={{ paddingTop: 15, paddingHorizontal: 16, paddingBottom: 13, borderLeftWidth: 3, borderLeftColor: h.color }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <Tx w={700} s={14}>{h.name}</Tx>
              <Amt s={12} c={C.muted} noHide>{h.alloc}</Amt>
            </View>
            <Tx s={11} c={C.muted} style={{ marginTop: 2 }}>{h.tag}</Tx>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 11 }}>
              <Amt s={18}>{h.value}</Amt>
              <Amt s={12} c={C.green} noHide>{h.gain}</Amt>
            </View>
            {h.hasM && (
              <View style={{ flexDirection: 'row', gap: 22, marginTop: 10, paddingTop: 9, borderTopWidth: 1, borderColor: C.hairline }}>
                <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 3 }}>
                  <Tx s={10} ls={0.08} c={C.muted}>XIRR</Tx><Amt s={12} c={C.green} noHide>{h.xirr}</Amt>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 3 }}>
                  <Tx s={10} ls={0.08} c={C.muted}>MAX DD</Tx><Amt s={12} c={C.red} noHide>{h.mdd}</Amt>
                </View>
              </View>
            )}
          </Card>
        ))}
      </View>
      <Label>CAPITAL FLOWS</Label>
      <Grid2>
        {V.flows.map(f => (
          <Card key={f.label} style={{ width: '48%', paddingVertical: 13, paddingHorizontal: 14 }}>
            <Tx w={700} s={10.5} ls={0.12} c={C.muted}>{f.label}</Tx>
            <Amt s={15} c={f.color} style={{ marginTop: 6 }}>{f.value}</Amt>
          </Card>
        ))}
      </Grid2>
      <Tx s={11} c={C.gray} style={{ marginTop: 10, marginLeft: 2 }}>As of 14 Jul 2026 · Since inception</Tx>
    </Fade>
  );
}

export function DocsCream({ V }) {
  const { z } = useUI();
  return (
    <Fade>
      <Card big style={{ marginTop: -34, padding: 16 }}>
        <Tx w={700} s={11} ls={0.12} c={C.muted}>FREQUENTLY USED</Tx>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', rowGap: 10, justifyContent: 'space-between', marginTop: 12 }}>
          {V.docQuick.map(qd => (
            <Pressable key={qd.name} style={{ width: '48%', borderWidth: 1, borderColor: 'rgba(55,88,79,0.2)', borderRadius: 8, padding: 12 }}>
              <GoldDocIcon />
              <Tx w={700} s={12.5} lh={1.3} style={{ marginTop: 9 }}>{qd.name}</Tx>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 7 }}>
                <Amt s={11} w={400} c={C.muted} noHide>{qd.sub}</Amt>
                <Download s={14} c={C.green} />
              </View>
            </Pressable>
          ))}
        </View>
      </Card>
      <Label style={{ marginTop: 20, marginBottom: 0 }}>ALL DOCUMENTS</Label>
      <View style={{
        flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.card,
        borderWidth: 1, borderColor: 'rgba(55,88,79,0.2)', borderRadius: 999, paddingHorizontal: 16, height: 44, marginTop: 10,
      }}>
        <Search />
        <TextInput
          value={V.docQ} onChangeText={V.onDocQ} placeholder="Search documents…" placeholderTextColor={C.gray}
          style={{ flex: 1, fontFamily: 'Lato_400Regular', fontSize: 14 * z, color: C.ink, minWidth: 0, paddingVertical: 0 }}
        />
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 12 }} contentContainerStyle={{ gap: 8, paddingBottom: 2 }}>
        {V.docPills.map(dp => (
          <Pressable key={dp.label} onPress={dp.pick} style={{
            paddingVertical: 8, paddingHorizontal: 14, borderRadius: 999, minHeight: 32, borderWidth: 1,
            backgroundColor: dp.active ? C.green : 'transparent',
            borderColor: dp.active ? C.green : C.mutedBorder,
          }}>
            <Tx w={700} s={11} ls={0.04} c={dp.active ? C.gold : C.muted}>{dp.label}</Tx>
          </Pressable>
        ))}
      </ScrollView>
      {V.docGroups.map(g => (
        <View key={g.title}>
          <Tx w={700} s={11} ls={0.12} c={C.muted} style={{ marginTop: 18, marginBottom: 8, marginLeft: 2 }}>{g.title}</Tx>
          <Card style={{ overflow: 'hidden' }}>
            {g.items.map((d, i) => (
              <Pressable key={d.name} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13, paddingHorizontal: 16, minHeight: 44, borderBottomWidth: i < g.items.length - 1 ? 1 : 0, borderColor: C.hairline }}>
                <View style={{ width: 36, height: 36, borderRadius: 8, backgroundColor: 'rgba(2,66,43,0.08)', alignItems: 'center', justifyContent: 'center' }}>
                  <DocIcon s={16} c={C.green} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Tx w={700} s={13}>{d.name}</Tx>
                  <Amt s={11} w={400} c={C.muted} noHide style={{ marginTop: 3 }}>{d.meta}</Amt>
                </View>
                <Download />
              </Pressable>
            ))}
          </Card>
        </View>
      ))}
      {V.docEmpty && (
        <View style={{ alignItems: 'center', paddingTop: 30, paddingHorizontal: 24, paddingBottom: 10 }}>
          <Tx s={13} c={C.muted} lh={1.6} center>{V.docEmptyMsg}</Tx>
        </View>
      )}
    </Fade>
  );
}

export function ServicesCream({ V }) {
  return (
    <Fade>
      <View style={{ flexDirection: 'row', gap: 10, marginTop: -34 }}>
        {[
          { icon: <Plus s={18} />, label: 'Add Funds', onPress: V.openAdd, primary: true },
          { icon: <ArrowDown s={18} />, label: 'Withdraw', onPress: V.openWithdraw },
        ].map(a => (
          <Pressable key={a.label} onPress={a.onPress} style={{ flex: 1 }}>
            <Card big style={{ paddingVertical: 16, paddingHorizontal: 12, alignItems: 'center' }}>
              <View style={{
                width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center',
                backgroundColor: a.primary ? C.green : C.card, borderWidth: a.primary ? 0 : 1, borderColor: C.greenBorder,
              }}>{a.icon}</View>
              <Tx w={700} s={12} center style={{ marginTop: 10 }}>{a.label}</Tx>
            </Card>
          </Pressable>
        ))}
      </View>
      <Label>ALL TRANSACTIONS</Label>
      <Card style={{ overflow: 'hidden' }}>
        {V.txAll.map((t, i) => <TxRow key={i} t={t} last={i === V.txAll.length - 1} status />)}
      </Card>
      <Tx s={11} c={C.gray} style={{ marginTop: 14, marginLeft: 2 }}>As of 14 Jul 2026</Tx>
    </Fade>
  );
}

export function MoreCream({ V }) {
  return (
    <Fade>
      <Card big style={{ marginTop: -34, paddingVertical: 16, paddingHorizontal: 18 }}>
        <Tx w={700} s={11} ls={0.12} c={C.muted}>YOUR RELATIONSHIP MANAGER</Tx>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 12 }}>
          <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(2,66,43,0.12)', borderWidth: 1, borderColor: 'rgba(2,66,43,0.2)', alignItems: 'center', justifyContent: 'center' }}>
            <Tx w={700} s={13} c={C.green}>AK</Tx>
          </View>
          <View style={{ flex: 1 }}>
            <Tx w={700} s={13}>Aditya Kulkarni</Tx>
            <Tx s={11} c={C.muted} style={{ marginTop: 2 }}>Mon–Fri, 9 AM – 6 PM IST</Tx>
          </View>
          <Pressable style={{ width: 42, height: 42, borderRadius: 21, borderWidth: 1, borderColor: C.greenBorder, alignItems: 'center', justifyContent: 'center' }}>
            <Phone />
          </Pressable>
          <Pressable style={{ width: 42, height: 42, borderRadius: 21, borderWidth: 1, borderColor: C.greenBorder, alignItems: 'center', justifyContent: 'center' }}>
            <MailIcon />
          </Pressable>
        </View>
      </Card>
      <Card style={{ paddingVertical: 6, paddingHorizontal: 18, marginTop: 14 }}>
        {[['PAN', '••••••382F'], ['Registered bank', 'HDFC ••4021'], ['Nominee', 'Anjali Mehta']].map(([k, v], i) => (
          <View key={k} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: i < 2 ? 1 : 0, borderColor: C.hairline }}>
            <Tx s={12} c={C.muted}>{k}</Tx>
            <Tx w={700} s={12}>{v}</Tx>
          </View>
        ))}
      </Card>
      <Card style={{ overflow: 'hidden', marginTop: 14 }}>
        {V.moreItems.map((mi, i) => (
          <Pressable key={mi.title} onPress={mi.pick}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 16, minHeight: 44, borderBottomWidth: i < V.moreItems.length - 1 ? 1 : 0, borderColor: C.hairline }}>
            <Tx w={700} s={13} style={{ flex: 1 }}>{mi.title}</Tx>
            <ChevronRight />
          </Pressable>
        ))}
      </Card>
      <Pressable onPress={V.doLogout} style={{ padding: 12, marginTop: 18 }}>
        <Tx w={700} s={13} c={C.red} center>Sign out</Tx>
      </Pressable>
      <Tx s={10.5} c={C.gray} lh={1.6} center style={{ marginTop: 4 }}>
        myQode v2.4.1{'\n'}Qode Advisors LLP · SEBI Registered PMS · INP000007520
      </Tx>
    </Fade>
  );
}
