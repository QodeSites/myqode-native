// Unrealised gain on what the account(s) hold now, for the Capital Gains report beside the realised figures (web
// src/web/reports.js, phone src/screens/reports.js): the holdings' value less their cost, from portfolio.securities
// (GET /api/mobile/portfolio/securities, myQode lib/securities.ts, latest holdings date). Stale replies are dropped.
import { useState, useEffect } from 'react';
import { portfolio } from './api';

// codes: the account codes in view. Returns { gain, asOf, loading, err }.
export function useUnrealised(codes) {
  const key = (codes || []).filter(Boolean).join(',');
  const [st, set] = useState({ gain: null, asOf: null, loading: !!key, err: false });
  useEffect(() => {
    if (!key) { set({ gain: null, asOf: null, loading: false, err: false }); return undefined; }
    let live = true;
    set(s => ({ ...s, loading: true, err: false }));
    portfolio.securities(key.split(','))
      .then(d => { if (live) set({ gain: d && d.totals ? d.totals.gain : null, asOf: (d && d.asOf) || null, loading: false, err: false }); })
      .catch(() => { if (live) set({ gain: null, asOf: null, loading: false, err: true }); });
    return () => { live = false; };
  }, [key]);
  return st;
}
