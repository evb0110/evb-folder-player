#!/usr/bin/env bash
# Builds a signed, standalone ARM64 release APK into dist/android/.
set -euo pipefail
cd "$(dirname "$0")/.."

export ANDROID_HOME="${ANDROID_HOME:-$HOME/Library/Android/sdk}"
export JAVA_HOME="${FOLDER_PLAYER_JAVA_HOME:-/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home}"
version="$(node -p "require('./app.json').expo.version")"
out="dist/android"
apk="$out/folder-player-$version.apk"

mkdir -p .credentials "$out"
chmod 700 .credentials
if [[ ! -f .credentials/release.keystore ]]; then
  node scripts/create-signing.mjs
fi

npx expo prebuild --platform android --no-install --no-clean
(
  cd android
  ./gradlew :app:assembleRelease --no-daemon --max-workers=4 \
    -Dorg.gradle.java.home="$JAVA_HOME" -PreactNativeArchitectures=arm64-v8a
)
cp android/app/build/outputs/apk/release/app-release.apk "$apk"
(cd "$out" && shasum -a 256 "$(basename "$apk")" > SHA256SUMS)
echo "$apk"
