<template>
  <div class="page">
    <a class="skip-link" href="#main">Skip to content</a>
    <header class="site-header">
      <a class="brand" href="/">
        <img class="brand-icon" src="/icon.png" alt="" width="30" height="30" />
        <span>EVB Folder Player</span>
      </a>
      <a class="header-link" :href="REPOSITORY_URL" v-bind="NEW_TAB" aria-label="EVB Folder Player on GitHub">
        <UIcon name="i-simple-icons-github" />
      </a>
    </header>

    <main id="main">
      <section class="hero" aria-labelledby="hero-title">
        <div class="hero-intro">
          <img class="hero-icon" src="/icon.png" alt="" width="88" height="88" />
          <p class="kicker">Offline audiobooks · Android</p>
          <h1 id="hero-title">EVB Folder Player</h1>
          <p class="lede">Your audiobooks. Your folders.<br />Your place, saved.</p>
        </div>

        <div class="hero-film">
          <FilmPlayer :label="FILM_DESCRIPTION" />
          <p class="film-caption">Recorded from the app's browser preview.</p>
        </div>

        <div class="hero-get">
          <div class="downloads">
            <a class="download-row" v-bind="download(arm64)">
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
              <a v-bind="download(release?.assets['armeabi-v7a'])">Older 32-bit phones (armeabi-v7a)</a>
              <span class="release-links">
                <a v-bind="download(release?.assets.checksums)">SHA256SUMS</a>
                <span aria-hidden="true">·</span>
                <a :href="RELEASES_URL" v-bind="NEW_TAB">All releases</a>
              </span>
            </div>
          </div>
          <p class="hero-note">Choose a folder or open a ZIP, press play, and pick up where you left off.</p>
        </div>
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
          <figure v-for="(shot, index) in SCREENSHOTS" :key="shot.id" class="screenshot">
            <a
              :href="`/screenshots/${shot.id}.png`"
              :aria-label="`View screenshot: ${shot.title}`"
              @click="openShot($event, index)"
            >
              <!-- A 400 px thumbnail; the link and the viewer show the full screenshot. -->
              <img
                :src="`/screenshots/${shot.id}-400.webp`"
                :alt="shot.alt"
                width="400"
                height="889"
                loading="lazy"
                decoding="async"
              />
            </a>
            <figcaption>{{ shot.title }}</figcaption>
          </figure>
        </div>
        <p class="gallery-caption">Real app screenshots. Light and dark themes included.</p>
        <UModal v-model:open="viewerOpen" fullscreen :title="shown.title" :description="shown.alt">
          <template #content="{ close }">
            <div class="viewer" @click.self="close" @keydown.left.prevent="step(-1)" @keydown.right.prevent="step(1)">
              <figure class="viewer-figure">
                <img
                  class="viewer-image"
                  :src="`/screenshots/${shown.id}.png`"
                  :alt="shown.alt"
                  width="1080"
                  height="2400"
                />
                <figcaption class="viewer-caption">
                  {{ shown.title }} <span class="viewer-count">{{ shownIndex + 1 }} / {{ SCREENSHOTS.length }}</span>
                </figcaption>
              </figure>
              <button
                class="viewer-button viewer-previous"
                type="button"
                aria-label="Previous screenshot"
                @click="step(-1)"
              >
                <UIcon name="i-lucide-chevron-left" />
              </button>
              <button class="viewer-button viewer-next" type="button" aria-label="Next screenshot" @click="step(1)">
                <UIcon name="i-lucide-chevron-right" />
              </button>
              <button class="viewer-button viewer-close" type="button" aria-label="Close" @click="close">
                <UIcon name="i-lucide-x" />
              </button>
            </div>
          </template>
        </UModal>
      </section>

      <section class="features" aria-labelledby="features-title">
        <h2 id="features-title" class="section-title">Made for listening</h2>
        <p class="section-lede">The books you already own, with a little less friction.</p>
        <div class="feature-grid">
          <article class="feature feature-wide">
            <div>
              <UIcon class="feature-icon" name="i-lucide-file-archive" />
              <h3>Books from ZIP archives</h3>
              <p>
                Got an audiobook as a ZIP in Telegram or your downloads? Open it with EVB Folder Player, or share it to
                the app. It is unpacked into a new folder in your library, Windows archives with Cyrillic names
                included. An import that fails or is cancelled leaves nothing behind.
              </p>
            </div>
            <ol class="zip-steps">
              <li v-for="zipStep in zipSteps" :key="zipStep.text" class="zip-step">
                <UIcon class="zip-icon" :name="zipStep.icon" />
                <span>{{ zipStep.text }}</span>
              </li>
            </ol>
          </article>
          <article v-for="feature in highlights" :key="feature.title" class="feature feature-half">
            <UIcon class="feature-icon" :name="feature.icon" />
            <h3>{{ feature.title }}</h3>
            <p>{{ feature.text }}</p>
          </article>
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
          <a :href="`${REPOSITORY_URL}/blob/master/PRIVACY.md`" v-bind="NEW_TAB"
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
              Download <a v-bind="download(release?.assets.checksums)">SHA256SUMS</a> into the same folder as the APK.
              Check it on your computer:
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
              Add the <a :href="RELEASES_URL" v-bind="NEW_TAB">GitHub Releases URL</a> to
              <a href="https://github.com/ImranR98/Obtainium" v-bind="NEW_TAB">Obtainium</a> and select the APK for your
              phone's architecture. Install updates over the existing app to keep your library and history.
            </p>
            <p>Clearing app storage or uninstalling removes saved progress, leaving your audio files untouched.</p>
          </li>
        </ol>
      </section>

      <section class="stores" aria-labelledby="stores-title">
        <h2 id="stores-title" class="section-title">More ways to install, soon</h2>
        <p class="section-lede">An F-Droid submission is in review. For now, download from GitHub.</p>
        <div class="store-grid">
          <component
            :is="store.url ? 'a' : 'div'"
            v-for="store in STORES"
            :key="store.name"
            class="store"
            :href="store.url ?? undefined"
            v-bind="store.url ? NEW_TAB : {}"
          >
            <UIcon name="i-lucide-package" />
            <span class="store-name">{{ store.name }}</span>
            <span class="store-status">{{ store.url ? 'View listing ↗' : 'In review' }}</span>
          </component>
        </div>
      </section>
    </main>

    <footer class="site-footer">
      <span>© 2026 <a class="author" href="https://evb-stack.com/" v-bind="NEW_TAB">Eugene Barsky</a></span>
      <nav aria-label="Project links">
        <a :href="REPOSITORY_URL" v-bind="NEW_TAB">Source code</a>
        <a :href="`${REPOSITORY_URL}/issues`" v-bind="NEW_TAB">Issues</a>
        <a :href="`${REPOSITORY_URL}/blob/master/LICENSE`" v-bind="NEW_TAB">MIT License</a>
      </nav>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { RELEASES_URL, REPOSITORY_URL, type IReleaseAsset, type ILatestRelease } from '#shared/release';
import { SCREENSHOTS, STORES } from '#shared/site';
import film from '~/films/player.json';

/** Pages on other sites open in a new tab, so the landing stays open. */
const NEW_TAB = { target: '_blank', rel: 'noopener noreferrer' };
const DESCRIPTION =
  'Listen to audiobooks from your Android folders or ZIP archives, with saved progress, bookmarks, volume boost and large controls. Free, offline and open source. No accounts, ads or tracking.';
const FILM_DESCRIPTION =
  'EVB Folder Player playing a sample audiobook: jumping 20 seconds, boosting the volume, choosing a chapter, car mode, the library and listening history.';
const IMAGE_ALT = 'EVB Folder Player, offline audiobooks from your folders.';

const zipSteps = [
  { icon: 'i-lucide-send', text: 'Open the ZIP from Telegram, a download or a file manager.' },
  { icon: 'i-lucide-folder-input', text: 'Choose EVB Folder Player. The first time, pick the folder for new books.' },
  { icon: 'i-lucide-book-open', text: 'Open the book as soon as it is unpacked.' },
];

/** Shown as two wider cards under the ZIP card. */
const highlights = [
  {
    icon: 'i-lucide-volume-2',
    title: 'Louder than full volume',
    text: "Some recordings are just quiet. Volume boost adds up to 12 dB beyond Android's maximum and compresses loud peaks instead of letting them distort. It stays on for every book until you turn it off.",
  },
  {
    icon: 'i-lucide-smartphone',
    title: 'Controls on the lock screen',
    text: 'Pause, resume or jump 20 seconds back or forward from the lock screen or the notification, without unlocking your phone. Each jump is saved in History, so you can undo it.',
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

const viewerOpen = ref(false);
const shownIndex = ref(0);
const shown = computed(() => SCREENSHOTS[shownIndex.value]!);

/** Opens the screenshot viewer; modified clicks keep the browser's own behaviour, such as a new tab. */
function openShot(event: MouseEvent, index: number) {
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
    return;
  }
  event.preventDefault();
  shownIndex.value = index;
  viewerOpen.value = true;
}

function step(delta: number) {
  shownIndex.value = (shownIndex.value + delta + SCREENSHOTS.length) % SCREENSHOTS.length;
}

const { data: release } = await useFetch<ILatestRelease | null>('/api/release', { default: () => null });
const arm64 = computed(() => release.value?.assets['arm64-v8a']);

/** A release asset downloads in place; without it, the releases page opens in a new tab. */
function download(asset: IReleaseAsset | undefined) {
  return asset ? { href: asset.url } : { href: RELEASES_URL, ...NEW_TAB };
}

function formatSize(bytes: number) {
  return `${Math.round(bytes / 1024 ** 2)} MB`;
}

const siteUrl = useRuntimeConfig().public.siteUrl.replace(/\/$/, '');
const pageUrl = `${siteUrl}/`;
useSeoMeta({
  title: 'EVB Folder Player · Offline audiobook player for Android',
  description: DESCRIPTION,
  author: 'Eugene Barsky',
  robots: 'index, follow, max-image-preview:large, max-video-preview:-1',
  ogSiteName: 'EVB Folder Player',
  ogTitle: 'EVB Folder Player',
  ogDescription: 'Your audiobooks. Your folders. Your place, saved. An offline Android audiobook player.',
  ogImage: `${siteUrl}/featureGraphic.png`,
  ogImageType: 'image/png',
  ogImageWidth: 1024,
  ogImageHeight: 500,
  ogImageAlt: IMAGE_ALT,
  ogLocale: 'en_US',
  ogType: 'website',
  ogUrl: pageUrl,
  twitterCard: 'summary_large_image',
  twitterImage: `${siteUrl}/featureGraphic.png`,
  twitterImageAlt: IMAGE_ALT,
});

// Structured data for search: the app with its latest release, and the film.
const structuredData = computed(() => ({
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'MobileApplication',
      '@id': `${pageUrl}#app`,
      name: 'EVB Folder Player',
      description: DESCRIPTION,
      url: pageUrl,
      image: `${siteUrl}/icon.png`,
      screenshot: SCREENSHOTS.map(shot => `${siteUrl}/screenshots/${shot.id}.png`),
      operatingSystem: 'Android',
      applicationCategory: 'MultimediaApplication',
      softwareVersion: release.value?.version,
      dateModified: release.value?.publishedAt,
      downloadUrl: arm64.value?.url ?? RELEASES_URL,
      fileSize: arm64.value ? formatSize(arm64.value.size) : undefined,
      isAccessibleForFree: true,
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
      license: `${REPOSITORY_URL}/blob/master/LICENSE`,
      sameAs: REPOSITORY_URL,
      author: { '@type': 'Person', name: 'Eugene Barsky', url: 'https://evb-stack.com/' },
    },
    {
      '@type': 'VideoObject',
      name: 'EVB Folder Player in 20 seconds',
      description: FILM_DESCRIPTION,
      thumbnailUrl: `${siteUrl}/films/player-poster.jpg`,
      contentUrl: `${siteUrl}/films/player.mp4`,
      uploadDate: film.rendered,
      duration: `PT${Math.round(film.frames / film.fps)}S`,
      about: { '@id': `${pageUrl}#app` },
    },
  ],
}));
useHead(() => ({
  link: [{ rel: 'canonical', href: pageUrl }],
  script: [{ key: 'structured-data', type: 'application/ld+json', textContent: JSON.stringify(structuredData.value) }],
}));
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
  display: grid;
  grid-template-areas:
    'intro film'
    'get film';
  grid-template-rows: 1fr 1fr;
  grid-template-columns: minmax(0, 500px) auto;
  gap: 0 clamp(48px, 7vw, 104px);
  justify-content: center;
  padding: 44px 0 64px;
}

.hero-intro {
  grid-area: intro;
  align-self: end;
}

/* The phone and its controls fit the first screen beside the copy. */
.hero-film {
  grid-area: film;
  width: clamp(250px, calc((100svh - 250px) * 0.45), 310px);
}

.hero-get {
  grid-area: get;
  align-self: start;
  width: min(100%, 430px);
}

.film-caption {
  margin: 6px 0 0;
  color: var(--ink-subtle);
  font-size: 12px;
  text-align: center;
}

.hero-icon {
  display: block;
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
  font-size: clamp(36px, 4.2vw, 58px);
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
  margin-top: 28px;
}

.download-row {
  display: flex;
  align-items: center;
  gap: 14px;
  min-height: 78px;
  padding: 16px 20px;
  border-radius: 14px;
  color: var(--on-accent);
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
  grid-auto-columns: minmax(0, 1fr);
  grid-auto-flow: column;
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

.viewer {
  position: relative;
  display: grid;
  flex: 1;
  place-items: center;
  min-height: 0;
  padding: 24px 80px;
  background: rgb(16 25 24 / 92%);
}

.viewer-figure {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
  margin: 0;
}

.viewer-image {
  display: block;
  width: auto;
  max-width: 100%;
  height: auto;
  max-height: calc(100svh - 100px);
  border-radius: 24px;
}

.viewer-caption {
  color: #fff;
  font-size: 14px;
}

.viewer-count {
  margin-left: 10px;
  color: rgb(255 255 255 / 65%);
  font-family: var(--mono);
  font-size: 12px;
}

.viewer-button {
  position: absolute;
  display: grid;
  width: 48px;
  height: 48px;
  place-items: center;
  border-radius: 50%;
  color: #fff;
  background: rgb(255 255 255 / 12%);
  font-size: 24px;
  cursor: pointer;
}

.viewer-button:hover {
  background: rgb(255 255 255 / 24%);
}

.viewer-button:focus-visible {
  outline: 3px solid #c6e4ba;
  outline-offset: 3px;
}

.viewer-previous,
.viewer-next {
  top: 50%;
  translate: 0 -50%;
}

.viewer-previous {
  left: 16px;
}

.viewer-next {
  right: 16px;
}

.viewer-close {
  top: 16px;
  right: 16px;
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
  grid-template-columns: repeat(6, 1fr);
  gap: 1px;
  margin-top: 30px;
  overflow: hidden;
  border: 1px solid var(--line);
  border-radius: 16px;
  background: var(--line);
}

.feature {
  grid-column: span 2;
  padding: 28px 26px 30px;
  background: var(--paper-raised);
}

.feature-half {
  grid-column: span 3;
}

.feature-wide {
  display: grid;
  grid-column: 1 / -1;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 24px 48px;
  align-items: center;
}

.zip-steps {
  display: grid;
  gap: 10px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.zip-step {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 13px 16px;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: var(--paper);
  color: var(--ink-muted);
  font-size: 14px;
  line-height: 1.5;
}

.zip-icon {
  flex: none;
  width: 20px;
  height: 20px;
  color: var(--accent);
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

.author {
  text-decoration: underline;
}

@media (max-width: 1000px) {
  .hero {
    grid-template-areas:
      'intro'
      'get'
      'film';
    grid-template-rows: none;
    grid-template-columns: minmax(0, 1fr);
    justify-items: center;
    text-align: center;
  }

  .hero-icon {
    margin-right: auto;
    margin-left: auto;
  }

  .hero-film {
    width: min(290px, 76vw);
    margin-top: 44px;
  }

  .release-links {
    justify-content: center;
  }

  .screenshot-gallery {
    grid-auto-columns: 180px;
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

  .feature:not(.feature-wide) {
    grid-column: auto;
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
    padding: 28px 0 40px;
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
    grid-auto-columns: 170px;
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

  .feature-wide {
    grid-template-columns: 1fr;
  }

  .viewer {
    padding: 64px 12px 84px;
  }

  .viewer-image {
    max-height: calc(100svh - 190px);
  }

  .viewer-previous,
  .viewer-next {
    top: auto;
    bottom: 18px;
    translate: none;
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
