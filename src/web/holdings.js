// Web Holdings page: what the investor owns (stocks, ETFs, mutual funds, derivatives, cash) across the strategy
// accounts in the current scope, like a broker's holdings screen. Data: portfolio.securities (GET
// /api/mobile/portfolio/securities, myQode/lib/securities.ts), refetched when the scope or the account filter
// changes. The scope's accounts come from V.holdings ({ id, name, value, alloc, w, color, ret, retColor, mdd }).
// Built only from ./kit.
import React, { useState, useEffect, useMemo } from 'react';
import { View } from 'react-native';
import { C, Tx, Amt, Row, Panel, Stat, Chips, Table, BarList, Input, Btn, Loading, Empty, ErrorBlock } from './kit';
import { portfolio } from '../api';
import { inr, sinr, pct, fmtDate } from '../adapt';

import { userMessage } from '../errors';
const signCol = v => (v == null ? C.ink3 : v < 0 ? C.red : v > 0 ? C.pos : C.ink2);
const qtyFmt = v => (v == null ? '–' : Number(v).toLocaleString('en-IN', { maximumFractionDigits: 3 }));
const priceFmt = v => (v == null ? '–' : inr(v));
const short = name => String(name || '');   // full strategy names ("Qode Growth Fund"), as the owner asked
// Sector colours: brand green first, then muted tones that stay apart from each other.
const PALETTE = ['#02422B', '#DABD38', '#2F6F5E', '#8A700C', '#5B8A7A', '#B89A2E', '#4F5C56', '#86918B'];
const CLASS_COLOR = { Stocks: '#02422B', ETFs: '#2F6F5E', 'Mutual funds': '#DABD38', Derivatives: '#8A700C', Cash: '#86918B' };
const PAGE = 40;

// Holdings of `codes` (combined), reloaded when the codes change; stale replies are dropped.
function useSecurities(codes) {
  const key = codes.join(',');
  const [st, set] = useState({ loading: true, data: null, err: '' });
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!key) { set({ loading: false, data: null, err: '' }); return undefined; }
    let dead = false;
    set(s => ({ ...s, loading: true, err: '' }));
    portfolio.securities(codes)
      .then(d => { if (!dead) set({ loading: false, data: d, err: '' }); })
      .catch(e => { if (!dead) set({ loading: false, data: null, err: userMessage(e, 'Something went wrong.') }); });
    return () => { dead = true; };
  }, [key, tick]);   // eslint-disable-line react-hooks/exhaustive-deps
  return { ...st, reload: () => setTick(t => t + 1) };
}

const SORTS = [['value', 'Value'], ['gain', 'Gain'], ['gainPct', 'Return'], ['weight', 'Weight'], ['security', 'Name']];

export default function DesktopHoldings({ V }) {
  const accts = V.holdings || [];
  const scope = accts.map(h => h.id);
  const [acct, setAcct] = useState('all');
  const [q, setQ] = useState('');
  const [sort, setSort] = useState({ key: 'value', desc: true });
  const [all, setAll] = useState(false);
  // A new scope resets the account filter when the picked account is no longer in it.
  useEffect(() => { if (acct !== 'all' && !scope.includes(acct)) setAcct('all'); }, [scope.join(',')]);   // eslint-disable-line react-hooks/exhaustive-deps
  const codes = acct === 'all' || !scope.includes(acct) ? scope : [acct];
  const { loading, data, err, reload } = useSecurities(codes);

  const items = useMemo(() => {
    const list = (data && data.items) || [];
    const t = q.trim().toLowerCase();
    const hit = t ? list.filter(i => [i.security, i.symbol, i.sector, i.assetClass].some(s => s && String(s).toLowerCase().includes(t))) : list;
    const k = sort.key, dir = sort.desc ? -1 : 1;
    return [...hit].sort((a, b) => (k === 'security'
      ? dir * String(a.security).localeCompare(String(b.security), undefined, { sensitivity: 'base' })
      : dir * ((a[k] == null ? -Infinity : a[k]) - (b[k] == null ? -Infinity : b[k]))));
  }, [data, q, sort]);

  if (!accts.length) return <Empty title="No holdings to show">There are no active strategy accounts in this view.</Empty>;

  const tot = data && data.totals;
  const multi = codes.length > 1;
  const pickSort = k => setSort(s => (s.key === k ? { key: k, desc: !s.desc } : { key: k, desc: k !== 'security' }));

  const cols = [
    { key: 'security', label: 'Security', flex: 2.6, render: i => (
      <View style={{ minWidth: 0, alignSelf: 'stretch' }}>
        <Tx w={600} s={13} numberOfLines={1}>{i.security}</Tx>
        <Tx s={11.5} c={C.ink3} numberOfLines={1}>
          {[i.symbol && !/^\d+$/.test(i.symbol) ? i.symbol : null, i.sector, multi && i.accounts.length > 1 ? i.accounts.length + ' accounts' : null].filter(Boolean).join('  ·  ')}
        </Tx>
      </View>) },
    { key: 'qty', label: 'Qty', right: true, flex: 0.95, render: i => <Amt s={12.5} c={C.ink2}>{qtyFmt(i.qty)}</Amt> },
    { key: 'avgCost', label: 'Avg cost', right: true, flex: 1, render: i => <Amt s={12.5} c={C.ink2}>{priceFmt(i.avgCost)}</Amt> },
    { key: 'price', label: 'Price', right: true, flex: 1, render: i => <Amt s={12.5}>{priceFmt(i.price)}</Amt> },
    { key: 'value', label: 'Value', right: true, flex: 1.3, render: i => <Amt w={600} s={13}>{inr(i.value)}</Amt> },
    { key: 'gain', label: 'Gain', right: true, flex: 1.3, render: i => (
      <View style={{ alignItems: 'flex-end' }}>
        <Amt s={12.5} c={signCol(i.qty == null ? 0 : i.gain)}>{i.qty == null ? '–' : sinr(i.gain)}</Amt>
        {i.gainPct != null && <Amt s={11.5} c={signCol(i.gainPct)}>{pct(i.gainPct)}</Amt>}
      </View>) },
    { key: 'weight', label: 'Weight', right: true, flex: 0.9, render: i => (
      <View style={{ alignItems: 'flex-end', gap: 5 }}>
        <Amt s={12.5} c={C.ink2}>{pct(i.weight).replace('+', '')}</Amt>
        <View style={{ width: 56, height: 4, borderRadius: 2, backgroundColor: C.track }}>
          <View style={{ width: Math.max(2, Math.min(100, i.weight || 0)) + '%', height: 4, borderRadius: 2, backgroundColor: CLASS_COLOR[i.assetClass] || C.green }} />
        </View>
      </View>) },
  ];

  const sectors = (data && data.sectors) || [];
  const top = sectors.slice(0, 7), rest = sectors.slice(7);
  const sectorBars = top.map((s, k) => ({ key: s.sector, label: s.sector, value: inr(s.value, 0), pct: s.weight, color: PALETTE[k % PALETTE.length] }))
    .concat(rest.length ? [{ key: 'other', label: 'Other sectors', sub: rest.length + ' more', value: inr(rest.reduce((a, s) => a + s.value, 0), 0), pct: rest.reduce((a, s) => a + s.weight, 0), color: C.line2 }] : []);
  const classBars = ((data && data.assetClasses) || []).map(a => ({ key: a.assetClass, label: a.assetClass, value: inr(a.value, 0), pct: a.weight, color: CLASS_COLOR[a.assetClass] || C.green }));
  const shown = all ? items : items.slice(0, PAGE);

  const acctCols = [
    { key: 'name', label: 'Strategy', flex: 2.1, render: h => (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: h.color }} />
        <View style={{ minWidth: 0 }}><Tx w={600} s={13.5} numberOfLines={1}>{h.name}</Tx><Tx s={12} c={C.ink3} numberOfLines={1}>{h.id}</Tx></View>
      </View>) },
    { key: 'value', label: 'Value', right: true, flex: 1.2, render: h => <Amt s={13.5}>{h.value}</Amt> },
    { key: 'alloc', label: 'Weight', right: true, flex: 0.9, render: h => <Amt s={13} c={C.ink2}>{h.alloc}%</Amt> },
    { key: 'ret', label: 'Return (SI)', right: true, flex: 0.9, render: h => <Amt s={13.5} c={h.retColor}>{h.ret || '–'}</Amt> },
    { key: 'mdd', label: 'Max drawdown', right: true, flex: 1, render: h => <Amt s={13.5} c={h.mdd ? C.red : C.ink3}>{h.mdd || '–'}</Amt> },
  ];

  return (
    <View style={{ gap: 20 }}>
      {scope.length > 1 && (
        <Chips value={codes.length === 1 ? codes[0] : 'all'} onChange={k => { setAcct(k); setAll(false); }}
          options={[['all', 'All accounts'], ...accts.map(h => [h.id, short(h.name) + ' ' + h.id])]} />
      )}

      {err && !data ? <ErrorBlock msg={err} onRetry={reload} /> : !data && loading ? <Loading rows={5} /> : (
        <View style={{ gap: 20, opacity: loading ? 0.55 : 1 }}>
          <Row>
            <Stat label="Current value" value={tot ? inr(tot.value) : '–'} note={data.asOf ? 'Holdings as of ' + fmtDate(data.asOf) : ''} style={{ flex: 1.3 }} />
            <Stat label="Invested" value={tot ? inr(tot.invested) : '–'} note="Cost of the current holdings" style={{ flex: 1 }} />
            <Stat label="Unrealised gain" value={tot ? sinr(tot.gain) : '–'} color={tot ? signCol(tot.gain) : C.ink}
              delta={tot && tot.gainPct != null ? pct(tot.gainPct) : ''} deltaNeg={!!tot && tot.gainPct < 0} style={{ flex: 1 }} />
            <Stat label="Holdings" value={tot ? String(tot.count) : '–'}
              note={(data.accounts || []).length + ((data.accounts || []).length === 1 ? ' account' : ' accounts')} style={{ flex: 0.8 }} />
          </Row>

          {!items.length && !q ? (
            <Empty title="No holdings to show">Nothing is held in {codes.length === 1 ? 'this account' : 'these accounts'} on the latest holdings date.</Empty>
          ) : (
            <Row top>
              <Panel title="Holdings" sub={items.length + (items.length === 1 ? ' security' : ' securities') + (multi ? ', combined across accounts' : '')} pad={0} style={{ flex: 2.8 }}
                right={<Chips value={sort.key} onChange={pickSort} options={SORTS.map(([k, l]) => [k, sort.key === k ? l + (sort.desc ? ' ↓' : ' ↑') : l])} />}>
                <View style={{ paddingHorizontal: 20, paddingBottom: 14 }}>
                  <Input value={q} onChangeText={t => { setQ(t); setAll(false); }} placeholder="Search by name, symbol or sector" />
                </View>
                <Table dense cols={cols} rows={shown} empty={q ? 'No holding matches “' + q.trim() + '”.' : 'Nothing to show yet.'} />
                {items.length > PAGE && (
                  <View style={{ padding: 14, alignItems: 'center', borderTopWidth: 1, borderColor: C.line }}>
                    <Btn kind="ghost" small label={all ? 'Show fewer' : 'Show all ' + items.length} onPress={() => setAll(a => !a)} />
                  </View>
                )}
              </Panel>
              <View style={{ flex: 1.1, gap: 20, minWidth: 280 }}>
                <Panel title="Sector allocation" sub="Share of the current value">
                  {sectorBars.length ? <BarList items={sectorBars} dp={2} /> : <Tx s={13} c={C.ink3}>No sectors to show.</Tx>}
                </Panel>
                <Panel title="Asset class" sub="Stocks, ETFs, funds, derivatives and cash">
                  {classBars.length ? <BarList items={classBars} dp={2} /> : <Tx s={13} c={C.ink3}>No holdings to show.</Tx>}
                </Panel>
              </View>
            </Row>
          )}
        </View>
      )}

      <Panel title="By strategy account" sub="Value, weight and performance of each account in this view" pad={0}>
        <Table cols={acctCols} rows={accts} onRowPress={scope.length > 1 ? h => { setAcct(h.id); setAll(false); } : undefined}
          selected={h => codes.length === 1 && codes[0] === h.id && scope.length > 1} empty="No active strategies in this view." />
      </Panel>
    </View>
  );
}
export { DesktopHoldings };
