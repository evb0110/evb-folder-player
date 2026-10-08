# EVB Folder Player landing

The site at [evb-folder-player.vercel.app](https://evb-folder-player.vercel.app): downloads for the latest Android release, a film of the app and real screenshots. It follows the visitor's light or dark system theme, like the app. It is a separate Nuxt 4 app with Nuxt UI 4, Tailwind 4 and its own pnpm lockfile; Vercel builds it from this folder.

```bash
pnpm install
pnpm dev
```

The download panel reads the latest GitHub release through `server/api/release.get.ts`. Vercel regenerates the page at most every ten minutes, so a new release shows up without a redeploy. The API is cached for ten minutes with stale-while-revalidate. It accepts both `EVB-Folder-Player-<version>-<abi>.apk` and legacy `folder-player-<version>-<abi>.apk` filenames, preferring the branded name for each ABI. If GitHub is unavailable or an asset is missing, that download links to GitHub Releases instead. Links to other sites open in a new tab; release downloads start in place.

For search and link previews, the page carries `MobileApplication` structured data built from the latest release, and `VideoObject` data for the film. `/robots.txt` and `/sitemap.xml`, which lists the screenshots, are prerendered from `NUXT_PUBLIC_SITE_URL`. Screenshots, films and the icon are cached by browsers for a day, because they keep their names when replaced.

## Vercel

Create the project from `evb0110/evb-folder-player` with:

- Production branch: **master** (after the parent integrates the landing commit).
- Framework preset: **Nuxt.js**.
- Root directory: **landing**.
- Install command: **pnpm install --frozen-lockfile**.
- Build command: **pnpm build**.
- Output directory: leave the framework default (no override).
- Node.js version: **22.x** (matches Nitro's generated function runtime).
- Environment variable: `NUXT_PUBLIC_SITE_URL=https://evb-folder-player.vercel.app` (this is also the default). Set it to the public origin if a custom domain is used.
- Include source files outside the root directory: **off**. All required assets are copied into `public/`.

Nuxt selects its Vercel preset on Vercel, including the server route and ISR page. Do not use a static-only export: the release API needs server execution. This folder has no build dependency on the Expo app, Android tools or the root npm install.

## Checks and local preview

```bash
pnpm test
pnpm typecheck
pnpm build
HOST=127.0.0.1 PORT=3000 node .output/server/index.mjs
```

The default local build uses the Node server preset. Open the page and `/api/release` to check downloads. For a local Vercel-output check, run `NITRO_PRESET=vercel pnpm build`.

## Film

The hero film is recorded from the app's web preview, not drawn by hand, and turned into a video with Remotion, as on the EVB Viewer landing.

1. `recorder/record.mjs` serves the root web export (`dist/web`) with `scripts/preview-web.mjs` on a free loopback port and drives it in headless Chromium. The flow in `recorder/flows/player.mjs` plays the bundled sample book, jumps 20 seconds, sets a volume boost, picks a chapter, switches to car mode, and ends in the library and History. Each state is captured as SVG with dom-to-svg into `../.devkit/films/capture/`; captures are render inputs and are not committed. QA screenshots of every state go to `../.devkit/films/qa/`. The page clock, locale and time zone are fixed, so History shows the same times on every recording.
2. `recorder/render.mjs` renders `recorder/film/makeRealFilm.tsx`, a Remotion composition that sequences the 412 × 915 phone recordings with taps, to `public/films/player.mp4` (light) and `player-dark.mp4` at 2x, each with a `-poster.jpg`. It writes `app/films/player.json` with the render date for the page's structured data.
3. `recorder/export-portfolio.mjs` copies the desktop recordings (the preview's phone frame at 1280 × 800, light and dark) into the [evb-stack](https://github.com/evb0110/evb-stack) portfolio, whose player shows the SVG states directly.

The page plays the film in the visitor's theme, only while it is on screen. Visitors who prefer reduced motion see the poster until they press play.

To record and render again after the interface changes, from this directory:

```bash
(cd .. && npm run export:web)
pnpm exec playwright-core install --only-shell chromium   # once, if Playwright's Chromium is missing
node recorder/record.mjs          # --size phone|desktop and --theme light|dark redo part of the set
node recorder/render.mjs
node recorder/export-portfolio.mjs ../../evb-stack
```

The first render downloads Remotion's headless Chrome.

## Screenshots and store listings

`public/screenshots/1-7.png`, `public/icon.png` and `public/featureGraphic.png` are copied from `fastlane/metadata/android/en-US/images/`; `public/favicon.png` comes from `assets/`. Copy them again when the app's published screenshots change, and regenerate the 400 px WebP thumbnails the gallery shows; the viewer and the sitemap use the full PNGs:

```bash
for id in 1 2 3 4 5 6 7; do cwebp -quiet -q 80 -resize 400 0 "public/screenshots/$id.png" -o "public/screenshots/$id-400.webp"; done
```

Screenshots 1-6 capture the web preview at the phone film's 412-pixel width, saved at 1080 × 2400. Screenshot 7 is the Android 16 lock screen of an emulator running the release APK. The gallery reserves each thumbnail's dimensions and loads it lazily. Their captions and alt text live in `SCREENSHOTS` in `shared/site.ts`. Fonts and icons are bundled locally.

The store card is plain text with “In review”, without badges or outbound listing links. In `shared/site.ts`, replace the store's `url: null` with its confirmed listing URL to enable that card in one line. Both availability and the link label are derived from the URL; there is no separate flag to synchronize. Update the store section's introductory copy once F-Droid publishes the app. IzzyOnDroid is not listed: its AI policy conflicts with how the app was written (see [store submissions](../docs/store-submissions.md)).

## Expo isolation

The root TypeScript and ESLint configurations exclude `landing/`. Root `metro.config.js` blocks the entire landing directory from Expo's file map, including its nested dependencies. Generated Nuxt and Vercel output is ignored by Git. The root formatter uses `.gitignore` to skip pnpm-generated YAML; `pnpm-lock.yaml` is explicitly tracked and remains versioned when updated. Only source, the pnpm lockfile, web images and the rendered film belong in the landing commit; do not commit native binaries, film captures or generated dependencies.
