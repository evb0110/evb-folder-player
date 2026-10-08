<template>
  <figure class="film">
    <div class="film-phone">
      <div class="film-screen" :style="{ aspectRatio: `${film.width} / ${film.height}` }">
        <video
          v-if="mounted"
          ref="video"
          class="film-video"
          src="/films/player.mp4"
          :aria-label="label"
          muted
          playsinline
          loop
          preload="auto"
          disablepictureinpicture
          @loadedmetadata="onMetadata"
          @playing="showPoster = false"
          @play="playing = true"
          @pause="playing = false"
        />
        <!-- The first frame, and the still for reduced motion, until the video shows it. -->
        <img
          v-if="showPoster"
          class="film-poster"
          src="/films/player-poster.jpg"
          alt=""
          :width="film.width"
          :height="film.height"
        />
      </div>
    </div>
    <figcaption class="film-controls">
      <button class="film-toggle" type="button" :aria-label="playing ? 'Pause' : 'Play'" @click="toggle">
        <UIcon :name="playing ? 'i-lucide-pause' : 'i-lucide-play'" />
      </button>
      <div
        class="film-track"
        role="slider"
        tabindex="0"
        aria-label="Film position, in seconds"
        :aria-valuemin="0"
        :aria-valuemax="Math.round(duration)"
        :aria-valuenow="Math.round(time)"
        @pointerdown="seekFromPointer"
        @keydown.left.prevent="seekTo(time - 1)"
        @keydown.right.prevent="seekTo(time + 1)"
      >
        <div class="film-fill" :style="{ width: `${(time / Math.max(duration, 0.001)) * 100}%` }" />
      </div>
      <span class="film-time">{{ time.toFixed(1) }}s</span>
    </figcaption>
  </figure>
</template>

<script setup lang="ts">
import { useIntersectionObserver, usePreferredReducedMotion, useRafFn } from '@vueuse/core';
import film from '~/films/player.json';

defineProps<{ label: string }>();

// Rendered by recorder/render.mjs from a recording of the app's web preview.
const video = useTemplateRef<HTMLVideoElement>('video');
const reducedMotion = usePreferredReducedMotion();
const mounted = ref(false);
const playing = ref(false);
const showPoster = ref(true);
const visible = ref(false);
const time = ref(0);
const duration = ref(0);
const still = computed(() => reducedMotion.value === 'reduce');

function play() {
  showPoster.value = false;
  void video.value?.play().catch(() => {});
}

function onMetadata() {
  const element = video.value;
  if (!element) {
    return;
  }
  duration.value = element.duration;
  element.currentTime = film.intro / film.fps;
  time.value = element.currentTime;
  if (visible.value && !still.value) {
    play();
  }
}

function toggle() {
  if (video.value?.paused) {
    play();
  } else {
    video.value?.pause();
  }
}

function seekTo(seconds: number) {
  const element = video.value;
  if (!element || !duration.value) {
    return;
  }
  element.currentTime = Math.min(duration.value, Math.max(0, seconds));
  time.value = element.currentTime;
  showPoster.value = false;
}

function seekFromPointer(event: PointerEvent) {
  if (!(event.currentTarget instanceof HTMLElement)) {
    return;
  }
  const rect = event.currentTarget.getBoundingClientRect();
  const seek = (clientX: number) =>
    seekTo(Math.min(1, Math.max(0, (clientX - rect.left) / rect.width)) * duration.value);
  seek(event.clientX);
  const move = (moveEvent: PointerEvent) => seek(moveEvent.clientX);
  const up = () => {
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
  };
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up);
}

// timeupdate fires only a few times a second; follow the playhead every frame instead.
useRafFn(() => {
  if (video.value && playing.value) {
    time.value = video.value.currentTime;
  }
});

// Plays only while on screen.
useIntersectionObserver(video, ([entry]) => {
  visible.value = Boolean(entry?.isIntersecting);
  const element = video.value;
  if (!element || still.value || element.readyState < 1) {
    return;
  }
  if (visible.value) {
    play();
  } else {
    element.pause();
  }
});

onMounted(() => {
  // The reduced-motion preference is known only in the browser.
  mounted.value = true;
});
</script>

<style scoped>
.film {
  margin: 0;
}

.film-phone {
  padding: 9px;
  border-radius: 42px;
  background: #18211e;
  box-shadow:
    0 1px 2px rgb(16 25 24 / 12%),
    0 30px 60px -24px rgb(16 25 24 / 45%);
}

.film-screen {
  position: relative;
  overflow: hidden;
  border-radius: 33px;
  background: var(--paper-raised);
}

.film-video,
.film-poster {
  position: absolute;
  inset: 0;
  display: block;
  width: 100%;
  height: 100%;
}

.film-controls {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 14px;
  padding: 0 6px;
}

.film-toggle {
  display: grid;
  flex: none;
  width: 32px;
  height: 32px;
  place-items: center;
  border-radius: 8px;
  color: var(--ink);
  cursor: pointer;
}

.film-toggle:hover,
.film-toggle:focus-visible {
  background: var(--accent-soft);
}

.film-track {
  position: relative;
  flex: 1;
  height: 4px;
  overflow: hidden;
  border-radius: 2px;
  background: var(--line);
  cursor: pointer;
}

.film-fill {
  height: 100%;
  background: var(--accent);
}

.film-time {
  min-width: 42px;
  color: var(--ink-subtle);
  font-family: var(--mono);
  font-size: 12px;
  text-align: right;
}
</style>
