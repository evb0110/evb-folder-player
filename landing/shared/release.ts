export type TAbi = 'arm64-v8a' | 'armeabi-v7a';
export type TReleaseAsset = TAbi | 'checksums';

export interface IReleaseAsset {
  name: string;
  url: string;
  size: number;
}

export interface ILatestRelease {
  version: string;
  publishedAt: string;
  pageUrl: string;
  assets: Partial<Record<TReleaseAsset, IReleaseAsset>>;
}

export interface IGithubRelease {
  tag_name: string;
  published_at: string;
  html_url: string;
  assets: Array<{ name: string; browser_download_url: string; size: number }>;
}

export const REPOSITORY_URL = 'https://github.com/evb0110/evb-folder-player';
export const RELEASES_URL = `${REPOSITORY_URL}/releases`;

// Prefer the branded filenames from 0.3.0, then accept the legacy 0.2.0 names.
const INSTALLERS: Record<TReleaseAsset, RegExp[]> = {
  'arm64-v8a': [/^EVB-Folder-Player-[\d.]+-arm64-v8a\.apk$/, /^folder-player-[\d.]+-arm64-v8a\.apk$/],
  'armeabi-v7a': [/^EVB-Folder-Player-[\d.]+-armeabi-v7a\.apk$/, /^folder-player-[\d.]+-armeabi-v7a\.apk$/],
  checksums: [/^SHA256SUMS$/],
};

/** Missing assets stay absent so each download can fall back to the releases page. */
export function selectRelease(release: IGithubRelease): ILatestRelease {
  const assets: ILatestRelease['assets'] = {};
  for (const [abi, patterns] of Object.entries(INSTALLERS) as Array<[TReleaseAsset, RegExp[]]>) {
    for (const pattern of patterns) {
      const asset = release.assets.find(candidate => pattern.test(candidate.name));
      if (asset) {
        assets[abi] = { name: asset.name, url: asset.browser_download_url, size: asset.size };
        break;
      }
    }
  }
  return {
    version: release.tag_name.replace(/^v/, ''),
    publishedAt: release.published_at,
    pageUrl: release.html_url,
    assets,
  };
}

export const RELEASE_ASSETS: TReleaseAsset[] = ['arm64-v8a', 'armeabi-v7a', 'checksums'];

/**
 * The landing's own address for a release file. Links to github.com open the GitHub app on phones
 * that have it, which hands the download to a Chrome Custom Tab that never finishes saving the APK.
 */
export function downloadPath(asset: TReleaseAsset) {
  return `/download/${asset}`;
}

/** Hosts GitHub serves release files from after redirecting a github.com download link. */
const FILE_HOSTS = new Set(['release-assets.githubusercontent.com', 'objects.githubusercontent.com']);

/** Whether a redirect from GitHub points at its file servers, so the landing can send visitors there. */
export function isGithubFileUrl(location: string | null | undefined): location is string {
  if (!location) return false;
  try {
    const url = new URL(location);
    return url.protocol === 'https:' && FILE_HOSTS.has(url.hostname);
  } catch {
    return false;
  }
}
