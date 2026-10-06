// Cream-zone content for each tab of the main app (Curtain v2).
import React from 'react';
import { View, Pressable, ScrollView, TextInput } from 'react-native';
import { C, Tx, Amt, Card, Chip, ChipRow, Fade, Skel, useUI } from '../ui';
import { ddPct } from '../adapt';
import { ArrowDown, Download, ChevronRight, Phone, MailIcon, Search, InfoCircle, GoldDocIcon } from '../icons';
import { NavChart, DrawdownChart, Donut } from './charts';
import { UccNotice } from './ucc';
import HoldingsList from './holdingsList';
import { PushOfferCard } from './notifications';
import { PendingRows } from './services';

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

export function RangeRow({ ranges, style }) {
  // A range whose data is still on its way pulses; the charts keep showing the previous range meanwhile.
  return (
    // Seven windows (1W to SI) share one row: tighter gaps and a smaller label so they fit a 320pt-wide phone.
    <View style={[{ flexDirection: 'row', gap: 4 }, style]}>
      {ranges.map(r => <View key={r.label} style={{ flex: 1, minWidth: 0, opacity: r.loading ? 0.55 : 1 }}><Chip label={r.label} active={r.active} disabled={r.disabled} onPress={r.pick} flex py={6} s={10.5} /></View>)}
    </View>
  );
}

export function Tile({ t }) {
  return (
    <Card style={{ width: '48%', paddingVertical: 13, paddingHorizontal: 14 }}>
      <Tx w={700} s={10.5} ls={0.12} c={C.muted}>{t.label}</Tx>
      {/* one line always: crores with paise (−₹1,30,48,459.27) wrapped in a half-width tile; long figures start smaller
          and shrink to fit on the phone (the web has no shrink-to-fit, so the smaller start covers it there) */}
      <Amt s={String(t.value || '').length > 13 ? 14 : 16} c={t.color} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6} style={{ marginTop: 6 }}>{t.value}</Amt>
    </Card>
  );
}

export function TxRow({ t, last, status }) {
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

// A closed account on screen (fully withdrawn): one muted line saying when, so ₹0 / a few rupees never looks like a loss.
export function ClosedNote({ text, style }) {
  if (!text) return null;
  return (
    <View style={[{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(55,88,79,0.08)', borderRadius: 8, paddingVertical: 8, paddingHorizontal: 10 }, style]}>
      <View style={{ borderWidth: 1, borderColor: C.mutedBorder35, borderRadius: 4, paddingVertical: 1, paddingHorizontal: 5 }}>
        <Tx w={700} s={8} ls={0.06} c={C.muted}>CLOSED</Tx>
      </View>
      <Tx s={11.5} c={C.ink} lh={1.4} style={{ flex: 1 }}>{text}</Tx>
    </View>
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
        <ClosedNote text={V.closedNote} style={{ marginBottom: 12 }} />
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <Tx w={700} s={11} ls={0.12} c={C.muted}>NAV PERFORMANCE</Tx>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 5 }}>
            <Tx s={10.5} c={C.muted}>Current NAV</Tx>
            <Amt s={14}>{V.navNow}</Amt>
          </View>
        </View>
        <View style={{ marginTop: 10 }}>
          <NavChart line={V.linePath} area={V.areaPath} bench={V.benchPath} tip={V.navTip} yTicks={V.yTicks} xDates={V.xDates} color={V.chartColor} />
        </View>
        {/* Legend: which line is which (same colours as the chart) */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginTop: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={{ width: 14, height: 2.5, borderRadius: 2, backgroundColor: V.chartColor || C.green }} />
            <Tx s={10.5} c={C.muted}>Your portfolio</Tx>
          </View>
          {V.hasBench && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <View style={{ width: 14, height: 1.5, borderRadius: 1, backgroundColor: C.gray }} />
              <Tx s={10.5} c={C.muted}>{V.benchName}</Tx>
            </View>
          )}
        </View>
        <RangeRow ranges={V.ranges} style={{ marginTop: 12 }} />
      </Card>
      <UccNotice visible={V.showUcc} onClose={V.dismissUcc} />
      <PushOfferCard V={V} />
      <Grid2 style={{ marginTop: 22 }}>
        {V.tiles.map(t => <Tile key={t.label} t={t} />)}
      </Grid2>
      <Tx s={11} c={C.gray} style={{ marginTop: 10, marginLeft: 2 }}>As of {V.asOf}</Tx>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 24, marginBottom: 10, marginHorizontal: 2 }}>
        <Tx w={700} s={11} ls={0.12} c={C.muted}>TRANSACTIONS</Tx>
        <Pressable onPress={V.goServicesTx}><Tx w={700} s={12} c={C.green}>View all</Tx></Pressable>
      </View>
      <PendingRows V={V} />
      <Card style={{ overflow: 'hidden' }}>
        {V.hasTx
          ? V.tx3.map((t, i) => <TxRow key={i} t={t} last={i === V.tx3.length - 1} />)
          : <Tx s={12} c={C.muted} style={{ padding: 16 }}>No transactions recorded yet.</Tx>}
      </Card>
    </Fade>
  );
}

// Collapsible "Detailed metrics" card: trailing returns, risk & return detail,
// capital flows, tap-to-explain credibility metrics.
export function DetailedMetrics({ V }) {
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
          {V.orbisNote && <Tx s={11} c={C.gray} lh={1.5} style={{ marginTop: 6 }}><Tx w={700} s={11} c={C.gray}>Orbis data:</Tx> figures run to the last day before Nuvama took over. Money in and out comes from the capital recorded by Orbis; returns are measured from the Orbis starting NAV of 100.</Tx>}
        </Fade>
      )}
    </Card>
  );
}

// Profit & Loss: FY pills, monthly/quarterly toggle, All-Years accordion.
export function ProfitLoss({ V }) {
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
      {/* Web's Data Source View (only for an account with Orbis rows): Nuvama · Orbis (Legacy) · Orbis + Nuvama.
          A solid segmented bar on the cream, so it is not part of the header's scroll parallax and never drifts. */}
      {V.hasViews && (
        <View style={{ marginTop: -34, marginBottom: 12, flexDirection: 'row', backgroundColor: '#fff', borderRadius: 999, padding: 4,
          shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2 }}>
          {V.viewChips.map(ch => (
            <Pressable key={ch.label} onPress={ch.pick} accessibilityRole="button" accessibilityState={{ selected: ch.active }}
              style={{ flex: 1, paddingVertical: 9, paddingHorizontal: 4, borderRadius: 999, alignItems: 'center', justifyContent: 'center', backgroundColor: ch.active ? C.green : 'transparent' }}>
              <Tx w={700} s={10.5} c={ch.active ? C.gold : C.muted} center numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>{ch.label}</Tx>
            </Pressable>
          ))}
        </View>
      )}
      <Card big style={{ marginTop: V.hasViews ? 0 : -34, padding: 16, flexDirection: 'row' }}>
        {V.perfHead.map(([k, v, col]) => (
          <View key={k} style={{ flex: 1, alignItems: 'center' }}>
            <Tx w={700} s={9.5} ls={0.1} c={C.muted} center>{k}</Tx>
            <Amt s={13.5} c={col} center style={{ marginTop: 5 }}>{v}</Amt>
          </View>
        ))}
      </Card>
      <ClosedNote text={V.closedNote} style={{ marginTop: 12 }} />
      <RangeRow ranges={V.ranges} style={{ marginTop: 16 }} />
      {V.hasDd && (
        <Card style={{ marginTop: 16, paddingTop: 16, paddingHorizontal: 16, paddingBottom: 14 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <Tx w={700} s={11} ls={0.12} c={C.muted}>DRAWDOWN</Tx>
            <Amt s={14} c={Math.abs(V.ddNow) >= 0.005 ? C.red : C.muted}>{ddPct(V.ddNow)}</Amt>
          </View>
          <View style={{ marginTop: 10 }}>
            <DrawdownChart line={V.ddLine} area={V.ddArea} bench={V.ddBench} tip={V.ddTip} />
          </View>
          <Tx s={11} c={C.muted} style={{ marginTop: 10 }}>Fall from the previous peak, {V.rangePhrase}. Dashed line: {V.benchName}.</Tx>
        </Card>
      )}
      {!!(V.irrRows && V.irrRows.length) && (
        <Card style={{ marginTop: 16, paddingTop: 14, paddingHorizontal: 16, paddingBottom: 12 }}>
          <Tx w={700} s={11} ls={0.12} c={C.muted}>TWRR AND IRR</Tx>
          {V.irrRows.map(r => (
            <View key={r.period} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', paddingVertical: 8, borderBottomWidth: 1, borderColor: C.hairline }}>
              <Tx s={12} c={C.muted}>{r.period === 'SI' ? 'IRR since inception' : r.period + ' ' + r.label}</Tx>
              <Amt s={13.5} c={r.color}>{r.value}</Amt>
            </View>
          ))}
          <Tx s={11} c={C.muted} lh={1.5} style={{ marginTop: 8 }}>IRR (since inception) is money-weighted and shows the return on your capital, taking into account the timing of your investments and withdrawals. TWRR measures how the strategy performed, regardless of those cash flows.</Tx>
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
        <Donut slices={V.holdSlices} count={V.holdSlices.length} label={V.holdSlices.length === 1 ? 'STRATEGY' : 'STRATEGIES'} />
        <View style={{ flex: 1, gap: 8 }}>
          <Tx s={11} c={C.muted}>{V.holdCount} {V.holdCount === 1 ? 'account' : 'accounts'} across {V.holdSlices.length} {V.holdSlices.length === 1 ? 'strategy' : 'strategies'}</Tx>
          {V.holdSlices.map(h => (
            <View key={h.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: h.color }} />
              <View style={{ flex: 1 }}>
                <Tx s={12}>{h.name}</Tx>
                {h.n > 1 && <Tx s={10.5} c={C.muted}>{h.n} accounts</Tx>}
              </View>
              <Amt s={12}>{h.alloc}%</Amt>
            </View>
          ))}
        </View>
      </Card>
      {/* What the investor actually owns (securities), then the strategy accounts. */}
      <View style={{ marginTop: 16 }}><HoldingsList V={V} /></View>
      <Label>BY STRATEGY ACCOUNT</Label>
      <View style={{ gap: 12, marginTop: 4 }}>
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
