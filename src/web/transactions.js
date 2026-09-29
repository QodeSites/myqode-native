// Transactions (desktop web): every cash movement on the account(s) in view, bank transfers in and redemptions
// out, as its own page (it used to be a tab inside Services). Data: vals() > txAll (already shaped) and flows.
import React, { useState } from 'react';
import { View } from 'react-native';
import { C, Tx, Amt, Panel, Table, Chips, FitAmt } from './kit';
import { dayLabel } from '../screens/pay';
import { inr } from '../adapt';

const isOut = t => /[−-]/.test(String(t.amt));

export function DesktopTransactions({ V }) {
  const [kind, setKind] = useState('all');
  const rows = V.txAll.filter(t => kind === 'all' || (kind === 'out' ? isOut(t) : !isOut(t)));
  const f = V.flows || [];
  const cell = (label, value, color) => (
    <View style={{ flex: 1, paddingHorizontal: 18, paddingVertical: 4 }}>
      <Tx w={600} s={11.5} c={C.ink3}>{label}</Tx>
      <FitAmt w={600} s={16} c={color || C.ink} style={{ marginTop: 4 }}>{value}</FitAmt>
    </View>
  );
  return (
    <View style={{ gap: 20 }}>
      <Panel pad={14}>
        <View style={{ flexDirection: 'row' }}>
          {cell('Transactions', String(V.txAll.length))}
          <View style={{ width: 1, backgroundColor: C.line }} />
          {cell('Money in', (f[0] || {}).value || '–', C.pos)}
          <View style={{ width: 1, backgroundColor: C.line }} />
          {cell('Money out', (f[1] || {}).value || '–')}
          <View style={{ width: 1, backgroundColor: C.line }} />
          {cell('Net invested', (f[2] || {}).value || '–')}
        </View>
      </Panel>
      {!!(V.inFlight && V.inFlight.length) && (
        <Panel title="Pending" sub="Received, not yet in your portfolio: listed here until our custodian's data shows it" pad={0}>
          <Table rows={V.inFlight.map(it => ({ ...it, id: it.orderId }))} cols={[
            { key: 'recv', label: 'Received', flex: 1, render: it => <Tx s={13.5} c={C.ink2}>{dayLabel(String(it.paidAt).slice(0, 10))}</Tx> },
            { key: 'into', label: 'Into', flex: 1.6, render: it => <Tx s={13.5} numberOfLines={2}>{it.strategy || 'Your Qode portfolio'}</Tx> },
            { key: 'when', label: 'Invested / in portfolio', flex: 1.4, render: it => <Tx s={13.5} c={C.ink2}>{dayLabel(it.deployOn)} / {dayLabel(it.visibleOn)}</Tx> },
            { key: 'amt', label: 'Amount', flex: 1, right: true, render: it => <Amt s={13.5} c={C.pos}>+{inr(it.amount, 0)}</Amt> },
          ]} />
        </Panel>
      )}
      <Panel title="All transactions" sub={'Bank transfers in and redemptions out' + (V.asOf ? ', as of ' + V.asOf : '')} pad={0}
        right={<Chips value={kind} onChange={setKind} options={[['all', 'All'], ['in', 'Money in'], ['out', 'Money out']]} />}>
        {!V.hasTx ? <Tx s={13} c={C.ink3} style={{ padding: 20 }}>No transactions recorded yet.</Tx> : (
          <Table rows={rows} empty="No transactions of this kind." cols={[
            { key: 'sub', label: 'Date', flex: 1, render: t => <Tx s={13.5} c={C.ink2}>{t.sub}</Tx> },
            { key: 'title', label: 'Type', flex: 1.4, render: t => <Tx w={600} s={13.5}>{t.title}</Tx> },
            { key: 'amt', label: 'Amount', flex: 1, right: true, render: t => <Amt s={13.5} c={t.color}>{t.amt}</Amt> },
          ]} />
        )}
      </Panel>
    </View>
  );
}
