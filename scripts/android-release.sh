#!/usr/bin/env bash
# Play Store bundle (.aab) for myQode, built on this Mac and uploaded by hand in Play Console.
#   bash scripts/android-release.sh
# Refuses to finish unless everything a store upload needs is right:
#   - the upload key from ~/.gradle/gradle.properties (plugins/withReleaseSigning.js) — and the bundle's signature
#     must match the upload key Play Console expects (SHA-1 below)
#   - .env.production: test mode and the passwordless dev sign-in off; prints the API the build talks to
#   - versionCode above the one already on Play (43 = 1.2.6)
# Output: ~/Desktop/qode/apk/myQode-<version>-<versionCode>.aab
set -euo pipefail
# Sentry (src/monitoring.js): crash reports work without this; uploading source maps / debug symbols (readable
# stack traces) needs SENTRY_AUTH_TOKEN for sentry.qodeinvest.com. Until one is set, skip the upload step.
[ -n "${SENTRY_AUTH_TOKEN:-}" ] || export SENTRY_DISABLE_AUTO_UPLOAD=true
cd "$(dirname "$0")/.."

PLAY_UPLOAD_SHA1="43:AF:35:02:15:06:A9:DC:F4:6F:F2:F1:51:F2:0D:AE:B9:DA:20:54"
PLAY_LAST_VERSION_CODE=43
OUT_DIR="$HOME/Desktop/qode/apk"
fail() { echo "✗ $*" >&2; exit 1; }

# 1. Upload key
PROPS="$HOME/.gradle/gradle.properties"
for k in MYQODE_UPLOAD_STORE_FILE MYQODE_UPLOAD_STORE_PASSWORD MYQODE_UPLOAD_KEY_ALIAS MYQODE_UPLOAD_KEY_PASSWORD; do
  grep -q "^$k=." "$PROPS" 2>/dev/null || fail "$k is missing from $PROPS (see plugins/withReleaseSigning.js)"
done
STORE_FILE=$(grep "^MYQODE_UPLOAD_STORE_FILE=" "$PROPS" | cut -d= -f2-)
[ -f "$STORE_FILE" ] || fail "keystore not found: $STORE_FILE"
echo "▸ Upload key: $STORE_FILE"

# 2. Release settings
ENVF=.env.production
[ -f "$ENVF" ] || fail "$ENVF is missing"
API=$(grep -E '^EXPO_PUBLIC_API_BASE_URL=' "$ENVF" | cut -d= -f2-)
TEST=$(grep -E '^EXPO_PUBLIC_TEST_MODE=' "$ENVF" | cut -d= -f2-)
BYPASS=$(grep -E '^EXPO_PUBLIC_DEV_BYPASS=' "$ENVF" | cut -d= -f2-)
[ "$TEST" = "0" ] || fail "EXPO_PUBLIC_TEST_MODE must be 0 in $ENVF (is '$TEST')"
[ "$BYPASS" = "0" ] || fail "EXPO_PUBLIC_DEV_BYPASS must be 0 in $ENVF (is '$BYPASS')"
case "$API" in https://*) ;; *) fail "EXPO_PUBLIC_API_BASE_URL must be an https address (is '$API')";; esac
case "$API" in *devtunnels*|*localhost*|*192.168.*) fail "EXPO_PUBLIC_API_BASE_URL points at a development server: $API";; esac
VERSION=$(node -p "require('./app.json').expo.version")
CODE=$(node -p "require('./app.json').expo.android.versionCode")
[ "$CODE" -gt "$PLAY_LAST_VERSION_CODE" ] || fail "android.versionCode $CODE must be above $PLAY_LAST_VERSION_CODE (already on Play)"
echo "▸ myQode $VERSION (versionCode $CODE) → API $API"

# 3. Build
export JAVA_HOME="${JAVA_HOME:-$(/usr/libexec/java_home -v 17)}" ANDROID_HOME="${ANDROID_HOME:-$HOME/Library/Android/sdk}" NODE_ENV=production
echo "▸ Generating the native project"
CI=1 npx expo prebuild -p android >/dev/null
# prebuild rewrites these scripts for native runs; keep the Expo Go ones (same as the iOS script)
node -e "const f='package.json',p=require('./'+f);p.scripts.ios='expo start --ios';p.scripts.android='expo start --android';require('fs').writeFileSync(f,JSON.stringify(p,null,2)+'\n')"
grep -q "versionCode $CODE" android/app/build.gradle || fail "android/app/build.gradle does not carry versionCode $CODE"
echo "▸ Building the release bundle (a few minutes)"
(cd android && ./gradlew bundleRelease --no-daemon -q) || fail "Gradle build failed"
AAB=android/app/build/outputs/bundle/release/app-release.aab
[ -f "$AAB" ] || fail "no bundle at $AAB"

# 4. The signature must be the upload key Play expects
SHA1=$(keytool -printcert -jarfile "$AAB" 2>/dev/null | awk '/SHA1:/{print $2; exit}')
[ "$SHA1" = "$PLAY_UPLOAD_SHA1" ] || fail "bundle is signed with $SHA1, Play expects $PLAY_UPLOAD_SHA1 — do not upload it"
echo "▸ Signed with the Play upload key ($SHA1)"

mkdir -p "$OUT_DIR"
OUT="$OUT_DIR/myQode-$VERSION-$CODE.aab"
cp "$AAB" "$OUT"
echo "✓ $OUT"
echo "  Upload it in Play Console → Test and release → Production (or a testing track) → Create new release."
echo "  Next store build: raise android.versionCode in app.json first (Play refuses a repeat)."
