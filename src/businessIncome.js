// Derivatives (futures and options) on the capital gains report. For tax, gains and losses on exchange-traded
// derivatives are non-speculative business income, not short-term capital gains: they are added to the investor's
// other income and taxed at their slab rate. Nuvama's report files them under "Derivatives - Long Position" (and
// short) with a short-term term, so splitGains() takes those categories out of short term, long term and the
// realised total and reports them as `business`. Used by the web and phone Reports, the PDFs and the Excel files.
// Decided 8 Oct 2026.

export const isBusiness = category => /^\s*derivative/i.test(String(category || ''));

export const BUSINESS_NOTE = 'Gains and losses on derivatives (futures and options) are treated as business income, not capital gains. '
  + 'They are added to your other income and taxed at your income-tax slab rate. A loss can be set off against other income except salary, '
  + 'and carried forward for up to 8 years if your return is filed on time. They are reported in ITR-3. Please confirm with your tax adviser.';

/** A capital gains summary with derivatives moved out of st / lt / ltTaxable / total into `business`.
 *  byCategory keeps every category; each gets `business` (its gain when a derivative, else 0) and, for a
 *  derivative, st / lt / ltTaxable of 0. `hasBusiness` says whether any derivative category is present. */
export function splitGains(s) {
  if (!s) return s;
  const cats = (s.byCategory || []).map(c => (isBusiness(c.category)
    ? { ...c, business: (c.st || 0) + (c.lt || 0), st: 0, lt: 0, ltTaxable: 0 }
    : { ...c, business: 0 }));
  const biz = (s.byCategory || []).filter(c => isBusiness(c.category));
  if (!biz.length) return { ...s, byCategory: cats, business: 0, hasBusiness: false };
  const sum = (xs, k) => xs.reduce((t, c) => t + (c[k] || 0), 0);
  const st = sum(cats, 'st'), lt = sum(cats, 'lt'), ltTaxable = sum(cats, 'ltTaxable');
  return { ...s, st, lt, ltTaxable, total: st + lt, business: sum(cats, 'business'), byCategory: cats, hasBusiness: true };
}
