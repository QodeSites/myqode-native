# myQode — React Native (Expo) App

Native Android + iOS implementation of the **myQode Curtain v2** investor-portal
design (Claude Design project *myQode Investor Portal*,
`myQode Curtain v2.dc.html`), originally converted from the v1 web prototype
in `../myqode-curtain`.

Built with **Expo SDK 57** (React Native 0.86) — one codebase for both
platforms.

## Features

- **Splash → What's-new carousel** (3 slides) → **Login → OTP** with
  auto-advancing passcode boxes and a **curtain-lift** transition into the app
- **Main app** — Home (portfolio value count-up, "needs you" pending-transfer
  banner, NAV chart, stat tiles, quick actions, recent activity), Portfolio /
  Holdings (segmented control, gold performance chart, collapsible detailed
  metrics with tap-to-explain credibility metrics, Profit & Loss with FY tabs
  + monthly/quarterly toggle + All-Years accordion, allocation donut),
  Documents (frequently-used grid, search, category filters), Services
  (pending-transfer headline), More
- **Native bottom sheets** (RN Modal) — Add Funds / Withdraw with amount chips
  and payment-success screen, family account switcher (incl. combined
  "Entire Family" view), "For your attention" notifications, Display &
  accessibility settings
- **Privacy eye** — blurs every amount app-wide (RN text-shadow blur, works on
  both platforms)
- **Accessibility settings that actually apply** — text-size S/M/L/XL scales
  all type, high contrast deepens muted tones, reduced motion disables
  animations
- **8-step onboarding (v2)** — details → mobile OTP (with edit-number) →
  account type + password strength → identity (incl. date of birth &
  address) → 6 risk questions → risk profile → fees (profile-aware intro) →
  financial profile (SEBI questions + PEP definition) → nominees with
  allocation validation & SEBI opt-out declaration → document uploads →
  review & submit → application tracker → account opened → fund the account
- Native touches: real status bar + safe areas (no fake device frame), native
  pull-to-refresh on the dashboard, parallax on the dark header, Animated
  transitions throughout

## Run

```sh
npm install
npm start          # Expo dev server — scan the QR with Expo Go (Android/iOS)
npm run android    # requires Android SDK / emulator
npm run ios        # requires macOS; otherwise use Expo Go or EAS Build
npm run web        # react-native-web preview in the browser
```

To ship installable builds use [EAS Build](https://docs.expo.dev/build/introduction/):
`npx eas build -p android` / `npx eas build -p ios` (iOS builds run in
Expo's cloud, so no Mac is needed).

## Structure

| File | Purpose |
| --- | --- |
| `App.js` | Root: loads Playfair Display / Lato / Inter, safe-area provider |
| `src/main.js` | State machine + computed values, ported from the design's logic class |
| `src/ui.js` | Design system: colors, `Tx`/`Amt` typography (scaling, high contrast, privacy blur), buttons, chips, fields, OTP row, curved "curtain" cap, sheets, skeletons |
| `src/icons.js` | All design SVGs via react-native-svg |
| `src/data.js` | Static demo data (no backend) |
| `src/screens/` | splash, carousel, login/OTP, onboarding, curtain lift, app shell, tab content, sheets, success |

## Design-fidelity notes

- The web design's elliptical CSS curves are drawn as SVG caps (`CurveCap`).
- The shimmer skeleton is an opacity pulse; SVG line draw-in animations are
  kept where lengths are known (success ring/check, onboarding progress arc).
- Privacy blur uses the `textShadowRadius` technique instead of CSS
  `filter: blur()`.
