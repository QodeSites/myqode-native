# Web parity rules

The app must show the same numbers as the web portfolio page (`../myQode/app/(protected)/portfolio/performance/page.tsx`). Investors compare the two. These rules are what keep them equal. Do not "improve" any of them on one side only.

How the work is split:

- The **backend mobile routes** compute every figure (returns, drawdowns, P&L cells and totals). They were written to follow the web page's formulas.
- The **app** does not recompute figures. It groups, labels, scales charts and colours values.
- `scripts/compare-web.mjs` re-implements the web formulas and checks the mobile routes against them. See [modes-and-testing.md](modes-and-testing.md).

"Combined" below means the `combined-*` routes used for owner and family scopes (see [architecture.md](architecture.md)). Each rule applies to both route families.

## Summary

| Rule | App | Backend mobile route |
| --- | --- | --- |
| P&L by calendar year, Q1 = Jan–Mar, months Jan→Dec, totals from the API | `buildFys()`, `buildFysQ()` in `src/adapt.js`; `fySum`, `qtr`, `pnlRows` in `vals()` in `src/main.js`; `QUARTER_LABELS` in `src/data.js` | `portfolio/monthly-pl`, `portfolio/quarterly-pl`, `combined-monthly-pl`, `combined-quarterly-pl` |
| NAV chart in real NAV scale, from inception, benchmark scaled to the same start | `navSeries()`, `niceAxis()`, `buildPaths()` in `src/adapt.js`; `hasRaw`, `cPts`, `cBench`, `axis` in `vals()`; default `range: 'All'` | `portfolio/nav`, `combined-nav` (`nav` and `benchmarkValue` fields) |
| 1W = 5 rows back | none (displays `w1`) | `rowsBack(5)` and `bRows[5]` in `portfolio/performance` and `combined-performance` |
| 10D = the benchmark's 10th trading date | none (displays `d10`) | `bRows[10]` / `tenDKey` in the same two routes |
| Since inception anchored at NAV 10 the day before inception | none (displays `returnsPercent`, `sinceInception`) | `needsSyntheticAnchor`, `siBaseNav`, `siBaseDate` in the same two routes |
| Colour: green / red / neutral | `c()` in `vals()`; `C.pos`, `C.red`, `C.muted` in `src/ui.js` | none |

All backend paths are under `../myQode/app/api/mobile/`.

## 1. Profit & Loss uses calendar years

The rule:

- Years are calendar years, January to December. Not Indian fiscal years.
- Quarters are calendar quarters: Q1 = Jan–Mar, Q2 = Apr–Jun, Q3 = Jul–Sep, Q4 = Oct–Dec.
- Inside a year, months run January → December. Years are listed newest first.
- The year total (₹ and %) is the API's `total` field. The app does not add up the months. The % total in particular is not a sum: the server computes it from the year's start and end NAV.

App:

- `buildFys(monthly)` in `src/adapt.js` reads `rupeeData` and `percentData` rows (`{ year, jan…dec, total }`). It produces one entry per year: `{ label, m, tv, tp }`. `m` is a list of `[label, ₹, %, note, monthIndex]` sorted by month index ascending. `tv` and `tp` are the API totals. Years with no cells are dropped. Years are sorted descending.
- `buildFysQ(quarterly)` does the same for `{ year, q1…q4, total }` and produces `q` rows `['Q1'…'Q4', ₹, %, note, quarterIndex]`.
- In `vals()` (`src/main.js`): `fySum(f)` returns `f.tv` when the API gave one and only falls back to summing months when it is null. `fyTotalPct` comes from `fy.tp`. `qtr` labels each quarter with `QUARTER_LABELS` from `src/data.js` (`['Q1', 'Jan – Mar']` and so on).
- The pills show the three newest years, then "All Years" when there are more than three.
- The header comment on `buildFys` says months are "newest first". The code sorts them ascending. The code is right; the comment is stale.

Backend:

- `portfolio/monthly-pl/route.ts`: buckets `pms_master_sheet` rows by `getFullYear()` and month. Month % = end NAV / start NAV − 1. Month ₹ = end value − start value − net cash flow in the month. `finalizeYear()` computes the year totals.
- `portfolio/quarterly-pl/route.ts`: `qtr = Math.ceil(month / 3)`, which gives the calendar quarters above.
- `portfolio/combined-monthly-pl/route.ts` and `combined-quarterly-pl/route.ts`: the same for owner and group ids.

CLAUDE.md states the rule as "do not regroup into fiscal years". Variable names such as `fys`, `pnlFy` and `fyLabel` are left over from the design, which used fiscal years. They hold calendar years.

## 2. NAV chart: real NAV scale, from inception, benchmark scaled to the same start

The rule:

- The portfolio line is the actual NAV (for example 10 → 14.2), not an index rebased to 100.
- The benchmark is scaled so that it starts at the portfolio's first NAV in the window. Both lines start at the same point.
- The default window is since inception, and that window is the web chart **exactly** (`enrichedData` in the web page):
  - When the first NAV is not 10, a synthetic row (NAV 10, dated one day before inception) is prepended, so the line starts at 10 like the web's.
  - The benchmark anchor is the index value **on the inception date** (the web fetches the index from inception onwards). No index row that day → the web shows no benchmark line, and neither does the app.
  - Every row is drawn; nothing is thinned. The tooltip lands on the same dates as the web.
  - The y-axis domain is the web's `calculateYDomain`: min/max of both lines padded by 5 % of the range, floored/ceiled to whole NAV units; tick labels with one decimal.
- The shorter ranges (1M … 3Y) are mobile-only: both lines start together at the window start, rounded axis (`niceAxis`).
- The x-axis shows first, middle and last date.

Backend: `portfolio/nav/route.ts` and `portfolio/combined-nav/route.ts` return a `series` of `{ date, portfolio, benchmark, nav, benchmarkValue }`.

- `portfolio` and `benchmark` are rebased to 100 at the first portfolio date in the window (for `ALL` with a synthetic row, that is NAV 10).
- `nav` is the raw NAV. `benchmarkValue` is the raw index level. The route comments say these were added for the tooltip, "same as the web tooltip".
- The benchmark is forward-filled on portfolio dates. Its rebase anchor is the index value on or just before the window start — for `ALL`, exactly on inception (web rule above).
- `period=ALL` uses a 99999-day cutoff, which is effectively inception, plus the synthetic row and the inception-day benchmark rule.
- `portfolio/drawdown` and `combined-drawdown` follow the same `ALL` rules: the peak starts at NAV 10, a 0 % synthetic row is prepended, and the benchmark drawdown needs an index row on the inception date.
- Combined routes always use NIFTY 50 as the benchmark. Per-account routes use the strategy's benchmark from `lib/strategyConfig`.
- The local port for Orbis views and Entire Family (`enrich()` in `src/webcalc.js`) prepends the same synthetic row; `windowed()` allows for it when slicing shorter ranges.

App:

- `navSeries()` in `src/adapt.js` extracts `pts` (rebased), `bench` (rebased, gaps carried forward and back-filled), `dates`, `navs` (raw) and `bvals` (raw). No thinning.
- In `vals()`:
  - `hasRaw` is true when every point has a positive raw NAV.
  - `cPts = hasRaw ? navs : pts`. This is the plotted portfolio series.
  - `cBench = bench.map(b => (b / bench[0]) * cPts[0])`. This scales the benchmark to start at the portfolio's first plotted value.
  - `axis` = `webDomain(...)` for "All" (the web's `calculateYDomain`) or `niceAxis(...)` for the shorter ranges: `lo` / `hi` and three tick labels. `buildPaths(..., [axis.lo, axis.hi])` draws against that fixed domain so the tick labels are exact.
  - `navNow` / `growthNow` print the last NAV with 4 decimals when raw values are present.
- `state.range` defaults to `'All'`, and `PERIOD` maps it to `ALL`.
- The Home chart (`NavChart`) and the Portfolio header chart (`PerfChart`) in `src/screens/charts.js` use the same series and the same axis.
- There is no text summary under the chart (the web has none; it was removed). The tooltip's growth percentage is measured from the first point of the window — for "All" that is the synthetic NAV 10 when one exists, i.e. the web's `baseNav`.

Fallback: if any point lacks a raw NAV, the chart plots the rebased-to-100 series. Demo mode always takes this path, because `src/api/demo.js` does not emit `nav` / `benchmarkValue`.

Two comments in `vals()` still say the chart is "rebased to 100". They predate this rule.

## 3. 1W and 10D count rows, not calendar days

The rule, from `calculateTrailingReturnsForData()` and `getNthTradingDateFromEnd()` in the web page:

- **1W** = the value 5 rows back in the series. Portfolio and benchmark each count in their own series.
- **10D** = the benchmark's 10th trading date from its end (row `length − 1 − 10` of the benchmark series). That exact date is used as the start for **both** the portfolio and the benchmark. If the portfolio has no row on that date, the portfolio 10D is null. If there is no benchmark data, 10D falls back to 10 rows back in the portfolio series.
- 1M, 3M, 6M use month arithmetic with a month-end rule (`getMonthTarget`), absolute return. 1Y and 3Y use the same targets and are annualised.

Backend: `portfolio/performance/route.ts` and `portfolio/combined-performance/route.ts`.

- `rowsBack(5)` → `nav1W`; `rowsBack(10)` → the initial `nav10D`.
- Benchmark rows are sorted descending, so `bRows[5]` is 1W and `bRows[10]` is 10D.
- When the benchmark has more than 10 rows, `tenDKey = dateKey(bRows[10].date)` and the portfolio `d10` is recomputed from the portfolio row with that date.

App: `trailingRows()` in `src/adapt.js` lists `w1, d10, m1, m3, m6, y1, y3, sinceInception` with the benchmark value and the excess. It hides a period when the portfolio value is null. It does no date maths.

Check: `webTrailing()` in `scripts/compare-web.mjs` implements the same rule (`data[data.length - 1 - 5]`, and `tenDDate` from `bench[bench.length - 11]`).

Demo mode does not follow this rule. `trail()` in `src/api/demo.js` uses 7 and 14 calendar days. Demo numbers are illustrative only.

## 4. Since inception is anchored at NAV 10

The rule:

- If the first NAV row is exactly 10, since-inception return is measured from that row.
- If the first NAV is not 10, the account really started at NAV 10 the day before its first row. The return is measured from a synthetic point: NAV 10, dated one day before inception.
- Less than one year since the base date: absolute return. One year or more: CAGR over the actual number of years (days / 365.25).
- This applies to the portfolio only. The benchmark's since-inception return starts from its first row on or after the portfolio's inception date.

Backend: in both performance routes, `needsSyntheticAnchor = firstNav !== 10`, `siBaseNav`, `siBaseDate`, then `inceptionReturn()`. The result is returned twice: as `returnsPercent` and as `trailingReturns.portfolio.sinceInception`.

Web: the same logic is in the web page where it prepends a synthetic row (`needsSyntheticRow`) and where it computes the card value (`needsSyntheticAnchor`).

App: displays `perf.returnsPercent` as "RETURN (SI)" on Home and Portfolio, and per account on Holdings. "EXCESS (SI)" is `P.sinceInception − B.sinceInception`.

Check: `webSummary()` and the `syntheticSI` branch of `webTrailing()` in `scripts/compare-web.mjs`.

## 5. Colour rule

The rule, from `getReturnColor()` in the web page: positive → green (`text-green-600`), negative → red, zero or missing → neutral.

App:

- `const c = v => (v < 0 ? red : v > 0 ? green : C.muted)` in `vals()`, with `green = C.pos` and `red = C.red`.
- `C.pos` is `#16A34A`, the web's green-600. Do not use `C.green` for figures. `C.green` (`#02422B`) is the dark brand green and reads as black on a number.
- `c()` colours: the Home tiles, the Portfolio header row, holdings returns, P&L month / quarter / year values and percentages, and the total-returns flow tile.

Places that do not go through `c()`:

- Drawdown values are always `C.red`, including 0.00%.
- `trailingRows()` only sets `neg`; the trailing cards in `src/screens/tabs.js` use `tr.neg ? C.red : C.pos`, so an exact 0.00% shows green rather than neutral.
- Cash-flow rows: contributions are green, withdrawals are red, by type.
- The chart tooltip (`ChartTip` in `src/screens/charts.js`) prints the growth line in `C.green` whatever its sign.

## Other parity details

- **Amount invested** is the net of all cash flows (inflows minus outflows), as on the web. The app shows it as "NET INVESTED".
- **Closed accounts.** The web hides them. `buildScopes()` drops accounts with `isClosed`. The owner aggregate still includes their history; that is the reason owner scopes use the owner id (see [architecture.md](architecture.md)).
- **Max drawdown** is the most negative `drawdown_percent` in the account's rows. Current drawdown is the last row's value.
- **Number formatting.** `fmt` / `sfmt` on the root component use the `en-IN` locale with two decimals, `₹` prefix, and a true minus sign (`−`). `pct()` in `src/adapt.js` prints two decimals with an explicit sign, and `—` for null.
- **QLF accounts.** The mobile login route removes Qode Liquid Fund codes (`QLF…`) from `accountCodes`, so the app cannot load them even if they exist for the client.
