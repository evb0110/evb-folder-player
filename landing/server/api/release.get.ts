import { selectRelease, type IGithubRelease, type ILatestRelease } from '#shared/release';

/** The latest published release and its APKs, or null when GitHub is unavailable. */
export default defineCachedEventHandler(
  async (): Promise<ILatestRelease | null> => {
    try {
      const release = await $fetch<IGithubRelease>(
        'https://api.github.com/repos/evb0110/evb-folder-player/releases/latest',
        {
          headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'evb-folder-player-landing' },
          timeout: 8000,
        },
      );
      return selectRelease(release);
    } catch {
      return null;
    }
  },
  { name: 'latest-release', maxAge: 600, swr: true },
);
