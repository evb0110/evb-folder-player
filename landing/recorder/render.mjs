// Renders the recorded light phone film to the video the landing plays, with Remotion's renderer:
//   node recorder/render.mjs [flow]
// Reads the capture record.mjs wrote to ../.devkit/films/capture and writes public/films/<flow>.mp4,
// its poster, and app/films/<flow>.json for the page.
// The page plays a plain video, so the browser never rasterises the heavy SVG states itself.
import { bundle } from '@remotion/bundler';
import { renderMedia, renderStill, selectComposition } from '@remotion/renderer';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const LANDING = path.resolve(HERE, '..');
const CAPTURE = path.resolve(LANDING, '../.devkit/films/capture');
// 412x915 recordings at 2x stay sharp in the page's phone frame on a 2x display.
const SCALE = 2;
/** First frame after the opening fade: the poster, the reduced-motion still, and where playback starts. */
const INTRO_FRAMES = 10;

const flow = process.argv[2] ?? 'player';
const manifestPath = path.join(CAPTURE, 'manifests', `${flow}.phone-light.json`);
if (!existsSync(manifestPath)) {
  throw new Error(`No capture at ${manifestPath}. Record it first with recorder/record.mjs ${flow} --size phone.`);
}
const inputProps = { manifest: JSON.parse(readFileSync(manifestPath, 'utf8')) };

const serveUrl = await bundle({
  entryPoint: path.join(HERE, 'film/registerFilmRoot.tsx'),
  publicDir: CAPTURE,
});
const composition = await selectComposition({ serveUrl, id: 'film', inputProps });
const outDir = path.join(LANDING, 'public/films');
mkdirSync(outDir, { recursive: true });
console.log(`Rendering ${flow}: ${composition.durationInFrames} frames`);
await renderMedia({
  serveUrl,
  composition,
  inputProps,
  codec: 'h264',
  // Lossless frames keep small interface text sharp; still stretches cost almost nothing.
  imageFormat: 'png',
  crf: 26,
  x264Preset: 'veryslow',
  pixelFormat: 'yuv420p',
  scale: SCALE,
  outputLocation: path.join(outDir, `${flow}.mp4`),
});
await renderStill({
  serveUrl,
  composition,
  inputProps,
  frame: INTRO_FRAMES,
  imageFormat: 'jpeg',
  jpegQuality: 85,
  scale: SCALE,
  output: path.join(outDir, `${flow}-poster.jpg`),
});

const index = {
  fps: composition.fps,
  intro: INTRO_FRAMES,
  frames: composition.durationInFrames,
  width: composition.width,
  height: composition.height,
};
mkdirSync(path.join(LANDING, 'app/films'), { recursive: true });
writeFileSync(path.join(LANDING, 'app/films', `${flow}.json`), `${JSON.stringify(index, null, 2)}\n`);
