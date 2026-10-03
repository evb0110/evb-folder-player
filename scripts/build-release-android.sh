#!/usr/bin/env bash
# F-Droid's Linux build, followed by a separate Mac signing step. No keys leave the Mac.
# Usage: scripts/build-release-android.sh [commit-or-tag] [unsigned-output-directory]
# FOLDER_PLAYER_ABIS=arm64-v8a builds only arm64. FOLDER_PLAYER_UPSTREAM_APK verifies
# a signed arm64 APK through Binaries using a container-local HTTP server.
set -euo pipefail
cd "$(dirname "$0")/.."
ref="${1:-HEAD}"
commit="$(git rev-parse "$ref^{commit}")"
git merge-base --is-ancestor "$commit" HEAD
host="${FOLDER_PLAYER_BUILD_HOST:-bgk}"
abis="${FOLDER_PLAYER_ABIS:-arm64-v8a armeabi-v7a}"
image='registry.gitlab.com/fdroid/fdroidserver@sha256:9cb68105642ca4e7b295f0ceab10f069f5b3247dc18fa7c36046e9d81aa469a8'
out="${2:-dist/android/unsigned}"
mkdir -p "$out" .devkit/release-tmp
out="$(cd "$out" && pwd)"
export TMPDIR="${TMPDIR:-$PWD/.devkit/release-tmp}"
scratch="$(mktemp -d "$TMPDIR/fdroid-release.XXXXXX")"
remote=''
cleanup() {
  if [[ -n "$remote" ]]; then
    # The remote trap restores BGK ownership before removing a newly pulled image.
    # Do not start another container here, which would re-pull that removed image.
    ssh "$host" "rm -rf '$remote'" || true
  fi
  rm -rf "$scratch"
}
trap cleanup EXIT
fleet-host check "$host" </dev/null
remote="$(ssh "$host" 'mkdir -p ~/.devkit/folder-player-release; mktemp -d ~/.devkit/folder-player-release/run.XXXXXX')"
[[ "$remote" =~ ^/home/evb/\.devkit/folder-player-release/run\.[a-zA-Z0-9]+$ ]]
git bundle create "$scratch/source.bundle" HEAD
git show "$commit:docs/fdroid/com.evb.folderplayer.yml" > "$scratch/recipe.yml"
git show "$commit:app.json" > "$scratch/app.json"
version="$(node -p "require('$scratch/app.json').expo.version")"
code="$(node -p "require('$scratch/app.json').expo.android.versionCode")"
scp "$scratch/source.bundle" "$scratch/recipe.yml" "$host:$remote/" >/dev/null
if [[ -n "${FOLDER_PLAYER_UPSTREAM_APK:-}" ]]; then
  [[ "$abis" == arm64-v8a ]] || { echo 'Binaries verification requires arm64-v8a only' >&2; exit 1; }
  scp "$FOLDER_PLAYER_UPSTREAM_APK" "$host:$remote/upstream.apk" >/dev/null
fi
cat > "$scratch/container.sh" <<'CONTAINER'
#!/bin/bash
# Mirrors the validated ci-setup.sh / ci-build.sh / fdroid-env.sh sequence.
set -euxo pipefail
source /etc/profile.d/bsenv.sh
export fdroidserver=/task/fdroidserver PATH="/task/fdroidserver:$PATH"
export PYTHONPATH="$fdroidserver:$fdroidserver/examples" PYTHONUNBUFFERED=true
export GRADLE_USER_HOME=/home/vagrant/.gradle HOME=/home/vagrant
export gpghome=/task/unused keystore=/task/unused keystorepass=unused keypass=unused serverwebroot=/tmp
apt-get update
apt-get -y dist-upgrade
sdkmanager 'platform-tools' 'build-tools;31.0.0'
git clone https://gitlab.com/fdroid/fdroidserver.git /task/fdroidserver
git -C /task/fdroidserver config transfer.fsckObjects true
git -C /task/fdroidserver checkout c21c177ff6d813697aaf9c988ca9fbb2b571b468
git -C "$home_vagrant/gradlew-fdroid" fetch origin
git -C "$home_vagrant/gradlew-fdroid" checkout c7227d147483979bb5c408048cee3533a8814fb0
git clone https://gitlab.com/fdroid/fdroid-bootstrap-buildserver.git /task/bootstrap
git -C /task/bootstrap config transfer.fsckObjects true
git -C /task/bootstrap checkout b33507043e6750065745dd2d8c35d3bb5c633c11
cp /task/bootstrap/roles/production_hardening/files/gitconfig /task/gitconfig
git init /task/fdroiddata
git -C /task/fdroiddata remote add origin https://gitlab.com/fdroid/fdroiddata.git
git -C /task/fdroiddata fetch --depth=1 origin f3ed63fc485c9e147524848fcb56f73c7c555903
git -C /task/fdroiddata checkout FETCH_HEAD
# Only our app is linted/built. All overrides are confined to this local checkout.
rm -rf /task/fdroiddata/metadata
mkdir -p /task/fdroiddata/{metadata,build,logs,tmp,unsigned,srclibs} /task/evidence "$home_vagrant"/{.android,.gradle,metadata}
git clone --bare /task/source.bundle /task/source.git
python3 - "$RELEASE_COMMIT" "$RELEASE_ABI" "$RELEASE_CODE" <<'PY'
import sys, yaml
from pathlib import Path
commit, abi, code = sys.argv[1:]
p = yaml.safe_load(Path('/task/recipe.yml').read_text())
b = p['Builds'][0]
assert int(b['versionCode']) == int(code)
b['commit'] = commit
if abi != 'arm64-v8a':
    b['output'] = b['output'].replace('arm64-v8a', abi)
    b['build'] = [s.replace('arm64-v8a', abi) for s in b['build']]
if not Path('/task/upstream.apk').exists():
    # Nothing public exists before release. Unsigned production uses this same build.
    p.pop('Binaries', None)
    p.pop('AllowedAPKSigningKeys', None)
Path('/task/fdroiddata/metadata/com.evb.folderplayer.yml').write_text(yaml.safe_dump(p, sort_keys=False))
PY
cat > /task/fdroiddata/config.yml <<'CONFIG'
sdk_path: /opt/android-sdk
ndk_paths:
  r27b: /opt/android-sdk/ndk/27.1.12297006
CONFIG
ln -s /task/fdroiddata/tmp "$home_vagrant/tmp"
ln -s /task/fdroiddata/srclibs "$home_vagrant/srclibs"
ln -s "$home_vagrant/.gradle" /task/fdroiddata/.gradle
cp /task/fdroiddata/metadata/com.evb.folderplayer.yml "$home_vagrant/metadata/"
chown -R vagrant /task "$home_vagrant"
chmod 0600 /task/fdroiddata/config.yml
runuser -u vagrant -- fdroid --version
cd /task/fdroiddata
# Local Repo deliberately differs from SourceCode; retain the lint result.
runuser -u vagrant -- fdroid lint com.evb.folderplayer > /task/evidence/lint-initial.log 2>&1 || true
runuser -u vagrant -- fdroid rewritemeta com.evb.folderplayer > /task/evidence/rewritemeta.log 2>&1
cp metadata/com.evb.folderplayer.yml /task/evidence/normalized-recipe.yml
runuser -u vagrant -- fdroid rewritemeta com.evb.folderplayer
cmp metadata/com.evb.folderplayer.yml /task/evidence/normalized-recipe.yml
runuser -u vagrant -- fdroid rewritemeta --list com.evb.folderplayer
runuser -u vagrant -- fdroid lint com.evb.folderplayer > /task/evidence/lint.log 2>&1
sed -i 's|^Repo: .*|Repo: /task/source.git|' metadata/com.evb.folderplayer.yml
if [[ -f /task/upstream.apk ]]; then
  sed -i 's|^Binaries: .*|Binaries: http://127.0.0.1:8765/upstream.apk|' metadata/com.evb.folderplayer.yml
fi
cp metadata/com.evb.folderplayer.yml /task/evidence/local-recipe.yml
apt-get install -y sudo openjdk-21-jdk-headless
update-alternatives --set java /usr/lib/jvm/java-21-openjdk-amd64/bin/java
cp metadata/com.evb.folderplayer.yml "$home_vagrant/metadata/"
ln -s /task/fdroiddata "$home_vagrant/fdroiddata"
ln -s /task/gitconfig "$home_vagrant/.gitconfig"
cd "$home_vagrant"
sudo --preserve-env --user vagrant env PATH="$PATH" PYTHONPATH="$PYTHONPATH" HOME="$home_vagrant" fdroid fetchsrclibs "com.evb.folderplayer:$RELEASE_CODE" --verbose
rm "$home_vagrant/fdroiddata" "$home_vagrant/.gitconfig"
http_pid=''
if [[ -f /task/upstream.apk ]]; then
  python3 -m http.server 8765 --bind 127.0.0.1 --directory /task > /task/evidence/http.log 2>&1 &
  http_pid=$!
  trap 'kill "$http_pid"; wait "$http_pid" || true' EXIT
fi
unset CI
sudo --preserve-env --user vagrant env PATH="$PATH" PYTHONPATH="$PYTHONPATH" HOME="$home_vagrant" fdroid build --verbose --test --refresh-scanner --on-server --no-tarball "com.evb.folderplayer:$RELEASE_CODE" 2>&1 | tee /task/evidence/fdroid-build.log
# fdroid can exit zero after failed builds; require the expected APK.
cp "/task/fdroiddata/tmp/com.evb.folderplayer_$RELEASE_CODE.apk" /task/evidence/unsigned.apk
/opt/android-sdk/build-tools/36.0.0/aapt2 dump badging /task/evidence/unsigned.apk > /task/evidence/aapt2.txt
cd /task/fdroiddata
runuser -u vagrant -- fdroid scanner --exit-code --refresh --verbose /task/evidence/unsigned.apk > /task/evidence/scanner-apk.log 2>&1
sha256sum /task/evidence/unsigned.apk > /task/evidence/SHA256SUMS
if [[ -f /task/upstream.apk ]]; then
  # Build verifies by copying the upstream signature onto the rebuild and checking it.
  # --test retains failed unsigned APKs, so require success and the allowed signer.
  grep -F "compared built binary to supplied reference binary successfully" /task/evidence/fdroid-build.log
  grep -F "supplied reference binary has allowed signer" /task/evidence/fdroid-build.log
  test -f "/task/fdroiddata/tmp/binaries/com.evb.folderplayer_$RELEASE_CODE.binary.apk"
  cp "/task/fdroiddata/tmp/binaries/com.evb.folderplayer_$RELEASE_CODE.binary.apk" /task/evidence/verified-upstream.apk
fi
CONTAINER
scp "$scratch/container.sh" "$host:$remote/" >/dev/null
for abi in $abis; do
  [[ "$abi" == arm64-v8a || "$abi" == armeabi-v7a ]]
  dest="$out/$abi"
  mkdir -p "$dest"
  # Fresh container, task directory, Gradle home and app checkout for every ABI/run.
  status=0
  ssh "$host" bash -s -- "$remote" "$abi" "$commit" "$code" "$image" <<'REMOTE' > "$dest/build.log" 2>&1 || status=$?
set -euo pipefail
base="$1"; abi="$2"; commit="$3"; code="$4"; image="$5"
docker images --no-trunc > "$base/docker-images-before.txt"
docker ps -a --no-trunc > "$base/docker-containers-before.txt"
had_image=false
docker image inspect "$image" >/dev/null 2>&1 && had_image=true
if ! $had_image; then docker pull "$image"; fi
run="$base/$abi"
mkdir "$run"
cp "$base"/{source.bundle,recipe.yml,container.sh} "$run/"
if [[ -f "$base/upstream.apk" ]]; then cp "$base/upstream.apk" "$run/"; fi
name="fp-release-$(basename "$base")-$abi"
cleanup() {
  docker rm -f "$name" >/dev/null 2>&1 || true
  docker run --rm -v "$base:/task" "$image" chown -R "$(id -u):$(id -g)" /task || true
  if ! $had_image; then docker image rm "$image" || true; fi
}
trap cleanup EXIT
docker run --name "$name" -v "$run:/task" -e RELEASE_ABI="$abi" -e RELEASE_COMMIT="$commit" -e RELEASE_CODE="$code" "$image" bash /task/container.sh
REMOTE
  scp -r "$host:$remote/$abi/evidence/." "$dest/" >/dev/null
  [[ "$status" == 0 ]] || { tail -80 "$dest/build.log" >&2; exit "$status"; }
  cp "$dest/unsigned.apk" "$out/EVB-Folder-Player-$version-$abi-unsigned.apk"
  printf '%s\n' "$commit" > "$dest/commit.txt"
done
(cd "$out" && shasum -a 256 EVB-Folder-Player-*-unsigned.apk > SHA256SUMS)
echo "Unsigned F-Droid builds and logs: $out"
