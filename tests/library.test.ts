import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clockTime, folderChildren, naturalCompare, parentFolder, percent } from '../src/player/format.ts';
import { bookPlayback, sleepMinutesLeft } from '../src/player/playback.ts';
import { importSummary } from '../src/player/importText.ts';
import { hasLiveAlerts } from '../src/player/liveAlerts.ts';
import type { IBook } from '../src/player/types.ts';
const book = (path: string): IBook => ({ id: path, root: 'test', path, name: path.split('/').at(-1)!, tracks: [] });
test('numeric filenames play in chapter order, including numbers larger than machine integers', () => {
  assert.deepEqual(['Chapter 10', 'Chapter 2', 'Chapter 1'].sort(naturalCompare), [
    'Chapter 1',
    'Chapter 2',
    'Chapter 10',
  ]);
  assert.ok(naturalCompare('9007199254740992', '9007199254740993') < 0);
});
test('folder browser preserves hierarchy without conflating sibling prefixes', () => {
  const books = [
    book('Audiobooks/Dickens/Book 2'),
    book('Audiobooks/Dickens/Book 10'),
    book('Audiobooks2/Other'),
    book('Loose book'),
  ];
  assert.deepEqual(folderChildren(books, '').folders, ['Audiobooks', 'Audiobooks2']);
  assert.deepEqual(folderChildren(books, 'Audiobooks').folders, ['Audiobooks/Dickens']);
  assert.deepEqual(
    folderChildren(books, 'Audiobooks/Dickens').books.map(x => x.name),
    ['Book 2', 'Book 10'],
  );
  assert.equal(folderChildren(books, '').books[0].name, 'Loose book');
});
test('long audiobook timestamps and progress remain readable at boundaries', () => {
  assert.equal(clockTime(3601000), '1:00:01');
  assert.equal(clockTime(-2000), '0:00');
  assert.equal(percent(90000, 60000), 100);
  assert.equal(percent(20000, 0), 0);
});

test('parent folder of a nested path, and the root for a top-level one', () => {
  assert.equal(parentFolder('Audiobooks/Dickens/Book 2'), 'Audiobooks/Dickens');
  assert.equal(parentFolder('Audiobooks'), '');
});

test('a loaded book reports live playback; others report saved progress', () => {
  const tracks = ['a', 'b', 'c'].map(id => ({ id, uri: id, name: id, title: id, duration: 60_000 }));
  const saved = {
    bookId: 'x',
    bookName: 'X',
    trackId: 'b',
    trackTitle: 'b',
    trackIndex: 1,
    position: 5000,
    duration: 0,
  };
  const shelf: IBook = { id: 'x', root: 'test', name: 'X', path: 'X', tracks, progress: saved };
  const idle = { playing: false, loading: false, speed: 1, boost: 0, canUndo: false };

  const fromSaved = bookPlayback(shelf, { ...idle, bookId: 'other', playing: true });
  assert.deepEqual(
    [fromSaved.active, fromSaved.playing, fromSaved.trackIndex, fromSaved.position, fromSaved.duration],
    [false, false, 1, 5000, 60_000],
  );

  const live = bookPlayback(shelf, {
    ...idle,
    ...saved,
    trackId: 'c',
    position: 9000,
    duration: 61_000,
    playing: true,
  });
  assert.deepEqual(
    [live.active, live.playing, live.trackIndex, live.position, live.duration],
    [true, true, 2, 9000, 61_000],
  );

  const missing = bookPlayback({ ...shelf, progress: { ...saved, trackId: 'gone' } }, idle);
  assert.deepEqual([missing.trackIndex, missing.position], [0, 0]);
});

test('sleep timer rounds remaining minutes up and reports zero when off', () => {
  assert.equal(sleepMinutesLeft(undefined, 0), 0);
  assert.equal(sleepMinutesLeft(90_001, 0), 2);
  assert.equal(sleepMinutesLeft(1000, 5000), 0);
});

test('import banner explains where the archive went', () => {
  const base = { id: 1, name: 'Book.zip', folder: 'Book', destination: 'Audiobooks' };
  assert.equal(importSummary({ ...base, state: 'running', progress: 0.426 }).text, '43% unpacked');
  assert.equal(importSummary({ ...base, state: 'running', progress: -1 }).text, 'Unpacking…');
  assert.equal(
    importSummary({ ...base, state: 'done', archive: 'deleted' }).text,
    'Saved in Audiobooks. The archive was deleted.',
  );
  assert.match(importSummary({ ...base, state: 'done', archive: 'kept', source: 'telegram' }).text, /Telegram keeps/);
  assert.match(
    importSummary({ ...base, state: 'done', archive: 'kept', source: 'downloads' }).text,
    /still in Downloads/,
  );
  assert.match(importSummary({ ...base, state: 'done', archive: 'kept', source: 'other' }).text, /was kept/);
  assert.equal(importSummary({ ...base, state: 'failed', message: 'Damaged.' }).text, 'Damaged.');
});
test('only ColorOS phones get the Live Alerts lock-screen tip', () => {
  assert.ok(hasLiveAlerts('OPPO', 'OPPO'));
  assert.ok(hasLiveAlerts('OnePlus', 'OnePlus'));
  assert.ok(hasLiveAlerts('realme', 'realme'));
  assert.ok(!hasLiveAlerts('Google', 'google'));
  assert.ok(!hasLiveAlerts('samsung', 'samsung'));
});
