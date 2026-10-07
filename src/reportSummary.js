// Plain-language summaries shown above every report (web, phone and the PDFs): two to four sentences that say
// what the figures mean before the raw tables. Each function takes the same answer the report screen already has
// and returns an array of sentences (empty when there is nothing to say). Figures here are rounded for reading;
// the tables below keep the exact amounts.
const MS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const day = iso => (iso ? `${+String(iso).slice(8, 10)} ${MS[+String(iso).slice(5, 7) - 1]} ${String(iso).slice(0, 4)}` : '');
const num = v => (v == null || isNaN(v) ? 0 : +v);

/** ₹ for reading: ₹8,450 · ₹12.4 L · ₹1.25 Cr (no sign). */
export const money = v => {
  const a = Math.abs(num(v));
  if (a >= 1e7) return `₹${(a / 1e7).toFixed(2).replace(/\.?0+$/, '')} Cr`;
  if (a >= 1e5) return `₹${(a / 1e5).toFixed(2).replace(/\.?0+$/, '')} L`;
  return '₹' + a.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};
const pctTxt = v => `${Math.abs(num(v)).toFixed(2)}%`;
const span = (from, to) => (from && to ? `Between ${day(from)} and ${day(to)}` : from ? `Since ${day(from)}` : to ? `Up to ${day(to)}` : 'Across all records');
const gainWord = v => (num(v) >= 0 ? 'gain' : 'loss');
const who = all => (all ? 'these accounts' : 'this account');

export function transactionsSummary(h, all) {
  if (!h || !h.asOf) return [];
  const g = k => (h.summary || []).find(s => s.group === k);
  const out = [];
  const mi = num(h.moneyIn), mo = num(h.moneyOut);
  out.push(mi || mo
    ? `${span(h.from, h.to)}, ${money(mi)} came into ${who(all)}${mo ? ` and ${money(mo)} was taken out` : ' and nothing was taken out'}.`
    : `${span(h.from, h.to)}, no money was added to or taken out of ${who(all)}.`);
  // switches between strategies: within "all accounts" both legs are here and cancel; one account shows its side
  const si = num(h.switchIn), so = num(h.switchOut);
  if (si || so) {
    if (all && Math.abs(si - so) < 1) out.push(`${money(si)} was moved between your strategies; it isn't counted as money in or out.`);
    else out.push(`Switches between strategies${si ? ` brought in ${money(si)}` : ''}${si && so ? ' and' : ''}${so ? ` moved ${money(so)} out` : ''}.`);
  }
  const t = g('trades'), inc = g('income'), ch = g('charges');
  const bits = [
    t && t.count ? `${t.count} ${t.count === 1 ? 'trade' : 'trades'} worth ${money(t.amount)}` : null,
    inc && num(inc.amount) ? `${money(inc.amount)} in dividends and other income` : null,
    ch && num(ch.amount) ? `${money(ch.amount)} in charges` : null,
  ].filter(Boolean);
  if (bits.length) out.push(`The portfolio saw ${bits.length > 1 ? bits.slice(0, -1).join(', ') + ' and ' + bits[bits.length - 1] : bits[0]}.`);
  return out;
}

export function capitalGainsSummary(h, all) {
  const s = h && h.summary;
  if (!s) return [];
  const when = h.fy ? `In FY ${h.fy}` : span(h.from, h.to);
  const total = num(s.total), st = num(s.st), lt = num(s.lt);
  if (!total && !st && !lt) return [`${when}, no holdings were sold in ${who(all)}, so there are no capital gains to report.`];
  const out = [`${when}, sales in ${who(all)} realised a net ${gainWord(total)} of ${money(total)}.`];
  out.push(`Short-term ${gainWord(st)}: ${money(st)}. Long-term ${gainWord(lt)}: ${money(lt)}${s.ltTaxable != null && Math.round(num(s.ltTaxable)) !== Math.round(lt) ? `, or ${money(s.ltTaxable)} after grandfathering` : ''}.`);
  out.push('Only holdings that were sold count here; gains on holdings still held are not taxed until they are sold.');
  return out;
}

export function expensesSummary(h, all, byType) {
  if (!h || !h.asOf) return [];
  const paid = num(h.paid), payable = num(h.payable), total = paid + payable;
  if (!total) return [`${span(h.from, h.to)}, no charges were recorded on ${who(all)}.`];
  const out = [`${span(h.from, h.to)}, charges on ${who(all)} came to ${money(total)}: ${money(paid)} already paid${payable ? ` and ${money(payable)} accrued, to be paid later` : ''}.`];
  const top = [...(byType || [])].sort((a, b) => num(b.amount) - num(a.amount))[0];
  if (top && num(top.amount) && total) out.push(`The largest was ${String(top.type).toLowerCase()}, at ${money(top.amount)} (${pctTxt((num(top.amount) / total) * 100)} of the total).`);
  return out;
}

export function factsheetSummary(d, all) {
  if (!d || !d.asOf) return [];
  const out = [];
  const pl = num(d.profitLoss);
  out.push(`On ${day(d.valueDate || d.asOf)}, ${who(all)} ${all ? 'were' : 'was'} worth ${money(d.portfolioValue)}.`);
  out.push(`${d.inceptionDate ? `Since ${day(d.inceptionDate)}` : 'Since inception'}, ${money(d.contribution)} was invested${num(d.withdrawal) ? ` and ${money(d.withdrawal)} withdrawn` : ''}, for a ${gainWord(pl)} of ${money(pl)}.`);
  const r = d.returns || {}, periods = r.periods || [];
  const i = periods.findIndex(p => /since/i.test(String(p)));
  const j = i >= 0 ? i : periods.length - 1;
  const mine = r.portfolio && r.portfolio[j], bench = r.benchmark && r.benchmark.values && r.benchmark.values[j];
  if (!all && mine != null) {
    const yearPlus = i >= 0 && d.inceptionDate && (new Date(d.valueDate || d.asOf) - new Date(d.inceptionDate)) > 365 * 86400000;
    out.push(`The time-weighted return ${i >= 0 ? 'since inception' : `over ${periods[j]}`}${yearPlus ? ', annualised,' : ''} is ${num(mine) >= 0 ? '+' : '−'}${pctTxt(mine)}${bench != null && r.benchmark.name ? `, against ${num(bench) >= 0 ? '+' : '−'}${pctTxt(bench)} for the ${r.benchmark.name}` : ''}.`);
  }
  const sec = [...(d.sectors || [])].sort((a, b) => num(b.pct) - num(a.pct))[0];
  if (!all && sec && sec.sector) out.push(`${(d.holdings || []).length ? `It holds ${(d.holdings || []).length} investments; the` : 'The'} largest sector is ${sec.sector} at ${pctTxt(sec.pct)}.`);
  return out;
}

export function pnlSummary(d, all) {
  if (!d || !d.asOf || !d.pnl) return [];
  const inc = num(d.pnl.incomeTotal), exp = num(d.pnl.expenseTotal), sur = num(d.pnl.surplus);
  const out = [`${span(d.from, d.to)}, ${who(all)} earned ${money(inc)} in income${inc < 0 ? ' (a net loss on sales)' : ''} and paid ${money(exp)} in expenses, leaving a ${sur >= 0 ? 'surplus' : 'deficit'} of ${money(sur)}.`];
  if (d.unrealised && num(d.unrealised.net)) out.push(`Holdings not yet sold carry a further unrealised ${gainWord(d.unrealised.net)} of ${money(d.unrealised.net)}, which is not part of the surplus.`);
  const pv = d.reconciliation && d.reconciliation.portfolioValue;
  if (pv != null) out.push(`The balance sheet below is as of ${day(d.to)}, when the portfolio was worth ${money(pv)}.`);
  return out;
}
