// Transactions (desktop web): money in / out / net invested for the account(s) in view, pending payments, then
// Nuvama's transaction ledger (NuvamaTransactions, as on Reports → Transactions).
import React from 'react';
import { View } from 'react-native';
import { C, Tx, Amt, Panel, Table, FitAmt } from './kit';
import { dayLabel } from '../screens/pay';
import { inr } from '../adapt';
import { NuvamaTransactions } from './reports';

export function DesktopTransactions({ V }) {
  const f = V.flows || [];
  const cell = (label, value, color) => (
    <View style={{ flex: 1, paddingHorizontal: 18, paddingVertical: 4 }}>
      <Tx w={600} s={11.5} c={C.ink3}>{label}</Tx>
      <FitAmt w={600} s={16} c={color || C.ink} style={{ marginTop: 4 }}>{value}</FitAmt>
    </View>
  );
  return (
    <View style={{ gap: 20 }}>
      {/* One summary on this page: the ledger's (money in / out are the client's own money; switches apart) */}
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
      {/* Nuvama's transaction ledger (src/web/reports.js); the summary above stays on the portfolio's money in / out */}
      <NuvamaTransactions V={V} />
    </View>
  );
}
