// Phone Holdings list: the securities the investor owns (stocks, ETFs, mutual funds, derivatives, cash) across the
// strategy accounts in the current scope (V.holdings), from portfolio.securities (GET /api/mobile/portfolio/securities).
// Summary card, sector bars, then every holding with its value, weight and gain. Account chips narrow it to one account.
import React, { useState, useEffect } from 'react';
import { View, Pressable } from 'react-native';
import { C, Tx, Amt, Card } from '../ui';
import { useLoad, Loading, ErrorBox, Empty, SectionLabel, AccountChips } from './kit';
import { portfolio } from '../api';
import { inr, sinr, pct, fmtDate } from '../adapt';

const signCol = v => (v == null || v === 0 ? C.muted : v < 0 ? C.red : C.pos);
const BARS = ['#02422B', '#DABD38', '#2F6F5E', '#8A700C', '#5B8A7A', '#B89A2E'];
const PAGE = 30;
const short = name => String(name || '');   // full strategy names ("Qode All Weather"), everywhere

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
      <AccountChips value={codes.length === 1 && scope.length > 1 ? codes[0] : 'all'} onPick={id => { setAcct(id); setAll(false); }}
        options={scope.length > 1 ? [{ id: 'all', label: 'All accounts' }, ...accts.map(h => ({ id: h.id, label: short(h.name) + ' ' + h.id }))] : []} />

      {err && !data ? <View style={{ marginTop: 14 }}><ErrorBox msg={err} onRetry={reload} /></View>
        : loading && !data ? <Loading rows={4} /> : !data ? null : (
        <View style={{ opacity: loading ? 0.55 : 1 }}>
          <Card style={{ marginTop: 14, paddingVertical: 16, paddingHorizontal: 16 }}>
            <Tx w={700} s={10.5} ls={0.12} c={C.muted}>CURRENT VALUE</Tx>
            <Amt s={22} style={{ marginTop: 6 }}>{inr(tot.value)}</Amt>
            <View style={{ flexDirection: 'row', marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderColor: C.hairline }}>
              <View style={{ flex: 1 }}>
                <Tx w={700} s={9.5} ls={0.1} c={C.muted}>INVESTED</Tx>
                <Amt s={13} style={{ marginTop: 4 }}>{inr(tot.invested, 0)}</Amt>
              </View>
              <View style={{ flex: 1.2 }}>
                <Tx w={700} s={9.5} ls={0.1} c={C.muted}>UNREALISED GAIN</Tx>
                <Amt s={13} c={signCol(tot.gain)} style={{ marginTop: 4 }}>{sinr(tot.gain, 0)}</Amt>
                {tot.gainPct != null && <Amt s={11} c={signCol(tot.gainPct)}>{pct(tot.gainPct)}</Amt>}
              </View>
              <View style={{ flex: 0.7, alignItems: 'flex-end' }}>
                <Tx w={700} s={9.5} ls={0.1} c={C.muted}>HOLDINGS</Tx>
                <Amt s={13} style={{ marginTop: 4 }}>{tot.count}</Amt>
              </View>
            </View>
          </Card>

          {!!bars.length && (
            <>
              <SectionLabel>BY SECTOR</SectionLabel>
              <Card style={{ paddingVertical: 14, paddingHorizontal: 16, gap: 11 }}>
                {bars.map(b => (
                  <View key={b.label}>
                    <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
                      <Tx s={12} numberOfLines={1} style={{ flex: 1 }}>{b.label}</Tx>
                      <Amt s={12}>{b.w.toFixed(1)}%</Amt>
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
                      <Amt s={11} c={C.muted}>{i.weight.toFixed(1)}%</Amt>
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
