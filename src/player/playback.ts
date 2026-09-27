import type { IBook, IStatus, ITrack } from './types.ts';

export const SKIP_MS = 20_000;
export const SPEEDS = [0.75, 1, 1.25, 1.5, 1.75, 2];
export const SLEEP_MINUTES = [0, 15, 30, 45, 60];

export interface IBookPlayback {
  /** The book is loaded in the player, not only saved. */
  active: boolean;
  playing: boolean;
  loading: boolean;
  trackIndex: number;
  track: ITrack | undefined;
  position: number;
  duration: number;
}

/** Where a book is: the live player state if it is loaded, otherwise its saved progress. */
export function bookPlayback(book: IBook, status: IStatus): IBookPlayback {
  const active = status.bookId === book.id;
  const saved = active ? status : (book.progress ?? undefined);
  const savedIndex = book.tracks.findIndex(track => track.id === saved?.trackId);
  const trackIndex = Math.max(0, savedIndex);
  const track = book.tracks[trackIndex];
  return {
    active,
    playing: active && status.playing,
    loading: active && status.loading,
    trackIndex,
    track,
    position: savedIndex >= 0 ? (saved?.position ?? 0) : 0,
    duration: (savedIndex >= 0 && saved?.duration) || track?.duration || 0,
  };
}

export function sleepMinutesLeft(sleepAt: number | undefined, now = Date.now()) {
  return sleepAt ? Math.max(0, Math.ceil((sleepAt - now) / 60_000)) : 0;
}
