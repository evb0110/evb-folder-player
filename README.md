# Folder Player

A personal, offline Android audiobook player built with Expo 57, React Native, and a local Kotlin/Media3 module.

- Read existing audio folders, including subfolders, with Android's folder picker. Optionally discover indexed device audio.
- Browse folders or books with natural filename ordering. Files are never moved, renamed, or deleted.
- Keep independent listening positions for each folder. Resume the current book from the library or headphones.
- Save durable progress every five seconds during playback and immediately on pause. Retain 400 history entries, checkpoints before jumps, bookmarks, and undo.
- Use a dedicated car mode with large play/pause, separate ±20-second controls, optional screen wake lock, and portrait/landscape layouts.
- Ignore headset next/previous commands while allowing automatic progression to the next chapter.
- Switch between light, dark, or system theme. The choice survives restarts.
- Use touch targets of at least 52 pixels, with a 100-pixel play button and a larger car control.
- Adjust speed or set a sleep timer. No account, server, advertising, or analytics.

## Development

```sh
npm ci
npm run web
npm run typecheck
npm test
```

The web build is a UI preview with a real, bundled spoken sample. Device-folder access and native background playback require the Android app. Expo Go cannot load the custom Kotlin module.

## Build the standalone APK

Install JDK 21 and Android SDK 36. Set `FOLDER_PLAYER_JAVA_HOME` and `ANDROID_HOME` if they differ from this Mac's defaults, then:

```sh
npm run build:android
```

The script uses Expo prebuild, builds an ARM64 release with bundled JavaScript, and writes `.devkit/artifacts/folder-player-0.1.0.apk` and a SHA-256 receipt. No Metro server or Expo account is required to run the APK.

The initial build generates a private signing key in ignored `.credentials/`. Keep this directory backed up securely. Updates must use the same application ID and signing key to retain installed data. Do not uninstall to upgrade:

```sh
adb -s DEVICE_SERIAL install -r .devkit/artifacts/folder-player-0.1.0.apk
```

The app's package is `com.evb.folderplayer`, separate from Music Folder Player.

## Native checks

Use a task-owned Android emulator or an explicitly selected device:

```sh
cd android
ANDROID_SERIAL=emulator-5574 ./gradlew :folder-audio:testDebugUnitTest :folder-audio:connectedDebugAndroidTest --no-daemon --max-workers=4 -Dorg.gradle.java.home="$JAVA_HOME" -PreactNativeArchitectures=arm64-v8a
```

Instrumentation exercises actual Media3 playback, SQLite reopen, rescan preservation, seek/undo, service recreation, missing-file preservation, media-button suppression, and automatic chapter progression. The test APK has separate application storage.

## Implementation

`modules/folder-audio` owns the Android player, media session, folder discovery, and SQLite state. React screens only issue commands and observe state. The service can run and persist progress without JavaScript. Checkpoints are committed before discontinuities. Restoration validates the resulting seek before replacing the previous saved position. Library refreshes retain listening history even when files disappear.

A sudden process kill can lose a few seconds since the last periodic checkpoint. Android Force stop intentionally prevents background execution until reopening the app. Physical headset mapping, long-idle behavior under the phone's power manager, and codec/seek behavior on the user's files still require real-device acceptance.

The app is currently Android-focused. No iOS native implementation or equalizer is included. History export/cloud backup and tracking files after manual moves are future work. Deleting app data/uninstalling deletes the local journal.

## Design references

- [Audible car mode](https://help.audible.com/s/article/listen-in-the-car?language=en_US), simplified large controls.
- [Android Media3 background playback](https://developer.android.com/media/media3/session/background-playback).
- [Expo local native modules](https://docs.expo.dev/modules/get-started/).

The sample recordings use original text and the Mac's synthesized speech. All application icons and cover illustrations are generated from source, with no downloaded cover art. Google Fonts packages retain their upstream licenses.
