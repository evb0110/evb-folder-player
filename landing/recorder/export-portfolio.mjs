// Copies the desktop films into the evb-stack portfolio, in the layout its in-browser player reads:
//   node recorder/export-portfolio.mjs <evb-stack checkout> [flow]
// Writes app/prototype/motion/films/folderplayer{,-dark}.json and the SVG states and fonts under
// app/prototype/public/films/folderplayer{,-dark}/. Record the desktop films first (record.mjs).
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CAPTURE = path.resolve(HERE, '../../.devkit/films/capture');
const [target, flow = 'player'] = process.argv.slice(2);
if (!target || !existsSync(path.join(target, 'app/prototype/motion/films'))) {
  throw new Error('Pass the path of an evb-stack checkout.');
}

for (const [theme, id] of [
  ['light', 'folderplayer'],
  ['dark', 'folderplayer-dark'],
]) {
  const manifestPath = path.join(CAPTURE, 'manifests', `${flow}.desktop-${theme}.json`);
  if (!existsSync(manifestPath)) throw new Error(`No capture at ${manifestPath}. Run record.mjs --size desktop.`);
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const source = path.join(CAPTURE, 'films', manifest.film);
  const out = path.join(target, 'app/prototype/public/films', id);
  rmSync(out, { recursive: true, force: true });
  mkdirSync(path.join(out, 'fonts'), { recursive: true });
  for (const svg of new Set(manifest.steps.map(step => step.svg))) {
    const markup = readFileSync(path.join(source, svg), 'utf8');
    if (markup.includes('href="/films/'))
      throw new Error(`${svg} links a shared image; the portfolio has no copy of it.`);
    writeFileSync(path.join(out, svg), markup);
  }
  // The portfolio resolves font URLs against the film's own folder.
  const fonts = manifest.fonts.map((font, index) => {
    const file = `fonts/${index}${path.extname(font.url)}`;
    copyFileSync(path.join(source, font.url), path.join(out, file));
    return { ...font, url: file };
  });
  const exported = { ...manifest, film: id, fonts };
  writeFileSync(
    path.join(target, 'app/prototype/motion/films', `${id}.json`),
    `${JSON.stringify(exported, null, 1)}\n`,
  );
  console.log(`${id}: ${manifest.steps.length} states, ${fonts.length} fonts`);
}
