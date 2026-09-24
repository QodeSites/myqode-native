# Modes and testing

The app has three build-time flags and one runtime mode. There is no lint, typecheck or test tooling in `package.json`. The only automated check is `scripts/compare-web.mjs`.

See also: [api.md](api.md) for the per-function table.

## Where the flags live

`.env` in the project root. `src/api/config.js` and `src/api/client.js` read the values.

| Key | Read in | Meaning |
| --- | --- | --- |
| `EXPO_PUBLIC_API_BASE_URL` | `src/api/client.js` (`BASE_URL`) | Server base URL, no trailing slash. Default when unset: `https://myqode.qodeinvest.com`. |
| `EXPO_PUBLIC_TEST_MODE` | `src/api/config.js` (`TEST_MODE`) | `1` or `true` blocks every action that could reach a real client. |
| `EXPO_PUBLIC_DEV_BYPASS` | `src/api/config.js` (`DEV_BYPASS`) | `1` or `true` shows the passwordless sign-in card on the login screen. |

Facts to keep in mind:

- `EXPO_PUBLIC_*` values are inlined into the JavaScript bundle by Expo at build time. Restart `npm start` after changing `.env`. Do not put secrets in these keys.
- Only the strings `1` and `true` count as on (`on()` in `src/api/config.js`).
- The current `.env` holds no secrets: a LAN URL and the two flags, both on. `.gitignore` ignores `.env*.local` but not `.env`, and `.env` is currently untracked.
- `APP_VERSION` is a constant in `src/api/config.js` (`'1.0.0'`), not an env value.

## `EXPO_PUBLIC_API_BASE_URL`: LAN IP vs localhost

The local backend is the sibling repo `../myQode`. Its `npm run dev` script is `next dev -p 2069`.

- Phone with Expo Go: use the computer's LAN IP, for example `http://192.168.x.x:2069`. `localhost` on a phone is the phone itself, so it will not reach your dev server. The phone and the computer must be on the same network.
- iOS simulator or `npm run web` on the same machine: `http://localhost:2069` works.
- Unset: the app talks to production, `https://myqode.qodeinvest.com`.

The login screen's dev card prints the active server (`Server: <BASE_URL>`), and the dev-client error message appends it too. Check it first when nothing loads.

For `npm run web`, the browser enforces CORS. The backend answers preflight requests with an allow-list (`ALLOWED_ORIGINS` env, default `http://localhost:3000` and `http://localhost:19006`; see `../myQode/middleware.ts`). If the web preview cannot reach a local server, check that list.

## `EXPO_PUBLIC_TEST_MODE`

Purpose: the team tests with real client accounts. Nothing the tester does may email, notify or charge that client, or change their credentials.

Mechanism: `guarded()` in `src/api/index.js` wraps the risky functions. When `TEST_MODE` is on and demo mode is off, the wrapped function rejects with `BlockedError` before any request is made. The UI shows the error message.

### What is blocked

| Function | Route | Why |
| --- | --- | --- |
| `auth.sendSetupOtp` | `POST /auth/send-setup-otp` | Emails an OTP to the client. |
| `auth.completeOtpSetup` | `POST /auth/complete-otp-setup` | Changes the client's password. |
| `auth.forgot` | `POST /auth/forgot` | Emails a reset link to the client. |
| `services.registerPushToken` | `POST /services/register-push-token` | Stores the tester's device token against the client in `client_push_tokens`, which the server uses to send that client's investment notifications. |
| `services.setupSip` | `POST /services/setup-sip` | Creates a Cashfree SIP mandate. |
| `services.pauseResumeSip` | `POST /services/pause-resume-sip` | Changes the client's SIP. |
| `services.cancelSip` | `POST /services/cancel-sip` | Cancels the client's SIP. |
| `payments.createOrder` | `POST /payments/create-order` | Creates a Cashfree payment order. |

Effect on the login flow: a client who has never set a password gets `PASSWORD_SETUP_REQUIRED` from login. The app then calls `sendSetupOtp`, which is blocked, so first-time setup cannot be completed in test mode. "Forgot password" is also blocked. Use the dev bypass to sign in as such a client.

### What still goes through, and why

| Calls | Why they are allowed |
| --- | --- |
| All `GET` data routes (portfolio, documents, engagement lists, family, bank details, transactions, investment status, verify routes) | Read-only. |
| `auth.login`, `auth.loginBypass`, `auth.checkIdentifier`, `auth.verifySetupOtp`, `auth.me`, `auth.devClients` | They do not contact the client. Note that login does write to the database: see "Side effects of signing in" below. |
| `services.withdrawal`, `switchStrategy`, `strategyInquiry`, `discussion`, `accountRequest`, `engagement.referral` | Each sends one email to `investor.relations@qodeinvest.com` only (see the `to:` field in each route under `../myQode/app/api/mobile/services/` and `engagement/referral/`). The client is not emailed. **Investor Relations does receive a real email**, so say in the text that it is a test, or tell IR beforehand. |
| `services.setupSip`, `verifySip`, `pauseResumeSip`, `cancelSip`, `registeredBank` | Razorpay Subscriptions (`../myQode/app/api/mobile/services/*-sip`). Deliberately **not** guarded, like `payments.razorpay.*`: with `rzp_test_` keys the mandate is registered against Razorpay's demo bank (nothing real), Razorpay's own client emails/SMS are off (`customer_notify: 0`), placeholder email/phone go to the gateway, and the server never notifies the client. **All of this follows the keys, not code paths** (`shouldNotifyClient()` in `../myQode/lib/razorpay.ts`): with live `rzp_live_` keys Razorpay's mandate/charge emails+SMS and our own notifications are on with nothing else to change — `RAZORPAY_NOTIFY_CLIENT=true|false` only overrides. The registered bank account (`pms_clients_tracker.pms_clients_bank_details`) is prefilled into the mandate form — that is data sent to the gateway, not a message to the client. In **live** mode the client's bank/NPCI itself sends the mandate-registration SMS, which is expected and correct. Abandoned set-ups are voided by the app and expire on Razorpay after 2 days. |
| `services.switchRequestInfo` | Read-only Zoho lookups: the Investors records on the login email and their Pending switch requests. |
| `services.submitSwitchRequest` | Dev server (`NODE_ENV` ≠ production): validated only, nothing created (`dryRun: true`). With `SWITCH_REQUEST_LIVE=1` in `../myQode/.env` the `Strategy_Switch_Requests` record IS created, with `trigger: []` so Zoho runs no workflow, approval or blueprint — nobody is notified. The record still blocks that investor with "request in progress", so delete it in the CRM after the test. Production creates with `trigger: ['workflow']` (the RM notification lives in that CRM workflow). |
| `engagement.analytics` | Writes analytics rows on the server. Never contacts the client. Events are recorded under the client you are signed in as. |
| `services.unregisterPushToken` | Removes a token; it cannot cause a notification. Not called by any screen today. |
| `admin.*` | Admin reads and impersonation. `admin.impersonate` issues a token; it does not contact the client. |

### How you can tell it is on

A red tag `TEST MODE · CLIENT CONTACT BLOCKED` is shown at the top of the dark header (`DarkZone` in `src/screens/appshell.js`). It adds `· IMPERSONATING` during impersonation. The tag is hidden in demo mode (`V.testMode = TEST_MODE && !isDemo()`).

It must be `0` for production builds. Otherwise real clients cannot set or reset passwords or manage SIPs.

### Side effects of signing in

`POST /auth/login` (`../myQode/app/api/mobile/auth/login/route.ts`) does this on every successful sign-in, including the dev bypass:

- Updates `last_login_at`, `login_count`, `last_app_login_at`, `app_login_count`, `first_app_login_at` (and the iOS/Android counters when `platform` is sent) on the client's rows in `pms_clients_master`.
- Inserts one row into `login_events`.

`TEST_MODE` cannot prevent this. The client is not notified, but their login history will show your test sign-ins. Restoring a saved token at launch (`auth.me`) does not add a row.

## `EXPO_PUBLIC_DEV_BYPASS`

What it does in the app:

- Shows a "DEV · Sign in without password" card on the login screen (`Login` in `src/screens/login.js`).
- "SIGN IN AS THIS USER (NO PASSWORD)" calls `bypassLogin()` with whatever is typed in the email / client code field. That posts `/auth/login` with a username and no password (`auth.loginBypass`).
- Opening the card loads `GET /dev/clients` and lists up to 40 matches for the search box. Tapping a client signs in as them (using the client's email, or the client code if there is no email). The list only contains clients with `clienttype = 'Discretionary'`, an email and a client code. For other accounts, type the code and use the button.

Server requirement: the backend must run with `NODE_ENV=development` (`npm run dev` in `../myQode`).

- In development the login route skips every password check for normal clients (`isDevelopment` in the login route).
- In any other environment a login without a password returns 400, and `/dev/clients` returns 404. The app shows "Client list is only available when the server runs in development."
- `bypassLogin()` replaces the server's refusal (400 "Fields required…" from a non-development server, or 401 "Invalid credentials") with a hint to run the server in development.
- Two accounts always need their password, even in development: the store-reviewer account and the virtual admin account. They are checked before the bypass.

The flag only shows UI. It gives no access against a production server. Still, turn it off for production builds so the card is not shipped.

## Demo mode

Start it from the login screen: "Explore a demo with sample data" (`startDemo()` in `src/main.js`).

- `setDemo(true)` makes every `call()` / `post()` wrapper answer from `src/api/demo.js` after a 350 ms delay.
- The user is set to a hard-coded sample user. No token is stored.
- A gold `DEMO · SAMPLE DATA` tag shows in the header. The `TEST MODE` tag is hidden.
- Analytics is off.
- Request forms return a fake reference (`DEMO-xxxxxx`). Documents have no URL and show a "Sample document" alert.
- Sign out ends demo mode.

Limits: functions without a demo answer still use the network (see "Demo mode" in [api.md](api.md)). The visible case is the PAUSE / RESUME / CANCEL buttons on the sample SIP, which return an auth error from the server.

Demo mode needs no server and no `.env`. The app-version check at boot runs before demo mode is on, so that one request still goes to `BASE_URL`; its failure is ignored.

## `scripts/compare-web.mjs`

Checks that the mobile API returns the same numbers as the web portfolio page for one client.

```sh
node scripts/compare-web.mjs <clientCode> [baseUrl]
```

- `baseUrl` defaults to `http://localhost:2069`.
- Needs Node 18 or later (it uses global `fetch` and top-level `await`).
- Needs the backend in development: it signs in with `POST /api/mobile/auth/login` and a username only.
- It sends nothing to the client. **Each run adds one login-history row for that client** (the `login_events` insert and login counters described above). Do not loop it.

What it does, for every code in the login response's `user.accountCodes` (strategy codes, owner ids and the group id):

1. Web side: fetches the raw rows the web page uses. `/api/portfolio-history?nuvama_code=` for strategy codes (codes matching `Q` + two letters + digit), `/api/portfolio-history-by-code?account_code=` for owner and group ids. Benchmark rows come from `/api/getIndices`.
2. Runs those rows through formulas ported from the web page `../myQode/app/(protected)/portfolio/performance/page.tsx` (`webTrailing()` and `webSummary()` in the script).
3. App side: fetches `/api/mobile/portfolio/performance` or `/combined-performance` with the Bearer token.
4. Prints one line per value.

Reading the output:

```
=== QAW00012 ===
  portfolio inception 2023-07-03 · benchmark first row 2023-07-03 · web benchmark SI start 2023-07-03
  612 portfolio rows · first NAV 10 · as of 14 Jul 2026 · NIFTY 50 (598 rows, last 2026-07-14) · web 10D start 2026-06-30
  ok   Amount invested             web       5000000.00   app       5000000.00
  DIFF Portfolio d10               web             1.42   app             1.38
```

(The numbers above are made up to show the format.)

- The two header lines give the context: inception date, first NAV (if it is not 10 the synthetic anchor applies), the benchmark name and its row count, and the date the web uses as the 10D start.
- `ok` means web and app agree within the tolerance: 0.01 for rupee values, 0.005 for percentages. `DIFF` means they do not. `-` means the value is null on that side; null on both sides counts as `ok`.
- Compared values: amount invested, current value, total returns, returns %, portfolio trailing returns (`w1`, `d10`, `m1`, `m3`, `m6`, `y1`, `y3`, `sinceInception`), current and max drawdown, and the same trailing periods for the benchmark.
- Closed accounts are skipped ("web hides these"). Codes with no history rows print `no history rows`.
- The last line is either `All compared values match.` or `<n> value(s) differ between web and app.` The exit code is 0 either way, so read the last line.

A `DIFF` means a backend mobile route has drifted from the web formulas. The rules are listed in [web-parity.md](web-parity.md).

## Pre-production checklist

Derived from the code. Items the repo does not cover (store listings, signing) are out of scope here.

- [ ] `EXPO_PUBLIC_TEST_MODE=0`. Confirm the red tag is gone and that "Forgot password" sends an email on a test account you own.
- [ ] `EXPO_PUBLIC_DEV_BYPASS=0`. Confirm the DEV card is not on the login screen.
- [ ] `EXPO_PUBLIC_API_BASE_URL` is the production URL (or unset, which defaults to it). No LAN IP in the bundle.
- [ ] The production server does not run with `NODE_ENV=development`. Check: a login without a password returns 400 and `/api/mobile/dev/clients` returns 404.
- [ ] `APP_VERSION` in `src/api/config.js` matches `expo.version` in `app.json` (both are `1.0.0` today). On the server, `APP_MIN_VERSION` / `APP_LATEST_VERSION` are set sensibly. The server's default latest version is `1.1.2`, so an app at `1.0.0` shows "Update available" until one side changes.
- [ ] `app.json` still has the scaffold `name` / `slug` (`myqode-native`) and no bundle identifier or Android package. Set them before a store build.
- [ ] Decide what to do with unfinished entry points that are visible to every user: "Begin your journey" (static onboarding demo), "Explore a demo", More → Developer → "Data requirements & API coverage", and the "PAY ONLINE · NOT YET AVAILABLE" card. See [known-gaps.md](known-gaps.md).
- [ ] Run `node scripts/compare-web.mjs <code>` against a development server for a few clients (single account, multi-strategy owner, head of family). Expect `All compared values match.`
- [ ] Sign in with a real password on a device, kill the app, reopen: it should skip the login screen (token restore in `boot()`).
- [ ] `npx expo-doctor` reports no dependency problems.
