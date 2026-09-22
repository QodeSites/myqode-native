# API layer

All network code lives in `src/api/`. Screens and the root component import from `src/api/index.js` only.

| File | Purpose |
| --- | --- |
| `src/api/config.js` | Build-time flags: `TEST_MODE`, `DEV_BYPASS`, `APP_VERSION` (`'1.0.0'`). |
| `src/api/client.js` | `BASE_URL`, `api()` fetch wrapper, `ApiError`, `onUnauthorized()`. |
| `src/api/session.js` | Token storage: `getToken`, `setToken`, `clearToken`. |
| `src/api/index.js` | One function per backend route, grouped by area. `BlockedError`, `guarded()`, demo switch. |
| `src/api/demo.js` | Generated sample data for demo mode. |
| `src/api/track.js` | Batched screen analytics. |

The backend contract is in `../myQode/docs/mobile-prompts/complete-api-reference.md`. The route files are under `../myQode/app/api/mobile/`.

See also: [modes-and-testing.md](modes-and-testing.md) for the flags, [architecture.md](architecture.md) for who calls what.

## The fetch wrapper: `api(path, opts)`

`src/api/client.js`.

- URL is `BASE_URL + '/api/mobile' + path`. `BASE_URL` comes from `EXPO_PUBLIC_API_BASE_URL`, default `https://myqode.qodeinvest.com`. A trailing slash is removed.
- Options: `method` (default `GET`), `query` (object; null and empty values are dropped), `body` (sent as JSON), `auth` (default `true`), `timeout` (default 25000 ms, enforced with `AbortController`).
- Headers: `Accept: application/json`, `X-Client-Type: mobile`, `Content-Type: application/json` when there is a body, `Authorization: Bearer <token>` when `auth` is true and a token is stored.
- `fetch` is called with `cache: 'no-store'`.
- A network failure or a timeout throws `ApiError('Unable to reach Qode. Check your connection and try again.')` with `status` 0.
- A non-2xx response throws `ApiError(message, { status, code, data })`. `message` is the response's `error` field, or `Something went wrong (<status>).`. `code` is the response's `code` field (for example `PASSWORD_SETUP_REQUIRED`, `USER_NOT_FOUND`, `ACCOUNT_CLOSED`).
- On success the parsed JSON is returned. If the body is not JSON, `null` is returned.

## Token storage

`src/api/session.js`. Key: `myqode.token`.

- Native: `expo-secure-store`.
- Web: `localStorage`.
- All three functions swallow storage errors. `getToken()` returns `null` on failure.

The token is a JWT issued by `POST /auth/login`. The server signs it for 30 days (12 hours for the virtual admin account, 4 hours for an impersonation token). There is no refresh endpoint. When it expires the user signs in again.

## 401 handling

`api()` calls the handler registered with `onUnauthorized()` when all of these are true: the response status is 401, the call used `auth: true`, and a token was actually sent. It then still throws the `ApiError`.

The root component registers the handler in `componentDidMount`: `onUnauthorized(() => this.expire())`.

`expire()` (in `src/main.js`):

- Does nothing unless `state.phase === 'app'`.
- If `this.origToken` is set (an impersonation is active), it calls `exitImpersonation()`.
- Otherwise it calls `signOut('Your session has expired. Please sign in again.')`.

A 401 from `auth.login` does not trigger the handler, because login uses `auth: false`. The root component turns that 401 into "Incorrect password" (`authFail()`).

At boot, `boot()` validates a stored token with `auth.me()`. If that fails with 401 the token is cleared and the app goes to the carousel.

## Impersonation (super admin)

Backend: `POST /admin/impersonate` returns `{ token, expiresIn, user }`. The token is client-scoped, lasts 4 hours, and carries `isImpersonated: true`. Admin routes reject impersonation tokens (`requireSuperAdmin` in `../myQode/lib/mobileAuth.ts`).

App (`src/main.js`):

- `impersonate(clientCode)`: calls `admin.impersonate`, saves the admin token in `this.origToken` (an instance field, not state, and not persisted), stores the new token with `setToken`, sets `state.user` to the returned user, then `openPortfolio()` (snapshot → scopes → scope data).
- `exitImpersonation()`: restores `this.origToken` with `setToken`, calls `auth.me()`, reloads the snapshot. If that fails it signs out with "Your admin session has expired."
- `signOut()` clears `this.origToken`.

Because `origToken` lives only in memory, killing the app while impersonating leaves the impersonation token in secure storage. On next launch the app boots as the impersonated client, with no way back to the admin session except signing out.

The UI is `AdminPage` in `src/screens/pages.js` (More → Developer → Admin). It is listed only when `user.isSuperAdmin` or `user.isImpersonated` is true.

## `BlockedError` and `guarded()`

`src/api/index.js`.

```js
const guarded = (what, fn) => (...a) =>
  (TEST_MODE && !demoOn ? Promise.reject(new BlockedError(what)) : fn(...a));
```

- `BlockedError` extends `ApiError`. `status` is 0, `code` is `'TEST_MODE'`. The message is `Blocked in test mode: <what>. This would reach the real client. Turn EXPO_PUBLIC_TEST_MODE off for production.`
- A guarded function rejects before any network call when `TEST_MODE` is on and demo mode is off.
- Callers treat it like any other `ApiError`: they show `e.message`. For example, tapping PAUSE on a SIP in test mode shows the blocked message in red under the list (`Investments` in `src/screens/services.js`).

Guarded functions: `auth.sendSetupOtp`, `auth.completeOtpSetup`, `auth.forgot`, `services.registerPushToken`, `services.setupSip`, `services.pauseResumeSip`, `services.cancelSip`, `payments.createOrder`.

Note: when demo mode is on, `guarded()` lets the call through, and these functions call `api()` directly. They have no demo answer. See "Demo mode" below.

## Demo mode

`src/api/index.js` holds a module-level `demoOn` flag, set with `setDemo()` and read with `isDemo()`.

```js
const call = (path, opts, fake) => (demoOn && fake ? mock(fake) : api(path, opts));
```

- Functions built with `call()` or `post()` answer from `src/api/demo.js` when demo mode is on. `mock()` resolves after 350 ms so loading states show.
- `post()` defaults the fake to `inquiry()`, which returns `{ success: true, inquiry_id: 'DEMO-xxxxxx' }`.
- `engagement.analytics` resolves `{ ok: true }` without a network call in demo mode. `track()` also drops events when `isDemo()`.
- `src/api/demo.js` generates a "Mehta" family: three owners (`OWN1001`–`OWN1003`), group `GRP1001`, strategy accounts such as `QAW0412`. NAV paths are seeded random walks that end at a fixed CAGR, so the numbers are stable between runs. Response shapes match the real routes, so demo data flows through the same adapters.
- Demo `nav` and `drawdown` series do not include the raw `nav` / `benchmarkValue` fields. The NAV chart therefore falls back to the rebased-to-100 scale in demo mode (see [web-parity.md](web-parity.md)).
- Document and article `url` fields are `null` in demo data. `openUrl()` in `src/screens/kit.js` shows a "Sample document" alert instead.

Functions that do not have a demo answer and always use the network: everything in `auth` and `admin`, and `services.unregisterPushToken`. The eight guarded functions never use the network in demo mode: `guarded()` returns a mock success (`{ success: true, message: 'Done (demo — nothing was changed).' }`), so the PAUSE/RESUME/CANCEL buttons on the sample SIP are safe to tap.

Demo mode is started by `startDemo()` in `src/main.js` and ended by `signOut()`.

## Analytics batching

`src/api/track.js`.

- `trackStart(userId)` enables tracking, stores the user id (the client code) and creates a new random session id. Called in `boot()` after `auth.me()` and in `finishLogin()`.
- `trackStop()` flushes and disables. Called in `signOut()`.
- `track(type, name, properties)` queues `{ type, name, properties, userId, sessionId, timestamp, platform, appVersion }`. It does nothing when tracking is disabled or demo mode is on.
- `screen(name)` is `track('screen', name)`. The root component calls it in `go(tab)` with the tab name and in `openPage(k)` with `'page:' + k`. No other events are sent today.
- Flush rules: immediately when the queue reaches 50 events, otherwise 20 seconds after the first queued event. A flush sends at most 100 events in one `POST /engagement/analytics`. Errors are ignored and the batch is not retried.
- Tracking is not started by `impersonate()`; events sent while impersonating keep the admin's `userId` but are posted with the impersonation token.

Analytics is not blocked by `TEST_MODE`. It writes to the server's analytics table and never contacts the client.

## Function table

Paths are relative to `/api/mobile`. "Auth" is whether the app sends the Bearer token. "Demo" is whether demo mode answers locally. "TEST_MODE" is whether `guarded()` blocks the call. "Used by" names the caller; "not called" means the wrapper exists but no screen uses it yet.

### `auth`

| Function | Endpoint | Auth | Demo | TEST_MODE | Used by / purpose |
| --- | --- | --- | --- | --- | --- |
| `checkIdentifier(identifier)` | `POST /auth/check-identifier` | No | No | Allowed | `beginSetup()`: turn a client code into an email for first-time setup. |
| `login(username, password)` | `POST /auth/login` | No | No | Allowed | `doLogin()`, and `savePassword()` after setup. Sends `platform` (`ios`/`android`; omitted on web). |
| `loginBypass(username)` | `POST /auth/login` (no password) | No | No | Allowed | `bypassLogin()`: dev sign-in. Works only when the server runs with `NODE_ENV=development`. |
| `devClients()` | `GET /dev/clients` | No | No | Allowed | `loadDevClients()`: client picker for the dev sign-in. Server returns 404 outside development. |
| `sendSetupOtp(email)` | `POST /auth/send-setup-otp` | No | No | **Blocked** | `beginSetup()`, `resendOtp()`. Emails an OTP to the client. |
| `verifySetupOtp(email, otp)` | `POST /auth/verify-setup-otp` | No | No | Allowed | `verifyOtp()`. Checks the code only. |
| `completeOtpSetup(email, otp, newPassword, confirmPassword)` | `POST /auth/complete-otp-setup` | No | No | **Blocked** | `savePassword()`. Changes the client's password. |
| `forgot(email)` | `POST /auth/forgot` | No | No | **Blocked** | `doForgot()`. Emails a web reset link to the client. |
| `me()` | `GET /auth/me` | Yes | No | Allowed | `boot()` token check; `exitImpersonation()`. |

### `meta`

| Function | Endpoint | Auth | Demo | TEST_MODE | Used by / purpose |
| --- | --- | --- | --- | --- | --- |
| `appVersion()` | `GET /app-version` | No | Yes | Allowed | `checkVersion()` at boot. Compares `APP_VERSION` with `minVersion` / `latestVersion` and shows a banner in the dark header. |

### `portfolio`

Every function except `snapshot` takes a `kind` argument (default `'account'`). `pfx(kind)` picks the route family: `'account'` → `/portfolio/<name>`, `'owner'` or `'family'` → `/portfolio/combined-<name>`. The `accountId` query value is the strategy code, owner id or group id.

| Function | Endpoint | Auth | Demo | TEST_MODE | Used by / purpose |
| --- | --- | --- | --- | --- | --- |
| `snapshot()` | `GET /portfolio/snapshot` | Yes | Yes | Allowed | `loadSnapshot()`, `refresh()`. Owners, their accounts and values; input to `buildScopes()`. |
| `performance(id, kind)` | `GET /portfolio/performance` or `/portfolio/combined-performance` | Yes | Yes | Allowed | `loadScope()` for the scope; `loadHoldings()` once per account (always `kind = 'account'`). |
| `nav(id, period, kind)` | `GET /portfolio/nav` or `/combined-nav` | Yes | Yes | Allowed | `loadScope()`, `pickRange()`. NAV chart series. |
| `drawdown(id, period, kind)` | `GET /portfolio/drawdown` or `/combined-drawdown` | Yes | Yes | Allowed | `loadScope()`, `pickRange()`. Drawdown chart series. |
| `monthlyPl(id, kind)` | `GET /portfolio/monthly-pl` or `/combined-monthly-pl` | Yes | Yes | Allowed | `loadScope()` → `buildFys()`. |
| `quarterlyPl(id, kind)` | `GET /portfolio/quarterly-pl` or `/combined-quarterly-pl` | Yes | Yes | Allowed | `loadScope()` → `buildFysQ()`. |
| `cashflow(id, kind)` | `GET /portfolio/cashflow` or `/combined-cashflow` | Yes | Yes | Allowed | `loadScope()`. Recent activity, contributions list, capital-flow totals. |

Periods sent by the app: `1M`, `6M`, `1Y`, `3Y`, `ALL` (the `PERIOD` map in `src/main.js`).

### `documents`

| Function | Endpoint | Auth | Demo | TEST_MODE | Used by / purpose |
| --- | --- | --- | --- | --- | --- |
| `list(accountId)` | `GET /documents/list` | Yes | Yes | Allowed | `DocsCream` in `src/screens/docs.js`. Category list with file counts. |
| `files(category, accountId)` | `GET /documents/files/<category>` | Yes | Yes | Allowed | `Category` in `src/screens/docs.js`, loaded when a category is opened. Files with short-lived signed URLs. |

Documents are always requested per strategy account code. `REQS` in `src/screens/pages.js` notes that owner and family ids return 404 here.

### `engagement`

| Function | Endpoint | Auth | Demo | TEST_MODE | Used by / purpose |
| --- | --- | --- | --- | --- | --- |
| `newsletters()` | `GET /engagement/newsletters` | Yes | Yes | Allowed | `Insights` page. |
| `perspectives()` | `GET /engagement/perspectives` | Yes | Yes | Allowed | `Insights` page. |
| `events()` | `GET /engagement/events` | Yes | Yes | Allowed | `Insights` page. |
| `portalGuide()` | `GET /engagement/portal-guide` | Yes | Yes (empty lists) | Allowed | `Guide` page. Only `videos` is rendered. |
| `referral(body)` | `POST /engagement/referral` | Yes | Yes (`inquiry()`) | Allowed | `Referral` page. Emails Investor Relations. |
| `analytics(events)` | `POST /engagement/analytics` | Yes | Yes (no-op) | Allowed | `flush()` in `src/api/track.js`. |

### `experience`

| Function | Endpoint | Auth | Demo | TEST_MODE | Used by / purpose |
| --- | --- | --- | --- | --- | --- |
| `family()` | `GET /experience/family` | Yes | Yes | Allowed | `Family` page: group → owner → accounts. |

### `services`

| Function | Endpoint | Auth | Demo | TEST_MODE | Used by / purpose |
| --- | --- | --- | --- | --- | --- |
| `bankDetails()` | `GET /services/bank-details` | Yes | Yes | Allowed | "Add funds" sheet. |
| `transactions(accountId)` | `GET /services/transactions` | Yes | Yes | Allowed | `Investments` in `src/screens/services.js`. Fetched with `investmentStatus`; the result is loaded but the list is built from `investmentStatus` only. |
| `withdrawal(body)` | `POST /services/withdrawal` | Yes | Yes (`inquiry()`) | Allowed | `FORMS['r-withdraw']`. |
| `switchStrategy(body)` | `POST /services/switch` | Yes | Yes (`inquiry()`) | Allowed | Not called any more (replaced by the Zoho-model switch request below). |
| `documents.list` / `documents.files` | `GET /documents/list`, `GET /documents/files/{category}` | Yes | Yes | Allowed (read-only) | Cached per account for the session (`documents.warm()` at `startApp` for the first account; file lists expire after 4 min because the S3 links are 5-minute signed URLs). `documents.forget()` runs inside `clearUserCaches()`. |
| `switchRequestInfo(onFresh)` | `GET /services/switch-request` | Yes | Yes (`switchInfo()`) | Allowed (read-only) | `src/screens/switch.js`: investors on the login email, QAW/QTF/QGF invested, pending request, `dryRun` flag. Cached in memory: `warmSwitchInfo()` fetches it at boot / `startApp` / impersonation so the sheet opens instantly; a copy older than 60 s is refreshed in the background and handed to `onFresh`. `clearUserCaches()` on sign-out; a submit clears it too. |
| `submitSwitchRequest(body)` | `POST /services/switch-request` | Yes | Yes | Allowed — dry run on a dev server unless `SWITCH_REQUEST_LIVE=1` (see modes-and-testing.md) | `src/screens/switch.js`. Creates a `Strategy_Switch_Requests` record in Zoho. |
| `strategyInquiry(body)` | `POST /services/strategy-inquiry` | Yes | Yes (`inquiry()`) | Allowed | `FORMS['r-strategy']`. |
| `discussion(body)` | `POST /services/discussion` | Yes | Yes (`inquiry()`) | Allowed | `FORMS['r-discussion']`. |
| `accountRequest(body)` | `POST /services/account-request` | Yes | Yes (`inquiry()`) | Allowed | `FORMS['r-account']`. |
| `registerPushToken(pushToken)` | `POST /services/register-push-token` | Yes | No | **Blocked** | Not called. Push is not built. |
| `unregisterPushToken(pushToken)` | `DELETE /services/register-push-token` | Yes | No | Allowed | Not called. |
| `setupSip(body)` | `POST /services/setup-sip` | Yes | No | **Blocked** | Not called. Needs the Cashfree SDK. |
| `verifySip(subscriptionId)` | `GET /services/verify-sip` | Yes | Yes | Allowed | Not called. |
| `pauseResumeSip(subscription_id, accountId, action)` | `POST /services/pause-resume-sip` | Yes | No | **Blocked** | PAUSE / RESUME buttons in `Investments`. |
| `cancelSip(subscription_id, accountId)` | `POST /services/cancel-sip` | Yes | No | **Blocked** | CANCEL SIP button in `Investments`. |

The five request routes and the referral route send one email to `investor.relations@qodeinvest.com` and return an `inquiry_id`. They do not email the client. That is why `TEST_MODE` lets them through.

### `payments`

| Function | Endpoint | Auth | Demo | TEST_MODE | Used by / purpose |
| --- | --- | --- | --- | --- | --- |
| `createOrder(body)` | `POST /payments/create-order` | Yes | No | **Blocked** | Not called. Needs the Cashfree SDK. |
| `verify(orderId)` | `GET /payments/verify` | Yes | Yes | Allowed | Not called. |
| `investmentStatus(accountId)` | `GET /payments/investment-status` | Yes | Yes | Allowed | `Investments`: list of online orders and SIP mandates with status and timeline. |

### `admin`

Super-admin only. The token must carry `isSuperAdmin` and must not be an impersonation token.

| Function | Endpoint | Auth | Demo | TEST_MODE | Used by / purpose |
| --- | --- | --- | --- | --- | --- |
| `clients(search, page, limit)` | `GET /admin/clients` | Yes | No | Allowed | `AdminPage`: loads up to 500 clients once, filters locally. |
| `impersonate(clientCode)` | `POST /admin/impersonate` | Yes | No | Allowed | `impersonate()` in `src/main.js`. |
| `analytics(days)` | `GET /admin/analytics` | Yes | No | Allowed | Not called. |

## Loading data in a screen

Screens outside the root component use `useLoad(fn, deps)` from `src/screens/kit.js`. It returns `{ loading, data, err, reload }`, reruns when `deps` change, and ignores a response that arrives after the effect was cleaned up. Screens that should refetch on the header refresh button include `V.rk` in `deps` (for example `DocsCream` and `Investments`).
