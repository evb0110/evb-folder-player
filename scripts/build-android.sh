#!/usr/bin/env bash
# Builds signed, standalone per-ABI release APKs into dist/android/.
set -euo pipefail
cd "$(dirname "$0")/.."

export ANDROID_HOME="${ANDROID_HOME:-$HOME/Library/Android/sdk}"
export JAVA_HOME="${FOLDER_PLAYER_JAVA_HOME:-/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home}"
version="$(node -p "require('./app.json').expo.version")"
out="dist/android"

mkdir -p "$out"
if [[ ! -f .credentials/signing.properties || ! -f .credentials/release.keystore ]]; then
  echo "Personal release signing credentials are required by this script." >&2
  exit 1
fi

npx expo prebuild --platform android --no-install --no-clean
(
  cd android
  ./gradlew :app:assembleRelease --no-daemon --max-workers=4 \
    -Dorg.gradle.java.home="$JAVA_HOME" -PreactNativeArchitectures=arm64-v8a,armeabi-v7a
)
for abi in arm64-v8a armeabi-v7a; do
  apk="$out/folder-player-$version-$abi.apk"
  cp "android/app/build/outputs/apk/release/app-$abi-release.apk" "$apk"
  echo "$apk"
done
(cd "$out" && shasum -a 256 "folder-player-$version-arm64-v8a.apk" "folder-player-$version-armeabi-v7a.apk" > SHA256SUMS)
