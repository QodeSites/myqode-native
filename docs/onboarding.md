# Onboarding (account opening)

The "Begin your journey" flow opens a PMS account against the **onboarding backend** (`onboarding.qodeinvest.com`, the Next.js web wizard's API), not the myQode investor API in `src/api/`. Every route it calls is the same one the web wizard uses, so an application started in the app can be resumed on the web and vice versa.

| File | Purpose |
| --- | --- |
| `src/onboarding/config.js` | `API_BASE` (`EXPO_PUBLIC_ONBOARDING_API_BASE`, default production), timings, upload limits, secure-store keys. |
| `src/onboarding/http.js` | `request()` fetch wrapper → `OnboardingError { code, message, retryable }`. Codes: `offline`, `timeout`, `bad_request`, `not_found`, `locked` (409), `unavailable` (503), `server`, … Messages are investor-safe. |
| `src/onboarding/api.js` | One function per route: `createSubmission`, `getSubmission`, `patchSubmission`, `getProgress`, `uploadDocument`, `startKyc`, `getKyc`, `startEsign`, `getEsign`. |
| `src/onboarding/mapping.js` | Pure: app state (`ob` in `main.js`) ↔ the backend's flat `Submission.data` keys (`primary_fullName`, …), document slots, validation, resume-step logic. **The coded option values live here and must match the web's `lib/form-config.ts`.** |
| `src/onboarding/store.js` | `OnboardingStore`: lazy draft creation, diff-based autosave (800 ms debounce, exponential retry, offline queue), Digio verification polling, uploads, submit, resume. No native imports (api + storage are injected) so `npm test` runs it under node. |
| `src/onboarding/storage.js` | Resume token + submission id in `expo-secure-store`. |
| `src/onboarding/digio-html.js` | The HTML page loaded into the in-app WebView that runs Digio's Web SDK in its **redirection approach** (`is_redirection_approach` + `redirect_url`), plus `parseDigioReturn()` for the exit redirect. The web wizard uses the SDK's popup mode instead; a WebView has no popups, and Digio's iframe mode still opens one for the DigiLocker leg (DigiLocker sends `X-Frame-Options` and cannot be framed), so only top-level navigation works inside the app. |
| `src/screens/verify.js` | `VerifySheet`: the in-app verification window with loading, slow, SDK-error, failed, timed-out and success states. |
| `src/screens/onboarding.js` | The screens, plus `ResumeScreen`. |
| `main.js` → `obVals()` | State + handlers; `resumeFrom()`, `handleResumeUrl()`, `pickFile()`. |

## Flow

1. **begin** — name, email, mobile (held locally; nothing is created yet).
2. **type** — account type. On Continue the draft is created (`POST /api/submissions`) with the right `accountType` and the resume token is stored securely. Creation is queued and retried if it fails; the investor keeps going.
3. **identity** — residency, holder details, then two in-app verifications for individuals: DigiLocker (identity) and ₹1 penny drop (bank). `POST /api/kyc/start` → the sheet opens Digio's SDK in a WebView → `GET /api/kyc/{checkId}` every 3 s. Fetched fields become read-only rows with a VERIFIED badge and are never overwritten by autosave (`primary_kycVerifiedKeys`).
4. **q / result / fee / fin / noms** — unchanged screens; values autosave.
5. **docs** — slots from `docSlotsFor()`; DigiLocker-fetched and bank-waived slots are shown as done; the rest use Camera / Photos / PDF pickers → `POST /api/upload` (≤ 10 MB, PDF/PNG/JPG/WebP).
6. **review** — `validateForSubmit()`, then `PATCH { status: "submitted" }`. The application locks (409 afterwards) and the screen becomes the read-only **tracker**.

Autosave sends only keys that changed since the last acknowledged save (`store.sync` diffs against a baseline). `appStep` is written into the data blob so the app resumes on its own step; the web's `currentStep` index is kept roughly in step too.

## Resume

- `https://onboarding.qodeinvest.com/onboard/{token}` (universal/app link; `.well-known` files on that domain are needed for the OS to route it) and `myqode://onboard/{token}` open `ResumeScreen` → `store.hydrate(token)` → the saved step. A 404 clears the stored token and explains the link expired.
- A stored token shows a "Continue my application" card on the sign-in screen (progress from `GET …/progress`, no PII beyond the first name).
- Foreground: pending saves flush, active verifications re-poll, the tracker refreshes.

## Edge cases handled

- Offline / timeout: banner, local state kept, save + creation retried with backoff and on reconnect; verification start and upload explain what to do.
- Digio disabled or template missing (503): verification blocks turn into "fill it in yourself" mode; documents step takes uploads.
- Contact missing before verifying (400): inline message, no request made.
- Slow verification (> 30 s): banner with Keep waiting / Continue manually; 5 min: timed out with Keep waiting / Try again / Upload instead.
- Rejected / failed / expired: friendly reason, retry, manual upload. SDK load or window errors: reopen or upload instead; polling continues regardless.
- WebView keeps `tel:`, `mailto:`, `intent:` and other non-http links from leaving the app; camera/mic are granted to the page. The whole WebView navigates Digio → DigiLocker → Digio's exit page → `<onboarding API_BASE>/mobile/digio-return?status=success|cancel&message=…` (never loaded: `onShouldStartLoadWithRequest` turns it into a store `return` event). A user cancel shows "You closed the verification window"; `error_code=TERMINATED` shows the interruption panel; success shows "Confirming with DigiLocker" while the poll fetches the verified fields.
- 409 anywhere → locked → tracker. Duplicate submit taps ignored. Account type changed after creation → a fresh draft (old one marked `supersededInApp`).
- Field rules (`mapping.js`, unit-tested; DigiLocker-locked fields are skipped): names letters/space/dot/apostrophe/hyphen with ≥ 2 letters, sanitised as typed (`cleanName`); email strict pattern ≤ 254 chars; mobile 10 digits starting 6–9 and not a repeated digit; PAN `ABCPE1234F` with 4th letter `P` for individuals (`isIndividualPan`), holder 2's PAN ≠ holder 1's; DOB a real date, 18+, not > 120 years back (`validateDob`, both holders); typed address 10–500 chars with a 6-digit PIN (`hasPin`); holder 2 email/mobile each valid if given, one required; nominee name/relationship/guardian names, optional mobile, share a whole number 1–100 summing to 100; first contribution ≥ ₹50,00,000 (`validateAmount`).
- Uploads: size/type validated before the network; picker permission denials explain the alternative. The multipart part is built by `nativeFilePart()` in `src/onboarding/file-native.js` (expo-file-system `File`, exposing `bytes()`): Expo SDK 54+ makes `expo/fetch` the global fetch and its encoder rejects React Native's `{ uri, name, type }` parts with "Unsupported FormDataPart implementation", which showed up as the "You appear to be offline" upload error. `api.js` keeps a fetch-based default part so it runs under node and on web.
- Resume keeps what DigiLocker fetched. Like the web wizard, the store persists `<holder>_kycCheckId` / `<holder>_bankCheckId` when a verification starts and `digioDocKeys` when one completes (`stash()` rides the next autosave). `hydrate()` rebuilds `satisfied` with `satisfiedFromServer()` (verified keys → `doc_pan_hN` / `doc_aadhaar_hN`, `digioDocKeys`, penny-drop cheque waiver) and then does one quiet `GET /api/kyc/{id}` per remembered check whose result is not yet on the draft (`catchUp()`), applying it if finished. The server's own Digio media download can lag or fail (60 s timeout per file), so the slots must not depend on an Upload row existing.

## Testing

```sh
npm test                       # node unit tests: tests/mapping.test.mjs, tests/store.test.mjs
EXPO_PUBLIC_ONBOARDING_API_BASE=http://<lan-ip>:3099 npx expo start -c   # against the web repo in DIGIO_MOCK=true mode
```

In mock mode every verification approves instantly with RAVI KUMAR / ABCPK1234F / HDFC0000123 (see the web repo's `lib/digio/mock.ts`), and the sheet shows a DEMO pill.

Real-device checks still needed before release: the selfie camera inside the WebView on Android and iOS (Expo Go and a dev build), and the full DigiLocker round trip (Digio → DigiLocker sign-in → back to Digio → return URL) on both platforms. Do not reintroduce `is_iframe`: it was the cause of "Something interrupted the window" (the gateway's DigiLocker step calls `window.open`, which returns null in the WebView, so nothing happened until the investor tapped Cancel).

## Known gaps

- No standalone OTP / consent / KRA / CKYC / eStamp / POA endpoints exist on the backend; the app's old OTP step was removed. E-sign is wired (`startEsign`) but the backend template is not configured yet, so the tracker says the agreement follows by email.
- The dev backend satisfies a DigiLocker fetch with one `doc_digilocker_bundle_h{n}` key per holder (handled: it covers PAN + Aadhaar). NRI, HUF and entity document keys follow the naming convention but are unconfirmed against the web's `documentsStep()`.
- Document viewing (opening a fetched file) is not offered in-app to avoid leaving the app; ops sees files in the admin.
