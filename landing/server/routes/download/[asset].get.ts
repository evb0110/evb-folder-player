import { isGithubFileUrl, RELEASE_ASSETS, RELEASES_URL, type TReleaseAsset } from '#shared/release';

/**
 * Sends the visitor straight to GitHub's file server for the latest release file. GitHub's signed
 * file URLs expire, so each request asks GitHub for a fresh one. Without it, the visitor gets the
 * github.com link, and without the release, the releases page.
 */
export default defineEventHandler(async event => {
  setResponseHeader(event, 'Cache-Control', 'no-store');
  const key = getRouterParam(event, 'asset') as TReleaseAsset;
  if (!RELEASE_ASSETS.includes(key)) throw createError({ statusCode: 404, statusMessage: 'Unknown download' });
  const asset = (await latestRelease())?.assets[key];
  if (!asset) return sendRedirect(event, RELEASES_URL, 302);
  try {
    const response = await fetch(asset.url, {
      method: 'HEAD',
      redirect: 'manual',
      headers: { 'User-Agent': 'evb-folder-player-landing' },
      signal: AbortSignal.timeout(8000),
    });
    const location = response.headers.get('location');
    if (isGithubFileUrl(location)) return sendRedirect(event, location, 302);
  } catch {
    // Fall through to the github.com link.
  }
  return sendRedirect(event, asset.url, 302);
});
