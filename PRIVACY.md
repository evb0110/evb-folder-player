# EVB Folder Player privacy policy

Date: 8 October 2026

EVB Folder Player is an offline Android audiobook player. It collects and transmits no data. It has no network access, accounts, ads, analytics, or tracking.

Your library index, folder access grants, listening positions, history, bookmarks, and settings stay on your device in app storage. Audio is read from the folders you choose or from indexed device audio. Your existing audio files are never moved, renamed, modified, or deleted.

When you open or share a ZIP archive with the app, it unpacks the archive into a new folder inside the folder you chose for imports, without replacing any existing folder. The archive is read on the device and never uploaded. The app deletes the archive afterwards only when the app that shared it grants permission to do so.

The app uses these Android permissions:

- `FOREGROUND_SERVICE` and `FOREGROUND_SERVICE_MEDIA_PLAYBACK` keep playback running in the background with a media notification.
- `FOREGROUND_SERVICE_DATA_SYNC` keeps a large archive unpacking, with a progress notification, after you leave the app.
- `WAKE_LOCK` keeps playback running while the screen is off.
- `READ_MEDIA_AUDIO` lets you scan indexed audio on Android 13 and newer. `READ_EXTERNAL_STORAGE` serves the same purpose on older Android versions. You can instead select individual folders using Android's folder picker.

Clear EVB Folder Player's storage in Android settings or uninstall it to delete its local data. This does not delete your original audio files.

For privacy questions, open an issue at [GitHub Issues](https://github.com/evb0110/evb-folder-player/issues). Anything you choose to post there is handled by GitHub and may be public; avoid sharing private listening history or personal information.
