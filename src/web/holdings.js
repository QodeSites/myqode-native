// Web Holdings page: what the investor owns (stocks, ETFs, mutual funds, derivatives, cash) across the strategy
// accounts in the current scope, like a broker's holdings screen. Data: portfolio.securities (GET
// /api/mobile/portfolio/securities, myQode/lib/securities.ts), refetched when the scope or the account filter
// changes. The scope's accounts come from V.holdings ({ id, name, value, alloc, w, color, ret, retColor, mdd }).
// Built only from ./kit.
import React, { useState, useEffect, useMemo } from 'react';
import { View, Platform, Pressable, ScrollView } from 'react-native';
import { ChevronDown } from '../icons';
import { C, Tx, Amt, Row, Panel, Stat, Chips, Table, BarList, Input, Btn, Loading, Empty, ErrorBlock } from './kit';
import { portfolio } from '../api';
import { inr, sinr, pct, fmtDate } from '../adapt';
import { Donut } from '../screens/charts';
import { titleCase } from '../titleCase';

import { userMessage } from '../errors';
const signCol = v => (v == null ? C.ink3 : v < 0 ? C.red : v > 0 ? C.pos : C.ink2);
const qtyFmt = v => (v == null ? '–' : Number(v).toLocaleString('en-IN', { maximumFractionDigits: 2 }));  // 2 decimals everywhere (8 Oct 2026)
const priceFmt = v => (v == null ? '–' : inr(v));
const short = name => String(name || '');   // full strategy names ("Qode Growth Fund"), as the owner asked
// Sector colours: brand green first, then muted tones that stay apart from each other.
const PALETTE = ['#02422B', '#DABD38', '#2F6F5E', '#8A700C', '#5B8A7A', '#B89A2E', '#4F5C56', '#86918B'];
const CLASS_COLOR = { Stocks: '#02422B', ETFs: '#2F6F5E', 'Mutual funds': '#DABD38', Derivatives: '#8A700C', Cash: '#86918B' };
const PAGE = 12;   // the biggest holdings first; the rest one click away (keeps the page short beside the allocation panels)

// Account picker: one button ("Account · All accounts · 6"), and a menu with every account grouped under the family
// member who holds it, each with its strategy colour, code, value and share. Scales to any number of accounts.
function AccountPicker({ accts, value, onPick }) {
  const [open, setOpen] = useState(false);
  const cur = accts.find(h => h.id === value);
  const owners = [...new Set(accts.map(h => h.owner || ''))];
  const grouped = owners.length > 1;
  const total = accts.reduce((s, h) => s + (h.raw || 0), 0);
  const pick = k => { setOpen(false); onPick(k); };
  const Row_ = ({ k, on, children }) => (
    <Pressable accessibilityRole="menuitem" accessibilityState={{ selected: on }} onPress={() => pick(k)}
      style={({ hovered }) => ({ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9, paddingHorizontal: 10, borderRadius: 8,
        backgroundColor: on ? C.greenTint : hovered ? C.hover : 'transparent' })}>
      <Tx w={700} s={13} c={C.green} style={{ width: 14 }}>{on ? '✓' : ''}</Tx>
      {children}
    </Pressable>
  );
  const acctRow = h => (
    <Row_ key={h.id} k={h.id} on={value === h.id}>
      <View style={{ width: 9, height: 9, borderRadius: 2, backgroundColor: h.color || C.ink3 }} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Tx w={value === h.id ? 600 : 500} s={13.5} numberOfLines={1}>{h.name || h.id}</Tx>
        <Tx s={12} c={C.ink3}>{h.id}</Tx>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Amt w={600} s={13}>{h.value}</Amt>
        <Tx s={11.5} c={C.ink3}>{h.alloc}%</Tx>
      </View>
    </Row_>
  );
  return (
    <View style={{ alignSelf: 'flex-start', zIndex: open ? 60 : 1 }}>
      <Pressable accessibilityRole="button" accessibilityLabel="Choose an account" accessibilityState={{ expanded: open }} onPress={() => setOpen(o => !o)}
        style={({ hovered }) => ({ flexDirection: 'row', alignItems: 'center', gap: 10, height: 44, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1,
          borderColor: open || hovered ? C.green : C.line2, backgroundColor: C.card })}>
        <Tx w={600} s={12} c={C.ink3}>Account</Tx>
        {cur && <View style={{ width: 9, height: 9, borderRadius: 2, backgroundColor: cur.color || C.ink3 }} />}
        <Tx w={600} s={14} numberOfLines={1}>{cur ? (cur.name || cur.id) + ' · ' + cur.id : 'All accounts'}</Tx>
        {!cur && <Tx s={12} c={C.ink3}>{accts.length}</Tx>}
        <ChevronDown s={10} c={C.ink2} />
      </Pressable>
      {open && (
        <>
          <Pressable accessibilityLabel="Close menu" onPress={() => setOpen(false)}
            style={{ position: Platform.OS === 'web' ? 'fixed' : 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 0, cursor: 'default' }} />
          <View style={{ position: 'absolute', top: 52, left: 0, zIndex: 1, width: 420, maxWidth: '90vw', padding: 6, borderRadius: 12, borderWidth: 1, borderColor: C.line,
            backgroundColor: C.card, shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 18, shadowOffset: { width: 0, height: 10 } }}>
            <ScrollView style={{ maxHeight: 420 }}>
              <Row_ k="all" on={value === 'all'}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Tx w={600} s={13.5}>All accounts</Tx>
                  <Tx s={12} c={C.ink3}>{grouped ? 'Combined across the family' : accts.length + ' accounts combined'}</Tx>
                </View>
                <Amt w={600} s={13}>{inr(total)}</Amt>
              </Row_>
              {grouped
                ? owners.map(o => (
                  <View key={o || 'other'}>
                    <Tx w={700} s={11} ls={0.1} c={C.ink3} style={{ paddingHorizontal: 10, paddingTop: 10, paddingBottom: 4 }}>{(o || 'Other accounts').toUpperCase()}</Tx>
                    {accts.filter(h => (h.owner || '') === o).map(acctRow)}
                  </View>
                ))
                : <View style={{ height: 1, backgroundColor: C.line, marginVertical: 4, marginHorizontal: 4 }} />}
              {!grouped && accts.map(acctRow)}
            </ScrollView>
          </View>
        </>
      )}
    </View>
  );
}

// A donut of the shares, centred, with its legend under it: colour, name (value under it) and share. items: [{ key, label, sub?,
// value, pct, color }] (shares in %, adding to 100).
function DonutLegend({ items, count, label }) {
  return (
    <View style={{ gap: 18 }}>
      <View style={{ alignItems: 'center' }}>
        <Donut slices={items.map(it => ({ pct: Number(it.pct) || 0, color: it.color }))} count={count} label={label} size={150} />
      </View>
      <View style={{ gap: 10 }}>
        {items.map(it => (
          <View key={it.key || it.label} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
            <View style={{ width: 9, height: 9, borderRadius: 2, backgroundColor: it.color || C.green, marginTop: 4 }} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Tx w={600} s={13} numberOfLines={1}>{it.label}{it.sub ? <Tx s={12} c={C.ink3}>{'  ' + it.sub}</Tx> : null}</Tx>
              {!!it.value && <Amt s={12} c={C.ink3}>{it.value}</Amt>}
            </View>
            <Amt w={600} s={13}>{(Number(it.pct) || 0).toFixed(2)}%</Amt>
          </View>
        ))}
      </View>
    </View>
  );
}

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
  const [sideH, setSideH] = useState(0);   // the allocation column's height: the Holdings card matches it and scrolls inside
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
    { key: 'avgCost', label: 'Avg Cost', right: true, flex: 1, render: i => <Amt s={12.5} c={C.ink2}>{priceFmt(i.avgCost)}</Amt> },
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
  const sectorBars = top.map((s, k) => ({ key: s.sector, label: titleCase(s.sector), value: inr(s.value), pct: s.weight, color: PALETTE[k % PALETTE.length] }))
    .concat(rest.length ? [{ key: 'other', label: 'Other Sectors', sub: rest.length + ' more', value: inr(rest.reduce((a, s) => a + s.value, 0), 0), pct: rest.reduce((a, s) => a + s.weight, 0), color: C.line2 }] : []);
  const classBars = ((data && data.assetClasses) || []).map(a => ({ key: a.assetClass, label: titleCase(a.assetClass), value: inr(a.value), pct: a.weight, color: CLASS_COLOR[a.assetClass] || C.green }));
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
    { key: 'mdd', label: 'Max Drawdown', right: true, flex: 1, render: h => <Amt s={13.5} c={h.mdd ? C.red : C.ink3}>{h.mdd || '–'}</Amt> },
  ];

  return (
    <View style={{ gap: 20 }}>
      {scope.length > 1 && (
        <AccountPicker accts={accts} value={codes.length === 1 ? codes[0] : 'all'} onPick={k => { setAcct(k); setAll(false); }} />
      )}

      {err && !data ? <ErrorBlock msg={err} onRetry={reload} /> : !data && loading ? <Loading rows={5} /> : (
        <View style={{ gap: 20, opacity: loading ? 0.55 : 1 }}>
          <Row>
            <Stat label="Current Value" value={tot ? inr(tot.value) : '–'} note={data.asOf ? 'Holdings as of ' + fmtDate(data.asOf) : ''} style={{ flex: 1 }} />
            {/* Not "Invested": that word means the client's own money (Overview). This is what today's holdings cost to buy,
                which includes profit already booked and reinvested (9 Oct 2026). */}
            <Stat label="Cost of Holdings" value={tot ? inr(tot.invested) : '–'} note="What today's holdings cost to buy" style={{ flex: 1 }} />
            <Stat label="Unrealised Gain" value={tot ? sinr(tot.gain) : '–'} color={tot ? signCol(tot.gain) : C.ink}
              delta={tot && tot.gainPct != null ? pct(tot.gainPct) : ''} deltaNeg={!!tot && tot.gainPct < 0} style={{ flex: 1 }} />
            <Stat label="Holdings" value={tot ? String(tot.count) : '–'}
              note={(data.accounts || []).length + ((data.accounts || []).length === 1 ? ' account' : ' accounts')} style={{ flex: 1 }} />
          </Row>

          {!items.length && !q ? (
            <Empty title="No holdings to show">Nothing is held in {codes.length === 1 ? 'this account' : 'these accounts'} on the latest holdings date.</Empty>
          ) : (
            <Row top>
              <Panel title="Holdings" sub={items.length + (items.length === 1 ? ' security' : ' securities') + (multi ? ', combined across accounts' : '')} pad={0}
                style={[{ flex: 2.8 }, sideH ? { height: sideH } : null]} bodyStyle={sideH ? { flex: 1, minHeight: 0 } : null}
                right={<Chips value={sort.key} onChange={pickSort} options={SORTS.map(([k, l]) => [k, sort.key === k ? l + (sort.desc ? ' ↓' : ' ↑') : l])} />}>
                <View style={{ paddingHorizontal: 20, paddingBottom: 14 }}>
                  <Input value={q} onChangeText={t => { setQ(t); setAll(false); }} placeholder="Search by name, symbol or sector" />
                </View>
                {/* Lined up with the allocation cards: every holding, scrolling inside the card (header pinned) */}
                {sideH ? (
                  <ScrollView style={{ flex: 1 }}>
                    <Table dense cols={cols} rows={items} empty={q ? 'No holding matches “' + q.trim() + '”.' : 'Nothing to show yet.'} />
                  </ScrollView>
                ) : <Table dense cols={cols} rows={shown} empty={q ? 'No holding matches “' + q.trim() + '”.' : 'Nothing to show yet.'} />}
                {!sideH && items.length > PAGE && (
                  <View style={{ padding: 14, alignItems: 'center', borderTopWidth: 1, borderColor: C.line }}>
                    <Btn kind="ghost" small label={all ? 'Show fewer' : 'Show all ' + items.length} onPress={() => setAll(a => !a)} />
                  </View>
                )}
              </Panel>
              {/* sets the row's height: the Holdings card beside it is made as tall */}
              <View style={{ flex: 1.1, gap: 20, minWidth: 280 }} onLayout={e => setSideH(Math.round(e.nativeEvent.layout.height))}>
                <Panel title="Sector Allocation" sub="Share of the current value">
                  {sectorBars.length ? <DonutLegend items={sectorBars} count={sectors.length} label={sectors.length === 1 ? 'SECTOR' : 'SECTORS'} /> : <Tx s={13} c={C.ink3}>No sectors to show.</Tx>}
                </Panel>
                <Panel title="Asset Class" sub="Stocks, ETFs, funds, derivatives and cash">
                  {classBars.length ? <DonutLegend items={classBars} count={classBars.length} label={classBars.length === 1 ? 'CLASS' : 'CLASSES'} /> : <Tx s={13} c={C.ink3}>No holdings to show.</Tx>}
                </Panel>
              </View>
            </Row>
          )}
        </View>
      )}

      <Panel title="By Strategy Account" sub="Value, weight and performance of each account in this view" pad={0}>
        <Table cols={acctCols} rows={accts} onRowPress={scope.length > 1 ? h => { setAcct(h.id); setAll(false); } : undefined}
          selected={h => codes.length === 1 && codes[0] === h.id && scope.length > 1} empty="No active strategies in this view." />
      </Panel>
    </View>
  );
}
export { DesktopHoldings };
