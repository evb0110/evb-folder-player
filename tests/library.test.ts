import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clockTime, naturalCompare, folderChildren, percent } from '../src/player/format.ts';
import type { IBook } from '../src/player/types.ts';
const book = (path: string): IBook => ({ id: path, root: 'test', path, name: path.split('/').at(-1)!, tracks: [] });
test('numeric filenames play in chapter order, including numbers larger than machine integers', () => {
  assert.deepEqual(['Chapter 10', 'Chapter 2', 'Chapter 1'].sort(naturalCompare), ['Chapter 1', 'Chapter 2', 'Chapter 10']);
  assert.ok(naturalCompare('9007199254740992', '9007199254740993') < 0);
});
test('folder browser preserves hierarchy without conflating sibling prefixes', () => {
  const books = [book('Audiobooks/Dickens/Book 2'), book('Audiobooks/Dickens/Book 10'), book('Audiobooks2/Other'), book('Loose book')];
  assert.deepEqual(folderChildren(books, '').folders, ['Audiobooks', 'Audiobooks2']);
  assert.deepEqual(folderChildren(books, 'Audiobooks').folders, ['Audiobooks/Dickens']);
  assert.deepEqual(folderChildren(books, 'Audiobooks/Dickens').books.map(x => x.name), ['Book 2', 'Book 10']);
  assert.equal(folderChildren(books, '').books[0].name, 'Loose book');
});
test('long audiobook timestamps and progress remain readable at boundaries', () => {
  assert.equal(clockTime(3601000), '1:00:01');
  assert.equal(clockTime(-2000), '0:00');
  assert.equal(percent(90000, 60000), 100);
  assert.equal(percent(20000, 0), 0);
});
