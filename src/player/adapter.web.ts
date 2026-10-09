// Browser preview of the Android player. It mirrors the native checkpoint and history rules
// with an HTMLAudioElement and localStorage so the UI can be exercised without a device.
import { SKIP_MS } from './playback';
import type { IBook, IHistoryEntry, IPlayerAdapter, IPoint, IStatus, TCommand } from './types';

interface IWebData {
  books: IBook[];
  current?: IPoint;
  positions: Record<string, IPoint>;
  history: IHistoryEntry[];
  speed: number;
  boost?: number;
}

const STORAGE_KEY = 'folder-player-v1';
const HISTORY_LIMIT = 400;
const SAVE_INTERVAL_MS = 5000;
const RESTORE_TOLERANCE_MS = 1800;

function readData(): IWebData {
  const empty: IWebData = { books: [], positions: {}, history: [], speed: 1 };
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null') ?? empty;
  } catch {
    return empty;
  }
}

const data = readData();
const audio = new Audio();
audio.preload = 'metadata';

let activeBook: IBook | undefined;
let trackIndex = 0;
let loading = false;
let intendedPosition = 0;
let error: string | null = null;
let lastSave = 0;
let sleepAt = 0;
let changing = false;
let pendingPlay = false;
let nextHistoryId = Math.max(Date.now(), ...data.history.map(item => item.id + 1));
let boostContext: AudioContext | undefined;
let boostGain: GainNode | undefined;

function write() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function currentPoint(): IPoint | undefined {
  const track = activeBook?.tracks[trackIndex];
  if (!activeBook || !track) return data.current;
  return {
    bookId: activeBook.id,
    bookName: activeBook.name,
    trackId: track.id,
    trackTitle: track.title,
    trackIndex,
    position: loading ? intendedPosition : Math.round(audio.currentTime * 1000),
    duration: Number.isFinite(audio.duration) ? Math.round(audio.duration * 1000) : track.duration,
    savedAt: Date.now(),
  };
}

function save(reason?: string) {
  if (changing || loading || error) return;
  const point = currentPoint();
  if (!point) return;
  data.current = point;
  data.positions[point.bookId] = point;
  if (reason) {
    data.history.unshift({ ...point, id: nextHistoryId++, time: Date.now(), reason });
    data.history = data.history.slice(0, HISTORY_LIMIT);
  }
  write();
  lastSave = Date.now();
}

function load(book: IBook, trackId: string, position: number, play: boolean) {
  const index = book.tracks.findIndex(track => track.id === trackId);
  if (index < 0) throw new Error('This track is missing. Your saved position is still in History.');
  changing = true;
  audio.pause();
  activeBook = book;
  trackIndex = index;
  error = null;
  loading = true;
  intendedPosition = position;
  pendingPlay = play;
  audio.src = book.tracks[index].uri;
  audio.playbackRate = data.speed;
  audio.load();
  changing = false;
}

/**
 * Routes the audio through Web Audio only once a boost is chosen: a gain above the element's maximum
 * volume, then a limiter in place of Android's loudness enhancer. Runs for user commands, because a
 * browser starts an audio context only after a gesture.
 */
function applyBoost() {
  if (!data.boost && !boostContext) return;
  if (!boostContext || !boostGain) {
    boostContext = new AudioContext();
    const limiter = new DynamicsCompressorNode(boostContext, { threshold: -3, knee: 0, ratio: 20, attack: 0.003 });
    boostGain = new GainNode(boostContext);
    boostContext.createMediaElementSource(audio).connect(boostGain).connect(limiter).connect(boostContext.destination);
  }
  boostGain.gain.value = 10 ** ((data.boost ?? 0) / 20);
  void boostContext.resume();
}

function finishRestore() {
  if (!loading || audio.readyState < 1) return;
  if (Math.abs(audio.currentTime * 1000 - intendedPosition) > RESTORE_TOLERANCE_MS) return;
  loading = false;
  save();
  if (pendingPlay) audio.play().catch(e => (error = String(e)));
  pendingPlay = false;
}

async function play() {
  if (!audio.paused) return;
  if (loading) pendingPlay = true;
  else await audio.play();
}

async function toggle() {
  if (!activeBook || error) {
    const saved = data.current;
    const book = data.books.find(item => item.id === saved?.bookId);
    if (book && saved) load(book, saved.trackId, saved.position, true);
  } else if (audio.paused) {
    await play();
  } else {
    audio.pause();
  }
}

function undoPoint() {
  return data.history.find(item => item.reason.startsWith('Before ') && !item.undone);
}

function findBook(id: string, missing: string) {
  const book = data.books.find(item => item.id === id);
  if (!book) throw new Error(missing);
  return book;
}

async function runCommand(command: TCommand) {
  if (command.action === 'boost') data.boost = command.boost;
  applyBoost();
  switch (command.action) {
    case 'open': {
      const book = findBook(command.bookId, 'Folder not found.');
      const saved = data.positions[book.id];
      const trackId = command.trackId ?? saved?.trackId ?? book.tracks[0].id;
      const shouldPlay = command.play !== false;
      if (activeBook?.id === book.id && activeBook.tracks[trackIndex]?.id === trackId && !error) {
        if (shouldPlay) await play();
        return;
      }
      save(activeBook?.id === book.id ? 'Before changing tracks' : 'Before switching books');
      load(book, trackId, saved?.trackId === trackId ? saved.position : 0, shouldPlay);
      return;
    }
    case 'toggle':
      return toggle();
    case 'pause':
      return audio.pause();
    case 'seek':
    case 'skip': {
      save('Before jump');
      const point = currentPoint();
      if (!point) return;
      const wanted = command.action === 'seek' ? command.position : point.position + command.delta;
      const clamped = Math.max(0, Math.min(wanted, point.duration || Infinity));
      if (!activeBook) {
        const book = data.books.find(item => item.id === point.bookId);
        if (book) load(book, point.trackId, clamped, false);
      } else if (loading) {
        intendedPosition = clamped;
      } else {
        audio.currentTime = clamped / 1000;
        save();
      }
      return;
    }
    case 'undo': {
      const target = undoPoint();
      if (!target) return;
      load(
        findBook(target.bookId, 'Add this folder again to restore your place.'),
        target.trackId,
        target.position,
        false,
      );
      target.undone = true;
      return write();
    }
    case 'restore': {
      const { point } = command;
      const book = findBook(point.bookId, 'Add this folder again to restore your place.');
      save('Before restoring history');
      return load(book, point.trackId, point.position, false);
    }
    case 'bookmark':
      return save('Bookmark');
    case 'speed':
      data.speed = command.speed;
      audio.playbackRate = data.speed;
      return write();
    case 'boost':
      return write();
    case 'sleep':
      sleepAt = command.minutes ? Date.now() + command.minutes * 60_000 : 0;
      return;
  }
}

audio.addEventListener('loadedmetadata', () => {
  intendedPosition = Math.min(intendedPosition, audio.duration * 1000 || intendedPosition);
  audio.currentTime = intendedPosition / 1000;
  finishRestore();
});
audio.addEventListener('seeked', finishRestore);
audio.addEventListener('play', () => save('Listening'));
audio.addEventListener('pause', () => save('Paused'));
audio.addEventListener('timeupdate', () => {
  if (sleepAt && Date.now() >= sleepAt) {
    sleepAt = 0;
    audio.pause();
  }
  if (Date.now() - lastSave >= SAVE_INTERVAL_MS) save();
});
audio.addEventListener('error', () => {
  error = 'This audio file is unavailable. Add its folder again. Your saved position is safe.';
  loading = false;
});
audio.addEventListener('ended', () => {
  save('Chapter finished');
  const next = activeBook?.tracks[trackIndex + 1];
  if (activeBook && next) load(activeBook, next.id, 0, true);
});
window.addEventListener('pagehide', () => save());

export const player: IPlayerAdapter = {
  async getLibrary() {
    return data.books.map(book => ({ ...book, progress: data.positions[book.id] }));
  },
  async getHistory() {
    return [...data.history];
  },
  async getStatus(): Promise<IStatus> {
    return {
      ...currentPoint(),
      playing: !audio.paused && !audio.ended,
      loading,
      speed: data.speed,
      boost: data.boost ?? 0,
      error,
      sleepAt,
      canUndo: !!undoPoint(),
    };
  },
  command: runCommand,
  async pickFolder() {
    throw new Error(
      'Folder access is available in the Android app. Use the included sample to explore this browser preview.',
    );
  },
  async scanDevice() {
    throw new Error('Device audio scanning is available in the Android app.');
  },
  async rescan() {
    return true;
  },
  async addSample(book) {
    data.books = [...data.books.filter(item => item.id !== book.id), book];
    write();
    return true;
  },
  // Opening archives with the app is an Android feature.
  async getImportFolder() {
    return null;
  },
  async cancelImport() {},
  async dismissImport() {},
  async openDownloads() {},
  async isTipDismissed(id) {
    return localStorage.getItem(`folder-player-tip-${id}`) === 'dismissed';
  },
  async dismissTip(id) {
    localStorage.setItem(`folder-player-tip-${id}`, 'dismissed');
  },
};

// Headset next/previous are ignored on purpose; only natural chapter completion advances.
if ('mediaSession' in navigator) {
  navigator.mediaSession.setActionHandler('play', () => void play());
  navigator.mediaSession.setActionHandler('pause', () => audio.pause());
  navigator.mediaSession.setActionHandler('nexttrack', () => {});
  navigator.mediaSession.setActionHandler('previoustrack', () => {});
  navigator.mediaSession.setActionHandler('seekbackward', () => void runCommand({ action: 'skip', delta: -SKIP_MS }));
  navigator.mediaSession.setActionHandler('seekforward', () => void runCommand({ action: 'skip', delta: SKIP_MS }));
}
