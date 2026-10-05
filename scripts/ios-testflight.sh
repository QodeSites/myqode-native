#!/usr/bin/env bash
# Build the iOS app locally with Xcode and upload it to TestFlight (no EAS, no Expo Go).
#   scripts/ios-testflight.sh [APPLE_TEAM_ID]   (default: U3H68NKMV6)
# Auth: an App Store Connect API key (no Apple ID, no 2FA). Put AuthKey_<KEYID>.p8 in ~/.appstore/
# (App Store Connect → Users and Access → Integrations → App Store Connect API, role App Manager or Admin).
# Override with ASC_KEY_PATH / ASC_KEY_ID / ASC_ISSUER_ID. Without a key it falls back to the Apple ID
# signed in to Xcode (Settings → Accounts), which needs App Store Connect access and its owner's 2FA.
# API URL and flags come from .env.production (loaded over .env for Release builds).
set -euo pipefail
# Sentry (src/monitoring.js): crash reports work without this; uploading source maps / debug symbols (readable
# stack traces) needs SENTRY_AUTH_TOKEN for sentry.qodeinvest.com. Until one is set, skip the upload step.
[ -n "${SENTRY_AUTH_TOKEN:-}" ] || export SENTRY_DISABLE_AUTO_UPLOAD=true
TEAM_ID="${1:-U3H68NKMV6}"   # Qode's team (from myqode-mobile eas.json)
cd "$(dirname "$0")/.."

# Signing goes through Xcode's signed-in Apple ID (cloud-managed distribution certificate). The App Store Connect
# key in ~/.appstore (used by fastlane) is only used here with ASC_USE_KEY=1: an App Manager key cannot create the
# cloud signing certificate ("Cloud signing permission error"), which broke the 5 Oct 2026 build.
ASC_KEY_PATH="${ASC_KEY_PATH:-$( [ "${ASC_USE_KEY:-0}" = 1 ] && ls ~/.appstore/AuthKey_*.p8 2>/dev/null | head -1 || true)}"   # no key: fall through to Xcode's Apple ID (pipefail must not end the script here)
ASC_ISSUER_ID="${ASC_ISSUER_ID:-5c73af08-bbd7-4821-a387-1660a391a74c}"   # Qode's issuer (myqode-mobile eas.json)
AUTH=()
if [ -n "$ASC_KEY_PATH" ]; then
  ASC_KEY_ID="${ASC_KEY_ID:-$(basename "$ASC_KEY_PATH" .p8 | sed 's/^AuthKey_//')}"
  AUTH=(-authenticationKeyPath "$ASC_KEY_PATH" -authenticationKeyID "$ASC_KEY_ID" -authenticationKeyIssuerID "$ASC_ISSUER_ID")
  echo "▸ Using App Store Connect API key $ASC_KEY_ID"
else
  echo "▸ No API key in ~/.appstore — using the Apple ID signed in to Xcode"
fi

OUT="build/ios"
BUILD_NUMBER="$(date +%Y%m%d%H%M)"   # unique and increasing on every upload
VERSION="$(node -p "require('./app.json').expo.version")"
rm -rf "$OUT" && mkdir -p "$OUT"

echo "▸ myQode $VERSION ($BUILD_NUMBER) → TestFlight, team $TEAM_ID"
grep -E '^EXPO_PUBLIC_API_BASE_URL=' .env.production

echo "▸ Generating the native project"
npx expo prebuild -p ios --clean
# prebuild rewrites these scripts for native runs; keep the Expo Go ones
node -e "const f='package.json',p=require('./'+f);p.scripts.ios='expo start --ios';p.scripts.android='expo start --android';require('fs').writeFileSync(f,JSON.stringify(p,null,2)+'\n')"
/usr/libexec/PlistBuddy -c "Set :CFBundleVersion $BUILD_NUMBER" ios/myQode/Info.plist

# Archive unsigned; the export step signs for App Store distribution (cloud-managed certificate). Signing the
# archive itself would need a development profile, and that needs a registered device.
echo "▸ Archiving (Release)"
xcodebuild -workspace ios/myQode.xcworkspace -scheme myQode -configuration Release \
  -destination 'generic/platform=iOS' -archivePath "$OUT/myQode.xcarchive" \
  DEVELOPMENT_TEAM="$TEAM_ID" CODE_SIGN_STYLE=Automatic CODE_SIGNING_ALLOWED=NO \
  CURRENT_PROJECT_VERSION="$BUILD_NUMBER" \
  -allowProvisioningUpdates archive 2>&1 | grep -E "error:|\*\* ARCHIVE" || true
test -d "$OUT/myQode.xcarchive" || { echo "archive failed"; exit 1; }

# The archive is unsigned, and an unsigned app carries no entitlements: the export would then sign it WITHOUT
# aps-environment (push) or associated-domains (universal links) — "no valid aps-environment entitlement" on the
# phone. Sign it ad hoc with the real entitlements first; the export re-signs it for the App Store and keeps them.
APP="$OUT/myQode.xcarchive/Products/Applications/myQode.app"
ENT="ios/myQode/myQode.entitlements"
test -f "$ENT" || { echo "entitlements file missing: $ENT"; exit 1; }
find "$APP/Frameworks" -maxdepth 1 \( -name "*.framework" -o -name "*.dylib" \) -print0 2>/dev/null | xargs -0 -I{} codesign --force --sign - --timestamp=none "{}" >/dev/null 2>&1 || true
codesign --force --sign - --timestamp=none --entitlements "$ENT" "$APP"
codesign -d --entitlements :- "$APP" 2>/dev/null | grep -q "aps-environment" || { echo "entitlements not embedded"; exit 1; }
echo "▸ Entitlements embedded (push, associated domains)"

cat > "$OUT/ExportOptions.plist" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>method</key><string>app-store-connect</string>
  <key>destination</key><string>upload</string>
  <key>teamID</key><string>$TEAM_ID</string>
  <key>signingStyle</key><string>automatic</string>
  <key>manageAppVersionAndBuildNumber</key><false/>
</dict></plist>
EOF

# Export an .ipa locally first and check the App Store signature still carries push, before anything is uploaded.
sed 's#<string>upload</string>#<string>export</string>#' "$OUT/ExportOptions.plist" > "$OUT/ExportLocal.plist"
xcodebuild -exportArchive -archivePath "$OUT/myQode.xcarchive" -exportOptionsPlist "$OUT/ExportLocal.plist" \
  -exportPath "$OUT/local" -allowProvisioningUpdates ${AUTH[@]+"${AUTH[@]}"} 2>&1 | grep -E "error:|\*\* EXPORT" || true
IPA="$(ls "$OUT"/local/*.ipa 2>/dev/null | head -1)"
test -n "$IPA" || { echo "local export failed"; exit 1; }
rm -rf "$OUT/check" && mkdir -p "$OUT/check" && unzip -q "$IPA" -d "$OUT/check"
ENTS="$(codesign -d --entitlements :- "$OUT"/check/Payload/*.app 2>/dev/null)"
echo "$ENTS" | grep -A1 "aps-environment" | grep -q "production" || { echo "✗ signed app has no production aps-environment; not uploading"; echo "$ENTS"; exit 1; }
echo "▸ Signed app has aps-environment = production"

echo "▸ Uploading to App Store Connect"
xcodebuild -exportArchive -archivePath "$OUT/myQode.xcarchive" -exportOptionsPlist "$OUT/ExportOptions.plist" \
  -exportPath "$OUT/export" -allowProvisioningUpdates ${AUTH[@]+"${AUTH[@]}"} 2>&1 | grep -E "error:|Upload|\*\* EXPORT" | tee "$OUT/export.log"
grep -q "EXPORT SUCCEEDED" "$OUT/export.log" || { echo "upload failed"; exit 1; }

echo "✓ Uploaded $VERSION ($BUILD_NUMBER). It appears in App Store Connect → TestFlight after Apple finishes processing (10–30 min)."
