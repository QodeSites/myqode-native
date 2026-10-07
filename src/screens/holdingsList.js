// Phone Holdings list: the securities the investor owns (stocks, ETFs, mutual funds, derivatives, cash) across the
// strategy accounts in the current scope (V.holdings), from portfolio.securities (GET /api/mobile/portfolio/securities).
// Summary card, sector bars, then every holding with its value, weight and gain. Account chips narrow it to one account.
import React, { useState, useEffect } from 'react';
import { View, Pressable } from 'react-native';
import { C, Tx, Amt, Card } from '../ui';
import { useLoad, Loading, ErrorBox, Empty, SectionLabel, AccountSelect } from './kit';
import { portfolio } from '../api';
import { inr, sinr, pct, fmtDate } from '../adapt';
import { Donut } from './charts';
import { titleCase } from '../titleCase';

const signCol = v => (v == null || v === 0 ? C.muted : v < 0 ? C.red : C.pos);
const BARS = ['#02422B', '#DABD38', '#2F6F5E', '#8A700C', '#5B8A7A', '#B89A2E'];
const PAGE = 30;
const short = name => String(name || '');   // full strategy names ("Qode All Weather"), everywhere

function SumCol({ label, divider, children }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', paddingHorizontal: 6, borderLeftWidth: divider ? 1 : 0, borderColor: C.hairline }}>
      <Tx w={700} s={9.5} ls={0.1} c={C.muted} center numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>{label}</Tx>
      <View style={{ marginTop: 5, alignItems: 'center' }}>{children}</View>
    </View>
  );
}

// The web's change badge (src/web/kit.js Delta): the percentage on a green / red tint, neutral at zero.
function GainBadge({ v }) {
  const r = Math.round(v * 100);
  const fg = r === 0 ? C.muted : r < 0 ? C.red : C.pos, bg = r === 0 ? C.hairline : r < 0 ? 'rgba(194,54,47,0.10)' : 'rgba(21,128,61,0.11)';
  return (
    <View style={{ marginTop: 5, backgroundColor: bg, borderRadius: 6, paddingVertical: 2, paddingHorizontal: 7 }}>
      <Amt s={11} w={700} c={fg}>{pct(v)}</Amt>
    </View>
  );
}

// As the web Portfolio page's picker: All accounts (combined value), then each account with its strategy colour, code,
// value and share, grouped under the family member who holds it when there is more than one.
function acctOptions(accts) {
  const owners = [...new Set(accts.map(h => h.owner || ''))];
  const grouped = owners.length > 1;
  const total = accts.reduce((t, h) => t + (h.raw || 0), 0);
  const one = h => ({ id: h.id, label: short(h.name), sub: h.id, dot: h.color, right: h.value, rightSub: h.alloc + '%', group: grouped ? h.owner || 'Other accounts' : undefined });
  return [
    { id: 'all', label: 'All accounts', sub: grouped ? 'Combined across the family' : accts.length + ' accounts combined', right: total ? inr(total) : undefined },
    ...(grouped ? owners.flatMap(o => accts.filter(h => (h.owner || '') === o).map(one)) : accts.map(one)),
  ];
}

// A donut of the shares, then its legend: colour, name (value under it) and share (the web's DonutLegend).
function DonutCard({ items, count, label }) {
  return (
    <Card style={{ paddingVertical: 16, paddingHorizontal: 16 }}>
      <View style={{ alignItems: 'center' }}>
        <Donut slices={items.map(b => ({ pct: Number(b.w) || 0, color: b.color }))} count={count} label={label} size={132} />
      </View>
      <View style={{ gap: 10, marginTop: 14 }}>
        {items.map((b, k) => (
          <View key={b.label + ':' + k} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
            <View style={{ width: 9, height: 9, borderRadius: 2, backgroundColor: b.color, marginTop: 4 }} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Tx w={700} s={12.5} numberOfLines={1}>{b.label}{b.sub ? <Tx s={11} c={C.muted}>{'  ' + b.sub}</Tx> : null}</Tx>
              {b.value != null && <Amt s={11} c={C.muted}>{inr(b.value)}</Amt>}
            </View>
            <Amt w={700} s={12.5}>{(Number(b.w) || 0).toFixed(2)}%</Amt>
          </View>
        ))}
      </View>
    </Card>
  );
}

export function HoldingsList({ V }) {
  const accts = V.holdings || [];
  const scope = accts.map(h => h.id);
  const [acct, setAcct] = useState('all');
  const [all, setAll] = useState(false);
  useEffect(() => { if (acct !== 'all' && !scope.includes(acct)) setAcct('all'); }, [scope.join(',')]);   // eslint-disable-line react-hooks/exhaustive-deps
  const codes = acct === 'all' || !scope.includes(acct) ? scope : [acct];
  const key = codes.join(',');
  const { loading, data, err, reload } = useLoad(() => (key ? portfolio.securities(codes) : null), [key]);

  if (!accts.length) return <Empty>There are no active strategy accounts in this view.</Empty>;

  const tot = data && data.totals;
  const items = (data && data.items) || [];
  const sectors = (data && data.sectors) || [];
  const top = sectors.slice(0, 6), rest = sectors.slice(6);
  const bars = top.map((s, k) => ({ label: titleCase(s.sector), w: s.weight, value: s.value, color: BARS[k % BARS.length] }))
    .concat(rest.length ? [{ label: 'Other Sectors', sub: rest.length + ' more', w: rest.reduce((a, s) => a + s.weight, 0), value: rest.reduce((a, s) => a + s.value, 0), color: C.mutedBorder }] : []);
  const CLASS_COLOR = { Stocks: '#02422B', ETFs: '#2F6F5E', 'Mutual funds': '#DABD38', Derivatives: '#8A700C', Cash: '#86918B' };
  const classes = ((data && data.assetClasses) || []).map(a => ({ label: titleCase(a.assetClass), w: a.weight, value: a.value, color: CLASS_COLOR[a.assetClass] || C.green }));
  const shown = all ? items : items.slice(0, PAGE);

  return (
    <View>
      <AccountSelect value={codes.length === 1 && scope.length > 1 ? codes[0] : 'all'} onPick={id => { setAcct(id); setAll(false); }}
        options={scope.length > 1 ? acctOptions(accts) : []} />

      {err && !data ? <View style={{ marginTop: 14 }}><ErrorBox msg={err} onRetry={reload} /></View>
        : loading && !data ? <Loading rows={4} /> : !data ? null : (
        <View style={{ opacity: loading ? 0.55 : 1 }}>
          <Card style={{ marginTop: 14, paddingVertical: 16, paddingHorizontal: 16 }}>
            <Tx w={700} s={10.5} ls={0.12} c={C.muted} center>CURRENT VALUE</Tx>
            <Amt s={22} center style={{ marginTop: 6 }}>{inr(tot.value)}</Amt>
            {/* Three equal columns split by hairlines, each centred: label, figure, then the gain badge under the gain. */}
            <View style={{ flexDirection: 'row', marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderColor: C.hairline }}>
              <SumCol label="INVESTED">
                <Amt s={13} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>{inr(tot.invested)}</Amt>
              </SumCol>
              <SumCol label="UNREALISED GAIN" divider>
                <Amt s={13} c={signCol(tot.gain)} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>{sinr(tot.gain)}</Amt>
                {tot.gainPct != null && <GainBadge v={tot.gainPct} />}
              </SumCol>
              <SumCol label="HOLDINGS" divider>
                <Amt s={13}>{tot.count}</Amt>
              </SumCol>
            </View>
          </Card>

          {!!bars.length && (
            <>
              <SectionLabel>SECTOR ALLOCATION</SectionLabel>
              <DonutCard items={bars} count={sectors.length} label={sectors.length === 1 ? 'SECTOR' : 'SECTORS'} />
            </>
          )}
          {!!classes.length && (
            <>
              <SectionLabel>ASSET CLASS</SectionLabel>
              <DonutCard items={classes} count={classes.length} label={classes.length === 1 ? 'CLASS' : 'CLASSES'} />
            </>
          )}

          <SectionLabel>HOLDINGS · {items.length}</SectionLabel>
          {!items.length ? <Empty>Nothing is held in {codes.length === 1 ? 'this account' : 'these accounts'} on the latest holdings date.</Empty> : (
            <Card>
              {shown.map((i, k) => (
                <View key={i.security + k} style={{ flexDirection: 'row', gap: 12, paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: k === shown.length - 1 && items.length <= PAGE ? 0 : 1, borderColor: C.hairline }}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Tx w={700} s={13} numberOfLines={1}>{i.security}</Tx>
                    <Tx s={11} c={C.muted} numberOfLines={1} style={{ marginTop: 2 }}>
                      {[i.sector, i.qty != null ? Number(i.qty).toLocaleString('en-IN', { maximumFractionDigits: 3 }) + ' units' : null].filter(Boolean).join(' · ')}
                    </Tx>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Amt s={13}>{inr(i.value)}</Amt>
                    <View style={{ flexDirection: 'row', gap: 8, marginTop: 2 }}>
                      {i.gainPct != null && <Amt s={11} c={signCol(i.gainPct)}>{pct(i.gainPct)}</Amt>}
                      <Amt s={11} c={C.muted}>{i.weight.toFixed(2)}%</Amt>
                    </View>
                  </View>
                </View>
              ))}
              {items.length > PAGE && (
                <Pressable onPress={() => setAll(a => !a)} accessibilityRole="button" style={{ paddingVertical: 13, alignItems: 'center' }}>
                  <Tx w={700} s={12} c={C.green}>{all ? 'Show fewer' : 'Show all ' + items.length}</Tx>
                </Pressable>
              )}
            </Card>
          )}
          {!!data.asOf && <Tx s={11} c={C.gray} style={{ marginTop: 10, marginLeft: 2 }}>Holdings as of {fmtDate(data.asOf)} · Gain is on the cost of current holdings</Tx>}
        </View>
      )}
    </View>
  );
}
export default HoldingsList;
