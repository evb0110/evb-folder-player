interface IStore {
  name: string;
  url: string | null;
}

// Set each URL to its confirmed listing to turn its in-review card into a link.
export const STORES: IStore[] = [{ name: 'F-Droid', url: null }];

// Store screenshots in public/screenshots/<id>.png, in gallery order.
export const SCREENSHOTS = [
  {
    id: 1,
    title: 'Your library',
    alt: 'Light-themed library with Books and Folders tabs, a search field, A Quieter Chapter audiobook, and Add folder.',
  },
  {
    id: 2,
    title: 'Pick up your book',
    alt: 'Audiobook player showing A Quieter Chapter, saved position, play and 20-second jumps, speed, sleep timer, bookmark, undo and history controls.',
  },
  {
    id: 3,
    title: 'Chapters in order',
    alt: 'Naturally ordered chapter list with A place to begin selected, followed by A quieter chapter and Your next story, above the mini player.',
  },
  {
    id: 4,
    title: 'Larger controls',
    alt: 'Car mode with an extra-large play button, separate 20-second backward and forward controls, and a keep-screen-on control.',
  },
  {
    id: 5,
    title: 'A darker evening',
    alt: 'Dark-themed audiobook player with a green play button and sleep timer options from off to 60 minutes.',
  },
  {
    id: 6,
    title: 'Find your place again',
    alt: 'Dark-themed listening history with All and Bookmarks tabs, an Undo button, a saved bookmark and earlier listening positions.',
  },
];
