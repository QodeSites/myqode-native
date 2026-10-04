# Store releases with fastlane

Builds come from `bash scripts/release.sh`. These lanes upload screenshots, texts and builds to the stores and submit
them for review. **Nothing goes public until a release lane is run on purpose.**

## Keys (once, never committed)
- `~/.appstore/AuthKey_<KEYID>.p8` — App Store Connect → Users and Access → Integrations → App Store Connect API →
  new key, role **App Manager**. The issuer id is read from `scripts/ios-testflight.sh`.
- `~/.appstore/play-service-account.json` — Play Console → Setup → API access → service account with
  **Release manager** on myQode.

## Release
1. `bash scripts/release.sh --yes` → iOS build uploaded to App Store Connect, Android `.aab` in `~/Desktop/qode/apk/`.
2. Screenshots: `node brag-output/work/cap-store.cjs` then `node brag-output/work/compose-store.cjs`, then
   `bash fastlane/sync-screenshots.sh` (copies them into the folders below).
3. `fastlane ios submit build:<build number>` — attaches the build, sets **Manually release**, submits for review.
4. `fastlane android submit` — uploads the newest `.aab` to production as a **draft**, with screenshots and notes.
   Send it for review in Play Console (Publishing overview) with Managed publishing on.
5. Launch: `fastlane ios release` and `fastlane android release code:<versionCode> rollout:1.0`.

App Privacy (Apple) and Data safety (Play) are console-only.
