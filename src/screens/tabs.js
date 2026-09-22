// Cream-zone content for each tab of the main app (Curtain v2).
import React from 'react';
import { View, Pressable, ScrollView, TextInput } from 'react-native';
import { C, Tx, Amt, Card, Chip, ChipRow, Fade, Skel, useUI } from '../ui';
import { Plus, ArrowDown, Swap, DocIcon, Bars, Download, ChevronRight, Phone, MailIcon, Search, InfoCircle, GoldDocIcon } from '../icons';
import { NavChart, DrawdownChart, Donut } from './charts';
import { UccNotice } from './ucc';

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
  // A range whose data is still on its way pulses; the charts keep showing the previous range meanwhile.
  return (
    <View style={[{ flexDirection: 'row', gap: 8 }, style]}>
      {ranges.map(r => <View key={r.label} style={{ flex: 1, opacity: r.loading ? 0.55 : 1 }}><Chip label={r.label} active={r.active} onPress={r.pick} flex py={7} /></View>)}
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
          <Tx w={700} s={11} ls={0.12} c={C.muted}>NAV PERFORMANCE</Tx>
          <Amt s={14}>{V.navNow}</Amt>
        </View>
        <View style={{ marginTop: 10 }}>
          <NavChart line={V.linePath} area={V.areaPath} bench={V.benchPath} tip={V.navTip} yTicks={V.yTicks} xDates={V.xDates} />
        </View>
        <RangeRow ranges={V.ranges} style={{ marginTop: 12 }} />
      </Card>
      <UccNotice visible={V.showUcc} onClose={V.dismissUcc} />
      <View style={{ flexDirection: 'row', gap: 10, marginTop: 20 }}>
        <Action icon={<Plus />} label="Add Funds" onPress={V.openAdd} primary />
        <Action icon={<Swap />} label="Switch" onPress={V.openSwitchStrategy} />
        <Action icon={<DocIcon />} label="Statement" onPress={V.goDocs} />
        <Action icon={<Bars />} label="Reports" onPress={V.goPortfolio} />
      </View>
      <Grid2 style={{ marginTop: 22 }}>
        {V.tiles.map(t => <Tile key={t.label} t={t} />)}
      </Grid2>
      <Tx s={11} c={C.gray} style={{ marginTop: 10, marginLeft: 2 }}>As of {V.asOf}</Tx>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 24, marginBottom: 10, marginHorizontal: 2 }}>
        <Tx w={700} s={11} ls={0.12} c={C.muted}>RECENT ACTIVITY</Tx>
        <Pressable onPress={V.goServices}><Tx w={700} s={12} c={C.green}>View all</Tx></Pressable>
      </View>
      <Card style={{ overflow: 'hidden' }}>
        {V.hasTx
          ? V.tx3.map((t, i) => <TxRow key={i} t={t} last={i === V.tx3.length - 1} />)
          : <Tx s={12} c={C.muted} style={{ padding: 16 }}>No contributions or withdrawals recorded yet.</Tx>}
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
            {V.trailing.map(tr => (
              <View key={tr.p} style={{ backgroundColor: C.cream, borderRadius: 8, paddingVertical: 12, paddingHorizontal: 14 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <Tx w={700} s={11} ls={0.12}>{tr.p}</Tx>
                  <Amt s={16} c={tr.neg ? C.red : C.pos}>{tr.pf}</Amt>
                </View>
                <View style={{ flexDirection: 'row', gap: 18, marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderColor: C.hairline }}>
                  <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
                    <Tx s={10.5} ls={0.06} c={C.muted}>{V.benchName.toUpperCase()}</Tx><Amt s={12}>{tr.n}</Amt>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
                    <Tx s={10.5} ls={0.06} c={C.muted}>EXCESS</Tx><Amt s={12} c={C.gold}>{tr.x}</Amt>
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
                <Amt s={14} c={rw.vc}>{rw.v}</Amt>
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
          {V.credItems.length > 0 && <Tx w={700} s={10} ls={0.12} c={C.muted} style={{ marginTop: 18 }}>CREDIBILITY METRICS</Tx>}
          <View style={{ gap: 8, marginTop: V.credItems.length ? 10 : 0 }}>
            {V.credItems.map(cm => (
              <Pressable key={cm.label} onPress={cm.pick} style={{ backgroundColor: C.cream, borderRadius: 8, paddingVertical: 12, paddingHorizontal: 14 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <Tx w={700} s={10.5} ls={0.1} c={C.muted} style={{ flex: 1 }}>{cm.label}</Tx>
                  <Amt s={14}>{cm.value}</Amt>
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
          <Tx s={11} c={C.gray} style={{ marginTop: 12 }}>As of {V.asOf} · NAV-based, net of fees</Tx>
        </Fade>
      )}
    </Card>
  );
}

// Profit & Loss: FY pills, monthly/quarterly toggle, All-Years accordion.
function ProfitLoss({ V }) {
  return (
    <>
      {V.hasPnl && <Tx w={700} s={11} ls={0.12} c={C.muted} style={{ marginTop: 24, marginLeft: 2 }}>PROFIT & LOSS</Tx>}
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
                  <Amt s={11} c={m.pcolor} style={{ marginTop: 2 }}>{m.p}</Amt>
                </View>
              </Card>
            ))}
          </View>
          <Card style={{ paddingVertical: 14, paddingHorizontal: 16, marginTop: 12, borderLeftWidth: 2, borderLeftColor: C.gold, flexDirection: 'row', alignItems: 'center' }}>
            <Tx w={700} s={11.5} ls={0.1} style={{ flex: 1 }}>{V.fyLabel} TOTAL</Tx>
            <View style={{ alignItems: 'flex-end' }}>
              <Amt s={15} c={V.fyColor}>{V.fyTotal}</Amt>
              {!!V.fyTotalPct && <Amt s={11} c={V.fyColor} style={{ marginTop: 2 }}>{V.fyTotalPct}</Amt>}
            </View>
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
      <Tx s={11} c={C.gray} style={{ marginTop: 12, marginLeft: 2 }}>As of {V.asOf} · Net of fees</Tx>
    </>
  );
}

export function PortfolioCream({ V }) {
  return (
    <Fade>
      <Card big style={{ marginTop: -34, padding: 16, flexDirection: 'row' }}>
        {V.perfHead.map(([k, v, col]) => (
          <View key={k} style={{ flex: 1 }}>
            <Tx w={700} s={9.5} ls={0.1} c={C.muted}>{k}</Tx>
            <Amt s={13.5} c={col} style={{ marginTop: 5 }}>{v}</Amt>
          </View>
        ))}
      </Card>
      <RangeRow ranges={V.ranges} style={{ marginTop: 16 }} />
      {V.hasDd && (
        <Card style={{ marginTop: 16, paddingTop: 16, paddingHorizontal: 16, paddingBottom: 14 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <Tx w={700} s={11} ls={0.12} c={C.muted}>DRAWDOWN</Tx>
            <Amt s={14} c={C.red}>{V.ddNow.toFixed(2)}%</Amt>
          </View>
          <View style={{ marginTop: 10 }}>
            <DrawdownChart line={V.ddLine} area={V.ddArea} bench={V.ddBench} tip={V.ddTip} />
          </View>
          <Tx s={11} c={C.muted} style={{ marginTop: 10 }}>Fall from the previous peak, over {V.rangeLabel}. Dashed line: {V.benchName}.</Tx>
        </Card>
      )}
      <DetailedMetrics V={V} />
      <ProfitLoss V={V} />
    </Fade>
  );
}

export function HoldingsCream({ V }) {
  return (
    <Fade>
      <Card big style={{ marginTop: -34, paddingVertical: 18, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 18 }}>
        <Donut slices={V.holdSlices} count={V.holdCount} />
        <View style={{ flex: 1, gap: 8 }}>
          {V.holdSlices.map(h => (
            <View key={h.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: h.color }} />
              <Tx s={12} style={{ flex: 1 }}>{h.name.replace('Qode ', '')}</Tx>
              <Amt s={12}>{h.pct}%</Amt>
            </View>
          ))}
        </View>
      </Card>
      <View style={{ gap: 12, marginTop: 16 }}>
        {V.holdings.map(h => (
          <Card key={h.id} style={{ paddingTop: 15, paddingHorizontal: 16, paddingBottom: 13, borderLeftWidth: 3, borderLeftColor: h.color }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <Tx w={700} s={14}>{h.name}</Tx>
              <Amt s={12} c={C.muted}>{h.alloc}%</Amt>
            </View>
            <Tx s={11} c={C.muted} style={{ marginTop: 2 }}>{h.tag}</Tx>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 11 }}>
              <Amt s={18}>{h.value}</Amt>
              <Amt s={12} c={h.retColor}>{h.gain}</Amt>
            </View>
            {h.hasM && (
              <View style={{ flexDirection: 'row', gap: 22, marginTop: 10, paddingTop: 9, borderTopWidth: 1, borderColor: C.hairline }}>
                <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 3 }}>
                  <Tx s={10} ls={0.08} c={C.muted}>RETURN</Tx><Amt s={12} c={h.retColor}>{h.ret}</Amt>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 3 }}>
                  <Tx s={10} ls={0.08} c={C.muted}>MAX DD</Tx><Amt s={12} c={C.red}>{h.mdd}</Amt>
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
      <Tx s={11} c={C.gray} style={{ marginTop: 10, marginLeft: 2 }}>As of {V.asOf} · Since inception</Tx>
    </Fade>
  );
}
