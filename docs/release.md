# Release checklist

1. Bump `expo.version` and `expo.android.versionCode` in `app.json`. Keep the package version aligned. Version codes must increase; the first public release is 0.2.0, code 2.
2. Add `fastlane/metadata/android/en-US/changelogs/<versionCode>.txt` (at most 500 characters). Review the listing, privacy policy, and screenshots against the release UI.
3. Run `npm run check`, then `npm run build:android`. Verify both APKs' package, version name/code, signing certificate, and permissions. The release must have no `INTERNET` permission. Test an in-place upgrade and playback on the supported architectures.
4. Check `dist/android/SHA256SUMS` against both `folder-player-X.Y.Z-arm64-v8a.apk` and `folder-player-X.Y.Z-armeabi-v7a.apk`. Before the first public release, review the secret-scan report and resolve any private information in the history being published.
5. Commit the reviewed release changes and tag that commit `vX.Y.Z`. Create a GitHub release for the tag and attach both APKs and `SHA256SUMS` from that build. For v0.2.0, use `folder-player-0.2.0-arm64-v8a.apk` and `folder-player-0.2.0-armeabi-v7a.apk`.
6. Once accepted, IzzyOnDroid checks GitHub Releases and pulls the matching APK. F-Droid builds from source: its metadata uses `UpdateCheckMode: Tags` and `AutoUpdateMode: Version` to detect tags and add builds. Expo generates Android files, so the metadata must explicitly read versions from `app.json`. Monitor each repository's update result; a GitHub release alone does not mean either store has published it.

Back up the ignored `.credentials/` directory securely, including the keystore and signing properties. Never commit it or attach it to a release. Losing the signing key prevents compatible updates to existing installations. F-Droid normally uses its own signing key, so users may need to stay with the same distribution source for in-place updates.
