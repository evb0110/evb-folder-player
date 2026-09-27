#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
export TMPDIR="$PWD/.devkit/tmp"
export ANDROID_HOME="${ANDROID_HOME:-/Users/evb/Library/Android/sdk}"
export JAVA_HOME="${FOLDER_PLAYER_JAVA_HOME:-/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home}"
mkdir -p "$TMPDIR" .credentials .devkit/artifacts
chmod 700 .credentials
if [[ ! -f .credentials/release.keystore ]]; then
  node scripts/create-signing.mjs
fi
npx expo prebuild --platform android --no-install --no-clean
(cd android && ./gradlew :app:assembleRelease --no-daemon --max-workers=4 -Dorg.gradle.java.home="$JAVA_HOME" -PreactNativeArchitectures=arm64-v8a)
cp android/app/build/outputs/apk/release/app-release.apk .devkit/artifacts/folder-player-0.1.0.apk
shasum -a 256 .devkit/artifacts/folder-player-0.1.0.apk > .devkit/artifacts/SHA256SUMS
