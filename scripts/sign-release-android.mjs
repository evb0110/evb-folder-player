// Sign the F-Droid Linux outputs in place on the Mac. Credentials never leave it.
// Usage: node scripts/sign-release-android.mjs [unsigned-directory] [signed-directory] [commit-or-tag]
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve, join } from 'node:path';

// Signing an older tag must validate that tag's version, package and label.
const app = JSON.parse(
  process.argv[4]
    ? execFileSync('git', ['show', `${process.argv[4]}:app.json`], { encoding: 'utf8' })
    : readFileSync(new URL('../app.json', import.meta.url), 'utf8'),
).expo;
const unsignedDir = resolve(process.argv[2] ?? 'dist/android/unsigned');
const signedDir = resolve(process.argv[3] ?? 'dist/android');
const credentials = resolve(process.env.FOLDER_PLAYER_CREDENTIALS_DIR ?? '.credentials');
const sdk = process.env.ANDROID_HOME ?? join(homedir(), 'Library/Android/sdk');
const tools = join(sdk, 'build-tools', process.env.FOLDER_PLAYER_BUILD_TOOLS ?? '36.0.0');
const cert = 'beac197d53b5f35d548f8e3b4050a306b30d233cd235830e2d92b1f62183feec';
const properties = Object.fromEntries(
  readFileSync(join(credentials, 'signing.properties'), 'utf8')
    .split(/\r?\n/)
    .filter(line => line && !line.startsWith('#'))
    .map(line => {
      const index = line.indexOf('=');
      return [line.slice(0, index), line.slice(index + 1)];
    }),
);
for (const key of ['storePassword', 'keyPassword', 'keyAlias']) {
  if (!properties[key]) throw new Error(`Missing signing property ${key}`);
}
const env = {
  ...process.env,
  JAVA_HOME: process.env.FOLDER_PLAYER_JAVA_HOME ?? '/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home',
  FOLDER_PLAYER_STORE_PASSWORD: properties.storePassword,
  FOLDER_PLAYER_KEY_PASSWORD: properties.keyPassword,
};
const run = (tool, args) =>
  execFileSync(join(tools, tool), args, { env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
mkdirSync(signedDir, { recursive: true });
const sums = [];
for (const abi of ['arm64-v8a', 'armeabi-v7a']) {
  const name = `EVB-Folder-Player-${app.version}-${abi}.apk`;
  const source = join(unsignedDir, name.replace('.apk', '-unsigned.apk'));
  const output = join(signedDir, name);
  if (!existsSync(source)) throw new Error(`Missing Linux build: ${source}`);
  const badging = run('aapt2', ['dump', 'badging', source]);
  if (
    !badging.includes(
      `package: name='${app.android.package}' versionCode='${app.android.versionCode}' versionName='${app.version}'`,
    ) ||
    !badging.includes(`application-label:'${app.name}'`) ||
    !badging.includes(`native-code: '${abi}'`) ||
    badging.includes('android.permission.INTERNET')
  ) {
    throw new Error(`Unexpected package, version, label, ABI or permissions: ${source}`);
  }
  // The published 0.2.0 APKs used v2 only. Match them (v1/v3/v4 were disabled).
  run('apksigner', [
    'sign',
    '--ks',
    join(credentials, 'release.keystore'),
    '--ks-key-alias',
    properties.keyAlias,
    '--ks-pass',
    'env:FOLDER_PLAYER_STORE_PASSWORD',
    '--key-pass',
    'env:FOLDER_PLAYER_KEY_PASSWORD',
    '--alignment-preserved',
    'true',
    '--v1-signing-enabled',
    'false',
    '--v2-signing-enabled',
    'true',
    '--v3-signing-enabled',
    'false',
    '--v4-signing-enabled',
    'false',
    '--out',
    output,
    source,
  ]);
  const verification = run('apksigner', ['verify', '-v', '--print-certs', output]);
  if (!verification.includes(`certificate SHA-256 digest: ${cert}`)) throw new Error('Unexpected signing certificate');
  writeFileSync(join(signedDir, `${name}.apksigner.txt`), verification);
  writeFileSync(join(signedDir, `${name}.aapt2.txt`), run('aapt2', ['dump', 'badging', output]));
  sums.push(`${createHash('sha256').update(readFileSync(output)).digest('hex')}  ${name}`);
  console.log(output);
}
writeFileSync(join(signedDir, 'SHA256SUMS'), `${sums.join('\n')}\n`);
