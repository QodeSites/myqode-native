// Transactions (desktop web): every cash movement on the account(s) in view, bank transfers in and redemptions
// out, as its own page (it used to be a tab inside Services). Data: vals() > txAll (already shaped) and flows.
import React, { useState } from 'react';
import { View } from 'react-native';
import { C, Tx, Amt, Panel, Table, Chips, FitAmt } from './kit';

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
