# Verification, 27 September 2026

The release is an ARM64 standalone APK for Android 7 or newer, built with Expo 57 and signed with the private project key. The emulator ran Android 16/API 36. Detailed local receipts are retained under `.devkit/evidence/`. Release builds now go to `dist/android/`.

## Automated checks

- TypeScript check and Expo dependency compatibility check passed.
- Three TypeScript tests passed: filename ordering, folder hierarchy, and timestamp/progress boundaries.
- One native ordering test passed.
- Seven Android instrumentation tests passed with real ExoPlayer and SQLite: persistence and rescan, seek/undo and service recreation, ignored headset next with natural chapter advance, missing-file preservation, cold media-session resume, bookmarking before playback restoration, and one-tap replay after completion.
- APK signing verification passed. The production APK bundles JavaScript and works with Metro stopped.

## Interaction checks

The native fixture contains two folders, Book 2 and Book 10, with original spoken WAV files numbered 01, 02, and 10. The Android folder picker imported the tree and retained access across updates. The library and chapters use numeric ordering. A rescan retained both books and the listening position.

In-place signed APK updates preserved the library, permission grants, current book, and position. Dark theme survived force-stop/reopen and an APK update. The UI's forward control moved 0:19 to 0:39; Undo restored 0:19. A locked-screen media play command resumed the selected book, and a next command kept the same chapter. These are synthetic Android media commands, not physical headphone gestures.

The web preview was checked in Chrome at 390×844, compact portrait 320×568, and landscape 844×390. Both themes, history, real sample playback, saved position, and car controls were inspected. The final shared preview serves the exported app through a managed, expiring Tailnet lease.

## Remaining device acceptance

Connect the user's phone, install the APK alongside Music Folder Player, grant access to an audiobook folder, and check its real formats. Verify single/double headset clicks, calls/audio focus, locked-screen pause/resume, and long idle periods under that phone's battery manager. No physical phone or headset was connected during this initial build.

A sudden process kill can lose a few seconds since the last periodic checkpoint. Android force-stop blocks background resumption until the app is reopened. Uninstalling or clearing storage deletes the journal; updates must use the retained signing key.
