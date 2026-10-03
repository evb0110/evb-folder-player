# EVB Folder Player landing

The site at [evb-folder-player.vercel.app](https://evb-folder-player.vercel.app): downloads for the latest Android release and real screenshots of the app. It is a separate Nuxt 4 app with Nuxt UI 4, Tailwind 4 and its own pnpm lockfile; Vercel builds it from this folder.

```bash
pnpm install
pnpm dev
```

The download panel reads the latest GitHub release through `server/api/release.get.ts`. Vercel regenerates the page at most every ten minutes, so a new release shows up without a redeploy. The API is cached for ten minutes with stale-while-revalidate. It accepts both `EVB-Folder-Player-<version>-<abi>.apk` and legacy `folder-player-<version>-<abi>.apk` filenames, preferring the branded name for each ABI. If GitHub is unavailable or an asset is missing, that download links to GitHub Releases instead.

## Vercel

Create the project from `evb0110/evb-folder-player` with:

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

## Screenshots and store listings

`public/screenshots/1-6.png`, `public/icon.png` and `public/featureGraphic.png` are copied from `fastlane/metadata/android/en-US/images/`; `public/favicon.png` comes from `assets/`. Copy them again when the app's published screenshots change. The gallery reserves each image's 1080 × 2400 dimensions and loads it lazily. Fonts and icons are bundled locally.

The store cards are plain text with “Coming soon”, without badges or outbound listing links. In `shared/site.ts`, replace a store's `url: null` with its confirmed listing URL to enable that card in one line. Both availability and the link label are derived from the URL; there is no separate flag to synchronize. Update the store section's introductory copy once submissions are complete.

## Expo isolation

The root TypeScript and ESLint configurations exclude `landing/`. Root `metro.config.js` blocks the entire landing directory from Expo's file map, including its nested dependencies. Generated Nuxt and Vercel output is ignored by Git. The root formatter uses `.gitignore` to skip pnpm-generated YAML; `pnpm-lock.yaml` is explicitly tracked and remains versioned when updated. Only source, the pnpm lockfile and web images belong in the landing commit; do not commit native binaries or generated dependencies.
