# Known gaps

What is not built, or is built but waiting for backend data or native work.

Sources: the `REQS` array in `src/screens/pages.js` (shown in the app under More → Developer → "Data requirements & API coverage"), the payment and SIP notes in `src/screens/services.js`, and placeholder values in `vals()` in `src/main.js`. When you close a gap, update `REQS` as well; it is the in-app copy of this list.

Every `/api/mobile/*` route has a wrapper in `src/api/index.js`. Having a wrapper does not mean a screen uses it. Wrappers that nothing calls yet are marked in [api.md](api.md).

## Needs new backend data or endpoints

| Gap | What exists today | What is needed |
| --- | --- | --- |
| XIRR, TWRR, Sharpe, Sortino, beta, "today's change" | The API does not compute them. The design elements that showed them were removed. `credItems` in `vals()` is an empty array, so the "Credibility metrics" block in `DetailedMetrics` (`src/screens/tabs.js`) never renders. | Compute them server-side in `/portfolio/performance` from `pms_master_sheet` cash flows and daily NAV, or accept that they stay off the app. |
| Stock-level holdings | The Holdings tab lists strategy accounts only, each with value and return from its own `performance` call. | Security-level holdings are with the custodian (Nuvama WealthSpectrum), not in `pms_master_sheet`. Needs a nightly import into a new holdings table and `GET /api/mobile/portfolio/holdings?accountId`. |
| More document types | `documents/list` and `documents/files/{category}` serve four S3 folders per client id: `pms-agreement`, `account-opening`, `cml`, `disclosures`. Links are signed for 5 minutes. | Monthly statements, factsheets, capital-gains reports and fee invoices are not uploaded under `docs/client-documents/{clientid}/`. Add the folders and the category ids in `documents/list`; the app shows new categories without a code change. Owner and family ids return 404, so the app always asks per account code. |
| Request history | Withdrawal, switch, strategy inquiry, discussion, account request and referral each return only an `inquiry_id`. The app shows it once on the success view. | `GET /api/mobile/services/inquiries`, reading `pms_clients_tracker.qode_microsite_inquiries` by `user_email`. |
| Notifications inbox (bell icon) | The bell opens `NotifsSheet`, which always shows "Nothing needs your attention right now." `vals()` hard-codes `hasNotif: false`, `notifList: []`, `needsYou: false`, `svcPending: false`. | A notifications table written wherever the server calls `notifyClientById`, plus `GET /api/mobile/notifications`. Then feed `notifList`, `hasNotif`, the Home "needs you" banner and the Services "transfer processing" headline from it. |
| Profile, KYC, bank and nominee details | The More tab shows name, email and client code from `auth/me`. | `GET /api/mobile/profile` from `pms_clients_master` (masked PAN, address, mobile, bank, nominee, KYC status). Edits should stay request-based through `services/account-request`. |
| Nuvama primary UCC notice | Done: `GET /api/mobile/primary-ucc` (`lib/primaryUcc.ts` with the mobile JWT), shown as a once-per-sign-in pop-up (`src/screens/ucc.js`). The web shows it as a banner on every page until dismissed, remembered per code set in localStorage. | — |
| In-app password reset | `auth/forgot` emails a link that opens the web reset page. | `POST /api/mobile/auth/reset { token, newPassword }`, or deep-link `myqode.qodeinvest.com/reset-password` into the app. |
| Family mapping edits | `experience/family` is read-only. Changes go through `services/account-request` (an email to Investor Relations). | A self-service endpoint, if the business wants one. |
| Insights, events, portal guide content | The lists read S3 prefixes (`docs/newsletters`, `docs/prespectives`, `docs/events`, `videos/reports-tutorial`, `images/reports-snapshot`). Report descriptions are static text in `src/content.js` (`REPORTS`). | The lists stay empty until files exist in those prefixes. The Guide page renders `videos` only; `snapshots` from `portal-guide` are fetched but not shown. |

## Needs native work (cannot run in Expo Go)

| Gap | What exists today | What is needed |
| --- | --- | --- |
| Pay online (one-time payment) | `payments.createOrder` and `payments.verify` wrappers exist but nothing calls them. The Services tab shows a card: "PAY ONLINE · NOT YET AVAILABLE IN THE APP". "Add funds" shows bank transfer details only and says online payments are coming later. | The Cashfree React Native SDK (`react-native-cashfree-pg-sdk`). It contains native code, so it needs an EAS development build. Flow: `create-order` → SDK with `paymentSessionId` → `payments/verify` → poll `payments/investment-status`. `createOrder` is blocked in test mode. |
| New SIP mandate | `services.setupSip` and `services.verifySip` wrappers exist but nothing calls them. | Same SDK and build requirement. `setupSip` is blocked in test mode. |
| Existing SIPs | Working: the "Online investments & SIPs" list (`Investments` in `src/screens/services.js`) reads `payments/investment-status` and offers PAUSE / RESUME / CANCEL, which call `pause-resume-sip` and `cancel-sip`. | Nothing native. These actions are blocked in test mode, so they have only been exercised against the block. `services/transactions` is fetched alongside but its result is not rendered. |
| Push notifications | `services.registerPushToken` / `unregisterPushToken` wrappers exist but nothing calls them. `expo-notifications` is not in `package.json`. | `expo-notifications`, an EAS project id, and Firebase (FCM) credentials for Android. Then register after login and unregister on sign-out. Registration is blocked in test mode. |
| Installable builds | `app.json` has the scaffold name and slug, and no iOS bundle identifier or Android package. There is no `eas.json`. | App identifiers, icons, an EAS configuration. |

## Built as a static demo only

| Gap | What exists today | What is needed |
| --- | --- | --- |
| New-investor onboarding | "Begin your journey" on the login screen opens an 8-step flow (`src/screens/onboarding.js`, state in `state.ob`, values from `obVals()` in `src/main.js`). Nothing is sent anywhere. The OTP step accepts any six digits, document rows flip to "done" on tap, the tracker and application number are hard-coded, and sample data comes from `src/data.js`. | A full onboarding backend: application record, OTP, document upload to S3, risk profile, nominees, e-sign / KYC. `REQS` says to keep it disabled until then; it is currently reachable from the login screen. |

## Smaller unfinished items

- **App update prompt.** `checkVersion()` sets `state.update` and the header shows a banner. A required update only makes the banner non-dismissible; it does not block the app. The banner has no link: `updateUrls` from `/app-version` are not used. The server's `forceUpdate` flag is ignored; only `minVersion` and `latestVersion` are compared.
- **Admin analytics.** `admin.analytics` has a wrapper and no screen.
- **Analytics events.** Only tab changes and page opens are tracked (`screen()` calls in `go()` and `openPage()`).
- **Pull to refresh.** Not implemented. Refresh is the header button plus the return-to-foreground refresh. A comment above `refresh` in `src/main.js` still mentions pull-to-refresh.
- **Accessibility settings are not saved.** Text size, high contrast and reduced motion live in `state` and reset on restart.
- **Impersonation does not survive a restart.** The admin token is held in memory only. See "Impersonation" in [api.md](api.md).
- **Leftover design code.** `MoneySheet` in `src/screens/sheets.js` and `src/screens/success.js` are not rendered by the app shell. Most exports in `src/data.js` are no longer imported; `src/main.js` uses `QUARTER_LABELS` and the onboarding constants, and `onboarding.js` uses `ARTICLES`.
- **Distributor portal.** Out of scope for this app.
- **README.md is out of date.** It describes the original design demo: "static demo data (no backend)", FY tabs in P&L, an OTP step at login, and an Add Funds / Withdraw sheet with a payment-success screen. Use CLAUDE.md and these docs instead.

## Added after this file was first written

- **Legacy Orbis accounts** have the web's three views (`GET /api/mobile/portfolio/history` + `src/webcalc.js`).
- **Razorpay one-time top-ups** are live in Add Funds → Pay online (hosted Checkout in a WebView). SIP mandates via Razorpay are not built.
