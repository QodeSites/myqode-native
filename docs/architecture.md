# Architecture

Plain JavaScript, Expo SDK 57, React Native 0.86. No TypeScript, no Expo Router, no navigation library, no state library. One class component holds all state and passes one object down.

`src/main.js` was being edited while this was written (scope fallback, back-button handling). The description below matches the file as read; check the code if something looks different.

## Files

| Path | Purpose |
| --- | --- |
| `index.js` | `registerRootComponent(App)`. |
| `App.js` | Loads Playfair Display, Lato and Inter with `useFonts`. Shows a dark blank view until they load. Wraps `MyQode` in `SafeAreaProvider`. |
| `src/main.js` | `MyQode`, the root class component. State, data loading, auth flows, `vals()`, `render()`. |
| `src/adapt.js` | Pure functions: API shapes → view data. |
| `src/ui.js` | Design system: colours `C`, `UICtx`, `Tx`, `Amt`, `Card`, `CTA`, `Chip`, `Field`, `OtpRow`, `CurveCap`, `Sheet`, `Skel`, `Rise`, `Fade`, `Toggle`. |
| `src/icons.js` | SVG icons (react-native-svg). |
| `src/api/` | Network layer. See [api.md](api.md). |
| `src/content.js` | Static copy taken from the web app's pages (philosophy, FAQ, legal, contact, report list). |
| `src/data.js` | Leftover design sample data. Still used: `QUARTER_LABELS` and the onboarding constants. |
| `src/screens/appshell.js` | The signed-in frame: header, dark zone per tab, cream zone per tab, bottom nav, sheets, page host. |
| `src/screens/tabs.js` | Cream-zone content for Home, Portfolio and Holdings, plus skeletons. |
| `src/screens/docs.js`, `services.js`, `more.js` | The other three tabs. `services.js` also holds the request sheets and the config-driven `FormBody`. |
| `src/screens/pages.js` | Full-screen pages opened from More (`PageHost`, `PAGES`), including the Developer pages. |
| `src/screens/sheets.js` | Notifications, account switcher and settings sheets. |
| `src/screens/charts.js` | `NavChart`, `PerfChart`, `DrawdownChart`, `Donut`, and the `ChartTip` tooltip. |
| `src/screens/kit.js` | `useLoad`, `openUrl`, `Loading`, `ErrorBox`, `Empty`, `SectionLabel`, `LinkRow`, `AccountChips`. |
| `src/screens/splash.js`, `carousel.js`, `login.js`, `curtain.js`, `onboarding.js` | Pre-app screens and the curtain-lift transition. |
| `scripts/compare-web.mjs` | Parity check against the web. See [modes-and-testing.md](modes-and-testing.md). |

## The root component

`MyQode` in `src/main.js` is a port of the design prototype's `DCLogic` class. That is why state keys are short.

All app state is one `this.state` object. Main keys:

| Key | Meaning |
| --- | --- |
| `phase` | Which top-level screen shows. See the phase machine. |
| `tab` | `home`, `portfolio`, `holdings`, `docs`, `services`, `more`. |
| `sheet` | Open bottom sheet: `null`, `switch`, `settings`, `notifs`, or a request key (`r-add`, `r-withdraw`, `r-switch`, `r-strategy`, `r-discussion`, `r-account`). |
| `page` | Open full-screen page key from `PAGES` in `src/screens/pages.js`, or `null`. |
| `acct` | Selected scope. `-1` family, a number = owner index, `'a:<code>'` = one strategy account. |
| `range` | Chart range: `1M`, `6M`, `1Y`, `3Y`, `All`. Default `All`. |
| `user` | The signed-in user from login or `auth/me` (name, email, client code, `accountCodes`, admin flags). |
| `snap`, `scopes` | The snapshot response and the result of `buildScopes()`. |
| `d` | Data for the current scope: `{ id, kind, perf, cash, fys, fysQ }`. |
| `navs` | NAV and drawdown series cached per period: `{ [period]: { nav, dd } }`. |
| `hold` | Per-account `performance` responses for the Holdings tab, keyed by account id. |
| `dl`, `dErr` | Scope data loading flag and error text. |
| `loading` | Short artificial skeleton flag on tab change and app start. |
| `refreshing`, `rk` | Refresh in progress; `rk` is a counter that screens put in `useLoad` deps so they refetch. |
| `ts`, `hc`, `rm` | Accessibility: text scale index, high contrast, reduced motion. |
| `cu` | Count-up progress (0→1) for the hero value on first entry. |
| `ob` | Onboarding demo state. |
| `busy`, `authErr`, `authInfo`, `email`, `pw`, `otp`, `setupEmail`, `np`, `np2` | Login and first-time setup. |
| `pnlFy`, `pnlSeg`, `pnlOpen`, `det` | P&L pill, monthly/quarterly toggle, open year, detailed-metrics open. |
| `update` | App-version banner data. |
| `devOpen`, `devClients`, `devErr`, `devQ` | Dev sign-in card. |
| `toast` | Short message shown at the bottom (used for "Press back again to exit"). |

Instance fields that are not state: `seq` (load counter), `lastLoad`, `origToken` (admin token during impersonation), `fellBack` (scope step-down memory), `tabHist` (tab history for the back button), `counted`, timers and refs.

A few state keys are leftovers from the design and are not read any more (`amt`, `method`, `success`, `docQ`, `docCat`, `cred`).

## Phase machine

`state.phase` decides what `render()` shows. There is no router.

```
splash ──(valid saved token)──────────────────────────────► app
   │
   └─► carousel ─► login ─► app
                     │  ▲
                     │  └── otp ─► setpw ─► app      (first-time password setup)
                     └─► ob                          (static onboarding demo; returns to login)
```

| Phase | Screen | Notes |
| --- | --- | --- |
| `splash` | `Splash` | Shown at least 1.5 s. `boot()` runs meanwhile. |
| `carousel` | `Carousel` | Three "what's new" slides. Skip or finish goes to `login`. |
| `login` | `Login` | Email or client code + password. Also: forgot password, dev sign-in card, demo link, onboarding link. |
| `otp` | `OtpScreen` | Entered when login answers `PASSWORD_SETUP_REQUIRED`. `beginSetup()` resolves the email and sends the OTP. |
| `setpw` | `SetPassword` | After `verifyOtp()`. `savePassword()` completes setup, then logs in. |
| `ob` | `Onboarding` | Static design demo. CLAUDE.md calls this phase `onboarding`; the value in code is `'ob'`. |
| `app` | `AppShell` | Tabs, sheets, pages. |

`boot()`:

1. If a token is stored, call `auth.me()`, put the user in state, start analytics, then `openPortfolio()`.
2. A 401 clears the token. Other errors are ignored and the user goes to the carousel.
3. `checkVersion()` runs in the background.
4. After the minimum splash time: `startApp()` if step 1 worked, else `phase: 'carousel'`.

`startApp()` sets `phase: 'app'`, plays the curtain lift (`lifting`), shows skeletons for 950 ms, and runs the hero count-up the first time only.

`finishLogin(token, user)` stores the token, sets the user, waits for that state to commit (scopes need `user.accountCodes`), then `openPortfolio()` and `startApp()`. `openPortfolio()` swallows non-401 data errors so that a portfolio problem never blocks sign-in; the error shows inside the app with a retry button.

`signOut(msg)` clears the token, demo mode, analytics and all data, bumps `seq` so in-flight loads are dropped, and returns to `login` with an optional message.

Inside `app`:

- `go(tab)` changes tab, records an analytics screen event, keeps a tab history, and shows the skeleton for 380 ms.
- `state.sheet` and `state.page` open overlays. Pages render on top of the shell (`PageHost`).
- `handleBack()` handles the Android back button (and the browser back button on web): close the sheet, else close the page, else walk back through tab history, else go to Home, else ask for a second press to exit. Outside `app` it steps back through onboarding, setup and the carousel.

## The `V` object

`render()` calls `vals()` once and passes the result to every screen as a single prop: `<AppShell V={V} />`, `<Login V={V} />`, and so on. Screens pass `V` further down to their children.

`V` is a flat object with three kinds of entries:

- **Flags** for what to show: `isHome`, `vPortfolio`, `sheetSwitch`, `hasData`, `loading`, `ready`, `hasBench`, `pnlIsYear`, `testMode`, `isDemo`.
- **Display-ready values**: formatted strings (`heroValue`, `asOf`, `navNow`), arrays of rows with their colours already chosen (`tiles`, `perfHead`, `trailing`, `pnlRows`, `holdings`, `flows`, `tx3`, `acctList`), and SVG path strings (`linePath`, `areaPath`, `benchPath`, `ddLine`).
- **Handlers**: `goHome`, `openSwitch`, `closeSheet`, `openPage`, `doLogin`, `refresh`, `retry`, `impersonate`. List items carry their own `pick` function and `active` flag (for example `ranges`, `pnlPills`, `acctList[].subs`).

`obVals()` builds the onboarding entries and is spread into the same object.

Rules that follow from this design:

- Screens in `src/screens/` are presentational. They do not format money, pick colours for figures, or know about scopes. If a screen needs a new value, add it in `vals()`.
- `vals()` runs on every render and recomputes everything, including chart paths. There is no memoisation. Keep it cheap.
- Screens that own their data (documents, services lists, pages) fetch with `useLoad()` from `src/screens/kit.js` and use `V` only for context such as `V.acctOptions` and `V.rk`.

## Scopes

A scope is "whose money is on screen". The backend defines three levels (`../myQode/docs/mobile-prompts/portfolio-scope-levels.md`). The app models them like this:

| Level | `state.acct` | `scope.kind` | `scope.id` | Routes |
| --- | --- | --- | --- | --- |
| Entire family | `-1` | `family` | group id | `/portfolio/combined-*` |
| One person, all strategies | owner index `0..n` | `owner` | owner id | `/portfolio/combined-*` |
| One strategy account | `'a:<code>'` | `account` | strategy code, e.g. `QAW00012` | `/portfolio/*` |

`pfx(kind)` in `src/api/index.js` turns `kind` into the route family.

### Building scopes

`buildScopes(snap, codes)` in `src/adapt.js` turns `/portfolio/snapshot` into `{ owners, family }`.

- `codes` is the signed-in user's `accountCodes` (`codes()` on the root component; `null` in demo mode). These are the only ids the portfolio routes will serve; anything else gets 403. Ids are compared with `normId()`, which strips a trailing `.0` (owner and group ids are stored float-formatted on the server).
- Each owner keeps only accounts that are not closed and are in `codes`. Owners with no accounts left are dropped.
- Owner scope: `kind: 'owner'`, `id` = owner id, `value` = the snapshot's `totalValue`, `accounts` = its strategy accounts.
- Family scope exists only when all of these hold: the snapshot has a `groupId`, there is more than one owner, the group id is in `codes`, and every owner shown belongs to that group.

`curScope()` resolves `state.acct` into a scope object. For `'a:<code>'` it builds an `account` scope on the fly from the matching account. After `loadSnapshot()` the default is the family scope when there is one, else the first owner.

### Why the owner scope uses the owner id

An owner scope uses the owner id and the `combined-*` routes **even when the owner has a single active account**. Do not "optimise" this into the account routes.

- The owner-level aggregate in `pms_master_sheet` carries the owner's full history, including accounts that have since closed. A single account's rows do not.
- It is what the web shows as "All Strategies", so the numbers match the web.
- The combined routes read that pre-aggregated row (`account_code = ownerId`); they do not sum accounts at request time. They always use NIFTY 50 as the benchmark.

Because the two views differ, the account switcher always lists the owner row ("all strategies") and, under it, each strategy account as its own choice (`acctList[].subs`, `SwitchSheet` in `src/screens/sheets.js`).

### Exceptions to that rule (fallbacks)

These fallbacks exist because a login is only authorised for the ids in its `accountCodes`; CLAUDE.md describes the same rule.

- In `buildScopes()`: if the owner id is not in the user's `accountCodes`, the owner scope is created as `kind: 'account'` with the id of the owner's first strategy account.
- In `loadScope()` → `stepDown()`: if `performance` for the scope answers 403 or 404, the app steps down once per scope id. Family → first owner (and the family option is removed for this session). Owner → its first strategy account. `refresh()` keeps a removed family option removed.

## Data loading

`loadSnapshot()` → `buildScopes()` → `loadScope()` → `loadHoldings()`.

`loadScope()`:

1. If there are no scopes yet, run `openPortfolio()` (this is what the retry button hits after a failed snapshot).
2. Resolve the scope. If there is none, show a "no active portfolio" message.
3. `const seq = ++this.seq`.
4. Request six things in parallel with `Promise.allSettled`: `performance`, `nav`, `drawdown` (both for the current range), `cashflow`, `monthlyPl`, `quarterlyPl`.
5. If `seq !== this.seq`, return without touching state.
6. `performance` is required. If it failed: 401 is rethrown, 403/404 tries `stepDown()`, anything else becomes `dErr`. The other five are optional; a failed one becomes `null` and its section renders empty.
7. Store `d` and `navs[period]`, reset the P&L selection, set `lastLoad`.
8. `loadHoldings(scope, seq)`: one `portfolio.performance(accountId)` per account in the scope, with `allSettled`, checked against `seq` again, stored in `hold`.

### The `seq` counter

Every `loadScope()` call increments `this.seq` and remembers its own value. Any response that comes back when the counter has moved on is ignored. This covers quick scope switching, refresh during a load, and sign-out (`signOut()` also increments `seq`). It is the only stale-response guard for root-level data; do not remove the checks.

`pickRange()` uses a lighter guard: it fetches `nav` and `drawdown` for the new period only if that period is not cached in `navs`, and stores the result only if `state.d.id` is still the same scope.

`pickScope(i)` clears `d`, `hold` and `navs` and calls `loadScope()`.

Screen-level loads use `useLoad()`, which ignores results after its effect is cleaned up.

## Refresh

- The header has a refresh button (`Header` in `src/screens/appshell.js`). It calls `refresh()`.
- The app also refreshes when it returns to the foreground, if the last load was more than 60 seconds ago (`AppState` listener in `componentDidMount`).
- There is no pull-to-refresh.

`refresh()`: ignores the call if a refresh is running or the phase is not `app`. It sets `refreshing` and increments `rk`, refetches the snapshot and rebuilds scopes (a snapshot error is ignored and the old scopes stay), then runs `loadScope()`. It does not clear `d` first, so the current numbers stay on screen until the new ones arrive.

`rk` is how screens with their own data join in: `DocsCream` and `Investments` list `V.rk` in their `useLoad` deps.

## Adapters (`src/adapt.js`)

Pure functions. No React, no network.

| Function | Input → output |
| --- | --- |
| `num(v)` | Anything → number or `null`. |
| `pct(v, dp)` | Number → `+1.23%` / `−1.23%` / `—`. |
| `titleCase`, `initials`, `normId`, `semverLt` | Small helpers. |
| `buildScopes(snap, codes)` | Snapshot → `{ owners, family }`. See above. |
| `buildFys(monthly)` | Monthly P&L → calendar years, newest first, months Jan→Dec, totals from the API. |
| `buildFysQ(quarterly)` | Quarterly P&L → calendar years, Q1–Q4. |
| `navSeries(nav)` | NAV or drawdown response → `{ pts, bench, dates, navs, bvals }`. Benchmark gaps are carried forward and back-filled. |
| `niceAxis(values)` | Values → `{ lo, hi, ticks }` with a rounded step and three labels. |
| `buildPaths(pts, bench, w, h, forceMax, domain)` | Series → SVG path strings `line`, `area`, `bench` and point lists `xy`, `bxy` in a `w × h` viewBox with 8 px padding. `domain` fixes the y-range (NAV charts). `forceMax` pins the top value (drawdown uses 0). |
| `trailingRows(perf)` | Performance → rows for 1W, 10D, 1M, 3M, 6M, 1Y, 3Y, SI with benchmark and excess. |
| `flowTotals(cash)` | Cash flow → `{ inflow, outflow }`. |

The P&L and chart adapters implement web-parity rules. Read [web-parity.md](web-parity.md) before changing them.

## Design system (`src/ui.js`)

### `UICtx`

`render()` provides `{ z, hc, rm }` through `UICtx`:

- `z`: text scale, one of `0.92, 1, 1.08, 1.16` (S, M, L, XL).
- `hc`: high contrast.
- `rm`: reduced motion.

They are set in the "Display & accessibility" sheet and are not persisted.

### `Tx` and `Amt`

- **All text goes through `Tx`.** It multiplies the size by `z`, maps the two muted tones to darker ones when `hc` is on (`HC_MAP`), and picks the font from family `f` (`lato`, `inter`, `play`) and weight `w`. Props: `s` size, `c` colour, `ls` letter spacing and `lh` line height (both as multiples of the font size), `center`, `right`.
- **All money and figures go through `Amt`.** Inter, tabular numerals, scaled by `z`. `Amt` does not apply the high-contrast mapping.
- A raw `<Text>` will not scale. `Field` and `OtpRow` apply `z` to their inputs themselves. One exception exists: the search box in `AdminPage` uses a fixed font size.
- Motion components `Rise`, `Fade` and `Sheet` honour `rm`. `Skel` pulses regardless.

### Colours

`C` in `src/ui.js`.

| Token | Value | Use |
| --- | --- | --- |
| `C.ink` | `#002017` | Primary text. |
| `C.green` | `#02422B` | Brand green: buttons, active chips, chart line on cream. Not for figures. |
| `C.gold` | `#DABD38` | Accents, labels on dark, active nav. |
| `C.cream` / `C.card` | `#EFECD3` / `#F7F5E9` | Page background / card background. |
| `C.muted` / `C.gray` | `#37584F` / `#9CA3AF` | Secondary text. These two are deepened in high contrast. |
| `C.red` | `#EF4444` | Negative figures, drawdown, errors. |
| `C.pos` | `#16A34A` | Positive figures. Matches the web's green-600. |
| `C.darkGrad` | three stops | The dark header gradient. |

Figure colours follow one rule: positive `C.pos`, negative `C.red`, zero `C.muted`. It is implemented once, as `c()` in `vals()`. Details and exceptions are in [web-parity.md](web-parity.md).

### Layout conventions

- Every tab has a dark zone (gradient header) and a cream zone joined by `CurveCap`, an SVG arc that stands in for the design's CSS elliptical border radius. The first cream card overlaps the curve with a negative top margin.
- Bottom sheets are React Native `Modal`s (`Sheet`).
- The skeleton is an opacity pulse, not a shimmer gradient.
- README.md asks that these choices be kept rather than replaced with CSS-style approaches that do not exist in React Native.

## Charts and the tooltip (`src/screens/charts.js`)

All charts are react-native-svg, drawn from path strings built in `vals()`.

| Component | Where | ViewBox | Notes |
| --- | --- | --- | --- |
| `NavChart` | Home card | 330 × 120 | Area fill, benchmark in gray, portfolio in `C.green`, three dashed grid lines at the tick positions. |
| `PerfChart` | Portfolio dark header | 358 × 110 | Gold line with a glow stroke, benchmark in gray. Same series and axis as `NavChart`. |
| `DrawdownChart` | Portfolio tab | 330 × 100 | Values ≤ 0, zero line at the top, red area, dashed benchmark. |
| `Donut` | Holdings tab | 120 × 120 | Allocation by account value, drawn from 12 o'clock. |

The SVGs use `preserveAspectRatio="none"`, so they stretch to the container width. `Axes` overlays three y tick labels and prints the x dates under the chart.

`ChartTip` wraps a chart and adds the touch / hover tooltip.

- Input: a `tip` object from `vals()`: `{ kind: 'growth' | 'dd', dates, pts, bench, navs, bvals, xy, bxy, benchName }`. `xy` / `bxy` are the point coordinates from `buildPaths()` in viewBox units.
- It claims the touch responder and refuses to give it up, so the page does not scroll while the user scrubs.
- It uses `pageX` and the chart's measured window position (`measureInWindow`), because `locationX` depends on which child received the touch. Updates are throttled with `requestAnimationFrame`.
- It shows a vertical line, a dot on each series and a white box placed beside the finger. The box hides 3 seconds after release. On web it follows the mouse and hides on leave.
- Content for `growth`: date, "Portfolio Growth" as % change since the first point of the window, the raw NAV when the API sent it, the benchmark's % change, and the raw index value. For `dd`: date, drawdown %, benchmark drawdown %.
- The selection resets when the series changes (the point count or the first or last date).
