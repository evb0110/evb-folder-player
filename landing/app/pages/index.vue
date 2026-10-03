<template>
  <div class="page">
    <a class="skip-link" href="#main">Skip to content</a>
    <header class="site-header">
      <a class="brand" href="/">
        <img class="brand-icon" src="/icon.png" alt="" width="30" height="30" />
        <span>EVB Folder Player</span>
      </a>
      <a class="header-link" :href="REPOSITORY_URL" aria-label="EVB Folder Player on GitHub">
        <UIcon name="i-simple-icons-github" />
      </a>
    </header>

    <main id="main">
      <section class="hero" aria-labelledby="hero-title">
        <img class="hero-icon" src="/icon.png" alt="" width="88" height="88" />
        <p class="kicker">Offline audiobooks · Android</p>
        <h1 id="hero-title">EVB Folder Player</h1>
        <p class="lede">Your audiobooks. Your folders. Your place, saved.</p>

        <div class="downloads">
          <a class="download-row" :href="arm64?.url ?? RELEASES_URL">
            <UIcon class="download-icon" name="i-lucide-download" />
            <span class="download-copy">
              <strong>{{ arm64 ? 'Download for Android' : 'Get it on GitHub Releases' }}</strong>
              <small>
                <template v-if="arm64 && release">v{{ release.version }} · {{ formatSize(arm64.size) }} · </template>
                APK
              </small>
            </span>
            <UIcon class="download-arrow" name="i-lucide-arrow-down-to-line" />
          </a>
          <p class="download-note">arm64-v8a · For most Android phones.</p>
          <div class="download-links">
            <a :href="release?.assets['armeabi-v7a']?.url ?? RELEASES_URL">Older 32-bit phones (armeabi-v7a)</a>
            <span class="release-links">
              <a :href="release?.assets.checksums?.url ?? RELEASES_URL">SHA256SUMS</a>
              <span aria-hidden="true">·</span>
              <a :href="RELEASES_URL">All releases</a>
            </span>
          </div>
        </div>
        <p class="hero-note">Choose a folder, press play, and pick up where you left off.</p>
      </section>

      <section class="screenshots" aria-labelledby="screenshots-title">
        <div class="section-heading">
          <h2 id="screenshots-title" class="kicker">A look inside</h2>
          <span class="gallery-hint">Swipe to explore</span>
        </div>
        <div
          class="screenshot-gallery"
          tabindex="0"
          role="region"
          aria-label="App screenshots, scroll horizontally for more"
        >
          <figure v-for="shot in screenshots" :key="shot.id" class="screenshot">
            <a :href="`/screenshots/${shot.id}.png`" :aria-label="`View full-size screenshot: ${shot.title}`">
              <img
                :src="`/screenshots/${shot.id}.png`"
                :alt="shot.alt"
                width="1080"
                height="2400"
                loading="lazy"
                decoding="async"
              />
            </a>
            <figcaption>{{ shot.title }}</figcaption>
          </figure>
        </div>
        <p class="gallery-caption">Real app screenshots. Light and dark themes included.</p>
      </section>

      <section class="features" aria-labelledby="features-title">
        <h2 id="features-title" class="section-title">Made for listening</h2>
        <p class="section-lede">The books you already own, with a little less friction.</p>
        <div class="feature-grid">
          <article v-for="feature in features" :key="feature.title" class="feature">
            <UIcon class="feature-icon" :name="feature.icon" />
            <h3>{{ feature.title }}</h3>
            <p>{{ feature.text }}</p>
          </article>
        </div>
      </section>

      <section class="privacy" aria-labelledby="privacy-title">
        <UIcon class="privacy-icon" name="i-lucide-shield-check" />
        <div>
          <h2 id="privacy-title">Your listening stays yours</h2>
          <p>
            The Android app has no network permission. No accounts, ads, analytics or tracking. Your library, bookmarks
            and listening history stay on your device. Your audio files are never modified, moved, renamed or deleted.
          </p>
          <a :href="`${REPOSITORY_URL}/blob/main/PRIVACY.md`"
            >Read the privacy policy <span aria-hidden="true">↗</span></a
          >
        </div>
      </section>

      <section class="installation" aria-labelledby="installation-title">
        <h2 id="installation-title" class="section-title">Start listening</h2>
        <p class="section-lede">Install the APK directly. Then choose your audio folder.</p>
        <ol class="install-grid">
          <li class="install-step">
            <span class="step-number" aria-hidden="true">01</span>
            <h3>Download and install</h3>
            <p>
              Choose arm64-v8a for most phones, or armeabi-v7a for older 32-bit phones. Open the APK and, when Android
              asks, allow your browser or file manager to install unknown apps.
            </p>
          </li>
          <li class="install-step">
            <span class="step-number" aria-hidden="true">02</span>
            <h3>Verify the download</h3>
            <p>
              Download <a :href="release?.assets.checksums?.url ?? RELEASES_URL">SHA256SUMS</a> into the same folder as
              the APK. Check it on your computer:
            </p>
            <span class="command-label">macOS</span>
            <code>shasum -a 256 -c SHA256SUMS --ignore-missing</code>
            <span class="command-label">Linux</span>
            <code>sha256sum -c SHA256SUMS --ignore-missing</code>
            <p class="checksum-note">The downloaded APK should report OK.</p>
          </li>
          <li class="install-step">
            <span class="step-number" aria-hidden="true">03</span>
            <h3>Keep up to date</h3>
            <p>
              Add the <a :href="RELEASES_URL">GitHub Releases URL</a> to
              <a href="https://github.com/ImranR98/Obtainium">Obtainium</a> and select the APK for your phone's
              architecture. Install updates over the existing app to keep your library and history.
            </p>
            <p>Clearing app storage or uninstalling removes saved progress, leaving your audio files untouched.</p>
          </li>
        </ol>
      </section>

      <section class="stores" aria-labelledby="stores-title">
        <h2 id="stores-title" class="section-title">More ways to install, soon</h2>
        <p class="section-lede">Store submissions are in progress. For now, download from GitHub.</p>
        <div class="store-grid">
          <component
            :is="store.url ? 'a' : 'div'"
            v-for="store in STORES"
            :key="store.name"
            class="store"
            :href="store.url ?? undefined"
          >
            <UIcon name="i-lucide-package" />
            <span class="store-name">{{ store.name }}</span>
            <span class="store-status">{{ store.url ? 'View listing ↗' : 'Coming soon' }}</span>
          </component>
        </div>
      </section>
    </main>

    <footer class="site-footer">
      <span>© 2026 Eugene Barsky</span>
      <nav aria-label="Project links">
        <a :href="REPOSITORY_URL">Source code</a>
        <a :href="`${REPOSITORY_URL}/issues`">Issues</a>
        <a :href="`${REPOSITORY_URL}/blob/main/LICENSE`">MIT License</a>
      </nav>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { RELEASES_URL, REPOSITORY_URL, type ILatestRelease } from '#shared/release';
import { STORES } from '#shared/site';

const screenshots = [
  {
    id: 1,
    title: 'Your library',
    alt: 'Light-themed library with Books and Folders tabs, a search field, A Quieter Chapter audiobook, and Add folder.',
  },
  {
    id: 2,
    title: 'Pick up your book',
    alt: 'Audiobook player showing A Quieter Chapter, saved position, play and 20-second jumps, speed, sleep timer, bookmark, undo and history controls.',
  },
  {
    id: 3,
    title: 'Chapters in order',
    alt: 'Naturally ordered chapter list with A place to begin selected, followed by A quieter chapter and Your next story, above the mini player.',
  },
  {
    id: 4,
    title: 'Larger controls',
    alt: 'Car mode with an extra-large play button, separate 20-second backward and forward controls, and a keep-screen-on control.',
  },
  {
    id: 5,
    title: 'A darker evening',
    alt: 'Dark-themed audiobook player with a green play button and sleep timer options from off to 60 minutes.',
  },
  {
    id: 6,
    title: 'Find your place again',
    alt: 'Dark-themed listening history with All and Bookmarks tabs, an Undo button, a saved bookmark and earlier listening positions.',
  },
];

const features = [
  {
    icon: 'i-lucide-folder-tree',
    title: 'Your folders, in order',
    text: 'Choose an audio folder, including subfolders, or scan indexed device audio. Books and chapters follow natural filename ordering.',
  },
  {
    icon: 'i-lucide-history',
    title: 'A place for every book',
    text: 'Keep an independent listening position for each folder. Progress is saved during playback and on pause. Resume from the library or headphones.',
  },
  {
    icon: 'i-lucide-bookmark',
    title: 'Find your way back',
    text: 'History, bookmarks, checkpoints before jumps, and undo help you return to an earlier position when you need to listen again.',
  },
  {
    icon: 'i-lucide-car-front',
    title: 'Room for your controls',
    text: 'Car mode has a large play/pause button, separate 20-second jump controls and an optional keep-screen-on setting.',
  },
  {
    icon: 'i-lucide-timer',
    title: 'Listen at your pace',
    text: 'Choose a chapter, adjust playback speed or set a sleep timer. Pick a light, dark or system theme to suit your day.',
  },
  {
    icon: 'i-lucide-headphones',
    title: 'Keep the story going',
    text: 'Playback continues in the background. Headset next/previous commands are ignored to avoid accidental chapter changes. Chapters advance automatically.',
  },
];

const { data: release } = await useFetch<ILatestRelease | null>('/api/release', { default: () => null });
const arm64 = computed(() => release.value?.assets['arm64-v8a']);

function formatSize(bytes: number) {
  return `${Math.round(bytes / 1024 ** 2)} MB`;
}

const siteUrl = useRuntimeConfig().public.siteUrl.replace(/\/$/, '');
useSeoMeta({
  title: 'EVB Folder Player · Offline audiobooks for Android',
  description:
    'Listen to audiobooks from your Android folders, with saved progress, bookmarks and large controls. Free, offline and open source. No accounts, ads or tracking.',
  ogTitle: 'EVB Folder Player',
  ogDescription: 'Your audiobooks. Your folders. Your place, saved. An offline Android audiobook player.',
  ogImage: `${siteUrl}/featureGraphic.png`,
  ogImageWidth: 1024,
  ogImageHeight: 500,
  ogImageAlt: 'EVB Folder Player, offline audiobooks from your folders.',
  ogType: 'website',
  ogUrl: siteUrl,
  twitterCard: 'summary_large_image',
  twitterImage: `${siteUrl}/featureGraphic.png`,
});
useHead({ link: [{ rel: 'canonical', href: siteUrl }] });
</script>

<style scoped>
.page {
  max-width: 1180px;
  margin: 0 auto;
  padding: 0 28px;
}

.skip-link {
  position: absolute;
  top: 12px;
  left: 16px;
  z-index: 2;
  padding: 12px;
  background: var(--paper-raised);
  transform: translateY(-180%);
}

.skip-link:focus {
  transform: translateY(0);
}

.site-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 18px 0;
  border-bottom: 1px solid var(--line);
}

.brand {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 15px;
  font-weight: 650;
  text-decoration: none;
}

.brand-icon {
  border-radius: 7px;
}

.header-link {
  display: grid;
  flex: none;
  width: 40px;
  height: 40px;
  place-items: center;
  border: 1px solid var(--line);
  border-radius: 10px;
  font-size: 19px;
  text-decoration: none;
}

.header-link:hover {
  background: var(--paper-raised);
}

.hero {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 56px 0 48px;
  text-align: center;
}

.hero-icon {
  margin-bottom: 22px;
  border: 1px solid var(--line);
  border-radius: 22px;
}

.kicker {
  margin: 0;
  color: var(--ink-subtle);
  font-family: var(--mono);
  font-size: 12px;
  font-weight: 500;
  letter-spacing: 0.15em;
  text-transform: uppercase;
}

h1 {
  margin: 14px 0 0;
  font-size: clamp(36px, 5.4vw, 64px);
  font-weight: 650;
  line-height: 1.08;
  letter-spacing: -0.04em;
  text-wrap: balance;
}

.lede {
  margin: 20px 0 0;
  color: var(--ink-muted);
  font-size: clamp(17px, 2vw, 22px);
  line-height: 1.5;
  text-wrap: balance;
}

.downloads {
  width: min(100%, 430px);
  margin-top: 28px;
}

.download-row {
  display: flex;
  align-items: center;
  gap: 14px;
  min-height: 78px;
  padding: 16px 20px;
  border-radius: 14px;
  color: #fff;
  background: var(--accent);
  text-align: left;
  text-decoration: none;
  transition: background 140ms ease;
}

.download-row:hover {
  background: var(--accent-ink);
}

.download-icon {
  flex: none;
  width: 24px;
  height: 24px;
}

.download-copy {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 4px;
}

.download-copy strong {
  font-size: 16px;
  font-weight: 600;
}

.download-copy small {
  font-family: var(--mono);
  font-size: 12px;
}

.download-arrow {
  flex: none;
  width: 18px;
  height: 18px;
}

.download-note {
  margin: 10px 0 0;
  color: var(--ink-subtle);
  font-size: 12px;
}

.download-links {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 15px;
  color: var(--accent-ink);
  font-size: 13px;
}

.download-links a {
  padding: 5px 0;
  text-underline-offset: 3px;
}

.release-links {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 14px;
}

.hero-note {
  margin: 24px 0 0;
  color: var(--ink-muted);
  font-size: 14px;
  line-height: 1.6;
}

.screenshots {
  padding: 8px 0 0;
}

.section-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
}

.gallery-hint {
  display: none;
  color: var(--ink-subtle);
  font-size: 12px;
}

.screenshot-gallery {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 18px;
  padding: 6px 2px 14px;
}

.screenshot {
  min-width: 0;
  margin: 0;
}

.screenshot a {
  display: block;
  border-radius: 18px;
}

.screenshot img {
  display: block;
  width: 100%;
  height: auto;
  border: 1px solid var(--line);
  border-radius: 18px;
  background: var(--paper-raised);
}

.screenshot figcaption {
  margin-top: 14px;
  color: var(--ink-muted);
  font-size: 12px;
  line-height: 1.5;
  text-align: center;
}

.gallery-caption {
  margin: 12px 0 0;
  color: var(--ink-subtle);
  font-size: 12px;
  text-align: center;
}

.features,
.installation,
.stores {
  padding: 76px 0 0;
}

.section-title {
  margin: 0;
  font-size: clamp(26px, 3vw, 34px);
  font-weight: 600;
  line-height: 1.2;
  letter-spacing: -0.025em;
  text-align: center;
  text-wrap: balance;
}

.section-lede {
  margin: 12px 0 0;
  color: var(--ink-muted);
  font-size: 15px;
  line-height: 1.6;
  text-align: center;
}

.feature-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1px;
  margin-top: 30px;
  overflow: hidden;
  border: 1px solid var(--line);
  border-radius: 16px;
  background: var(--line);
}

.feature {
  padding: 28px 26px 30px;
  background: var(--paper-raised);
}

.feature-icon {
  width: 24px;
  height: 24px;
  color: var(--accent);
}

.feature h3,
.install-step h3 {
  margin: 16px 0 0;
  font-size: 17px;
  font-weight: 650;
}

.feature p,
.install-step p {
  margin: 10px 0 0;
  color: var(--ink-muted);
  font-size: 14px;
  line-height: 1.7;
}

.privacy {
  display: flex;
  align-items: flex-start;
  gap: 24px;
  margin-top: 54px;
  padding: 32px;
  border: 1px solid var(--line);
  border-radius: 16px;
  background: var(--accent-soft);
}

.privacy-icon {
  flex: none;
  width: 32px;
  height: 32px;
  color: var(--accent);
}

.privacy h2 {
  margin: 0;
  font-size: 24px;
  font-weight: 600;
  letter-spacing: -0.025em;
}

.privacy p {
  max-width: 800px;
  margin: 12px 0;
  color: var(--ink-muted);
  font-size: 15px;
  line-height: 1.7;
}

.privacy a,
.install-step a {
  color: var(--accent-ink);
  font-size: 14px;
  text-decoration: underline;
  text-underline-offset: 3px;
}

.install-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 32px;
  margin: 32px 0 0;
  padding: 0;
  list-style: none;
}

.step-number {
  color: var(--accent);
  font-family: var(--mono);
  font-size: 14px;
}

.command-label {
  display: block;
  margin-top: 12px;
  color: var(--ink-subtle);
  font-family: var(--mono);
  font-size: 11px;
}

.install-step code {
  display: block;
  margin-top: 5px;
  padding: 10px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--paper-raised);
  font-family: var(--mono);
  font-size: 12px;
  line-height: 1.6;
  overflow-wrap: anywhere;
}

.store-grid {
  display: flex;
  justify-content: center;
  gap: 16px;
  margin: 24px 0 60px;
}

.store {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 300px;
  padding: 20px;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: var(--paper-raised);
  text-decoration: none;
}

.store-name {
  flex: 1;
  font-size: 15px;
  font-weight: 600;
}

.store-status {
  color: var(--ink-subtle);
  font-size: 12px;
}

.site-footer {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 16px;
  padding: 26px 0 36px;
  border-top: 1px solid var(--line);
  color: var(--ink-subtle);
  font-family: var(--mono);
  font-size: 12px;
}

.site-footer nav {
  display: flex;
  flex-wrap: wrap;
  gap: 18px;
}

.site-footer a {
  text-underline-offset: 4px;
}

@media (max-width: 1000px) {
  .screenshot-gallery {
    grid-template-columns: repeat(6, 180px);
    overflow-x: auto;
    scroll-snap-type: x mandatory;
  }

  .screenshot {
    scroll-snap-align: start;
  }

  .gallery-hint {
    display: inline;
  }

  .feature-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .install-grid {
    grid-template-columns: 1fr;
    gap: 28px;
    max-width: 620px;
    margin-right: auto;
    margin-left: auto;
  }
}

@media (max-width: 580px) {
  .page {
    padding: 0 18px;
  }

  .site-header {
    padding: 12px 0;
  }

  .brand {
    font-size: 14px;
  }

  .hero {
    padding: 28px 0 30px;
  }

  .hero-icon {
    width: 64px;
    height: 64px;
    margin-bottom: 18px;
    border-radius: 16px;
  }

  .kicker {
    font-size: 10px;
  }

  h1 {
    max-width: 320px;
    font-size: 38px;
  }

  .lede {
    margin-top: 14px;
  }

  .downloads {
    margin-top: 22px;
  }

  .download-row {
    gap: 10px;
    padding: 14px;
  }

  .download-copy strong {
    font-size: 15px;
  }

  .download-arrow {
    display: none;
  }

  .hero-note {
    max-width: 290px;
    margin-top: 18px;
    font-size: 13px;
  }

  .screenshot-gallery {
    grid-template-columns: repeat(6, 170px);
    gap: 14px;
  }

  .features,
  .installation,
  .stores {
    padding-top: 52px;
  }

  .feature-grid {
    grid-template-columns: 1fr;
    margin-top: 24px;
  }

  .feature {
    padding: 24px;
  }

  .privacy {
    flex-direction: column;
    gap: 14px;
    margin-top: 32px;
    padding: 24px;
  }

  .privacy h2 {
    font-size: 23px;
  }

  .store-grid {
    flex-direction: column;
    margin-bottom: 40px;
  }

  .store {
    width: 100%;
  }

  .site-footer {
    flex-direction: column;
    font-size: 11px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .download-row {
    transition: none;
  }
}
</style>
