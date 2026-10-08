// Records films from the app's web preview in headless Chromium. Export the preview first:
//   npm run export:web                  (in the repository root)
//   node recorder/record.mjs [flow] [--size <phone|desktop>] [--theme <light|dark>]
// Phone films play on this landing (render.mjs). Desktop films show the preview's phone frame at
// 1280x800 for the evb-stack portfolio (export-portfolio.mjs). Both sites follow the visitor's theme.
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createServer } from 'node:net';
import path from 'node:path';
import { chromium } from 'playwright-core';
import { FilmRecorder, LANDING, pruneSharedAssets } from './recorder.mjs';

const REPO = path.resolve(LANDING, '..');
const FILMS = path.join(REPO, '.devkit/films');
const SIZES = {
  // The store screenshots' 1080x2400 at 2.62x. Narrower than 492 px, so the app fills the page.
  phone: { width: 412, height: 915 },
  desktop: { width: 1280, height: 800 },
};
const THEMES = ['light', 'dark'];

const args = process.argv.slice(2);
const flowName = args[0] && !args[0].startsWith('--') ? args.shift() : 'player';
let sizeFilter;
let themeFilter;
for (let index = 0; index < args.length; index += 2) {
  if (args[index] === '--size' && args[index + 1] in SIZES) sizeFilter = args[index + 1];
  else if (args[index] === '--theme' && THEMES.includes(args[index + 1])) themeFilter = args[index + 1];
  else
    throw new Error(
      `Unknown option: ${args.slice(index, index + 2).join(' ')}. Use --size phone|desktop, --theme light|dark.`,
    );
}
if (!existsSync(path.join(REPO, 'dist/web/index.html'))) {
  throw new Error('No web export in dist/web. Run npm run export:web in the repository root first.');
}
const { default: flow, title, prepare } = await import(`./flows/${flowName}.mjs`);

function freePort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}

// The repository's preview server, which supports the Range requests audio seeking needs.
const port = await freePort();
const preview = spawn(process.execPath, [path.join(REPO, 'scripts/preview-web.mjs')], {
  env: { ...process.env, PORT: String(port) },
  stdio: 'ignore',
});
const origin = `http://127.0.0.1:${port}`;
const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
try {
  for (let attempt = 0; ; attempt++) {
    const ok = await fetch(origin).then(
      response => response.ok,
      () => false,
    );
    if (ok) break;
    if (attempt === 50) throw new Error(`The preview server did not start on ${origin}.`);
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  for (const size of sizeFilter ? [sizeFilter] : Object.keys(SIZES)) {
    for (const theme of themeFilter ? [themeFilter] : THEMES) {
      const variant = `${size}-${theme}`;
      console.log(`Recording ${flowName}: ${variant}`);
      // A fresh context per variant: empty library and history, and the chosen theme from the first paint.
      const { width, height } = SIZES[size];
      const context = await browser.newContext({
        viewport: { width, height },
        deviceScaleFactor: 2,
        colorScheme: theme,
        locale: 'en-US',
        timezoneId: 'UTC',
      });
      await context.addInitScript(value => localStorage.setItem('folder-player-theme', value), theme);
      const page = await context.newPage();
      // History shows when each entry was saved: the same evening on every recording.
      await page.clock.install({ time: new Date('2026-10-09T19:42:00Z') });
      await page.clock.resume();
      try {
        await page.goto(origin);
        await prepare(page);
        const rec = new FilmRecorder(page, flowName, {
          width,
          height,
          qaDir: path.join(FILMS, 'qa'),
          variant,
        });
        await flow(page, rec, { size });
        await rec.save({ title });
      } finally {
        await context.close();
      }
    }
  }
  pruneSharedAssets(flowName);
} finally {
  await browser.close();
  preview.kill();
}
