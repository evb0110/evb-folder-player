import { Asset } from 'expo-asset';
import type { IBook } from './types';
const assets = [require('../../assets/sample/chapter-01.wav'), require('../../assets/sample/chapter-02.wav'), require('../../assets/sample/chapter-03.wav')];
const titles = ['A place to begin', 'A quieter chapter', 'Your next story'];
export async function sampleBook(): Promise<IBook> {
  const files = await Promise.all(assets.map(async asset => { const file = Asset.fromModule(asset); await file.downloadAsync(); return file.localUri ?? file.uri; }));
  return { id: 'sample-book', root: 'sample', name: 'A Quieter Chapter', path: 'Sample library/A Quieter Chapter', tracks: files.map((uri, i) => ({ id: `sample-${i + 1}`, uri, name: `0${i + 1} - ${titles[i]}.wav`, title: titles[i], duration: 0 })) };
}
