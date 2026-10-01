// The fact sheet's "As of" choices, shared by the phone (src/screens/reports.js) and the web (src/web/reports.js):
//   Latest · month-ends back to the account's start (newest first) · Pick a date…
// The server answers any date: Nuvama's own fact sheet where one was imported for that date, otherwise one computed
// from the transaction and holdings data. The import dates themselves are not listed (they meant nothing to clients).

/** The newest date with data: the end of the account's coverage, or the newest stored fact sheet. */
export function latestDate(dates, coverage) {
  const a = (coverage && coverage.to) || null, b = (dates && dates[0]) || null;
  return a && b ? (a > b ? a : b) : (a || b);
}

/** Calendar month-ends (yyyy-mm-dd) from `to` back to `from`, newest first, at most `max`. */
export function monthEnds(from, to, max = 24) {
  if (!from || !to) return [];
  const out = [];
  let y = +to.slice(0, 4), m = +to.slice(5, 7);
  for (let guard = 0; guard < 600 && out.length < max; guard++) {
    const last = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
    if (last < from) break;
    if (last <= to) out.push(last);
    if (--m === 0) { m = 12; y--; }
  }
  return out;
}

/** The first date the account can show (start of coverage, else the oldest stored fact sheet). */
export const earliestDate = (dates, coverage) => (coverage && coverage.from) || (dates && dates.length ? dates[dates.length - 1] : null);

export const asOfHint = (from, to, fmt) => (from && to
  ? `Any date from ${fmt(from)} to ${fmt(to)}. We use Nuvama’s own fact sheet where we have it and calculate the rest from your transactions and holdings.`
  : 'We use Nuvama’s own fact sheet where we have it and calculate other dates from your transactions and holdings.');
