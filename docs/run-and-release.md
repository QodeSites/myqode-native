# Running the app, and building for release

Everything that differs between development and a store build is in three places: `myqode-native/.env`,
`myqode-native/app.json` (`expo.version`), and the backend's `myQode/.env`. The code is the same.

## 1. Development on the office Wi-Fi (simplest)

Phone and PC on the same Wi-Fi.

```
# myQode/ (backend)
npm run dev                      # http://localhost:2069, NODE_ENV=development → passwordless dev sign-in works

# myqode-native/.env
EXPO_PUBLIC_API_BASE_URL=http://192.168.200.100:2069     # this PC's LAN IP (ipconfig → IPv4)
EXPO_PUBLIC_TEST_MODE=1
EXPO_PUBLIC_DEV_BYPASS=1

# myqode-native/
npx expo start -c                # scan the QR with Expo Go
```

`-c` is needed whenever `.env` changes: `EXPO_PUBLIC_*` values are baked into the bundle.

## 2. Development with the phone on mobile data

`npx expo start --tunnel` does **not** work on this network: it uses ngrok, and the office network blocks
ngrok's servers (the error is "remote gone away"). Cloudflare tunnels are not blocked, so two of them are
used instead: one for the API (port 2069) and one for the Metro bundler (port 8081).

```
# terminal 1 – backend
cd myQode && npm run dev

# terminal 2 – API tunnel (prints a https://….trycloudflare.com URL; keep this window open)
cd myqode-native && scripts\api-tunnel.cmd

# myqode-native/.env – paste that URL
EXPO_PUBLIC_API_BASE_URL=https://<random-words>.trycloudflare.com

# terminal 3 – Expo with a Cloudflare tunnel for the bundler (replaces `npx expo start --tunnel`)
cd myqode-native && npm run start:tunnel
```

Notes
- A quick tunnel gets a **new random URL every time it starts**. Restart the API tunnel → update `.env` →
  restart Expo with `npm run start:tunnel` (it always clears the cache).
- A new tunnel URL can take ~10 s to appear in DNS; if Expo Go says it cannot connect, wait and rescan.
- While the API tunnel is up, anyone with the URL can reach the dev server (including the passwordless
  sign-in). Close it (Ctrl+C) when done.
- `cloudflared` is installed via `winget install --id Cloudflare.cloudflared -e`. No account is needed for quick tunnels.
- If ngrok works from another network (e.g. a phone hotspot), plain `npx expo start --tunnel` is fine there.

## 3. Razorpay in development (test keys)

Backend `myQode/.env` already has: `RAZORPAY_KEY_ID` (rzp_test_…), `RAZORPAY_KEY_SECRET`,
`RAZORPAY_WEBHOOK_SECRET`, `RAZORPAY_ENVIRONMENT=test`, `NEXT_PUBLIC_RAZORPAY_KEY_ID`. The app holds no keys.

- With test keys nobody is charged and the real client's email/phone are never sent to Razorpay.
- Test payments: UPI id `success@razorpay` / `failure@razorpay`; card `4111 1111 1111 1111`; on the mock bank
  page tap **Success** (not Skip). Real UPI apps cannot complete test-mode payments.
- Webhook (optional in dev; the app confirms payments itself): Razorpay dashboard → Settings → Webhooks (test
  mode) → URL `https://<api tunnel>/api/mobile/payments/razorpay/webhook`, secret = `RAZORPAY_WEBHOOK_SECRET`,
  events `payment.captured`, `payment.failed`, `order.paid`. Update the URL whenever the tunnel restarts.

## 4. Release build (store)

### App side — `myqode-native`

```
# .env
EXPO_PUBLIC_API_BASE_URL=https://myqode.qodeinvest.com   # production backend
EXPO_PUBLIC_TEST_MODE=0                                   # MUST be 0: re-enables emails, password change, push registration
EXPO_PUBLIC_DEV_BYPASS=0                                  # hides the passwordless sign-in
```

- Bump `expo.version` in `app.json` for every store build (e.g. 1.1.2 → 1.1.3). The app reads its version from
  there; the update banner compares it with the server's `APP_LATEST_VERSION` / `APP_MIN_VERSION`.
- `app.json` `expo.scheme` is `myqode` — the deep link the Razorpay browser flow returns to in a built app
  (Expo Go uses `exp://<dev host>/--/payment-return` automatically). Do not remove it. In test mode the result
  screen prints the exact return link used. If Expo Go reloads the project instead of resuming it, the app still
  recovers: the order is saved on the device and the Add Funds sheet reopens and verifies it on the next start.
- Build with EAS (iOS builds run in Expo's cloud, no Mac needed):
  ```
  npm install -g eas-cli && eas login
  eas build --platform android --profile production
  eas build --platform ios --profile production
  eas submit --platform android / ios
  ```
  If `eas.json` does not exist yet, `eas build:configure` creates it.
- No native SDK is used (Razorpay opens in the system browser), so Expo Go and EAS builds behave the same.

### Backend side — `myQode` (deploy these, otherwise the app lacks features it expects)

New/changed since the mobile work began (all additive except the four edited portfolio routes):
- `app/api/mobile/portfolio/performance`, `combined-performance`, `nav`, `combined-nav` (edited: 1W/10D rule,
  since-inception anchor, raw nav/index in the series)
- `app/api/mobile/portfolio/history` (legacy Orbis views)
- `app/api/mobile/primary-ucc` (Nuvama UCC notice)
- `lib/razorpay.ts` + `app/api/mobile/payments/razorpay/{create-order,checkout,return,verify,webhook}`

Production `.env` on the server:
- `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` = **live** keys, `RAZORPAY_ENVIRONMENT=live`,
  `RAZORPAY_WEBHOOK_SECRET` = the secret of a webhook registered on
  `https://myqode.qodeinvest.com/api/mobile/payments/razorpay/webhook` (live mode, same three events).
- `RAZORPAY_NOTIFY_CLIENT=true` if clients should be emailed/pushed on payment success/failure (off by default).
- `APP_LATEST_VERSION` = the version just released; `APP_MIN_VERSION` = the oldest version still allowed;
  `APP_IOS_URL` / `APP_ANDROID_URL` = store links (not yet wired into the banner).
- `NEXT_PUBLIC_BASE_URL` = `https://myqode.qodeinvest.com` (used to build the Razorpay checkout link).
- The server must run with `NODE_ENV=production` so the passwordless sign-in is refused.

### Checklist before shipping
- [ ] `.env`: production URL, `TEST_MODE=0`, `DEV_BYPASS=0`
- [ ] `app.json` version bumped; server `APP_LATEST_VERSION` updated after release
- [ ] backend routes above deployed; live Razorpay keys and webhook in place
- [ ] the hardcoded admin/reviewer credentials in `myQode/app/api/mobile/auth/login/route.ts` moved to env vars
- [ ] `node scripts/compare-web.mjs <clientCode>` run against production once (needs the dev bypass, so run it against a staging copy)
