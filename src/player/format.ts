import type { IBook } from './types.ts';

export function clockTime(ms = 0): string {
  const seconds = Math.floor(Math.max(0, ms) / 1000);
  const hours = Math.floor(seconds / 3600);
  const minutes = String(Math.floor(seconds / 60) % 60).padStart(hours ? 2 : 1, '0');
  return `${hours ? `${hours}:` : ''}${minutes}:${String(seconds % 60).padStart(2, '0')}`;
}

export function naturalCompare(a: string, b: string) {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
}

export function sortedBooks(books: IBook[]) {
  return [...books].sort((a, b) => naturalCompare(a.path, b.path));
}

const STORAGE_DOCUMENT = /^content:\/\/com\.android\.externalstorage\.documents\/tree\/[^/]+\/document\/([^/]+)$/;
// Android 9 and older index absolute paths; newer versions index paths within the shared storage volume.
const ABSOLUTE_PATH = /^\/storage\/(emulated\/\d+|[^/]+)(?:\/(.*))?$/;

/**
 * The storage volume and folder a book was read from, the same whether it came from a chosen folder or
 * the device audio scan, or null for other sources.
 */
export function bookLocation(book: IBook): string | null {
  if (book.root === 'device') {
    const path = book.id.slice('device:'.length);
    const absolute = ABSOLUTE_PATH.exec(path);
    if (!absolute) return `primary:${path}`;
    const volume = absolute[1].startsWith('emulated/') ? 'primary' : absolute[1].toLowerCase();
    return `${volume}:${absolute[2] ?? ''}`;
  }
  const document = STORAGE_DOCUMENT.exec(book.id);
  if (!document) return null;
  const id = decodeURIComponent(document[1]);
  const colon = id.indexOf(':');
  return `${id.slice(0, colon).toLowerCase()}:${id.slice(colon + 1)}`;
}

/** The copy with the latest listening position, otherwise the one from a chosen folder. */
function preferred(book: IBook, other: IBook) {
  const saved = (book.progress?.savedAt ?? 0) - (other.progress?.savedAt ?? 0);
  return saved ? saved > 0 : book.root !== 'device' && other.root === 'device';
}

/**
 * One entry per folder. A folder reached through both a chosen folder and the device audio scan, or
 * through two chosen folders that overlap, is in the library more than once. The other copies keep
 * their positions and history; they are only left out of the list.
 */
export function uniqueBooks(books: IBook[]) {
  const located = new Map<string, IBook>();
  const others: IBook[] = [];
  for (const book of books) {
    const location = bookLocation(book);
    if (location === null) {
      others.push(book);
      continue;
    }
    const kept = located.get(location);
    if (!kept || preferred(book, kept)) located.set(location, book);
  }
  return [...others, ...located.values()];
}

export function percent(position = 0, duration = 0) {
  return duration > 0 ? Math.min(100, Math.max(0, (position / duration) * 100)) : 0;
}

export function historyDate(time: number) {
  return new Date(time).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function parentFolder(path: string) {
  return path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '';
}

/** Whether `path` is a removed folder or book, or lies inside a removed folder. */
export function isHidden(path: string, hidden: string[]) {
  return hidden.some(item => path === item || path.startsWith(`${item}/`));
}

/** Direct subfolders and books of `path` in a slash-separated book hierarchy. */
export function folderChildren(books: IBook[], path: string): { folders: string[]; books: IBook[] } {
  const prefix = path ? `${path}/` : '';
  const folders = new Set<string>();
  const direct: IBook[] = [];
  for (const book of books) {
    if (!book.path.startsWith(prefix)) continue;
    const rest = book.path.slice(prefix.length);
    if (rest.includes('/')) folders.add(prefix + rest.split('/')[0]);
    else direct.push(book);
  }
  return { folders: [...folders].sort(naturalCompare), books: sortedBooks(direct) };
}
