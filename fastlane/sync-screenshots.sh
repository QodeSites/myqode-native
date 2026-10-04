#!/bin/bash
# Copies the framed store screenshots into the folders deliver / supply read.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"; src="$here/../brag-output/work/store"
rm -f "$here"/screenshots/ios/en-US/*.png "$here"/metadata/android/en-US/images/phoneScreenshots/*.png
for f in "$src"/ios-6.9/*.png; do cp "$f" "$here/screenshots/ios/en-US/iphone69-$(basename "$f")"; done
for f in "$src"/ipad-13/*.png; do cp "$f" "$here/screenshots/ios/en-US/ipad13-$(basename "$f")"; done
for f in "$src"/play/*.png; do cp "$f" "$here/metadata/android/en-US/images/phoneScreenshots/$(basename "$f")"; done
echo "✓ $(ls "$here"/screenshots/ios/en-US | wc -l | tr -d ' ') App Store and $(ls "$here"/metadata/android/en-US/images/phoneScreenshots | wc -l | tr -d ' ') Play screenshots ready"
