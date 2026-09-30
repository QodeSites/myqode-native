// Phone Holdings list: the securities the investor owns (stocks, ETFs, mutual funds, derivatives, cash) across the
// strategy accounts in the current scope (V.holdings), from portfolio.securities (GET /api/mobile/portfolio/securities).
// Summary card, sector bars, then every holding with its value, weight and gain. Account chips narrow it to one account.
import React, { useState, useEffect } from 'react';
import { View, Pressable } from 'react-native';
import { C, Tx, Amt, Card } from '../ui';
import { useLoad, Loading, ErrorBox, Empty, SectionLabel, AccountSelect } from './kit';
import { portfolio } from '../api';
import { inr, sinr, pct, fmtDate } from '../adapt';

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
  const bars = top.map((s, k) => ({ label: s.sector, w: s.weight, color: BARS[k % BARS.length] }))
    .concat(rest.length ? [{ label: 'Other sectors', w: rest.reduce((a, s) => a + s.weight, 0), color: C.mutedBorder }] : []);
  const shown = all ? items : items.slice(0, PAGE);

  return (
    <View>
      <AccountSelect value={codes.length === 1 && scope.length > 1 ? codes[0] : 'all'} onPick={id => { setAcct(id); setAll(false); }}
        options={scope.length > 1 ? [{ id: 'all', label: 'All accounts' }, ...accts.map(h => ({ id: h.id, label: short(h.name) + ' ' + h.id, dot: h.color }))] : []} />

      {err && !data ? <View style={{ marginTop: 14 }}><ErrorBox msg={err} onRetry={reload} /></View>
        : loading && !data ? <Loading rows={4} /> : !data ? null : (
        <View style={{ opacity: loading ? 0.55 : 1 }}>
          <Card style={{ marginTop: 14, paddingVertical: 16, paddingHorizontal: 16 }}>
            <Tx w={700} s={10.5} ls={0.12} c={C.muted} center>CURRENT VALUE</Tx>
            <Amt s={22} center style={{ marginTop: 6 }}>{inr(tot.value)}</Amt>
            {/* Three equal columns split by hairlines, each centred: label, figure, then the gain badge under the gain. */}
            <View style={{ flexDirection: 'row', marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderColor: C.hairline }}>
              <SumCol label="INVESTED">
                <Amt s={13} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>{inr(tot.invested, 0)}</Amt>
              </SumCol>
              <SumCol label="UNREALISED GAIN" divider>
                <Amt s={13} c={signCol(tot.gain)} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>{sinr(tot.gain, 0)}</Amt>
                {tot.gainPct != null && <GainBadge v={tot.gainPct} />}
              </SumCol>
              <SumCol label="HOLDINGS" divider>
                <Amt s={13}>{tot.count}</Amt>
              </SumCol>
            </View>
          </Card>

          {!!bars.length && (
            <>
              <SectionLabel>BY SECTOR</SectionLabel>
              <Card style={{ paddingVertical: 14, paddingHorizontal: 16, gap: 11 }}>
                {bars.map((b, k) => (
                  <View key={b.label + ':' + k}>
                    <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
                      <Tx s={12} numberOfLines={1} style={{ flex: 1 }}>{b.label}</Tx>
                      <Amt s={12}>{b.w.toFixed(2)}%</Amt>
                    </View>
                    <View style={{ height: 5, borderRadius: 3, backgroundColor: C.hairline, marginTop: 5, overflow: 'hidden' }}>
                      <View style={{ width: Math.max(1.5, Math.min(100, b.w)) + '%', height: 5, borderRadius: 3, backgroundColor: b.color }} />
                    </View>
                  </View>
                ))}
              </Card>
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
                    <Amt s={13}>{inr(i.value, 0)}</Amt>
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
