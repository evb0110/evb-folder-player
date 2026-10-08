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

# Archive import, 8 October 2026

Version 0.3.2 adds ZIP import. The JVM suite `ArchiveImporterTest` has 17 tests: code page tables against the JDK's IBM437 and IBM866, Windows Cyrillic and Western names, the Info-ZIP Unicode path field, stored and deflated entries with data descriptors, OS clutter, name collisions, storage without document moves, unsafe paths, archives without audio, non-ZIP files, damaged and truncated data, password protection, insufficient space, excessive expansion, cancellation, and abandoned temporary folders. Removing the unsafe-path check fails exactly its test. The seven instrumentation tests still pass.

A task-owned Android 16 (API 36) emulator ran the signed arm64 release build. 0.3.1 was installed first, with a read-only `Audiobooks` library folder, then updated in place:

- Opening a Windows-made archive (DOS 866 names) from Downloads resolved to the app's import activity. The one-time dialog opened the picker at the existing library folder. The book appeared as `Тестовая книга` with three chapters; `Thumbs.db` was skipped, the existing book was untouched, and the first chapter played.
- An archive with two top-level folders became one folder named after the archive. A second import of an existing name became `Two parts (2)`.
- With a write grant, the archive was deleted after import. With a read-only grant from Downloads, the banner kept it and its Open Downloads button opened the system Downloads view.
- An archive without audio failed with a message and left no folder. Cancelling a 597 MB import removed its hidden folder.
- Sharing an archive to the app imported it. A fresh install with no library opened the picker in `Audiobooks`; the chosen folder joined the library.

Android only offers a deletion confirmation for audio, video and image items, so the app cannot delete a ZIP that Telegram or a browser shared read-only. Telegram itself was not installed on the emulator; its "Open with" uses the same read-only path tested here.
