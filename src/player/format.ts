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
