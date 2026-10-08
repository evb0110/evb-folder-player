# EVB Folder Player

A private, offline Android audiobook player built with Expo 57, React Native, and a local Kotlin/Media3 module.

- Read existing audio folders, including subfolders, with Android's folder picker. Optionally discover indexed device audio.
- Add a book from a ZIP archive: open it with EVB Folder Player from Telegram, a browser download, or a file manager, or share it to the app. It is unpacked into a new folder inside your audiobook folder, including Windows archives with Cyrillic names, and appears in the library. The archive is deleted only when the app that shared it allows that.
- Browse folders or books with natural filename ordering. Existing files are never moved, renamed, or deleted.
- Keep independent listening positions for each folder. Resume the current book from the library or headphones.
- Save durable progress every five seconds during playback and immediately on pause. Retain 400 history entries, checkpoints before jumps, bookmarks, and undo.
- Open straight into the current book. Choose a chapter, then switch to car mode: a large play/pause, separate ±20-second controls, optional screen wake lock, and portrait/landscape layouts. Car mode covers the player, so the chapter list keeps its place.
- Ignore headset next/previous commands while allowing automatic progression to the next chapter.
- Switch between light, dark, or system theme. The choice survives restarts.
- Every control is at least 56 pixels; icon buttons are 64 (76 in car mode), with a 96-pixel play button and a car control that fills the screen.
- Adjust speed or set a sleep timer. No account, server, advertising, or analytics.

## Install

Download an APK from [GitHub Releases](https://github.com/evb0110/evb-folder-player/releases). Choose `EVB-Folder-Player-<version>-arm64-v8a.apk` for most phones, or `EVB-Folder-Player-<version>-armeabi-v7a.apk` for older 32-bit phones. Allow your browser or file manager to install apps when Android asks.

Each release also has `SHA256SUMS`. Check a download with `shasum -a 256 -c SHA256SUMS --ignore-missing` on macOS or `sha256sum -c SHA256SUMS --ignore-missing` on Linux.

F-Droid: submission in review.

[Obtainium](https://github.com/ImranR98/Obtainium) can check for updates from the GitHub Releases URL above. Select the APK for your phone's architecture. Install updates over the existing app to keep your library and listening history.

Read the [privacy policy](PRIVACY.md). EVB Folder Player has no network access, ads, or tracking; your existing audio files are never modified.

## Development

```sh
npm ci
npm run web          # dev server
npm run check        # typecheck, ESLint, Prettier, unit tests
npm run format       # apply Prettier and ESLint fixes
npm run export:web   # static web preview in dist/web
npm run preview:web  # serve dist/web on 127.0.0.1:8098 (PORT overrides)
```

The web build is a UI preview with a real, bundled spoken sample. Device-folder access and native background playback require the Android app. Expo Go cannot load the custom Kotlin module.

## Build the standalone APK

Install JDK 21 and Android SDK 36. Set `FOLDER_PLAYER_JAVA_HOME` and `ANDROID_HOME` if they differ from this Mac's defaults, then:

```sh
npm run build:android
```

This is a quick local build, not the reproducible release path. The script uses Expo prebuild and builds separate ARM64 and 32-bit ARM releases with bundled JavaScript. It writes `dist/android/EVB-Folder-Player-<version>-arm64-v8a.apk`, `dist/android/EVB-Folder-Player-<version>-armeabi-v7a.apk`, and `dist/android/SHA256SUMS`. No Metro server or Expo account is required to run the APK.

Before the first build, create the private signing key in ignored `.credentials/` with `JAVA_HOME=<jdk> node scripts/create-signing.mjs`. The build script refuses to run without it. Keep this directory backed up securely. Updates must use the same application ID and signing key to retain installed data. Do not uninstall to upgrade:

```sh
VERSION=$(node -p 'require("./app.json").expo.version')
adb -s DEVICE_SERIAL install -r "dist/android/EVB-Folder-Player-$VERSION-arm64-v8a.apk"
```

The app's package is `com.evb.folderplayer`, separate from Music Folder Player.

Published APKs are built by F-Droid on Linux, then signed on the Mac with the same developer key. F-Droid verifies its rebuild against the signed arm64 APK before distributing it. GitHub and F-Droid updates keep the same application ID and signing identity.

```sh
FOLDER_PLAYER_CREDENTIALS_DIR=/path/to/existing/.credentials npm run release:android -- HEAD dist/android/release
```

The command builds both ABIs and a repeat arm64 build concurrently, checks determinism, signs on the Mac and runs F-Droid Binaries verification. The Linux build host defaults to `bgk`; set `FOLDER_PLAYER_BUILD_HOST` to override it. `FOLDER_PLAYER_BUILD_CONCURRENCY` defaults to 2. Only the pinned build image is retained between runs; each build uses a fresh container and private build state. See the [release checklist](docs/release.md) for verification, tagging and publishing.

## Native checks

Use a task-owned Android emulator or an explicitly selected device:

```sh
cd android
ANDROID_SERIAL=emulator-5574 ./gradlew :folder-audio:testDebugUnitTest :folder-audio:connectedDebugAndroidTest --no-daemon --max-workers=4 -Dorg.gradle.java.home="$JAVA_HOME" -PreactNativeArchitectures=arm64-v8a
```

Instrumentation exercises actual Media3 playback, SQLite reopen, rescan preservation, seek/undo, service recreation, missing-file preservation, media-button suppression, and automatic chapter progression. The test APK has separate application storage.

## Implementation

`modules/folder-audio` owns the Android player, media session, folder discovery, and SQLite state. React screens only issue commands and observe state. The service can run and persist progress without JavaScript. Checkpoints are committed before discontinuities. Restoration validates the resulting seek before replacing the previous saved position. Library refreshes retain listening history even when files disappear.

Opened ZIP archives go to `ImportActivity`, which asks once for a writable library folder, then to `ImportService`, a foreground service that streams the archive through `ZipReader` without a seekable copy. `ArchiveImporter` writes into a hidden `.evb-import-*` folder and renames it into place only after every file is verified, so failed or cancelled imports leave nothing behind. Names without the ZIP UTF-8 flag are decoded as UTF-8 when valid, otherwise as DOS code page 866 or 437. The JVM tests in `ArchiveImporterTest` cover these cases.

A sudden process kill can lose a few seconds since the last periodic checkpoint. Android Force stop intentionally prevents background execution until reopening the app. Physical headset mapping, long-idle behavior under the phone's power manager, and codec/seek behavior on the user's files still require real-device acceptance.

The app is currently Android-focused. No iOS native implementation or equalizer is included. History export/cloud backup and tracking files after manual moves are future work. Deleting app data/uninstalling deletes the local journal.

## Design references

- [Audible car mode](https://help.audible.com/s/article/listen-in-the-car?language=en_US), simplified large controls.
- [Android Media3 background playback](https://developer.android.com/media/media3/session/background-playback).
- [Expo local native modules](https://docs.expo.dev/modules/get-started/).

The sample recordings use original text and the Mac's synthesized speech. All application icons and cover illustrations are generated from source, with no downloaded cover art. Google Fonts packages retain their upstream licenses.
