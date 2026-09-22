# myqode-native developer docs

The myQode investor app: Expo SDK 57, React Native 0.86, plain JavaScript, no router. It talks to the `/api/mobile/*` routes of the `myQode` backend (sibling repo at `../myQode`, read-only reference for app work).

These docs describe the code as it is. Where something is unfinished, they say so.

## Start here

1. Install: `npm install` in the project root.
2. Backend (optional, for local data): in `../myQode`, run `npm run dev`. It serves on port 2069 with `NODE_ENV=development`.
3. Configure `.env`: set `EXPO_PUBLIC_API_BASE_URL` to `http://<your-LAN-IP>:2069` for a phone, or `http://localhost:2069` for a simulator or web. Leave it unset to use production.
4. For development also set `EXPO_PUBLIC_TEST_MODE=1` and `EXPO_PUBLIC_DEV_BYPASS=1`. Restart Expo after any `.env` change.
5. Run: `npm start`, then scan the QR code with Expo Go (it must support SDK 57). Or `npm run android`, `npm run ios`, `npm run web`.
6. Sign in with the dev bypass: on the login screen open "DEV · Sign in without password", search for a client and tap it, or type a client code and press the button. This only works against a development server.
7. You are now looking at a real client's data. The red `TEST MODE` tag means emails, password changes, payments and SIP changes are blocked. Service requests still email Investor Relations. Each sign-in adds a login-history row for that client.
8. Demo mode: tap "Explore a demo with sample data" on the login screen. No server needed; data is generated in `src/api/demo.js`.
9. Read [architecture.md](architecture.md) first, then [web-parity.md](web-parity.md) before touching any number or chart.
10. There is no lint, typecheck or test setup. Sanity checks: `npx expo-doctor`, and `node scripts/compare-web.mjs <clientCode>` for the numbers.

## Index

| File | What it covers |
| --- | --- |
| [architecture.md](architecture.md) | The root component, phase machine, the `V` object, scopes, data loading and the `seq` counter, refresh, adapters, design system, charts and tooltip. |
| [run-and-release.md](run-and-release.md) | How to run on Wi-Fi or mobile data (Cloudflare tunnels; ngrok is blocked here), Razorpay test setup, and every value to change for a store build. |
| [api.md](api.md) | Every function in `src/api/index.js` with its endpoint, auth, use and test-mode status; `BlockedError`, demo mode, analytics batching, token storage, 401 handling, impersonation. |
| [modes-and-testing.md](modes-and-testing.md) | The `.env` flags, exactly what test mode blocks and allows, the dev bypass and its server requirement, demo mode, `scripts/compare-web.mjs`, pre-production checklist. |
| [web-parity.md](web-parity.md) | The rules that keep the app's numbers identical to the web, with the app and backend code that implements each one. |
| [known-gaps.md](known-gaps.md) | What is not built or needs backend data or native work, as gap → what is needed. |
| [numbers-web-vs-mobile.xlsx](numbers-web-vs-mobile.xlsx) | Excel for non-developers: a one-page architecture diagram (data → server → web / mobile) and a plain-words definition of every number shown on the web and in the app, with where each comes from and whether it matches. |

Path convention: code paths in these docs are relative to the project root (`src/main.js`), and `../myQode/...` means the sibling backend repo. Links between the docs are relative to this folder.

Other references:

- `CLAUDE.md` (project root): short project guide. A few statements in it are behind the code; the docs here note where.
- `README.md` (project root): describes the original design demo and is out of date.
- `../myQode/docs/mobile-prompts/`: the backend's API contract (`complete-api-reference.md`, `portfolio-scope-levels.md`, `snapshot-home-screen.md`, `admin-master-view.md`).
