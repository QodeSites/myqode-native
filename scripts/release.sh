#!/usr/bin/env bash
# One command for a store release of the myQode app, built on this Mac:
#   bash scripts/release.sh --api https://myqode.qodeinvest.com
# It
#   1. sets EXPO_PUBLIC_API_BASE_URL in .env.production (the server the store apps talk to)
#   2. raises android.versionCode in app.json by one (Play refuses a repeat)
#   3. builds and checks the Play Store bundle   → scripts/android-release.sh → ~/Desktop/qode/apk/myQode-<v>-<code>.aab
#   4. builds the iPhone app and uploads it to TestFlight → scripts/ios-testflight.sh
# then lists the two clicks left: upload the .aab in Play Console, submit the TestFlight build for review in
# App Store Connect (both consoles need a person; there are no store API keys on this Mac).
# Options: --api <https url> (default: what .env.production already has) · --android-only · --ios-only
#          --no-bump (keep versionCode, e.g. after a failed run) · --yes (skip the confirmation)
set -euo pipefail
cd "$(dirname "$0")/.."

API="" ; ANDROID=1 ; IOS=1 ; BUMP=1 ; YES=0
while [ $# -gt 0 ]; do
  case "$1" in
    --api) API="${2:-}"; shift 2 ;;
    --android-only) IOS=0; shift ;;
    --ios-only) ANDROID=0; shift ;;
    --no-bump) BUMP=0; shift ;;
    --yes|-y) YES=1; shift ;;
    -h|--help) sed -n '2,14p' "$0"; exit 0 ;;
    *) echo "unknown option: $1 (see --help)" >&2; exit 1 ;;
  esac
done

ENVF=.env.production
[ -f "$ENVF" ] || { echo "✗ $ENVF is missing" >&2; exit 1; }
CURRENT_API=$(grep -E '^EXPO_PUBLIC_API_BASE_URL=' "$ENVF" | cut -d= -f2-)
API="${API:-$CURRENT_API}"; API="${API%/}"
case "$API" in https://*) ;; *) echo "✗ --api must be an https address (got '$API')" >&2; exit 1 ;; esac

# The server must answer before anything is built
if ! curl -sf -m 15 "$API/api/mobile/app-version" >/dev/null; then
  echo "✗ $API/api/mobile/app-version does not answer — is that server up?" >&2; exit 1
fi

VERSION=$(node -p "require('./app.json').expo.version")
CODE=$(node -p "require('./app.json').expo.android.versionCode")
NEXT=$CODE; [ "$BUMP" = 1 ] && [ "$ANDROID" = 1 ] && NEXT=$((CODE + 1))

echo "myQode $VERSION release"
echo "  server        $API"
[ "$ANDROID" = 1 ] && echo "  Android       versionCode $NEXT  (Play Store bundle)"
[ "$IOS" = 1 ] && echo "  iPhone        build number from the time  (TestFlight upload)"
if [ -n "$(git status --porcelain -- src App.js app.json | grep -v '^??' || true)" ]; then
  echo "  ⚠ uncommitted app changes will be in these builds:"; git status --short -- src App.js | sed 's/^/      /'
fi
if [ "$YES" != 1 ]; then
  read -r -p "Build and upload? [y/N] " ok; case "$ok" in y|Y|yes) ;; *) echo "Cancelled."; exit 1 ;; esac
fi

# 1. server address
if [ "$API" != "$CURRENT_API" ]; then
  cp "$ENVF" "$ENVF.bak-$(date +%Y%m%d%H%M)"
  sed -i '' "s#^EXPO_PUBLIC_API_BASE_URL=.*#EXPO_PUBLIC_API_BASE_URL=$API#" "$ENVF"
  echo "▸ $ENVF → $API (previous copy kept as $ENVF.bak-…)"
fi

# 2. versionCode
if [ "$NEXT" != "$CODE" ]; then
  node -e "const f='app.json',fs=require('fs');const s=fs.readFileSync(f,'utf8');fs.writeFileSync(f,s.replace(/(\"versionCode\":\s*)$CODE\b/,'\$1$NEXT'))"
  [ "$(node -p "require('./app.json').expo.android.versionCode")" = "$NEXT" ] || { echo "✗ could not set versionCode $NEXT" >&2; exit 1; }
  echo "▸ app.json android.versionCode $CODE → $NEXT"
fi

# 3–4. builds (each script stops on its own checks)
[ "$ANDROID" = 1 ] && bash scripts/android-release.sh
[ "$IOS" = 1 ] && bash scripts/ios-testflight.sh

echo
echo "✓ Built for $API"
[ "$ANDROID" = 1 ] && echo "  Android: Play Console → Test and release → Production → Create new release → upload ~/Desktop/qode/apk/myQode-$VERSION-$NEXT.aab"
[ "$IOS" = 1 ] && echo "  iPhone:  App Store Connect → myQode → when the build has processed (10–30 min) → add it to the $VERSION version → Submit for Review"
[ "$NEXT" != "$CODE" ] && echo "  Commit app.json (versionCode $NEXT) so the next release starts from it."
exit 0
