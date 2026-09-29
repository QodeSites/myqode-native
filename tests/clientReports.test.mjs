import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolvePeriod, periodChoices, periodError, accountChoices, fileName, buildReport, ALL_ID } from '../src/clientReports.js';

const TODAY = '2026-09-28';

test('periods resolve to IST financial years and ranges', () => {
  assert.deepEqual(resolvePeriod('thisFy', {}, TODAY), { from: '2026-04-01', to: TODAY, fy: '2026-27', label: 'FY 2026-27' });
  assert.deepEqual(resolvePeriod('lastFy', {}, TODAY), { from: '2025-04-01', to: '2026-03-31', fy: '2025-26', label: 'FY 2025-26' });
  assert.equal(resolvePeriod('3m', {}, TODAY).from, '2026-06-29');
  assert.equal(resolvePeriod('12m', {}, TODAY).from, '2025-09-29');
  assert.equal(resolvePeriod('all', {}, TODAY).from, null);
  assert.equal(resolvePeriod('custom', { from: '2026-01-01', to: '2026-02-01' }, TODAY).label, '1 Jan 2026 to 1 Feb 2026');
  assert.equal(resolvePeriod('fy:2024-25', {}, TODAY).fy, '2024-25');
  assert.equal(periodChoices('capitalGains', TODAY)[0][0], 'fy:2026-27');
  assert.equal(periodChoices('factsheet', TODAY).length, 0);
  assert.equal(periodError('custom', { from: '2026-02-01', to: '2026-01-01' }, TODAY), 'The start date must be on or before the end date.');
  assert.equal(periodError('custom', { from: '2026-01-01', to: '2026-02-01' }, TODAY), '');
});

test('account choices and file name', () => {
  const one = accountChoices([{ id: 'QAW1', name: 'QODE ADVISORS LLP - QODE ALL WEATHER' }]);
  assert.deepEqual(one.map(o => o.label), ['QODE ALL WEATHER QAW1']);
  const two = accountChoices([{ id: 'QAW1', name: '' }, { id: 'QGF1', name: 'Growth', closed: true }]);
  assert.deepEqual(two.map(o => o.id), [ALL_ID, 'QAW1', 'QGF1']);
  assert.equal(two[2].label, 'Growth QGF1 (closed)');
  assert.equal(fileName('Rohan Mehta', 'transactions', 'FY 2026-27', 'QAW1'), 'Rohan Mehta - Transactions - FY 2026-27 - QAW1');
});

// A stub `reports` bound object that records the queries it receives.
const calls = [];
const txn = id => ({ accountId: id, asOf: TODAY, holder: { name: 'X' }, items: [{ id: 1, date: '2026-09-01', settleDate: '2026-09-01', type: 'Buy', security: 'A', amount: 10, direction: 'out' }],
  summary: [{ group: 'trades', label: 'Trades', count: 1, amount: 10 }], moneyIn: 0, moneyOut: 0, hasMore: false });
const rep = {
  transactions: async (id, q) => { calls.push(['transactions', id, q]); return txn(id); },
  expenses: async (id, q) => { calls.push(['expenses', id, q]); return { accountId: id, asOf: TODAY, paid: 1, payable: 0, byType: [{ type: 'Fee', amount: 1, count: 1 }], items: [{ date: '2026-09-01', type: 'Fee', amount: 1, status: 'paid' }], period: { from: '2026-04-01', to: TODAY } }; },
  capitalGains: async (id, q) => { calls.push(['capitalGains', id, q]); return { accountId: id, asOf: TODAY, fy: q.fy || null, years: [{ fy: '2026-27', st: 1, lt: 0, total: 1, lots: 1 }], summary: { st: 1, lt: 0, ltTaxable: 0, total: 1, byCategory: [] }, items: [{ saleDate: '2025-06-01', security: 'A', category: 'Equity', qty: 1, saleAmount: 2, cost: 1, gain: 1, term: 'ST' }] }; },
  factsheet: async (id, q) => { calls.push(['factsheet', id, q]); return { accountId: id, asOf: TODAY, dates: [TODAY], contribution: 1, withdrawal: 0, profitLoss: 1, portfolioValue: 2, returns: { periods: [], portfolio: [], benchmark: { name: 'B', values: [] } }, sectors: [], holdings: [] }; },
  pnl: async (ids, q) => { calls.push(['pnl', ids, q]); return null; },
};

test('buildReport asks with export=1 and builds single and combined PDFs', async () => {
  const one = await buildReport(rep, { kind: 'transactions', account: 'QAW1', ids: ['QAW1', 'QGF1'], period: 'thisFy' });
  assert.match(one.html, /Transaction Statement/);
  assert.deepEqual(calls.at(-1), ['transactions', 'QAW1', { group: 'all', from: '2026-04-01', to: calls.at(-1)[2].to, export: 1, limit: 5000 }]);
  const all = await buildReport(rep, { kind: 'expenses', account: ALL_ID, ids: ['QAW1', 'QGF1'], period: 'all' });
  assert.match(all.html, /All accounts/);
  const cg = await buildReport(rep, { kind: 'capitalGains', account: ALL_ID, ids: ['QAW1', 'QGF1'], period: 'fy:2025-26' });
  assert.match(cg.html, /2025-26/);
  assert.ok(calls.filter(c => c[0] === 'capitalGains').every(c => c[2].fy === '2025-26' && c[2].export === 1));
  const fs = await buildReport(rep, { kind: 'factsheet', account: 'QAW1', ids: ['QAW1'], asOf: 'date', date: '2026-06-30' });
  assert.match(fs.html, /Fact Sheet/);
  assert.deepEqual(calls.at(-1)[2], { date: '2026-06-30', export: 1 });
  await assert.rejects(buildReport(rep, { kind: 'pnl', account: 'QAW1', ids: ['QAW1'], period: 'thisFy' }), /No profit and loss/);
});

// An account that started on 16 Jul 2026 with sales only in FY 2026-27. Like the server, capital gains answers a year
// with no sales with the latest year that has some, and transactions / expenses answer an empty period with no items.
const START = '2026-07-16';
const late = {
  transactions: async (id, q) => ({ accountId: id, asOf: TODAY, coverage: { from: START, to: TODAY }, items: q.to && q.to < START ? [] : [{ id: 1, date: '2026-08-01', type: 'Buy', security: 'A', amount: 10, direction: 'out' }], summary: [], moneyIn: 0, moneyOut: 0 }),
  expenses: async (id, q) => ({ accountId: id, asOf: TODAY, paid: 0, payable: 0, byType: [], items: q.to && q.to < START ? [] : [{ date: '2026-08-01', type: 'Fee', amount: 1, status: 'paid' }], period: { from: START, to: TODAY } }),
  capitalGains: async (id, q) => ({ accountId: id, asOf: TODAY, fy: '2026-27', years: [{ fy: '2026-27', st: 1, lt: 0, total: 1, lots: 1 }], summary: { st: 1, lt: 0, ltTaxable: 0, total: 1, byCategory: [] }, items: [{ saleDate: '2026-08-10', security: 'A', category: 'Equity', qty: 1, saleAmount: 2, cost: 1, gain: 1, term: 'ST' }] }),
};

test('a period before the account started, or with nothing in it, is refused with a message', async () => {
  const sel = { account: 'QAW1', ids: ['QAW1'] };
  await assert.rejects(buildReport(late, { ...sel, kind: 'capitalGains', period: 'fy:2024-25' }), { message: 'This account started on 16 Jul 2026. No capital gains for FY 2024-25.' });
  await assert.rejects(buildReport(late, { ...sel, kind: 'capitalGains', account: ALL_ID, ids: ['QAW1', 'QGF1'], period: 'fy:2024-25' }), { message: 'These accounts started on 16 Jul 2026. No capital gains for FY 2024-25.' });
  await assert.rejects(buildReport(late, { ...sel, kind: 'transactions', period: 'custom', custom: { from: '2025-01-01', to: '2025-03-31' } }), { message: 'This account started on 16 Jul 2026. No transactions for this period.' });
  await assert.rejects(buildReport(late, { ...sel, kind: 'expenses', period: 'custom', custom: { from: '2025-01-01', to: '2025-03-31' } }), { message: 'This account started on 16 Jul 2026. No expenses for this period.' });
  const ok = await buildReport(late, { ...sel, kind: 'capitalGains', period: 'fy:2026-27' });
  assert.match(ok.html, /2026-27/);
  assert.match((await buildReport(late, { ...sel, kind: 'transactions', period: 'thisFy' })).html, /Transaction Statement/);
});
