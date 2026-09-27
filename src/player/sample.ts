import { Asset } from 'expo-asset';
import type { IBook } from './types';

const chapters = [
  { title: 'A place to begin', module: require('../../assets/sample/chapter-01.wav') },
  { title: 'A quieter chapter', module: require('../../assets/sample/chapter-02.wav') },
  { title: 'Your next story', module: require('../../assets/sample/chapter-03.wav') },
];

async function assetUri(module: number) {
  const asset = Asset.fromModule(module);
  await asset.downloadAsync();
  return asset.localUri ?? asset.uri;
}

export async function sampleBook(): Promise<IBook> {
  const uris = await Promise.all(chapters.map(chapter => assetUri(chapter.module)));
  return {
    id: 'sample-book',
    root: 'sample',
    name: 'A Quieter Chapter',
    path: 'Sample library/A Quieter Chapter',
    tracks: chapters.map((chapter, i) => ({
      id: `sample-${i + 1}`,
      uri: uris[i],
      name: `0${i + 1} - ${chapter.title}.wav`,
      title: chapter.title,
      duration: 0,
    })),
  };
}
