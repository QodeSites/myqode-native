import { test } from 'node:test';
import assert from 'node:assert/strict';
import { irrPeriod, fmtIrr, irrLabel } from '../src/irr.js';

const data = { asOf: '2026-09-25', periods: [
  { period: '1Y', irr: 11.67, annualised: true, from: '2025-09-25', to: '2026-09-25' },
  { period: '3Y', irr: null, annualised: false, from: '2023-09-25', to: '2026-09-25' },
  { period: 'SI', irr: -5.19, annualised: false, from: '2025-06-03', to: '2026-03-03' },
] };

test('irr display helpers', () => {
  assert.equal(fmtIrr(irrPeriod(data, '1Y')), '+11.67% p.a.');
  assert.equal(fmtIrr(irrPeriod(data, '3Y')), '–');
  assert.equal(fmtIrr(irrPeriod(data, 'SI')), '\u22125.19%');
  assert.equal(irrLabel(irrPeriod(data, 'SI')), 'Return on your money');
  assert.equal(irrLabel(irrPeriod(data, '1Y')), 'IRR');
  assert.equal(irrPeriod(null, '1Y'), null);
});
