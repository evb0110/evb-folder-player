# Store submissions

| Store | Status | Account needed | Where |
| --- | --- | --- | --- |
| GitHub Releases | Published, v0.3.0 | none | <https://github.com/evb0110/evb-folder-player/releases> |
| IzzyOnDroid | Not submitted | Codeberg | <https://codeberg.org/IzzyOnDroid/repodata/issues/new/choose> |
| F-Droid | Not submitted | GitLab | <https://gitlab.com/fdroid/fdroiddata> |

Both stores read the code, store texts and screenshots from this GitHub repository, so no GitLab or Codeberg mirror of the code is needed. The accounts are only for filing the requests. IzzyOnDroid downloads the signed APK from GitHub Releases. F-Droid rebuilds the tagged source, verifies it against the upstream APK, and publishes the APK with the developer's signature.

## IzzyOnDroid

1. Create a Codeberg account at <https://codeberg.org/user/sign_up> and confirm the email.
2. Open <https://codeberg.org/IzzyOnDroid/repodata/issues/new/choose> and choose **App Inclusion Request**.
3. Fill in the form:

- **Title:** `[AppRequest] EVB Folder Player`
- **Guidelines:** tick all four boxes: you are the developer, the app follows the inclusion policy, it is not listed yet, and the Fastlane folder exists.
- **Link to the source code:** `https://github.com/evb0110/evb-folder-player`
- **Link to app in another app store:** leave empty, or add the F-Droid page once it exists.
- **License used:** `MIT`
- **Categories:** `Multimedia`, `Reading`
- **Summary:** `Offline audiobook player for audio folders already on your phone, with saved progress, history, bookmarks and large car-mode controls.`
- **Description:**

  ```text
  EVB Folder Player plays audiobooks from folders on the device. Pick a folder with Android's folder picker, including subfolders, or scan indexed device audio. Files are never moved, renamed, modified or deleted.

  Each folder keeps its own listening position. Progress is saved during playback and on pause, with history, bookmarks, checkpoints before jumps and undo. It has chapter lists with natural filename ordering, playback speed, a sleep timer, a large car mode, light and dark themes, and background playback with a media notification. Headset next/previous presses are ignored so a book cannot skip chapters by accident.

  No accounts, ads, analytics or tracking. The release APK has no INTERNET permission.

  Releases on GitHub carry two APKs: EVB-Folder-Player-<version>-arm64-v8a.apk and EVB-Folder-Player-<version>-armeabi-v7a.apk (same versionCode and signing key). Please track whichever ABI you prefer. For 0.3.0, arm64-v8a is 28.6 MB (28,636,101 bytes) and armeabi-v7a is 23.5 MB (23,454,693 bytes).
  ```

- **Build instructions:**

  ```text
  Published APKs use scripts/build-release-android.sh <tag-or-commit>, which runs the repository's F-Droid recipe in the buildserver-trixie Linux container on BGK. Each architecture is built in a fresh container. scripts/sign-release-android.mjs signs the unsigned outputs on macOS with the existing developer key. Credentials never leave the Mac. See docs/release.md for the complete flow. scripts/build-android.sh remains available for quick local builds.
  ```

- **Assistance Level:** `Dominant – Most code or content was "AI"-generated`. Change this if it doesn't match how you see it.
- **"AI" Tool(s):** `Claude Code (Claude Opus), OpenAI Codex (GPT)`
- **What did the tools help with:** `Implementation, tests, UI design, build configuration, store metadata and documentation, written to my specification and reviewed by me.`
- **AI Accountability:** tick only what is true. You tested the release on your own phone, so the manual-testing box applies.
- **Further Notices:** `Signing certificate SHA-256: beac197d53b5f35d548f8e3b4050a306b30d233cd235830e2d92b1f62183feec. The APK has no dependency-info signing block. An F-Droid inclusion request is planned separately.`

4. Submit, then watch the issue for questions. Codeberg emails you when someone replies.

## F-Droid

F-Droid submissions are merge requests to the `fdroiddata` repository. Everything below can be done in the GitLab website.

1. Create a GitLab account at <https://gitlab.com/users/sign_up>. If GitLab asks for a phone number or credit card for CI, don't provide one. Mention it in the merge request instead, and the F-Droid team will run the CI.
2. Open <https://gitlab.com/fdroid/fdroiddata> and click **Fork**. Keep the fork public.
3. In your fork, create a branch named `com.evb.folderplayer`. Use **Code → Branches → New branch**, starting from `master`.
4. On that branch, add the file `metadata/com.evb.folderplayer.yml`. Paste the exact contents of [`docs/fdroid/com.evb.folderplayer.yml`](fdroid/com.evb.folderplayer.yml) from this repository. It already names the v0.3.0 commit. Use the commit message `New App: com.evb.folderplayer`.
5. Open **Merge requests → New merge request**. Choose your branch as the source and `fdroid/fdroiddata` `master` as the target. Title it `New app: EVB Folder Player`, choose the **App inclusion** template, and tick the checklist items. Add this note under the checklist:

   ```text
   I am the author. Source, Fastlane metadata (en-US) and tags are at https://github.com/evb0110/evb-folder-player; issues are on GitHub.

   Expo/React Native app; android/ is generated by expo prebuild during the build, so versions are read from app.json. The recipe was run through fdroid lint and fdroid build in the fdroidserver buildserver image before submission.

   Reproducible builds are enabled with Binaries and AllowedAPKSigningKeys. The upstream APK is produced by fdroid build --verbose --test --refresh-scanner --on-server --no-tarball in the buildserver-trixie Linux container, using this recipe, then signed separately with apksigner on macOS. No source or APK content is changed between the Linux build and signing. Two fresh unsigned arm64 builds and upstream Binaries verification are required before publication.

   ABI: the recipe builds arm64-v8a only. GitHub and IzzyOnDroid also carry armeabi-v7a, built with a local recipe variant changing only the architecture and output path. Both architectures retain versionCode 3 and the same signing key.
   ```

6. Wait for the pipeline, which takes about an hour, and for a reviewer, which can take weeks. Answer their comments in the merge request. If they ask for a change, edit the same file on the same branch. Don't open a new merge request.

## After acceptance

- Replace "submission pending" in the README with the store links and add the official badges: <https://gitlab.com/fdroid/artwork/-/tree/master/badge> and <https://codeberg.org/IzzyOnDroid/assets>.
- New versions need no further requests. Tag a release as described in [release.md](release.md). IzzyOnDroid picks up the GitHub release APK, and F-Droid builds the new tag automatically.
- F-Droid verifies the upstream arm64 APK and publishes it with the same developer key used by GitHub and IzzyOnDroid. Users can update across those sources in place and retain listening progress. Never uninstall to change distribution sources.
