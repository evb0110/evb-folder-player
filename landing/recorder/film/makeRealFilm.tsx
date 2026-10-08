/** @jsxRuntime automatic */
/** @jsxImportSource react */
// A recorded flow of the real app: SVG snapshots of the live DOM (dom-to-svg), sequenced with taps
// and a camera. Adapted from the EVB Viewer landing films, with a touch point instead of a mouse
// pointer. recorder/render.mjs renders it to the video the landing plays.
import { useEffect, useState } from 'react';
import { cancelRender, continueRender, delayRender, Easing, interpolate, staticFile, useCurrentFrame } from 'remotion';

type TRect = [number, number, number, number];

export interface IFilmStep {
  svg: string;
  dur: number;
  /** cut: instant; fade: crossfade from the previous state; dip: previous fades to the app background, this fades in. */
  transition?: 'cut' | 'fade' | 'dip';
  fade: number;
  cursor: [number, number] | null;
  click: boolean;
  focus: TRect | null;
  pan: [TRect, TRect] | null;
  height: number;
  caret: [number, number, number] | null;
}

export interface IFilmManifest {
  film: string;
  title: string;
  width: number;
  height: number;
  background?: string;
  fonts: Array<{
    family: string;
    url: string;
    weight: string;
    style: string;
    unicodeRange?: string;
  }>;
  steps: IFilmStep[];
}

const LOOP_OUT = 12;
const LOOP_IN = 10;
/** Frames of the opening fade; the poster shows the frame after it. */
export const INTRO_FRAMES = LOOP_IN;
const CAMERA_MOVE = 20;
const TOUCH_SIZE = 46;
const clamp = {
  extrapolateLeft: 'clamp',
  extrapolateRight: 'clamp',
} as const;

/**
 * Loads every SVG state and the fonts, holding the render until they are ready. The captures live
 * in Remotion's public folder (recorder/render.mjs), so their /films/... image paths are rewritten
 * to its static base.
 */
function useFilmAssets(m: IFilmManifest) {
  const [svgs, setSvgs] = useState<Record<string, string> | null>(null);
  const [handle] = useState(() => delayRender(`Loading ${m.film}`));
  useEffect(() => {
    const base = staticFile(`films/${m.film}/`);
    const root = staticFile('films').slice(0, -'films'.length);
    const fonts = m.fonts.map(f =>
      new FontFace(f.family, `url(${new URL(f.url, new URL(base, location.href)).pathname})`, {
        weight: f.weight,
        style: f.style,
        ...(f.unicodeRange ? { unicodeRange: f.unicodeRange } : {}),
      })
        .load()
        .then(face => {
          document.fonts.add(face);
        }),
    );
    const files = [...new Set(m.steps.map(s => s.svg))];
    Promise.all([Promise.all(files.map(file => fetch(base + file).then(r => r.text()))), ...fonts]).then(
      ([texts]) => {
        setSvgs(
          Object.fromEntries(
            files.map((file, i) => [file, texts[i]!.replaceAll('href="/films/', `href="${root}films/`)]),
          ),
        );
        continueRender(handle);
      },
      (error: unknown) => cancelRender(error),
    );
  }, [m, handle]);
  return svgs;
}

function lerpRect(a: TRect, b: TRect, t: number): TRect {
  return [0, 1, 2, 3].map(i => a[i]! + (b[i]! - a[i]!) * t) as TRect;
}

/** A fingertip on the screen, like Android's "Show taps": a translucent disc that presses in. */
function TouchPoint({ x, y, opacity, pressed }: { x: number; y: number; opacity: number; pressed: number }) {
  return (
    <div
      style={{
        position: 'absolute',
        left: x - TOUCH_SIZE / 2,
        top: y - TOUCH_SIZE / 2,
        width: TOUCH_SIZE,
        height: TOUCH_SIZE,
        borderRadius: '50%',
        background: 'rgba(255, 255, 255, 0.45)',
        border: '2px solid rgba(16, 25, 24, 0.3)',
        boxShadow: '0 2px 12px rgba(0, 0, 0, 0.2)',
        opacity,
        transform: `scale(${1 - pressed * 0.2})`,
      }}
    />
  );
}

export function makeRealFilm(m: IFilmManifest) {
  const starts: number[] = [];
  let acc = 0;
  for (const s of m.steps) {
    starts.push(acc);
    acc += s.dur;
  }
  const total = acc;
  const full: TRect = [0, 0, m.width, m.height];

  // Camera per step: a pan's start, else the focus, else the full frame.
  const cameraAt = m.steps.map(s => (s.pan ? s.pan[0] : (s.focus ?? full)));
  const cameraEnd = m.steps.map((s, i) => (s.pan ? s.pan[1] : cameraAt[i]!));

  function Film() {
    const frame = useCurrentFrame();
    const svgs = useFilmAssets(m);
    const markupFor = (s: IFilmStep) => svgs?.[s.svg] ?? '';
    let i = starts.findIndex((st, k) => frame >= st && frame < st + m.steps[k]!.dur);
    if (i < 0) i = m.steps.length - 1;
    const step = m.steps[i]!;
    const local = frame - starts[i]!;
    const prev = i > 0 ? m.steps[i - 1]! : null;
    const kind = step.transition ?? (step.fade > 0 ? 'fade' : 'cut');
    const span = Math.max(1, step.fade);
    let prevOpacity = 0;
    let curOpacity = 1;
    if (prev && kind === 'fade' && local < span) {
      prevOpacity = 1;
      curOpacity = local / span;
    } else if (prev && kind === 'dip' && local < span) {
      const half = span / 2;
      prevOpacity = local < half ? 1 - local / half : 0;
      curOpacity = local < half ? 0 : (local - half) / half;
    }
    // Loop seam: dip the last state to the background, and bring the first state in from it.
    const loopOut = interpolate(frame, [total - LOOP_OUT, total], [1, 0], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    });
    const loopIn = interpolate(frame, [0, LOOP_IN], [0, 1], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    });
    curOpacity *= loopOut * (i === 0 ? loopIn : 1);
    const bg = m.background ?? '#ffffff';

    // Camera: move from the previous step's end framing to this step's framing, then pan if asked.
    const fromCam = i > 0 ? cameraEnd[i - 1]! : cameraAt[0]!;
    // Different capture heights (scrolled full-page vs viewport) mean different coordinate spaces: cut the camera.
    const sameSpace = !prev || prev.height === step.height;
    const settle = sameSpace
      ? interpolate(local, [0, CAMERA_MOVE], [0, 1], {
          extrapolateRight: 'clamp',
          easing: Easing.inOut(Easing.cubic),
        })
      : 1;
    let cam = lerpRect(fromCam, cameraAt[i]!, settle);
    if (step.pan) {
      const t = interpolate(local, [CAMERA_MOVE * 0.5, step.dur - 6], [0, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
        easing: Easing.inOut(Easing.sin),
      });
      cam = lerpRect(cam, step.pan[1], t);
    }
    const scale = Math.min(m.width / cam[2], m.height / cam[3]);
    const tx = -cam[0] * scale + (m.width - cam[2] * scale) / 2;
    const ty = -cam[1] * scale + (m.height - cam[3] * scale) / 2;

    // Taps: the touch point lands on the target near the end of a tapping step and presses in,
    // then lifts at the start of the next state while a ripple spreads from it.
    let touch: { at: [number, number]; opacity: number; pressed: number } | null = null;
    if (step.click && step.cursor) {
      touch = {
        at: step.cursor,
        opacity: interpolate(local, [step.dur - 14, step.dur - 8], [0, 1], clamp),
        pressed: interpolate(local, [step.dur - 8, step.dur], [0, 1], clamp),
      };
    } else if (prev?.click && prev.cursor) {
      const lift = interpolate(local, [0, 8], [1, 0], clamp);
      touch = { at: prev.cursor, opacity: lift, pressed: lift };
    }
    const ripple = prev?.click ? interpolate(local, [0, 16], [0, 1], clamp) : 0;
    const rippleAt = prev?.click ? prev.cursor : null;
    const caretOn = step.caret && curOpacity > 0.9 && Math.floor(frame / 16) % 2 === 0;

    const layer = (s: IFilmStep, opacity: number, key: string) => (
      <div
        key={key}
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: m.width,
          height: s.height,
          opacity,
        }}
        dangerouslySetInnerHTML={{ __html: markupFor(s) }}
      />
    );

    return (
      <div
        style={{
          position: 'absolute',
          inset: 0,
          overflow: 'hidden',
          background: bg,
        }}
      >
        {svgs && (
          <div
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              width: m.width,
              height: m.height,
              transform: `translate(${tx}px, ${ty}px) scale(${scale})`,
              transformOrigin: '0 0',
            }}
          >
            {prev && prevOpacity > 0 && layer(prev, prevOpacity, `p${i}`)}
            {curOpacity > 0 && layer(step, curOpacity, `s${i}`)}
            {caretOn && step.caret && (
              <div
                style={{
                  position: 'absolute',
                  left: step.caret[0],
                  top: step.caret[1],
                  width: 1.5,
                  height: step.caret[2],
                  background: '#111',
                }}
              />
            )}
            {ripple > 0 && ripple < 1 && rippleAt && (
              <div
                style={{
                  position: 'absolute',
                  left: rippleAt[0] - TOUCH_SIZE / 2,
                  top: rippleAt[1] - TOUCH_SIZE / 2,
                  width: TOUCH_SIZE,
                  height: TOUCH_SIZE,
                  borderRadius: '50%',
                  border: '2px solid rgba(128, 140, 134, 0.8)',
                  transform: `scale(${0.6 + ripple})`,
                  opacity: 1 - ripple,
                }}
              />
            )}
            {touch && touch.opacity > 0 && (
              <TouchPoint x={touch.at[0]} y={touch.at[1]} opacity={touch.opacity * loopOut} pressed={touch.pressed} />
            )}
          </div>
        )}
      </div>
    );
  }

  return {
    Film,
    total,
  };
}
