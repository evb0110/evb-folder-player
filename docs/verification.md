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

# Volume boost and lock-screen controls, 9 October 2026

Version 0.3.3 adds a volume boost of up to 12 dB and 20-second jumps on the lock screen and in the media notification. `npm run check`, the 18 JVM tests and all nine instrumentation tests pass on task-owned Android 16 (API 36) and Android 11 (API 30) emulators.

- `volumeBoostRaisesOutputAboveSystemVolumeAndPersists` measures the player's audio session with a visualizer. The same passage peaked at −47.8 dB RMS without boost and −35.8 dB with +12 dB on both Android versions. With the gain forced to zero the test fails (−47.81 to −47.83 dB). The boost survives service recreation, and Off detaches the effect.
- `lockScreenJumpsTwentySecondsEvenWhenTheServiceStartedEmpty` starts the service before a book is loaded, then reads the platform media session that the lock screen uses: seeking and both jump actions must be present, and each jump must move the position 20 seconds and save a "Before jump" checkpoint. With the previous connection code, which granted controllers only the commands an empty player had, the test fails on both Android versions: no seeking or jump actions ever reach the platform session.

A local signed arm64 release build was installed over the published 0.3.2 APK on the Android 16 emulator. On 0.3.2 the platform session offered no custom actions and no seeking; the lock screen showed only play/pause. After the in-place update the library and position remained. Boost +6 dB attached an enabled Loudness Enhancer to the app's playing track in the AudioFlinger dump. The lock screen showed back and forward buttons and a seek bar; with the screen locked, pause held the position at 22.66 s, forward moved it to 42.66 s and back to 22.66 s. Both jumps appeared in History as "Before jump", and Undo was enabled. On Android 11 the lock screen takes the same buttons from the notification: pause at 25.95 s, forward to 46.01 s, back to 26.01 s.

Not yet checked on a physical phone: how loud +12 dB is through real speakers and headphones, vendor audio effects that might also process the session, and lock screens of manufacturer skins.
