import type { IBook, IHistoryEntry, IPlayerAdapter, IPoint, IStatus } from './types';
interface IWebData { books: IBook[]; current?: IPoint; positions: Record<string, IPoint>; history: IHistoryEntry[]; speed: number }
const storageKey = 'folder-player-v1';
let data: IWebData;
try { data = JSON.parse(localStorage.getItem(storageKey) || 'null') ?? { books: [], positions: {}, history: [], speed: 1 }; }
catch { data = { books: [], positions: {}, history: [], speed: 1 }; }
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
function write() { localStorage.setItem(storageKey, JSON.stringify(data)); }
function point(): IPoint | undefined {
  const track = activeBook?.tracks[trackIndex];
  if (!track || !activeBook) return data.current;
  return { bookId: activeBook.id, bookName: activeBook.name, trackId: track.id, trackTitle: track.title, trackIndex, position: loading ? intendedPosition : Math.round(audio.currentTime * 1000), duration: Number.isFinite(audio.duration) ? Math.round(audio.duration * 1000) : track.duration, savedAt: Date.now() };
}
function save(reason?: string) {
  if (changing || loading || error) return;
  const current = point();
  if (!current) return;
  data.current = current; data.positions[current.bookId] = current;
  if (reason) { data.history.unshift({ ...current, id: nextHistoryId++, time: Date.now(), reason }); data.history = data.history.slice(0, 400); }
  write(); lastSave = Date.now();
}
function load(book: IBook, id: string, position: number, play: boolean) {
  const index = book.tracks.findIndex(track => track.id === id);
  if (index < 0) throw new Error('This track is missing. Your saved position is still in History.');
  changing = true; audio.pause(); activeBook = book; trackIndex = index;
  error = null; loading = true; intendedPosition = position; pendingPlay = play;
  audio.src = book.tracks[index].uri; audio.playbackRate = data.speed;
  audio.load(); changing = false;
}
function finishRestore() {
  if (!loading || audio.readyState < 1) return;
  if (Math.abs(audio.currentTime * 1000 - intendedPosition) > 1800) return;
  loading = false; save();
  if (pendingPlay) audio.play().catch(e => { error = String(e); });
  pendingPlay = false;
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
  if (sleepAt && Date.now() >= sleepAt) { sleepAt = 0; audio.pause(); }
  if (Date.now() - lastSave >= 5000) save();
});
audio.addEventListener('error', () => { error = 'This audio file is unavailable. Add its folder again. Your saved position is safe.'; loading = false; });
audio.addEventListener('ended', () => {
  save('Chapter finished');
  if (activeBook && trackIndex + 1 < activeBook.tracks.length) load(activeBook, activeBook.tracks[trackIndex + 1].id, 0, true);
});
window.addEventListener('pagehide', () => save());
function undoPoint() { return data.history.find(item => item.reason.startsWith('Before ') && !item.undone); }
async function toggle() {
  if (!activeBook || error) {
    const saved = data.current; const book = data.books.find(book => book.id === saved?.bookId);
    if (book && saved) load(book, saved.trackId, saved.position, true);
  } else if (audio.paused) { if (loading) pendingPlay = true; else await audio.play(); } else audio.pause();
}
export const player: IPlayerAdapter = {
  async getLibrary() { return data.books.map(book => ({ ...book, progress: data.positions[book.id] })); },
  async getHistory() { return [...data.history]; },
  async getStatus(): Promise<IStatus> { return { ...point(), playing: !audio.paused && !audio.ended, loading, speed: data.speed, error, sleepAt, canUndo: !!undoPoint() }; },
  async command(action, payload = {}) {
    switch (action) {
      case 'open': {
        const book = data.books.find(book => book.id === payload.bookId);
        if (!book) throw new Error('Folder not found.');
        const saved = data.positions[book.id];
        const id = typeof payload.trackId === 'string' ? payload.trackId : saved?.trackId ?? book.tracks[0].id;
        if (activeBook?.id === book.id && activeBook.tracks[trackIndex]?.id === id && !error) { if (payload.play !== false) await toggleIfPaused(); break; }
        save(activeBook?.id === book.id ? 'Before changing tracks' : 'Before switching books');
        load(book, id, saved?.trackId === id ? saved.position : 0, payload.play !== false);
        break;
      }
      case 'toggle': await toggle(); break;
      case 'pause': audio.pause(); break;
      case 'seek': case 'skip': {
        save('Before jump');
        const current = point();
        if (!current) break;
        const wanted = action === 'seek' ? Number(payload.position) : current.position + Number(payload.delta);
        const clamped = Math.max(0, Math.min(wanted, current.duration || Infinity));
        if (!activeBook) {
          const book = data.books.find(book => book.id === current.bookId);
          if (book) load(book, current.trackId, clamped, false);
        } else if (loading) intendedPosition = clamped;
        else { audio.currentTime = clamped / 1000; save(); }
        break;
      }
      case 'restore': case 'undo': {
        const target = action === 'undo' ? undoPoint() : payload.point as IHistoryEntry;
        if (!target) break;
        const book = data.books.find(book => book.id === target.bookId);
        if (!book) throw new Error('Add this folder again to restore your place.');
        if (action === 'restore') save('Before restoring history');
        load(book, target.trackId, target.position, false);
        if (action === 'undo') target.undone = true;
        write(); break;
      }
      case 'bookmark': save('Bookmark'); break;
      case 'speed': data.speed = Number(payload.speed); audio.playbackRate = data.speed; write(); break;
      case 'sleep': sleepAt = Number(payload.minutes) ? Date.now() + Number(payload.minutes) * 60000 : 0; break;
    }
  },
  async pickFolder() {
    throw new Error('Folder access is available in the Android app. Use the included sample to explore this browser preview.');
  },
  async scanDevice() { throw new Error('Device audio scanning is available in the Android app.'); },
  async rescan() { return true; },
  async addSample(book) {
    data.books = [...data.books.filter(item => item.id !== book.id), book];
    write(); return true;
  },
};
async function toggleIfPaused() { if (audio.paused) { if (loading) pendingPlay = true; else await audio.play(); } }
if ('mediaSession' in navigator) {
  navigator.mediaSession.setActionHandler('play', () => { void toggleIfPaused(); });
  navigator.mediaSession.setActionHandler('pause', () => audio.pause());
  navigator.mediaSession.setActionHandler('nexttrack', () => {});
  navigator.mediaSession.setActionHandler('previoustrack', () => {});
  navigator.mediaSession.setActionHandler('seekbackward', () => { void player.command('skip', { delta: -20000 }); });
  navigator.mediaSession.setActionHandler('seekforward', () => { void player.command('skip', { delta: 20000 }); });
}
