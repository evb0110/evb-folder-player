import assert from 'node:assert/strict';
import test from 'node:test';
import { selectRelease, type IGithubRelease } from '../shared/release.ts';

function fixture(names: string[]): IGithubRelease {
  return {
    tag_name: 'v0.2.0',
    published_at: '2026-10-03T00:00:00Z',
    html_url: 'https://github.com/evb0110/evb-folder-player/releases/tag/v0.2.0',
    assets: names.map(name => ({ name, browser_download_url: `https://example.com/${name}`, size: 12345678 })),
  };
}

for (const [prefix, version] of [
  ['folder-player', '0.2.0'],
  ['EVB-Folder-Player', '0.3.0'],
]) {
  test(`matches both ABIs and checksums for ${prefix}`, () => {
    const release = selectRelease(
      fixture([`${prefix}-${version}-arm64-v8a.apk`, `${prefix}-${version}-armeabi-v7a.apk`, 'SHA256SUMS']),
    );
    assert.equal(release.assets['arm64-v8a']?.name, `${prefix}-${version}-arm64-v8a.apk`);
    assert.equal(release.assets['armeabi-v7a']?.name, `${prefix}-${version}-armeabi-v7a.apk`);
    assert.equal(release.assets.checksums?.name, 'SHA256SUMS');
    assert.equal(release.assets['arm64-v8a']?.size, 12345678);
    assert.equal(release.version, '0.2.0');
  });
}

test('prefers branded assets when both naming schemes are present', () => {
  const release = selectRelease(
    fixture(['folder-player-0.3.0-arm64-v8a.apk', 'EVB-Folder-Player-0.3.0-arm64-v8a.apk']),
  );
  assert.equal(release.assets['arm64-v8a']?.name, 'EVB-Folder-Player-0.3.0-arm64-v8a.apk');
});

test('leaves missing assets absent and rejects unrelated or partial filenames', () => {
  const release = selectRelease(
    fixture([
      'other-player-0.2.0-arm64-v8a.apk',
      'folder-player-0.2.0-x86.apk',
      'folder-player-0.2.0-arm64-v8a.apk.sig',
      'SHA256SUMS.asc',
    ]),
  );
  assert.deepEqual(release.assets, {});
});

test('downloads go through the landing and only on to GitHub file servers', async () => {
  const { downloadPath, isGithubFileUrl } = await import('../shared/release.ts');
  assert.equal(downloadPath('arm64-v8a'), '/download/arm64-v8a');
  assert.equal(downloadPath('checksums'), '/download/checksums');
  assert.ok(isGithubFileUrl('https://release-assets.githubusercontent.com/github-production-release-asset/1/2?sp=r'));
  assert.ok(isGithubFileUrl('https://objects.githubusercontent.com/github-production-release-asset-2e65be/1/2'));
  // github.com itself is what the GitHub app intercepts; other hosts and plain HTTP are refused.
  assert.ok(!isGithubFileUrl('https://github.com/evb0110/evb-folder-player/releases/download/v0.3.5/x.apk'));
  assert.ok(!isGithubFileUrl('https://release-assets.githubusercontent.com.example.com/x'));
  assert.ok(!isGithubFileUrl('http://objects.githubusercontent.com/x'));
  assert.ok(!isGithubFileUrl(null));
  assert.ok(!isGithubFileUrl('not a url'));
});
