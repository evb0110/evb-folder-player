#!/usr/bin/env bash
# F-Droid's Linux build, followed by a separate Mac signing step. No keys leave the Mac.
# Usage: scripts/build-release-android.sh [--release] [commit-or-tag] [output-directory]
# --release composes parallel clean builds, repeat comparison, signing and Binaries.
# FOLDER_PLAYER_BUILD_CONCURRENCY caps independent builds (default 2).
# FOLDER_PLAYER_ABIS=arm64-v8a builds only arm64. FOLDER_PLAYER_UPSTREAM_APK verifies
# a signed arm64 APK through Binaries using a container-local HTTPS server.
set -euo pipefail
cd "$(dirname "$0")/.."
started=$(date +%s)
release=false
if [[ "${1:-}" == --release ]]; then release=true; shift; fi
ref="${1:-HEAD}"
concurrency="${FOLDER_PLAYER_BUILD_CONCURRENCY:-2}"
[[ "$concurrency" =~ ^[1-9][0-9]*$ ]] || { echo 'Concurrency must be a positive integer' >&2; exit 1; }
commit="$(git rev-parse "$ref^{commit}")"
git merge-base --is-ancestor "$commit" HEAD
host="${FOLDER_PLAYER_BUILD_HOST:-bgk}"
abis="${FOLDER_PLAYER_ABIS:-arm64-v8a armeabi-v7a}"
jobs=()
for abi in $abis; do
  [[ "$abi" == arm64-v8a || "$abi" == armeabi-v7a ]] || { echo "Unsupported ABI: $abi" >&2; exit 1; }
  for job in ${jobs[@]+"${jobs[@]}"}; do [[ "$job" != "$abi" ]] || { echo "Duplicate ABI: $abi" >&2; exit 1; }; done
  jobs+=("$abi")
done
[[ -n "${jobs[0]:-}" ]] || { echo 'At least one ABI is required' >&2; exit 1; }
image='registry.gitlab.com/fdroid/fdroidserver@sha256:9cb68105642ca4e7b295f0ceab10f069f5b3247dc18fa7c36046e9d81aa469a8'
if $release; then
  [[ -z "${FOLDER_PLAYER_UPSTREAM_APK:-}" && -z "${FOLDER_PLAYER_ABIS:-}" ]] || {
    echo '--release requires both ABIs and manages upstream verification itself' >&2; exit 1;
  }
  out="${2:-dist/android/release}"
else
  out="${2:-dist/android/unsigned}"
fi
# Fresh outputs prevent stale APKs or receipts from satisfying a failed build.
[[ ! -e "$out" ]] || [[ -d "$out" && -z "$(ls -A "$out")" ]] || {
  echo "Output directory must be empty: $out" >&2; exit 1;
}
mkdir -p "$out" .devkit/release-tmp
out="$(cd "$out" && pwd)"
export TMPDIR="${TMPDIR:-$PWD/.devkit/release-tmp}"
scratch="$(mktemp -d "$TMPDIR/fdroid-release.XXXXXX")"
remote=''
cleanup() {
  if [[ -n "$remote" ]]; then
    # On interruption, stop the remote supervisor so its trap stops task containers.
    ssh "$host" "if test -f '$remote/supervisor.pid'; then kill -TERM \$(cat '$remote/supervisor.pid') 2>/dev/null || true; fi" || true
    if [[ "${collected:-false}" == true ]]; then
      ssh "$host" "rm -rf '$remote'" || true
    else
      echo "Uncollected remote evidence retained: $host:$remote" >&2
    fi
  fi
  rm -rf "$scratch"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
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
python3 - <<'PYLOCAL'
import yaml
from pathlib import Path
path = Path('metadata/com.evb.folderplayer.yml')
p = yaml.safe_load(path.read_text())
p['Repo'] = '/task/source.git'
if Path('/task/upstream.apk').exists():
    p['Binaries'] = 'https://127.0.0.1:8765/upstream.apk'
path.write_text(yaml.safe_dump(p, sort_keys=False))
PYLOCAL
chown vagrant metadata/com.evb.folderplayer.yml
runuser -u vagrant -- fdroid rewritemeta com.evb.folderplayer > /task/evidence/rewritemeta-local.log 2>&1
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
  # F-Droid's reference downloader enforces HTTPS. This TLS identity is temporary;
  # it is unrelated to the developer APK key and trusted only by this process tree.
  openssl req -x509 -newkey rsa:2048 -nodes -sha256 -days 1 -subj '/CN=127.0.0.1' \
    -addext 'subjectAltName=IP:127.0.0.1' -keyout /task/tls.key -out /task/tls.crt \
    > /task/evidence/tls-setup.log 2>&1
  cat /etc/ssl/certs/ca-certificates.crt /task/tls.crt > /task/ca-bundle.crt
  export REQUESTS_CA_BUNDLE=/task/ca-bundle.crt
  cat > /task/https-server.py <<'PYHTTP'
from functools import partial
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
import ssl
server = ThreadingHTTPServer(('127.0.0.1', 8765), partial(SimpleHTTPRequestHandler, directory='/task'))
context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
context.load_cert_chain('/task/tls.crt', '/task/tls.key')
server.socket = context.wrap_socket(server.socket, server_side=True)
with open('/task/https-ready', 'w') as ready:
    ready.write('ready\n')
server.serve_forever()
PYHTTP
  mkfifo /task/https-ready
  exec 3<> /task/https-ready
  python3 /task/https-server.py > /task/evidence/https.log 2>&1 &
  http_pid=$!
  trap 'kill "$http_pid"; wait "$http_pid" || true' EXIT
  read -r -t 30 ready <&3
  test "$ready" = ready
  exec 3>&-
  runuser -u vagrant -- python3 - <<'PYPREFLIGHT'
from pathlib import Path
from fdroidserver import net
net.download_file('https://127.0.0.1:8765/upstream.apk', local_filename='/task/evidence/upstream-preflight.apk', retries=0)
assert Path('/task/evidence/upstream-preflight.apk').read_bytes() == Path('/task/upstream.apk').read_bytes()
print('F-Droid HTTPS reference download preflight PASS')
PYPREFLIGHT
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
# One supervisor owns all workers, their containers and resource sampling.
cat > "$scratch/supervisor.sh" <<'REMOTE'
#!/bin/bash
set -euo pipefail
base="$1"; commit="$2"; code="$3"; image="$4"; concurrency="$5"; shift 5
jobs=("$@")
cd "$base"
echo "$$" > supervisor.pid
start=$(date +%s)
printf 'phase\tseconds\n' > timings.tsv
docker images --no-trunc > docker-images-before.txt
docker ps -a --no-trunc > docker-containers-before.txt
declare -A workers=()
sampler=''
cleanup() {
  status=$?
  trap - EXIT INT TERM
  # Remove only containers named for this unique run, never shared services.
  for pid in "${!workers[@]}"; do kill "$pid" 2>/dev/null || true; done
  [[ -z "$sampler" ]] || kill "$sampler" 2>/dev/null || true
  wait || true
  for job in "${jobs[@]}"; do
    docker rm -f "fp-release-$(basename "$base")-$job" >/dev/null 2>&1 || true
  done
  # A separate fresh cleanup container restores ownership, with no build caches.
  if docker image inspect "$image" >/dev/null 2>&1; then
    docker run --rm --name "fp-release-$(basename "$base")-cleanup" -v "$base:/task" "$image" \
      chown -R "$(id -u):$(id -g)" /task || status=1
  fi
  docker ps -a --no-trunc > docker-containers-after.txt
  rm -f supervisor.pid
  exit "$status"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
pull_start=$(date +%s)
if ! docker image inspect "$image" >/dev/null 2>&1; then
  echo "Pulling pinned image (retained between releases)"
  docker pull "$image"
else
  echo "Using cached pinned image"
fi
printf 'image\t%s\n' "$(( $(date +%s) - pull_start ))" >> timings.tsv
docker image inspect "$image" > image.json
printf 'epoch\tload1\tload5\tload15\tMemAvailable_kB\tSwapFree_kB\tpswpin_pages\tpswpout_pages\tmemory_some_avg10\tmemory_full_avg10\n' > resources.tsv
sample() {
  while true; do
    read -r load1 load5 load15 rest < /proc/loadavg
    available=$(awk '/^MemAvailable:/ {print $2}' /proc/meminfo)
    swap=$(awk '/^SwapFree:/ {print $2}' /proc/meminfo)
    sin=$(awk '/^pswpin / {print $2}' /proc/vmstat)
    sout=$(awk '/^pswpout / {print $2}' /proc/vmstat)
    some=$(awk '/^some / {sub("avg10=", "", $2); print $2}' /proc/pressure/memory)
    full=$(awk '/^full / {sub("avg10=", "", $2); print $2}' /proc/pressure/memory)
    printf '%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\n' "$(date +%s)" "$load1" "$load5" "$load15" "$available" "$swap" "$sin" "$sout" "$some" "$full" >> resources.tsv
    sleep 15
  done
}
sample & sampler=$!
build_job() {
  job="$1"; abi="$job"
  [[ "$job" != repeat-arm64-v8a ]] || abi=arm64-v8a
  run="$base/$job"
  mkdir "$run"
  cp "$base"/{source.bundle,recipe.yml,container.sh} "$run/"
  if [[ -f "$base/upstream.apk" ]]; then cp "$base/upstream.apk" "$run/"; fi
  name="fp-release-$(basename "$base")-$job"
  docker_pid=''
  stop_job() {
    if [[ -n "$docker_pid" ]]; then
      kill "$docker_pid" 2>/dev/null || true
      wait "$docker_pid" 2>/dev/null || true
    fi
    docker rm -f "$name" >/dev/null 2>&1 || true
  }
  trap stop_job EXIT
  trap 'exit 143' TERM
  trap 'exit 130' INT
  begin=$(date +%s)
  status=0
  # React Native otherwise embeds Docker's assigned IP in resources.arsc.
  # Pin the published release's value, preserving its bytes across fresh containers.
  docker run --name "$name" -v "$run:/task" \
    -e ORG_GRADLE_PROJECT_reactNativeDevServerIp=172.17.0.3 \
    -e RELEASE_ABI="$abi" -e RELEASE_COMMIT="$commit" -e RELEASE_CODE="$code" \
    "$image" bash /task/container.sh > "$run/build.log" 2>&1 &
  docker_pid=$!
  wait "$docker_pid" || status=$?
  docker_pid=''
  printf '%s\t%s\t%s\n' "$job" "$(( $(date +%s) - begin ))" "$status" > "$run/timing.tsv"
  return "$status"
}
# wait -n -p needs Bash 5.1+, supplied by BGK. No changes to Gradle/recipe flags.
if (( BASH_VERSINFO[0] < 5 || (BASH_VERSINFO[0] == 5 && BASH_VERSINFO[1] < 1) )); then
  echo 'Build host requires Bash 5.1 or newer' >&2; exit 1
fi
next=0
while (( next < ${#jobs[@]} || ${#workers[@]} > 0 )); do
  while (( next < ${#jobs[@]} && ${#workers[@]} < concurrency )); do
    job="${jobs[$next]}"
    echo "Starting $job"
    build_job "$job" & workers[$!]="$job"
    next=$((next + 1))
  done
  status=0
  wait -n -p finished "${!workers[@]}" || status=$?
  job="${workers[$finished]}"
  unset 'workers[$finished]'
  if (( status != 0 )); then
    echo "FAILED $job (exit $status), log: $base/$job/build.log" >&2
    exit "$status"
  fi
  echo "Finished $job"
done
printf 'builds_with_image\t%s\n' "$(( $(date +%s) - start ))" >> timings.tsv
REMOTE
if $release; then
  release_out="$out"
  jobs+=(repeat-arm64-v8a)
  out="$release_out/unsigned"
  mkdir "$out"
fi
scp "$scratch/container.sh" "$scratch/supervisor.sh" "$host:$remote/" >/dev/null
flow_start=$(date +%s)
status=0
# Pass arguments through Bash quoting, including the job list.
printf -v command 'bash %q %q %q %q %q %q' "$remote/supervisor.sh" "$remote" "$commit" "$code" "$image" "$concurrency"
for job in "${jobs[@]}"; do printf -v command '%s %q' "$command" "$job"; done
ssh "$host" "$command" 2>&1 | tee "$out/supervisor.log" || status=$?
# Collect failures as well as successes. Never mask a build failure with missing evidence.
collected=true
for file in supervisor.log timings.tsv resources.tsv image.json docker-images-before.txt docker-containers-before.txt docker-containers-after.txt; do
  [[ "$file" == supervisor.log ]] || scp "$host:$remote/$file" "$out/" >/dev/null 2>&1 || collected=false
done
for job in "${jobs[@]}"; do
  dest="$out/$job"
  mkdir -p "$dest"
  scp "$host:$remote/$job/build.log" "$dest/" >/dev/null 2>&1 || true
  scp "$host:$remote/$job/timing.tsv" "$dest/" >/dev/null 2>&1 || true
  scp -r "$host:$remote/$job/evidence/." "$dest/" >/dev/null 2>&1 || {
    [[ "$status" != 0 ]] || status=1
  }
done
if [[ "$status" != 0 ]]; then
  cat "$out/supervisor.log" >&2
  for job in "${jobs[@]}"; do
    if [[ -f "$out/$job/timing.tsv" ]] && [[ "$(awk '{print $3}' "$out/$job/timing.tsv")" != 0 ]]; then
      echo "FAILED $job, log: $out/$job/build.log" >&2
    fi
  done
  echo "Release build failed. Per-ABI logs: $out/<ABI>/build.log (repeat: repeat-arm64-v8a)" >&2
  exit "$status"
fi
for abi in $abis; do
  cp "$out/$abi/unsigned.apk" "$out/EVB-Folder-Player-$version-$abi-unsigned.apk"
  printf '%s\n' "$commit" > "$out/$abi/commit.txt"
done
(cd "$out" && shasum -a 256 EVB-Folder-Player-*-unsigned.apk > SHA256SUMS)
if $release; then
  timings="$release_out/timings.tsv"
  printf 'phase\tseconds\nparallel_builds_and_transfer\t%s\n' "$(( $(date +%s) - flow_start ))" > "$timings"
  phase=$(date +%s)
  cmp "$out/arm64-v8a/unsigned.apk" "$out/repeat-arm64-v8a/unsigned.apk"
  printf 'determinism_cmp\t%s\n' "$(( $(date +%s) - phase ))" >> "$timings"
  phase=$(date +%s)
  node scripts/sign-release-android.mjs "$out" "$release_out" "$commit"
  printf 'signing\t%s\n' "$(( $(date +%s) - phase ))" >> "$timings"
  phase=$(date +%s)
  FOLDER_PLAYER_ABIS=arm64-v8a FOLDER_PLAYER_UPSTREAM_APK="$release_out/EVB-Folder-Player-$version-arm64-v8a.apk" \
    bash scripts/build-release-android.sh "$commit" "$release_out/binaries-verification"
  printf 'binaries_verification\t%s\n' "$(( $(date +%s) - phase ))" >> "$timings"
  phase=$(date +%s)
  cmp "$out/arm64-v8a/unsigned.apk" "$release_out/binaries-verification/arm64-v8a/unsigned.apk"
  cmp "$release_out/EVB-Folder-Player-$version-arm64-v8a.apk" "$release_out/binaries-verification/arm64-v8a/verified-upstream.apk"
  (cd "$release_out" && shasum -a 256 -c SHA256SUMS)
  printf 'final_checks\t%s\ntotal\t%s\n' "$(( $(date +%s) - phase ))" "$(( $(date +%s) - started ))" >> "$timings"
  echo "Verified release assets and timings: $release_out"
else
  echo "Unsigned F-Droid builds and logs: $out"
fi
