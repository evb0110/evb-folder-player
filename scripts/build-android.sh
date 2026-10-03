#!/usr/bin/env bash
# Quick local Mac build into dist/android/. Not the reproducible release path.
set -euo pipefail
cd "$(dirname "$0")/.."

export ANDROID_HOME="${ANDROID_HOME:-$HOME/Library/Android/sdk}"
export JAVA_HOME="${FOLDER_PLAYER_JAVA_HOME:-/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home}"
version="$(node -p "require('./app.json').expo.version")"
out="dist/android"

export FOLDER_PLAYER_CREDENTIALS_DIR="${FOLDER_PLAYER_CREDENTIALS_DIR:-$PWD/.credentials}"
mkdir -p "$out"
if [[ ! -f "$FOLDER_PLAYER_CREDENTIALS_DIR/signing.properties" || ! -f "$FOLDER_PLAYER_CREDENTIALS_DIR/release.keystore" ]]; then
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
  apk="$out/EVB-Folder-Player-$version-$abi.apk"
  cp "android/app/build/outputs/apk/release/app-$abi-release.apk" "$apk"
  echo "$apk"
done
(cd "$out" && shasum -a 256 "EVB-Folder-Player-$version-arm64-v8a.apk" "EVB-Folder-Player-$version-armeabi-v7a.apk" > SHA256SUMS)
