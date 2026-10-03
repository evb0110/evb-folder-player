# Release checklist

The public APKs are F-Droid Linux builds signed separately on the Mac. `scripts/build-android.sh` is for quick local builds and must not supply release assets. The application ID stays `com.evb.folderplayer`; both ABIs share one increasing versionCode and the existing signing key.

1. Bump `expo.version`, `expo.android.versionCode`, the package version and lockfile together. Update `docs/fdroid/com.evb.folderplayer.yml` version fields and add `fastlane/metadata/android/en-US/changelogs/<versionCode>.txt`. Review listing text, privacy policy and screenshots. For this release use 0.3.0 / 3.
2. Run `npm ci` and `npm run check`, then commit the reviewed app changes. The recipe's `Builds[0].commit` names the previous release until step 9; the build script substitutes the commit being built, and replaces `Repo` with a bundled local Git repository, only in its private BGK fdroiddata checkout. No source is pushed publicly for builds.
3. Read `~/fleet-hosts.md` and verify `fleet-host check bgk`. The script records Docker inventory, uses only `~/.devkit/folder-player-release/run.*`, creates a fresh container and build directory per ABI, and cleans up its containers, directories and any image it pulled that was absent beforehand. BGK is configurable with `FOLDER_PLAYER_BUILD_HOST`. The container image digest and fdroidserver, fdroiddata, Gradle dispatcher and bootstrap revisions are pinned to the previous successful validation. The setup mirrors F-Droid CI; the build runs source and APK scanners.
4. Build the reviewed commit, then independently rebuild arm64 from scratch:

   ```sh
   RELEASE_COMMIT=$(git rev-parse HEAD)
   npm run build:android:release -- "$RELEASE_COMMIT" dist/android/unsigned
   FOLDER_PLAYER_ABIS=arm64-v8a npm run build:android:release -- "$RELEASE_COMMIT" dist/android/repeat
   cmp dist/android/unsigned/EVB-Folder-Player-0.3.0-arm64-v8a-unsigned.apk dist/android/repeat/EVB-Folder-Player-0.3.0-arm64-v8a-unsigned.apk
   shasum -a 256 dist/android/{unsigned,repeat}/EVB-Folder-Player-0.3.0-arm64-v8a-unsigned.apk
   ```

   The armeabi-v7a run uses a local-only recipe variant changing just the ABI in `build` and `output`. F-Droid metadata ships arm64 only. Retain the two hashes and build logs. A mismatch blocks release; investigate entry-by-entry and fix the source or recipe before repeating both builds.
5. Sign on the Mac, referencing the existing credentials in place. Never copy or send credentials to BGK. The default is this checkout's ignored `.credentials`; for a worktree point to the main checkout:

   ```sh
   export FOLDER_PLAYER_CREDENTIALS_DIR=/Users/evb/WebstormProjects/folder-player/.credentials
   npm run sign:android:release -- dist/android/unsigned dist/android
   ```

   `ANDROID_HOME`, `FOLDER_PLAYER_JAVA_HOME` and `FOLDER_PLAYER_BUILD_TOOLS` override Mac SDK/JDK defaults. Build-tools 36.0.0 is the default. The script preserves the Linux APK alignment with `--alignment-preserved true`, uses password environment references, verifies package/version/label/ABI and no INTERNET permission, signs, checks the certificate, and writes verification receipts and `SHA256SUMS`. Published 0.2.0 APKs use v2 only, so the script matches that scheme. The certificate SHA-256 must be `beac197d53b5f35d548f8e3b4050a306b30d233cd235830e2d92b1f62183feec`.
6. Run the end-to-end upstream check before publishing. The signed APK is served over HTTPS only on loopback within the fresh container; only this local recipe's `Binaries` is changed. F-Droid's downloader requires HTTPS, so the container creates a temporary TLS certificate and process-local CA bundle, with a reference-download preflight. No F-Droid code is modified. F-Droid rebuilds, copies the upstream signature onto its APK and verifies it. Require the successful verification log and matching upstream APK:

   ```sh
   FOLDER_PLAYER_ABIS=arm64-v8a FOLDER_PLAYER_UPSTREAM_APK="$PWD/dist/android/EVB-Folder-Player-0.3.0-arm64-v8a.apk" npm run build:android:release -- "$RELEASE_COMMIT" dist/android/binaries-verification
   cmp dist/android/EVB-Folder-Player-0.3.0-arm64-v8a.apk dist/android/binaries-verification/arm64-v8a/verified-upstream.apk
   ```

   This checks signed-versus-unsigned content through F-Droid's signature-copy verification. Do not zipalign, recompress or otherwise modify the APK after signing.
7. Install the published 0.2.0 APK on a task-owned headless ARM64 emulator, then `adb -s SERIAL install -r dist/android/EVB-Folder-Player-0.3.0-arm64-v8a.apk`. Confirm the update is accepted, the launcher label is EVB Folder Player, startup has no crash, and saved app data remains. Stop the emulator afterwards. Also test playback on the owner's phone and supported architectures before public release; emulator startup is not physical headset or codec acceptance.
8. Record APK sizes in the IzzyOnDroid draft. Verify both checksums from `dist/android`, then tag the exact reviewed and tested commit. Integrating other app-source changes after validation requires rebuilding and repeating the checks. Write release notes in the ignored `.devkit/` like the previous release's: what changed, which APK to choose, how to check `SHA256SUMS`, and the signing certificate.

   ```sh
   (cd dist/android && shasum -a 256 -c SHA256SUMS)
   git tag -a v0.3.0 -m 'EVB Folder Player 0.3.0' "$RELEASE_COMMIT"
   git push origin v0.3.0
   gh release create v0.3.0 --repo evb0110/evb-folder-player --title 'EVB Folder Player 0.3.0' --notes-file .devkit/release-notes.md --verify-tag dist/android/EVB-Folder-Player-0.3.0-arm64-v8a.apk dist/android/EVB-Folder-Player-0.3.0-armeabi-v7a.apk dist/android/SHA256SUMS
   ```

9. Point the repository recipe at the published tag. The verification run's `normalized-recipe.yml` is the recipe after `fdroid rewritemeta`, with the tag's full commit hash and the public `Repo` and `Binaries`. Copy it over `docs/fdroid/com.evb.folderplayer.yml`, review the diff, commit and publish. This later commit is not part of the tag, so the tag never has to contain its own hash.

   ```sh
   cp dist/android/binaries-verification/arm64-v8a/normalized-recipe.yml docs/fdroid/com.evb.folderplayer.yml
   ```

10. Follow [store-submissions.md](store-submissions.md). F-Droid's Binaries URL points to the signed arm64 GitHub asset. Once accepted, IzzyOnDroid pulls the GitHub APK, and F-Droid rebuilds new tags and publishes the verified upstream APK with the developer signature. After acceptance F-Droid's own metadata, not this file, drives its builds. Monitor both stores; a GitHub release does not mean store publication.

Back up the existing ignored `.credentials/` directory securely. Never commit it or attach it to a release. Losing the key prevents compatible updates. Existing GitHub 0.2.0 installs can update to 0.3.0 without uninstalling or losing their listening journal.
