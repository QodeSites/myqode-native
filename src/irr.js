// Money-weighted return (XIRR) from portfolio.irr() — display helpers only (the server computes the figures:
// myQode/lib/irr.ts). Shown next to the NAV-based (time-weighted) returns.

/** The period entry ('1Y' | '3Y' | 'SI') of a portfolio.irr() answer, or null. */
export const irrPeriod = (data, period) => ((data && data.periods) || []).find(p => p.period === period) || null;

/** "12.90% p.a." when annualised, "5.20%" for a period under a year, "–" when there is no figure. */
export function fmtIrr(p) {
  if (!p || p.irr == null || !Number.isFinite(p.irr)) return '–';
  const v = (p.irr > 0 ? '+' : p.irr < 0 ? '−' : '') + Math.abs(p.irr).toFixed(2) + '%';
  return p.annualised ? v + ' p.a.' : v;
}

/** Short label: "IRR" (annualised) or "IRR (absolute)" for a window under a year. */
export const irrLabel = p => (p && p.irr != null && !p.annualised ? 'IRR (absolute)' : 'IRR');
