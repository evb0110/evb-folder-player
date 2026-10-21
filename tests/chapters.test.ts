import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseChapterTitles } from '../src/player/chapters.ts';

const parse = (titles: string[], book = '') => parseChapterTitles(titles, book).map(({ title, part }) => [part, title]);

test('an omnibus chapter shows its story, with the collection it belongs to as its part', () => {
  const titles = [
    '040 - The Adventures of Sherlock Holmes - The Adventure of the Engineer’s Thumb',
    '041 - The Adventures of Sherlock Holmes - The Adventure of the Noble Bachelor',
    '042 - The Adventures of Sherlock Holmes - The Adventure of the Beryl Coronet',
    '043 - The Memoirs of Sherlock Holmes - Foreword',
    '044 - The Memoirs of Sherlock Holmes - Silver Blaze',
  ].map((title, i) => title.replace(/^\d+/, String(i + 1).padStart(3, '0')));
  assert.deepEqual(parse(titles, 'Sherlock Holmes Collection'), [
    ['The Adventures of Sherlock Holmes', 'The Adventure of the Engineer’s Thumb'],
    ['The Adventures of Sherlock Holmes', 'The Adventure of the Noble Bachelor'],
    ['The Adventures of Sherlock Holmes', 'The Adventure of the Beryl Coronet'],
    ['The Memoirs of Sherlock Holmes', 'Foreword'],
    ['The Memoirs of Sherlock Holmes', 'Silver Blaze'],
  ]);
  assert.equal(
    parseChapterTitles(titles)[1].full,
    '002 - The Adventures of Sherlock Holmes - The Adventure of the Noble Bachelor',
  );
});

test('chapter numbers are dropped only when they count the chapters', () => {
  assert.deepEqual(parse(['01 - Introduction', '02. Down the Rabbit-Hole', '03_The Pool of Tears']), [
    ['', 'Introduction'],
    ['', 'Down the Rabbit-Hole'],
    ['', 'The Pool of Tears'],
  ]);
  // A year in the name, disc-numbered files and a folder that starts mid-book keep their numbers.
  assert.deepEqual(parse(['1984 - Part 1', '1984 - Part 2']), [
    ['1984', 'Part 1'],
    ['1984', 'Part 2'],
  ]);
  assert.deepEqual(
    parse(['101 Opening', '102 Arrival', '201 Return']).map(([, title]) => title),
    ['101 Opening', '102 Arrival', '201 Return'],
  );
  assert.deepEqual(parse(['1984']), [['', '1984']]);
});

test('a part equal to the book name is not repeated, and lone titles stay whole', () => {
  assert.deepEqual(parse(['Bleak House - Chapter 1', 'Bleak House - Chapter 2'], 'Bleak House'), [
    ['', 'Chapter 1'],
    ['', 'Chapter 2'],
  ]);
  assert.deepEqual(parse(['Preface - by the author', 'Chapter 1', 'Chapter 2']), [
    ['', 'Preface - by the author'],
    ['', 'Chapter 1'],
    ['', 'Chapter 2'],
  ]);
  // Hyphenated words are not separators; identical neighbors keep a name of their own.
  assert.deepEqual(parse(['Well-Known Tales - One', 'Well-Known Tales - One']), [
    ['Well-Known Tales', 'One'],
    ['Well-Known Tales', 'One'],
  ]);
  assert.deepEqual(parse(['Dickens – A Tale of Two Cities — Book 1', 'Dickens – A Tale of Two Cities — Book 2']), [
    ['Dickens – A Tale of Two Cities', 'Book 1'],
    ['Dickens – A Tale of Two Cities', 'Book 2'],
  ]);
});
