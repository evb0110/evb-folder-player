import type { IBook, ITrack } from './types.ts';

export interface IChapterTitle {
  /** The chapter's own name, without its file number or the leading parts it shares with its neighbors. */
  title: string;
  /** Leading parts shared with the neighboring chapters, such as one collection inside an omnibus; empty when none. */
  part: string;
  /** The file name without its extension, as found on the device. */
  full: string;
}

/** A file number at the start of a title, followed by a separator: `041 - `, `07. `, `3_`, `12 `. */
const LEADING_NUMBER = /^(\d+)(?:\s*[-–—._):]+\s*|\s+)(?=\S)/;
/** Parts of a file name joined with a spaced dash: `Series - Book - Chapter`. */
const PART_SEPARATOR = /(\s+[-–—]\s+)/;

/** Equal apart from case, accents and surrounding space. */
export const sameTitle = (a: string, b: string) =>
  a.trim().localeCompare(b.trim(), undefined, { sensitivity: 'base' }) === 0;

/**
 * Whether the leading numbers count the chapters: they rise through the book, start near 1 and
 * leave few gaps. Numbers that are part of a name, such as `1984 - Part 1`, stay in the title.
 */
function countsChapters(numbers: number[]) {
  if (!numbers.length) return false;
  const first = numbers[0];
  const last = numbers[numbers.length - 1];
  const rising = numbers.every((value, i) => i === 0 || value > numbers[i - 1]);
  return rising && first <= 2 && last - first < 2 * numbers.length;
}

/** Number of leading parts two titles have in common. */
function sharedParts(a: string[], b: string[] | undefined) {
  if (!b) return 0;
  let count = 0;
  while (count < a.length && count < b.length && sameTitle(a[count], b[count])) count++;
  return count;
}

/** Splits titles into readable chapter names and the parts they share with their neighbors. */
export function parseChapterTitles(titles: string[], bookName = ''): IChapterTitle[] {
  const numbers = titles.map(title => LEADING_NUMBER.exec(title));
  const numbered = numbers.filter(match => match !== null).map(match => Number(match[1]));
  const strip = countsChapters(numbered);
  const pieces = titles.map((title, i) => {
    const rest = strip && numbers[i] ? title.slice(numbers[i][0].length) : title;
    // Alternating parts and the separators between them, so a title keeps its own dashes.
    return rest.split(PART_SEPARATOR);
  });
  const parts = pieces.map(split => split.filter((_, i) => i % 2 === 0).map(part => part.trim()));

  return titles.map((full, i) => {
    const own = parts[i];
    // At least one part always stays as the chapter's own name.
    const shared = Math.min(own.length - 1, Math.max(sharedParts(own, parts[i - 1]), sharedParts(own, parts[i + 1])));
    const title =
      pieces[i]
        .slice(shared * 2)
        .join('')
        .trim() || full;
    const part = shared
      ? pieces[i]
          .slice(0, shared * 2 - 1)
          .join('')
          .trim()
      : '';
    return { title, part: part && !sameTitle(part, bookName) ? part : '', full };
  });
}

const cache = new WeakMap<IBook, IChapterTitle[]>();

/** Chapter names for a book's tracks, in track order. */
export function chapterTitles(book: IBook): IChapterTitle[] {
  let titles = cache.get(book);
  if (!titles) {
    titles = parseChapterTitles(
      book.tracks.map(track => track.title),
      book.name,
    );
    cache.set(book, titles);
  }
  return titles;
}

/** The parsed name of one track, or its raw title when the track is not in the book. */
export function chapterTitle(book: IBook | undefined, track: Pick<ITrack, 'id' | 'title'> | undefined): IChapterTitle {
  const raw = track?.title ?? '';
  const index = book && track ? book.tracks.findIndex(item => item.id === track.id) : -1;
  return index >= 0 && book ? chapterTitles(book)[index] : { title: raw, part: '', full: raw };
}
