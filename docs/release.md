# Release checklist

Public APKs are F-Droid Linux builds signed separately on the Mac. `scripts/build-android.sh` is for quick local builds and must not supply release assets. Both ABIs share the application ID `com.evb.folderplayer`, one increasing versionCode and the existing signing key.

1. Bump `expo.version`, `expo.android.versionCode`, the package version and lockfile together. Update the version fields in `docs/fdroid/com.evb.folderplayer.yml` and add `fastlane/metadata/android/en-US/changelogs/<versionCode>.txt`. Review listing text, privacy policy and screenshots.
2. Run `npm ci` and `npm run check`, then commit the reviewed app changes. Read `~/fleet-hosts.md` and verify `fleet-host check bgk`.
3. Run the complete build and verification flow on the Mac, referencing the existing credentials in place:

   ```sh
   RELEASE_REF=HEAD # or a reviewed tag / commit
   RELEASE_COMMIT=$(git rev-parse "$RELEASE_REF^{commit}")
   VERSION=$(git show "$RELEASE_COMMIT:app.json" | node -e 'let s=""; process.stdin.on("data", c => s += c).on("end", () => console.log(JSON.parse(s).expo.version))')
   RELEASE_DIR="$PWD/dist/android/release-$VERSION"
   export FOLDER_PLAYER_CREDENTIALS_DIR=/Users/evb/WebstormProjects/folder-player/.credentials
   npm run release:android -- "$RELEASE_COMMIT" "$RELEASE_DIR"
   ```

   The output directory must be empty or absent. The command builds arm64-v8a, armeabi-v7a and a repeat arm64-v8a concurrently, compares the unsigned arm64 pair, signs both APKs on the Mac, then runs a fresh F-Droid Binaries build. It requires byte equality between the original and final unsigned arm64 builds, equality with the verified signed upstream APK, and a passing `SHA256SUMS` check. Any mismatch blocks release. A failed parallel build stops the other task containers and reports the failing ABI and log path.

   `FOLDER_PLAYER_BUILD_CONCURRENCY` caps independent builds, default 2. Three concurrent builds caused swap growth and memory stalls on shared BGK, so the default is two. Use a lower value when BGK has less memory available or competing work. `FOLDER_PLAYER_BUILD_HOST` defaults to `bgk`; the host needs Bash 5.1 or newer. `timings.tsv` records phase and total wall time. `unsigned/` holds per-build logs, timings, Docker inventories, image identity and `resources.tsv` with load, available memory, free swap and swap I/O counters and memory pressure sampled every 15 seconds. Binaries verification has separate receipts under `binaries-verification/`.

   Only the pinned F-Droid build image is cached on BGK. It is pulled if absent and never removed by release cleanup. Every build uses a fresh container, directory, app checkout and private Gradle, npm, SDK and apt state. Nothing from a previous build directory is reused or mounted as a cache. React Native embeds a development-server IP even in release resources. The container supplies `ORG_GRADLE_PROJECT_reactNativeDevServerIp=172.17.0.3`, matching published APKs, so Docker address allocation cannot change the output. This fixes a build input; it does not patch APKs or reuse prior output. Runs stay under `~/.devkit/folder-player-release/run.*`; cleanup touches only their containers and directories. Shared Editorum and EdiLaTeX services remain running.

   The image digest and fdroidserver, fdroiddata, Gradle dispatcher and bootstrap revisions are pinned. Setup mirrors F-Droid CI and runs source and APK scanners. Only the private recipe substitutes the selected commit and a bundled local Git `Repo`. The armeabi-v7a variant changes the ABI in `build` and `output`; public metadata ships arm64 only. Investigate a mismatch and fix the source or recipe before repeating clean builds.
4. Install the previous published APK on a task-owned headless ARM64 emulator, then install the new APK over it:

   ```sh
   adb -s SERIAL install -r "$RELEASE_DIR/EVB-Folder-Player-$VERSION-arm64-v8a.apk"
   ```

   Confirm the update is accepted, the launcher label is EVB Folder Player, startup has no crash and saved app data remains. Stop the emulator afterwards. Test playback on the owner's phone and supported architectures before public release; emulator startup does not prove physical headset or codec behavior.
5. Record APK sizes in the IzzyOnDroid draft. Integrating app-source changes after validation requires rebuilding and repeating the checks. Write release notes in ignored `.devkit/`: what changed, which APK to choose, how to check `SHA256SUMS` and the signing certificate. Tag the exact reviewed and tested commit, then publish:

   ```sh
   (cd "$RELEASE_DIR" && shasum -a 256 -c SHA256SUMS)
   git tag -a "v$VERSION" -m "EVB Folder Player $VERSION" "$RELEASE_COMMIT"
   git push origin "v$VERSION"
   gh release create "v$VERSION" --repo evb0110/evb-folder-player --title "EVB Folder Player $VERSION" --notes-file .devkit/release-notes.md --verify-tag "$RELEASE_DIR/EVB-Folder-Player-$VERSION-arm64-v8a.apk" "$RELEASE_DIR/EVB-Folder-Player-$VERSION-armeabi-v7a.apk" "$RELEASE_DIR/SHA256SUMS"
   ```

6. Point the repository recipe at the published tag. Copy the verification run's `normalized-recipe.yml`, review the diff, commit and publish. It contains the full selected commit hash and public `Repo` and `Binaries`, after `fdroid rewritemeta`. This later commit is outside the tag, so the tag never contains its own hash.

   ```sh
   cp "$RELEASE_DIR/binaries-verification/arm64-v8a/normalized-recipe.yml" docs/fdroid/com.evb.folderplayer.yml
   ```

7. Follow [store-submissions.md](store-submissions.md). F-Droid's Binaries URL points to the signed arm64 GitHub asset. Once accepted, IzzyOnDroid pulls the GitHub APK, and F-Droid rebuilds new tags and publishes the verified upstream APK with the developer signature. After acceptance F-Droid's own metadata drives its builds. Monitor both stores; a GitHub release does not mean store publication.

## Manual fallback

The individual scripts remain usable. Use the variables above and separate empty output directories. Build both ABIs and repeat arm64 independently:

```sh
npm run build:android:release -- "$RELEASE_COMMIT" "$RELEASE_DIR/unsigned"
FOLDER_PLAYER_ABIS=arm64-v8a npm run build:android:release -- "$RELEASE_COMMIT" "$RELEASE_DIR/repeat"
cmp "$RELEASE_DIR/unsigned/EVB-Folder-Player-$VERSION-arm64-v8a-unsigned.apk" "$RELEASE_DIR/repeat/EVB-Folder-Player-$VERSION-arm64-v8a-unsigned.apk"
npm run sign:android:release -- "$RELEASE_DIR/unsigned" "$RELEASE_DIR" "$RELEASE_COMMIT"
FOLDER_PLAYER_ABIS=arm64-v8a FOLDER_PLAYER_UPSTREAM_APK="$RELEASE_DIR/EVB-Folder-Player-$VERSION-arm64-v8a.apk" npm run build:android:release -- "$RELEASE_COMMIT" "$RELEASE_DIR/binaries-verification"
cmp "$RELEASE_DIR/unsigned/EVB-Folder-Player-$VERSION-arm64-v8a-unsigned.apk" "$RELEASE_DIR/binaries-verification/arm64-v8a/unsigned.apk"
cmp "$RELEASE_DIR/EVB-Folder-Player-$VERSION-arm64-v8a.apk" "$RELEASE_DIR/binaries-verification/arm64-v8a/verified-upstream.apk"
(cd "$RELEASE_DIR" && shasum -a 256 -c SHA256SUMS)
```

Signing uses the selected commit's package, version and label; without the optional third argument it uses the checkout's `app.json`. `ANDROID_HOME`, `FOLDER_PLAYER_JAVA_HOME` and `FOLDER_PLAYER_BUILD_TOOLS` override Mac SDK/JDK defaults. Build-tools 36.0.0 is the default. Signing preserves Linux APK alignment, uses password environment references, verifies package/version/label/ABI and no INTERNET permission, and writes certificate receipts and `SHA256SUMS`. It uses deterministic v2 signatures matching published APKs. The certificate SHA-256 must be `beac197d53b5f35d548f8e3b4050a306b30d233cd235830e2d92b1f62183feec`.

For Binaries verification, the signed APK is served over HTTPS on loopback inside the fresh container. Only the private recipe's `Binaries` changes. A temporary TLS identity and process-local CA bundle allow F-Droid's HTTPS downloader to preflight the exact reference bytes. No F-Droid code is modified. F-Droid rebuilds, copies the upstream signature onto its APK and verifies it against the allowed signer. Require the successful comparison and signer log entries as well as the byte comparisons above. Do not zipalign, recompress or modify an APK after signing.

Back up the existing ignored `.credentials/` securely. Never commit it or attach it to a release, and never copy or send it to BGK. Losing the key prevents compatible updates. Install updates over the existing app to retain the listening journal.
